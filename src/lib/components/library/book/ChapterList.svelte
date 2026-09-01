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

<div class="flex-1 overflow-y-auto p-6 lg:h-full lg:min-h-0 lg:p-8">
	<h3 class="mb-4 text-lg font-semibold">Chapters</h3>
	<div class="space-y-2">
		{#each chapters.filter((c) => (!c.isFrontmatter || chapters.length === 1) && !c.title.includes('(cont.)')) as chapter, index (chapter.href)}
			{@const globalIndex = chapters.indexOf(chapter)}
			{@const isActive = globalIndex === currentChapterIndex}
			{@const isRead = currentChapterIndex !== null && globalIndex < currentChapterIndex}

			<button
				class={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-all ${
					isRead
						? 'bg-muted/30 opacity-50 grayscale'
						: isActive
							? 'border-[#0D5C63] bg-[#0D5C63]/5 ring-1 ring-[#0D5C63]/20'
							: 'hover:bg-accent'
				}`}
				onclick={() => startReading(globalIndex)}
				aria-current={isActive ? 'page' : undefined}
				aria-label={`${chapter.title}, ${isActive ? `currently at page ${(currentPageIndex ?? 0) + 1}` : isRead ? 'completed' : 'not started'}`}
			>
				<span
					class={`w-8 text-sm ${isActive ? 'font-bold text-[#0D5C63]' : 'text-muted-foreground'}`}
				>
					{index + 1}
				</span>
				<div class="min-w-0 flex-1">
					<p class={`truncate font-medium ${isActive ? 'text-[#0D5C63]' : ''}`}>
						{chapter.title}
					</p>
					{#if isActive && currentPageIndex !== null}
						<p class="mt-0.5 text-[10px] font-medium text-[#0D5C63]/70">
							Currently at Page {currentPageIndex + 1}
						</p>
					{:else}
						<p class="mt-0.5 text-[10px] text-muted-foreground">
							{isRead ? 'Completed' : 'Not started'}
						</p>
					{/if}
				</div>
				<Play class={`h-4 w-4 ${isActive ? 'text-[#0D5C63]' : 'text-muted-foreground'}`} />
			</button>
		{:else}
			<p class="py-8 text-center text-muted-foreground">No chapters found</p>
		{/each}
	</div>
</div>
