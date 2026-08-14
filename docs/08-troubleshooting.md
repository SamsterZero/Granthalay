# Troubleshooting

## My library is empty

Use the same browser profile and exact site origin. `http` vs `https`, another port or host, cleared
site data, and private browsing can produce a separate empty library.

## A book will not import or open

Confirm its name ends in `.epub` and it is a valid, non-DRM EPUB. Try a known-good public-domain
book. Browser developer tools may show ZIP, container, OPF, or parsing errors. Share a minimal legal
fixture, not the full copyrighted book.

## Images or layout look wrong

Complex publisher CSS, fixed layouts, encrypted fonts, and unsupported features can differ. See
[Compatibility](07-compatibility.md) and include a minimal reproduction in a bug report.

## Resume opens at an unexpected page

Pagination depends on viewport size and measured content, so resize/orientation changes can alter
page counts. Clearing site data resets all positions.

## Install or offline mode fails

Use HTTPS (localhost is the development exception), inspect manifest/service-worker errors, and
reload after deployment. Custom deployments face the `/Granthalay` path caveat in
[Deployment](06-deployment.md). Clear only cache—not all site storage—if preserving books matters.

## Development build fails

Run `bun install --frozen-lockfile`, `bun run check`, and `bun run build`. If formatting alone fails,
run `bun run format` and review the diff.
