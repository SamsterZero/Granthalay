# Storage Migration and Backup Compatibility Policy

This policy governs changes to Granthalay's device-local IndexedDB schema, local-storage values,
backup payloads, and encrypted backup envelope. Its purpose is to let the application evolve without
silently losing books or stranding readers' exports.

## Version ownership

Each persistence boundary has an independent version. A change to one does not automatically change
the others.

| Boundary                 | Current version | Version declaration                                            | Compatibility rule                                                                                         |
| ------------------------ | --------------: | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| IndexedDB `EpubReaderDB` |               4 | `DB_VERSION` in `src/lib/db.ts`                                | Upgrade every older schema in place; never downgrade or recreate a library to migrate it.                  |
| Backup ZIP manifest      |               1 | `BACKUP_FORMAT_VERSION` in `src/lib/backup.ts`                 | Accept version 1 exactly. Reject unknown future versions before reading book payloads or changing storage. |
| Encrypted envelope       |               1 | `ENCRYPTED_BACKUP_VERSION` in `src/lib/backup-crypto.ts`       | Authenticate and accept version 1 exactly. Reject unknown algorithms and versions before decryption.       |
| Annotation record        |               1 | `ANNOTATION_FORMAT_VERSION` in `src/lib/reader/annotations.ts` | Validate records when reading or restoring; do not expose malformed records to reader UI.                  |

Local-storage records without a version must retain tolerant readers until they are replaced by a
versioned representation. Missing fields use documented defaults; invalid fields must not prevent a
reader from opening otherwise valid books.

## IndexedDB migration requirements

1. Increment `DB_VERSION` for every object-store, index, key-path, or stored-record change that cannot
   be handled safely by existing readers.
2. Perform structural changes only inside `onupgradeneeded`. Upgrade steps must be ordered by
   `oldVersion`, idempotent within their transaction, and safe when optional legacy data is absent.
3. Preserve original records until their replacement has been written successfully. An unrecognized
   legacy record remains available for recovery instead of being deleted or guessed at.
4. Keep metadata, EPUB bytes, annotations, and related deletions in the smallest practical atomic
   transaction. Never clear or recreate the database as an upgrade shortcut.
5. A failed or aborted upgrade must leave the previous database version usable. The UI must explain
   recovery without exposing book content and must not retry destructively.
6. Changes to local-storage values require validation, defaults, and either a reversible conversion or
   continued support for the prior representation.

## Backup evolution requirements

Backup manifest and encryption-envelope versions advance independently. Additive schema changes may
remain in the current manifest version only when older readers already ignore them safely and strict
validation remains unambiguous; otherwise increment the manifest version.

Before emitting a new version, implement and test its importer. A new importer must validate and
convert supported older versions into the current in-memory model before opening a write transaction.
Export always emits the newest stable version. Restore must never reinterpret an unknown version,
partially import it, or overwrite the original archive.

Encryption metadata contains no secret, but its format remains authenticated. Changing the cipher,
key-derivation function, parameter semantics, or binary framing requires a new envelope version.
Passphrases and derived keys must remain ephemeral and device-local.

Legacy plaintext version-1 ZIP backups remain importable with a privacy warning until their support
is explicitly deprecated under the rules below. They must never be uploaded for conversion.

## Required verification

Every persistence change must include automated coverage for:

- the oldest supported source version upgrading or importing successfully;
- the current version opening without mutation;
- malformed, incomplete, duplicate, and unknown-version input;
- transaction or quota failure leaving prior data and preferences unchanged;
- export followed by import preserving books, EPUB bytes, progress, preferences, and annotations;
- offline execution with no application network dependency.

Tests use synthetic, redistributable data. Release candidates additionally run the manual storage and
backup checks in [Compatibility](07-compatibility.md) on a supported browser. A schema change is not
complete until its upgrade test starts from a database created at the older version rather than from
the current schema.

## Failure recovery

On migration or restore failure, retain the source data, abort the complete write transaction, and
show an actionable local error. Readers should first retry with sufficient free browser storage and
the original backup untouched. If the old application remains compatible, rollback means deploying
that build without modifying the database further. Clearing site data is a last resort and must be
presented as destructive.

Support investigations may request version numbers, browser details, and sanitized error names.
They must never request an EPUB, decrypted archive, passphrase, annotation text, or database dump by
default.

## Deprecation and removal

A supported storage or backup version may be deprecated only after a replacement exporter and
importer have shipped. Announce the affected versions, migration path, privacy implications, and
removal target in the changelog and compatibility documentation. Keep restore support for at least
two minor releases and six months after the deprecation notice, choosing whichever period is longer.

Removal requires migration fixtures and a documented recovery tool or conversion path. If no safe
conversion exists, retain read-only import support. Never strand locally stored books merely to
simplify the current schema.

## Pull-request checklist

A pull request that changes persistence must state the old and new versions, affected stores and
keys, forward and rollback behavior, test fixtures, storage/quota failure behavior, offline impact,
privacy impact, accessibility of user-facing recovery, and documentation updates. Reviewers should
block a schema change whose migration and recovery behavior is unspecified.
