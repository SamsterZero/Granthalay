/// <reference types="@sveltejs/kit" />
import { base, build, files, prerendered, version } from '$service-worker';

const APP_CACHE = `granthalay-app-${version}`;
const RUNTIME_CACHE = `granthalay-runtime-${version}`;
const appPath = (path = '') => `${base}/${path}`;
const FALLBACKS = [appPath('404.html'), appPath('index.html'), appPath()];

const ASSETS = [...new Set([...build, ...files, ...prerendered, ...FALLBACKS])];

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(APP_CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key.startsWith('granthalay-') && key !== APP_CACHE && key !== RUNTIME_CACHE) {
				await caches.delete(key);
			}
			if (key.startsWith('cache-')) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const appCache = await caches.open(APP_CACHE);
		const runtimeCache = await caches.open(RUNTIME_CACHE);

		if (ASSETS.includes(url.pathname)) {
			const response = await appCache.match(url.pathname);
			if (response) return response;
		}

		if (event.request.mode === 'navigate') {
			for (const fallbackPath of FALLBACKS) {
				const fallback = await appCache.match(fallbackPath);
				if (fallback) return fallback;
			}
		}

		try {
			const response = await fetch(event.request);
			if (response.status === 200) {
				runtimeCache.put(event.request, response.clone());
			}
			return response;
		} catch {
			return runtimeCache.match(event.request);
		}
	}

	event.respondWith(respond());
});
