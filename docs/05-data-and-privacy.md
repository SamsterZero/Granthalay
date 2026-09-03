# Data and Privacy

The current reader has no backend and does not intentionally transmit imported books, metadata, or
progress. Hosting-provider and browser behavior still applies.

## Stored data

IndexedDB database `EpubReaderDB`, currently version 4:

| Store          | Key       | Value                                                              |
| -------------- | --------- | ------------------------------------------------------------------ |
| `books`        | UUID      | Name, title, cover, creation time, and progress fields             |
| `bookContents` | Same UUID | Original EPUB `ArrayBuffer`                                        |
| `annotations`  | UUID      | Book ID, kind, semantic location, and optional selected-text quote |

`localStorage` holds `theme`, `library-grid-mode`, and bundled-book progress under
`book-progress-default`. Cache Storage holds application assets and successful GET responses.
Older `current-book` data is migrated lazily to a UUID record.

Import creates a new UUID; duplicate imports are allowed. Bookmarks and highlight records remain on
the device and are not sent to diagnostics or a backend. Deleting an imported book removes its
metadata, original EPUB bytes, and annotations in one transaction. Clearing site data removes the
library, annotations, preferences, and caches. Use **Settings → Backup & restore → Export backup**
to download a local backup. Export runs in the browser and makes no network request. There is no
automatic sync.

## Backup format

Backups use the filename suffix `.granthalay.zip`. They are ZIP archives containing a UTF-8
`manifest.json` and one directory per imported book. The manifest identifies the
`granthalay-library-backup` format version `1`, records the creation time, and maps every book to its
EPUB and optional cover file. It also contains reading state, preferences, bookmarks, and
highlights. Consumers must reject unknown format versions rather than guessing their schema.

The archive is self-contained and can be parsed without Granthalay or a network connection. Keep it
private: it contains the full text of imported books and may reveal reading activity. Granthalay
currently exports and validates this restorable artifact; an in-app restore control is not yet
available.

EPUB archives, markup, and styles are untrusted input. `sanitize-html` filters markup and archive
assets become object URLs. This reduces risk but is not an antivirus guarantee. Remote resources
embedded by publications are an area for further hardening.

Future store data—email/password accounts, sessions, orders, entitlements, and publisher records—
will be held by the backend and documented before implementation. Passwords must be hashed, tokens
revocable, and reset links single-use and short-lived. Personal books and reading activity remain
local by default; payment details remain with the payment provider.

## Diagnostics

Pino logs must use allow-listed fields and redact credentials, tokens, email addresses, book
content, reading activity, and payment data. Sentry remains disabled unless a deployment explicitly
configures it. Before activation, configure event scrubbing, disable session replay, minimize
sampling, and document consent and retention. Never attach EPUB files, chapter text, library
metadata, request bodies, authorization headers, or Pino log payloads to Sentry events.
