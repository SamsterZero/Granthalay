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
			bookTitle = engine.metadata.title;
			chapters = await engine.parseChapters(spineInfos);

			if (chapters.length > 0) {
				const initialChapter = Math.min(Math.max(0, targetChapter), chapters.length - 1);
				currentChapter = initialChapter;
				currentPage = targetPage;
				chapterCSS = chapters[initialChapter].css;
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

	function updatePagination() {
		if (chapters[currentChapter]?.isCover || (chapters[currentChapter]?.content.length < 1000 && chapters[currentChapter]?.content.includes('<img'))) {
			totalPages = 1;
			currentPage = 0;
			isCalculating = false;
			return;
		}
		if (contentContainer && containerWidth > 0) {
			const scrollWidth = contentContainer.scrollWidth;
			totalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
			if (jumpToLastPage) { 
				currentPage = Math.max(0, totalPages - 1); 
				jumpToLastPage = false; 
			}
			
			// Stay in calculating state for a tiny bit longer to ensure
			// the snap-to-page transform is applied before we show the content
			setTimeout(() => {
				isCalculating = false;
			}, 100);
		}
	}

	$effect(() => {
		const timer = setTimeout(updatePagination, 2000, chapters[currentChapter], contentContainer, containerWidth);
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
			if (chapters[i].isCover) {
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
	<header class="flex items-center justify-between border-b border-border bg-background px-6 py-4 shadow-sm">
		<Button variant="ghost" onclick={goBack} class="flex items-center gap-2"><ChevronLeft class="h-4 w-4" /></Button>
		<div class="max-w-xs text-left sm:text-center">
			<h1 class="truncate text-xl font-semibold text-foreground">{bookTitle}</h1>
			{#if chapters[currentChapter]}<p class="truncate text-sm text-muted-foreground">{chapters[currentChapter]?.title}</p>{/if}
		</div>
		<Button variant="outline" size="icon" class="rounded-full cursor-pointer" onclick={toggleDarkMode}>
			{#if darkMode}<Sun size={20} />{:else}<Moon size={20} />{/if}
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
											style="column-width: {containerWidth ? `calc(${containerWidth}px - 4rem)` : '100%'}; column-gap: 4rem; column-fill: auto;"
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
		<p class="text-sm text-muted-foreground">
			Page {currentPage + 1} / {totalPages}
		</p>
	</footer>
</div>

<style>
	:global(.prose img) { max-width: 100%; height: auto; display: block; margin: 1rem auto; border-radius: 0.5rem; }
	:global(.prose .x-ebookmaker-coverpage), :global(.prose .x-ebookmaker-cover), :global(.cover-container .epub-content) { height: 100% !important; width: 100% !important; display: flex; align-items: center; justify-content: center; padding: 0 !important; margin: 0 !important; }
	:global(.cover-container img), :global(.cover-container svg) { max-width: 100% !important; max-height: 100% !important; width: auto !important; height: auto !important; object-fit: contain !important; margin: 0 auto !important; display: block !important; }
	:global(.prose p) { margin-bottom: 1rem; text-align: justify; }
	:global(.prose h1, .prose h2, .prose h3) { margin: 1.5rem 0 1rem 0; break-after: avoid; }
	:global(.prose > *) { break-inside: avoid; }
	
	/* Theming: Set base color but allow book CSS to override via specificity */
	:global(.prose) {
		color: hsl(var(--foreground));
	}
	
	:global(.epub-content) {
		color: inherit;
	}

	/* Force text colors in dark mode to prevent "gray" text from being unreadable */
	:global(.dark .prose), :global(.dark .prose *), :global(.dark .epub-content *) {
		color: hsl(var(--foreground)) !important;
	}
</style>
