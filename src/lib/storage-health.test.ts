import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearRuntimeCaches, inspectStorageHealth } from './storage-health';

afterEach(() => vi.unstubAllGlobals());

describe('storage health', () => {
	it('reports quota, persistence, and cache usage when supported', async () => {
		vi.stubGlobal('navigator', {
			storage: {
				estimate: vi.fn().mockResolvedValue({ usage: 250, quota: 1000 }),
				persisted: vi.fn().mockResolvedValue(true)
			}
		});
		vi.stubGlobal('caches', {
			keys: vi.fn().mockResolvedValue(['granthalay-runtime-v1']),
			open: vi.fn().mockResolvedValue({
				matchAll: vi.fn().mockResolvedValue([new Response(new Uint8Array([1, 2, 3]))])
			})
		});

		await expect(inspectStorageHealth()).resolves.toEqual({
			usage: 250,
			quota: 1000,
			usageRatio: 0.25,
			persisted: true,
			cacheBytes: 3
		});
	});

	it('degrades honestly when browser capabilities fail', async () => {
		vi.stubGlobal('navigator', {
			storage: {
				estimate: vi.fn().mockRejectedValue(new Error('denied')),
				persisted: vi.fn().mockRejectedValue(new Error('denied'))
			}
		});
		vi.stubGlobal('caches', { keys: vi.fn().mockRejectedValue(new Error('denied')) });

		await expect(inspectStorageHealth()).resolves.toEqual({
			usage: null,
			quota: null,
			usageRatio: null,
			persisted: null,
			cacheBytes: null
		});
	});

	it('clears runtime caches without touching the offline app shell', async () => {
		const deleteCache = vi.fn().mockResolvedValue(true);
		const cacheStorage = {
			keys: vi
				.fn()
				.mockResolvedValue(['granthalay-app-v1', 'granthalay-runtime-v1', 'unrelated-cache']),
			delete: deleteCache
		} as unknown as CacheStorage;

		await expect(clearRuntimeCaches(cacheStorage)).resolves.toBe(1);
		expect(deleteCache).toHaveBeenCalledExactlyOnceWith('granthalay-runtime-v1');
	});
});
