import { readFile } from 'node:fs/promises';

const expectedBase = process.argv[2];
if (!expectedBase?.startsWith('/') || !expectedBase.endsWith('/')) {
	throw new Error('Expected a deployment base with leading and trailing slashes');
}

const [manifestSource, indexHtml, fallbackHtml, serviceWorker] = await Promise.all([
	readFile('build/manifest.webmanifest', 'utf8'),
	readFile('build/index.html', 'utf8'),
	readFile('build/404.html', 'utf8'),
	readFile('build/service-worker.js', 'utf8')
]);

const manifest = JSON.parse(manifestSource) as {
	id: string;
	start_url: string;
	scope: string;
	icons: Array<{ src: string }>;
};

for (const value of [manifest.id, manifest.start_url, manifest.scope]) {
	if (value !== expectedBase) throw new Error(`Unexpected manifest path: ${value}`);
}

for (const icon of manifest.icons) {
	if (!icon.src.startsWith(expectedBase))
		throw new Error(`Icon escapes deployment base: ${icon.src}`);
}

const manifestPath = `${expectedBase}manifest.webmanifest`;
if (!indexHtml.includes(manifestPath) && !indexHtml.includes('./manifest.webmanifest')) {
	throw new Error(`Index does not link ${manifestPath}`);
}
if (!fallbackHtml.includes(manifestPath)) throw new Error(`Fallback does not link ${manifestPath}`);

if (!serviceWorker.includes('location.pathname')) {
	throw new Error('Service worker does not derive its deployment base at runtime');
}

for (const fallbackFile of ['404.html', 'index.html']) {
	if (!serviceWorker.includes(fallbackFile)) {
		throw new Error(`Service worker does not contain fallback ${fallbackFile}`);
	}
}

console.log(`Verified static PWA build for ${expectedBase}`);
