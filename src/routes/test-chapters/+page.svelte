<script lang="ts">
	import { onMount } from 'svelte';
	import { extractEpubDetail } from '$lib/epub-meta';

	let result = $state('');
	let loading = $state(true);

	onMount(async () => {
		try {
			console.log('Testing chapter extraction with user-uploaded book...');
			
			// Read the user-uploaded book
			const response = await fetch('/books/pg5827-images-3.epub');
			if (!response.ok) throw new Error('Failed to load book');
			const arrayBuffer = await response.arrayBuffer();
			console.log('Book file size:', arrayBuffer.byteLength, 'bytes');
			
			// Extract chapters with debug logging
			const detail = await extractEpubDetail(arrayBuffer);
			
			let output = `=== EXTRACTION RESULTS ===\n`;
			output += `Title: ${detail.title}\n`;
			output += `Author: ${detail.author}\n`;
			output += `Total chapters found: ${detail.chapters.length}\n\n`;
			
			output += `=== CHAPTERS ===\n`;
			detail.chapters.forEach((chapter, index) => {
				output += `${index + 1}. "${chapter.title}" (${chapter.href})\n`;
			});
			
			result = output;
		} catch (error) {
			result = `Test failed: ${error.message}`;
		} finally {
			loading = false;
		}
	});
</script>

<div class="p-8">
	<h1 class="text-2xl font-bold mb-4">Chapter Extraction Test</h1>
	
	{#if loading}
		<div class="text-center py-8">
			<div class="w-10 h-10 border-2 border-border border-t-current text-foreground rounded-full animate-spin mx-auto"></div>
			<p class="mt-4">Testing chapter extraction...</p>
		</div>
	{:else}
		<pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">{result}</pre>
	{/if}
</div>
