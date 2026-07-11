# TopWaatch Proxy Worker

Stateless Cloudflare Worker that replaces the browser extension and Nitro `simple-proxy`.

## Routes

| Path | Purpose |
|------|---------|
| `GET /` | Health (`OK`) |
| `GET\|POST /proxy?destination=` | General HTTP forwarder |
| `GET /m3u8-proxy?url=&headers=` | HLS playlist rewrite |
| `GET /ts-proxy?url=&headers=` | Segment / key proxy |
| `GET /metrics` | Per-isolate Prometheus counters |

## Observability

Hot-path metrics stay cheap:

- **Counters** always update (`route` + `status_class` + `outcome`  no host labels)
- **Structured logs** (`console.log` JSON): errors always; successes sampled
- Logs include **hostname only** (never full signed URLs or bodies)

Defaults (overridable via Worker vars):

| Var | Default | Meaning |
|-----|---------|---------|
| `PROXY_METRICS_SAMPLE_TS` | `0.01` | Sample 1% of successful TS segments |
| `PROXY_METRICS_SAMPLE_M3U8` | `0.1` | Sample 10% of successful playlists |
| `PROXY_METRICS_SAMPLE_PROXY` | `0.1` | Sample 10% of successful `/proxy` |
| `PROXY_METRICS_LOG` | `1` | Set `0` to silence logs |

View live logs with `wrangler tail`. For fleet-wide history, enable Cloudflare Logpush on Worker logs.

## Local development

```bash
cd workers/proxy
bun install
bun run dev
# → http://127.0.0.1:8787
```

Point server/web env at it:

```env
PROXY_DEFAULT_URL=http://127.0.0.1:8787/proxy
M3U8_PROXY_DEFAULT_URL=http://127.0.0.1:8787
VITE_CORS_PROXY_URL=http://127.0.0.1:8787/proxy
VITE_M3U8_PROXY_URL=http://127.0.0.1:8787
```

Smoke test:

```bash
curl "http://127.0.0.1:8787/proxy?destination=https://httpbin.org/get"
```

## Self-host

1. Deploy this Worker to your Cloudflare account
2. Paste the Worker URL into TopWaatch **Settings → Connections → Custom proxy URL**
   - General proxy: `https://<your-worker>.workers.dev/proxy`
   - M3U8 base: `https://<your-worker>.workers.dev`
