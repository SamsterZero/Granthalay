import type { EpubChapter } from '$lib/epub/engine';
import {
	readerMarginPixels,
	supportsTypographyOverrides,
	type ReaderPreferences
} from '$lib/reader/preferences';

export async function measureChapterPageCounts(
	chapters: EpubChapter[],
	width: number,
	preferences: ReaderPreferences
): Promise<number[]> {
	const measure = createMeasurementElement(width, preferences);
	const counts: number[] = [];

	try {
		for (let index = 0; index < chapters.length; index++) {
			const chapter = chapters[index];
			if (isSinglePageChapter(chapter)) {
				counts.push(1);
				continue;
			}

			applyTypography(measure, chapter, preferences);
			measure.innerHTML = chapter.content;
			counts.push(Math.max(1, Math.ceil(measure.scrollWidth / width)));
			if (index % 5 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
		}
	} finally {
		measure.remove();
	}

	return counts;
}

function createMeasurementElement(width: number, preferences: ReaderPreferences) {
	const element = document.createElement('div');
	const padding = readerMarginPixels(preferences.margins);
	element.className = 'prose prose-lg max-w-none';
	element.style.width = `${width}px`;
	element.style.columnWidth = `${width - padding * 2}px`;
	element.style.columnGap = `${padding * 2}px`;
	element.style.columnFill = 'auto';
	element.style.position = 'fixed';
	element.style.left = '-9999px';
	element.style.visibility = 'hidden';
	element.style.maxHeight = 'calc(100vh - 160px)';
	document.body.appendChild(element);
	return element;
}

function isSinglePageChapter(chapter: EpubChapter) {
	return (
		chapter.isCover ||
		chapter.content.includes('epub-illustrated-page') ||
		(chapter.content.length < 1000 && chapter.content.includes('<img'))
	);
}

function applyTypography(
	element: HTMLElement,
	chapter: EpubChapter,
	preferences: ReaderPreferences
) {
	const allowed = supportsTypographyOverrides(chapter);
	element.style.fontSize =
		allowed && preferences.fontScale !== 1 ? `${preferences.fontScale * 100}%` : '';
	element.style.lineHeight =
		allowed && preferences.lineHeight ? String(preferences.lineHeight) : '';
	element.style.textAlign =
		allowed && preferences.alignment !== 'publisher' ? preferences.alignment : '';
}
