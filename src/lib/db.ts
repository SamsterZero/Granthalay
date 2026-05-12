const DB_NAME = 'EpubReaderDB';
const STORE_NAME = 'books';
const DB_VERSION = 3;

export interface BookMetadata {
	id: string;
	name: string;
	title: string;
	author?: string;
	description?: string;
	cover: string | Blob | null;
	createdAt: number;
	progress?: number;
	currentChapter?: number;
	currentPage?: number;
	totalBookPages?: number;
}

export interface BookRecord extends BookMetadata {
	buffer: ArrayBuffer;
}

function getDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			const oldVersion = event.oldVersion;

			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
			if (!db.objectStoreNames.contains('bookContents')) {
				db.createObjectStore('bookContents');
			}
			else if (oldVersion === 1) {
				// v1 store exists, no structural changes needed
				// Migration happens lazily in getAllBooks
			}
		};
	});
}

let migrationDone = false;

async function migrateOldBook(): Promise<void> {
	if (migrationDone) return;

	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		const getOld = store.get('current-book');
		getOld.onsuccess = () => {
			const old = getOld.result;
			if (old && old.buffer) {
				const record: BookRecord = {
					id: crypto.randomUUID(),
					name: old.name,
					title: old.name.replace(/\.epub$/i, '').replace(/[_-]/g, ' '),
					cover: null,
					buffer: old.buffer,
					createdAt: Date.now()
				};
				store.put(record, record.id);
				store.delete('current-book');
			}
			migrationDone = true;
			resolve();
		};
		getOld.onerror = () => {
			migrationDone = true;
			reject(getOld.error);
		};
	});
}

export async function saveBook(
	buffer: ArrayBuffer,
	name: string,
	title: string,
	cover: string | Blob | null
): Promise<string> {
	await migrateOldBook();

	const db = await getDB();
	const id = crypto.randomUUID();
	
	const metadata: BookMetadata = {
		id,
		name,
		title,
		cover,
		createdAt: Date.now()
	};

	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME, 'bookContents'], 'readwrite');
		const metaStore = transaction.objectStore(STORE_NAME);
		const contentStore = transaction.objectStore('bookContents');
		
		metaStore.put(metadata, id);
		contentStore.put(buffer, id);

		transaction.oncomplete = () => resolve(id);
		transaction.onerror = () => reject(transaction.error);
	});
}

export async function getAllBooks(): Promise<BookMetadata[]> {
	await migrateOldBook();

	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.getAll();
		request.onsuccess = () => {
			const results = request.result as BookMetadata[];
			resolve(results.sort((a, b) => b.createdAt - a.createdAt));
		};
		request.onerror = () => reject(request.error);
	});
}

export async function getBookById(id: string): Promise<BookRecord | null> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([STORE_NAME, 'bookContents'], 'readonly');
		const metaStore = transaction.objectStore(STORE_NAME);
		const contentStore = transaction.objectStore('bookContents');

		const getMeta = metaStore.get(id);
		const getContent = contentStore.get(id);

		transaction.oncomplete = () => {
			if (!getMeta.result) {
				resolve(null);
			} else {
				resolve({
					...getMeta.result,
					buffer: getContent.result
				});
			}
		};
		transaction.onerror = () => reject(transaction.error);
	});
}

export async function deleteBookById(id: string): Promise<void> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.delete(id);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export async function updateBookProgress(
	id: string, 
	progress: number, 
	currentChapter?: number, 
	currentPage?: number,
	totalBookPages?: number
): Promise<void> {
	if (id === 'default') {
		localStorage.setItem('book-progress-default', JSON.stringify({ progress, currentChapter, currentPage, totalBookPages }));
		return;
	}

	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const getRequest = store.get(id);

		getRequest.onsuccess = () => {
			const record = getRequest.result as BookRecord;
			if (record) {
				record.progress = progress;
				if (currentChapter !== undefined) record.currentChapter = currentChapter;
				if (currentPage !== undefined) record.currentPage = currentPage;
				if (totalBookPages !== undefined) record.totalBookPages = totalBookPages;
				const putRequest = store.put(record, id);
				putRequest.onsuccess = () => resolve();
				putRequest.onerror = () => reject(putRequest.error);
			} else {
				resolve();
			}
		};
		getRequest.onerror = () => reject(getRequest.error);
	});
}

/** @deprecated Kept for backward compat with reader page during transition */
export async function getBook(): Promise<{ buffer: ArrayBuffer; name: string } | null> {
	await migrateOldBook();
	const books = await getAllBooks();
	if (books.length > 0) {
		const fullBook = await getBookById(books[0].id);
		if (fullBook) {
			return { buffer: fullBook.buffer, name: fullBook.name };
		}
	}
	return null;
}

/** @deprecated */
export async function deleteBook(): Promise<void> {
	const books = await getAllBooks();
	if (books.length > 0) {
		await deleteBookById(books[0].id);
	}
}
