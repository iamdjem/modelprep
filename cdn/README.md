# modelprep-cdn

Cloudflare Pages project that serves files from the shared R2 staging bucket at `https://cdn.makerstats.io/<key>`. **This is the only URL Cults3D's cover-image fetcher accepts** — see ARCHITECTURE.md for why.

> Read [`../ARCHITECTURE.md`](../ARCHITECTURE.md) first for how this fits with the Worker, R2, and frontend.

## Why this exists

Cults3D's API downloads cover images from URLs we provide. Its allow-list rejects `*.workers.dev`, `*.r2.dev`, `*.pages.dev` — all Cloudflare's shared subdomains. A custom domain on Cloudflare passes the allow-list. `cdn.makerstats.io` is that custom domain — CNAME'd from the `makerstats.io` zone to `modelprep-cdn.pages.dev`.

The Worker uploads files to R2; this project reads them back. **Same R2 bucket, different hostname.**

## File layout

```
cdn/                          # CDN subdir of the iamdjem/modelprep monorepo
├── wrangler.toml             ← Pages config + R2 binding (binds modelprep-staging)
├── functions/
│   └── [[path]].ts           ← catch-all Function: any /<key> reads from STAGING
├── public/
│   ├── index.html            ← placeholder landing page
│   └── _routes.json          ← include: ["/staging/*"] so static files win for everything else
└── README.md
```

(`modelprep-cdn` is the Cloudflare Pages project name — used as `--project-name=modelprep-cdn` at deploy. The local directory is just `cdn/`.)

## Deploy

```bash
cd cdn
npx wrangler pages deploy public --project-name=modelprep-cdn --branch=main
```

Production URL: `https://modelprep-cdn.pages.dev` (auto), `https://cdn.makerstats.io` (custom domain).

**Under git** as part of the monorepo at `iamdjem/modelprep`. The "not under git" caveat that used to be here was outdated — it applied during the pre-monorepo period.

## Custom domain

`cdn.makerstats.io` is bound via the Cloudflare API:
```bash
# (already done once; for reference)
curl -X POST \
  https://api.cloudflare.com/client/v4/accounts/<account_id>/pages/projects/modelprep-cdn/domains \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"cdn.makerstats.io"}'
```

And a CNAME record `cdn → modelprep-cdn.pages.dev` (proxied) in the `makerstats.io` DNS zone — created via the Cloudflare dashboard.

## Routes

| Method | Path | What |
|---|---|---|
| GET, HEAD | `/staging/*` | Reads R2 object at that key, returns it with `content-type`, `etag`, `content-length`, and `access-control-allow-origin: *` |
| GET | anything else | Falls through to static asset (see `_routes.json`) |

HEAD support is critical — Cults validates each URL with HEAD before issuing the GET. Without it, every publish failed with "Could not download URL".

## When you change something here, also update

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — if you changed routing, the R2 binding, or the custom domain
- This README — if you changed file layout or deploy steps
