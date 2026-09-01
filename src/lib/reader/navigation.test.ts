import { describe, expect, it } from 'vitest';

import { resolveInternalNavigation } from './navigation';

const chapters = [{ href: 'OEBPS/text/one.xhtml' }, { href: 'OEBPS/text/two.xhtml' }];

describe('internal EPUB navigation', () => {
	it('resolves cross-chapter links and decoded fragments', () => {
		expect(resolveInternalNavigation('OEBPS/text/two.xhtml#note%201', chapters)).toEqual({
			chapter: 1,
			fragment: 'note 1'
		});
	});

	it('resolves same-document links after the engine canonicalizes them', () => {
		expect(resolveInternalNavigation('OEBPS/text/one.xhtml#section', chapters)).toEqual({
			chapter: 0,
			fragment: 'section'
		});
	});

	it('rejects missing chapters and external schemes', () => {
		expect(resolveInternalNavigation('OEBPS/text/missing.xhtml#note', chapters)).toBeNull();
		expect(resolveInternalNavigation('https://example.com/book', chapters)).toBeNull();
		expect(resolveInternalNavigation('javascript:alert(1)', chapters)).toBeNull();
	});
});
