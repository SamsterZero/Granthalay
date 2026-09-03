<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { BookOpen, Database, Menu, ShieldCheck } from 'lucide-svelte';
	import LibraryBottomBar from '$lib/components/library/LibraryBottomBar.svelte';
	import ReaderAppearance from '$lib/components/reader/ReaderAppearance.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import { getAllAnnotations } from '$lib/db';
	import {
		DEFAULT_READER_PREFERENCES,
		loadGlobalReaderPreferences,
		READER_PREFERENCES_KEY,
		type ReaderPreferences
	} from '$lib/reader/preferences';

	const settingsSections = [
		{ id: 'reading', label: 'Reading' },
		{ id: 'storage-privacy', label: 'Storage & privacy' }
	] as const;

	let preferences = $state<ReaderPreferences>({ ...DEFAULT_READER_PREFERENCES });
	let annotationCount = $state(0);
	let menuOpen = $state(false);

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

	function showSection(id: (typeof settingsSections)[number]['id']) {
		menuOpen = false;
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
		<div class="flex items-start gap-3">
			<Sheet.Root bind:open={menuOpen}>
				<Sheet.Trigger>
					{#snippet child({ props })}
						<Button
							variant="ghost"
							size="icon"
							class="mt-1 shrink-0 lg:hidden"
							aria-label="Open settings menu"
							{...props}
						>
							<Menu class="h-5 w-5" />
						</Button>
					{/snippet}
				</Sheet.Trigger>
				<Sheet.Content side="left" class="w-72">
					<Sheet.Header>
						<Sheet.Title>Settings</Sheet.Title>
						<Sheet.Description>Choose a section.</Sheet.Description>
					</Sheet.Header>
					<nav class="grid gap-1 px-3" aria-label="Settings sections">
						{#each settingsSections as section (section.id)}
							<button
								type="button"
								class="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted focus-visible:outline-2"
								onclick={() => showSection(section.id)}
							>
								{section.label}
							</button>
						{/each}
					</nav>
				</Sheet.Content>
			</Sheet.Root>

			<div>
				<p class="text-sm font-medium text-primary">Granthalay preferences</p>
				<h1 class="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
				<p class="mt-1 text-sm text-muted-foreground">Defaults and on-device preferences.</p>
			</div>
		</div>
	</header>

	<main class="mx-auto mt-6 grid max-w-7xl gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
		<aside class="sticky top-6 hidden lg:block">
			<nav class="grid gap-1" aria-label="Settings sections">
				{#each settingsSections as section (section.id)}
					<button
						type="button"
						class="rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2"
						onclick={() => showSection(section.id)}
					>
						{section.label}
					</button>
				{/each}
			</nav>
		</aside>

		<div class="min-w-0 space-y-10">
			<section id="reading" class="scroll-mt-6">
				<ReaderAppearance
					{preferences}
					onUpdate={updatePreferences}
					onReset={resetPreferences}
					heading="Reading defaults"
					resetLabel="Reset"
					embedded
				/>
				<p class="px-4 text-xs text-muted-foreground">Per-book settings override these defaults.</p>
			</section>

			<section id="storage-privacy" class="scroll-mt-6 px-4">
				<h2 class="text-base font-semibold">Storage & privacy</h2>
				<div class="mt-4 grid gap-5 sm:grid-cols-3">
					<div>
						<BookOpen class="h-5 w-5 text-primary" aria-hidden="true" />
						<h3 class="mt-2 text-sm font-semibold">Per-book</h3>
						<p class="mt-1 text-xs text-muted-foreground">Reader changes stay with that book.</p>
					</div>
					<div>
						<Database class="h-5 w-5 text-primary" aria-hidden="true" />
						<h3 class="mt-2 text-sm font-semibold">On device</h3>
						<p class="mt-1 text-xs text-muted-foreground">Preferences work offline here.</p>
					</div>
					<div>
						<ShieldCheck class="h-5 w-5 text-primary" aria-hidden="true" />
						<h3 class="mt-2 text-sm font-semibold">Private</h3>
						<p class="mt-1 text-xs text-muted-foreground">Nothing is sent to a backend.</p>
					</div>
				</div>
			</section>
		</div>
	</main>

	<LibraryBottomBar
		active="settings"
		{annotationCount}
		onOpenLibrary={openLibrary}
		onOpenAnnotations={openAnnotations}
		onOpenSettings={() => {}}
	/>
</div>
