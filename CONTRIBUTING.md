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

No environment variables or external services are required. Two public-domain EPUB fixtures are
bundled in `static/books/`; do not add copyrighted books or unnecessarily large fixtures.

## Validate a change

```sh
bun run check
bun run lint
bun run build
```

There is not yet an automated test suite. For reader or parser changes, manually verify import,
book details, navigation, resume state, dark mode, and deletion in a fresh browser profile. Test
both a text-heavy and illustrated EPUB when relevant.

## Pull requests

- Link the relevant issue and explain the user-visible outcome.
- List the exact automated and manual checks performed.
- Include screenshots or a recording for visible changes.
- Call out changes to IndexedDB, local storage, caching, network behavior, or EPUB sanitization.
- Update the relevant document and avoid unrelated generated or formatting changes.

Contributions are submitted under the [MIT License](LICENSE) and must follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
