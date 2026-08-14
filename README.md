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

## Run locally

Install [Bun](https://bun.sh/), then:

```sh
bun install
bun run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Useful checks are:

```sh
bun run check
bun run lint
bun run build
```

For a production-like static container:

```sh
docker build -t granthalay:local .
docker run --rm -p 8080:80 granthalay:local
```

See [Development](docs/03-development.md) and [Deployment](docs/06-deployment.md) for details.

## How privacy works

Imported books are processed entirely in the browser and are not uploaded by Granthalay. Browser
storage is origin-specific: clearing site data, changing the deployment URL, or using a different
browser/profile produces a different library. Back up the original EPUB files separately;
Granthalay does not currently offer library export.

## Documentation

The [documentation hub](docs/README.md) is the maintained source of truth for behavior, design,
storage, deployment, and project direction. It replaces the former `spec/` directory, whose
aspirational descriptions had drifted from the implementation.

- [User guide](docs/01-user-guide.md)
- [Project vision and principles](docs/02-vision.md)
- [Development guide](docs/03-development.md)
- [Architecture](docs/04-architecture.md)
- [Data and privacy](docs/05-data-and-privacy.md)
- [Deployment and PWA](docs/06-deployment.md)
- [Compatibility and limitations](docs/07-compatibility.md)
- [Troubleshooting](docs/08-troubleshooting.md)
- [Roadmap](docs/09-roadmap.md)
- [Documentation policy](docs/10-documentation-policy.md)

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report vulnerabilities
privately as described in [SECURITY.md](SECURITY.md). Community participation is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

Granthalay is licensed under the [MIT License](LICENSE).
