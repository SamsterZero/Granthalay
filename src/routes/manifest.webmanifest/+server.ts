import { base } from '$app/paths';
import { createWebManifest } from '$lib/pwa/manifest';

export const prerender = true;

export function GET(): Response {
	return Response.json(createWebManifest(base), {
		headers: { 'content-type': 'application/manifest+json' }
	});
}
