<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Bookmark, Highlighter, Trash2 } from 'lucide-svelte';
	import LibraryBottomBar from '$lib/components/library/LibraryBottomBar.svelte';
	import TopBar from '$lib/components/library/TopBar.svelte';
	import { Button } from '$lib/components/ui/button';
	import { deleteAnnotation, getAllAnnotations, getAllBooks, type BookMetadata } from '$lib/db';
	import type { BookAnnotation, AnnotationKind } from '$lib/reader/annotations';

	type AnnotationFilter = 'all' | AnnotationKind;

	let annotations = $state<BookAnnotation[]>([]);
	let books = $state<BookMetadata[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let filter = $state<AnnotationFilter>('all');
	let darkMode = $state(false);
	let showInstall = $state(false);
	let installPrompt = $state<unknown>(null);

	let filteredAnnotations = $derived(
		filter === 'all' ? annotations : annotations.filter((annotation) => annotation.kind === filter)
	);
	let bookTitles = $derived(
		new Map([
			['default', 'Bundled sample book'],
			...books.map((book) => [book.id, book.title] as const)
		])
	);

	onMount(async () => {
		const savedTheme = localStorage.getItem('theme');
		darkMode =
			savedTheme === 'dark' ||
			(!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
		if (darkMode) {
			document.documentElement.classList.add('dark');
		}

		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			installPrompt = e;
			showInstall = true;
		});

		try {
			[annotations, books] = await Promise.all([getAllAnnotations(), getAllBooks()]);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Annotations could not be loaded.';
		} finally {
			loading = false;
		}
	});

	function toggleDarkMode() {
		darkMode = !darkMode;
		if (darkMode) {
			document.documentElement.classList.add('dark');
			localStorage.setItem('theme', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.setItem('theme', 'light');
		}
	}

	async function handleInstall() {
		if (!installPrompt) return;
		installPrompt.prompt();
		const { outcome } = await installPrompt.userChoice;
		if (outcome === 'accepted') {
			showInstall = false;
			installPrompt = null;
		}
	}

	function openLibrary() {
		goto(resolve('/'));
	}

	function openSettings() {
		goto(resolve('/settings'));
	}

	function openAnnotation(annotation: BookAnnotation) {
		const params = new URLSearchParams({
			bookId: annotation.bookId,
			annotation: annotation.id
		});
		goto(`${resolve('/reader')}?${params.toString()}`);
	}

	async function removeAnnotation(annotation: BookAnnotation) {
		try {
			await deleteAnnotation(annotation.id);
			annotations = annotations.filter((item) => item.id !== annotation.id);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'The annotation could not be removed.';
		}
	}

	function annotationLabel(annotation: BookAnnotation): string {
		return annotation.kind === 'highlight'
			? annotation.selector?.exact.trim() || 'Highlighted passage'
			: `Bookmark at ${Math.round(annotation.location.progression * 100)}% of chapter`;
	}
</script>

<svelte:head><title>Annotations · Granthalay</title></svelte:head>

<div
	class="min-h-screen bg-background p-4 pb-24 font-sans text-foreground transition-colors duration-300"
>
	<TopBar {darkMode} {showInstall} onTheme={toggleDarkMode} onInstall={handleInstall} />

	<header class="mb-4 flex items-center justify-between">
		<div
			class="flex w-full gap-1 rounded-lg bg-muted p-1 sm:w-auto"
			aria-label="Filter annotations"
		>
			{#each ['all', 'bookmark', 'highlight'] as option (option)}
				<button
					type="button"
					class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors sm:flex-none"
					class:bg-background={filter === option}
					class:shadow-sm={filter === option}
					onclick={() => (filter = option as AnnotationFilter)}
					aria-pressed={filter === option}
				>
					{option === 'all' ? 'All' : `${option}s`}
				</button>
			{/each}
		</div>
	</header>

	<main class="mt-4">
		{#if loading}
			<p class="py-16 text-center text-muted-foreground" role="status">Loading annotations…</p>
		{:else if error}
			<div class="rounded-lg border border-destructive/40 bg-destructive/10 p-4" role="alert">
				<p class="font-medium">Annotations unavailable</p>
				<p class="mt-1 text-sm">{error}</p>
			</div>
		{:else if filteredAnnotations.length === 0}
			<div class="rounded-xl border border-dashed border-border px-6 py-16 text-center">
				<Bookmark class="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
				<h2 class="mt-3 font-semibold">No {filter === 'all' ? 'annotations' : `${filter}s`} yet</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					Save bookmarks or select text while reading to add highlights.
				</p>
			</div>
		{:else}
			<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each filteredAnnotations as annotation (annotation.id)}
					<li>
						<article
							class="flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow-sm"
						>
							<div class="flex items-start gap-3">
								<div class="rounded-lg bg-muted p-2">
									{#if annotation.kind === 'highlight'}
										<Highlighter class="h-5 w-5" aria-hidden="true" />
									{:else}
										<Bookmark class="h-5 w-5" aria-hidden="true" />
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<p
										class="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase"
									>
										{bookTitles.get(annotation.bookId) ?? 'Book unavailable'}
									</p>
									<h2 class="mt-1 line-clamp-4 text-sm leading-relaxed font-medium">
										{annotationLabel(annotation)}
									</h2>
								</div>
							</div>

							<div class="mt-auto flex items-center justify-between gap-2 pt-4">
								<Button
									variant="outline"
									size="sm"
									disabled={!bookTitles.has(annotation.bookId)}
									onclick={() => openAnnotation(annotation)}
								>
									Open in reader
								</Button>
								<Button
									variant="ghost"
									size="icon-sm"
									onclick={() => void removeAnnotation(annotation)}
									aria-label={`Remove ${annotation.kind}`}
									title={`Remove ${annotation.kind}`}
								>
									<Trash2 class="h-4 w-4" />
								</Button>
							</div>
						</article>
					</li>
				{/each}
			</ul>
		{/if}
	</main>

	<LibraryBottomBar
		active="annotations"
		annotationCount={annotations.length}
		onOpenLibrary={openLibrary}
		onOpenAnnotations={() => {}}
		onOpenSettings={openSettings}
	/>
</div>
