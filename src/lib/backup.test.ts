import JSZip from 'jszip';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	backupErrorMessage,
	backupImportErrorMessage,
	createLibraryBackup,
	formatBytes,
	parseLibraryBackup,
	previewLibraryBackup,
	restoreLibraryBackup
} from './backup';
import { getBookById, saveBook } from './db';
import { READER_PREFERENCES_KEY } from './reader/preferences';

const epubBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

function memoryStorage(): Storage {
	const values = new Map<string, string>();
	return {
		get length() {
			return values.size;
		},
		clear: () => values.clear(),
		getItem: (key) => values.get(key) ?? null,
		key: (index) => [...values.keys()][index] ?? null,
		removeItem: (key) => void values.delete(key),
		setItem: (key, value) => void values.set(key, String(value))
	};
}

const preferences = {
	readerDefaults: {
		fontScale: 1.2,
		lineHeight: 1.8,
		margins: 'wide' as const,
		alignment: 'justify' as const,
		theme: 'dark' as const,
		navigation: 'ltr' as const
	},
	bookOverrides: {},
	theme: 'dark',
	libraryView: 'compact',
	bundledBookProgress: { progress: 0.2, currentChapter: 1 }
};

describe('library backup', () => {
	beforeEach(() => {
		vi.stubGlobal('indexedDB', new IDBFactory());
		vi.stubGlobal('localStorage', memoryStorage());
	});
	it('round-trips EPUB bytes, metadata, progress, preferences, and annotations', async () => {
		const bytes = await createLibraryBackup({
			books: [
				{
					metadata: {
						id: 'book-1',
						name: 'book.epub',
						title: 'Portable Book',
						cover: null,
						createdAt: 10,
						progress: 0.5,
						semanticProgression: 0.25
					},
					buffer: epubBytes.buffer
				}
			],
			annotations: [
				{
					formatVersion: 1,
					id: 'annotation-1',
					bookId: 'book-1',
					kind: 'highlight',
					location: { href: 'chapter.xhtml', progression: 0.25 },
					selector: { exact: 'saved passage' },
					createdAt: 11,
					updatedAt: 11
				}
			],
			preferences
		});

		const parsed = await parseLibraryBackup(bytes);
		expect(parsed.manifest).toMatchObject({
			format: 'granthalay-library-backup',
			version: 1,
			books: [{ id: 'book-1', title: 'Portable Book', progress: 0.5 }],
			annotations: [{ id: 'annotation-1', kind: 'highlight' }],
			preferences
		});
		expect(parsed.bookContents.get('book-1')).toEqual(epubBytes);
	});

	it('rejects unsafe paths, malformed EPUB payloads, and orphaned annotations', async () => {
		const unsafeBytes = await createLibraryBackup({
			books: [
				{
					metadata: {
						id: '../book',
						name: 'book.epub',
						title: 'Unsafe',
						cover: null,
						createdAt: 1
					},
					buffer: epubBytes.buffer
				}
			],
			annotations: [],
			preferences
		});
		const unsafeZip = await JSZip.loadAsync(unsafeBytes);
		const unsafeManifest = JSON.parse(await unsafeZip.file('manifest.json')!.async('string'));
		unsafeManifest.books[0].contentPath = '../book.epub';
		unsafeZip.file('manifest.json', JSON.stringify(unsafeManifest));
		await expect(
			parseLibraryBackup(await unsafeZip.generateAsync({ type: 'uint8array' }))
		).rejects.toThrow('unsafe archive path');

		const malformed = await createLibraryBackup({
			books: [
				{
					metadata: {
						id: 'bad-epub',
						name: 'bad.epub',
						title: 'Bad EPUB',
						cover: null,
						createdAt: 1
					},
					buffer: new Uint8Array([1, 2, 3]).buffer
				}
			],
			annotations: [],
			preferences
		});
		await expect(parseLibraryBackup(malformed)).rejects.toThrow('EPUB data is invalid');

		const orphaned = await createLibraryBackup({
			books: [],
			annotations: [
				{
					formatVersion: 1,
					id: 'orphan',
					bookId: 'missing',
					kind: 'bookmark',
					location: { href: 'chapter.xhtml', progression: 0 },
					createdAt: 1,
					updatedAt: 1
				}
			],
			preferences
		});
		await expect(parseLibraryBackup(orphaned)).rejects.toThrow('orphaned annotation');
	});

	it('rejects missing, unsupported, and incomplete manifests', async () => {
		await expect(parseLibraryBackup(new Uint8Array([1, 2, 3]))).rejects.toThrow(
			'not a valid Granthalay backup'
		);
		await expect(
			parseLibraryBackup(await new JSZip().generateAsync({ type: 'uint8array' }))
		).rejects.toThrow('manifest is missing');
		const zip = new JSZip();
		zip.file('manifest.json', JSON.stringify({ format: 'granthalay-library-backup', version: 99 }));
		await expect(
			parseLibraryBackup(await zip.generateAsync({ type: 'uint8array' }))
		).rejects.toThrow('Unsupported');
	});

	it('reports readable sizes and quota or memory failures', () => {
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(backupErrorMessage(new DOMException('full', 'QuotaExceededError'))).toContain('full');
		expect(backupErrorMessage(new RangeError('allocation failed'))).toContain('too large');
		expect(backupImportErrorMessage(new DOMException('full', 'QuotaExceededError'))).toContain(
			'storage is full'
		);
	});

	it('previews conflicts and keeps existing books by default', async () => {
		const id = await saveBook(epubBytes.buffer, 'existing.epub', 'Existing Book', null);
		const bytes = await createLibraryBackup({
			books: [
				{
					metadata: {
						id,
						name: 'backup.epub',
						title: 'Backup Book',
						cover: null,
						createdAt: 1
					},
					buffer: epubBytes.buffer
				}
			],
			annotations: [],
			preferences
		});
		const parsed = await parseLibraryBackup(bytes);
		const existing = [(await getBookById(id))!];

		expect(previewLibraryBackup(parsed, existing).conflicts).toHaveLength(1);
		expect(await restoreLibraryBackup(parsed, existing, 'keep-existing')).toEqual({
			booksRestored: 0,
			annotationsRestored: 0
		});
		expect(await getBookById(id)).toMatchObject({ title: 'Existing Book' });
	});

	it('restores selected data and rolls preferences back if the transaction aborts', async () => {
		const bytes = await createLibraryBackup({
			books: [
				{
					metadata: {
						id: 'restored',
						name: 'restored.epub',
						title: 'Restored Book',
						cover: null,
						createdAt: 1
					},
					buffer: epubBytes.buffer
				}
			],
			annotations: [],
			preferences
		});
		const parsed = await parseLibraryBackup(bytes);
		localStorage.setItem(READER_PREFERENCES_KEY, 'previous preferences');
		const originalPut = IDBObjectStore.prototype.put;
		const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
			this: IDBObjectStore,
			value: unknown,
			key?: IDBValidKey
		) {
			if (this.name === 'bookContents')
				throw new DOMException('restore failed', 'InvalidStateError');
			return originalPut.call(this, value, key);
		});

		await expect(restoreLibraryBackup(parsed, [], 'replace-existing')).rejects.toThrow(
			'restore failed'
		);
		putSpy.mockRestore();
		expect(localStorage.getItem(READER_PREFERENCES_KEY)).toBe('previous preferences');
		expect(await getBookById('restored')).toBeNull();

		expect(await restoreLibraryBackup(parsed, [], 'replace-existing')).toEqual({
			booksRestored: 1,
			annotationsRestored: 0
		});
		expect(await getBookById('restored')).toMatchObject({ title: 'Restored Book' });
		expect(JSON.parse(localStorage.getItem(READER_PREFERENCES_KEY)!)).toEqual(
			preferences.readerDefaults
		);
	});
});
