<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getBookById } from '$lib/db';
	import { extractEpubDetail } from '$lib/epub-meta';
	import { ArrowLeft, Play } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	const bookId = $derived(page.params.bookId ?? 'default');

	let loading = $state(true);
	let error = $state<string | null>(null);
	let title = $state('Unknown Book');
	let author = $state('');
	let description = $state('');
	let cover = $state<string | null>(null);
	let chapters = $state<Array<{ id: string; title: string; href: string }>>([]);

	onMount(async () => {
		try {
			let arrayBuffer: ArrayBuffer;
			let storedCover: string | null = null;
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
			}

			const detail = await extractEpubDetail(arrayBuffer);

			title = storedTitle || detail.title;
			author = detail.author;
			description = detail.description;
			cover = storedCover || detail.cover;
			chapters = detail.chapters;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load book';
		} finally {
			loading = false;
		}
	});

	function goBack() {
		goto(resolve('/'));
	}

	function startReading() {
		goto(`${resolve('/reader')}?bookId=${bookId}`);
	}

	function getInitials(name: string): string {
		return name.charAt(0).toUpperCase();
	}
</script>

<div class="min-h-screen lg:h-screen bg-background flex flex-col">
	<!-- Header -->
	<div class="border-b px-6 py-4 flex items-center gap-4 shrink-0">
		<Button variant="ghost" size="icon" onclick={goBack}>
			<ArrowLeft class="w-5 h-5" />
		</Button>
		<h1 class="font-semibold text-lg line-clamp-1">{title}</h1>
	</div>

	{#if loading}
		<div class="flex-1 flex items-center justify-center">
			<div class="w-10 h-10 border-2 border-border border-t-current text-foreground rounded-full animate-spin"></div>
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
				{#if cover}
					<!-- Blurred background -->
					<div class="absolute inset-0">
						<img src={cover} alt="" class="w-full h-full object-cover blur" />
						<div class="absolute inset-0 bg-linear-to-b from-transparent via-background/80 to-background"></div>
					</div>
				{:else}
					<div class="absolute inset-0 bg-linear-to-br from-[#0D5C63] to-[#094a50]"></div>
				{/if}
				<!-- Content -->
				<div class="relative z-10 p-6 lg:p-8 h-full overflow-y-auto">
					<div class="max-w-sm mx-auto lg:mx-0">
						<div class="aspect-2/3 max-w-[240px] mx-auto rounded-lg overflow-hidden shadow-lg mb-6">
							{#if cover}
								<img src={cover} alt={title} class="w-full h-full object-cover" />
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
					{#each chapters as chapter, index (chapter.id)}
						<button
							class="w-full flex items-center gap-4 p-4 rounded-lg border hover:bg-accent transition-colors text-left"
							onclick={startReading}
						>
							<span class="text-muted-foreground text-sm w-8">{index + 1}</span>
							<div class="flex-1 min-w-0">
								<p class="font-medium truncate">{chapter.title}</p>
							</div>
						</button>
					{:else}
						<p class="text-muted-foreground text-center py-8">No chapters found</p>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- FAB: Resume Button -->
	<Button
		class="fixed bottom-6 right-6 rounded-lg px-6 py-6 shadow-lg hover:shadow-xl transition-shadow"
		size="lg"
		onclick={startReading}
	>
		<Play class="w-5 h-5 mr-2" />
		Resume
	</Button>
</div>
