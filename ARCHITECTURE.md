# ModelPrep architecture

**Last verified working**: 2026-05-23 — first real one-click publish to Cults3D from `iamdjem.github.io/modelprep-prototype/`. Single test listing live at https://cults3d.com/en/3d-model/game/modelprep-final-end-to-end (test account `minimal_studio_3d`).

This is the single source of truth for "how does ModelPrep actually run." Update this file whenever the wiring changes.

---

## What ModelPrep does

A creator drops STL/3MF files + photos into a React UI, fills in title/description/category/license/price, clicks **Publish to Cults3D**, and a listing appears on their Cults profile. Same UX is planned for MakerWorld, Thingiverse, Printables, etc. — each platform plugs in behind the same prep flow.

---

## Three deployed pieces

```
┌────────────────────────────────┐       ┌──────────────────────────────────┐
│ FRONTEND                       │       │ BACKEND (Cloudflare Worker)      │
│ iamdjem.github.io/             │       │ modelprep-backend.iamdjem        │
│   modelprep-prototype/         │──────▶│   .workers.dev                   │
│                                │POST   │                                  │
│ React + Vite, single-file      │ files │ TypeScript, routes:              │
│ src/App.jsx (~3500 LOC).       │ + pub │   /api/v1/health                 │
│ User picks Cults creds, picks  │       │   /api/v1/cults3d/me             │
│ files, picks category etc.     │       │   /api/v1/cults3d/categories     │
│ Stores files as blobs in       │       │   /api/v1/cults3d/licenses       │
│ React state until publish.     │       │   /api/v1/cults3d/my-creations   │
│                                │       │   /api/v1/cults3d/publish        │
│                                │       │   /api/v1/upload  (multipart→R2) │
│ Monorepo: iamdjem/modelprep    │       │   /api/v1/files/* (R2→client)    │
│ Subdir: deploy/                │       │                                  │
└────────────────────────────────┘       │ Maps frontend's category/license │
                                         │ /price to Cults's specific IDs;  │
                                         │ enforces free/paid license rules │
                                         │ via src/adapters/cults3d-        │
                                         │ mappings.ts.                     │
                                         │                                  │
                                         │ Subdir: backend/                 │
                                         └──────────────────────────────────┘
                                                        │           │
                                          PUT/GET R2    │           │ POST GraphQL
                                                        ▼           ▼
                                 ┌─────────────────────────┐   ┌─────────────────┐
                                 │ R2 BUCKET               │   │ CULTS3D         │
                                 │ modelprep-staging       │   │ cults3d.com/    │
                                 │                         │   │   graphql       │
                                 │ Holds uploaded files    │   │                 │
                                 │ under staging/<ts>-<id>/│   │ createCreation  │
                                 │   <filename>.           │   │ mutation —      │
                                 │ Lifecycle: auto-delete  │   │ takes URLs for  │
                                 │ after 48h.              │   │ cover + gallery │
                                 │                         │   │ + model files,  │
                                 │ Same bucket bound to    │   │ fetches them    │
                                 │ both the Worker (WRITE) │   │ server-side.    │
                                 │ and the CDN below       │   │                 │
                                 │ (READ).                 │   │ Basic Auth with │
                                 └─────────────────────────┘   │ creator's API   │
                                              ▲                │ key.            │
                                              │ R2 read        └─────────────────┘
                                              │                         ▲
                                              │                         │ HEAD then GET
                                              │                         │ each URL
                                 ┌─────────────────────────┐            │
                                 │ CDN (Cloudflare Pages)  │            │
                                 │ cdn.makerstats.io       │────────────┘
                                 │ (custom domain, CNAME   │
                                 │ from makerstats.io zone │
                                 │ → modelprep-cdn         │
                                 │ .pages.dev)             │
                                 │                         │
                                 │ Catch-all Pages         │
                                 │ Function in             │
                                 │ functions/[[path]].ts   │
                                 │ serves R2 objects.      │
                                 │ Public, no auth.        │
                                 │                         │
                                 │ Subdir: cdn/            │
                                 └─────────────────────────┘
```

### Why all three pieces?

- **The Worker can't be the file URL Cults fetches.** Cults's cover-image fetcher silently denies `*.workers.dev`, `*.r2.dev`, and `*.pages.dev` (all Cloudflare's shared subdomains). Only custom domains pass. That's why the CDN exists on `cdn.makerstats.io` — a subdomain you own.
- **The R2 bucket is shared between Worker and CDN.** Worker writes via `env.STAGING.put(...)`, CDN reads via `env.STAGING.get(...)`. They both have the same `[[r2_buckets]]` binding pointing at `modelprep-staging` in their respective `wrangler.toml` files.
- **The frontend never talks to R2 or Cults directly.** It goes through the Worker for everything. That keeps Cults credentials out of CORS issues and centralizes the "translate ModelPrep vocab to Cults IDs" logic.

---

## Deploy & commit map — important, read this

All three pieces live in **one monorepo: `iamdjem/modelprep`**. Different parts have different deploy targets, but everything's under one `git push`.

| Piece | Subdir | How to deploy |
|---|---|---|
| Frontend | `deploy/` | `git push origin main` (touching `deploy/**`) → GitHub Actions builds + publishes to GitHub Pages at `iamdjem.github.io/modelprep/` |
| Worker | `backend/` | `cd backend && npx wrangler deploy` — uploads local files to Cloudflare Workers, no auto-deploy from git |
| CDN | `cdn/` | `cd cdn && npx wrangler pages deploy public --project-name=modelprep-cdn --branch=main` — uploads local files to Cloudflare Pages, no auto-deploy from git |

**Why backend + CDN aren't auto-deployed from git:** adding a GH Actions workflow for either requires storing a Cloudflare API token as a repo secret, which isn't worth the setup for a personal-scale tool. Worth doing later if manual `wrangler deploy` becomes annoying. For now: edit, test locally, run wrangler, done.

**History:** the frontend's pre-monorepo commits (from when it was `iamdjem/modelprep-prototype`) are preserved under `deploy/` via `git filter-repo --to-subdirectory-filter`. Backend + CDN have no pre-monorepo history (they weren't tracked before).

**Predecessor repo:** `iamdjem/modelprep-prototype` is archived; its README redirects here. The old GitHub Pages URL `iamdjem.github.io/modelprep-prototype/` still serves the last build for backwards compatibility.

---

## Resources & costs

| Resource | What | Cost |
|---|---|---|
| Cloudflare Workers | The backend Worker | Free tier — 100K req/day plenty for personal use |
| Cloudflare R2 | File staging | Free tier — 10 GB storage, 1M Class A ops/month |
| Cloudflare Pages | The CDN | Free tier — unlimited bandwidth |
| Cloudflare Domain | `makerstats.io` (already owned for the makerstats project) | ~$10/year |
| GitHub Pages | Frontend hosting | Free |
| Cults3D account | Test account `minimal_studio_3d` | Free |
| **Total monthly** | | **$0** (domain renewal once a year) |

Free tiers are generous enough that public traffic won't break this. R2 lifecycle (48h auto-delete) prevents storage from creeping past the free tier.

---

## Two ways to publish — GraphQL vs Web flow

There are now **two parallel adapters** for Cults3D. The frontend can pick whichever fits the user's auth + feature needs.

### Cults3D GraphQL flow — `backend/src/adapters/cults3d.ts`
The public, documented API. Stable, sanctioned, simpler auth (API key). Limitations are real:

| Frontend value | What Worker sends to Cults | Source of truth |
|---|---|---|
| `category: 'Toys & Games'` | `categoryId: 'Q2F0ZWdvcnkvMzE'` (Cults Relay base64 ID for "Game") | `CULTS_CATEGORY_MAP` in `cults3d-mappings.ts`; refresh by `/api/v1/cults3d/categories` |
| `license: 'ccby'` | `licenseCode: 'cc_by'` (or `cults_cu` if listing is paid — Cults forbids CC on paid) | `CULTS_LICENSE_MAP` + `resolveCultsLicense()` in mappings.ts; refresh by `/api/v1/cults3d/licenses` |
| `price: 4.50, free: false` | `downloadPrice: 4.50, currency: 'USD'` | Hard-coded; only USD wired in mappings |
| `tags: ['dragon', ...]` | **Not forwarded** | Cults's `metaTags` rejects all common words ("Unknown meta tag") — internal vocab, not user keywords. Use web flow if you need real tags. |
| `coverImageUrl` (browser blob) | `https://cdn.makerstats.io/staging/.../cover.jpg` | Worker stages to R2 first, mints CDN URL in `r2.ts:stageFile`. Custom domain required because Cults blocks `*.workers.dev`/`*.r2.dev`/`*.pages.dev` for cover images. |

Any swap (license incompatibility, unmapped category, dropped tags) is reported back in the `substituted: []` array so the frontend can show a warning.

### Cults3D Web flow — `backend/src/adapters/cults3d-web.ts`

**Deep reference: [`backend/docs/cults3d-web-flow.md`](backend/docs/cults3d-web-flow.md)** — full request-sequence diagram, per-endpoint field documentation, 12 documented gotchas, and how to re-capture when Cults breaks something. Read that BEFORE editing the adapter.

**GraphQL/CDN backup**: the older URL-based GraphQL flow + the `cdn.makerstats.io` Pages project + R2 staging are **all still deployed as a fallback** in case the web flow ever breaks irreparably. See [`backend/docs/graphql-flow-and-cdn-backup.md`](backend/docs/graphql-flow-and-cdn-backup.md) for what's there, how to switch back, and how to verify it still works.

**Distribution planning**: thoughts on what to add before sharing this widely live in [`docs/distribution-plan.md`](docs/distribution-plan.md).

Reverse-engineered from the cults3d.com upload form (HAR capture from `/Users/alex/MakerStats-Android/output/cults-capture/`). Strictly more capable than GraphQL — but uses email + password, and depends on undocumented internal endpoints that Cults can change without notice.

What the web flow unlocks that GraphQL can't:
- **Files upload to Cults's own S3** (`s3.eu-west-3.amazonaws.com/files.cults3d.com`) via signed POST policies. No CDN allow-list problem, no R2 staging needed.
- **Tags actually work** — `creation[flat_keywords]=dragon test calibration` is plain text. Confirmed on the live test listing (tags rendered as `<a href="/en/tags/dragon">` etc.).
- **`creation[usages][]=3dp`** — found the magic value GraphQL couldn't reveal.
- **`creation[meta_tags][]=no_support`** — at least one valid meta_tags value confirmed.
- **`visibility=secret`** — listing is unguessable-URL-only, doesn't appear on profile or search. GraphQL only allowed PUBLIC.
- **`POST /en/creations/<slug>/unpublish`** — deactivates a listing. Closest thing to delete Cults exposes.
- **Category IDs are plain integers** (`category_id=25` for Gadget) — same underlying ID as the GraphQL Relay version, just unwrapped.

Routes:
- `POST /api/v1/cults3d/web/publish` — full flow: login → upload files → create draft → set price/visibility → return URL. Multipart body: `name`, `description`, `categoryId`, `currency`, `pricing`, `licenseType`, `visibility`, `flatKeywords` (text fields) + one or more `model` and `illustration` (file fields). Headers: `X-Cults-Email`, `X-Cults-Password`.
- `POST /api/v1/cults3d/web/unpublish` — JSON `{slug}`, same headers, deactivates the listing.

Trade-off vs GraphQL: brittle to Cults updates. When something breaks, re-capture the failing step in browser DevTools and patch the adapter. Login URL changed once already during integration (`sign_in` → `sign-in`), and Cults uses 303 not 302 for some redirects.

---

## The non-obvious things that broke during build-out

Documented here so future you (or another agent) doesn't re-debug them:

1. **`%2F` in URLs gets double-encoded by Cults's fetcher.** Cults's HTTP client treats the URL as a string and re-encodes `%` → `%25`, turning `%2F` into `%252F` and 404ing. Fix: encode each path segment individually, leave the `/` literal. See `backend/src/r2.ts:stageFile`.
2. **Cults validates URLs with `HEAD` before `GET`.** Initially our file route only matched `GET`, so HEAD returned 404 and Cults gave up. Fix: route accepts both. See `backend/src/index.ts` `path.startsWith('/api/v1/files/')` block.
3. **Cults denies Cloudflare-owned shared subdomains for cover images.** `*.workers.dev`, `*.r2.dev`, `*.pages.dev` all silently rejected with "Could not download URL" — no inbound request to our origin. Custom domains work. This is why `cdn.makerstats.io` exists.
4. **Cults rejects explicit `null` on optional GraphQL args.** Omit fields entirely; don't pass `null`.
5. **GraphQL types are `LocaleEnum` / `CurrencyEnum`** (not `Locale` / `Currency` like the docs example suggests).
6. **Free licenses (CC) only work on free listings; CULTS commercial licenses only on paid.** Mappings enforce this. See `LICENSE_RULES` in `cults3d-mappings.ts`.
7. **`createCreation` is the only public mutation we use via GraphQL.** Cults's public GraphQL has `updateCreation` (probed, exists) but NO `deleteCreation`/`destroyCreation`/etc. The web flow does expose both deactivate AND true permanent delete though — see [`backend/docs/cults3d-web-flow.md`](backend/docs/cults3d-web-flow.md) §6a (`POST /en/creations/<slug>/unpublish`) vs §6b (`DELETE /en/creations/<slug>`). Use the web-flow routes (`/api/v1/cults3d/web/unpublish`, `/api/v1/cults3d/web/delete`) when you need to clean up.
8. **GraphQL introspection is disabled.** `__type(name: "Mutation")` returns null. We learn the schema by sending probes with deliberately invalid types and reading the error messages back. See `/api/v1/cults3d/probe-fields` in the Worker.
9. **Adding a new request header from the browser? Update the Worker's `Access-Control-Allow-Headers` allow-list too.** Browsers enforce it strictly on the CORS preflight: an unlisted header causes the actual request to never reach the Worker — the fetch fails with "Failed to fetch" client-side, and `wrangler tail` shows nothing inbound. Search `index.ts` for `Access-Control-Allow-Headers` and append the new header name.
10. **Web flow gotchas** (separate set, since these endpoints aren't documented):
   - Login URL is `/en/users/sign-in` with a HYPHEN, not `_sign_in_` like Devise defaults.
   - Login redirect is **303 See Other**, not 302. Accept both.
   - Sign-in failure also redirects (back to `/en/users/sign-in`) — distinguish success from failure by the redirect Location, not just status code.
   - `/en/file_uploaders/new?<kind>=true` returns the S3 form fields **flat** (no `{url, fields}` wrapper). The S3 URL itself is hardcoded — `https://s3.eu-west-3.amazonaws.com/files.cults3d.com` — and must match what the policy was signed for.
   - Include `Content-Type` as a form field when POSTing to S3 (the policy requires it via `starts-with $Content-Type ""`).
   - Rails strong_parameters expects array fields to start with an empty entry, hence the `creation[usages][]=&creation[usages][]=3dp` shape in the HAR.
   - **`creation[pricing]` accepts `free` / `priced` / `open_priced`** — NOT `paid` / `open`. Sending the wrong value comes back as "Pricing isn't included in the list" (Rails `inclusion:` validator). Inspect the price/edit form's radio buttons to confirm — they're the authoritative list.
   - **`creation[visibility]` accepts `public` / `secret` / `deactivated`** — three states, not two. `deactivated` is what the unpublish endpoint sets it to.

---

## How to verify it's still working

After any change, sanity-check end-to-end:

```bash
# 1. Worker health
curl https://modelprep-backend.iamdjem.workers.dev/api/v1/health

# 2. Cults auth (returns your profile)
curl https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/me \
  -H "X-Cults-Username: minimal_studio_3d" \
  -H "X-Cults-Api-Key: <key from .dev.vars>"

# 3. CDN serves R2 (any existing key)
curl -I https://cdn.makerstats.io/staging/.../some-file.jpg

# 4. Full publish (creates a real test listing)
# Pick something tiny and delete it after via cults3d.com web UI.
curl -X POST https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/publish \
  -H "Content-Type: application/json" \
  -H "X-Cults-Username: ..." -H "X-Cults-Api-Key: ..." \
  -d '{"title":"sanity check","description":"x",
       "coverImageUrl":"<some cdn.makerstats.io URL>",
       "modelFileUrls":["<some cdn.makerstats.io URL>"],
       "category":"Art & Decor","free":true}'
```

Also see `wrangler tail --format pretty` from `modelprep-backend/` for live Worker logs during a browser session.

---

## What's deferred / known gaps

- **User tags don't sync to Cults.** Cults's `metaTags` field accepts strings but rejects all common-word user keywords — it's an internal classification vocabulary we haven't reverse-engineered. HAR capture of cults3d.com's upload form would reveal it.
- **`usages` field name unknown.** Cults's listing shows "Usages: 3D printing" but the GraphQL field name doesn't match any enum we probed (`CreationUsageEnum`, `CreationUsageTypeEnum`, etc. all rejected). HAR would help.
- **No deleteCreation mutation exists.** Cleanup of test listings is manual via cults3d.com web UI. HAR capture of one delete would reveal cults3d.com's internal delete endpoint, which we could then call from the Worker.
- **No other platforms yet.** Cults3D is the only platform with a working API. MakerWorld has no public API — needs full HAR-based reverse-engineering. Thingiverse has OAuth (deferred). Printables, MMF, Thangs are TBD.
- **R2 lifecycle is 48h.** If Cults takes >48h to fetch (unusual), the URL would 404. Probably never happens in practice but worth knowing.
- **Frontend stores Cults API key in `localStorage`.** Survives reloads but anyone with laptop access can grab it. Personal-tool acceptable; not for sharing.
- **Backend + CDN have no git history.** See "Deploy & commit map" above.

---

## When you change something, update this doc

If you (human or agent) modify anything that affects the diagram, the commit/deploy map, the field translations, or the "non-obvious things" list, **edit this file in the same commit**. The doc lives in the project root so it travels with the working tree.
