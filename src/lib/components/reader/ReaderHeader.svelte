<script lang="ts">
	import { ChevronLeft, Moon, SlidersHorizontal, Sun } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	let {
		loading,
		bookTitle,
		chapterTitle,
		darkMode,
		settingsOpen,
		onBack,
		onToggleTheme,
		onToggleSettings
	}: {
		loading: boolean;
		bookTitle: string;
		chapterTitle: string | null;
		darkMode: boolean;
		settingsOpen: boolean;
		onBack: () => void;
		onToggleTheme: () => void;
		onToggleSettings: () => void;
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
			{#if chapterTitle}
				<p
					class="mt-0.5 truncate text-[10px] font-medium tracking-widest text-muted-foreground uppercase"
				>
					{chapterTitle}
				</p>
			{/if}
		{/if}
	</div>

	<Button
		variant="ghost"
		size="icon"
		class="shrink-0 rounded-full"
		onclick={onToggleTheme}
		aria-label={darkMode ? 'Use light theme' : 'Use dark theme'}
	>
		{#if darkMode}<Sun class="h-5 w-5" />{:else}<Moon class="h-5 w-5" />{/if}
	</Button>
	<Button
		variant="ghost"
		size="icon"
		class="shrink-0 rounded-full"
		onclick={onToggleSettings}
		aria-label="Reader appearance"
		aria-expanded={settingsOpen}
		aria-controls="reader-appearance"
	>
		<SlidersHorizontal class="h-5 w-5" />
	</Button>
</header>
