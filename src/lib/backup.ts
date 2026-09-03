import JSZip from 'jszip';
import { getAllAnnotations, getAllBooks, getBookById, type BookMetadata } from '$lib/db';
import type { BookAnnotation } from '$lib/reader/annotations';
import {
	loadGlobalReaderPreferences,
	parseReaderPreferences,
	readerPreferencesKey,
	type ReaderPreferences
} from '$lib/reader/preferences';

export const BACKUP_FORMAT = 'granthalay-library-backup' as const;
export const BACKUP_VERSION = 1 as const;
const MANIFEST_PATH = 'manifest.json';

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
}

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
	let zip: JSZip;
	try {
		zip = await JSZip.loadAsync(data);
	} catch {
		throw new Error('The selected file is not a valid Granthalay backup.');
	}
	const manifestFile = zip.file(MANIFEST_PATH);
	if (!manifestFile) throw new Error('Backup manifest is missing.');
	const manifest = JSON.parse(await manifestFile.async('string')) as Partial<BackupManifest>;
	if (manifest.format !== BACKUP_FORMAT || manifest.version !== BACKUP_VERSION) {
		throw new Error('Unsupported Granthalay backup format or version.');
	}
	if (
		!Array.isArray(manifest.books) ||
		!Array.isArray(manifest.annotations) ||
		!manifest.preferences
	) {
		throw new Error('Backup manifest is incomplete.');
	}

	const bookContents = new Map<string, Uint8Array>();
	for (const book of manifest.books) {
		const file = zip.file(book.contentPath);
		if (!file) throw new Error(`EPUB data is missing for “${book.title}”.`);
		bookContents.set(book.id, await file.async('uint8array'));
	}
	return { manifest: manifest as BackupManifest, bookContents };
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

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
	return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
