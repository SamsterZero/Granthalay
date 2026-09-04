# Compatibility and Limitations

Granthalay accepts standard EPUB archives and handles EPUB 3 navigation, EPUB 2 NCX tables of
contents, common embedded images/SVG, internal CSS, metadata, and common cover declarations.

## Supported browser matrix

Granthalay targets modern, standards-compliant evergreen browsers supporting modern JavaScript
modules, IndexedDB v3, Service Workers, DOMParser, Blob URLs, and modern CSS layout engines.

| Browser Engine       | Minimum Version                            | Supported Platforms                      | Notes & Capabilities                                                                              |
| :------------------- | :----------------------------------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------ |
| **Chromium / Blink** | Chrome 109+, Edge 109+, Opera 95+          | Windows, macOS, Linux, ChromeOS, Android | Full PWA installation, offline precaching, atomic IndexedDB storage, Blob URL resource rendering. |
| **Gecko / Firefox**  | Firefox 115 ESR+, Firefox for Android 115+ | Windows, macOS, Linux, Android           | Full reader and IndexedDB storage support; PWA installation dependent on platform support.        |
| **WebKit / Safari**  | Safari 16.4+, iOS / iPadOS Safari 16.4+    | macOS, iOS, iPadOS                       | Full reader support, Add to Home Screen (PWA), IndexedDB storage, Blob URLs.                      |

### Unsupported platforms

- Internet Explorer (all versions) and legacy Microsoft Edge (EdgeHTML).
- Pre-Chromium Opera or legacy mobile browsers lacking Service Worker or IndexedDB v3 support.
- Embedded WebViews with restricted storage or disabled blob/object URL schemas.

## Release smoke test checklist

Every release candidate must pass all automated CI checks and a manual release smoke test across a
supported browser engine before deployment:

1. **EPUB Import & Parsing**:
   - Import reflowable EPUB 2 (NCX) and EPUB 3 (nav) publications.
   - Verify title, author, description, and cover image extract cleanly on the library toolbar and card.
   - Verify chapter navigation and content rendering work without console runtime errors.
   - Navigate the library, book details, chapter list, reader controls, and removal confirmation using
     only Tab, Shift+Tab, Enter, Space, and Escape; focus must remain visible and follow visual order.
   - In the reader, verify Arrow keys and Page Up/Page Down change pages, Home/End reach chapter
     boundaries, focused controls keep their native keyboard behavior, and page/chapter changes are
     announced by a screen reader without duplicate announcements.
   - Change each reader appearance option, reload, and verify it persists locally. Confirm text
     repaginates near the same position and covers, SVG illustrations, and image-only pages are not
     restyled by typography overrides in both light and dark themes.
2. **Offline & PWA Installation**:
   - Confirm Web App Manifest loads without warnings and Service Worker registers successfully.
   - Set Network to Offline in browser DevTools, reload the app, and verify library and open reader function completely offline.
3. **Storage & Persistence**:
   - Reload or restart browser session; confirm imported books and metadata persist.
   - Delete a book from the library; verify metadata and raw EPUB binary bytes are deleted atomically from IndexedDB.
4. **Privacy & Security Sandbox**:
   - Inspect DevTools Network panel when opening EPUB content containing external images, styles, or frames.
   - Confirm 0 external HTTP/HTTPS network requests are initiated by the imported document.
5. **Deployment Base Verification**:
   - Run `bun run verify:build` to confirm static asset links, manifest scopes, and 404 fallbacks pass for both root (`/`) and GitHub Pages (`/Granthalay/`) paths.

## Known limitations

- EPUB conformance is incomplete; DRM, publisher scripting, media overlays, encrypted fonts,
  vertical writing, fixed-layout metadata, and complex CSS may not render correctly.
- Layout mode is inferred from logical chapter count and can classify some books incorrectly.
- Page counts are viewport-dependent estimates and may change after layout.
- Search, sync, catalogs, and PDF support are absent.
- Duplicate imports are not detected.
- The PWA supports root hosting and the official `/Granthalay/` GitHub Pages deployment.
- Encrypted backup export and restore require the browser Web Crypto API with PBKDF2 and AES-GCM.

Automated regression fixtures cover representative EPUB 2 and EPUB 3 package structures, NCX and
EPUB navigation, spine order, internal CSS, raster and SVG resources, and malformed archives. This
is a focused baseline rather than a complete EPUB conformance suite. Remote resources, CSS imports,
missing resource fallbacks, and embedded frames are intentionally blocked so opening a publication
does not disclose reader activity. Books must package every resource needed for offline rendering.

For rendering reports, use a public-domain or minimal reproduction and include browser, OS, EPUB
version, fixed/reflowable layout, and screenshots. Never upload a copyrighted EPUB.
