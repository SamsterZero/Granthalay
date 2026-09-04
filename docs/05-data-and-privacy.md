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

New backups use the filename suffix `.granthalay`. The complete payload is encrypted with
AES-256-GCM using a key derived from the reader's passphrase with PBKDF2-HMAC-SHA-256, 600,000
iterations, and a fresh random 16-byte salt. Every export also uses a fresh random 12-byte
initialization vector. The versioned outer header contains only the algorithm identifiers, work
factor, salt, and initialization vector; it is authenticated with the ciphertext so modification
causes decryption to fail. Passphrases and derived keys are never stored, logged, or transmitted,
and forgotten passphrases cannot be recovered.

After local decryption, the payload is a ZIP archive containing a UTF-8 `manifest.json` and one
directory per imported book. The manifest identifies the
`granthalay-library-backup` format version `1`, records the creation time, and maps every book to its
EPUB and optional cover file. It also contains reading state, preferences, bookmarks, and
highlights. Consumers must reject unknown format versions rather than guessing their schema.

The archive is self-contained and can be parsed without Granthalay or a network connection. Keep it
private: it contains the full text of imported books and may reveal reading activity.

Legacy plaintext `.granthalay.zip` archives remain importable so existing backups are not stranded.
Granthalay displays a warning when one is selected; replace it with a new encrypted export and remove
unneeded plaintext copies from shared or synchronized storage.

Restore validates the exact format version and schema; bounded metadata, archive paths, unique book
and annotation IDs, annotation relationships, referenced files, EPUB signatures, and entry sizes are
checked before the preview is shown. Unknown fields and versions are rejected. Existing book IDs are
listed as conflicts and are kept by default unless replacement is explicitly selected. Selected book
metadata, EPUB bytes, and annotations commit in one IndexedDB transaction. Preference values are
validated and restored with a snapshot so an IndexedDB failure also restores their previous values.
Validation and restoration run locally and make no network request.

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
