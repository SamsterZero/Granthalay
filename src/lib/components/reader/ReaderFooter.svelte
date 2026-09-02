<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import type { EpubChapter } from '$lib/epub/engine';
	import type { ReaderNavigation } from '$lib/reader/preferences';

	let {
		chapters,
		currentChapter,
		currentPage,
		totalPages,
		pagesRead,
		totalBookPages,
		showChapterNavigation,
		navigation,
		onPrevious,
		onNext
	}: {
		chapters: EpubChapter[];
		currentChapter: number;
		currentPage: number;
		totalPages: number;
		pagesRead: number;
		totalBookPages: number;
		showChapterNavigation: boolean;
		navigation: ReaderNavigation;
		onPrevious: () => void;
		onNext: () => void;
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
		{:else if navigation === 'scroll'}
			<p
				class="text-sm font-medium text-muted-foreground"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				Chapter {currentChapter + 1} / {chapters.length}
			</p>
		{:else}
			<p
				class="text-sm font-medium text-muted-foreground"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				Page {currentPage + 1} / {totalPages}
			</p>
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
