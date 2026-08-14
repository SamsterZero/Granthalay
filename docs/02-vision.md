# Vision and Principles

Granthalay is a privacy-first bookstore and EPUB-reading PWA. Personal EPUB import and reading
remain local and account-free. Optional connected features use a separately hosted modular backend
developed in the same repository.

## Principles

- **Local first:** book content and history remain on the device by default.
- **Readable over clever:** controls stay discoverable and accessible without dominating the book.
- **Respect the publication:** preserve publisher structure, images, SVGs, and styles where safe.
- **Safe by construction:** treat every EPUB archive and document as untrusted input.
- **Progressive capability:** installation and offline use enhance the web app but are not required.
- **Honest compatibility:** document format limitations and regressions openly.
- **Static PWA:** keep the reader installable, offline-capable, and deployable to GitHub Pages.
- **Modular backend:** enforce module ownership within one backend before splitting services.

## Boundaries

Email/password accounts, catalog, commerce, entitlements, and server storage are planned but not
implemented. They must remain optional for personal books and must not collect reading activity by
default. DRM circumvention and PDF support are outside the current roadmap.
