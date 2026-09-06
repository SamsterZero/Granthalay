<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { CircleCheck, Download, ExternalLink, RefreshCw, Trash2, Upload } from 'lucide-svelte';
	import {
		backupErrorMessage,
		backupImportErrorMessage,
		collectLocalBackupSource,
		createLibraryBackup,
		formatBytes,
		parseLibraryBackup,
		previewLibraryBackup,
		restoreLibraryBackup,
		type BackupConflictStrategy,
		type BackupPreview,
		type ParsedBackup
	} from '$lib/backup';
	import {
		decryptLibraryBackup,
		encryptedBackupFilename,
		encryptLibraryBackup,
		isEncryptedLibraryBackup,
		validateBackupPassphrase
	} from '$lib/backup-crypto';
	import LibraryBottomBar from '$lib/components/library/LibraryBottomBar.svelte';
	import TopBar from '$lib/components/library/TopBar.svelte';
	import ReaderAppearance from '$lib/components/reader/ReaderAppearance.svelte';
	import AccountSection from '$lib/components/settings/AccountSection.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { deleteBooksByIds, getAllAnnotations, getAllBooks, type BookMetadata } from '$lib/db';
	import {
		DEFAULT_READER_PREFERENCES,
		loadGlobalReaderPreferences,
		READER_PREFERENCES_KEY,
		type ReaderPreferences
	} from '$lib/reader/preferences';
	import {
		clearRuntimeCaches,
		inspectStorageHealth,
		type StorageHealth
	} from '$lib/storage-health';

	const settingsSections = [
		{ id: 'account', label: 'Account & Security' },
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
	let activeSection = $state<(typeof settingsSections)[number]['id']>('account');
	let annotationCount = $state(0);
	let darkMode = $state(false);
	let showInstall = $state(false);
	let installPrompt = $state<unknown>(null);
	let exporting = $state(false);
	let exportStatus = $state('');
	let exportPassphrase = $state('');
	let exportPassphraseConfirmation = $state('');
	let selectedBackup = $state.raw<ParsedBackup | null>(null);
	let selectedBackupFile = $state<File | null>(null);
	let backupPreview = $state.raw<BackupPreview | null>(null);
	let selectedBackupName = $state('');
	let importPassphrase = $state('');
	let legacyPlaintextBackup = $state(false);
	let conflictStrategy = $state<BackupConflictStrategy>('keep-existing');
	let importing = $state(false);
	let importStatus = $state('');
	let importStatusKind = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
	let backupInput = $state<HTMLInputElement>();
	let storageHealth = $state<StorageHealth | null>(null);
	let storedBooks = $state<BookMetadata[]>([]);
	let selectedBookIds = $state<string[]>([]);
	let loadingStorage = $state(false);
	let clearingCache = $state(false);
	let deletingBooks = $state(false);
	let confirmBookDeletion = $state(false);
	let storageStatus = $state('');

	onMount(async () => {
		const requestedSection = window.location.hash.slice(1);
		if (settingsSections.some((section) => section.id === requestedSection)) {
			activeSection = requestedSection as (typeof settingsSections)[number]['id'];
		}
		preferences = loadGlobalReaderPreferences();
		darkMode =
			preferences.theme === 'dark' ||
			(preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		applyTheme(preferences.theme);

		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault();
			installPrompt = e;
			showInstall = true;
		});

		try {
			annotationCount = (await getAllAnnotations()).length;
		} catch {
			annotationCount = 0;
		}
		await refreshStorageHealth();
	});

	function toggleDarkMode() {
		darkMode = !darkMode;
		const newTheme = darkMode ? 'dark' : 'light';
		updatePreferences({ theme: newTheme });
	}

	async function handleInstall() {
		if (!installPrompt) return;
		installPrompt.prompt();
		const { outcome } = await installPrompt.userChoice;
		if (outcome === 'accepted') {
			showInstall = false;
			installPrompt = null;
		}
	}

	async function refreshStorageHealth() {
		loadingStorage = true;
		try {
			[storageHealth, storedBooks] = await Promise.all([inspectStorageHealth(), getAllBooks()]);
			selectedBookIds = selectedBookIds.filter((id) => storedBooks.some((book) => book.id === id));
		} catch (error) {
			storageStatus = error instanceof Error ? error.message : 'Storage details could not be read.';
		} finally {
			loadingStorage = false;
		}
	}

	function toggleSelectedBook(bookId: string) {
		selectedBookIds = selectedBookIds.includes(bookId)
			? selectedBookIds.filter((id) => id !== bookId)
			: [...selectedBookIds, bookId];
		confirmBookDeletion = false;
	}

	async function clearTemporaryCache() {
		clearingCache = true;
		storageStatus = 'Clearing temporary cached responses…';
		try {
			const count = await clearRuntimeCaches();
			storageStatus = count
				? 'Temporary cache cleared. Your books and offline app shell were not changed.'
				: 'No temporary cache needed clearing. Your books were not changed.';
			await refreshStorageHealth();
		} catch (error) {
			storageStatus =
				error instanceof Error ? error.message : 'Temporary cache could not be cleared.';
		} finally {
			clearingCache = false;
		}
	}

	async function deleteSelectedBooks() {
		if (!confirmBookDeletion || selectedBookIds.length === 0) return;
		deletingBooks = true;
		const count = selectedBookIds.length;
		storageStatus = `Deleting ${count} selected ${count === 1 ? 'book' : 'books'}…`;
		try {
			await deleteBooksByIds(selectedBookIds);
			selectedBookIds = [];
			confirmBookDeletion = false;
			annotationCount = (await getAllAnnotations()).length;
			storageStatus = `${count} ${count === 1 ? 'book was' : 'books were'} deleted with their EPUB data and annotations.`;
			await refreshStorageHealth();
		} catch (error) {
			storageStatus =
				error instanceof Error ? error.message : 'Selected books could not be deleted.';
		} finally {
			deletingBooks = false;
		}
	}

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
			validateBackupPassphrase(exportPassphrase);
			if (exportPassphrase !== exportPassphraseConfirmation) {
				throw new Error('The backup passphrases do not match.');
			}
			const source = await collectLocalBackupSource();
			const zipBytes = await createLibraryBackup(source);
			const bytes = await encryptLibraryBackup(zipBytes, exportPassphrase);
			const archive = new ArrayBuffer(bytes.byteLength);
			new Uint8Array(archive).set(bytes);
			const blob = new Blob([archive], { type: 'application/octet-stream' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = encryptedBackupFilename();
			anchor.click();
			setTimeout(() => URL.revokeObjectURL(url), 0);
			exportStatus = `Backup ready: ${formatBytes(bytes.byteLength)} for ${source.books.length} ${source.books.length === 1 ? 'book' : 'books'}.`;
			exportPassphrase = '';
			exportPassphraseConfirmation = '';
		} catch (error) {
			exportStatus = backupErrorMessage(error);
		} finally {
			exporting = false;
		}
	}

	async function inspectBackup(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		selectedBackupFile = file ?? null;
		input.value = '';
		selectedBackup = null;
		backupPreview = null;
		selectedBackupName = file?.name ?? '';
		conflictStrategy = 'keep-existing';
		legacyPlaintextBackup = false;
		importStatusKind = 'idle';
		if (!file) return;
		await validateSelectedBackup();
	}

	async function validateSelectedBackup() {
		const file = selectedBackupFile;
		if (!file) return;
		importStatus = `Validating ${file.name}…`;
		importStatusKind = 'loading';
		try {
			const fileBytes = new Uint8Array(await file.arrayBuffer());
			const encrypted = isEncryptedLibraryBackup(fileBytes);
			if (encrypted) validateBackupPassphrase(importPassphrase);
			const backupBytes = encrypted
				? await decryptLibraryBackup(fileBytes, importPassphrase)
				: fileBytes;
			const parsed = await parseLibraryBackup(backupBytes);
			const preview = previewLibraryBackup(parsed, await getAllBooks());
			selectedBackup = parsed;
			backupPreview = preview;
			legacyPlaintextBackup = !encrypted;
			importStatus = encrypted
				? `Encrypted backup validated: ${preview.bookCount} ${preview.bookCount === 1 ? 'book' : 'books'} and ${preview.annotationCount} annotations.`
				: `Warning: this legacy backup is not encrypted. It contains ${preview.bookCount} ${preview.bookCount === 1 ? 'book' : 'books'} and ${preview.annotationCount} annotations.`;
			importStatusKind = 'idle';
		} catch (error) {
			importStatus = backupImportErrorMessage(error);
			importStatusKind = 'error';
		}
	}

	async function importBackup() {
		if (!selectedBackup || !backupPreview) return;
		const backupToRestore = selectedBackup;
		importing = true;
		importStatus = 'Restoring the validated backup…';
		importStatusKind = 'loading';
		selectedBackup = null;
		backupPreview = null;
		try {
			const result = await restoreLibraryBackup(
				backupToRestore,
				await getAllBooks(),
				conflictStrategy
			);
			preferences = loadGlobalReaderPreferences();
			applyTheme(preferences.theme);
			annotationCount = (await getAllAnnotations()).length;
			importStatus = `Restore complete: ${result.booksRestored} ${result.booksRestored === 1 ? 'book' : 'books'} and ${result.annotationsRestored} annotations restored.`;
			selectedBackupFile = null;
			importPassphrase = '';
			selectedBackupName = '';
			legacyPlaintextBackup = false;
			importStatusKind = 'success';
		} catch (error) {
			importStatus = backupImportErrorMessage(error);
			importStatusKind = 'error';
		} finally {
			importing = false;
		}
	}
</script>

<svelte:head><title>Settings · Granthalay</title></svelte:head>

<div
	class="min-h-screen bg-background p-4 pb-24 font-sans text-foreground transition-colors duration-300"
>
	<TopBar {darkMode} {showInstall} onTheme={toggleDarkMode} onInstall={handleInstall} />

	<nav
		class="mb-4 flex gap-1 overflow-x-auto border-b border-border pb-2 lg:hidden"
		aria-label="Settings sections"
	>
		{#each settingsSections as section (section.id)}
			<button
				type="button"
				class="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
				class:bg-primary={activeSection === section.id}
				class:text-primary-foreground={activeSection === section.id}
				class:text-muted-foreground={activeSection !== section.id}
				onclick={() => showSection(section.id)}
				aria-current={activeSection === section.id ? 'page' : undefined}
			>
				{section.label}
			</button>
		{/each}
	</nav>

	<main
		class="grid gap-8 px-4 pt-2 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:px-8"
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
			{#if activeSection === 'account'}
				<AccountSection />
			{:else if activeSection === 'appearance'}
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
				<section id="backup-restore" class="scroll-mt-20 px-4 pb-4">
					<h2 class="text-base font-semibold">Backup & restore</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						Keep an independent copy of your local library and reading data.
					</p>
					<div class="mt-5">
						<h3 class="text-sm font-semibold">Library backup</h3>
						<p class="mt-1 max-w-2xl text-xs text-muted-foreground">
							Download an encrypted archive of your imported EPUBs, book details, reading progress,
							preferences, bookmarks, and highlights. The passphrase cannot be recovered if
							forgotten.
						</p>
						<div class="mt-4 grid items-end gap-3 sm:grid-cols-2">
							<label class="grid gap-1 text-sm">
								<span>Backup passphrase</span>
								<input
									type="password"
									class="h-9 rounded-md border border-input bg-transparent px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
									autocomplete="new-password"
									minlength="12"
									bind:value={exportPassphrase}
								/>
							</label>
							<label class="grid gap-1 text-sm">
								<span>Confirm passphrase</span>
								<input
									type="password"
									class="h-9 rounded-md border border-input bg-transparent px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
									autocomplete="new-password"
									minlength="12"
									bind:value={exportPassphraseConfirmation}
								/>
							</label>
						</div>
						<p class="mt-1 text-xs text-muted-foreground">At least 12 characters</p>
						<div class="mt-4 flex flex-col justify-end gap-2 sm:flex-row">
							<Button
								onclick={exportLibrary}
								disabled={exporting}
								class="w-full sm:w-auto sm:shrink-0"
							>
								<Download aria-hidden="true" />
								{exporting ? 'Preparing…' : 'Export backup'}
							</Button>
						</div>
						<p class="mt-3 text-xs text-muted-foreground" aria-live="polite">{exportStatus}</p>
					</div>
					<div class="mt-7">
						<h3 class="text-sm font-semibold">Restore a backup</h3>
						<p class="mt-1 max-w-2xl text-xs text-muted-foreground">
							Enter the archive passphrase, then choose an exported Granthalay backup. Legacy
							plaintext ZIP backups remain supported with a warning.
						</p>
						<label class="mt-4 grid max-w-md gap-1 text-sm">
							<span>Backup passphrase</span>
							<input
								type="password"
								class="h-9 rounded-md border border-input bg-transparent px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
								autocomplete="current-password"
								bind:value={importPassphrase}
							/>
						</label>
						<div class="mt-4 flex flex-col justify-end gap-2 sm:flex-row">
							<input
								type="file"
								class="sr-only"
								accept=".granthalay,.zip,.granthalay.zip,application/zip,application/octet-stream"
								onchange={inspectBackup}
								bind:this={backupInput}
							/>
							<Button
								variant="outline"
								class="w-full sm:w-auto sm:shrink-0"
								onclick={() => backupInput?.click()}
							>
								<Upload class="h-4 w-4" aria-hidden="true" />
								Choose backup
							</Button>
							{#if selectedBackupFile && !selectedBackup}
								<Button class="w-full sm:w-auto" onclick={validateSelectedBackup}>
									Unlock & validate
								</Button>
							{/if}
						</div>

						{#if backupPreview && selectedBackup}
							<div
								class="mt-4 rounded-md bg-muted/50 p-3"
								aria-labelledby="restore-preview-heading"
							>
								<h4 id="restore-preview-heading" class="text-sm font-semibold">Restore preview</h4>
								{#if legacyPlaintextBackup}
									<p class="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
										This legacy backup is not encrypted. Store it securely and replace it with a new
										encrypted export.
									</p>
								{/if}
								<p class="mt-1 text-xs break-all text-muted-foreground">{selectedBackupName}</p>
								<ul class="mt-2 list-inside list-disc text-sm">
									<li>{backupPreview.newBooks.length} new books</li>
									<li>{backupPreview.conflicts.length} books already in this library</li>
									<li>{backupPreview.annotationCount} bookmarks and highlights</li>
									<li>Reader defaults and library preferences will be replaced</li>
								</ul>
								{#if backupPreview.conflicts.length > 0}
									<p class="mt-3 text-sm font-medium">Conflicting books</p>
									<ul class="mt-1 list-inside list-disc text-xs text-muted-foreground">
										{#each backupPreview.conflicts.slice(0, 5) as book (book.id)}
											<li>{book.title}</li>
										{/each}
										{#if backupPreview.conflicts.length > 5}
											<li>And {backupPreview.conflicts.length - 5} more</li>
										{/if}
									</ul>
									<fieldset class="mt-3 grid gap-2 text-sm">
										<legend class="font-medium">For existing books</legend>
										<label class="flex items-start gap-2">
											<input type="radio" bind:group={conflictStrategy} value="keep-existing" />
											<span>Keep existing books and skip their backup copies</span>
										</label>
										<label class="flex items-start gap-2">
											<input type="radio" bind:group={conflictStrategy} value="replace-existing" />
											<span>Replace existing books, progress, preferences, and annotations</span>
										</label>
									</fieldset>
								{/if}
								<div class="mt-4 flex justify-end">
									<Button class="w-full sm:w-auto" onclick={importBackup} disabled={importing}>
										{importing ? 'Restoring…' : 'Restore backup'}
									</Button>
								</div>
							</div>
						{/if}
						{#if importStatus}
							<div
								class="mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs {importStatusKind ===
								'success'
									? 'bg-primary/10 text-foreground'
									: importStatusKind === 'error'
										? 'bg-destructive/10 text-destructive'
										: 'text-muted-foreground'}"
								aria-live="polite"
								aria-atomic="true"
							>
								{#if importStatusKind === 'loading'}
									<Spinner class="shrink-0" aria-label="Restoring backup" />
								{:else if importStatusKind === 'success'}
									<CircleCheck class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
								{/if}
								<span>{importStatus}</span>
							</div>
						{/if}
					</div>
				</section>
			{:else}
				<section id="storage-privacy" class="scroll-mt-20 px-4 pb-4">
					<h2 class="text-base font-semibold">Storage & privacy</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						Check available space or safely free storage on this device.
					</p>
					<div class="mt-5">
						<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h3 class="text-sm font-semibold">Storage health</h3>
								<p class="mt-1 text-xs text-muted-foreground">
									Includes books, preferences, and cached data for this site.
								</p>
							</div>
							<Button variant="outline" onclick={refreshStorageHealth} disabled={loadingStorage}>
								<RefreshCw class={loadingStorage ? 'animate-spin' : ''} aria-hidden="true" />
								Refresh
							</Button>
						</div>
						{#if storageHealth && storageHealth.usage !== null && storageHealth.quota !== null}
							<div class="mt-4">
								<div class="flex justify-between gap-4 text-sm">
									<span>{formatBytes(storageHealth.usage)} used</span>
									<span class="text-muted-foreground">{formatBytes(storageHealth.quota)} quota</span
									>
								</div>
								<div class="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
									<div
										class="h-full rounded-full bg-primary"
										style:width={`${Math.min(100, (storageHealth.usageRatio ?? 0) * 100)}%`}
									></div>
								</div>
							</div>
						{:else}
							<p class="mt-4 text-sm text-muted-foreground">
								This browser does not provide a storage usage estimate in the current context.
							</p>
						{/if}
						<p class="mt-3 text-xs text-muted-foreground">
							Cache:
							{storageHealth?.cacheBytes === null || storageHealth?.cacheBytes === undefined
								? 'unavailable'
								: formatBytes(storageHealth.cacheBytes)}
							· Storage protection:
							{storageHealth?.persisted === true
								? 'granted'
								: storageHealth?.persisted === false
									? 'not granted'
									: 'unavailable'}
						</p>
						<div class="mt-3 flex justify-end">
							<Button variant="outline" onclick={clearTemporaryCache} disabled={clearingCache}>
								<Trash2 aria-hidden="true" />
								{clearingCache ? 'Clearing…' : 'Clear temporary cache'}
							</Button>
						</div>
						<p class="mt-2 text-xs text-muted-foreground">
							Does not delete books or offline access.
						</p>
					</div>

					<details class="mt-7">
						<summary class="cursor-pointer text-sm font-semibold">
							Remove imported books ({storedBooks.length})
						</summary>
						{#if storedBooks.length > 0}
							<p class="mt-2 text-xs text-muted-foreground">
								Permanently deletes each selected EPUB and its reading data. Export a backup first.
							</p>
							<fieldset class="mt-3 grid max-h-72 gap-2 overflow-y-auto pr-1">
								<legend class="sr-only">Select books to delete</legend>
								{#each storedBooks as book (book.id)}
									<label class="flex items-start gap-3 rounded-md bg-muted/50 p-3 text-sm">
										<input
											type="checkbox"
											class="mt-0.5"
											checked={selectedBookIds.includes(book.id)}
											onchange={() => toggleSelectedBook(book.id)}
										/>
										<span>
											<span class="block font-medium">{book.title}</span>
											<span class="block text-xs text-muted-foreground">{book.name}</span>
										</span>
									</label>
								{/each}
							</fieldset>
							<div class="mt-4 flex flex-col items-end gap-2">
								{#if confirmBookDeletion}
									<p class="text-sm text-destructive" role="alert">
										This cannot be undone. Export a backup first if you may need these books later.
									</p>
								{/if}
								<div class="flex flex-col gap-2 sm:flex-row">
									{#if confirmBookDeletion}
										<Button variant="outline" onclick={() => (confirmBookDeletion = false)}
											>Cancel</Button
										>
									{/if}
									<Button
										variant="destructive"
										disabled={selectedBookIds.length === 0 || deletingBooks}
										onclick={() =>
											confirmBookDeletion ? deleteSelectedBooks() : (confirmBookDeletion = true)}
									>
										<Trash2 aria-hidden="true" />
										{deletingBooks
											? 'Deleting…'
											: confirmBookDeletion
												? `Delete ${selectedBookIds.length} permanently`
												: `Delete selected (${selectedBookIds.length})`}
									</Button>
								</div>
							</div>
						{:else}
							<p class="mt-4 text-sm text-muted-foreground">No imported books are stored here.</p>
						{/if}
					</details>
					<p class="mt-3 text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
						{storageStatus}
					</p>
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
