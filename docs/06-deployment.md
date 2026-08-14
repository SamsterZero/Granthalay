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

## Deployment paths

The web manifest is generated from SvelteKit's configured base path, and the service worker derives
the same base from its deployed URL. `bun run verify:build` builds and checks both root hosting and
the official `/Granthalay/` GitHub Pages path, including manifest links and offline fallbacks.

Browser storage is origin-specific. Changing scheme, host, or port can make a library appear empty
even though data remains under the old origin.

## Planned backend

The PWA remains a static GitHub Pages deployment when the bookstore launches. A separate backend
deployment will provide the API, database, migrations, secrets, object storage, background jobs,
and backups. Its CORS policy must allow only configured PWA origins. API URLs are public build-time
configuration; credentials and provider secrets never enter the static build.

Zod needs no deployment service. Pino writes structured backend logs to standard output for the
hosting platform to collect. Sentry DSNs and release identifiers are deployment configuration;
Sentry remains inactive until initialization is deliberately added and reviewed against the
privacy policy.
