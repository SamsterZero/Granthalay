# Implemented Reader Behavior

This file records user-visible behavior as implementation context for developers and AI agents. It
is not the reader guide; maintain reader instructions in the GitHub Wiki.

## Add and organize books

Open the library and use the add/import control to choose an `.epub` file. Granthalay reads its
metadata locally and stores the book in this browser; it is not uploaded. The library supports
list, compact, and comfortable views. Open a book to view its details and chapters. Removing an
imported book does not delete the original file on your device.

The bottom app bar includes **Library**, **Annotations**, and **Settings**. Annotations opens a
dedicated page of bookmarks and highlights from all locally stored books. Filter the responsive list
by bookmarks or highlights, open a saved passage directly in the reader, or remove an item. The count
badge reflects the annotations currently stored in this browser.

## Read and navigate

Choose **Start reading**, **Resume**, or a chapter.

| Input       | Previous              | Next                            |
| ----------- | --------------------- | ------------------------------- |
| Keyboard    | Left Arrow or Page Up | Right Arrow, Page Down or Space |
| Pointer/tap | Left side             | Right side                      |
| Touch       | Swipe right           | Swipe left                      |

Home and End move to the first and last page of the current chapter. The reader footer provides
focusable previous/next controls and a keyboard-operable chapter selector. Page and chapter changes
are announced to assistive technology. Reader shortcuts are suspended while a link, button, form
control, menu item, or editable field has focus.

Library book tiles and rows open with Enter or Space. View controls expose their selected state, icon
buttons have accessible names, and removing a book requires confirmation. These interactions remain
local to the browser and do not change offline behavior.

Text-heavy books use horizontally paginated columns. Books detected as illustrated use one fitted
spine item per screen. Whole-book progress is calculated after layout, so its total can take a
moment to settle or change with the viewport.

Links supplied by the book can open another section, chapter, footnote, or return link inside the
same EPUB. They work with pointer, touch, and keyboard activation. Links to websites or other
external destinations are disabled so opening a local book cannot disclose reading activity.

Position is saved automatically. Theme follows the operating-system preference on first use and
can then be toggled. These settings belong to the current browser and deployment origin.

Use the bookmark button in the reader header to save or remove a bookmark at the current location.
Open the **Reader settings** pop-up and choose the **Annotations** tab to revisit or remove saved annotations.
To highlight, select text in the reading area and choose the contextual **Highlight** action that
appears beside the selection. Reader status messages announce these changes without moving keyboard
focus.

Bookmarks attach to a chapter and normalized position, so changing font size, margins, orientation,
or viewport width does not tie them to an obsolete page number. Highlights use the selected text and
nearby context to find the passage again when the chapter is rendered. If a publication changes and
the quote can no longer be found, the saved record remains available for removal instead of being
silently moved to unrelated text. All annotation data stays in this browser and is removed when its
imported book is deleted.

Open **Settings** from the library bottom app bar to set global defaults for font size, line height,
margins, alignment, theme, and RTL, LTR, or scrolling navigation. The same controls in a reader save
preferences only for that book; **Use global defaults** removes its custom preferences. Typography
changes apply only to reflowable text; covers, SVG illustrations, and image-sensitive pages retain
their publisher layout. Preferences are stored only in this browser and work offline.

## Install and protect your data

On a supported browser, use Granthalay's install action or the browser's **Install app** / **Add to
Home Screen** menu. Availability depends on HTTPS, browser support, and the deployment path.

Keep the original EPUBs. Clearing site data removes imported books and progress, and Granthalay
does not currently export or synchronize a library. See [Data and privacy](05-data-and-privacy.md).

## Stable reading position

Granthalay stores reading progress on your device. When the reader is resized, rotated, or
repaginated, it restores the nearest position in the current chapter instead of relying on a stale
page number. No reading position or book content is sent to a server.
