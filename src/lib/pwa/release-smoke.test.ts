// @vitest-environment jsdom

import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteBookById, getBookById, saveBook } from '../db';
import { EpubEngine } from '../epub/engine';
import { createEpub3Fixture, createRemoteResourceFixture } from '../epub/testing/fixtures';
import { createWebManifest, toAppPath } from './manifest';

describe('Release Smoke Suite', () => {
	beforeEach(() => {
		vi.stubGlobal('indexedDB', new IDBFactory());

		let objectUrlId = 0;
		vi.stubGlobal(
			'URL',
			Object.assign(URL, {
				createObjectURL: vi.fn(() => `blob:smoke-fixture-${++objectUrlId}`),
				revokeObjectURL: vi.fn()
			})
		);
	});

	it('smoke test: parses EPUB 3 fixture and resolves local packaged assets', async () => {
		const engine = new EpubEngine(await createEpub3Fixture());
		const spine = await engine.init();
		const chapters = await engine.parseChapters(spine ?? []);

		expect(engine.metadata.title).toBe('Minimal EPUB 3');
		expect(chapters.length).toBeGreaterThan(0);
		expect(chapters[0].content).toContain('blob:smoke-fixture-');
		engine.destroy();
	});

	it('smoke test: enforces security sandbox on remote EPUB resources', async () => {
		const engine = new EpubEngine(await createRemoteResourceFixture());
		const spine = await engine.init();
		const [chapter] = await engine.parseChapters(spine ?? []);
		const rendered = `${chapter.content}\n${chapter.css}`;

		expect(rendered).not.toMatch(/https?:|\/\/tracker\.invalid|@import|image-set/i);
		expect(chapter.content).not.toContain('<iframe');
		engine.destroy();
	});

	it('smoke test: stores and deletes EPUB metadata and binary content atomically', async () => {
		const sampleBuffer = new Uint8Array([10, 20, 30]).buffer;
		const id = await saveBook(sampleBuffer, 'smoke.epub', 'Smoke Test Book', null);

		const fetched = await getBookById(id);
		expect(fetched).toMatchObject({ id, title: 'Smoke Test Book', name: 'smoke.epub' });

		await deleteBookById(id);
		expect(await getBookById(id)).toBeNull();
	});

	it('smoke test: generates valid web manifests for root and subpath deployments', () => {
		const rootManifest = createWebManifest('');
		expect(rootManifest.start_url).toBe('/');
		expect(rootManifest.scope).toBe('/');
		expect(rootManifest.icons[0].src).toBe('/icon-192.png');

		const ghPagesManifest = createWebManifest('/Granthalay');
		expect(ghPagesManifest.start_url).toBe('/Granthalay/');
		expect(ghPagesManifest.scope).toBe('/Granthalay/');
		expect(ghPagesManifest.icons[0].src).toBe('/Granthalay/icon-192.png');
		expect(toAppPath('/Granthalay/', 'reader')).toBe('/Granthalay/reader');
	});
});
