/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';

import type { BookAnnotation } from './annotations';
import { captureHighlight, findQuoteOffset, renderHighlights } from './highlights';

function selectText(root: HTMLElement, textNode: Text, start: number, end: number): Selection {
	const selection = window.getSelection()!;
	const range = document.createRange();
	range.setStart(textNode, start);
	range.setEnd(textNode, end);
	selection.removeAllRanges();
	selection.addRange(range);
	return selection;
}

describe('highlight anchoring', () => {
	it('captures exact text, context, and a layout-independent progression', () => {
		const root = document.createElement('div');
		root.innerHTML = '<p>Before selected words after.</p>';
		document.body.append(root);
		const text = root.querySelector('p')!.firstChild as Text;

		const highlight = captureHighlight(root, selectText(root, text, 7, 21), 'book-1', 'c1.xhtml');

		expect(highlight).toMatchObject({
			bookId: 'book-1',
			kind: 'highlight',
			location: { href: 'c1.xhtml' },
			selector: { exact: 'selected words', prefix: 'Before ', suffix: ' after.' }
		});
		expect(highlight!.location.progression).toBeCloseTo(7 / 28);
	});

	it('rejects collapsed and out-of-reader selections', () => {
		const root = document.createElement('div');
		const outside = document.createTextNode('outside');
		document.body.append(outside);
		expect(captureHighlight(root, selectText(root, outside, 0, 4), 'book', 'c1')).toBeNull();
		const selection = selectText(root, outside, 2, 2);
		expect(captureHighlight(root, selection, 'book', 'c1')).toBeNull();
	});

	it('uses context, then progression, to disambiguate repeated text', () => {
		const text = 'first repeat middle repeat last';
		expect(findQuoteOffset(text, { exact: 'repeat', prefix: 'middle ' }, 0)).toBe(20);
		expect(findQuoteOffset(text, { exact: 'repeat' }, 0.8)).toBe(20);
	});

	it('restores a highlight spanning elements and reports missing quotes', () => {
		const root = document.createElement('div');
		root.innerHTML = '<p>Some <em>selected</em> words.</p>';
		const annotations: BookAnnotation[] = [
			{
				formatVersion: 1,
				id: 'found',
				bookId: 'book',
				kind: 'highlight',
				location: { href: 'c1', progression: 0.2 },
				selector: { exact: 'selected words' },
				createdAt: 1,
				updatedAt: 1
			},
			{
				formatVersion: 1,
				id: 'missing',
				bookId: 'book',
				kind: 'highlight',
				location: { href: 'c1', progression: 0 },
				selector: { exact: 'not present' },
				createdAt: 2,
				updatedAt: 2
			}
		];

		expect(renderHighlights(root, annotations)).toEqual(['missing']);
		expect(root.querySelectorAll('mark[data-annotation-id="found"]')).toHaveLength(2);
		expect(root.textContent).toBe('Some selected words.');
		expect(renderHighlights(root, annotations)).toEqual(['missing']);
	});

	it('restores the same quote after the reader DOM is rebuilt for repagination', () => {
		const annotation: BookAnnotation = {
			formatVersion: 1,
			id: 'stable',
			bookId: 'book',
			kind: 'highlight',
			location: { href: 'c1', progression: 0.25 },
			selector: { exact: 'stable selection', prefix: 'A ', suffix: ' remains.' },
			createdAt: 1,
			updatedAt: 1
		};
		const root = document.createElement('div');
		root.innerHTML = '<p>A stable selection remains.</p>';
		renderHighlights(root, [annotation]);
		expect(root.querySelector('mark')?.textContent).toBe('stable selection');

		root.innerHTML = '<p>A <span>stable selection</span> remains.</p>';
		expect(renderHighlights(root, [annotation])).toEqual([]);
		expect(root.querySelector('mark')?.textContent).toBe('stable selection');
	});
});
