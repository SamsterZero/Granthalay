export type ReaderTheme = 'system' | 'light' | 'dark';
export type ReaderMargins = 'narrow' | 'standard' | 'wide';
export type ReaderAlignment = 'publisher' | 'left' | 'justify';

export interface ReaderPreferences {
	fontScale: number | null;
	lineHeight: number | null;
	margins: ReaderMargins;
	alignment: ReaderAlignment;
	theme: ReaderTheme;
}

export const READER_PREFERENCES_KEY = 'reader-preferences-v1';
export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
	fontScale: null,
	lineHeight: null,
	margins: 'standard',
	alignment: 'publisher',
	theme: 'system'
};

function finiteOrNull(value: unknown, minimum: number, maximum: number): number | null {
	return typeof value === 'number' && Number.isFinite(value)
		? Math.min(maximum, Math.max(minimum, value))
		: null;
}

export function parseReaderPreferences(value: string | null): ReaderPreferences {
	if (!value) return { ...DEFAULT_READER_PREFERENCES };

	try {
		const parsed = JSON.parse(value) as Partial<ReaderPreferences>;
		return {
			fontScale: finiteOrNull(parsed.fontScale, 0.8, 1.6),
			lineHeight: finiteOrNull(parsed.lineHeight, 1.2, 2.2),
			margins: ['narrow', 'standard', 'wide'].includes(parsed.margins ?? '')
				? (parsed.margins as ReaderMargins)
				: 'standard',
			alignment: ['publisher', 'left', 'justify'].includes(parsed.alignment ?? '')
				? (parsed.alignment as ReaderAlignment)
				: 'publisher',
			theme: ['system', 'light', 'dark'].includes(parsed.theme ?? '')
				? (parsed.theme as ReaderTheme)
				: 'system'
		};
	} catch {
		return { ...DEFAULT_READER_PREFERENCES };
	}
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
