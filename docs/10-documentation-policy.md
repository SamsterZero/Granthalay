# Documentation Policy

The checked-in `docs/` directory is Granthalay's canonical knowledge base. It replaces the former
`spec/`, which mixed intended and implemented behavior and had become inaccurate.

## Rules

- Describe current behavior in present tense and future work only in the roadmap.
- Verify claims against code and update affected docs in the same pull request.
- Record limitations openly; do not call inferred, experimental, or untested behavior supported.
- Keep reader material task-oriented and engineering material implementation-oriented.
- Never copy copyrighted book content into examples or fixtures.

The GitHub wiki, if enabled, is a discoverability layer. It may mirror the user guide, deployment,
compatibility, and troubleshooting pages, but should link to these versioned sources and must not
become a competing source of truth.

Review docs before releases and whenever storage, EPUB handling, deployment paths, privacy
boundaries, or major dependencies change. Broken links and stale setup commands are bugs.
