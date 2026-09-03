import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	deleteAnnotation,
	deleteBookById,
	getBookAnnotations,
	getBookById,
	saveAnnotation,
	saveBook,
	updateBookProgress
} from './db';

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
		expect(reloaded).toEqual([bookmark, highlight]);
		expect(reloaded[0].location).not.toHaveProperty('page');
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
