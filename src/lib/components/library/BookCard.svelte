<script lang="ts">
	import { AspectRatio } from '$lib/components/ui/aspect-ratio';
	import { Button } from '$lib/components/ui/button';
	import { Minus } from 'lucide-svelte';

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
		} else {
			coverUrl = cover as string | null;
			return () => {};
		}
	});

	function getInitials(text: string): string {
		return text.charAt(0).toUpperCase();
	}
</script>

<div class="group">
	<AspectRatio
		ratio={2 / 3}
		class="relative cursor-pointer overflow-hidden rounded-xl shadow-md transition hover:-translate-y-1 hover:shadow-xl"
		onclick={() => onOpen(id)}
		role="button"
	>
		<!-- Progress Badge -->
		{#if progress && progress > 0}
			<div
				class="absolute top-2 left-2 z-20 rounded-full border border-white/20 bg-[#0D5C63] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md"
			>
				{Math.round(progress * 100)}%
			</div>
		{/if}

		<!-- Cover Image -->
		{#if coverUrl}
			<div
				class="absolute inset-0 bg-cover bg-center bg-no-repeat"
				style="background-image: url({coverUrl})"
			></div>
		{:else}
			<div
				class="absolute inset-0 flex items-center justify-center bg-linear-to-br from-[#0D5C63] to-[#094a50] text-5xl font-bold text-white"
			>
				<span>{getInitials(title)}</span>
			</div>
		{/if}

		<!-- Title Overlay -->
		<div
			class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/40 to-transparent p-3 pt-8"
		>
			<h3
				class="m-0 line-clamp-2 text-sm leading-snug font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]"
			>
				{title}
			</h3>
		</div>

		<!-- Delete Button (only if onDelete is provided) -->
		{#if onDelete}
			<Button
				size="icon"
				class="absolute top-1.5 right-1.5 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none bg-red-600/90 text-white opacity-100 shadow-md transition-all duration-200 hover:scale-110 hover:bg-red-600 md:opacity-0 md:group-hover:opacity-100"
				onclick={(e) => {
					e.stopPropagation();
					onDelete(id);
				}}
				title="Remove book"
			>
				<Minus size={14} />
			</Button>
		{/if}
	</AspectRatio>
</div>
