<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { BookOpen, Database, Download, ExternalLink, Menu, ShieldCheck } from 'lucide-svelte';
	import {
		backupErrorMessage,
		backupFilename,
		collectLocalBackupSource,
		createLibraryBackup,
		formatBytes
	} from '$lib/backup';
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
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'behavior', label: 'Reading behavior' },
		{ id: 'backup-restore', label: 'Backup & restore' },
		{ id: 'storage-privacy', label: 'Storage & privacy' }
	] as const;
	const policyLinks = [
		{
			label: 'Privacy policy',
			href: 'https://github.com/SamsterZero/Granthalay/wiki/Data-and-Privacy'
		},
		{
			label: 'Terms of usage',
			href: 'https://github.com/SamsterZero/Granthalay/wiki/Terms-of-Use'
		}
	] as const;

	let preferences = $state<ReaderPreferences>({ ...DEFAULT_READER_PREFERENCES });
	let activeSection = $state<(typeof settingsSections)[number]['id']>('appearance');
	let annotationCount = $state(0);
	let menuOpen = $state(false);
	let exporting = $state(false);
	let exportStatus = $state('');

	onMount(async () => {
		const requestedSection = window.location.hash.slice(1);
		if (settingsSections.some((section) => section.id === requestedSection)) {
			activeSection = requestedSection as (typeof settingsSections)[number]['id'];
		}
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

	function resetAppearance() {
		updatePreferences({
			fontScale: DEFAULT_READER_PREFERENCES.fontScale,
			lineHeight: DEFAULT_READER_PREFERENCES.lineHeight,
			margins: DEFAULT_READER_PREFERENCES.margins,
			alignment: DEFAULT_READER_PREFERENCES.alignment,
			theme: DEFAULT_READER_PREFERENCES.theme
		});
	}

	function resetBehavior() {
		updatePreferences({ navigation: DEFAULT_READER_PREFERENCES.navigation });
	}

	function applyTheme(theme: ReaderPreferences['theme']) {
		const dark =
			theme === 'dark' ||
			(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.classList.toggle('dark', dark);
	}

	function showSection(id: (typeof settingsSections)[number]['id']) {
		menuOpen = false;
		activeSection = id;
		history.replaceState(null, '', `#${id}`);
	}

	function openLibrary() {
		goto(resolve('/'));
	}

	function openAnnotations() {
		goto(resolve('/annotations'));
	}

	async function exportLibrary() {
		exporting = true;
		exportStatus = 'Preparing your library backup…';
		try {
			const source = await collectLocalBackupSource();
			const bytes = await createLibraryBackup(source);
			const archive = new ArrayBuffer(bytes.byteLength);
			new Uint8Array(archive).set(bytes);
			const blob = new Blob([archive], { type: 'application/zip' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = backupFilename();
			anchor.click();
			setTimeout(() => URL.revokeObjectURL(url), 0);
			exportStatus = `Backup ready: ${formatBytes(bytes.byteLength)} for ${source.books.length} ${source.books.length === 1 ? 'book' : 'books'}.`;
		} catch (error) {
			exportStatus = backupErrorMessage(error);
		} finally {
			exporting = false;
		}
	}
</script>

<svelte:head><title>Settings · Granthalay</title></svelte:head>

<div class="min-h-screen bg-background pb-24 font-sans text-foreground">
	<header class="sticky top-0 z-30 h-14 bg-background/95 shadow-sm backdrop-blur">
		<div class="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
			<Sheet.Root bind:open={menuOpen}>
				<Sheet.Trigger>
					{#snippet child({ props })}
						<Button
							variant="ghost"
							size="icon"
							class="shrink-0 lg:hidden"
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
								aria-current={activeSection === section.id ? 'page' : undefined}
							>
								{section.label}
							</button>
						{/each}
						{#each policyLinks as link (link.href)}
							<a
								href={link.href}
								target="_blank"
								rel="noreferrer"
								class="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2"
							>
								{link.label}
								<ExternalLink class="h-4 w-4" aria-hidden="true" />
							</a>
						{/each}
					</nav>
				</Sheet.Content>
			</Sheet.Root>

			<h1 class="text-lg font-semibold tracking-tight">Settings</h1>
		</div>
	</header>

	<main
		class="mx-auto grid max-w-7xl gap-8 px-4 pt-6 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:px-8"
	>
		<aside class="sticky top-6 hidden lg:block">
			<nav class="grid gap-1" aria-label="Settings sections">
				{#each settingsSections as section (section.id)}
					<button
						type="button"
						class="rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2"
						class:bg-muted={activeSection === section.id}
						class:text-foreground={activeSection === section.id}
						onclick={() => showSection(section.id)}
						aria-current={activeSection === section.id ? 'page' : undefined}
					>
						{section.label}
					</button>
				{/each}
				{#each policyLinks as link (link.href)}
					<a
						href={link.href}
						target="_blank"
						rel="noreferrer"
						class="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2"
					>
						{link.label}
						<ExternalLink class="h-4 w-4" aria-hidden="true" />
					</a>
				{/each}
			</nav>
		</aside>

		<div class="min-w-0">
			{#if activeSection === 'appearance'}
				<section id="appearance" class="scroll-mt-20">
					<ReaderAppearance
						{preferences}
						onUpdate={updatePreferences}
						onReset={resetAppearance}
						heading="Appearance"
						resetLabel="Reset"
						embedded
						mode="appearance"
					/>
					<p class="px-4 text-xs text-muted-foreground">
						Per-book settings override these defaults.
					</p>
				</section>
			{:else if activeSection === 'behavior'}
				<section id="behavior" class="scroll-mt-20">
					<ReaderAppearance
						{preferences}
						onUpdate={updatePreferences}
						onReset={resetBehavior}
						heading="Reading behavior"
						resetLabel="Reset"
						embedded
						mode="behavior"
					/>
					<p class="px-4 text-xs text-muted-foreground">
						Choose the default direction for page turns or use continuous vertical scrolling.
					</p>
				</section>
			{:else if activeSection === 'backup-restore'}
				<section id="backup-restore" class="scroll-mt-20 p-4">
					<h2 class="text-base font-semibold">Backup & restore</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						Keep an independent copy of your local library and reading data.
					</p>
					<div class="mt-4 rounded-lg border border-border p-4">
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h3 class="text-sm font-semibold">Library backup</h3>
								<p class="mt-1 max-w-2xl text-xs text-muted-foreground">
									Download a versioned archive of your imported EPUBs, book details, reading
									progress, preferences, bookmarks, and highlights. It is created entirely on this
									device.
								</p>
							</div>
							<Button onclick={exportLibrary} disabled={exporting} class="sm:shrink-0">
								<Download aria-hidden="true" />
								{exporting ? 'Preparing…' : 'Export backup'}
							</Button>
						</div>
						<p class="mt-3 text-xs text-muted-foreground" aria-live="polite">{exportStatus}</p>
					</div>
					<div class="mt-3 rounded-lg border border-border p-4">
						<h3 class="text-sm font-semibold">Restore a backup</h3>
						<p class="mt-1 text-xs text-muted-foreground">
							In-app restore is not available yet. Keep the exported archive safe for a future
							restore release.
						</p>
					</div>
				</section>
			{:else}
				<section id="storage-privacy" class="scroll-mt-20 p-4">
					<h2 class="text-base font-semibold">Storage & privacy</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						Understand where Granthalay keeps your books and reading activity.
					</p>
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
			{/if}
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
