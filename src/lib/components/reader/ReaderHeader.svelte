<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Bookmark, ChevronLeft, Moon, SlidersHorizontal, Sun } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import type { EpubChapter } from '$lib/epub/engine';

	let {
		loading,
		bookTitle,
		chapters,
		currentChapter,
		showChapterSelector,
		darkMode,
		bookmarked,
		settingsOpen = $bindable(false),
		settings,
		onBack,
		onToggleTheme,
		onToggleBookmark,
		onChapterChange
	}: {
		loading: boolean;
		bookTitle: string;
		chapters: EpubChapter[];
		currentChapter: number;
		showChapterSelector: boolean;
		darkMode: boolean;
		bookmarked: boolean;
		settingsOpen?: boolean;
		settings: Snippet;
		onBack: () => void;
		onToggleTheme: () => void;
		onToggleBookmark: () => void;
		onChapterChange: (index: number) => void;
	} = $props();
</script>

<header
	class="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4 py-2 shadow-sm"
>
	<Button
		variant="ghost"
		size="icon"
		onclick={onBack}
		class="shrink-0"
		aria-label="Back to library"
		title="Back to library"
	>
		<ChevronLeft class="h-5 w-5" />
	</Button>

	<div class="min-w-0 flex-1 px-2 text-left">
		{#if loading}
			<div class="space-y-1.5">
				<div class="h-3 w-32 animate-pulse rounded bg-muted"></div>
				<div class="h-2 w-20 animate-pulse rounded bg-muted/60"></div>
			</div>
		{:else}
			<h1 class="truncate text-sm leading-tight font-bold text-foreground">{bookTitle}</h1>
			{#if showChapterSelector}
				<label class="mt-0.5 block" aria-label="Chapter">
					<select
						class="block max-w-full truncate border-0 bg-transparent p-0 text-[10px] font-medium tracking-widest text-muted-foreground uppercase focus-visible:outline-2 focus-visible:outline-offset-2"
						value={currentChapter}
						onchange={(event) => onChapterChange(Number(event.currentTarget.value))}
					>
						{#each chapters as chapter, index (chapter.href)}
							<option value={index}>{chapter.title}</option>
						{/each}
					</select>
				</label>
			{/if}
		{/if}
	</div>

	<Button
		variant="ghost"
		size="icon"
		class="shrink-0 rounded-full"
		onclick={onToggleBookmark}
		aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this location'}
		title={bookmarked ? 'Remove bookmark' : 'Bookmark this location'}
		aria-pressed={bookmarked}
	>
		<Bookmark class="h-5 w-5" fill={bookmarked ? 'currentColor' : 'none'} />
	</Button>

	<Button
		variant="ghost"
		size="icon"
		class="shrink-0 rounded-full"
		onclick={onToggleTheme}
		aria-label={darkMode ? 'Use light theme' : 'Use dark theme'}
		title={darkMode ? 'Use light theme' : 'Use dark theme'}
	>
		{#if darkMode}<Sun class="h-5 w-5" />{:else}<Moon class="h-5 w-5" />{/if}
	</Button>
	<Popover.Root bind:open={settingsOpen}>
		<Popover.Trigger
			class="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
			aria-label="Reader settings"
			title="Reader settings"
		>
			<SlidersHorizontal class="h-5 w-5" />
		</Popover.Trigger>
		<Popover.Content
			align="end"
			sideOffset={8}
			class="max-h-[calc(100vh-5rem)] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto p-0"
		>
			{@render settings()}
		</Popover.Content>
	</Popover.Root>
</header>
