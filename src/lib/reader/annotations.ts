export const ANNOTATION_FORMAT_VERSION = 1 as const;

export type AnnotationKind = 'bookmark' | 'highlight';

export interface AnnotationLocation {
	/** Stable EPUB spine resource identifier, independent of screen pagination. */
	href: string;
	/** Normalized position within the spine resource. */
	progression: number;
}

export interface TextQuoteSelector {
	exact: string;
	prefix?: string;
	suffix?: string;
}

export interface BookAnnotation {
	formatVersion: typeof ANNOTATION_FORMAT_VERSION;
	id: string;
	bookId: string;
	kind: AnnotationKind;
	location: AnnotationLocation;
	selector?: TextQuoteSelector;
	createdAt: number;
	updatedAt: number;
}

export type NewBookAnnotation = Omit<
	BookAnnotation,
	'formatVersion' | 'id' | 'createdAt' | 'updatedAt'
>;

export function isBookAnnotation(value: unknown): value is BookAnnotation {
	if (!value || typeof value !== 'object') return false;
	const annotation = value as Partial<BookAnnotation>;
	if (
		annotation.formatVersion !== ANNOTATION_FORMAT_VERSION ||
		typeof annotation.id !== 'string' ||
		!annotation.id ||
		typeof annotation.bookId !== 'string' ||
		!annotation.bookId ||
		(annotation.kind !== 'bookmark' && annotation.kind !== 'highlight') ||
		!annotation.location ||
		typeof annotation.location.href !== 'string' ||
		!Number.isFinite(annotation.location.progression) ||
		annotation.location.progression < 0 ||
		annotation.location.progression > 1 ||
		!Number.isFinite(annotation.createdAt) ||
		!Number.isFinite(annotation.updatedAt)
	) {
		return false;
	}

	if (annotation.kind === 'highlight') {
		return Boolean(
			annotation.selector &&
			typeof annotation.selector.exact === 'string' &&
			annotation.selector.exact.trim()
		);
	}

	return annotation.selector === undefined;
}
