# Compatibility and Limitations

Granthalay accepts standard EPUB archives and handles EPUB 3 navigation, EPUB 2 NCX tables of
contents, common embedded images/SVG, internal CSS, metadata, and common cover declarations.

## Known limitations

- EPUB conformance is incomplete; DRM, publisher scripting, media overlays, encrypted fonts,
  vertical writing, fixed-layout metadata, and complex CSS may not render correctly.
- Layout mode is inferred from logical chapter count and can classify some books incorrectly.
- Page counts are viewport-dependent estimates and may change after layout.
- Search, bookmarks, annotations, font controls, sync, catalogs, export, and PDF are absent.
- Duplicate imports are not detected.
- The PWA supports root hosting and the official `/Granthalay/` GitHub Pages deployment.

Automated regression fixtures cover representative EPUB 2 and EPUB 3 package structures, NCX and
EPUB navigation, spine order, internal CSS, raster and SVG resources, and malformed archives. This
is a focused baseline rather than a complete EPUB conformance suite. Remote resources, CSS imports,
missing resource fallbacks, and embedded frames are intentionally blocked so opening a publication
does not disclose reader activity. Books must package every resource needed for offline rendering.

For rendering reports, use a public-domain or minimal reproduction and include browser, OS, EPUB
version, fixed/reflowable layout, and screenshots. Never upload a copyrighted EPUB.
