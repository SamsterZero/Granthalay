<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { BookOpen, Database, RotateCcw, ShieldCheck } from 'lucide-svelte';
	import LibraryBottomBar from '$lib/components/library/LibraryBottomBar.svelte';
	import ReaderAppearance from '$lib/components/reader/ReaderAppearance.svelte';
	import { getAllAnnotations } from '$lib/db';
	import {
		DEFAULT_READER_PREFERENCES,
		loadGlobalReaderPreferences,
		READER_PREFERENCES_KEY,
		type ReaderPreferences
	} from '$lib/reader/preferences';

	let preferences = $state<ReaderPreferences>({ ...DEFAULT_READER_PREFERENCES });
	let annotationCount = $state(0);

	onMount(async () => {
		preferences = loadGlobalReaderPreferences();
		applyTheme(preferences.theme);
		try {
			annotationCount = (await getAllAnnotations()).length;
		} catch {
			annotationCount = 0;
		}
	});

	function updatePreferences(update: Partial<ReaderPreferences>) {
		preferences = { ...preferences, ...update };
		localStorage.setItem(READER_PREFERENCES_KEY, JSON.stringify(preferences));
		if (update.theme) applyTheme(preferences.theme);
	}

	function resetPreferences() {
		preferences = { ...DEFAULT_READER_PREFERENCES };
		localStorage.setItem(READER_PREFERENCES_KEY, JSON.stringify(preferences));
		applyTheme(preferences.theme);
	}

	function applyTheme(theme: ReaderPreferences['theme']) {
		const dark =
			theme === 'dark' ||
			(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.classList.toggle('dark', dark);
	}

	function openLibrary() {
		goto(resolve('/'));
	}

	function openAnnotations() {
		goto(resolve('/annotations'));
	}
</script>

<svelte:head><title>Settings · Granthalay</title></svelte:head>

<div class="min-h-screen bg-background px-4 pt-5 pb-24 font-sans text-foreground sm:px-6 lg:px-8">
	<header class="mx-auto max-w-7xl">
		<p class="text-sm font-medium text-primary">Granthalay preferences</p>
		<h1 class="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Reading settings</h1>
		<p class="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
			Choose defaults for books that do not have their own reader preferences.
		</p>
	</header>

	<main class="mx-auto mt-6 grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
		<section class="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
			<ReaderAppearance
				{preferences}
				onUpdate={updatePreferences}
				onReset={resetPreferences}
				heading="Global reading defaults"
				resetLabel="Reset defaults"
				embedded
			/>
		</section>

		<aside class="grid gap-3 sm:grid-cols-3 lg:grid-cols-1" aria-label="About these settings">
			<section class="rounded-xl border border-border bg-card p-4 shadow-sm">
				<BookOpen class="h-5 w-5 text-primary" aria-hidden="true" />
				<h2 class="mt-3 text-sm font-semibold">Per-book overrides</h2>
				<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
					Changes made inside a reader apply only to that book and take priority over these
					defaults.
				</p>
			</section>

			<section class="rounded-xl border border-border bg-card p-4 shadow-sm">
				<Database class="h-5 w-5 text-primary" aria-hidden="true" />
				<h2 class="mt-3 text-sm font-semibold">Stored on this device</h2>
				<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
					Preferences belong to this browser profile and remain available offline.
				</p>
			</section>

			<section class="rounded-xl border border-border bg-card p-4 shadow-sm">
				<ShieldCheck class="h-5 w-5 text-primary" aria-hidden="true" />
				<h2 class="mt-3 text-sm font-semibold">Private by default</h2>
				<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
					Reading preferences are not sent to an account, backend, or diagnostics service.
				</p>
			</section>

			<div
				class="flex items-center gap-2 px-1 text-xs text-muted-foreground sm:col-span-3 lg:col-span-1"
			>
				<RotateCcw class="h-4 w-4 shrink-0" aria-hidden="true" />
				Reset restores Granthalay’s original defaults.
			</div>
		</aside>
	</main>

	<LibraryBottomBar
		active="settings"
		{annotationCount}
		onOpenLibrary={openLibrary}
		onOpenAnnotations={openAnnotations}
		onOpenSettings={() => {}}
	/>
</div>
