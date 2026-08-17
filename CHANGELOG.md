# Changelog

Notable changes to Granthalay will be recorded here. The project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and intends to use
[Semantic Versioning](https://semver.org/) once releases begin.

## [Unreleased]

### Added

- Maintained user, engineering, privacy, deployment, compatibility, and troubleshooting docs.
- Contribution, security, conduct, issue, pull-request, and CI project infrastructure.
- Original, generated EPUB 2 and EPUB 3 parser fixtures with malformed-archive coverage.
- Defined supported browser engine matrix and release smoke testing protocol with automated suite.

### Changed

- Replaced the outdated `spec/` documentation with an implementation-led `docs/` knowledge base.
- Configure Dependabot for Bun lockfiles and keep grouped updates to minor and patch releases.
- Move `jsdom` to development dependencies for browser-like component testing.
- Migrate the Svelte data-table adapter to TanStack Table 9's feature and store APIs.

### Fixed

- Delete imported-book metadata and raw EPUB bytes atomically instead of leaving orphaned content.
- Generate PWA manifest, asset, navigation, and offline fallback paths from the deployment base.
- Block imported EPUB markup and styles from loading remote or unmediated resources.
