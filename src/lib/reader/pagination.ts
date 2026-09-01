export interface SemanticLocation {
	chapter: number;
	progression: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

export function pageToProgression(page: number, totalPages: number): number {
	if (!Number.isFinite(page) || !Number.isFinite(totalPages) || totalPages <= 1) return 0;
	return clamp(page / (totalPages - 1), 0, 1);
}

export function progressionToPage(progression: number, totalPages: number): number {
	if (!Number.isFinite(progression) || !Number.isFinite(totalPages) || totalPages <= 1) return 0;
	return Math.round(clamp(progression, 0, 1) * (totalPages - 1));
}

export function repaginatePage(
	page: number,
	previousTotalPages: number,
	nextTotalPages: number
): number {
	return progressionToPage(pageToProgression(page, previousTotalPages), nextTotalPages);
}

export function normalizeLocation(
	location: Partial<SemanticLocation> | null | undefined,
	chapterCount: number
): SemanticLocation {
	const normalizedChapterCount = Number.isFinite(chapterCount)
		? Math.max(0, Math.floor(chapterCount))
		: 0;
	const lastChapter = Math.max(0, normalizedChapterCount - 1);
	const chapter = Number.isFinite(location?.chapter)
		? clamp(Math.floor(location!.chapter!), 0, lastChapter)
		: 0;
	const progression = Number.isFinite(location?.progression)
		? clamp(location!.progression!, 0, 1)
		: 0;

	return { chapter, progression };
}
