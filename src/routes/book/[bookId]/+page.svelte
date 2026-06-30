<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getBookById, type BookRecord } from '$lib/db';
	import { EpubEngine, type EpubChapter } from '$lib/epub/engine';
	import { Button } from '$lib/components/ui/button';
	import TopBar from '$lib/components/library/book/TopBar.svelte';
	import BookDetailsSkeleton from '$lib/components/library/book/BookDetailsSkeleton.svelte';
	import ResumeFab from '$lib/components/library/book/ResumeFab.svelte';
	import BookInfoPanel from '$lib/components/library/book/BookInfoPanel.svelte';
	import ChapterList from '$lib/components/library/book/ChapterList.svelte';

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
</script>

<div class="min-h-screen lg:h-screen bg-background flex flex-col">
	<!-- Header -->
	<TopBar {title} {loading} {goBack} />
	{#if loading}
		<BookDetailsSkeleton />
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
			<BookInfoPanel {coverUrl} {title} {author} {description} />

			<!-- Right Panel: Chapters -->
			<ChapterList {chapters} {currentChapterIndex} {currentPageIndex} {startReading} />
		</div>
	{/if}

	<!-- FAB: Action Button -->
	<ResumeFab {currentChapterIndex} {startReading} />
</div>
