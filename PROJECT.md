# Granthalay Project Guide

Granthalay is currently a browser-only EPUB reader and is planned to become a privacy-first
bookstore and reading PWA. One repository produces two deployables: a static PWA and a separately
hosted modular backend API. Detailed material lives in [docs](docs/README.md).

## Product constraints

- Personal EPUB import and reading work without an account.
- Imported book content and reading history stay on the user's device.
- Network access is not required to read an already stored, self-contained EPUB after the app shell
  is available offline.
- Untrusted EPUB markup is sanitized before insertion into the document.
- Features should work with keyboard, pointer, and touch input where applicable.
- Accounts, catalog, commerce, entitlements, content, and notification remain explicit backend
  modules in this repo.
- The backend starts as one deployable and database. Module boundaries permit a later split without
  requiring distributed infrastructure now.

## Source of truth

Observed application behavior and tests outrank historical plans. Durable decisions belong in
`docs/`; actionable work belongs in GitHub issues. When behavior changes, update the relevant doc
in the same pull request. The [roadmap](docs/09-roadmap.md) communicates direction, not a promise.

## Definition of done

A change is complete when behavior and failure states are handled, checks pass, accessibility and
privacy effects are reviewed, and affected docs are current. Parser changes must preserve
sanitization and be checked against structurally different books.

## Key references

- [Vision](docs/02-vision.md)
- [Architecture](docs/04-architecture.md)
- [Data and privacy](docs/05-data-and-privacy.md)
- [Compatibility](docs/07-compatibility.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
