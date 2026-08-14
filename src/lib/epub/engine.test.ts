// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EpubEngine } from './engine';
import {
	createEpub2Fixture,
	createEpub3Fixture,
	createMalformedEpubFixture
} from './testing/fixtures';

describe('EpubEngine fixtures', () => {
	beforeEach(() => {
		let objectUrlId = 0;
		vi.stubGlobal(
			'URL',
			Object.assign(URL, {
				createObjectURL: vi.fn(() => `blob:fixture-${++objectUrlId}`),
				revokeObjectURL: vi.fn()
			})
		);
	});

	it('parses an EPUB 2 package with NCX navigation, spine, guide, CSS, and cover image', async () => {
		const engine = new EpubEngine(await createEpub2Fixture());
		const spine = await engine.init();
		const chapters = await engine.parseChapters(spine ?? []);

		expect(engine.metadata).toMatchObject({
			title: 'Minimal EPUB 2',
			author: 'Granthalay'
		});
		expect(engine.metadata.cover).toBeInstanceOf(Blob);
		expect(spine).toMatchObject([
			{ href: 'cover.xhtml', mediaType: 'application/xhtml+xml', linear: true },
			{ href: 'text/chapter-one.xhtml', mediaType: 'application/xhtml+xml', linear: true },
			{ href: 'text/chapter-two.xhtml', mediaType: 'application/xhtml+xml', linear: true }
		]);
		expect(chapters.map(({ title }) => title)).toEqual(['Cover', 'Chapter One', 'Chapter Two']);
		expect(chapters[0]).toMatchObject({ isCover: true, isFrontmatter: true });
		expect(chapters[0].content).toContain('blob:fixture-');
		expect(chapters[1].css).toContain('.epub-content h1');

		engine.destroy();
		expect(URL.revokeObjectURL).toHaveBeenCalled();
	});

	it('parses EPUB 3 navigation and resolves HTML, CSS, image, and SVG resources', async () => {
		const engine = new EpubEngine(await createEpub3Fixture());
		const spine = await engine.init();
		const chapters = await engine.parseChapters(spine ?? []);

		expect(engine.metadata.title).toBe('Minimal EPUB 3');
		expect(chapters.map(({ title }) => title)).toEqual(['Introduction', 'Illustration']);
		expect(chapters[0].content).toContain('src="blob:fixture-');
		expect(chapters[0].css).toContain('background-image: url("blob:fixture-');
		expect(chapters[1].content).toContain('<svg');
		expect(chapters[1].content).toContain('href="blob:fixture-');
	});

	it.each([
		['missing-container', 'Invalid EPUB: No container.xml found'],
		['missing-rootfile', 'Invalid EPUB: No rootfile found'],
		['missing-opf', 'Invalid EPUB: No OPF file found']
	] as const)('rejects an archive with %s', async (kind, message) => {
		const engine = new EpubEngine(await createMalformedEpubFixture(kind));

		await expect(engine.init()).rejects.toThrow(message);
	});

	it('rejects bytes that are not a ZIP archive', async () => {
		const engine = new EpubEngine(new TextEncoder().encode('not an epub').buffer);

		await expect(engine.init()).rejects.toThrow();
	});
});
