# modelprep-backend

Cloudflare Worker that bridges the ModelPrep React frontend to Cults3D's GraphQL API (more platforms coming).

> **For the full system overview** — how this fits with the frontend, CDN, R2, and Cults — read [`../ARCHITECTURE.md`](../ARCHITECTURE.md) first. That's the single source of truth. This README is just how to develop + deploy *this piece*.

## Status

Production-deployed at `https://modelprep-backend.iamdjem.workers.dev`. Bound to R2 bucket `modelprep-staging`. CORS locked to `iamdjem.github.io` + `localhost:5173|4173`. **Not under git** — see ARCHITECTURE.md "Deploy & commit map".

## First-time setup

```bash
cd modelprep-backend
npm install
cp .dev.vars.example .dev.vars
# Edit .dev.vars and paste Cults username + API key (gitignored, never commit).
```

If you don't have wrangler:
```bash
npm install -g wrangler
wrangler login
```

## Run locally

```bash
npm run dev        # wrangler dev at http://localhost:8787
npx wrangler tail  # live logs from the deployed Worker (separate terminal)
```

## Deploy

```bash
npx wrangler deploy
```

Goes straight to `https://modelprep-backend.iamdjem.workers.dev`. No staging environment, no rollback — be sure the change works locally first. See `npx wrangler tail` for live logs.

Secrets in production come from `wrangler secret put`, not `.dev.vars`:
```bash
npx wrangler secret put CULTS_USERNAME
npx wrangler secret put CULTS_API_KEY
```

## Routes

| Method + path | What |
|---|---|
| `GET /api/v1/health` | Liveness, no auth |
| `GET /api/v1/cults3d/me` | Authenticated Cults profile (auth sanity check) |
| `GET /api/v1/cults3d/categories` | Cults category tree — use this to refresh `CULTS_CATEGORY_MAP` |
| `GET /api/v1/cults3d/licenses` | Cults license list — use this to refresh `CULTS_LICENSE_MAP` |
| `GET /api/v1/cults3d/my-creations?limit=N&offset=N` | The caller's published creations |
| `GET /api/v1/cults3d/probe-fields` | Schema probing — sends deliberately invalid types to learn field shapes |
| `POST /api/v1/upload` | Multipart upload → R2 → returns `cdn.makerstats.io` URL |
| `GET\|HEAD /api/v1/files/:key` | Serves an R2 object (mostly superseded by the CDN at `cdn.makerstats.io`, kept for debug) |
| `POST /api/v1/cults3d/publish` | **GraphQL flow** — resolves frontend fields → Cults IDs → calls `createCreation`; returns `{ok, payload, substituted, response}` |
| `POST /api/v1/cults3d/publish-test` | Hardcoded GraphQL payload publish for wiring sanity |
| `POST /api/v1/cults3d/web/publish` | **Web flow** (reverse-engineered) — multipart files + form fields; orchestrates login → S3 upload → create → publish; returns `{ok, slug, designUrl, substituted}`. See [`docs/cults3d-web-flow.md`](docs/cults3d-web-flow.md). |
| `POST /api/v1/cults3d/web/unpublish` | **Web flow** — JSON `{slug}`, deactivates a listing (Cults's closest thing to delete) |

Auth:
- **GraphQL routes** read `X-Cults-Username` + `X-Cults-Api-Key` headers (revocable API key, scoped). Falls back to env vars for curl tests.
- **Web-flow routes** read `X-Cults-Email` + `X-Cults-Password` headers (full account login, broader trust ask). Same env-var fallback.

## File layout

```text
backend/
├── .dev.vars                ← secrets (GITIGNORED) — Cults API key + email/password
├── .dev.vars.example
├── wrangler.toml            ← Worker config + R2 binding
├── docs/
│   └── cults3d-web-flow.md  ← DEEP REFERENCE for the web flow — read before
│                              editing cults3d-web.ts. Endpoint sequence,
│                              every gotcha (login URL hyphen, 303 not 302,
│                              pricing enum, CORS allow-list, etc.), HAR
│                              capture origin, how to re-capture when Cults
│                              breaks something.
├── src/
│   ├── index.ts             ← routes, CORS, orchestration
│   ├── types.ts             ← Env + PublishPayload
│   ├── r2.ts                ← stageFile / serveFile (R2 — GraphQL flow only)
│   └── adapters/
│       ├── cults3d.ts            ← GraphQL adapter (Phase 3)
│       ├── cults3d-mappings.ts   ← frontend vocab → Cults IDs (shared)
│       └── cults3d-web.ts        ← Web-flow adapter (login, S3, create, publish, unpublish)
└── README.md
```

## Adding a new platform later

The shape that works (Cults3D):
1. New `adapters/<platform>.ts` with a single `<platform>CreateCreation(creds, payload)` function
2. New `adapters/<platform>-mappings.ts` with that platform's category/license tables + resolver functions
3. New routes in `index.ts`: `POST /api/v1/<platform>/publish` + the read endpoints needed (probably `/me`, `/categories`, `/licenses`)
4. New origin in `ALLOWED_ORIGINS` if it's a new frontend host

If the platform has no public API (MakerWorld), the adapter does HAR-derived reverse-engineering instead of GraphQL. Same external contract from the frontend's perspective.

## When you change something here, also update

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — if you changed routes, the field translation, CORS, R2 layout, or "non-obvious things"
- This README — if you changed file layout, deploy steps, or auth shape
