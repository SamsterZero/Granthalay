<script lang="ts">
	import { Bookmark, Highlighter, Trash2, X } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import type { BookAnnotation } from '$lib/reader/annotations';

	let {
		annotations,
		onNavigate,
		onRemove,
		onClose
	}: {
		annotations: BookAnnotation[];
		onNavigate: (annotation: BookAnnotation) => void;
		onRemove: (annotation: BookAnnotation) => void;
		onClose: () => void;
	} = $props();

	function label(annotation: BookAnnotation): string {
		if (annotation.kind === 'highlight') return annotation.selector?.exact.trim() || 'Highlight';
		return `Bookmark at ${Math.round(annotation.location.progression * 100)}% of chapter`;
	}
</script>

<aside
	id="reader-annotations"
	class="border-b border-border bg-background px-4 py-3 shadow-sm"
	aria-labelledby="reader-annotations-title"
>
	<div class="mx-auto flex max-w-3xl items-center justify-between gap-4">
		<div>
			<h2 id="reader-annotations-title" class="text-sm font-semibold">Bookmarks and highlights</h2>
			<p class="text-xs text-muted-foreground">Stored only in this browser.</p>
		</div>
		<Button variant="ghost" size="icon-sm" onclick={onClose} aria-label="Close annotations">
			<X class="h-4 w-4" />
		</Button>
	</div>

	{#if annotations.length === 0}
		<p class="mx-auto mt-3 max-w-3xl text-sm text-muted-foreground" role="status">
			No bookmarks or highlights yet.
		</p>
	{:else}
		<ul class="mx-auto mt-3 max-h-48 max-w-3xl space-y-2 overflow-y-auto">
			{#each annotations as annotation (annotation.id)}
				<li class="flex items-center gap-2 rounded-md border border-border p-2">
					{#if annotation.kind === 'highlight'}
						<Highlighter class="h-4 w-4 shrink-0" aria-hidden="true" />
					{:else}
						<Bookmark class="h-4 w-4 shrink-0" aria-hidden="true" />
					{/if}
					<button
						type="button"
						class="min-w-0 flex-1 truncate text-left text-sm hover:underline focus-visible:outline-2"
						onclick={() => onNavigate(annotation)}
						title={label(annotation)}
					>
						{label(annotation)}
					</button>
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={() => onRemove(annotation)}
						aria-label={`Remove ${annotation.kind}`}
					>
						<Trash2 class="h-4 w-4" />
					</Button>
				</li>
			{/each}
		</ul>
	{/if}
</aside>
