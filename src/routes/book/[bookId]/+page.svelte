<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getBookById, type BookRecord } from '$lib/db';
	import { EpubEngine, type EpubChapter } from '$lib/epub/engine';
	import { Play } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { Skeleton } from '$lib/components/ui/skeleton';

	const bookId = $derived(page.params.bookId ?? 'default');

	let loading = $state(true);
	let error = $state<string | null>(null);
	let title = $state('Unknown Book');
	let author = $state('');
	let description = $state('');
	let cover = $state<string | Blob | null>(null);
	let coverUrl = $state<string | null>(null);
	let chapters = $state<EpubChapter[]>([]);
	let currentChapterIndex = $state<number | null>(null);
	let currentPageIndex = $state<number | null>(null);

	$effect(() => {
		if (cover instanceof Blob) {
			const url = URL.createObjectURL(cover);
			coverUrl = url;
			return () => URL.revokeObjectURL(url);
		} else {
			coverUrl = cover as string | null;
			return () => {};
		}
	});

	onMount(async () => {
		try {
			let arrayBuffer: ArrayBuffer;
			let storedCover: string | Blob | null = null;
			let storedTitle: string | null = null;

			if (bookId === 'default') {
				const response = await fetch('/books/pg78627-images-3.epub');
				if (!response.ok) throw new Error('Failed to load default book');
				arrayBuffer = await response.arrayBuffer();
			} else if (bookId === 'test-user-book') {
				const response = await fetch('/books/pg5827-images-3.epub');
				if (!response.ok) throw new Error('Failed to load test user book');
				arrayBuffer = await response.arrayBuffer();
			} else {
				const record = await getBookById(bookId);
				if (!record) throw new Error('Book not found');
				arrayBuffer = record.buffer;
				storedCover = record.cover;
				storedTitle = record.title;
				// Pre-fill metadata immediately from DB to avoid "Unknown Book" flash
				title = record.title;
				cover = record.cover;
			}

			const engine = new EpubEngine(arrayBuffer);
			const spineInfos = await engine.init();
			if (spineInfos) {
				chapters = await engine.parseChapters(spineInfos);
			}
			
			author = engine.metadata.author;
			description = engine.metadata.description;
			storedTitle = engine.metadata.title;
			storedCover = engine.metadata.cover;

			let storedRecord: Partial<BookRecord> | null = null;
			if (bookId === 'default') {
				const stored = localStorage.getItem('book-progress-default');
				if (stored) {
					try {
						storedRecord = JSON.parse(stored);
					} catch {
						storedRecord = { progress: Number(stored) };
					}
				}
			} else if (bookId !== 'test-user-book') {
				storedRecord = await getBookById(bookId);
			}

			if (storedRecord) {
				currentChapterIndex = storedRecord.currentChapter ?? null;
				currentPageIndex = storedRecord.currentPage ?? null;
			}

			title = storedTitle || engine.metadata.title;
			author = engine.metadata.author;
			description = engine.metadata.description;
			cover = storedCover || engine.metadata.cover;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load book';
		} finally {
			loading = false;
		}
	});

	function goBack() {
		goto(resolve('/'));
	}

	function startReading(chapterIndex?: number) {
		const url = new URL(`${resolve('/reader')}`, window.location.origin);
		url.searchParams.set('bookId', bookId);
		
		if (chapterIndex !== undefined) {
			url.searchParams.set('chapter', chapterIndex.toString());
		} else if (currentChapterIndex !== null) {
			url.searchParams.set('chapter', currentChapterIndex.toString());
			if (currentPageIndex !== null) {
				url.searchParams.set('page', currentPageIndex.toString());
			}
		}
		
		goto(url.pathname + url.search);
	}

	function getInitials(name: string): string {
		return name.charAt(0).toUpperCase();
	}
</script>

<div class="min-h-screen lg:h-screen bg-background flex flex-col">
	<!-- Header -->
	<div class="border-b px-6 py-4 flex items-center gap-4 shrink-0">
		<Button variant="ghost" size="icon" onclick={goBack}>
			<ChevronLeft class="h-4 w-4" />
		</Button>
		{#if loading && title === 'Unknown Book'}
			<Skeleton class="h-6 w-48" />
		{:else}
			<h1 class="font-semibold text-lg line-clamp-1">{title}</h1>
		{/if}
	</div>

	{#if loading}
		<div class="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
			<!-- Left Panel Skeleton -->
			<div class="lg:w-1/3 lg:max-w-md lg:h-full lg:min-h-0 relative overflow-hidden lg:border-r p-6 lg:p-8">
				<div class="max-w-sm mx-auto lg:mx-0">
					<Skeleton class="aspect-2/3 max-w-[240px] mx-auto rounded-lg mb-6" />
					<Skeleton class="h-8 w-3/4 mb-2" />
					<Skeleton class="h-4 w-1/2 mb-4" />
					<Skeleton class="h-20 w-full" />
				</div>
			</div>
			<!-- Right Panel Skeleton -->
			<div class="flex-1 lg:h-full overflow-hidden flex flex-col bg-muted/30">
				<div class="p-6 border-b bg-background">
					<Skeleton class="h-10 w-32" />
				</div>
				<div class="flex-1 p-6 space-y-4">
					{#each [0, 1, 2, 3, 4, 5, 6, 7] as i (i)}
						<div class="flex items-center gap-4">
							<Skeleton class="h-12 w-full rounded-lg" />
						</div>
					{/each}
				</div>
			</div>
		</div>
	{:else if error}
		<div class="flex-1 flex items-center justify-center p-8">
			<div class="text-center">
				<p class="text-destructive mb-4">{error}</p>
				<Button onclick={goBack}>Go Back</Button>
			</div>
		</div>
	{:else}
		<!-- Two Panel Layout -->
		<div class="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
			<!-- Left Panel: Cover -->
			<div class="lg:w-1/3 lg:max-w-md lg:h-full lg:min-h-0 relative overflow-hidden lg:border-r">
				{#if coverUrl}
					<!-- Blurred background -->
					<div class="absolute inset-0">
						<img src={coverUrl} alt="" class="w-full h-full object-cover blur" />
						<div class="absolute inset-0 bg-linear-to-b from-transparent via-background/80 to-background"></div>
					</div>
				{:else}
					<div class="absolute inset-0 bg-linear-to-br from-[#0D5C63] to-[#094a50]"></div>
				{/if}
				<!-- Content -->
				<div class="relative z-10 p-6 lg:p-8 h-full overflow-y-auto">
					<div class="max-w-sm mx-auto lg:mx-0">
						<div class="aspect-2/3 max-w-[240px] mx-auto rounded-lg overflow-hidden shadow-lg mb-6">
							{#if coverUrl}
								<img src={coverUrl} alt={title} class="w-full h-full object-cover" />
							{:else}
								<div class="w-full h-full flex items-center justify-center bg-linear-to-br from-[#0D5C63] to-[#094a50] text-white text-5xl font-bold">
									{getInitials(title)}
								</div>
							{/if}
						</div>
						<h2 class="text-xl font-bold mb-2">{title}</h2>
						{#if author}
							<p class="text-muted-foreground mb-4">by {author}</p>
						{/if}
						{#if description}
							<p class="text-sm text-muted-foreground leading-relaxed">{description}</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- Right Panel: Chapters -->
			<div class="flex-1 lg:h-full lg:min-h-0 p-6 lg:p-8 overflow-y-auto">
				<h3 class="text-lg font-semibold mb-4">Chapters</h3>
				<div class="space-y-2">
					{#each chapters.filter(c => (!c.isFrontmatter || chapters.length === 1) && !c.title.includes('(cont.)')) as chapter, index (chapter.href)}
						{@const globalIndex = chapters.indexOf(chapter)}
						{@const isActive = globalIndex === currentChapterIndex}
						{@const isRead = currentChapterIndex !== null && globalIndex < currentChapterIndex}
						
						<button
							class={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
								isRead 
									? 'opacity-50 grayscale bg-muted/30' 
									: isActive
										? 'border-[#0D5C63] bg-[#0D5C63]/5 ring-1 ring-[#0D5C63]/20'
										: 'hover:bg-accent'
							}`}
							onclick={() => startReading(globalIndex)}
						>
							<span class={`text-sm w-8 ${isActive ? 'text-[#0D5C63] font-bold' : 'text-muted-foreground'}`}>
								{index + 1}
							</span>
							<div class="flex-1 min-w-0">
								<p class={`font-medium truncate ${isActive ? 'text-[#0D5C63]' : ''}`}>
									{chapter.title}
								</p>
								{#if isActive && currentPageIndex !== null}
									<p class="text-[10px] text-[#0D5C63]/70 font-medium mt-0.5">Currently at Page {currentPageIndex + 1}</p>
								{:else}
									<p class="text-[10px] text-muted-foreground mt-0.5">
										{isRead ? 'Completed' : 'Not started'}
									</p>
								{/if}
							</div>
							<Play class={`w-4 h-4 ${isActive ? 'text-[#0D5C63]' : 'text-muted-foreground'}`} />
						</button>
					{:else}
						<p class="text-muted-foreground text-center py-8">No chapters found</p>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- FAB: Action Button -->
	<Button
		class="fixed bottom-6 right-6 rounded-lg px-6 py-6 shadow-lg hover:shadow-xl transition-shadow bg-[#0D5C63] hover:bg-[#0D5C63]/90 text-white"
		size="lg"
		onclick={() => startReading()}
	>
		{#if currentChapterIndex === null}
			<Play class="w-5 h-5 mr-2" />
			Start Reading
		{:else}
			<Play class="w-5 h-5 mr-2" />
			Resume
		{/if}
	</Button>
</div>
