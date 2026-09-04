import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	deleteAnnotation,
	deleteBookById,
	deleteBooksByIds,
	getAllAnnotations,
	getAllBooks,
	getBookAnnotations,
	getBookById,
	restoreBookRecords,
	saveAnnotation,
	saveBook,
	updateBookProgress
} from './db';

function createLegacyDatabase(value: unknown): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('EpubReaderDB', 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore('books').put(value, 'current-book');
			request.result.createObjectStore('bookContents');
		};
		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			request.result.close();
			resolve();
		};
	});
}

function getStoredValue(storeName: string, id: string): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const openRequest = indexedDB.open('EpubReaderDB', 4);
		openRequest.onerror = () => reject(openRequest.error);
		openRequest.onsuccess = () => {
			const db = openRequest.result;
			const transaction = db.transaction(storeName, 'readonly');
			const request = transaction.objectStore(storeName).get(id);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
			transaction.oncomplete = () => db.close();
		};
	});
}

describe('IndexedDB migrations', () => {
	beforeEach(() => {
		vi.stubGlobal('indexedDB', new IDBFactory());
	});

	it('upgrades a version 1 library and preserves its legacy book', async () => {
		const buffer = new Uint8Array([0x50, 0x4b, 1, 2]).buffer;
		await createLegacyDatabase({ name: 'legacy.epub', buffer });

		const books = await getAllBooks();

		expect(books).toHaveLength(1);
		expect(books[0]).toMatchObject({ name: 'legacy.epub', title: 'legacy', cover: null });
		expect(await getBookById(books[0].id)).toMatchObject({ name: 'legacy.epub', buffer });
		expect(await getStoredValue('books', 'current-book')).toBeUndefined();
	});

	it('leaves an unrecognized legacy record intact for recovery', async () => {
		const malformed = { name: 'legacy.epub', recoveryNote: 'missing binary data' };
		await createLegacyDatabase(malformed);

		await expect(getAllBooks()).resolves.toEqual([malformed]);
		expect(await getStoredValue('books', 'current-book')).toEqual(malformed);
	});
});

describe('deleteBookById', () => {
	beforeEach(() => {
		vi.stubGlobal('indexedDB', new IDBFactory());
	});

	it('deletes metadata and raw EPUB bytes in one transaction', async () => {
		const id = await saveBook(new Uint8Array([1, 2, 3]).buffer, 'book.epub', 'Book', null);
		await saveAnnotation({
			bookId: id,
			kind: 'bookmark',
			location: { href: 'chapter-1.xhtml', progression: 0.5 }
		});

		await deleteBookById(id);

		expect(await getBookById(id)).toBeNull();
		expect(await getStoredValue('bookContents', id)).toBeUndefined();
		expect(await getBookAnnotations(id)).toEqual([]);
	});

	it('keeps both records when deletion cannot be prepared', async () => {
		const buffer = new Uint8Array([1, 2, 3]).buffer;
		const id = await saveBook(buffer, 'book.epub', 'Book', null);
		const originalDelete = IDBObjectStore.prototype.delete;
		const deleteSpy = vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (
			this: IDBObjectStore,
			key: IDBValidKey | IDBKeyRange
		) {
			if (this.name === 'bookContents') {
				throw new DOMException('Simulated content deletion failure', 'InvalidStateError');
			}

			return originalDelete.call(this, key);
		});

		await expect(deleteBookById(id)).rejects.toThrow('Simulated content deletion failure');
		deleteSpy.mockRestore();

		expect(await getBookById(id)).toMatchObject({ id, name: 'book.epub', title: 'Book' });
		expect(await getStoredValue('bookContents', id)).toEqual(buffer);
	});

	it('deletes multiple selected books and their annotations atomically', async () => {
		const first = await saveBook(new ArrayBuffer(2), 'first.epub', 'First', null);
		const second = await saveBook(new ArrayBuffer(2), 'second.epub', 'Second', null);
		await saveAnnotation({
			bookId: first,
			kind: 'bookmark',
			location: { href: 'one.xhtml', progression: 0.1 }
		});
		await saveAnnotation({
			bookId: second,
			kind: 'bookmark',
			location: { href: 'two.xhtml', progression: 0.2 }
		});

		await deleteBooksByIds([first, second]);

		expect(await getBookById(first)).toBeNull();
		expect(await getBookById(second)).toBeNull();
		expect(await getBookAnnotations(first)).toEqual([]);
		expect(await getBookAnnotations(second)).toEqual([]);
	});
});

describe('annotations', () => {
	beforeEach(() => {
		vi.stubGlobal('indexedDB', new IDBFactory());
	});

	it('persists portable bookmarks and highlights for a book', async () => {
		const bookmark = await saveAnnotation({
			bookId: 'book-1',
			kind: 'bookmark',
			location: { href: 'text/chapter.xhtml', progression: 0.375 }
		});
		const highlight = await saveAnnotation({
			bookId: 'book-1',
			kind: 'highlight',
			location: { href: 'text/chapter.xhtml', progression: 0.4 },
			selector: { exact: 'portable selected text', prefix: 'before ', suffix: ' after' }
		});

		const reloaded = await getBookAnnotations('book-1');
		expect(reloaded).toHaveLength(2);
		expect(reloaded).toEqual(expect.arrayContaining([bookmark, highlight]));
		expect(reloaded[0].location).not.toHaveProperty('page');
		expect(await getAllAnnotations()).toEqual(expect.arrayContaining([bookmark, highlight]));
	});

	it('rejects malformed highlights and supports deletion', async () => {
		await expect(
			saveAnnotation({
				bookId: 'book-1',
				kind: 'highlight',
				location: { href: 'chapter.xhtml', progression: 0.5 }
			})
		).rejects.toThrow('Invalid annotation');

		const bookmark = await saveAnnotation({
			bookId: 'book-1',
			kind: 'bookmark',
			location: { href: 'chapter.xhtml', progression: 0.5 }
		});
		await deleteAnnotation(bookmark.id);
		expect(await getBookAnnotations('book-1')).toEqual([]);
	});

	it('copies proxy-backed highlight fields into an IndexedDB-cloneable record', async () => {
		const location = new Proxy(
			{ href: 'text/chapter.xhtml', progression: 0.4 },
			{ get: (target, property, receiver) => Reflect.get(target, property, receiver) }
		);
		const selector = new Proxy(
			{ exact: 'selected text', prefix: 'before ', suffix: ' after' },
			{ get: (target, property, receiver) => Reflect.get(target, property, receiver) }
		);

		const saved = await saveAnnotation({
			bookId: 'book-1',
			kind: 'highlight',
			location,
			selector
		});

		expect(saved.location).not.toBe(location);
		expect(saved.selector).not.toBe(selector);
		expect(await getBookAnnotations('book-1')).toEqual([saved]);
	});

	it('does not expose invalid records read from storage', async () => {
		await saveAnnotation({
			bookId: 'book-1',
			kind: 'bookmark',
			location: { href: 'chapter.xhtml', progression: 0.5 }
		});
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('EpubReaderDB', 4);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		await new Promise<void>((resolve, reject) => {
			const transaction = db.transaction('annotations', 'readwrite');
			transaction.objectStore('annotations').add({ id: 'bad', bookId: 'book-1' });
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});

		expect(await getBookAnnotations('book-1')).toHaveLength(1);
	});
});

describe('updateBookProgress', () => {
	beforeEach(() => {
		vi.stubGlobal('indexedDB', new IDBFactory());
	});

	it('persists the semantic chapter position with legacy page progress', async () => {
		const id = await saveBook(new Uint8Array([1, 2, 3]).buffer, 'book.epub', 'Book', null);

		await updateBookProgress(id, 0.4, 2, 4, 20, 0.5);

		expect(await getBookById(id)).toMatchObject({
			progress: 0.4,
			currentChapter: 2,
			currentPage: 4,
			totalBookPages: 20,
			semanticProgression: 0.5
		});
	});
});

describe('restoreBookRecords', () => {
	beforeEach(() => {
		vi.stubGlobal('indexedDB', new IDBFactory());
	});

	it('restores books and annotations in one transaction', async () => {
		await restoreBookRecords(
			[
				{
					metadata: {
						id: 'restored-book',
						name: 'restored.epub',
						title: 'Restored Book',
						cover: null,
						createdAt: 1,
						progress: 0.5
					},
					buffer: new Uint8Array([0x50, 0x4b]).buffer
				}
			],
			[
				{
					formatVersion: 1,
					id: 'restored-annotation',
					bookId: 'restored-book',
					kind: 'bookmark',
					location: { href: 'chapter.xhtml', progression: 0.5 },
					createdAt: 1,
					updatedAt: 1
				}
			]
		);

		expect(await getBookById('restored-book')).toMatchObject({
			title: 'Restored Book',
			progress: 0.5
		});
		expect(await getBookAnnotations('restored-book')).toHaveLength(1);
	});

	it('rolls back every store when restoration setup fails', async () => {
		const originalPut = IDBObjectStore.prototype.put;
		const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
			this: IDBObjectStore,
			value: unknown,
			key?: IDBValidKey
		) {
			if (this.name === 'bookContents') {
				throw new DOMException('Simulated restore failure', 'InvalidStateError');
			}
			return originalPut.call(this, value, key);
		});

		await expect(
			restoreBookRecords(
				[
					{
						metadata: {
							id: 'rolled-back',
							name: 'book.epub',
							title: 'Rolled Back',
							cover: null,
							createdAt: 1
						},
						buffer: new Uint8Array([0x50, 0x4b]).buffer
					}
				],
				[]
			)
		).rejects.toThrow('Simulated restore failure');
		putSpy.mockRestore();

		expect(await getBookById('rolled-back')).toBeNull();
		expect(await getStoredValue('bookContents', 'rolled-back')).toBeUndefined();
	});
});
