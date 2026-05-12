<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve, assets } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft, Moon, Sun } from 'lucide-svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
	import { getBookById, updateBookProgress, type BookRecord } from '$lib/db';
	import { EpubEngine, type EpubChapter } from '$lib/epub/engine';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let bookTitle = $state('Unknown Book');
	let currentChapter = $state(0);
	let chapters = $state<EpubChapter[]>([]);
	let chapterCSS = $state('');
	let currentPage = $state(0);
	let totalPages = $state(0);
	let darkMode = $state(false);

	let contentContainer = $state<HTMLElement | null>(null);
	let containerWidth = $state(0);
	let jumpToLastPage = $state(false);
	let isCalculating = $state(false);
	let chapterPageCounts = $state<number[]>([]);
	let totalBookPages = $state(0);
	let pagesRead = $derived.by(() => {
		let count = 0;
		for (let i = 0; i < currentChapter; i++) {
			count += chapterPageCounts[i] || 1;
		}
		count += currentPage + 1;
		return count;
	});

	onMount(async () => {
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
			darkMode = true;
			document.documentElement.classList.add('dark');
		}

		try {
			const params = new URLSearchParams(window.location.search);
			const bookId = params.get('bookId') || 'default';
			const chapterParam = params.get('chapter');
			const pageParam = params.get('page');
			let targetChapter = chapterParam ? parseInt(chapterParam, 10) : 0;
			let targetPage = pageParam ? parseInt(pageParam, 10) : 0;

			let arrayBuffer: ArrayBuffer;
			let storedRecord: Partial<BookRecord> | null = null;

			if (bookId === 'default') {
				const response = await fetch(`${assets}/books/pg78627-images-3.epub`);
				if (!response.ok) throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
				arrayBuffer = await response.arrayBuffer();
				
				if (!chapterParam) {
					const stored = localStorage.getItem('book-progress-default');
					if (stored) {
						storedRecord = JSON.parse(stored);
					}
				}
			} else {
				const book = await getBookById(bookId);
				if (!book) throw new Error('Book not found in library');
				arrayBuffer = book.buffer;
				if (!chapterParam) {
					storedRecord = book;
				}
			}

			if (storedRecord) {
				if (storedRecord.currentChapter !== undefined) targetChapter = storedRecord.currentChapter;
				if (storedRecord.currentPage !== undefined) targetPage = storedRecord.currentPage;
			}

			const engine = new EpubEngine(arrayBuffer);
			const spineInfos = await engine.init();
			if (spineInfos) {
				chapters = await engine.parseChapters(spineInfos);
			}

			if (chapters.length > 0) {
				bookTitle = engine.metadata.title || 'Unknown Book';
				const initialChapter = Math.min(Math.max(0, targetChapter), chapters.length - 1);
				currentChapter = initialChapter;
				currentPage = targetPage;
				chapterCSS = chapters[initialChapter].css;
				
				// Calculate total pages in background
				setTimeout(calculateChapterPageCounts, 500);
			} else {
				throw new Error('No readable content found in EPUB');
			}
			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load EPUB';
			loading = false;
		}
	});
	
	function goBack() { goto(resolve('/')).then(() => {}); }

	function toggleDarkMode() {
		darkMode = !darkMode;
		if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
		else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
	}
	
	const logicalChapters = $derived(chapters.filter(c => !c.title.includes('(cont.)')));
	const showSubtitle = $derived(logicalChapters.length > 1);
	let isNovelMode = $derived(logicalChapters.length > 1);

	function updatePagination() {
		if (!isNovelMode) {
			// Illustrated Mode: Each spine item is exactly one page
			totalPages = 1;
			currentPage = 0;
			isCalculating = false;
			return;
		}

		// Novel Mode: Use standard multi-column pagination
		if (contentContainer && containerWidth > 0) {
			const scrollWidth = contentContainer.scrollWidth;
			totalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
			if (jumpToLastPage) { 
				currentPage = Math.max(0, totalPages - 1); 
				jumpToLastPage = false; 
			}
			
			setTimeout(() => {
				isCalculating = false;
			}, 100);
		}
	}

	$effect(() => {
		const timer = setTimeout(updatePagination, 100, chapters[currentChapter], contentContainer, containerWidth, isNovelMode);
		return () => clearTimeout(timer);
	});

	async function calculateChapterPageCounts() {
		if (!containerWidth || chapters.length === 0 || chapterPageCounts.length > 0) return;
		
		const calcDiv = document.createElement('div');
		// Match the reader's layout exactly for accurate calculation
		calcDiv.className = 'prose prose-lg max-w-none';
		calcDiv.style.width = `${containerWidth}px`;
		calcDiv.style.columnWidth = `${containerWidth - 64}px`; // 64px = px-8 total padding
		calcDiv.style.columnGap = '64px';
		calcDiv.style.columnFill = 'auto';
		calcDiv.style.position = 'fixed';
		calcDiv.style.left = '-9999px';
		calcDiv.style.visibility = 'hidden';
		calcDiv.style.maxHeight = 'calc(100vh - 160px)'; // Approximate main area height
		document.body.appendChild(calcDiv);
		
		const counts: number[] = [];
		let total = 0;
		
		// Run in chunks to avoid blocking the main thread too much
		for (let i = 0; i < chapters.length; i++) {
			const content = chapters[i].content;
			// Speed up: Illustrated pages and covers are always exactly 1 page
			if (chapters[i].isCover || content.includes('epub-illustrated-page') || (content.length < 1000 && content.includes('<img'))) {
				counts.push(1);
				total += 1;
				continue;
			}
			
			calcDiv.innerHTML = chapters[i].content;
			// Small delay to let browser layout (though usually synchronous for scrollWidth)
			const count = Math.max(1, Math.ceil(calcDiv.scrollWidth / containerWidth));
			counts.push(count);
			total += count;
			
			// Yield every few chapters
			if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
		}
		
		document.body.removeChild(calcDiv);
		chapterPageCounts = counts;
		totalBookPages = total;
	}

	$effect(() => {
		if (containerWidth > 0 && !loading && chapters.length > 0) {
			calculateChapterPageCounts();
		}
	});

	$effect(() => {
		if (!loading && chapters.length > 0 && !isCalculating && totalBookPages > 0) {
			const progress = pagesRead / totalBookPages;
			const params = new URLSearchParams(window.location.search);
			const bookId = params.get('bookId') || 'default';
			updateBookProgress(bookId, progress, currentChapter, currentPage, totalBookPages);
		}
	});

	function goToChapter(index: number) { 
		if (index >= 0 && index < chapters.length) { 
			isCalculating = true;
			currentChapter = index; 
			currentPage = 0; 
		} 
	}

	$effect(() => {
		if (chapters[currentChapter]) {
			chapterCSS = chapters[currentChapter].css;
		}
	});

	$effect(() => {
		if (chapterCSS) {
			const existingStyle = document.getElementById('epub-chapter-style');
			if (existingStyle) existingStyle.remove();
			const style = document.createElement('style');
			style.id = 'epub-chapter-style';
			style.textContent = chapterCSS;
			document.head.appendChild(style);
		}
	});

	function nextPage() { 
		if (currentPage < totalPages - 1) {
			currentPage++; 
		} else if (currentChapter < chapters.length - 1) {
			goToChapter(currentChapter + 1);
		}
	}
	
	function previousPage() { 
		if (currentPage > 0) {
			currentPage--; 
		} else if (currentChapter > 0) { 
			jumpToLastPage = true;
			goToChapter(currentChapter - 1); 
		} 
	}

	function handleKeydown(event: KeyboardEvent) { if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); nextPage(); } else if (event.key === 'ArrowLeft') { event.preventDefault(); previousPage(); } }

	function handleContentClick(e: MouseEvent) {
		const selection = window.getSelection(); if (selection && selection.toString().length > 0) return;
		const target = e.target as HTMLElement; if (target.closest('a') || target.closest('button')) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		if (x > rect.width * 0.7) nextPage(); else if (x < rect.width * 0.3) previousPage();
	}

	let touchStartX = 0;
	let touchStartY = 0;

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function handleTouchEnd(e: TouchEvent) {
		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const dx = touchEndX - touchStartX;
		const dy = touchEndY - touchStartY;

		// Require more horizontal than vertical movement and a minimum distance
		if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
			if (dx > 0) previousPage();
			else nextPage();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex h-screen flex-col bg-background font-sans">
	<header class="flex items-center gap-2 border-b border-border bg-background px-4 py-2 shadow-sm shrink-0 h-14">
		<Button variant="ghost" size="icon" onclick={goBack} class="shrink-0">
			<ChevronLeft class="h-5 w-5" />
		</Button>
		
		<div class="flex-1 min-w-0 text-left px-2">
			{#if loading}
				<div class="space-y-1.5">
					<div class="h-3 w-32 animate-pulse rounded bg-muted"></div>
					<div class="h-2 w-20 animate-pulse rounded bg-muted/60"></div>
				</div>
			{:else}
				<h1 class="truncate text-sm font-bold text-foreground leading-tight">{bookTitle}</h1>
				{#if showSubtitle && chapters[currentChapter]}
					<p class="truncate text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5 font-medium">
						{chapters[currentChapter]?.title}
					</p>
				{/if}
			{/if}
		</div>

		<Button variant="ghost" size="icon" class="shrink-0 rounded-full" onclick={toggleDarkMode}>
			{#if darkMode}<Sun class="h-5 w-5" />{:else}<Moon class="h-5 w-5" />{/if}
		</Button>
	</header>

	<main class="flex-1 overflow-hidden">
		{#if loading}
			<div class="flex h-full flex-col items-center justify-center p-8"><div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div><p class="text-lg text-muted-foreground">Loading EPUB...</p></div>
		{:else if error}
			<div class="flex h-full items-center justify-center p-8"><Alert variant="destructive" class="max-w-md"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription><Button onclick={goBack} class="mt-4">Go Back</Button></Alert></div>
		{:else}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div 
					class="h-full bg-background overflow-hidden relative" 
					onclick={handleContentClick}
					ontouchstart={handleTouchStart}
					ontouchend={handleTouchEnd}
				>
					{#if isCalculating}
						<div class="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs transition-opacity duration-200">
							<div class="flex flex-col items-center gap-3">
								<div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
								<p class="text-xs font-medium text-muted-foreground animate-pulse">Arranging pages...</p>
							</div>
						</div>
					{/if}

					<div class="h-full w-full">
						{#if chapters[currentChapter]?.isCover}
							<div 
								class="h-full w-full bg-background transition-opacity duration-300 flex items-center justify-center"
								style="opacity: {isCalculating ? 0 : 1}"
							>
								<div class="h-full w-full p-0 m-0 flex items-center justify-center overflow-hidden cover-container">
									{@html chapters[currentChapter].content}
								</div>
							</div>
						{:else}
							<div class="h-full w-full flex justify-center">
								<div 
									class="h-full w-full max-w-3xl overflow-hidden bg-background px-8 py-8 shadow-sm border-x border-border" 
									bind:clientWidth={containerWidth}
								>
									<div 
										class="h-full w-full" 
										style="transform: translateX(-{currentPage * containerWidth}px); transition: {isCalculating ? 'none' : 'transform 0.3s ease-in-out'}; opacity: {isCalculating ? 0 : 1};"
									>
										<div 
											bind:this={contentContainer} 
											class="h-full prose prose-lg max-w-none" 
											class:is-novel-layout={isNovelMode}
											class:is-illustrated-layout={!isNovelMode}
											style="column-width: {isNovelMode ? `calc(${containerWidth}px - 4rem)` : 'none'}; column-gap: {isNovelMode ? '4rem' : '0'}; column-fill: auto;"
										>
											{@html chapters[currentChapter].content}
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
		{/if}
	</main>

	<footer class="border-t border-border bg-background px-6 py-3 text-center">
		<div class="flex items-center justify-center gap-4">
			{#if !showSubtitle}
				<!-- Single chapter book: show global progress -->
				<p class="text-sm text-muted-foreground font-medium">
					Page {pagesRead} of {totalBookPages > 0 ? totalBookPages : '...'}
				</p>
				{#if totalBookPages > 0}
					<div class="w-32 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
						<div class="h-full bg-[#0D5C63] transition-all duration-300" style="width: {(pagesRead / totalBookPages) * 100}%"></div>
					</div>
				{/if}
			{:else}
				<!-- Multi-chapter book: show per-chapter progress -->
				<p class="text-sm text-muted-foreground font-medium">
					Page {currentPage + 1} / {totalPages}
				</p>
			{/if}
		</div>
	</footer>
</div>

<style>
	:global(.prose img, .epub-content img) { 
		max-width: 100%; 
		max-height: calc(100vh - 200px) !important; 
		height: auto !important; 
		width: auto !important;
		display: block; 
		margin: 0 auto; 
		border-radius: 0.5rem; 
		object-fit: contain;
	}
	
	/* Novel Layout: Standard text flow with columns */
	:global(.is-novel-layout .epub-content) {
		height: 100%;
		color: inherit;
	}

	/* Illustrated Layout: Full-page centering for drawings */
	:global(.is-illustrated-layout .epub-content) {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.epub-illustrated-page) {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		width: 100%;
		max-height: calc(100vh - 200px) !important;
		overflow: hidden;
	}

	:global(.epub-content svg), :global(.epub-illustrated-page img) {
		max-width: 100% !important;
		max-height: 100% !important;
		width: auto !important;
		height: auto !important;
	}
	
	:global(.prose p) { margin-bottom: 1rem; text-align: justify; }
	:global(.prose h1, .prose h2, .prose h3) { margin: 1.5rem 0 1rem 0; break-after: avoid; }
	:global(.prose > *) { break-inside: avoid; }
	
	:global(.prose) {
		color: inherit;
	}

	/* Force text colors in dark mode */
	:global(.dark .prose), :global(.dark .prose *), :global(.dark .epub-content *) {
		color: hsl(var(--foreground)) !important;
	}
</style>
