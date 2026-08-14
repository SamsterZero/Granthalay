# Data and Privacy

The current reader has no backend and does not intentionally transmit imported books, metadata, or
progress. Hosting-provider and browser behavior still applies.

## Stored data

IndexedDB database `EpubReaderDB`, currently version 3:

| Store          | Key       | Value                                                  |
| -------------- | --------- | ------------------------------------------------------ |
| `books`        | UUID      | Name, title, cover, creation time, and progress fields |
| `bookContents` | Same UUID | Original EPUB `ArrayBuffer`                            |

`localStorage` holds `theme`, `library-grid-mode`, and bundled-book progress under
`book-progress-default`. Cache Storage holds application assets and successful GET responses.
Older `current-book` data is migrated lazily to a UUID record.

Import creates a new UUID; duplicate imports are allowed. Deleting an imported book removes its
`books` record. A known gap is that it does not yet remove the corresponding `bookContents` value.
Clearing site data removes the library, preferences, and caches. There is no export, sync, or
recovery feature.

EPUB archives, markup, and styles are untrusted input. `sanitize-html` filters markup and archive
assets become object URLs. This reduces risk but is not an antivirus guarantee. Remote resources
embedded by publications are an area for further hardening.

Future store data—accounts, orders, entitlements, and publisher records—will be server-side and
documented before implementation. Personal books and reading activity remain local by default;
payment details remain with the payment provider.
