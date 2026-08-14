import { describe, expect, it } from 'vitest';

import { createWebManifest, toAppPath } from './manifest';

describe('PWA deployment paths', () => {
	it('generates root-hosted paths', () => {
		expect(toAppPath('', 'reader')).toBe('/reader');
		expect(createWebManifest('')).toMatchObject({
			id: '/',
			start_url: '/',
			scope: '/',
			icons: [{ src: '/icon-192.png' }, { src: '/icon-512.png' }, { src: '/icon-maskable.png' }]
		});
	});

	it('generates GitHub Pages paths without duplicate separators', () => {
		expect(toAppPath('/Granthalay/', 'reader')).toBe('/Granthalay/reader');
		expect(createWebManifest('/Granthalay')).toMatchObject({
			id: '/Granthalay/',
			start_url: '/Granthalay/',
			scope: '/Granthalay/',
			icons: [
				{ src: '/Granthalay/icon-192.png' },
				{ src: '/Granthalay/icon-512.png' },
				{ src: '/Granthalay/icon-maskable.png' }
			]
		});
	});
});
