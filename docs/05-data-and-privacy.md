# Data and Privacy

Granthalay has no backend and does not intentionally send imported books, metadata, or progress to
a project service. Browser and hosting-provider behavior still applies while loading the app.

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
