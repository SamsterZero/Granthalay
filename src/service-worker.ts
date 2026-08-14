/// <reference types="@sveltejs/kit" />
import { base, build, files, prerendered, version } from '$service-worker';

const CACHE = `cache-${version}`;
const appPath = (path = '') => `${base}/${path}`;
const FALLBACKS = [appPath('404.html'), appPath('index.html'), appPath()];

const ASSETS = [...new Set([...build, ...files, ...prerendered, ...FALLBACKS])];

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		if (ASSETS.includes(url.pathname)) {
			const response = await cache.match(url.pathname);
			if (response) return response;
		}

		if (event.request.mode === 'navigate') {
			for (const fallbackPath of FALLBACKS) {
				const fallback = await cache.match(fallbackPath);
				if (fallback) return fallback;
			}
		}

		try {
			const response = await fetch(event.request);
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}
			return response;
		} catch {
			return cache.match(event.request);
		}
	}

	event.respondWith(respond());
});
