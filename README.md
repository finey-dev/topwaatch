# TopWaatch

TopWaatch is a streaming platform for discovering and watching movies and TV shows  with bookmarks, progress, and history that follow you across devices.

We **do not host video files**. Streams come from third-party sources on the open web. We **do host account data** (profiles, bookmarks, watch progress, preferences) on TopWaatch’s own servers and databases. Users can deactivate or permanently delete their account from Settings.

TopWaatch continues the P-Stream / Z-Stream lineage as a unified product: our own API, auth, Cinema sources, and Cloudflare playback proxy.

**Site:** [topwaatch.mov](https://topwaatch.mov)  
**Legal / DMCA:** [topwaatch.mov/legal](https://topwaatch.mov/legal) · **topwaatch@gmail.com**

## What’s in this monorepo

| Path | Role |
| --- | --- |
| `apps/web` | Main web client (Vite + React)  primary product surface |
| `apps/server` | Hono host for tRPC, Better Auth, Febbox/Cinema routes |
| `apps/native` | Expo / React Native app (in progress) |
| `packages/api` | tRPC routers and business logic |
| `packages/auth` | Better Auth configuration |
| `packages/db` | Drizzle schema and Postgres access |
| `packages/providers` | Source / embed providers (including Cinema Nova & Orbit) |
| `packages/env` | Shared environment helpers |
| `workers/proxy` | Cloudflare Worker  proxies media bytes for playback |

### Product highlights

- TMDB-powered search, Discover, details, and person pages
- Player with multi-source scraping, captions, and synced progress
- **TopWaatch Cinema**  **Nova** (`tw-nova`) and **Orbit** (`tw-orbit`) via Showbox → Febbox on the server
- Optional custom proxy and debrid-style connections in Settings
- Account deactivate (data kept, login blocked until support reactivates) or hard delete (own data only)

## Tech stack

- **Runtime / tooling:** Bun, Turborepo, TypeScript
- **Web:** React, Vite, Tailwind, Zustand, i18next, HLS.js
- **API:** Hono + tRPC
- **Auth:** Better Auth (email/password, cookie sessions)
- **DB:** PostgreSQL + Drizzle ORM
- **Edge:** Cloudflare Workers (playback proxy)
- **Native:** React Native + Expo (optional / early)

## Getting started

```bash
bun install
```

### Database

1. Run PostgreSQL and set connection details in the server / env packages (`DATABASE_URL`, Better Auth secrets, CORS, etc.).
2. Apply schema:

```bash
bun run db:generate   # after schema edits
bun run db:migrate    # or: bun run db:push for local prototyping
```

### Development

```bash
# Web + API + proxy worker (usual day-to-day)
bun run dev:web

# Everything Turborepo knows about
bun run dev

# API only / native only
bun run dev:server
bun run dev:native
```

- Web: Vite (often `http://localhost:5173`)
- API: typically `http://localhost:3000` (auth under `/api/auth/*`, tRPC under `/trpc/*`)

See `apps/web/README.md` for web-specific notes.

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run dev` | All apps in the workspace |
| `bun run dev:web` | Server + web + proxy |
| `bun run build` | Build all packages |
| `bun run check-types` | Typecheck across the monorepo |
| `bun run db:push` | Push Drizzle schema |
| `bun run db:generate` | Generate migrations |
| `bun run db:migrate` | Run migrations |
| `bun run db:studio` | Drizzle Studio |

## Future plans

- Proper **stream download** flow (UI is currently coming soon)
- More reliable Cinema / source coverage and playback hardening
- Desktop (Windows) and native app polish
- Settings as the single place for Cinema, proxy, and account lifecycle
- Continued cleanup of legacy partner hosts and branding leftovers

## Community & support

Discord (when linked in the site) for updates, the Windows app, and help.  
Email **topwaatch@gmail.com** for donations outreach, reactivation after deactivate, and legal / DMCA notices.

## Content note

TopWaatch is a discovery and playback client over third-party streams. Title listings can appear without a working source. We control account hosting and delisting  not upstream file hosts.
