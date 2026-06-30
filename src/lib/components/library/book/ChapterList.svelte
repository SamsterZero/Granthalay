<script lang="ts">
	import type { EpubChapter } from '$lib/epub/engine';
	import { Play } from 'lucide-svelte';

	interface Props {
		chapters: EpubChapter[];
		currentChapterIndex: number | null;
		currentPageIndex: number | null;
		startReading: (chapterIndex: number) => void;
	}
	let { chapters, currentChapterIndex, currentPageIndex, startReading }: Props = $props();
</script>

<div class="flex-1 lg:h-full lg:min-h-0 p-6 lg:p-8 overflow-y-auto">
	<h3 class="text-lg font-semibold mb-4">Chapters</h3>
	<div class="space-y-2">
		{#each chapters.filter((c) => (!c.isFrontmatter || chapters.length === 1) && !c.title.includes('(cont.)')) as chapter, index (chapter.href)}
			{@const globalIndex = chapters.indexOf(chapter)}
			{@const isActive = globalIndex === currentChapterIndex}
			{@const isRead = currentChapterIndex !== null && globalIndex < currentChapterIndex}

			<button
				class={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
					isRead
						? 'opacity-50 grayscale bg-muted/30'
						: isActive
							? 'border-[#0D5C63] bg-[#0D5C63]/5 ring-1 ring-[#0D5C63]/20'
							: 'hover:bg-accent'
				}`}
				onclick={() => startReading(globalIndex)}
			>
				<span
					class={`text-sm w-8 ${isActive ? 'text-[#0D5C63] font-bold' : 'text-muted-foreground'}`}
				>
					{index + 1}
				</span>
				<div class="flex-1 min-w-0">
					<p class={`font-medium truncate ${isActive ? 'text-[#0D5C63]' : ''}`}>
						{chapter.title}
					</p>
					{#if isActive && currentPageIndex !== null}
						<p class="text-[10px] text-[#0D5C63]/70 font-medium mt-0.5">
							Currently at Page {currentPageIndex + 1}
						</p>
					{:else}
						<p class="text-[10px] text-muted-foreground mt-0.5">
							{isRead ? 'Completed' : 'Not started'}
						</p>
					{/if}
				</div>
				<Play class={`w-4 h-4 ${isActive ? 'text-[#0D5C63]' : 'text-muted-foreground'}`} />
			</button>
		{:else}
			<p class="text-muted-foreground text-center py-8">No chapters found</p>
		{/each}
	</div>
</div>
