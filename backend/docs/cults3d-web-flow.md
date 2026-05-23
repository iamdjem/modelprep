# Cults3D web-flow research + reference

This is the canonical reference for everything ModelPrep knows about Cults3D's reverse-engineered web upload flow. **Read this before changing `backend/src/adapters/cults3d-web.ts`** — every gotcha was hard-won and easy to re-introduce.

For the high-level architecture (how this fits with the GraphQL flow, R2, CDN, etc.) see [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md). This doc is the deep dive on the web flow itself.

---

## Why this exists

Cults3D's **public GraphQL API** (`cultsCreateCreation` mutation) has hard limits we hit during Phase 3 development:

- `metaTags` rejects every common user keyword ("Unknown meta tag")
- `usages` field name is unknowable (every enum type we probed was rejected)
- Only `visibility: PUBLIC` allowed — no draft/secret/private state
- No `deleteCreation` mutation exists
- Cover image URLs from `*.workers.dev` / `*.r2.dev` / `*.pages.dev` get silently rejected — we had to build `cdn.makerstats.io` (Cloudflare Pages + custom domain + R2 binding) just to dodge that

The Cults **web upload form** has none of those limits — it accepts plain-text tags, supports `secret` visibility, has an unpublish/deactivate endpoint, and uploads files directly to Cults's own S3 bucket. The only catch is that it's undocumented internal infrastructure that Cults can change without notice.

---

## Origin — where the knowledge came from

The web-flow request shapes were captured by a separate agent working in a different repo (`MakerStats-Android`) on 2026-05-23. They did one complete manual upload + one delete on cults3d.com with Chrome DevTools Network panel recording, then sanitized the requests (cookies, CSRF tokens, S3 signatures, AWS credentials, UUIDs all redacted) and handed off the result.

### Where the raw captures live

Outside this repo, on the same machine:

```text
/Users/alex/MakerStats-Android/output/cults-capture/
├── cults-upload-notes.md           ← read first; human-readable summary
└── sanitized/
    ├── 352-file-uploader-blueprint.txt    GET signed-S3-policy for model
    ├── 353-s3-blueprint.txt               POST model file to S3
    ├── 354-blueprints.txt                 POST /en/blueprints register call
    ├── 354-blueprints-body.txt            { "key": "uploaders/.../...stl" }
    ├── 356-file-uploader-illustration.txt GET signed-S3-policy for image
    ├── 357-s3-illustration.txt            POST image to S3
    ├── 358-illustrations.txt              POST /en/illustrations register call
    ├── 358-illustrations-body.txt         { "key": "uploaders/.../...png" }
    ├── 359-create-creation.txt            POST /en/creations metadata
    ├── 359-create-creation-body.txt       form-encoded creation payload
    ├── 408-publish-price.txt              POST /en/creations/<slug>/price
    ├── 408-publish-price-body.txt         form-encoded publish payload
    ├── 3301-unpublish.txt                 POST /en/creations/<slug>/unpublish
    ├── 3301-unpublish-body.txt            authenticity_token=<CSRF>
    ├── relevant-network-list.txt          upload-flow request index
    └── delete-network-list.txt            deactivate-flow request index
```

**The raw `.har` was deleted after sanitization.** What's there is the structural shape of every request — URL, method, headers, body shape — with sensitive values redacted. That's enough to derive the implementation from.

Useful commands when re-checking the source:

```bash
cd /Users/alex/MakerStats-Android
sed -n '1,240p' output/cults-capture/cults-upload-notes.md
ls -la output/cults-capture/sanitized
sed -n '1,200p' output/cults-capture/sanitized/359-create-creation-body.txt
sed -n '1,200p' output/cults-capture/sanitized/408-publish-price-body.txt
```

**The capture is the source-of-truth for "what Cults's web form sends."** Our adapter is the source-of-truth for "what we send to Cults." When they diverge, Cults wins — the form behavior is the contract.

---

## End-to-end request sequence

One full publish = 6 logical steps = ~10 HTTP requests. All requests except the S3 PUTs go through `https://cults3d.com/...`.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. LOGIN                                                        │
│    GET  /en/users/sign-in        (200 — scrape CSRF, get cookie)│
│    POST /en/users/sign-in        (303 → /en on success)         │
│    GET  /en/creations/new        (200 — confirm auth + grab new │
│                                   CSRF for upload form)         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼  for each model file (STL/3MF/...)
┌─────────────────────────────────────────────────────────────────┐
│ 2. UPLOAD MODEL                                                 │
│    GET  /en/file_uploaders/new?blueprint=true                   │
│         → 200 JSON { key, policy, x-amz-* }                     │
│    POST https://s3.eu-west-3.amazonaws.com/files.cults3d.com    │
│         → 201 Created (signed POST policy upload)               │
│    POST /en/blueprints                                          │
│         body: { "key": "uploaders/.../filename.stl" }           │
│         → 200 JSON { id: <integer> }                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼  for each image (cover + gallery)
┌─────────────────────────────────────────────────────────────────┐
│ 3. UPLOAD ILLUSTRATION                                          │
│    GET  /en/file_uploaders/new?illustration=true                │
│    POST https://s3.eu-west-3.amazonaws.com/files.cults3d.com    │
│    POST /en/illustrations  → 200 JSON { id: <integer> }         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. CREATE CREATION (draft state)                                │
│    POST /en/creations                                           │
│         form fields: name, description, details,                │
│           category_id, sub_category_ids[], usages[],            │
│           meta_tags[], flat_keywords,                           │
│           blueprint_ids[], illustration_ids[],                  │
│           made_with_ai, show_comments                           │
│         → 302/303 to /en/creations/<slug>/price/edit            │
│           Parse slug from Location header                       │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. PUBLISH (set price + visibility)                             │
│    POST /en/creations/<slug>/price                              │
│         form fields: _method=patch, in_store, currency,         │
│           pricing, download_price, download_open_price,         │
│           license_type, visibility, commit=Publish              │
│         → 302/303 to https://cults3d.com/en/3d-model/<cat>/...  │
│           That Location IS the final design URL we return       │
└─────────────────────────────────────────────────────────────────┘

         optional, separate call later
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. UNPUBLISH (deactivate)                                       │
│    POST /en/creations/<slug>/unpublish                          │
│         form body: authenticity_token=<CSRF>                    │
│         header: x-csrf-token: <CSRF>                            │
│         → 302 to canonical design page                          │
│           Listing now shows as "Offline" in /en/creations/mine  │
│           and 404s for anonymous users.                         │
└─────────────────────────────────────────────────────────────────┘
```

Total wall-clock time observed: **3-5 seconds** for a small test publish (tiny STL + tiny PNG).

---

## Per-endpoint detail

### 1. Login

**`POST /en/users/sign-in`** *(yes, hyphen — see gotcha #1)*

Request headers:
```
Content-Type: application/x-www-form-urlencoded
Cookie: <whatever you got from GET sign-in page>
Origin: https://cults3d.com
Referer: https://cults3d.com/en/users/sign-in
```

Request body (URL-encoded):
```
authenticity_token=<CSRF from <meta name="csrf-token"> on sign-in page>
user[email]=<email>
user[password]=<password>
user[time_zone]=
commit=Log in
```

Response on success: **303 See Other** *(NOT 302 — see gotcha #2)*, Location is anything except `/en/users/sign-in`. Server sets a new `_session_id` cookie that carries authenticated identity.

Response on bad credentials: **303** with `Location: .../users/sign-in` (sends user back to the form). Distinguish via the Location header, not status code.

After login: GET `/en/creations/new` to (a) confirm the session is actually authenticated and (b) grab the fresh CSRF token from that page's `<meta name="csrf-token">` — that's what subsequent uploads need.

### 2. Upload model file (per file)

**`GET /en/file_uploaders/new?blueprint=true`**

Request headers:
```
Accept: application/json
Content-Type: application/json
X-Requested-With: XMLHttpRequest
X-CSRF-Token: <from /en/creations/new>
Cookie: <session>
Referer: https://cults3d.com/en/creations/new
```

Response body (flat JSON, **NOT wrapped in `{url, fields}`** — see gotcha #3):
```json
{
  "key": "uploaders/41998834/blueprint-file/<uuid>/${filename}",
  "acl": "public-read",
  "success_action_status": "201",
  "policy": "<base64 — decodes to { bucket: 'files.cults3d.com', region: 'eu-west-3', ... }>",
  "x-amz-credential": "AKIA.../20260523/eu-west-3/s3/aws4_request",
  "x-amz-algorithm": "AWS4-HMAC-SHA256",
  "x-amz-date": "20260523T201453Z",
  "x-amz-signature": "<hex>"
}
```

**`POST https://s3.eu-west-3.amazonaws.com/files.cults3d.com`** *(URL is constant — baked into the signed policy)*

Multipart form data, fields **in this order**:
1. All the policy fields from the previous response (key, acl, policy, x-amz-*)
2. `Content-Type` — set to the file's MIME (required by the policy's `starts-with $Content-Type ""` rule — see gotcha #4)
3. `file` — the binary, **must be last** per S3 POST convention

Response: **201 Created**, body is XML with the new object's location.

S3 substitutes `${filename}` in the `key` with whatever filename you submitted with the `file` part. So the actual stored key is `uploaders/<id>/blueprint-file/<uuid>/<your-filename.stl>`.

**`POST /en/blueprints`** — register with Cults

Headers same as the GET (JSON + CSRF + XHR).

Body:
```json
{ "key": "uploaders/41998834/blueprint-file/<uuid>/your-filename.stl" }
```

Response: 200 JSON `{ id: <integer> }`. Save this integer — you submit it later as `creation[blueprint_ids][]=<id>`.

### 3. Upload illustration (per image)

Identical to step 2 but with `?illustration=true` instead of `?blueprint=true`, and `POST /en/illustrations` instead of `/en/blueprints`. Returns the same `{ id: <integer> }` shape.

The **first** illustration ID becomes the listing's primary cover image; remaining ones become the gallery in submission order.

### 4. Create creation

**`POST /en/creations`**

Headers:
```
Content-Type: application/x-www-form-urlencoded
Cookie: <session>
Origin: https://cults3d.com
Referer: https://cults3d.com/en/creations/new
Upgrade-Insecure-Requests: 1
```

Body — every field documented (canonical sample from the HAR):
```
authenticity_token=<CSRF>
creation[locale]=en
creation[name]=Temporary triangle calibration marker
creation[description]=<plain-text or markdown body>
creation[details]=<long-form print settings; can be empty>
creation[usages][]=                       (empty leader — required by Rails strong_parameters; see gotcha #5)
creation[usages][]=3dp                    (the real value)
creation[category_id]=25                  (INTEGER, not Relay base64 — see gotcha #6)
creation[sub_category_ids][]=
creation[sub_category_ids][]=41
creation[meta_tags][]=
creation[meta_tags][]=no_support
creation[flat_keywords]=dragon            (PLAIN TEXT — space- or comma-separated; THIS is the user-tag field, NOT meta_tags)
creation[blueprint_ids][]=14178582        (from step 2)
creation[illustration_ids][]=20486600     (from step 3 — first = cover)
creation[made_with_ai]=0
creation[show_comments]=0                 (Rails hidden-default for unchecked)
creation[show_comments]=1                 (the real value if checked)
button=
```

Response: **302/303** to `Location: /en/creations/<slug>/price/edit`. The slug is what you parse out — it's needed for step 5.

**Slug auto-uniquification**: if your `name` produces a slug that already exists on your account, Cults silently appends `-<your-nick>-<short-hash>`. Example: `articulating-desk-dragon-print-in-place` → `articulating-desk-dragon-print-in-place-minimal_studio_3d-c662`. Don't assume the slug matches the slugified name.

Response on validation failure: **422** with the form re-rendered + inline error messages. Adapter parses the alert/error/field-error divs from the HTML to surface a useful error.

### 5. Publish (set price + visibility)

**`POST /en/creations/<slug>/price`**

Headers like step 4.

Body:
```
_method=patch                              (Rails method-override; this is actually a PATCH operation)
authenticity_token=<CSRF>
creation[in_store]=true
creation[currency]=USD                     (ISO 4217 — required even when free)
creation[pricing]=free                     (or 'priced' or 'open_priced' — see gotcha #7)
creation[download_price]=0                 (required; ignored unless pricing=priced)
creation[download_open_price]=0            (suggested-min for pricing=open_priced; ignored otherwise)
creation[license_type]=cc_pddc             (Cults license code — same vocabulary as the GraphQL flow)
creation[visibility]=secret                (or 'public' — see gotcha #8 for the third value)
commit=Publish
```

Response: **302/303** to `Location: https://cults3d.com/en/3d-model/<category>/<slug>`. That Location IS the final design URL you'd share.

Response on validation failure: 422 with form re-render. Common cause: pricing value not in the allow-list (gotcha #7).

### 6. Unpublish / deactivate

**`POST /en/creations/<slug>/unpublish`**

Headers:
```
Accept: text/vnd.turbo-stream.html, text/html, application/xhtml+xml
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
X-CSRF-Token: <CSRF>
Cookie: <session>
Referer: https://cults3d.com/en/creations/mine
```

Body:
```
authenticity_token=<CSRF>
```

Response: 302 to the canonical design URL. After this:
- Anonymous users get HTTP 404 visiting the listing
- The listing appears as **"OFFLINE"** in `/en/creations/mine` for the owner
- Owner can re-activate by re-publishing (POST /en/creations/<slug>/price again)
- **There is NO true permanent-delete endpoint exposed by Cults**. Manual deletion is via the "..." menu in My Designs on cults3d.com — and even that may just permanently-deactivate, not destroy. Don't rely on being able to remove orphans programmatically.

---

## Gotchas (every one of these cost time to find)

### 1. Login URL uses HYPHEN, not underscore

Cults uses `/en/users/sign-in`, NOT the Devise default `/users/sign_in`. Probing both:

```bash
curl -sI https://cults3d.com/en/users/sign_in  # → 404
curl -sI https://cults3d.com/en/users/sign-in  # → 200
```

The Devise standard URL doesn't exist. Cults built their own routes table.

### 2. Login redirect is 303, not 302

Many Rails-based logins return 302; Cults returns **303 See Other**. The adapter accepts both. Failed credentials ALSO 303 (back to sign-in) — distinguish via the `Location` header, not the status code.

### 3. S3 policy response is FLAT

The `aws-sdk-presigned-post` library typically returns `{ url, fields }`. Cults returns the fields flat at the top level of the JSON. The S3 URL itself is constant and baked into the signed policy:

```
https://s3.eu-west-3.amazonaws.com/files.cults3d.com
```

If Cults ever moves regions or buckets, this URL must change AND the policy's `bucket` claim inside the base64 must agree.

### 4. Include `Content-Type` as a form field when POSTing to S3

The S3 policy has `["starts-with", "$Content-Type", ""]` — meaning the request must include a `Content-Type` form field (anything goes, but it must be present). Forgetting it gives a confusing AWS signature-mismatch error. Set it to the file's MIME type.

### 5. Rails strong_parameters wants array fields to start with an empty entry

The HAR shows `creation[usages][]=&creation[usages][]=3dp`. The empty leading entry is required — without it, Rails sometimes treats the field as missing entirely. Our adapter mirrors this pattern.

### 6. Category IDs are INTEGERS for the web flow, Relay base64 for GraphQL

The same underlying value, different encoding:
- GraphQL: `categoryId: "Q2F0ZWdvcnkvMjU="` (atob → `"Category/25"`)
- Web flow: `creation[category_id]=25`

`backend/src/adapters/cults3d-mappings.ts` exports `relayCategoryToInt(relayId)` that decodes the first to the second.

### 7. Pricing enum: `free` / `priced` / `open_priced` (NOT `paid` / `open`)

Caught this only by reading the `<input type="radio" name="creation[pricing]">` elements on the actual price/edit form. Sending `paid` or `open` returns 422 with **"Pricing isn't included in the list"** (Rails `inclusion:` validator).

Whenever Cults adds a new enum field, **fetch the form and read the actual radio/select values** before guessing. Don't rely on what looks natural in English.

### 8. Visibility has THREE values, not two

`public` / `secret` / `deactivated`. The unpublish endpoint sets a listing to `deactivated`. Our adapter only accepts `public` and `secret` for publish (deactivation is via the dedicated unpublish endpoint, not by submitting `visibility=deactivated` on the price form).

### 9. CORS allow-list trap when adding new request headers

Every time the frontend starts sending a new header (e.g. `X-Cults-Email`, `X-Cults-Password`), the Worker's `Access-Control-Allow-Headers` allow-list needs to include it. Browsers enforce the preflight strictly — the actual POST never reaches the Worker if the header isn't pre-approved, and `wrangler tail` shows nothing inbound. Error appears in the browser as `Failed to fetch`.

Search `backend/src/index.ts` for `Access-Control-Allow-Headers` and add the header name there.

### 10. Failed publish/price = orphan draft

If create succeeds but publish/price fails (e.g. validation error on pricing/license/visibility), the created draft is left on the user's account as `OFFLINE`. **It does NOT auto-clean.** Recovery: either call `unpublish` on the orphan immediately after the publish/price failure (TODO in our orchestrator), or have the user delete via Cults web UI.

This bit us during Phase B testing — the user ended up with 3 orphan "Articulating Desk Dragon" drafts in `/en/creations/mine` before we caught the pricing-enum issue.

### 11. `metaTags` is Cults's internal classification, NOT user tags

The GraphQL `metaTags: [String!]` accepts strings but validates each against an internal dictionary — common words ("dragon", "fan_art", "remix", etc.) all return "Unknown meta tag". Only specific values like `no_support` are accepted (one of the few in the dictionary we know).

For USER tags, use `flat_keywords` in the web flow — that's plain text, no validation.

### 12. The `usages` field name was unfindable via GraphQL

We probed every plausible enum name through `/api/v1/cults3d/probe-fields` — `CreationUsageEnum`, `CreationUsageTypeEnum`, `ManufacturingUsageEnum`, etc. — all rejected with "isn't a defined input type". The web flow uses `creation[usages][]=3dp` and just works. Some fields are only accessible through the web layer.

---

## How to re-capture when something breaks

When Cults ships a release and one of our requests starts failing:

1. **Reproduce the failure locally** — log into `https://cults3d.com` as a throwaway account in an Incognito Chrome window, open DevTools → Network, do the action that's broken in our adapter (login, upload, create, publish, or unpublish).
2. **Find the request that differs from our adapter** — compare URL, method, headers, body shape. Cults could have:
   - Renamed a form field (`creation[xxx]` → `creation[yyy]`)
   - Changed an enum value
   - Added a required header
   - Moved an endpoint
3. **Sanitize before sharing** — strip cookies, CSRF tokens, S3 signatures, auth credentials, UUIDs.
4. **Patch the adapter** in `backend/src/adapters/cults3d-web.ts` to match. Add to the gotchas list here if the change is non-obvious.
5. **Deploy** (`cd backend && npx wrangler deploy`) and verify with a curl test before the user notices.

The cleanest reproduction account to use is the existing throwaway: `u05l7e8tls@chefalicious.com` (stored in `backend/.dev.vars`).

---

## Known unknowns / things to capture later

- **`creation[meta_tags][]` full vocabulary** — we know `no_support` works; the rest of the list is unknown. The upload form has a dropdown — capture its `<option>` values to seed a mapping.
- **`creation[sub_category_ids][]`** — we don't currently send these (the frontend only has top-level categories). The form has them as a checklist. Capture per-category to know what's valid.
- **Permanent delete** — does NOT appear to exist via web. Worth checking Cults's "Account → Delete my account" or contacting them.
- **Bulk operations** — there's a `bulk_update_to_open_price` endpoint visible on /en/creations/mine; haven't explored.
- **Drafts vs. published** — does Cults have a way to save a draft that's NOT visible at all (not even as a "secret" listing)? The current `unpublish` deactivates but the listing persists.

---

## Adapter file map

```text
backend/src/adapters/
├── cults3d.ts              ← GraphQL adapter (Phase 3, still alive)
├── cults3d-mappings.ts     ← category/license/relay-to-int helpers (used by both adapters)
└── cults3d-web.ts          ← This flow. ~500 LOC, 5 exported functions:
                              cultsWebLogin
                              cultsWebUploadFile     (called per file in step 2 + 3)
                              cultsWebCreateCreation (step 4)
                              cultsWebPublishPrice   (step 5)
                              cultsWebUnpublish      (step 6)
```

Routes that use them: `POST /api/v1/cults3d/web/publish` and `POST /api/v1/cults3d/web/unpublish` in `backend/src/index.ts`.

---

## When you change something here, also update

- [`backend/src/adapters/cults3d-web.ts`](../src/adapters/cults3d-web.ts) — the code that implements all this
- [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) — high-level mention only; deep detail stays here
- This file — every new gotcha goes in the gotchas list, every new enum value documented

Documentation policy: edit this in the **same commit** as the adapter change. Never "I'll docs later." The next person to debug a Cults change will be you-in-three-months, and you won't remember.
