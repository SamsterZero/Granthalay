# Contributing to Granthalay

Thank you for helping improve Granthalay. Keep changes focused, protect users' book content, and
describe compatibility trade-offs explicitly.

## Before starting

- Read the [Project Guide](PROJECT.md) and [architecture](docs/04-architecture.md).
- Search [existing issues](https://github.com/SamsterZero/Granthalay/issues).
- Discuss large UI, storage-schema, parser, or security changes before implementing them.
- Use [private vulnerability reporting](SECURITY.md) for security issues.

## Local setup

Install Bun, fork and clone the repository, then run:

```sh
bun install
bun run dev
```

No services are required for the current reader. Do not add copyrighted or unnecessarily large
EPUB fixtures.

## Validate a change

```sh
bun run check
bun run lint
bun run build
```

Until automated coverage exists, manually verify affected flows. Parser changes should use both a
text-heavy and illustrated public-domain EPUB.

## Pull requests

- Link the relevant issue and explain the user-visible outcome.
- List the exact automated and manual checks performed.
- Include screenshots or a recording for visible changes.
- Call out changes to IndexedDB, local storage, caching, network behavior, or EPUB sanitization.
- Update the relevant document and avoid unrelated generated or formatting changes.

Contributions are submitted under the [MIT License](LICENSE) and must follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
