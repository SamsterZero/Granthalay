<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import type { EpubChapter } from '$lib/epub/engine';

	let {
		chapters,
		currentChapter,
		currentPage,
		totalPages,
		pagesRead,
		totalBookPages,
		showChapterNavigation,
		onPrevious,
		onNext,
		onChapterChange
	}: {
		chapters: EpubChapter[];
		currentChapter: number;
		currentPage: number;
		totalPages: number;
		pagesRead: number;
		totalBookPages: number;
		showChapterNavigation: boolean;
		onPrevious: () => void;
		onNext: () => void;
		onChapterChange: (index: number) => void;
	} = $props();
</script>

<footer
	class="border-t border-border bg-background px-4 py-3 text-center"
	aria-label="Reader navigation"
>
	<div class="flex items-center justify-center gap-3">
		<Button
			variant="outline"
			size="icon"
			onclick={onPrevious}
			disabled={currentChapter === 0 && currentPage === 0}
			aria-label="Previous page"
		>
			<ChevronLeft class="h-4 w-4" />
		</Button>
		{#if !showChapterNavigation}
			<p
				class="text-sm font-medium text-muted-foreground"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				Page {pagesRead} of {totalBookPages > 0 ? totalBookPages : '...'}
			</p>
			{#if totalBookPages > 0}
				<div class="hidden h-1.5 w-32 overflow-hidden rounded-full bg-muted sm:block">
					<div
						class="h-full bg-[#0D5C63] transition-all duration-300"
						style:width={`${(pagesRead / totalBookPages) * 100}%`}
						role="progressbar"
						aria-label="Book progress"
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={Math.round((pagesRead / totalBookPages) * 100)}
					></div>
				</div>
			{/if}
		{:else}
			<p
				class="text-sm font-medium text-muted-foreground"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				Page {currentPage + 1} / {totalPages}
			</p>
			<label class="sr-only" for="reader-chapter">Chapter</label>
			<select
				id="reader-chapter"
				class="max-w-40 rounded-md border border-border bg-background px-2 py-1 text-sm"
				value={currentChapter}
				onchange={(event) => onChapterChange(Number(event.currentTarget.value))}
			>
				{#each chapters as chapter, index (chapter.href)}
					<option value={index}>{chapter.title}</option>
				{/each}
			</select>
		{/if}
		<Button
			variant="outline"
			size="icon"
			onclick={onNext}
			disabled={currentChapter === chapters.length - 1 && currentPage >= totalPages - 1}
			aria-label="Next page"
		>
			<ChevronRight class="h-4 w-4" />
		</Button>
	</div>
</footer>
