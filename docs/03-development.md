# Development Guide

## Setup

Use Bun (the lockfile is `bun.lock`):

```sh
bun install
bun run dev
```

The app uses SvelteKit 2, Svelte 5 runes, TypeScript, Tailwind CSS 4, shadcn-svelte/bits-ui, JSZip,
and `sanitize-html`. It builds as a static site.

| Command           | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `bun run dev`     | Start Vite's development server                      |
| `bun run check`   | Run Svelte and TypeScript diagnostics                |
| `bun run lint`    | Check Prettier and ESLint                            |
| `bun run format`  | Apply repository formatting                          |
| `bun run build`   | Produce `build/`                                     |
| `bun run preview` | Preview a production build                           |
| `bun run deploy`  | Publish `build/` with `gh-pages` (maintainer action) |

## Working safely

Keep sanitization in the parse path, avoid `{@html}` with unsanitized values, revoke object URLs,
normalize archive paths, and contain external resources. Storage changes need backward-compatible
upgrades because users may have existing books.

There is no automated test suite yet. Manually exercise import/removal, metadata, chapter choice,
keyboard/touch navigation, progress restore, dark mode, refresh/offline behavior, and both text and
illustrated fixtures.
