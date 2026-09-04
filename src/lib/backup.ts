import JSZip from 'jszip';
import { z } from 'zod';
import {
	getAllAnnotations,
	getAllBooks,
	getBookById,
	restoreBookRecords,
	type BookMetadata
} from '$lib/db';
import { isBookAnnotation, type BookAnnotation } from '$lib/reader/annotations';
import {
	READER_PREFERENCES_KEY,
	loadGlobalReaderPreferences,
	parseReaderPreferences,
	readerPreferencesKey,
	type ReaderPreferences
} from '$lib/reader/preferences';

export const BACKUP_FORMAT = 'granthalay-library-backup' as const;
export const BACKUP_VERSION = 1 as const;
const MANIFEST_PATH = 'manifest.json';
const MAX_BACKUP_SIZE = 2 * 1024 ** 3;
const MAX_BOOK_SIZE = 1024 ** 3;
const MAX_COVER_SIZE = 50 * 1024 ** 2;
const MAX_MANIFEST_SIZE = 5 * 1024 ** 2;

const readerPreferencesSchema = z
	.object({
		fontScale: z.number().finite().min(0.8).max(1.6),
		lineHeight: z.number().finite().min(1.2).max(2.2).nullable(),
		margins: z.enum(['narrow', 'standard', 'wide']),
		alignment: z.enum(['publisher', 'left', 'justify']),
		theme: z.enum(['system', 'light', 'dark']),
		navigation: z.enum(['rtl', 'ltr', 'scroll'])
	})
	.strict();
const finiteProgress = z.number().finite().min(0).max(1).optional();
const optionalIndex = z.number().int().nonnegative().optional();
const backupBookSchema = z
	.object({
		id: z.string().min(1).max(256),
		name: z.string().min(1).max(1024),
		title: z.string().min(1).max(4096),
		author: z.string().max(4096).optional(),
		description: z.string().max(100_000).optional(),
		createdAt: z.number().finite().nonnegative(),
		progress: finiteProgress,
		currentChapter: optionalIndex,
		currentPage: optionalIndex,
		totalBookPages: optionalIndex,
		semanticProgression: finiteProgress,
		contentPath: z.string().min(1).max(1024),
		cover: z
			.union([
				z.object({ kind: z.literal('text'), value: z.string().max(10_000_000) }).strict(),
				z
					.object({
						kind: z.literal('file'),
						path: z.string().min(1).max(1024),
						mediaType: z.string().min(1).max(256)
					})
					.strict()
			])
			.nullable()
	})
	.strict();
const backupManifestSchema = z
	.object({
		format: z.literal(BACKUP_FORMAT),
		version: z.literal(BACKUP_VERSION),
		createdAt: z.iso.datetime(),
		books: z.array(backupBookSchema).max(10_000),
		annotations: z.array(z.unknown()).max(1_000_000),
		preferences: z
			.object({
				readerDefaults: readerPreferencesSchema,
				bookOverrides: z.record(z.string(), readerPreferencesSchema),
				theme: z.string().max(256).nullable(),
				libraryView: z.enum(['list', 'compact', 'comfortable']).nullable(),
				bundledBookProgress: z.unknown().nullable()
			})
			.strict()
	})
	.strict();

export interface BackupBook extends Omit<BookMetadata, 'cover'> {
	contentPath: string;
	cover: { kind: 'text'; value: string } | { kind: 'file'; path: string; mediaType: string } | null;
}

export interface BackupManifest {
	format: typeof BACKUP_FORMAT;
	version: typeof BACKUP_VERSION;
	createdAt: string;
	books: BackupBook[];
	annotations: BookAnnotation[];
	preferences: {
		readerDefaults: ReaderPreferences;
		bookOverrides: Record<string, ReaderPreferences>;
		theme: string | null;
		libraryView: string | null;
		bundledBookProgress: unknown | null;
	};
}

export interface BackupSource {
	books: Array<{ metadata: BookMetadata; buffer: ArrayBuffer }>;
	annotations: BookAnnotation[];
	preferences: BackupManifest['preferences'];
}

export interface ParsedBackup {
	manifest: BackupManifest;
	bookContents: Map<string, Uint8Array>;
	bookCovers: Map<string, Blob | string | null>;
}

export interface BackupPreview {
	bookCount: number;
	annotationCount: number;
	conflicts: BackupBook[];
	newBooks: BackupBook[];
}

export type BackupConflictStrategy = 'keep-existing' | 'replace-existing';

function safePathPart(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function createLibraryBackup(source: BackupSource): Promise<Uint8Array> {
	const zip = new JSZip();
	const books: BackupBook[] = [];

	for (const { metadata, buffer } of source.books) {
		const directory = `books/${safePathPart(metadata.id)}`;
		const contentPath = `${directory}/book.epub`;
		zip.file(contentPath, buffer);
		let cover: BackupBook['cover'] = null;
		if (metadata.cover instanceof Blob) {
			const extension = metadata.cover.type === 'image/png' ? 'png' : 'bin';
			const path = `${directory}/cover.${extension}`;
			zip.file(path, await metadata.cover.arrayBuffer());
			cover = { kind: 'file', path, mediaType: metadata.cover.type || 'application/octet-stream' };
		} else if (typeof metadata.cover === 'string' && !metadata.cover.startsWith('blob:')) {
			cover = { kind: 'text', value: metadata.cover };
		}

		const { cover: _cover, ...portableMetadata } = metadata;
		void _cover;
		books.push({ ...portableMetadata, contentPath, cover });
	}

	const manifest: BackupManifest = {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		createdAt: new Date().toISOString(),
		books,
		annotations: source.annotations,
		preferences: source.preferences
	};
	zip.file(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
	return zip.generateAsync({
		type: 'uint8array',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 }
	});
}

export async function parseLibraryBackup(data: ArrayBuffer | Uint8Array): Promise<ParsedBackup> {
	if (data.byteLength > MAX_BACKUP_SIZE)
		throw new Error('The backup is too large to import safely.');
	let zip: JSZip;
	try {
		zip = await JSZip.loadAsync(data);
	} catch {
		throw new Error('The selected file is not a valid Granthalay backup.');
	}
	const manifestFile = zip.file(MANIFEST_PATH);
	if (!manifestFile) throw new Error('Backup manifest is missing.');
	assertEntrySize(
		manifestFile,
		MAX_MANIFEST_SIZE,
		'Backup manifest is too large to import safely.'
	);
	let unknownManifest: unknown;
	try {
		unknownManifest = JSON.parse(await manifestFile.async('string'));
	} catch {
		throw new Error('Backup manifest is not valid JSON.');
	}
	if (
		!unknownManifest ||
		typeof unknownManifest !== 'object' ||
		(unknownManifest as { format?: unknown }).format !== BACKUP_FORMAT ||
		(unknownManifest as { version?: unknown }).version !== BACKUP_VERSION
	) {
		throw new Error('Unsupported Granthalay backup format or version.');
	}
	const parsedManifest = backupManifestSchema.safeParse(unknownManifest);
	if (!parsedManifest.success) {
		throw new Error('Backup manifest contains invalid or incomplete data.');
	}
	const manifest = parsedManifest.data as BackupManifest;
	const bookIds = new Set<string>();
	const archivePaths = new Set<string>();
	for (const book of manifest.books) {
		if (bookIds.has(book.id)) throw new Error(`Backup contains duplicate book ID “${book.id}”.`);
		bookIds.add(book.id);
		validateArchivePath(book.contentPath);
		const expectedContentPath = `books/${safePathPart(book.id)}/book.epub`;
		if (book.contentPath !== expectedContentPath || archivePaths.has(book.contentPath)) {
			throw new Error(`Backup contains an invalid EPUB path for “${book.title}”.`);
		}
		archivePaths.add(book.contentPath);
		if (book.cover?.kind === 'file') {
			validateArchivePath(book.cover.path);
			if (
				!book.cover.path.startsWith(`books/${safePathPart(book.id)}/cover.`) ||
				archivePaths.has(book.cover.path)
			) {
				throw new Error(`Backup contains an invalid cover path for “${book.title}”.`);
			}
			archivePaths.add(book.cover.path);
		}
	}
	const annotationIds = new Set<string>();
	for (const annotation of manifest.annotations) {
		if (!isBookAnnotation(annotation) || !bookIds.has(annotation.bookId)) {
			throw new Error('Backup contains an invalid or orphaned annotation.');
		}
		if (annotationIds.has(annotation.id)) {
			throw new Error(`Backup contains duplicate annotation ID “${annotation.id}”.`);
		}
		annotationIds.add(annotation.id);
	}

	const bookContents = new Map<string, Uint8Array>();
	const bookCovers = new Map<string, Blob | string | null>();
	for (const book of manifest.books) {
		const file = zip.file(book.contentPath);
		if (!file) throw new Error(`EPUB data is missing for “${book.title}”.`);
		assertEntrySize(file, MAX_BOOK_SIZE, `“${book.title}” is too large to import safely.`);
		const bytes = await file.async('uint8array');
		if (bytes.byteLength > MAX_BOOK_SIZE)
			throw new Error(`“${book.title}” is too large to import safely.`);
		if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
			throw new Error(`EPUB data is invalid for “${book.title}”.`);
		}
		bookContents.set(book.id, bytes);
		if (book.cover?.kind === 'file') {
			const coverFile = zip.file(book.cover.path);
			if (!coverFile) throw new Error(`Cover data is missing for “${book.title}”.`);
			assertEntrySize(coverFile, MAX_COVER_SIZE, `Cover for “${book.title}” is too large.`);
			bookCovers.set(
				book.id,
				new Blob([await coverFile.async('arraybuffer')], { type: book.cover.mediaType })
			);
		} else {
			bookCovers.set(
				book.id,
				book.cover?.kind === 'text' ? safeCoverValue(book.cover.value) : null
			);
		}
	}
	return { manifest, bookContents, bookCovers };
}

function assertEntrySize(file: JSZip.JSZipObject, maximum: number, message: string): void {
	const size = (file as unknown as { _data?: { uncompressedSize?: number } })._data
		?.uncompressedSize;
	if (typeof size === 'number' && size > maximum) throw new Error(message);
}

function validateArchivePath(path: string): void {
	if (
		path.startsWith('/') ||
		path.includes('\\') ||
		path.split('/').some((part) => part === '..')
	) {
		throw new Error('Backup contains an unsafe archive path.');
	}
}

function safeCoverValue(value: string): string | null {
	return value.startsWith('data:image/') ? value : null;
}

export function previewLibraryBackup(
	backup: ParsedBackup,
	existingBooks: BookMetadata[]
): BackupPreview {
	const existingIds = new Set(existingBooks.map((book) => book.id));
	return {
		bookCount: backup.manifest.books.length,
		annotationCount: backup.manifest.annotations.length,
		conflicts: backup.manifest.books.filter((book) => existingIds.has(book.id)),
		newBooks: backup.manifest.books.filter((book) => !existingIds.has(book.id))
	};
}

export async function restoreLibraryBackup(
	backup: ParsedBackup,
	existingBooks: BookMetadata[],
	strategy: BackupConflictStrategy
): Promise<{ booksRestored: number; annotationsRestored: number }> {
	const existingIds = new Set(existingBooks.map((book) => book.id));
	const selectedBooks = backup.manifest.books.filter(
		(book) => strategy === 'replace-existing' || !existingIds.has(book.id)
	);
	const selectedIds = new Set(selectedBooks.map((book) => book.id));
	const annotations = backup.manifest.annotations
		.filter((annotation) => selectedIds.has(annotation.bookId))
		.map((annotation) => ({
			formatVersion: annotation.formatVersion,
			id: annotation.id,
			bookId: annotation.bookId,
			kind: annotation.kind,
			location: {
				href: annotation.location.href,
				progression: annotation.location.progression
			},
			...(annotation.selector
				? {
						selector: {
							exact: annotation.selector.exact,
							...(annotation.selector.prefix !== undefined
								? { prefix: annotation.selector.prefix }
								: {}),
							...(annotation.selector.suffix !== undefined
								? { suffix: annotation.selector.suffix }
								: {})
						}
					}
				: {}),
			createdAt: annotation.createdAt,
			updatedAt: annotation.updatedAt
		}));
	const records = selectedBooks.map((book) => {
		const bytes = backup.bookContents.get(book.id);
		if (!bytes) throw new Error(`EPUB data is missing for “${book.title}”.`);
		const buffer = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(buffer).set(bytes);
		const { contentPath: _contentPath, cover: _cover, ...metadata } = book;
		void _contentPath;
		void _cover;
		return {
			metadata: { ...metadata, cover: backup.bookCovers.get(book.id) ?? null },
			buffer
		};
	});

	const preferenceKeys = [
		READER_PREFERENCES_KEY,
		'theme',
		'library-grid-mode',
		'book-progress-default',
		readerPreferencesKey('default'),
		...selectedBooks.map((book) => readerPreferencesKey(book.id))
	];
	const snapshot = new Map(preferenceKeys.map((key) => [key, localStorage.getItem(key)]));
	try {
		applyRestoredPreferences(backup.manifest.preferences, selectedIds);
		await restoreBookRecords(records, annotations);
	} catch (error) {
		restoreStorageSnapshot(snapshot);
		throw error;
	}

	return { booksRestored: records.length, annotationsRestored: annotations.length };
}

function applyRestoredPreferences(
	preferences: BackupManifest['preferences'],
	selectedIds: Set<string>
): void {
	localStorage.setItem(READER_PREFERENCES_KEY, JSON.stringify(preferences.readerDefaults));
	writeStorageValue('theme', preferences.theme);
	writeStorageValue('library-grid-mode', preferences.libraryView);
	writeStorageValue(
		'book-progress-default',
		preferences.bundledBookProgress === null
			? null
			: JSON.stringify(preferences.bundledBookProgress)
	);
	for (const bookId of selectedIds) {
		const override = preferences.bookOverrides[bookId];
		writeStorageValue(readerPreferencesKey(bookId), override ? JSON.stringify(override) : null);
	}
	const defaultOverride = preferences.bookOverrides.default;
	writeStorageValue(
		readerPreferencesKey('default'),
		defaultOverride ? JSON.stringify(defaultOverride) : null
	);
}

function restoreStorageSnapshot(snapshot: Map<string, string | null>): void {
	for (const [key, value] of snapshot) writeStorageValue(key, value);
}

function writeStorageValue(key: string, value: string | null): void {
	if (value === null) localStorage.removeItem(key);
	else localStorage.setItem(key, value);
}

export async function collectLocalBackupSource(): Promise<BackupSource> {
	const metadata = await getAllBooks();
	const records = await Promise.all(metadata.map((book) => getBookById(book.id)));
	const books = records.map((record, index) => {
		if (!record || !(record.buffer instanceof ArrayBuffer)) {
			throw new Error(`EPUB data could not be read for “${metadata[index].title}”.`);
		}
		const { buffer, ...bookMetadata } = record;
		return { metadata: bookMetadata, buffer };
	});
	const bookOverrides: Record<string, ReaderPreferences> = {};
	for (const book of metadata) {
		const stored = localStorage.getItem(readerPreferencesKey(book.id));
		if (stored !== null) bookOverrides[book.id] = parseReaderPreferences(stored);
	}
	const defaultOverride = localStorage.getItem(readerPreferencesKey('default'));
	if (defaultOverride !== null) bookOverrides.default = parseReaderPreferences(defaultOverride);

	return {
		books,
		annotations: await getAllAnnotations(),
		preferences: {
			readerDefaults: loadGlobalReaderPreferences(),
			bookOverrides,
			theme: localStorage.getItem('theme'),
			libraryView: localStorage.getItem('library-grid-mode'),
			bundledBookProgress: parseStoredJson(localStorage.getItem('book-progress-default'))
		}
	};
}

function parseStoredJson(value: string | null): unknown | null {
	if (value === null) return null;
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

export function backupFilename(now = new Date()): string {
	return `granthalay-backup-${now.toISOString().slice(0, 10)}.granthalay.zip`;
}

export function backupErrorMessage(error: unknown): string {
	if (error instanceof DOMException && error.name === 'QuotaExceededError') {
		return 'The backup could not be created because browser storage or memory is full.';
	}
	if (error instanceof RangeError)
		return 'The library is too large to package in available memory.';
	return error instanceof Error ? error.message : 'The backup could not be created.';
}

export function backupImportErrorMessage(error: unknown): string {
	if (error instanceof DOMException && error.name === 'QuotaExceededError') {
		return 'The backup could not be restored because browser storage is full.';
	}
	if (error instanceof DOMException && error.name === 'AbortError') {
		return 'The backup restore was interrupted and no library changes were saved. Check available browser storage and try again.';
	}
	if (error instanceof DOMException && error.name === 'ConstraintError') {
		return 'The backup conflicts with an existing library record and no changes were saved.';
	}
	if (error instanceof RangeError) return 'The backup is too large to process in available memory.';
	return error instanceof Error ? error.message : 'The backup could not be restored.';
}

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
	return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
