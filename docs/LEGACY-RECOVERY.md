# Recovered legacy portal

The app domain's active legacy bundle registers 112 routes. The later production source in `jaygbarton/gla-v3`, `oct2-2025-v4` at `4a45ae226fd8510e95d24ba5325de3d0639caefd`, has 416 active routes. All 31 legacy branches and the modern frontend/backend histories were reviewed; the mobile repository was excluded.

The full audit, source changes, and route inventory are in [the legacy recovery branch](https://github.com/jaygbarton/gla-v3/tree/codex/restore-complete-legacy/docs). The recovered build has 423 routes, including restored client records/files views and compatible old bookmarks. Its exact source revision is recorded in `legacy-build.json`.

## Deployment status

This branch **prepares but does not activate** the replacement. `public/legacy-index.html` and `vercel.json` are unchanged. A separate `public/legacy-restored-index.html` and its compiled assets are ready. Simply deploying this branch does not reconnect the old database or files.

The original full application needs these upstream paths:

- `/portal/rest/v1/*` — full legacy PHP API, including authentication and data.
- `/portal/img/*` — original uploaded photos, receipts, and documents.
- `/carrental/rest/v1/*` and `/carrental/img/*` — separate rental backend/files.

The current `/rest/gla` proxy to `devapp.fbasapp.com` is not verified as the full production backend. `/img` currently maps to only 11 packaged images. No original `/portal` API/uploads upstream is configured. Do not redirect the recovered UI to the Node compatibility layer and assume it supplies the complete PHP application.

## Rebuild

Check out the legacy recovery branch and install its dependencies. With a clean, committed legacy checkout:

```sh
node scripts/import-legacy-build.mjs /path/to/gla-v3
```

The script rebuilds the legacy frontend, copies only its referenced JS/CSS/font assets, and records the source revision. It does not publish repository uploads, SQL backups, or PHP credentials. The old bundle is retained for rollback and already-open browser tabs.

## Validation

Four bookmark checks pass in the source repository, and all 112 deployed paths map into the recovered route registry. Thirteen browser checks pass with fixture APIs, including opening a historical document folder and following its Google Drive file link. These checks do not establish the completeness of live records.

Run the recovered source's `npm run preview -- --host 127.0.0.1 --port 5201`, then in this repository:

```sh
node scripts/check-legacy-pages.cjs
node --test scripts/legacy-routing.test.mjs
```

The browser check requires installed frontend dependencies and Chromium. Override `CHROMIUM_PATH` or `LEGACY_PREVIEW_URL` as needed. It blocks external network requests and mocks all PHP calls; it does not log in to or modify production. Output is written under `test-results/legacy/`.

## Cutover after locating the original PHP host

Verify the original host's API and existing uploads first, using the existing production database. Check an authorized account's login, representative historical records, a photo, a receipt, and a document. Reconnect the separate rental service if it is on another host. Do not import historical SQL backups into the live database.

Once the original host serving `/portal` and `/carrental` is confirmed, print the proposed config:

```sh
node scripts/prepare-legacy-cutover.mjs https://confirmed-php-origin.example
```

The script requires an explicit HTTPS origin and rejects the migrated frontend hosts to prevent forwarding loops. After confirming the proposed destinations, run the same command with `--write`; this updates host-specific Vercel rewrites and replaces the active legacy entry point. All original PHP data/file rewrites precede the SPA fallback, while new-site API routes stay on Render.

Update the domain-routing test expectations to the confirmed origin, run the routing tests and production build, commit, and push `main`. Check the deployed app's login, account roles, lists, historical record links, files, and rental service. Keep the PHP host's server configuration and upload storage intact. The frontend cannot execute the 1,512 recovered PHP controllers itself.
