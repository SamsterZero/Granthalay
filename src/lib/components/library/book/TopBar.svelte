<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { ChevronLeft } from 'lucide-svelte';

	interface Props {
		title: string;
		loading: boolean;
		goBack: () => void;
	}
	let { title, loading, goBack }: Props = $props();
</script>

<nav class="border-b px-6 py-4 flex items-center gap-4 shrink-0">
	<Button variant="ghost" size="icon" onclick={goBack}>
		<ChevronLeft class="h-4 w-4" />
	</Button>
	{#if loading && title === 'Unknown Book'}
		<Skeleton class="h-6 w-48" />
	{:else}
		<h1 class="font-semibold text-lg line-clamp-1">{title}</h1>
	{/if}
</nav>