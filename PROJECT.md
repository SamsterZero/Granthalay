# Granthalay Project Guide

Granthalay is a browser-only EPUB library and reader. This file records the constraints used to
evaluate changes; user and engineering material lives in [docs](docs/README.md).

## Product constraints

- Core reading works without an account or application backend.
- Imported book content and reading history stay on the user's device.
- Network access is not required to read an already stored, self-contained EPUB after the app shell
  is available offline.
- Untrusted EPUB markup is sanitized before insertion into the document.
- Features should work with keyboard, pointer, and touch input where applicable.
- Static hosting remains a supported deployment model.

## Source of truth

Observed application behavior and tests outrank historical plans. Durable decisions belong in
`docs/`; actionable work belongs in GitHub issues. When behavior changes, update the relevant doc
in the same pull request. The [roadmap](docs/09-roadmap.md) communicates direction, not a promise.

## Definition of done

A change is complete when its user-visible behavior and failure states are handled, relevant
checks pass, accessibility and privacy effects have been considered, and affected documentation
is current. Parser changes should be checked against multiple structurally different books and
must preserve sanitization.

## Key references

- [Vision](docs/02-vision.md)
- [Architecture](docs/04-architecture.md)
- [Data and privacy](docs/05-data-and-privacy.md)
- [Compatibility](docs/07-compatibility.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
