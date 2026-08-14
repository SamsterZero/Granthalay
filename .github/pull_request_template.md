## Summary

<!-- Explain the user-visible outcome and why this approach was chosen. -->

## Related issue

Closes #

## Validation

- [ ] `bun run check`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] Relevant library and reader flows tested manually
- [ ] Text and illustrated EPUBs tested when parser/layout behavior changed

## Data, security, and compatibility

- IndexedDB/local storage/cache change: <!-- None, or describe migration and cleanup -->
- Sanitization or trust-boundary change: <!-- None, or describe -->
- New network behavior: <!-- None, or endpoint, purpose, and opt-out -->
- EPUB/browser compatibility effect: <!-- None, or describe -->

## Screenshots

<!-- Add before/after images for visible changes, otherwise remove this section. -->

## Checklist

- [ ] The change is focused and contains no copyrighted books, secrets, or unrelated files
- [ ] Documentation is updated for changed behavior
- [ ] New stored data has a deletion path
- [ ] Core reading remains usable without an account or application backend
