# Changelog

Notable changes to Granthalay will be recorded here. The project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and intends to use
[Semantic Versioning](https://semver.org/) once releases begin.

## [Unreleased]

### Added

- Establish maintained user, engineering, privacy, deployment, compatibility, troubleshooting, and
  governance documentation ([PR #1](https://github.com/SamsterZero/Granthalay/pull/1)).
- Add redistributable EPUB 2 and EPUB 3 parser fixtures with malformed-archive regression coverage
  ([PR #59](https://github.com/SamsterZero/Granthalay/pull/59), closes
  [issue #4](https://github.com/SamsterZero/Granthalay/issues/4)).
- Define the supported browser matrix and an automated release smoke-test protocol
  ([PR #61](https://github.com/SamsterZero/Granthalay/pull/61), closes
  [issue #6](https://github.com/SamsterZero/Granthalay/issues/6)).
- Add reader typography, layout, theme, and navigation preferences that persist globally or per book
  ([PR #74](https://github.com/SamsterZero/Granthalay/pull/74), closes
  [issue #10](https://github.com/SamsterZero/Granthalay/issues/10)).
- Add device-local bookmarks and text highlights, portable annotation storage, annotation management,
  and shared bottom navigation ([PR #75](https://github.com/SamsterZero/Granthalay/pull/75), closes
  [issue #11](https://github.com/SamsterZero/Granthalay/issues/11)).
- Export versioned, offline library backups containing imported EPUBs, metadata, reading progress,
  preferences, bookmarks, and highlights
  ([issue #12](https://github.com/SamsterZero/Granthalay/issues/12)).
- Add checked-in guidance for stacked branches and dependent pull requests
  ([PR #65](https://github.com/SamsterZero/Granthalay/pull/65)).

### Changed

- Preserve semantic reading position when pagination changes because of viewport, orientation, or
  typography updates ([PR #71](https://github.com/SamsterZero/Granthalay/pull/71), closes
  [issue #7](https://github.com/SamsterZero/Granthalay/issues/7)).
- Support safe same-document fragments, footnotes, return links, and cross-chapter EPUB navigation
  ([PR #72](https://github.com/SamsterZero/Granthalay/pull/72), closes
  [issue #8](https://github.com/SamsterZero/Granthalay/issues/8)).
- Make library and reader navigation keyboard-operable and improve assistive progress announcements
  ([PR #73](https://github.com/SamsterZero/Granthalay/pull/73), closes
  [issue #9](https://github.com/SamsterZero/Granthalay/issues/9)).
- Generate manifest, service-worker, asset, navigation, and offline paths from the deployment base
  ([PR #57](https://github.com/SamsterZero/Granthalay/pull/57), closes
  [issue #3](https://github.com/SamsterZero/Granthalay/issues/3)).
- Migrate the Svelte data-table adapter to TanStack Table 9
  ([PR #55](https://github.com/SamsterZero/Granthalay/pull/55)).
- Split Settings into dedicated appearance, reading behavior, backup and restore, and storage and
  privacy views.

### Fixed

- Delete imported-book metadata and raw EPUB bytes atomically instead of leaving orphaned content
  ([PR #49](https://github.com/SamsterZero/Granthalay/pull/49), closes
  [issue #2](https://github.com/SamsterZero/Granthalay/issues/2)).
- Block imported EPUB markup and styles from loading remote or unmediated resources
  ([PR #60](https://github.com/SamsterZero/Granthalay/pull/60), closes
  [issue #5](https://github.com/SamsterZero/Granthalay/issues/5)).
- Resolve bundled EPUB asset paths through the GitHub Pages deployment prefix
  ([PR #64](https://github.com/SamsterZero/Granthalay/pull/64)).

### Infrastructure and dependencies

- Configure Dependabot for Bun lockfiles and grouped dependency updates
  ([PR #51](https://github.com/SamsterZero/Granthalay/pull/51)).
- Allow manual GitHub Pages deployments and align the workflow with the protected Pages environment,
  deployment URL, setup action, and frozen Bun lockfile
  ([PR #62](https://github.com/SamsterZero/Granthalay/pull/62),
  [PR #66](https://github.com/SamsterZero/Granthalay/pull/66)).
- Update Docker and GitHub Actions used by CI, container publishing, and Pages deployment
  ([PR #40](https://github.com/SamsterZero/Granthalay/pull/40),
  [PR #41](https://github.com/SamsterZero/Granthalay/pull/41),
  [PR #42](https://github.com/SamsterZero/Granthalay/pull/42),
  [PR #43](https://github.com/SamsterZero/Granthalay/pull/43),
  [PR #46](https://github.com/SamsterZero/Granthalay/pull/46),
  [PR #47](https://github.com/SamsterZero/Granthalay/pull/47),
  [PR #48](https://github.com/SamsterZero/Granthalay/pull/48), and
  [PR #50](https://github.com/SamsterZero/Granthalay/pull/50)).
- Update production and development dependency groups, including moving `jsdom` to development-only
  usage ([PR #52](https://github.com/SamsterZero/Granthalay/pull/52),
  [PR #56](https://github.com/SamsterZero/Granthalay/pull/56),
  [PR #58](https://github.com/SamsterZero/Granthalay/pull/58), and
  [PR #63](https://github.com/SamsterZero/Granthalay/pull/63)).
