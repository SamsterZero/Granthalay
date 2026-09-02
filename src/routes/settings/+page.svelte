<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ChevronLeft } from 'lucide-svelte';
	import ReaderAppearance from '$lib/components/reader/ReaderAppearance.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		DEFAULT_READER_PREFERENCES,
		loadGlobalReaderPreferences,
		READER_PREFERENCES_KEY,
		type ReaderPreferences
	} from '$lib/reader/preferences';

	let preferences = $state<ReaderPreferences>({ ...DEFAULT_READER_PREFERENCES });

	onMount(() => {
		preferences = loadGlobalReaderPreferences();
	});

	function updatePreferences(update: Partial<ReaderPreferences>) {
		preferences = { ...preferences, ...update };
		localStorage.setItem(READER_PREFERENCES_KEY, JSON.stringify(preferences));
	}

	function resetPreferences() {
		preferences = { ...DEFAULT_READER_PREFERENCES };
		localStorage.setItem(READER_PREFERENCES_KEY, JSON.stringify(preferences));
	}

	function goBack() {
		goto(resolve('/'));
	}
</script>

<svelte:head><title>Reading settings · Granthalay</title></svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<header class="flex h-14 items-center gap-3 border-b border-border px-4">
		<Button variant="ghost" size="icon" onclick={goBack} aria-label="Back to library">
			<ChevronLeft class="h-5 w-5" />
		</Button>
		<div>
			<h1 class="text-base font-semibold">Reading settings</h1>
			<p class="text-xs text-muted-foreground">Defaults for books without custom preferences</p>
		</div>
	</header>

	<main class="mx-auto max-w-4xl p-4 sm:p-6">
		<div class="overflow-hidden rounded-lg border border-border">
			<ReaderAppearance
				{preferences}
				onUpdate={updatePreferences}
				onReset={resetPreferences}
				heading="Global reading defaults"
				resetLabel="Reset defaults"
			/>
		</div>
		<p class="mt-4 text-sm text-muted-foreground">
			These defaults apply when a book has no custom reader preferences. Changes made inside a book
			are saved only for that book.
		</p>
	</main>
</div>
