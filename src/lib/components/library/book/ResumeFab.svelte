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
	class="fixed bottom-6 right-6 rounded-lg px-6 py-6 shadow-lg hover:shadow-xl transition-shadow bg-[#0D5C63] hover:bg-[#0D5C63]/90 text-white"
	size="lg"
	onclick={() => startReading()}
>
	{#if currentChapterIndex === null}
		<Play class="w-5 h-5 mr-2" />
		Start Reading
	{:else}
		<Play class="w-5 h-5 mr-2" />
		Resume
	{/if}
</Button>
