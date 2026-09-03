import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { backupErrorMessage, createLibraryBackup, formatBytes, parseLibraryBackup } from './backup';

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
					buffer: new Uint8Array([1, 2, 3]).buffer
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
		expect(parsed.bookContents.get('book-1')).toEqual(new Uint8Array([1, 2, 3]));
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
	});
});
