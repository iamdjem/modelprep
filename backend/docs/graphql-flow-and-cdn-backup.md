# GraphQL flow + cdn.makerstats.io — backup architecture

The web flow ([`cults3d-web-flow.md`](cults3d-web-flow.md)) is what production actually uses today. The GraphQL flow + Cloudflare R2 + the `cdn.makerstats.io` Pages CDN are **kept alive as a backup** in case the web flow ever breaks irreparably (e.g. Cults adds bot protection that defeats automated logins, or starts banning programmatic web-form use).

This doc explains exactly what we built for the backup path so a future-you (or another agent) can fall back to it without re-deriving everything from scratch.

> Quick decision tree for "Cults is broken, what now?"
> 1. Read [`cults3d-web-flow.md`](cults3d-web-flow.md) §"How to re-capture" first — most breakages are small and fixable in an hour
> 2. If the web flow is truly dead (Cults banned automated login, rate-limits us too aggressively, etc.) — flip the frontend to use the GraphQL routes documented below. All infrastructure for it is still in place.

---

## What's still deployed for the backup path

Three Cloudflare pieces, none of which the web flow needs:

| Piece | Where | Purpose | Cost |
|---|---|---|---|
| **Worker route `POST /api/v1/upload`** | `modelprep-backend.iamdjem.workers.dev` | Accepts multipart from browser, stores in R2, returns a CDN URL | $0 (free tier) |
| **R2 bucket `modelprep-staging`** | Cloudflare R2 | Holds uploaded files for ~48h before lifecycle auto-deletes them | $0 (free tier: 10GB) |
| **Pages project `modelprep-cdn`** | `cdn.makerstats.io` (CNAME → `modelprep-cdn.pages.dev`) | Public read-only HTTPS endpoint Cults can fetch from | $0 (free tier) |

Plus the GraphQL adapter + route:
- `backend/src/adapters/cults3d.ts` — GraphQL client + `createCreation` mutation wiring
- `backend/src/adapters/cults3d-mappings.ts` — shared with the web flow (category/license tables, free/paid rules)
- Route `POST /api/v1/cults3d/publish` in `index.ts` — accepts platform-neutral fields + URLs (not file blobs); forwards to GraphQL.

Active right now: all of it. The Worker still serves `/api/v1/upload` + `/api/v1/cults3d/publish`. R2 lifecycle still runs. CDN still serves what's in R2. We just don't *call* any of this from the frontend at the moment — frontend uses `/api/v1/cults3d/web/publish` instead.

---

## Why these pieces exist

### 1. Cults's cover-image deny-list — the original motivation

Cults's GraphQL `createCreation` mutation takes URLs, not file uploads. We give it URLs; Cults's server downloads from them. Critically, **Cults's cover-image fetcher silently denies these Cloudflare-shared subdomains**:

- `*.workers.dev`
- `*.r2.dev` (Cloudflare R2's public bucket URL pattern)
- `*.pages.dev`

If you send a cover URL on any of those hosts, Cults returns `"Could not download URL <url>"` instantly with zero inbound request to the URL. They never even try. Probable reasoning: high-abuse domain class.

Custom domains pass. So if we serve files from R2 via `cdn.makerstats.io` (a CNAME of `makerstats.io`, a domain Alex owns), Cults accepts them.

### 2. R2 staging + 48h auto-delete

The Worker's `/api/v1/upload` route:
1. Accepts a single file in a multipart form (field `file`)
2. Generates a key `staging/<timestamp>-<random>/<filename>`
3. Calls `env.STAGING.put(key, body, ...)` to write to R2
4. Returns a URL on the CDN domain: `https://cdn.makerstats.io/staging/<key>`

R2 has a lifecycle rule (set once via wrangler, persists in bucket config):
```
expire-staging-after-48h:
  prefix: staging/
  action: Expire objects after 2 days
```

So uploaded files self-clean within 48h — no manual cleanup needed, no risk of filling the 10GB free tier.

### 3. Pages project as the public CDN

The R2 bucket is bound to TWO things: the Worker (for writes) AND a Cloudflare Pages project called `modelprep-cdn` (for reads). The Pages project has a single catch-all Function in `functions/[[path]].ts` that reads from the bound R2 bucket — see `cdn/functions/[[path]].ts`.

Why a separate Pages project instead of having the Worker serve files? Because **the Pages project is what carries the custom domain**. Workers can have custom domains too but the setup is more involved; Pages was simpler. The Worker still has a debug `GET /api/v1/files/:key` route that serves from R2 — kept for curl testing, not used in production.

---

## End-to-end flow when GraphQL is active

```
┌──────────────────────────────────────────────────────────────────┐
│ FRONTEND (React)                                                 │
│ User clicks Publish:                                             │
│   for each file (cover, gallery, model files):                   │
│     POST /api/v1/upload (multipart, single file)                 │
│           → returns { url: "https://cdn.makerstats.io/staging/…" │
│   POST /api/v1/cults3d/publish (JSON)                            │
│         body: { title, description, coverImageUrl, modelFileUrls,│
│                 category, license, free, price, tags }           │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ WORKER (TypeScript on Cloudflare Workers)                        │
│                                                                  │
│ /api/v1/upload:                                                  │
│   1. Verify auth (X-Cults-Username + X-Cults-Api-Key)            │
│   2. Parse multipart                                             │
│   3. env.STAGING.put(key, blob)  → R2                            │
│   4. Return URL on cdn.makerstats.io                             │
│                                                                  │
│ /api/v1/cults3d/publish:                                         │
│   1. Verify auth                                                 │
│   2. Resolve platform-neutral fields to Cults IDs                │
│      (category → Relay base64, license → Cults code, etc.)       │
│   3. POST GraphQL mutation `createCreation` with the URLs        │
│   4. Return Cults's response with substituted[] warnings         │
└──────────────────────────────────────────────────────────────────┘
                              │                              │
                  R2 read     │                              │ POST GraphQL
                              ▼                              ▼
┌──────────────────────────────────────────────────────┐  ┌──────────────────┐
│ CDN (Pages — cdn.makerstats.io)                      │  │ CULTS3D          │
│ Catch-all function reads R2 → 200 with file body     │◀─┤ cults3d.com/     │
│ Public, no auth, content-type from R2 metadata       │  │ graphql          │
└──────────────────────────────────────────────────────┘  │                  │
                                                          │ createCreation   │
                                                          │ fetches each URL │
                                                          │ from the CDN     │
                                                          └──────────────────┘
```

Compare to the web flow's pipeline, which is shorter on our side because Cults's own S3 holds the files:

```
FRONTEND → /api/v1/cults3d/web/publish (multipart, all files at once)
              ↓
WORKER:
   login as the user
   per file: get S3 policy from Cults, POST to S3, register with Cults
   POST /en/creations (form-encoded)
   POST /en/creations/<slug>/price (form-encoded)
              ↓
   Cults: files already on their CDN; no fetching from us required
```

---

## How to switch the frontend back to the GraphQL flow

The frontend currently has `CultsUploadFlow` (in `deploy/src/App.jsx`) calling `/api/v1/cults3d/web/publish`. The GraphQL endpoint expects a different shape — file URLs (not file bytes) in a JSON body — so reverting takes ~30 minutes of frontend changes:

1. **Auth shape change**: web flow uses `X-Cults-Email` + `X-Cults-Password`. GraphQL uses `X-Cults-Username` + `X-Cults-Api-Key`. Add back the API-key form (the old code is in git history before commit `63c44b0`).
2. **Per-file pre-upload**: before calling `/publish`, loop over files calling `POST /api/v1/upload` for each — that returns the `cdn.makerstats.io` URL. Collect URLs into `coverImageUrl`, `galleryImageUrls`, `modelFileUrls`.
3. **JSON body to `/api/v1/cults3d/publish`** with the URLs + the same platform-neutral category/license/free/price/tags fields.
4. **Response shape differs** — GraphQL returns `data.response.data.createCreation.creation.url` and `data.response.data.createCreation.errors[]`. Web flow returns `designUrl` + `slug` at the top level.

Most of the code we need to bring back lives in commit `63c44b0` (before the Phase B rewrite). `git show 63c44b0:deploy/src/App.jsx` will have the working GraphQL `publish()` function — copy out the upload-loop logic + JSON publish call.

Once flipped:
- GraphQL flow has fewer features (no real tags, only PUBLIC visibility, no deactivate/delete via API)
- But it's stable + sanctioned + doesn't depend on Cults's internal endpoints
- API keys are revocable (better trust story for distribution — see ARCHITECTURE.md)

---

## How to deploy / verify the backup path is still alive

You can probe it without touching the frontend at any time:

```bash
# 1. Test upload (any small file)
curl -X POST https://modelprep-backend.iamdjem.workers.dev/api/v1/upload \
  -H "X-Cults-Username: <your-cults-nick>" \
  -H "X-Cults-Api-Key: <your-cults-api-key>" \
  -F "file=@/tmp/test.stl"
# Should return: { ok: true, url: "https://cdn.makerstats.io/staging/...", ... }

# 2. Confirm the CDN serves it
curl -I "https://cdn.makerstats.io/staging/<key-from-above>"
# Should return: HTTP/2 200, content-type matching the file

# 3. Test publish (uses test creds — published as live on your profile)
curl -X POST https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/publish \
  -H "Content-Type: application/json" \
  -H "X-Cults-Username: ..." -H "X-Cults-Api-Key: ..." \
  -d '{
    "title": "backup-path sanity check",
    "description": "Verifying GraphQL flow still works.",
    "coverImageUrl": "<URL from step 1>",
    "modelFileUrls": ["<URL from step 1>"],
    "category": "Art & Decor",
    "license": "ccby",
    "free": true,
    "price": 0
  }'
# Should return: { ok: true, response: { data: { createCreation: { creation: { url: "https://cults3d.com/..." } } } } }
```

If any of these break, the backup path is no longer reliable and you'd need to fix it before flipping the frontend back.

---

## What we can retire IF we want to fully commit to the web flow

If at some point you decide the web flow is reliable enough to drop the backup, here's the deletion order (don't actually do this without thought):

1. **Frontend** — delete the `uploadFile()` helper + any GraphQL-flow paths
2. **Worker routes** — delete `/api/v1/upload`, `/api/v1/files/*`, `/api/v1/cults3d/publish`, `/api/v1/cults3d/publish-test`
3. **R2 bucket** — `npx wrangler r2 bucket delete modelprep-staging` (after confirming nothing references it)
4. **Worker binding** — remove `[[r2_buckets]]` block from `backend/wrangler.toml` and redeploy
5. **Pages project** — `npx wrangler pages project delete modelprep-cdn`
6. **DNS** — delete the `cdn` CNAME on makerstats.io (Cloudflare dashboard)
7. **Adapters** — delete `backend/src/adapters/cults3d.ts` (keep `cults3d-mappings.ts` — the web flow uses it too)
8. **Docs** — delete this file + the relevant sections of ARCHITECTURE.md

Estimated reversal cost if you change your mind: 1-2 hours to rebuild the R2 + CDN + custom domain, ~2 hours to re-wire the frontend, and the secret URL hash on cdn.makerstats.io changes meaning any external references die.

**Current recommendation: don't retire.** Keep it as the disaster-recovery path. Net cost is $0/month and the infrastructure already exists.

---

## Diagnostic gotchas that took time to find originally

Documented here so they're not re-discovered:

1. **`%2F` double-encoding** — Cults's HTTP client re-encodes `%` → `%25`, turning `%2F` into `%252F` and 404ing. Our `r2.ts:stageFile` builds URLs with raw `/` segments via `key.split('/').map(encodeURIComponent).join('/')` instead of `encodeURIComponent(key)` whole.
2. **`HEAD` validation before `GET`** — Cults's fetcher sends HEAD first to validate. Our `/api/v1/files/:key` route + the Pages function both accept both methods. If only GET worked, every publish failed with "Could not download URL".
3. **Cults rejects explicit `null`** on optional GraphQL args — pass nothing, not `null`.
4. **GraphQL types are `LocaleEnum` / `CurrencyEnum`**, not what the docs example shows (`Locale`/`Currency`).
5. **Free licenses (CC) only valid on free listings; cults_cu only on paid** — `LICENSE_RULES` in `cults3d-mappings.ts` enforces this. The publish auto-swaps and reports in `substituted: []`.

If GraphQL flow ever needs reviving, also see `cults-host-deny-list-2026-05.md` in agent memory for the host-list probing methodology.
