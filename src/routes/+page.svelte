<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { saveBook, getAllBooks, deleteBookById, type BookRecord } from '$lib/db';
	import { EpubEngine } from '$lib/epub/engine';
	import { Moon, Sun, Grid2x2, Grid3x3, Download, Plus } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { ButtonGroup } from '$lib/components/ui/button-group';
	import BookCard from '$lib/components/BookCard.svelte';

	interface BeforeInstallPromptEvent extends Event {
		prompt: () => void;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	type GridMode = 'compact' | 'comfortable';

	let fileInput = $state<HTMLInputElement | undefined>();
	let books = $state<BookRecord[]>([]);
	let defaultBook = $state<{ title: string; cover: string | null; progress?: number; totalBookPages?: number } | null>(null);
	let loading = $state(true);
	let darkMode = $state(false);
	let installPrompt: BeforeInstallPromptEvent | null = $state(null);
	let showInstall = $state(false);

	function getInitialGridMode(): GridMode {
		if (!browser) return "compact";

		const saved = localStorage.getItem("library-grid-mode");

		return saved === "comfortable" ? "comfortable" : "compact";
	}
	let gridMode: GridMode = $state<GridMode>(getInitialGridMode());

	const gridClasses = $derived(
		gridMode === "compact" 
			? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7'
			: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
	);

	onMount(async () => {
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
			darkMode = true;
			document.documentElement.classList.add('dark');
		}

		books = await getAllBooks();

		try {
			const response = await fetch(`/books/pg78627-images-3.epub`);
			if (response.ok) {
				const buffer = await response.arrayBuffer();
				const engine = new EpubEngine(buffer);
				await engine.init();
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
		await engine.init();
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

	function setGridMode(mode: GridMode) {
		if (gridMode === mode) return; // prevents repeated shrinking/growing
		gridMode = mode;
		if (browser) {
			localStorage.setItem("library-grid-mode", mode);
		}
	}

</script>

<div class="h-screen bg-background text-foreground font-sans transition-colors duration-300 p-4 md:p-7">
	<header class="flex items-center justify-between mb-8 text-foreground">
		<div class="w-10 h-10 rounded bg-[#0D5C63] flex items-center justify-center">
			<span class="text-white font-semibold">ग्रं</span>
		</div>
		<div class="flex items-center gap-3">
			{#if showInstall}
				<Button
					class="bg-[#0D5C63] text-white rounded-full hover:bg-[#094A50] cursor-pointer"
					onclick={handleInstall}
				>
					<Download size={20} />
				</Button>
			{/if}
			<Button 
				variant="outline"
				size="icon"
				class="rounded-full cursor-pointer"
				onclick={toggleDarkMode}
				title="Toggle theme"
			>
				{#if darkMode}
					<Sun size={20} />
				{:else}
					<Moon size={20} />
				{/if}
			</Button>
			<input
				type="file"
				accept=".epub"
				class="hidden"
				style="display: none;"
				bind:this={fileInput}
				onchange={handleFileUpload}
			/>
			<Button
				variant="outline"
				size="icon"
				class="rounded-full cursor-pointer" 
				onclick={() => fileInput?.click()} 
				title="Upload EPUB"
			>
				<Plus size={20} />
			</Button>
		</div>
	</header>
	<div class="pb-4 flex justify-end">
		<ButtonGroup aria-label="Button group">
			<Button
				variant={gridMode === 'comfortable' ? 'default' : 'outline'}
				disabled={gridMode === 'comfortable'}
				onclick={() => setGridMode('comfortable')}
			>
				<Grid2x2 size={20}/>
			</Button>
			<Button
				variant={gridMode === 'compact' ? 'default' : 'outline'}
				disabled={gridMode === 'compact'}
				onclick={() => setGridMode('compact')}
			>
				<Grid3x3 size={20}/>
			</Button>
		</ButtonGroup>
	</div>
	<main class="mx-auto">
		{#if loading}
			<div class="flex flex-col items-center justify-center gap-4 text-foreground">
				<div class="spinner"></div>
				<p>Loading library...</p>
			</div>
		{:else}
			<div class={`grid ${gridClasses} gap-4`}>
				<!-- Default Book -->
				{#if defaultBook}
					<BookCard
						id="default"
						title={defaultBook.title}
						cover={defaultBook.cover}
						progress={defaultBook.progress}
						onOpen={openBook}
					/>
				{/if}

				<!-- Uploaded Books -->
				{#each books as book (book.id)}
					<BookCard
						id={book.id}
						title={book.title}
						cover={book.cover}
						progress={book.progress}
						onOpen={openBook}
						onDelete={handleDeleteBook}
					/>
				{/each}
			</div>

			{#if books.length === 0}
				<div class="text-center p-16 text-foreground text-lg opacity-90">
					<p>Your library is empty. Upload an EPUB to get started!</p>
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
