<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { saveBook, getAllBooks, deleteBookById, type BookMetadata } from '$lib/db';
	import { EpubEngine } from '$lib/epub/engine';
	import BookCard from '$lib/components/library/BookCard.svelte';
	import BookListItem from '$lib/components/library/BookListItem.svelte';
	import TopBar from '$lib/components/library/TopBar.svelte';
	import LibraryToolbar from '$lib/components/library/LibraryToolbar.svelte';

	interface BeforeInstallPromptEvent extends Event {
		prompt: () => void;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	type ViewMode = 'list' | 'compact' | 'comfortable';

	let fileInput = $state<HTMLInputElement | undefined>();
	let books = $state<BookMetadata[]>([]);
	let defaultBook = $state<{
		title: string;
		cover: string | Blob | null;
		progress?: number;
		totalBookPages?: number;
	} | null>(null);
	let loading = $state(true);
	let darkMode = $state(false);
	let installPrompt: BeforeInstallPromptEvent | null = $state(null);
	let showInstall = $state(false);

	function getInitialViewMode(): ViewMode {
		if (!browser) return 'list';
		const saved = localStorage.getItem('library-grid-mode');
		if (saved === 'compact' || saved === 'comfortable' || saved === 'list') {
			return saved;
		}
		return 'list';
	}
	let viewMode: ViewMode = $state<ViewMode>(getInitialViewMode());

	onMount(async () => {
		const savedTheme = localStorage.getItem('theme');
		if (
			savedTheme === 'dark' ||
			(!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
		) {
			darkMode = true;
			document.documentElement.classList.add('dark');
		}

		books = await getAllBooks();

		try {
			const response = await fetch(`/books/pg78627-images-3.epub`);
			if (response.ok) {
				const buffer = await response.arrayBuffer();
				const engine = new EpubEngine(buffer);
				await engine.init(true); // metadataOnly mode
				const meta = engine.metadata;
				const stored = localStorage.getItem('book-progress-default');
				let progress = 0;
				let totalBookPages = 0;
				if (stored) {
					try {
						const parsed = JSON.parse(stored);
						if (typeof parsed === 'object') {
							progress = parsed.progress || 0;
							totalBookPages = parsed.totalBookPages || 0;
						} else {
							progress = Number(stored);
						}
					} catch {
						progress = Number(stored);
					}
				}
				defaultBook = { ...meta, progress, totalBookPages };
			}
		} catch (e) {
			console.error('Failed to load default book metadata:', e);
			defaultBook = { title: 'Fifty-fifty with Bonnie', cover: null };
		}

		loading = false;

		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			installPrompt = e as BeforeInstallPromptEvent;
			showInstall = true;
		});
	});

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file || !file.name.endsWith('.epub')) return;
		const buffer = await file.arrayBuffer();
		const engine = new EpubEngine(buffer);
		await engine.init(true); // metadataOnly mode
		const meta = engine.metadata;
		await saveBook(buffer, file.name, meta.title, meta.cover);
		books = await getAllBooks();
		if (fileInput) fileInput.value = '';
	}

	async function handleDeleteBook(id: string) {
		await deleteBookById(id);
		books = await getAllBooks();
	}

	function openBook(id: string) {
		goto(`${resolve('/book')}/${id}`);
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

	function setViewMode(mode: ViewMode) {
		if (viewMode === mode) return; // prevents repeated shrinking/growing
		viewMode = mode;
		if (browser) {
			localStorage.setItem('library-grid-mode', mode);
		}
	}
</script>

<div
	class="h-screen bg-background text-foreground font-sans transition-colors duration-300 p-4"
>
	<TopBar {darkMode} {showInstall} onTheme={toggleDarkMode} onInstall={handleInstall} />

	<LibraryToolbar
		viewMode={viewMode}
		fileInput={fileInput}
		setViewMode={setViewMode}
		handleFileUpload={handleFileUpload}
	/>
	<main class="mx-auto">
		{#if loading}
			<div class="flex flex-col items-center justify-center gap-4 text-foreground">
				<div class="spinner"></div>
				<p>Loading library...</p>
			</div>
		{:else}
			{#if viewMode === 'list'}
				<div class="flex flex-col gap-2">
					{#if defaultBook}
						<BookListItem
							id="default"
							title={defaultBook.title}
							cover={defaultBook.cover}
							progress={defaultBook.progress}
							onOpen={openBook}
						></BookListItem>
					{/if}
					{#each books as book (book.id)}
						<BookListItem
							id={book.id}
							title={book.title}
							cover={book.cover}
							progress={book.progress}
							onOpen={openBook}
							onDelete={handleDeleteBook}
						></BookListItem>
					{/each}
				</div>
			{/if}
			{#if viewMode === 'compact'}
				<div
					class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4"
				>
					{#if defaultBook}
						<BookCard
							id="default"
							title={defaultBook.title}
							cover={defaultBook.cover}
							progress={defaultBook.progress}
							onOpen={openBook}
						/>
					{/if}
					{#each books as book (book.id)}
						<BookCard
							id={book.id}
							title={book.title}
							cover={book.cover}
							progress={book.progress}
							onOpen={openBook}
							onDelete={handleDeleteBook}
						></BookCard>
					{/each}
				</div>
			{/if}
			{#if viewMode === 'comfortable'}
				<div
					class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
				>
					{#if defaultBook}
						<BookCard
							id="default"
							title={defaultBook.title}
							cover={defaultBook.cover}
							progress={defaultBook.progress}
							onOpen={openBook}
						/>
					{/if}
					{#each books as book (book.id)}
						<BookCard
							id={book.id}
							title={book.title}
							cover={book.cover}
							progress={book.progress}
							onOpen={openBook}
							onDelete={handleDeleteBook}
						></BookCard>
					{/each}
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--border);
		border-top-color: var(--foreground);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>