<script lang="ts">
	import { onMount } from 'svelte';
	import { extractEpubDetail } from '$lib/epub-meta';

	let chapterCount = $state(0);
	let chapters = $state<Array<{title: string, href: string}>>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/books/pg5827-images-3.epub');
			if (!response.ok) throw new Error('Failed to load book');
			const arrayBuffer = await response.arrayBuffer();
			
			const detail = await extractEpubDetail(arrayBuffer);
			chapterCount = detail.chapters.length;
			chapters = detail.chapters;
		} catch (error) {
			console.error('Test failed:', error);
		} finally {
			loading = false;
		}
	});
</script>

<div class="p-8">
	<h1 class="text-2xl font-bold mb-4">Chapter Fix Test Result</h1>
	
	{#if loading}
		<div class="text-center py-8">
			<div class="w-10 h-10 border-2 border-border border-t-current text-foreground rounded-full animate-spin mx-auto"></div>
			<p class="mt-4">Testing...</p>
		</div>
	{:else}
		<div class="space-y-4">
			<div class="p-4 bg-muted rounded-lg">
				<h2 class="text-lg font-semibold mb-2">Chapter Count: {chapterCount}</h2>
				<p class="text-sm text-muted-foreground">
					{chapterCount === 20 ? '✅ SUCCESS: All 20 chapters found!' : '❌ ISSUE: Expected 20 chapters, found ' + chapterCount}
				</p>
			</div>
			
			{#if chapters.length > 0}
				<div class="p-4 bg-muted rounded-lg">
					<h3 class="text-lg font-semibold mb-2">First 5 Chapters:</h3>
					<ul class="space-y-1 text-sm">
						{#each chapters.slice(0, 5) as chapter}
							<li>• {chapter.title}</li>
						{/each}
						{#if chapters.length > 5}
							<li>... and {chapters.length - 5} more</li>
						{/if}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</div>
