# Documentation Policy

The checked-in `docs/` directory is Granthalay's canonical implementation context for developers
and AI coding agents. It replaces the former `spec/`, which mixed intended and implemented behavior
and had become inaccurate. Reader-facing instructions belong in the GitHub Wiki.

## Rules

- Describe current behavior in present tense and future work only in the roadmap.
- Verify claims against code and update affected docs in the same pull request.
- Record limitations openly; do not call inferred, experimental, or untested behavior supported.
- Prefer concise constraints, invariants, ownership boundaries, and validation commands that help
  a developer or AI agent make safe changes.
- Do not duplicate step-by-step reader guidance from the Wiki.
- Never copy copyrighted book content into examples or fixtures.

The [GitHub Wiki](https://github.com/SamsterZero/Granthalay/wiki) is the source of truth for
reader-facing guidance. It may summarize implemented behavior from these engineering documents but
serves a different audience.

Review docs before releases and whenever storage, EPUB handling, deployment paths, privacy
boundaries, or major dependencies change. Broken links and stale setup commands are bugs.
