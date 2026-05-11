const DB_NAME = 'EpubReaderDB';
const STORE_NAME = 'books';
const DB_VERSION = 2;

export interface BookRecord {
	id: string;
	name: string;
	title: string;
	cover: string | null;
	buffer: ArrayBuffer;
	createdAt: number;
	progress?: number; // 0 to 1
	currentChapter?: number;
	currentPage?: number;
	totalBookPages?: number;
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
			} else if (oldVersion === 1) {
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
	cover: string | null
): Promise<string> {
	await migrateOldBook();

	const db = await getDB();
	const id = crypto.randomUUID();
	const record: BookRecord = {
		id,
		name,
		title,
		cover,
		buffer,
		createdAt: Date.now()
	};

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.put(record, id);
		request.onsuccess = () => resolve(id);
		request.onerror = () => reject(request.error);
	});
}

export async function getAllBooks(): Promise<BookRecord[]> {
	await migrateOldBook();

	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const books: BookRecord[] = [];

		const request = store.openCursor();
		request.onsuccess = () => {
			const cursor = request.result;
			if (cursor) {
				const value = cursor.value as BookRecord;
				// Filter: must have id and buffer (skip old entries without these)
				if (value && value.id && value.buffer) {
					books.push(value);
				}
				cursor.continue();
			} else {
				books.sort((a, b) => b.createdAt - a.createdAt);
				resolve(books);
			}
		};
		request.onerror = () => reject(request.error);
	});
}

export async function getBookById(id: string): Promise<BookRecord | null> {
	if (id === 'default') return null;

	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.get(id);
		request.onsuccess = () => resolve(request.result || null);
		request.onerror = () => reject(request.error);
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
		return { buffer: books[0].buffer, name: books[0].name };
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
