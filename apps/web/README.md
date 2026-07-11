# TopWaatch (web)

TopWaatch is a streaming front end for discovering and watching movies and TV shows. We don’t host video files  playback comes from third-party sources on the open web. Your **account data** (bookmarks, progress, preferences, history) lives on TopWaatch’s own servers so it follows you across devices.

This app is the continuation of the P-Stream / Z-Stream lineage: same idea, rebuilt as a unified product with our own backend, Cinema sources, and proxy.

**Site:** [topwaatch.mov](https://topwaatch.mov)

## What you get

- Search and browse via TMDB (Discover, details pages, person pages)
- In-browser player with source switching, captions, and progress sync
- Cloud account: bookmarks, watch history, and settings across web (and desktop when available)
- **TopWaatch Cinema**  premium-style sources **Nova** (`tw-nova`) and **Orbit** (`tw-orbit`) via our Showbox → Febbox pipeline
- Optional proxy / debrid-style connections from Settings
- Account deactivate or permanent delete from Settings

## Tech stack

This package (`apps/web`) is the Vite React client. The monorepo also runs the API and proxy:

| Layer | Stack |
| --- | --- |
| Web app | React, TypeScript, Vite, Tailwind, Zustand, i18next, HLS.js |
| API | Hono + tRPC (`packages/api`, `apps/server`) |
| Auth | Better Auth (email/password, session cookies) |
| Database | PostgreSQL + Drizzle ORM (`packages/db`) |
| Providers | `@topwaatch/providers` (sources / embeds, including Cinema) |
| Playback proxy | Cloudflare Worker (`workers/proxy`)  media bytes are not served by the API |
| Metadata | TMDB (and related scrapers where needed) |

### Local development

From the monorepo root:

```bash
bun install
bun run dev:web
```

That typically brings up the web app, API server, and proxy worker together. Configure env via the workspace `@topwaatch/env` / Vite `VITE_*` values (backend URL, auth, TMDB, etc.).

Useful scripts in this package:

```bash
bun run dev          # Vite only
bun run build        # production build
bun run test         # Vitest
bun run lint         # ESLint
```

Database schema changes live in `packages/db`  generate and migrate from the monorepo (`db:generate` / `db:migrate`), not by hand-editing SQL in the web app.

## Future plans

- Better **stream downloads** (player download UI is currently a coming-soon placeholder)
- Stronger **Cinema** reliability and more high-quality source options
- Polish for **desktop** (Windows app via community) and mobile web
- Clearer onboarding for proxy / Cinema setup entirely inside Settings
- Ongoing scrub of legacy P-Stream / partner leftovers and tighter legal / privacy copy

## Community

Join Discord for updates, the Windows app, and support  link is in the site header / notices when enabled.

For legal / DMCA: see `/legal` on the site, or email **topwaatch@gmail.com**.

## Note on content

TopWaatch indexes and plays streams hosted elsewhere. Availability depends on upstream sources. We host **account data** only; we do not host the media library itself.
