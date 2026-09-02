export type ReaderTheme = 'system' | 'light' | 'dark';
export type ReaderMargins = 'narrow' | 'standard' | 'wide';
export type ReaderAlignment = 'publisher' | 'left' | 'justify';
export type ReaderNavigation = 'rtl' | 'ltr' | 'scroll';

export interface ReaderPreferences {
	fontScale: number;
	lineHeight: number | null;
	margins: ReaderMargins;
	alignment: ReaderAlignment;
	theme: ReaderTheme;
	navigation: ReaderNavigation;
}

export const READER_PREFERENCES_KEY = 'reader-preferences-v1';
const BOOK_READER_PREFERENCES_PREFIX = `${READER_PREFERENCES_KEY}:book:`;
export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
	fontScale: 1,
	lineHeight: null,
	margins: 'standard',
	alignment: 'publisher',
	theme: 'system',
	navigation: 'rtl'
};

function finiteOrNull(value: unknown, minimum: number, maximum: number): number | null {
	return typeof value === 'number' && Number.isFinite(value)
		? Math.min(maximum, Math.max(minimum, value))
		: null;
}

function finiteOrDefault(
	value: unknown,
	minimum: number,
	maximum: number,
	fallback: number
): number {
	return finiteOrNull(value, minimum, maximum) ?? fallback;
}

export function parseReaderPreferences(value: string | null): ReaderPreferences {
	if (!value) return { ...DEFAULT_READER_PREFERENCES };

	try {
		const parsed = JSON.parse(value) as Partial<ReaderPreferences>;
		return {
			fontScale: finiteOrDefault(parsed.fontScale, 0.8, 1.6, 1),
			lineHeight: finiteOrNull(parsed.lineHeight, 1.2, 2.2),
			margins: ['narrow', 'standard', 'wide'].includes(parsed.margins ?? '')
				? (parsed.margins as ReaderMargins)
				: 'standard',
			alignment: ['publisher', 'left', 'justify'].includes(parsed.alignment ?? '')
				? (parsed.alignment as ReaderAlignment)
				: 'publisher',
			theme: ['system', 'light', 'dark'].includes(parsed.theme ?? '')
				? (parsed.theme as ReaderTheme)
				: 'system',
			navigation: ['rtl', 'ltr', 'scroll'].includes(parsed.navigation ?? '')
				? (parsed.navigation as ReaderNavigation)
				: 'rtl'
		};
	} catch {
		return { ...DEFAULT_READER_PREFERENCES };
	}
}

export function readerPreferencesKey(bookId: string): string {
	return `${BOOK_READER_PREFERENCES_PREFIX}${bookId}`;
}

export function loadGlobalReaderPreferences(): ReaderPreferences {
	return parseReaderPreferences(localStorage.getItem(READER_PREFERENCES_KEY));
}

export function loadBookReaderPreferences(bookId: string): ReaderPreferences {
	const stored = localStorage.getItem(readerPreferencesKey(bookId));
	return stored === null ? loadGlobalReaderPreferences() : parseReaderPreferences(stored);
}

export function readerMarginPixels(margins: ReaderMargins): number {
	return margins === 'narrow' ? 16 : margins === 'wide' ? 48 : 32;
}

export function supportsTypographyOverrides(chapter: {
	content: string;
	isCover?: boolean;
}): boolean {
	if (chapter.isCover || chapter.content.includes('epub-illustrated-page')) return false;
	if (/<svg\b/i.test(chapter.content)) return false;
	return !(chapter.content.length < 1000 && /<img\b/i.test(chapter.content));
}
