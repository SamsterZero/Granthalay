<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Play } from 'lucide-svelte';

	interface Props {
		currentChapterIndex: number | null;
		startReading: () => void;
	}
	let { currentChapterIndex, startReading }: Props = $props();
</script>

<Button
	class="fixed right-6 bottom-6 rounded-lg bg-[#0D5C63] px-6 py-6 text-white shadow-lg transition-shadow hover:bg-[#0D5C63]/90 hover:shadow-xl"
	size="lg"
	onclick={() => startReading()}
>
	{#if currentChapterIndex === null}
		<Play class="mr-2 h-5 w-5" />
		Start Reading
	{:else}
		<Play class="mr-2 h-5 w-5" />
		Resume
	{/if}
</Button>
