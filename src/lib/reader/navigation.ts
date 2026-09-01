import type { EpubChapter } from '$lib/epub/engine';

export interface InternalNavigationTarget {
	chapter: number;
	fragment: string | null;
}

function normalizePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function resolveInternalNavigation(
	target: string,
	chapters: Pick<EpubChapter, 'href'>[]
): InternalNavigationTarget | null {
	if (!target || target.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(target)) return null;

	const hashIndex = target.indexOf('#');
	const path = normalizePath(hashIndex >= 0 ? target.slice(0, hashIndex) : target);
	const fragment = hashIndex >= 0 ? decodeFragment(target.slice(hashIndex + 1)) : null;
	const chapter = chapters.findIndex(({ href }) => normalizePath(href.split('#')[0]) === path);

	return chapter < 0 ? null : { chapter, fragment };
}

function decodeFragment(fragment: string): string | null {
	if (!fragment) return null;
	try {
		return decodeURIComponent(fragment);
	} catch {
		return fragment;
	}
}
