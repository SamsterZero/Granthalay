# Changelog

Notable changes to Granthalay will be recorded here. The project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and intends to use
[Semantic Versioning](https://semver.org/) once releases begin.

## [Unreleased]

### Added

- Maintained user, engineering, privacy, deployment, compatibility, and troubleshooting docs.
- Contribution, security, conduct, issue, pull-request, and CI project infrastructure.

### Changed

- Replaced the outdated `spec/` documentation with an implementation-led `docs/` knowledge base.
- Configure Dependabot for Bun lockfiles and keep grouped updates to minor and patch releases.
- Move `jsdom` to development dependencies for browser-like component testing.
- Migrate the Svelte data-table adapter to TanStack Table 9's feature and store APIs.

### Fixed

- Delete imported-book metadata and raw EPUB bytes atomically instead of leaving orphaned content.
- Generate PWA manifest, asset, navigation, and offline fallback paths from the deployment base.
