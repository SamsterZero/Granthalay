<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { saveBook, getAllBooks, deleteBookById, type BookRecord } from '$lib/db';
	import { extractEpubMeta } from '$lib/epub-meta';
	import { Moon, Sun } from 'lucide-svelte';

	interface BeforeInstallPromptEvent extends Event {
		prompt: () => void;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let fileInput: HTMLInputElement;
	let books = $state<BookRecord[]>([]);
	let defaultBook = $state<{ title: string; cover: string | null } | null>(null);
	let loading = $state(true);
	let installPrompt: BeforeInstallPromptEvent | null = $state(null);
	let showInstall = $state(false);
	let darkMode = $state(false);

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
				const meta = await extractEpubMeta(buffer);
				defaultBook = meta;
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

		if (file && file.name.endsWith('.epub')) {
			const buffer = await file.arrayBuffer();
			const meta = await extractEpubMeta(buffer);
			await saveBook(buffer, file.name, meta.title, meta.cover);
			books = await getAllBooks();
			if (fileInput) fileInput.value = '';
		}
	}

	async function handleDeleteBook(id: string) {
		await deleteBookById(id);
		books = await getAllBooks();
	}

	function openBook(id: string) {
		goto(`${resolve('/reader')}?bookId=${id}`);
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

	function getInitials(title: string): string {
		return title.charAt(0).toUpperCase();
	}
</script>

<div class="page-wrapper">
	<header class="header">
		<h1>📚 My Library</h1>
		<div class="header-actions">
			<button class="theme-toggle" onclick={toggleDarkMode} title="Toggle theme">
				{#if darkMode}
					<Sun size={20} />
				{:else}
					<Moon size={20} />
				{/if}
			</button>
			{#if showInstall}
				<button class="install-button" onclick={handleInstall}>Install App</button>
			{/if}
			<input
				type="file"
				accept=".epub"
				class="hidden"
				style="display: none;"
				bind:this={fileInput}
				onchange={handleFileUpload}
			/>
			<button class="upload-fab" onclick={() => fileInput.click()} title="Upload EPUB">+</button>
		</div>
	</header>

	<main class="library-main">
		{#if loading}
			<div class="loading">
				<div class="spinner"></div>
				<p>Loading library...</p>
			</div>
		{:else}
			<div class="library-grid">
				<!-- Default Book -->
				{#if defaultBook}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="library-card" onclick={() => openBook('default')} role="button" tabindex="0">
						{#if defaultBook.cover}
							<div class="card-bg" style="background-image: url({defaultBook.cover})"></div>
						{:else}
							<div class="card-bg card-bg-placeholder">
								<span>{getInitials(defaultBook.title)}</span>
							</div>
						{/if}
						<div class="card-overlay">
							<h3 class="card-title">{defaultBook.title}</h3>
						</div>
					</div>
				{/if}

				<!-- Uploaded Books -->
				{#each books as book (book.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="library-card" onclick={() => openBook(book.id)} role="button" tabindex="0">
						{#if book.cover}
							<div class="card-bg" style="background-image: url({book.cover})"></div>
						{:else}
							<div class="card-bg card-bg-placeholder">
								<span>{getInitials(book.title)}</span>
							</div>
						{/if}
						<div class="card-overlay">
							<h3 class="card-title">{book.title}</h3>
						</div>
						<button
							class="delete-btn"
							onclick={(e) => { e.stopPropagation(); handleDeleteBook(book.id); }}
							title="Remove book"
						>
							×
						</button>
					</div>
				{/each}
			</div>

			{#if books.length === 0}
				<div class="empty-state">
					<p>Your library is empty. Upload an EPUB to get started!</p>
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	.page-wrapper {
		min-height: 100vh;
		background: var(--background);
		color: var(--foreground);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		padding: 2rem;
		transition: background 0.3s, color 0.3s;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 1200px;
		margin: 0 auto 2rem auto;
		color: var(--foreground);
	}

	.header h1 {
		font-size: 2.2rem;
		margin: 0;
		font-weight: 700;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.theme-toggle {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--secondary);
		color: var(--secondary-foreground);
		border: 1px solid var(--border);
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.theme-toggle:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.install-button {
		background: linear-gradient(135deg, #0D5C63, #094a50);
		color: white;
		border: none;
		padding: 0.6rem 1.2rem;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.install-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 5px 15px rgba(13, 92, 99, 0.4);
	}

	.upload-fab {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: linear-gradient(135deg, #007bff, #0056b3);
		color: white;
		border: none;
		font-size: 1.8rem;
		font-weight: 300;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		padding-bottom: 4px;
	}

	.upload-fab:hover {
		transform: translateY(-2px) scale(1.05);
		box-shadow: 0 5px 15px rgba(0, 123, 255, 0.4);
	}

	.library-main {
		max-width: 1200px;
		margin: 0 auto;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem;
		color: var(--foreground);
		gap: 1rem;
	}

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

	.library-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 1.5rem;
	}

	.library-card {
		aspect-ratio: 2 / 3;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		position: relative;
	}

	.library-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
	}

	.library-card:focus {
		outline: 2px solid #007bff;
		outline-offset: 2px;
	}

	.card-bg {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
	}

	.card-bg-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #0D5C63, #094a50);
		color: white;
		font-size: 3rem;
		font-weight: 700;
	}

	.card-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 2rem 0.75rem 0.75rem 0.75rem;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%);
	}

	.card-title {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: white;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
	}

	.delete-btn {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(220, 53, 69, 0.9);
		color: white;
		border: none;
		font-size: 1.2rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		padding-bottom: 2px;
		opacity: 0;
		transition: opacity 0.2s, transform 0.2s;
		z-index: 2;
	}

	.library-card:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		transform: scale(1.1);
		background: rgba(220, 53, 69, 1);
	}

	.empty-state {
		text-align: center;
		padding: 4rem;
		color: var(--foreground);
		font-size: 1.1rem;
		opacity: 0.9;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.page-wrapper {
			padding: 1rem;
		}

		.header h1 {
			font-size: 1.6rem;
		}

		.library-grid {
			grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
			gap: 1rem;
		}

		.delete-btn {
			opacity: 1;
		}
	}
</style>
