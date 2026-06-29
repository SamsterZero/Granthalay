<!-- <script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Button from '$lib/components/ui/button/button.svelte';
	import Item from './ui/item/item.svelte';
	import { ItemTitle } from './ui/item';

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
		coverUrl = cover as string | null;
	});
</script>

<Item
	class="flex flex-nowrap items-center gap-3 p-2 cursor-pointer hover:bg-muted/50 transition"
	onclick={() => onOpen(id)}
>
	<!-- Cover 
	<div
		class="w-12 h-16 rounded overflow-hidden bg-muted flex items-center justify-center flex-shrink-0"
	>
		{#if coverUrl}
			<img src={coverUrl} alt={title} class="w-full h-full object-cover" />
		{:else}
			<ItemTitle class="text-xs font-semibold">
				{title.charAt(0).toUpperCase()}
			</ItemTitle>
		{/if}
	</div>

	<!-- Content 
	<div class="flex-1 min-w-0">
		<p class="text-sm font-medium truncate">{title}</p>

		{#if progress && progress > 0}
			<p class="text-xs text-muted-foreground">
				{Math.round(progress * 100)}% read
			</p>
		{/if}
	</div>

	<!-- Actions 
	{#if onDelete}
		<Button
			size="icon"
			variant="ghost"
			onclick={(e) => {
				e.stopPropagation();
				onDelete(id);
			}}
		>
			<Minus size={18} />
		</Button>
	{/if}
</Item> -->
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
	class="bg-accent"
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
				{Math.round(progress * 100)}% read
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
