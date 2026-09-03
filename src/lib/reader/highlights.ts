import type { BookAnnotation, NewBookAnnotation, TextQuoteSelector } from './annotations';

const CONTEXT_LENGTH = 32;

interface TextSegment {
	node: Text;
	start: number;
	end: number;
}

function textSegments(root: HTMLElement): TextSegment[] {
	const document = root.ownerDocument;
	const walker = document.createTreeWalker(root, document.defaultView?.NodeFilter.SHOW_TEXT ?? 4);
	const segments: TextSegment[] = [];
	let offset = 0;
	let node = walker.nextNode();
	while (node) {
		const text = node as Text;
		const length = text.data.length;
		segments.push({ node: text, start: offset, end: offset + length });
		offset += length;
		node = walker.nextNode();
	}
	return segments;
}

function rangeOffsets(root: HTMLElement, range: Range): { start: number; end: number } | null {
	if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
	const document = root.ownerDocument;
	const beforeStart = document.createRange();
	beforeStart.selectNodeContents(root);
	beforeStart.setEnd(range.startContainer, range.startOffset);
	const beforeEnd = document.createRange();
	beforeEnd.selectNodeContents(root);
	beforeEnd.setEnd(range.endContainer, range.endOffset);
	return { start: beforeStart.toString().length, end: beforeEnd.toString().length };
}

export function captureHighlight(
	root: HTMLElement,
	selection: Selection | null,
	bookId: string,
	href: string
): NewBookAnnotation | null {
	if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
	const range = selection.getRangeAt(0);
	const offsets = rangeOffsets(root, range);
	if (!offsets || offsets.end <= offsets.start) return null;

	const fullText = root.textContent ?? '';
	const exact = fullText.slice(offsets.start, offsets.end);
	if (!exact.trim()) return null;
	const selector: TextQuoteSelector = {
		exact,
		prefix: fullText.slice(Math.max(0, offsets.start - CONTEXT_LENGTH), offsets.start),
		suffix: fullText.slice(offsets.end, offsets.end + CONTEXT_LENGTH)
	};

	return {
		bookId,
		kind: 'highlight',
		location: {
			href,
			progression: fullText.length > 0 ? offsets.start / fullText.length : 0
		},
		selector
	};
}

export function findQuoteOffset(
	text: string,
	selector: TextQuoteSelector,
	progression: number
): number | null {
	if (!selector.exact) return null;
	const matches: number[] = [];
	let offset = text.indexOf(selector.exact);
	while (offset !== -1) {
		matches.push(offset);
		offset = text.indexOf(selector.exact, offset + Math.max(1, selector.exact.length));
	}
	if (matches.length === 0) return null;

	const contextual = matches.filter((match) => {
		const prefixMatches = !selector.prefix || text.slice(0, match).endsWith(selector.prefix);
		const suffixMatches =
			!selector.suffix || text.slice(match + selector.exact.length).startsWith(selector.suffix);
		return prefixMatches && suffixMatches;
	});
	const candidates = contextual.length > 0 ? contextual : matches;
	const expected = Math.max(0, Math.min(1, progression)) * text.length;
	return candidates.reduce((nearest, candidate) =>
		Math.abs(candidate - expected) < Math.abs(nearest - expected) ? candidate : nearest
	);
}

export function clearRenderedHighlights(root: HTMLElement): void {
	for (const mark of root.querySelectorAll<HTMLElement>('mark[data-annotation-id]')) {
		mark.replaceWith(...Array.from(mark.childNodes));
	}
	root.normalize();
}

export function renderHighlights(root: HTMLElement, annotations: BookAnnotation[]): string[] {
	clearRenderedHighlights(root);
	const unresolved: string[] = [];
	const fullText = root.textContent ?? '';

	for (const annotation of annotations) {
		if (annotation.kind !== 'highlight' || !annotation.selector) continue;
		const start = findQuoteOffset(fullText, annotation.selector, annotation.location.progression);
		if (start === null) {
			unresolved.push(annotation.id);
			continue;
		}
		const end = start + annotation.selector.exact.length;
		const matchingSegments = textSegments(root)
			.filter((segment) => segment.end > start && segment.start < end)
			.reverse();

		for (const segment of matchingSegments) {
			const range = root.ownerDocument.createRange();
			range.setStart(segment.node, Math.max(0, start - segment.start));
			range.setEnd(segment.node, Math.min(segment.node.data.length, end - segment.start));
			const mark = root.ownerDocument.createElement('mark');
			mark.dataset.annotationId = annotation.id;
			mark.className = 'reader-highlight';
			range.surroundContents(mark);
		}
	}

	return unresolved;
}
