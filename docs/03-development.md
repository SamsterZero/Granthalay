# Development Guide

Setup, commands, validation, and pull-request requirements live in
[CONTRIBUTING.md](../CONTRIBUTING.md). The current reader uses SvelteKit, Svelte 5, TypeScript,
Tailwind CSS, JSZip, `sanitize-html`, and Zod.

## EPUB regression fixtures and smoke suite

`src/lib/epub/testing/fixtures.ts` generates small, original EPUB 2 and EPUB 3 archives in memory.
They cover container and OPF discovery, spine order, NCX and EPUB navigation, CSS, raster images,
SVG references, and malformed packages without distributing third-party book content. Run the suite
with `bun run test`. Automated release smoke testing lives in `src/lib/pwa/release-smoke.test.ts`.
See the manual smoke checklist in [Compatibility](07-compatibility.md).

## Working safely

Keep sanitization in the parse path, avoid `{@html}` with unsanitized values, revoke object URLs,
normalize archive paths, and contain external resources. Storage changes need backward-compatible
upgrades because users may have existing books.

Future server modules must expose explicit boundaries, own their data, and keep provider-specific
payment, email, and storage code behind adapters. Use Zod at untrusted configuration and API
boundaries, Pino for structured backend logs, and Sentry only through the diagnostics policy in
[Data and privacy](05-data-and-privacy.md). Pino must not enter the PWA bundle.
