import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteBookById, getBookById, saveBook } from './db';

function getStoredValue(storeName: string, id: string): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const openRequest = indexedDB.open('EpubReaderDB', 3);
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

		await deleteBookById(id);

		expect(await getBookById(id)).toBeNull();
		expect(await getStoredValue('bookContents', id)).toBeUndefined();
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
