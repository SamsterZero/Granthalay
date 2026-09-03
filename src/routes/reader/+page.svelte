<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Highlighter } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { resolve, assets } from '$app/paths';
	import ReaderAppearance from '$lib/components/reader/ReaderAppearance.svelte';
	import ReaderAnnotations from '$lib/components/reader/ReaderAnnotations.svelte';
	import ReaderFooter from '$lib/components/reader/ReaderFooter.svelte';
	import ReaderHeader from '$lib/components/reader/ReaderHeader.svelte';
	import ReaderViewport from '$lib/components/reader/ReaderViewport.svelte';
	import {
		deleteAnnotation,
		getBookAnnotations,
		saveAnnotation,
		updateBookProgress
	} from '$lib/db';
	import type { BookAnnotation, NewBookAnnotation } from '$lib/reader/annotations';
	import { captureHighlight, renderHighlights } from '$lib/reader/highlights';
	import type { EpubChapter } from '$lib/epub/engine';
	import { pageToProgression, progressionToPage, repaginatePage } from '$lib/reader/pagination';
	import { resolveInternalNavigation } from '$lib/reader/navigation';
	import { isInteractiveReaderTarget, readerKeyboardAction } from '$lib/reader/keyboard';
	import { loadReaderBook } from '$lib/reader/load';
	import { measureChapterPageCounts } from '$lib/reader/page-count';
	import {
		DEFAULT_READER_PREFERENCES,
		loadBookReaderPreferences,
		loadGlobalReaderPreferences,
		readerMarginPixels,
		readerPreferencesKey,
		supportsTypographyOverrides,
		type ReaderPreferences
	} from '$lib/reader/preferences';

	let loading = $state(true);
	let error = $state<string | null>(null);
	let bookTitle = $state('Unknown Book');
	let bookId = $state('default');
	let currentChapter = $state(0);
	let chapters = $state<EpubChapter[]>([]);
	let chapterCSS = $state('');
	let currentPage = $state(0);
	let totalPages = $state(0);
	let darkMode = $state(false);
	let settingsOpen = $state(false);
	let annotationsOpen = $state(false);
	let annotations = $state<BookAnnotation[]>([]);
	let pendingHighlight = $state<NewBookAnnotation | null>(null);
	let highlightActionPosition = $state<{ left: number; top: number } | null>(null);
	let annotationStatus = $state('');
	let preferences = $state<ReaderPreferences>({ ...DEFAULT_READER_PREFERENCES });
	let readerPadding = $derived(readerMarginPixels(preferences.margins));
	let typographyOverridesAllowed = $derived(
		chapters[currentChapter] ? supportsTypographyOverrides(chapters[currentChapter]) : false
	);
	let activeReaderPadding = $derived(typographyOverridesAllowed ? readerPadding : 32);

	let contentContainer = $state<HTMLElement | null>(null);
	let scrollContainer = $state<HTMLElement | null>(null);
	let containerWidth = $state(0);
	let jumpToLastPage = $state(false);
	let initialProgression = $state<number | null>(null);
	let isCalculating = $state(false);
	let chapterPageCounts = $state<number[]>([]);
	let totalBookPages = $state(0);
	let pageCountCalculation = 0;
	let scrollChapterTransition = false;
	let pagesRead = $derived.by(() => {
		if (preferences.navigation === 'scroll') return currentChapter + 1;
		let count = 0;
		for (let i = 0; i < currentChapter; i++) {
			count += chapterPageCounts[i] || 1;
		}
		count += currentPage + 1;
		return count;
	});
	let currentBookmark = $derived(
		annotations.find(
			(annotation) =>
				annotation.kind === 'bookmark' &&
				annotation.location.href === chapters[currentChapter]?.href &&
				Math.abs(annotation.location.progression - pageToProgression(currentPage, totalPages)) <
					0.01
		)
	);

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		bookId = params.get('bookId') || 'default';
		preferences = loadBookReaderPreferences(bookId);
		applyReaderTheme(preferences.theme);

		try {
			const loaded = await loadReaderBook(params, `${assets}/books/pg78627-images-3.epub`);
			chapters = loaded.chapters;
			bookTitle = loaded.title;
			currentChapter = loaded.currentChapter;
			currentPage = loaded.currentPage;
			initialProgression = loaded.initialProgression;
			chapterCSS = chapters[currentChapter].css;
			try {
				annotations = await getBookAnnotations(bookId);
			} catch {
				annotationStatus = 'Saved annotations are unavailable, but reading can continue.';
			}
			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load EPUB';
			loading = false;
		}
	});

	function goBack() {
		goto(resolve('/')).then(() => {});
	}

	function toggleDarkMode() {
		updatePreferences({ theme: darkMode ? 'light' : 'dark' });
	}

	async function toggleBookmark() {
		if (!chapters[currentChapter]) return;
		try {
			if (currentBookmark) {
				await deleteAnnotation(currentBookmark.id);
				annotations = annotations.filter((annotation) => annotation.id !== currentBookmark?.id);
				annotationStatus = 'Bookmark removed.';
				return;
			}

			const bookmark = await saveAnnotation({
				bookId,
				kind: 'bookmark',
				location: {
					href: chapters[currentChapter].href,
					progression: pageToProgression(currentPage, totalPages)
				}
			});
			annotations = [...annotations, bookmark];
			annotationStatus = 'Bookmark saved on this device.';
		} catch {
			annotationStatus = 'The bookmark could not be saved. Browser storage may be unavailable.';
		}
	}

	function updatePendingHighlight() {
		const selection = window.getSelection();
		const captured =
			contentContainer && chapters[currentChapter]
				? captureHighlight(contentContainer, selection, bookId, chapters[currentChapter].href)
				: null;
		if (!captured || !selection || selection.rangeCount === 0) {
			pendingHighlight = null;
			highlightActionPosition = null;
			return;
		}

		const rect = selection.getRangeAt(0).getBoundingClientRect();
		pendingHighlight = captured;
		highlightActionPosition = {
			left: Math.min(window.innerWidth - 52, Math.max(52, rect.left + rect.width / 2)),
			top: Math.max(48, rect.top - 12)
		};
	}

	async function createHighlight() {
		if (!pendingHighlight) return;
		try {
			const highlight = await saveAnnotation(pendingHighlight);
			annotations = [...annotations, highlight];
			pendingHighlight = null;
			highlightActionPosition = null;
			window.getSelection()?.removeAllRanges();
			annotationStatus = 'Highlight saved on this device.';
		} catch {
			annotationStatus = 'The highlight could not be saved. Browser storage may be unavailable.';
		}
	}

	async function removeAnnotation(annotation: BookAnnotation) {
		try {
			await deleteAnnotation(annotation.id);
			annotations = annotations.filter((item) => item.id !== annotation.id);
			annotationStatus = `${annotation.kind === 'highlight' ? 'Highlight' : 'Bookmark'} removed.`;
		} catch {
			annotationStatus = 'The annotation could not be removed. Browser storage may be unavailable.';
		}
	}

	async function navigateToAnnotation(annotation: BookAnnotation) {
		const chapter = chapters.findIndex((item) => item.href === annotation.location.href);
		if (chapter < 0) {
			annotationStatus = 'This annotation’s chapter is no longer available.';
			return;
		}

		annotationsOpen = false;
		settingsOpen = false;
		if (chapter === currentChapter && totalPages > 0) {
			currentPage = progressionToPage(annotation.location.progression, totalPages);
		} else {
			initialProgression = annotation.location.progression;
			goToChapter(chapter);
		}
		await tick();
		if (annotation.kind === 'highlight') {
			setTimeout(() => {
				const mark = contentContainer?.querySelector<HTMLElement>(
					`mark[data-annotation-id="${CSS.escape(annotation.id)}"]`
				);
				if (!mark) {
					annotationStatus = 'The highlighted text could not be found in this edition.';
				} else if (preferences.navigation === 'scroll') {
					mark.scrollIntoView({ block: 'center' });
				} else if (containerWidth > 0) {
					currentPage = Math.min(
						totalPages - 1,
						Math.max(0, Math.floor(mark.offsetLeft / containerWidth))
					);
				}
			}, 150);
		}
		annotationStatus = `${annotation.kind === 'highlight' ? 'Highlight' : 'Bookmark'} opened.`;
	}

	function applyReaderTheme(theme: ReaderPreferences['theme']) {
		darkMode =
			theme === 'dark' ||
			(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.classList.toggle('dark', darkMode);
	}

	function updatePreferences(update: Partial<ReaderPreferences>) {
		preferences = { ...preferences, ...update };
		localStorage.setItem(readerPreferencesKey(bookId), JSON.stringify(preferences));
		if (update.theme) applyReaderTheme(preferences.theme);
	}

	function resetReaderPreferences() {
		preferences = loadGlobalReaderPreferences();
		localStorage.removeItem(readerPreferencesKey(bookId));
		applyReaderTheme(preferences.theme);
	}

	const logicalChapters = $derived(chapters.filter((c) => !c.title.includes('(cont.)')));
	const showSubtitle = $derived(logicalChapters.length > 1);
	let isNovelMode = $derived(logicalChapters.length > 1);

	function updatePagination() {
		if (preferences.navigation === 'scroll') {
			totalPages = 1;
			currentPage = 0;
			isCalculating = false;
			return;
		}
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
			const nextTotalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
			if (jumpToLastPage) {
				currentPage = nextTotalPages - 1;
				jumpToLastPage = false;
			} else if (initialProgression !== null) {
				currentPage = progressionToPage(initialProgression, nextTotalPages);
				initialProgression = null;
			} else if (totalPages > 0) {
				currentPage = repaginatePage(currentPage, totalPages, nextTotalPages);
			} else {
				currentPage = Math.min(Math.max(0, currentPage), nextTotalPages - 1);
			}
			totalPages = nextTotalPages;

			setTimeout(() => {
				isCalculating = false;
			}, 100);
		}
	}

	$effect(() => {
		const navigation = preferences.navigation;
		const timer = setTimeout(
			updatePagination,
			100,
			chapters[currentChapter],
			contentContainer,
			containerWidth,
			isNovelMode,
			navigation
		);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const width = containerWidth;
		const readerPreferences = preferences;
		if (width <= 0 || loading || chapters.length === 0 || preferences.navigation === 'scroll')
			return;

		const calculation = ++pageCountCalculation;
		const timer = setTimeout(async () => {
			const counts = await measureChapterPageCounts(chapters, width, readerPreferences);
			if (calculation === pageCountCalculation) {
				chapterPageCounts = counts;
				totalBookPages = counts.reduce((total, count) => total + count, 0);
			}
		}, 250);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const progressTotal = preferences.navigation === 'scroll' ? chapters.length : totalBookPages;
		if (!loading && chapters.length > 0 && !isCalculating && progressTotal > 0) {
			const progress = pagesRead / progressTotal;
			const params = new URLSearchParams(window.location.search);
			const bookId = params.get('bookId') || 'default';
			updateBookProgress(
				bookId,
				progress,
				currentChapter,
				currentPage,
				progressTotal,
				pageToProgression(currentPage, totalPages)
			);
		}
	});

	function goToChapter(index: number) {
		if (index >= 0 && index < chapters.length) {
			isCalculating = true;
			if (preferences.navigation === 'scroll' && scrollContainer) scrollContainer.scrollTop = 0;
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

	$effect(() => {
		const container = contentContainer;
		const href = chapters[currentChapter]?.href;
		const chapterHighlights = annotations.filter(
			(annotation) => annotation.kind === 'highlight' && annotation.location.href === href
		);
		if (!container || !href) return;
		void tick().then(() => renderHighlights(container, chapterHighlights));
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

	function handleKeydown(event: KeyboardEvent) {
		if (preferences.navigation === 'scroll') return;
		const action = readerKeyboardAction({
			key: event.key,
			modified: event.altKey || event.ctrlKey || event.metaKey,
			repeat: event.repeat,
			interactive: isInteractiveReaderTarget(event.target)
		});
		if (!action) return;

		event.preventDefault();
		if (action === 'next') nextPage();
		else if (action === 'previous') previousPage();
		else if (action === 'first') currentPage = 0;
		else currentPage = Math.max(0, totalPages - 1);
	}

	function handleContentClick(e: MouseEvent) {
		const selection = window.getSelection();
		if (selection && selection.toString().length > 0) return;
		const target = e.target as HTMLElement;
		const link = target.closest<HTMLAnchorElement>('a[data-epub-href]');
		if (link) {
			e.preventDefault();
			void followInternalLink(link.dataset.epubHref ?? '');
			return;
		}
		if (target.closest('a') || target.closest('button')) return;
		if (preferences.navigation === 'scroll') return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		if (x > rect.width * 0.7) nextPage();
		else if (x < rect.width * 0.3) previousPage();
	}

	async function followInternalLink(href: string) {
		const destination = resolveInternalNavigation(href, chapters);
		if (!destination) return;

		goToChapter(destination.chapter);

		await tick();
		if (!destination.fragment || !contentContainer || containerWidth <= 0) return;

		const escapedFragment = CSS.escape(destination.fragment);
		const element = contentContainer.querySelector<HTMLElement>(
			`#${escapedFragment}, [name="${escapedFragment}"]`
		);
		if (!element) return;

		const nextTotalPages = Math.max(1, Math.ceil(contentContainer.scrollWidth / containerWidth));
		totalPages = nextTotalPages;
		currentPage = Math.min(
			nextTotalPages - 1,
			Math.max(0, Math.floor(element.offsetLeft / containerWidth))
		);
		isCalculating = false;
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
		if (preferences.navigation === 'scroll' && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 40) {
			if (dy > 0 && isAtScrollStart()) void navigateScrollChapter(-1);
			else if (dy < 0 && isAtScrollEnd()) void navigateScrollChapter(1);
			return;
		}

		// Require more horizontal than vertical movement and a minimum distance
		if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
			const swipeRight = dx > 0;
			const next = preferences.navigation === 'rtl' ? swipeRight : !swipeRight;
			if (next) nextPage();
			else previousPage();
		}
	}

	function handleWheel(event: WheelEvent) {
		if (preferences.navigation !== 'scroll' || event.deltaY === 0) return;
		if (event.deltaY < 0 && isAtScrollStart()) {
			event.preventDefault();
			void navigateScrollChapter(-1);
		} else if (event.deltaY > 0 && isAtScrollEnd()) {
			event.preventDefault();
			void navigateScrollChapter(1);
		}
	}

	function isAtScrollStart() {
		return (scrollContainer?.scrollTop ?? 0) <= 1;
	}

	function isAtScrollEnd() {
		if (!scrollContainer) return false;
		return (
			scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 1
		);
	}

	async function navigateScrollChapter(direction: -1 | 1) {
		const destination = currentChapter + direction;
		if (
			scrollChapterTransition ||
			destination < 0 ||
			destination >= chapters.length ||
			!scrollContainer
		)
			return;

		scrollChapterTransition = true;
		goToChapter(destination);
		await tick();
		if (scrollContainer) {
			scrollContainer.scrollTop = direction < 0 ? scrollContainer.scrollHeight : 0;
		}
		setTimeout(() => (scrollChapterTransition = false), 250);
	}
</script>

<svelte:window on:keydown={handleKeydown} />
<svelte:document onselectionchange={updatePendingHighlight} />

<div class="flex h-screen flex-col bg-background font-sans">
	<ReaderHeader
		{loading}
		{bookTitle}
		{chapters}
		{currentChapter}
		showChapterSelector={showSubtitle}
		{darkMode}
		bookmarked={Boolean(currentBookmark)}
		{annotationsOpen}
		{settingsOpen}
		onBack={goBack}
		onToggleTheme={toggleDarkMode}
		onToggleBookmark={() => void toggleBookmark()}
		onToggleAnnotations={() => {
			annotationsOpen = !annotationsOpen;
			settingsOpen = false;
		}}
		onToggleSettings={() => {
			settingsOpen = !settingsOpen;
			annotationsOpen = false;
		}}
		onChapterChange={goToChapter}
	/>
	<p class="sr-only" aria-live="polite">{annotationStatus}</p>

	{#if pendingHighlight && highlightActionPosition}
		<button
			type="button"
			class="fixed z-[60] flex -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-full bg-foreground px-3 py-2 text-xs font-semibold text-background shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2"
			style:left={`${highlightActionPosition.left}px`}
			style:top={`${highlightActionPosition.top}px`}
			onpointerdown={(event) => event.preventDefault()}
			onclick={() => void createHighlight()}
			aria-label="Save selected text as a highlight"
		>
			<Highlighter class="h-4 w-4" aria-hidden="true" />
			Highlight
		</button>
	{/if}

	{#if annotationsOpen}
		<ReaderAnnotations
			{annotations}
			onNavigate={(annotation) => void navigateToAnnotation(annotation)}
			onRemove={(annotation) => void removeAnnotation(annotation)}
			onClose={() => (annotationsOpen = false)}
		/>
	{/if}

	{#if settingsOpen}
		<ReaderAppearance
			{preferences}
			onUpdate={updatePreferences}
			onReset={resetReaderPreferences}
			resetLabel="Use global defaults"
		/>
	{/if}

	<ReaderViewport
		{loading}
		{error}
		chapter={chapters[currentChapter]}
		{isCalculating}
		{isNovelMode}
		{typographyOverridesAllowed}
		{preferences}
		{activeReaderPadding}
		{currentPage}
		navigation={preferences.navigation}
		bind:contentContainer
		bind:containerWidth
		bind:scrollContainer
		onBack={goBack}
		onContentClick={handleContentClick}
		onTouchStart={handleTouchStart}
		onTouchEnd={handleTouchEnd}
		onWheel={handleWheel}
	/>

	<ReaderFooter
		{chapters}
		{currentChapter}
		{currentPage}
		{totalPages}
		{pagesRead}
		{totalBookPages}
		showChapterNavigation={showSubtitle}
		navigation={preferences.navigation}
		onPrevious={previousPage}
		onNext={nextPage}
	/>
</div>
