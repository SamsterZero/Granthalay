# Granthalay

Granthalay is a private, local-first EPUB library and reader built with SvelteKit and Svelte 5.
Books are parsed and stored in the browser: there is no account, server-side library, or reading
telemetry.

<p align="center">
  <img src="static/icon-512.png" width="160" alt="Granthalay app icon">
</p>

**Quick links:** [Try it](https://samsterzero.github.io/Granthalay/) ·
[User guide](docs/01-user-guide.md) · [Architecture](docs/04-architecture.md) ·
[Troubleshooting](docs/08-troubleshooting.md) · [Contributing](CONTRIBUTING.md)

## What it does

- Imports `.epub` files and extracts metadata, cover, spine, and table of contents in the browser.
- Keeps uploaded books and reading position in IndexedDB; preferences use local storage.
- Provides list, compact-grid, and comfortable-grid library views.
- Switches between column pagination and a fit-to-screen presentation for illustrated books.
- Supports click/tap regions, swipes, arrow keys, and Space for page navigation.
- Includes dark mode and an installable PWA shell.

Granthalay is under active development. EPUB rendering can vary between publishers. See
[Compatibility and limitations](docs/07-compatibility.md) before filing an issue.

## How privacy works

Imported books are processed entirely in the browser and are not uploaded by Granthalay. Browser
storage is origin-specific: clearing site data, changing the deployment URL, or using a different
browser/profile produces a different library. Back up the original EPUB files separately;
Granthalay does not currently offer library export.

The roadmap evolves Granthalay into a single-repository modular monolith with optional accounts
and a bookstore while preserving anonymous local reading.

## Documentation

Use the [documentation hub](docs/README.md) for maintained technical documentation or the
[GitHub Wiki](https://github.com/SamsterZero/Granthalay/wiki) for reader-friendly guides. Local
setup, validation, and pull-request instructions live only in [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report vulnerabilities
privately as described in [SECURITY.md](SECURITY.md). Community participation is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

Granthalay is licensed under the [MIT License](LICENSE).
