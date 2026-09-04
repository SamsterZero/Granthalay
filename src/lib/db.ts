import {
	ANNOTATION_FORMAT_VERSION,
	isBookAnnotation,
	type BookAnnotation,
	type NewBookAnnotation
} from '$lib/reader/annotations';

const DB_NAME = 'EpubReaderDB';
const STORE_NAME = 'books';
const ANNOTATION_STORE_NAME = 'annotations';
const DB_VERSION = 4;

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
	semanticProgression?: number;
}

export interface BookRecord extends BookMetadata {
	buffer: ArrayBuffer;
}

export interface RestoredBookRecord {
	metadata: BookMetadata;
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
			} else if (oldVersion === 1) {
				// v1 store exists, no structural changes needed
				// Migration happens lazily in getAllBooks
			}
			if (!db.objectStoreNames.contains(ANNOTATION_STORE_NAME)) {
				const annotations = db.createObjectStore(ANNOTATION_STORE_NAME, { keyPath: 'id' });
				annotations.createIndex('bookId', 'bookId', { unique: false });
			}
		};
	});
}

let migratedFactory: IDBFactory | null = null;

async function migrateOldBook(): Promise<void> {
	if (migratedFactory === indexedDB) return;

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
			migratedFactory = indexedDB;
			resolve();
		};
		getOld.onerror = () => {
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
		const transaction = db.transaction(
			[STORE_NAME, 'bookContents', ANNOTATION_STORE_NAME],
			'readwrite'
		);
		let setupError: unknown;

		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () =>
			reject(
				setupError ?? transaction.error ?? new DOMException('Book deletion aborted', 'AbortError')
			);

		try {
			transaction.objectStore(STORE_NAME).delete(id);
			transaction.objectStore('bookContents').delete(id);
			const annotationStore = transaction.objectStore(ANNOTATION_STORE_NAME);
			annotationStore.index('bookId').getAllKeys(id).onsuccess = (event) => {
				const keys = (event.target as IDBRequest<IDBValidKey[]>).result;
				for (const key of keys) annotationStore.delete(key);
			};
		} catch (error) {
			setupError = error;
			transaction.abort();
		}
	});
}

export async function restoreBookRecords(
	books: RestoredBookRecord[],
	annotations: BookAnnotation[]
): Promise<void> {
	if (books.length === 0) return;
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(
			[STORE_NAME, 'bookContents', ANNOTATION_STORE_NAME],
			'readwrite'
		);
		const metadataStore = transaction.objectStore(STORE_NAME);
		const contentStore = transaction.objectStore('bookContents');
		const annotationStore = transaction.objectStore(ANNOTATION_STORE_NAME);
		let setupError: unknown;
		let requestError: DOMException | null = null;
		const rememberRequestError = (request: IDBRequest) => {
			request.addEventListener('error', () => {
				requestError ??= request.error;
			});
			return request;
		};

		transaction.oncomplete = () => resolve();
		transaction.onerror = () => {
			requestError ??= transaction.error;
		};
		transaction.onabort = () =>
			reject(
				setupError ??
					requestError ??
					transaction.error ??
					new DOMException('Backup restore aborted', 'AbortError')
			);

		try {
			for (const book of books) {
				rememberRequestError(metadataStore.put(book.metadata, book.metadata.id));
				rememberRequestError(contentStore.put(book.buffer, book.metadata.id));
			}

			let pendingDeletes = books.length;
			for (const book of books) {
				const request = rememberRequestError(
					annotationStore.index('bookId').getAllKeys(book.metadata.id)
				) as IDBRequest<IDBValidKey[]>;
				request.onsuccess = () => {
					try {
						for (const key of request.result) rememberRequestError(annotationStore.delete(key));
						pendingDeletes -= 1;
						if (pendingDeletes === 0) {
							for (const annotation of annotations) {
								rememberRequestError(annotationStore.add(annotation));
							}
						}
					} catch (error) {
						setupError = error;
						transaction.abort();
					}
				};
			}
		} catch (error) {
			setupError = error;
			transaction.abort();
		}
	});
}

export async function saveAnnotation(input: NewBookAnnotation): Promise<BookAnnotation> {
	const now = Date.now();
	const annotation: BookAnnotation = {
		formatVersion: ANNOTATION_FORMAT_VERSION,
		id: crypto.randomUUID(),
		bookId: input.bookId,
		kind: input.kind,
		location: {
			href: input.location.href,
			progression: input.location.progression
		},
		...(input.selector
			? {
					selector: {
						exact: input.selector.exact,
						...(input.selector.prefix !== undefined ? { prefix: input.selector.prefix } : {}),
						...(input.selector.suffix !== undefined ? { suffix: input.selector.suffix } : {})
					}
				}
			: {}),
		createdAt: now,
		updatedAt: now
	};
	if (!isBookAnnotation(annotation)) throw new TypeError('Invalid annotation');

	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(ANNOTATION_STORE_NAME, 'readwrite');
		transaction.objectStore(ANNOTATION_STORE_NAME).add(annotation);
		transaction.oncomplete = () => resolve(annotation);
		transaction.onerror = () => reject(transaction.error);
	});
}

export async function getBookAnnotations(bookId: string): Promise<BookAnnotation[]> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(ANNOTATION_STORE_NAME, 'readonly');
		const request = transaction.objectStore(ANNOTATION_STORE_NAME).index('bookId').getAll(bookId);
		request.onsuccess = () =>
			resolve(
				(request.result as unknown[])
					.filter(isBookAnnotation)
					.sort((a, b) => a.createdAt - b.createdAt)
			);
		request.onerror = () => reject(request.error);
	});
}

export async function getAllAnnotations(): Promise<BookAnnotation[]> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(ANNOTATION_STORE_NAME, 'readonly');
		const request = transaction.objectStore(ANNOTATION_STORE_NAME).getAll();
		request.onsuccess = () =>
			resolve(
				(request.result as unknown[])
					.filter(isBookAnnotation)
					.sort((a, b) => b.updatedAt - a.updatedAt)
			);
		request.onerror = () => reject(request.error);
	});
}

export async function deleteAnnotation(id: string): Promise<void> {
	const db = await getDB();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(ANNOTATION_STORE_NAME, 'readwrite');
		transaction.objectStore(ANNOTATION_STORE_NAME).delete(id);
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
	});
}

export async function updateBookProgress(
	id: string,
	progress: number,
	currentChapter?: number,
	currentPage?: number,
	totalBookPages?: number,
	semanticProgression?: number
): Promise<void> {
	if (id === 'default') {
		localStorage.setItem(
			'book-progress-default',
			JSON.stringify({
				progress,
				currentChapter,
				currentPage,
				totalBookPages,
				semanticProgression
			})
		);
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
				if (semanticProgression !== undefined) {
					record.semanticProgression = semanticProgression;
				}
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
