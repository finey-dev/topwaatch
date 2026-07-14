# TopWaatch Desktop (Tauri)

Native desktop shell for Linux and Windows, wrapping the web app with startup OTA updates.

## Prerequisites

- [Rust](https://rustup.rs/)
- Linux build deps: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
- Bun (workspace root)

## Development

```bash
# from repo root
bun install
bun run dev:desktop
```

This starts the web app in desktop mode and opens the Tauri window.

## Production build

```bash
bun run build:desktop
```

Artifacts are written under `apps/desktop/src-tauri/target/release/bundle/`.

## Updater signing keys

Generate once:

```bash
cd apps/desktop
bunx tauri signer generate -w ~/.tauri/topwaatch-desktop.key
```

1. Put the **public key** in `apps/desktop/src-tauri/tauri.conf.json` → `plugins.updater.pubkey`
2. Store the **private key** in GitHub Actions secrets as `TAURI_SIGNING_PRIVATE_KEY`
3. If encrypted, also set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

The app checks `apps/desktop/releases/latest.json` on startup (committed to the default branch by CI after each release).

## CI/CD

Workflow: `.github/workflows/desktop-release.yml`

Trigger a release:

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

Or use **Actions → Desktop Release → Run workflow**.

The pipeline builds:

- Linux x64: AppImage, `.deb`, `.rpm`
- Linux ARM64: AppImage, `.deb`, `.rpm`
- Windows x64: NSIS installer

It then uploads GitHub Release assets, generates:

- `desktop-manifest.json` — used by the download page
- `latest.json` — used by the in-app updater

Both files are committed to `apps/desktop/releases/` on the default branch (`master`).

## Download page

The web download page polls GitHub every 60 seconds and marks each desktop target as **Available** when a matching artifact exists in the latest `desktop-v*` release.

Release builds read all config from **GitHub Actions secrets** — nothing is committed to the repo. Copy values from your Vercel production env where the keys match.

### GitHub Actions secrets

**Settings → Secrets and variables → Actions → Secrets**

| Secret | Example (production) |
|--------|----------------------|
| `VITE_NORMAL_ROUTER` | `false` |
| `VITE_DESKTOP_APP` | `true` |
| `VITE_OPENSEARCH_ENABLED` | `false` |
| `VITE_ALLOW_FEBBOX_KEY` | `true` |
| `VITE_USE_TRAKT` | `true` |
| `VITE_DESKTOP_RELEASES_REPO` | `finey-dev/topwaatch` |
| `VITE_DESKTOP_RELEASE_TAG_PREFIX` | `desktop-v` |
| `VITE_APP_DOMAIN` | `https://topwaatch.vercel.app` |
| `VITE_BACKEND_URL` | `https://topwaatch-server.vercel.app` |
| `VITE_CORS_PROXY_URL` | `https://topwaatch-proxy.fineyakwoyo.workers.dev/proxy` |
| `VITE_M3U8_PROXY_URL` | `https://topwaatch-proxy.fineyakwoyo.workers.dev` |
| `VITE_FEBBOX_CLIENT_ID` | *(same as Vercel)* |
| `VITE_FEBBOX_REDIRECT_URI` | `https://topwaatch.vercel.app/febbox` |
| `VITE_TRAKT_CLIENT_ID` | *(same as Vercel)* |
| `VITE_TRAKT_REDIRECT_URI` | `https://topwaatch.vercel.app` |
| `VITE_TMDB_READ_API_KEY` | *(same as Vercel)* |
| `VITE_TRAKT_CLIENT_SECRET` | *(same as Vercel)* |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater signing key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Only if signing key is encrypted |

`GITHUB_TOKEN` is provided automatically — do not add it.

The workflow fails early with a clear error if any required secret is missing.

### Local desktop dev

Copy `apps/web/.env.desktop.example` → `apps/web/.env.desktop.local` (gitignored) and fill in values (localhost URLs for local backends).

The server must allow Tauri webview origins (`http://tauri.localhost`, etc.) for auth and API calls.
