<script lang="ts">
	import { AspectRatio } from '$lib/components/ui/aspect-ratio';
	import { getTitleDisplayPrice } from '$lib/api/catalog';
	import { resolve } from '$app/paths';

	interface Props {
		slug: string;
		title: string;
		author?: string;
		language?: string;
		cover?: string | Blob | null;
		price?: string;
	}

	let { slug, title, author, language, cover, price }: Props = $props();
	let coverUrl = $state<string | null>(null);

	const displayPrice = $derived(getTitleDisplayPrice({ slug, price }));

	$effect(() => {
		if (cover instanceof Blob) {
			const url = URL.createObjectURL(cover);
			coverUrl = url;
			return () => URL.revokeObjectURL(url);
		} else {
			coverUrl = (cover as string | null) || null;
			return () => {};
		}
	});

	function getInitials(text: string): string {
		return text.charAt(0).toUpperCase();
	}
</script>

<a
	href={resolve('/store/[slug]', { slug })}
	class="group block rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
	aria-label={`View ${title}${author ? ` by ${author}` : ''}`}
>
	<div class="group relative">
		<AspectRatio
			ratio={2 / 3}
			class="relative overflow-hidden rounded-xl shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl"
		>
			<!-- Language Badge -->
			{#if language}
				<div
					class="absolute top-2 left-2 z-20 rounded-full border border-white/20 bg-[#0D5C63] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md"
					aria-hidden="true"
				>
					{language.toUpperCase()}
				</div>
			{/if}

			<!-- Cover Image or Initials Fallback -->
			{#if coverUrl}
				<div
					class="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-300 group-hover:scale-105"
					style="background-image: url({coverUrl})"
				></div>
			{:else}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0D5C63] to-[#094a50] p-4 text-center text-white"
				>
					<span class="text-5xl font-bold">{getInitials(title)}</span>
				</div>
			{/if}

			<!-- Gradient Title & Author Overlay -->
			<div
				class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-10"
			>
				<h3
					class="m-0 line-clamp-2 text-sm leading-snug font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
				>
					{title}
				</h3>
				{#if author}
					<p
						class="mt-0.5 line-clamp-1 text-xs font-normal text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]"
					>
						{author}
					</p>
				{/if}
			</div>
		</AspectRatio>
	</div>

	<!-- Price & Action below card -->
	<div class="mt-2 flex items-center justify-between px-1 text-xs">
		<span class="font-semibold text-foreground">{displayPrice}</span>
		<span class="text-[11px] font-medium text-primary group-hover:underline">View details</span>
	</div>
</a>
