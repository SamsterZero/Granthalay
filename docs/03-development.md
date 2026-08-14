# Development Guide

Setup, commands, validation, and pull-request requirements live in
[CONTRIBUTING.md](../CONTRIBUTING.md). The current reader uses SvelteKit, Svelte 5, TypeScript,
Tailwind CSS, JSZip, and `sanitize-html`.

## Working safely

Keep sanitization in the parse path, avoid `{@html}` with unsanitized values, revoke object URLs,
normalize archive paths, and contain external resources. Storage changes need backward-compatible
upgrades because users may have existing books.

Future server modules must expose explicit boundaries, own their data, and keep provider-specific
payment, email, and storage code behind adapters.
