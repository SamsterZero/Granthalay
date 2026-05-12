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
		ratio={2/3}
		class="relative rounded-xl overflow-hidden shadow-md cursor-pointer transition hover:-translate-y-1 hover:shadow-xl"
		onclick={() => onOpen(id)}
		role="button"
	>
		<!-- Progress Badge -->
		{#if progress && progress > 0}
			<div class="absolute top-2 left-2 z-20 bg-[#0D5C63] text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md border border-white/20">
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
			<div class="absolute inset-0 flex items-center justify-center bg-linear-to-br from-[#0D5C63] to-[#094a50] text-white text-5xl font-bold">
				<span>{getInitials(title)}</span>
			</div>
		{/if}

		<!-- Title Overlay -->
		<div class="absolute inset-x-0 bottom-0 p-3 pt-8 bg-linear-to-t from-black/90 via-black/40 to-transparent">
			<h3 class="m-0 text-sm font-semibold text-white leading-snug line-clamp-2 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
				{title}
			</h3>
		</div>

		<!-- Delete Button (only if onDelete is provided) -->
		{#if onDelete}
			<Button
				size="icon"
				class="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-600/90 text-white border-none cursor-pointer flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 z-10 hover:scale-110 hover:bg-red-600 shadow-md"
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
