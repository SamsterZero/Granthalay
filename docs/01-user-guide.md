# Implemented Reader Behavior

This file records user-visible behavior as implementation context for developers and AI agents. It
is not the reader guide; maintain reader instructions in the GitHub Wiki.

## Add and organize books

Open the library and use the add/import control to choose an `.epub` file. Granthalay reads its
metadata locally and stores the book in this browser; it is not uploaded. The library supports
list, compact, and comfortable views. Open a book to view its details and chapters. Removing an
imported book does not delete the original file on your device.

## Read and navigate

Choose **Start reading**, **Resume**, or a chapter.

| Input       | Previous    | Next                 |
| ----------- | ----------- | -------------------- |
| Keyboard    | Left Arrow  | Right Arrow or Space |
| Pointer/tap | Left side   | Right side           |
| Touch       | Swipe right | Swipe left           |

Text-heavy books use horizontally paginated columns. Books detected as illustrated use one fitted
spine item per screen. Whole-book progress is calculated after layout, so its total can take a
moment to settle or change with the viewport.

Links supplied by the book can open another section, chapter, footnote, or return link inside the
same EPUB. They work with pointer, touch, and keyboard activation. Links to websites or other
external destinations are disabled so opening a local book cannot disclose reading activity.

Position is saved automatically. Theme follows the operating-system preference on first use and
can then be toggled. These settings belong to the current browser and deployment origin.

## Install and protect your data

On a supported browser, use Granthalay's install action or the browser's **Install app** / **Add to
Home Screen** menu. Availability depends on HTTPS, browser support, and the deployment path.

Keep the original EPUBs. Clearing site data removes imported books and progress, and Granthalay
does not currently export or synchronize a library. See [Data and privacy](05-data-and-privacy.md).

## Stable reading position

Granthalay stores reading progress on your device. When the reader is resized, rotated, or
repaginated, it restores the nearest position in the current chapter instead of relying on a stale
page number. No reading position or book content is sent to a server.
