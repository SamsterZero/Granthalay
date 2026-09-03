<script lang="ts">
	import { BookOpen, Bookmark, Highlighter, Library, Settings } from 'lucide-svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import type { BookMetadata } from '$lib/db';
	import type { BookAnnotation } from '$lib/reader/annotations';

	let {
		annotations,
		books,
		defaultBookTitle,
		onOpenAnnotation,
		onOpenSettings
	}: {
		annotations: BookAnnotation[];
		books: BookMetadata[];
		defaultBookTitle?: string;
		onOpenAnnotation: (annotation: BookAnnotation) => void;
		onOpenSettings: () => void;
	} = $props();

	let annotationsOpen = $state(false);
	let bookTitles = $derived(
		new Map([
			...(defaultBookTitle ? ([['default', defaultBookTitle]] as const) : []),
			...books.map((book) => [book.id, book.title] as const)
		])
	);

	function annotationLabel(annotation: BookAnnotation): string {
		return annotation.kind === 'highlight'
			? annotation.selector?.exact.trim() || 'Highlight'
			: `Bookmark at ${Math.round(annotation.location.progression * 100)}% of chapter`;
	}
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.08)] backdrop-blur"
	aria-label="Library navigation"
>
	<div class="mx-auto flex max-w-md items-stretch justify-around">
		<div
			class="flex min-w-24 flex-col items-center gap-1 px-4 py-2 text-xs font-medium text-primary"
		>
			<Library class="h-5 w-5" aria-hidden="true" />
			Library
		</div>

		<Sheet.Root bind:open={annotationsOpen}>
			<Sheet.Trigger
				class="flex min-w-24 flex-col items-center gap-1 rounded-md px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
			>
				<span class="relative">
					<Bookmark class="h-5 w-5" aria-hidden="true" />
					{#if annotations.length > 0}
						<span
							class="absolute -top-2 -right-3 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground"
							aria-hidden="true"
						>
							{annotations.length}
						</span>
					{/if}
				</span>
				Annotations
				<span class="sr-only">, {annotations.length} saved</span>
			</Sheet.Trigger>

			<Sheet.Content side="bottom" class="max-h-[75vh] rounded-t-2xl">
				<Sheet.Header>
					<Sheet.Title>Bookmarks and highlights</Sheet.Title>
					<Sheet.Description>Annotations stored locally across your library.</Sheet.Description>
				</Sheet.Header>

				{#if annotations.length === 0}
					<div class="flex flex-col items-center gap-2 px-6 pb-8 text-center text-muted-foreground">
						<BookOpen class="h-8 w-8" aria-hidden="true" />
						<p>No bookmarks or highlights yet.</p>
					</div>
				{:else}
					<ul class="overflow-y-auto px-4 pb-6">
						{#each annotations as annotation (annotation.id)}
							<li class="border-b border-border last:border-0">
								<button
									type="button"
									class="flex w-full items-start gap-3 rounded-md px-2 py-3 text-left hover:bg-muted focus-visible:outline-2"
									disabled={!bookTitles.has(annotation.bookId)}
									onclick={() => {
										annotationsOpen = false;
										onOpenAnnotation(annotation);
									}}
								>
									{#if annotation.kind === 'highlight'}
										<Highlighter class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
									{:else}
										<Bookmark class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
									{/if}
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm font-medium">
											{annotationLabel(annotation)}
										</span>
										<span class="block truncate text-xs text-muted-foreground">
											{bookTitles.get(annotation.bookId) ?? 'Book unavailable'}
										</span>
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</Sheet.Content>
		</Sheet.Root>

		<button
			type="button"
			class="flex min-w-24 flex-col items-center gap-1 rounded-md px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
			onclick={onOpenSettings}
		>
			<Settings class="h-5 w-5" aria-hidden="true" />
			Settings
		</button>
	</div>
</nav>
