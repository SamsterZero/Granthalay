# Deployment and PWA

## Static build

```sh
bun install --frozen-lockfile
bun run build
```

Serve `build/` from an HTTPS static host. Routes use a generated `404.html` fallback. For the
official GitHub Pages project path, use `DEPLOY_TARGET=github-pages bun run build`. `bun run deploy`
publishes `build/` through `gh-pages` and is a maintainer action.

## Container

```sh
docker build -t granthalay:local .
docker run --rm -p 8080:80 granthalay:local
```

The multi-stage Dockerfile builds with Bun and serves with nginx. The container needs no persistent
volume because user data lives in each browser.

## PWA caveat

`static/manifest.json` and the service worker currently contain explicit `/Granthalay/` paths. This
matches official GitHub Pages but is not fully portable to root-path or renamed deployments. Verify
installability and offline navigation on custom deployments; making these paths base-aware is
roadmap work.

Browser storage is origin-specific. Changing scheme, host, or port can make a library appear empty
even though data remains under the old origin.

## Planned server

The bookstore milestones add a server runtime, database, migrations, secrets, object storage,
background jobs, and backups. Static deployment describes the current reader only.
