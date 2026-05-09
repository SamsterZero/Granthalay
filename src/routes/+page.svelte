<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { saveBook, getBook, deleteBook } from '$lib/db';

	let fileInput: HTMLInputElement;
	let currentBookName = $state('The Picture of Dorian Gray');
	let currentBookAuthor = $state('by Oscar Wilde');
	let hasCustomBook = $state(false);

	onMount(async () => {
		const book = await getBook();
		if (book) {
			currentBookName = book.name;
			currentBookAuthor = 'Uploaded Book';
			hasCustomBook = true;
		}
	});

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		
		if (file && file.name.endsWith('.epub')) {
			const buffer = await file.arrayBuffer();
			await saveBook(buffer, file.name);
			currentBookName = file.name;
			currentBookAuthor = 'Uploaded Book';
			hasCustomBook = true;
		}
	}

	async function handleRemoveBook() {
		await deleteBook();
		currentBookName = 'The Picture of Dorian Gray';
		currentBookAuthor = 'by Oscar Wilde';
		hasCustomBook = false;
		if (fileInput) {
			fileInput.value = '';
		}
	}
</script>

<div class="container">
	<header class="header">
		<h1>📚 EPUB Reader</h1>
		<p>Read your favorite books with Readium Web</p>
	</header>

	<main class="main">
		<div class="book-card">
			<div class="book-info">
				<h2>{hasCustomBook ? 'Your Library' : 'Available Book'}</h2>
				<p class="book-title">{currentBookName}</p>
				<p class="book-author">{currentBookAuthor}</p>
			</div>
			<div class="actions">
				<input 
					type="file" 
					accept=".epub" 
					class="hidden" 
					style="display: none;"
					bind:this={fileInput}
					onchange={handleFileUpload}
				/>
				{#if hasCustomBook}
					<button class="remove-button" onclick={handleRemoveBook}>
						Remove
					</button>
				{/if}
				<button class="upload-button" onclick={() => fileInput.click()}>
					Upload EPUB
				</button>
				<button class="read-button" onclick={() => goto(resolve('/reader')).then(() => {})}>
					Start Reading
				</button>
			</div>
		</div>

		<div class="features">
			<h3>Features</h3>
			<div class="feature-grid">
				<div class="feature">
					<h4>📖 Responsive Reading</h4>
					<p>Optimized for desktop and mobile devices</p>
				</div>
				<div class="feature">
					<h4>⌨️ Keyboard Navigation</h4>
					<p>Use arrow keys or space to navigate pages</p>
				</div>
				<div class="feature">
					<h4>🎨 Clean Interface</h4>
					<p>Minimal design focused on reading experience</p>
				</div>
				<div class="feature">
					<h4>📱 Touch Friendly</h4>
					<p>Works great on tablets and phones</p>
				</div>
			</div>
		</div>
	</main>
</div>

<style>
	.container {
		min-height: 100vh;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		padding: 2rem;
	}

	.header {
		text-align: center;
		color: white;
		margin-bottom: 3rem;
	}

	.header h1 {
		font-size: 3rem;
		margin: 0;
		font-weight: 700;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.header p {
		font-size: 1.2rem;
		margin: 0.5rem 0 0 0;
		opacity: 0.9;
	}

	.main {
		max-width: 800px;
		margin: 0 auto;
	}

	.book-card {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
		margin-bottom: 3rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
	}

	.book-info h2 {
		margin: 0 0 1rem 0;
		color: #333;
		font-size: 1.5rem;
	}

	.book-title {
		margin: 0 0 0.5rem 0;
		color: #007bff;
		font-size: 1.3rem;
		font-weight: 600;
	}

	.book-author {
		margin: 0;
		color: #666;
		font-style: italic;
	}

	.actions {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.upload-button, .remove-button {
		background: white;
		color: #007bff;
		border: 2px solid #007bff;
		padding: 1rem 1.5rem;
		border-radius: 8px;
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
		white-space: nowrap;
	}

	.remove-button {
		color: #dc3545;
		border-color: #dc3545;
	}

	.upload-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 5px 15px rgba(0, 123, 255, 0.2);
	}

	.remove-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 5px 15px rgba(220, 53, 69, 0.2);
	}

	.read-button {
		background: linear-gradient(135deg, #007bff, #0056b3);
		color: white;
		border: none;
		padding: 1rem 2rem;
		border-radius: 8px;
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
		white-space: nowrap;
	}

	.read-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 5px 15px rgba(0, 123, 255, 0.4);
	}

	.features {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	}

	.features h3 {
		margin: 0 0 1.5rem 0;
		color: #333;
		text-align: center;
		font-size: 1.5rem;
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.feature {
		text-align: center;
		padding: 1rem;
	}

	.feature h4 {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 1.1rem;
	}

	.feature p {
		margin: 0;
		color: #666;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		.header h1 {
			font-size: 2rem;
		}

		.header p {
			font-size: 1rem;
		}

		.book-card {
			flex-direction: column;
			text-align: center;
			gap: 1rem;
		}

		.read-button {
			width: 100%;
		}

		.feature-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
