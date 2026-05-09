const DB_NAME = 'EpubReaderDB';
const STORE_NAME = 'books';
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
	});
}

export async function saveBook(buffer: ArrayBuffer, name: string): Promise<void> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		
		const request = store.put({ buffer, name }, 'current-book');
		
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function getBook(): Promise<{ buffer: ArrayBuffer; name: string } | null> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		
		const request = store.get('current-book');
		
		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(request.error);
	});
}

export async function deleteBook(): Promise<void> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		
		const request = store.delete('current-book');
		
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}
