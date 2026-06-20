import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			fallback: '404.html',
			strict: false,
			pages: 'build',
			assets: 'build'
		}),
		paths: {
			// For GitHub Pages, use the repository name as base path
			base: process.argv.includes('dev') ? '' : process.env.NODE_ENV === 'production' ? '/Granthalay' : ''
		},
		prerender: {
			handleUnseenRoutes: 'ignore',
			entries: ['*']
		}
	}
};

export default config;
