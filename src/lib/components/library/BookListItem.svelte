<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import {
		Item,
		ItemContent,
		ItemTitle,
		ItemDescription,
		ItemActions
	} from '$lib/components/ui/item';
	import { Trash2 } from 'lucide-svelte';

	interface Props {
		id: string;
		title: string;
		cover: string | Blob | null;
		progress?: number;
		onOpen: (id: string) => void;
		onDelete?: (id: string) => void;
	}

	let { id, title, cover, progress, onOpen, onDelete }: Props = $props();

	let coverUrl = $state<string | null>(null);

	$effect(() => {
		if (cover instanceof Blob) {
			const url = URL.createObjectURL(cover);
			coverUrl = url;
			return () => URL.revokeObjectURL(url);
		}

		coverUrl = cover;
	});
</script>

<Item
	class="bg-accent p-2"
	onclick={() => onOpen(id)}
>
	<!-- Cover -->
	<div class="h-16 w-12 shrink-0 overflow-hidden rounded bg-muted flex items-center justify-center">
		{#if coverUrl}
			<img src={coverUrl} alt={title} class="h-full w-full object-cover" />
		{:else}
			<span class="text-xs font-semibold">
				{title.charAt(0).toUpperCase()}
			</span>
		{/if}
	</div>

	<!-- Content -->
	<ItemContent>
		<ItemTitle>{title}</ItemTitle>

		{#if progress && progress > 0}
			<ItemDescription>
				{Math.round(progress * 100)}% complete
			</ItemDescription>
		{/if}
	</ItemContent>

	<!-- Actions -->
	{#if onDelete}
		<ItemActions>
			<Button
				size="icon"
				variant="ghost"
				class="text-destructive hover:text-destructive"
				aria-label="Delete book"
				onclick={(e) => {
					e.stopPropagation();
					onDelete(id);
				}}
			>
				<Trash2 size={18} />
			</Button>
		</ItemActions>
	{/if}
</Item>
