export const APP_CACHE_PREFIX = 'granthalay-app-';
export const RUNTIME_CACHE_PREFIX = 'granthalay-runtime-';

export interface StorageHealth {
	usage: number | null;
	quota: number | null;
	usageRatio: number | null;
	persisted: boolean | null;
	cacheBytes: number | null;
}

export async function inspectStorageHealth(): Promise<StorageHealth> {
	let usage: number | null = null;
	let quota: number | null = null;
	let persisted: boolean | null = null;
	let cacheBytes: number | null = null;

	if (navigator.storage?.estimate) {
		try {
			const estimate = await navigator.storage.estimate();
			usage = finiteBytes(estimate.usage);
			quota = finiteBytes(estimate.quota);
		} catch {
			// Some browsers expose the API but deny estimates in private or restricted contexts.
		}
	}
	if (navigator.storage?.persisted) {
		try {
			persisted = await navigator.storage.persisted();
		} catch {
			persisted = null;
		}
	}
	if ('caches' in globalThis) {
		try {
			cacheBytes = await measureCacheBytes(caches);
		} catch {
			cacheBytes = null;
		}
	}

	return {
		usage,
		quota,
		usageRatio: usage !== null && quota !== null && quota > 0 ? usage / quota : null,
		persisted,
		cacheBytes
	};
}

export async function clearRuntimeCaches(cacheStorage: CacheStorage = caches): Promise<number> {
	const runtimeCaches = (await cacheStorage.keys()).filter((name) =>
		name.startsWith(RUNTIME_CACHE_PREFIX)
	);
	let deleted = 0;
	for (const name of runtimeCaches) {
		if (await cacheStorage.delete(name)) deleted += 1;
	}
	return deleted;
}

async function measureCacheBytes(cacheStorage: CacheStorage): Promise<number> {
	let total = 0;
	for (const name of await cacheStorage.keys()) {
		const cache = await cacheStorage.open(name);
		for (const response of await cache.matchAll()) {
			try {
				total += (await response.clone().arrayBuffer()).byteLength;
			} catch {
				// Opaque or unreadable responses still count in the browser's total estimate.
			}
		}
	}
	return total;
}

function finiteBytes(value: number | undefined): number | null {
	return value !== undefined && Number.isFinite(value) && value >= 0 ? value : null;
}
