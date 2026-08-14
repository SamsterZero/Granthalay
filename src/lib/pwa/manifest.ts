export interface WebManifest {
	name: string;
	short_name: string;
	id: string;
	description: string;
	start_url: string;
	scope: string;
	display: 'standalone';
	background_color: string;
	theme_color: string;
	icons: Array<{
		src: string;
		sizes: string;
		type: string;
		purpose?: 'maskable';
	}>;
}

export function toAppPath(base: string, path = ''): string {
	const normalizedBase = base === '/' ? '' : base.replace(/\/$/, '');
	return `${normalizedBase}/${path}`;
}

export function createWebManifest(base: string): WebManifest {
	return {
		name: 'Granthalay',
		short_name: 'Granthalay',
		id: toAppPath(base),
		description: 'Read your favorite books with Readium Web',
		start_url: toAppPath(base),
		scope: toAppPath(base),
		display: 'standalone',
		background_color: '#0D5C63',
		theme_color: '#0D5C63',
		icons: [
			{
				src: toAppPath(base, 'icon-192.png'),
				sizes: '192x192',
				type: 'image/png'
			},
			{
				src: toAppPath(base, 'icon-512.png'),
				sizes: '512x512',
				type: 'image/png'
			},
			{
				src: toAppPath(base, 'icon-maskable.png'),
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable'
			}
		]
	};
}
