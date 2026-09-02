import { getBookById, type BookRecord } from '$lib/db';
import { EpubEngine, type EpubChapter } from '$lib/epub/engine';
import { normalizeLocation } from '$lib/reader/pagination';

export interface LoadedReaderBook {
	chapters: EpubChapter[];
	title: string;
	currentChapter: number;
	currentPage: number;
	initialProgression: number | null;
}

export async function loadReaderBook(
	params: URLSearchParams,
	defaultBookUrl: string
): Promise<LoadedReaderBook> {
	const bookId = params.get('bookId') || 'default';
	const chapterParam = params.get('chapter');
	const pageParam = params.get('page');
	let targetChapter = chapterParam ? parseInt(chapterParam, 10) : 0;
	let targetPage = pageParam ? parseInt(pageParam, 10) : 0;
	let storedRecord: Partial<BookRecord> | null = null;
	let arrayBuffer: ArrayBuffer;

	if (bookId === 'default') {
		const response = await fetch(defaultBookUrl);
		if (!response.ok) throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
		arrayBuffer = await response.arrayBuffer();
		if (!chapterParam) storedRecord = readDefaultProgress();
	} else {
		const book = await getBookById(bookId);
		if (!book) throw new Error('Book not found in library');
		arrayBuffer = book.buffer;
		if (!chapterParam) storedRecord = book;
	}

	if (storedRecord?.currentChapter !== undefined) targetChapter = storedRecord.currentChapter;
	if (storedRecord?.currentPage !== undefined) targetPage = storedRecord.currentPage;
	const initialProgression = storedRecord?.semanticProgression ?? null;

	const engine = new EpubEngine(arrayBuffer);
	const spineInfos = await engine.init();
	const chapters = spineInfos ? await engine.parseChapters(spineInfos) : [];
	if (chapters.length === 0) throw new Error('No readable content found in EPUB');

	const savedLocation = normalizeLocation(
		{ chapter: targetChapter, progression: initialProgression ?? 0 },
		chapters.length
	);

	return {
		chapters,
		title: engine.metadata.title || 'Unknown Book',
		currentChapter: savedLocation.chapter,
		currentPage: Number.isFinite(targetPage) ? Math.max(0, Math.floor(targetPage)) : 0,
		initialProgression
	};
}

function readDefaultProgress(): Partial<BookRecord> | null {
	const stored = localStorage.getItem('book-progress-default');
	if (!stored) return null;
	try {
		return JSON.parse(stored);
	} catch {
		return null;
	}
}
