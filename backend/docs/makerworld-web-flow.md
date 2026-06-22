# MakerWorld web flow

Canonical reference for the reverse-engineered MakerWorld (Bambu Lab) upload flow that
`backend/src/adapters/makerworld-web.ts` drives. **Read this before changing that adapter.**
Reverse-engineered from a Playwright capture (kit + raw request bodies/screenshots live
outside the repo at `/Users/alex/makerworld-capture/`, which is gitignored because its
outputs contain live session tokens). Validated end-to-end on 2026-06-20 (upload → publish
private → delete) through the adapter itself.

## Auth model (NOT a server-side login)

MakerWorld sits behind **Bambu SSO + Cloudflare bot-management**, so we cannot log in
server-side the way the Cults web flow does. Instead:

- The **user supplies their own MakerWorld session cookie** (the browser obtains it; it's
  HttpOnly so a page can't read it — production needs a browser extension or a manual paste).
- The Worker forwards it to the adapter as the `X-MW-Cookie` header — the full Cookie value,
  minimally `token=…; cf_clearance=…` (include `refreshToken` for longevity).
- Every authenticated request must send: that cookie **plus** `X-BBL-Client-Type: web`,
  `X-BBL-Client-Version: 00.00.00.01`, `X-BBL-App-Source: makerworld`,
  `X-BBL-Client-Name: MakerWorld`, and a real browser `User-Agent`. Missing `cf_clearance`
  or a mismatched UA ⇒ Cloudflare "Just a moment" challenge (the adapter detects this and
  raises a clear "reconnect MakerWorld" error).
- `token` ≈ 24 h, `refreshToken` ≈ 90 d. The apps' refresh endpoint
  (`/v1/user-service/user/refreshtoken`) currently 404s — refresh path is TODO; meanwhile a
  fresh cookie is required when `token` expires.

## Domains

- App API: `https://makerworld.com/api/v1/<service>/…`
- Upload storage: **AWS S3** `or-cloud-makerworld-prod.s3.dualstack.us-west-2.amazonaws.com` (presigned PUT)
- Image CDN (serving): `makerworld.bblmw.com` (Aliyun OSS)

## Two upload paths

Chosen by the first wizard radio "Do you have a Bambu Studio .3mf?":

- **STL/CAD** ("I have STL/CAD…") — **2 steps** (Upload → Model Information+Publish). `createWith3mf=false`. No print profile.
- **.3mf** ("Yes, earn extra points") — **3 steps** (Upload → Model Information → Print Profile Information+Publish). `createWith3mf=true`. Uploading the `.3mf` triggers `GET /api/v1/iot-service/api/slicer/device/compatibility` (printer compatibility for step 3); publishing requires a print profile.

## API sequence

```text
# per file (model, each cover/gallery image, and the .3mf):
POST /api/v1/design-user-service/my/upload   {"useType":"makerworld/model","fileNames":["<name>.<ext>"]}
   → {"cdnPrefix":"https://makerworld.bblmw.com","urls":["<presigned AWS S3 PUT url>"]}
PUT  <presigned url>   (raw bytes, NO auth header — signature is in the querystring) → 200
   public url = cdnPrefix + "/" + <object key (the url path)>
# cover/gallery images additionally hit /my/process-files + /user/upload/picsearch (thumbnailing)

POST   /api/v1/design-service/my/draft           {full model JSON, clickWhich:"next"}  → {"id"}
PUT    /api/v1/design-service/my/draft/<id>       {full model JSON, clickWhich:"save"|"publish"}
POST   /api/v1/design-service/my/draft/<id>/submit  {}     → publishes (model → "verifying"/review)
DELETE /api/v1/design-service/my/draft/<id>       (works for drafts AND verifying/published)

GET    /api/v1/search-service/suggest?keyword=<q>&type=design_tag   (tag autocomplete; categories = preloaded int tree)
GET    /api/v1/design-service/my/design/published                  (list mine)
```

## Draft payload — field map (`buildDraftPayload` in the adapter)

Core: `title`, `summary` (HTML description — **required to publish**), `categoryId` (int, **required**),
`tags` (string[]), `cover` (4:3 url, **required**), `coverPortrait`/`profileCover` (3:4),
`designPictures` (gallery), `license` (string, derived from 4 radio groups — default
"Standard Digital File License"), `nsfw`, `modelSource` (`original`|`remix`|`share`),
`modelFiles[]` ({modelName,modelSize,modelType,modelUrl,thumbnailUrl,unikey,…}),
`model3Mf` ({name,size,url}) for the .3mf path, `designSetting.submitAsPrivate` (Public/Private),
`clickWhich` (`next`|`save`|`publish`).

Optional sections (all supported as passthrough in the adapter):

- **Remix/Share**: `modelSource` + `relateDesignInfo`/`original[]` (the linked source model id).
- **Exclusive Model Program**: `exclusive` (int). UI shows an "Agree & Join" agreement first.
- **Bill of Materials** (`bomsNeeded:true` + the arrays below). Captured shapes:
  - `boms[]` (Kits & Parts), `bomsOfFilaments[]`, `bomsOfMaterials[]` — each a **Maker's Supply catalog item** resolved by the cascade picker or "Enter the Product ID": `{value:"UNI…id", sku:"B-ZH113", title, label, image:"https://store.bblcdn.com/…", pieces, handle, parentIds:[…], filamentCodes, quantity}`.
  - `bomsOfOtherPartList[]` — free-text rows: `{name, quantity, note}`.
  - `bomsLinks[]` — external links (separate).
  - Note: BOM toggled ON but with **no catalog item** (only "other parts") shows *"Please add… parts/filaments/Materials"* and **disables Add Print Profile** — needs ≥1 kit/filament/material.
- **Documentation**: Assembly Guide → `designGuide[]` (pdf/png/jpg/webp/gif; **images ≤30MB/piece, pdf ≤50MB/piece; max 25**); Other Files → `designOther[]` (txt/pdf/zip; **txt ≤2MB, pdf ≤50MB, zip ≤100MB; max 10**). Limits verified from the upload UI 2026-06-22; enforced client-side in `MakerWorldOptions.validateDocs`.
- **Community Post**: `postNeeded` + `postContent` (opt-in — don't auto-post for users).
- **CyberBrick**: `cyberBrick.*` (RC/hardware models).
- **Paid/Crowdfunding**: `paidSetting.{isPaid,crowdfunding}`.

## Step 3 — Print Profile Information (.3mf path only)

- `profileTitle` — **Print Profile Name** (required; e.g. "0.2mm layer, 2 walls, 15% infill").
- `profileSummary` — print profile description.
- **Print Profile Pictures** — ≥1 **required**.
- **Printer Compatibility** — from the slicer compatibility call; native printer disabled+checked,
  others default checked → `compatibility` + `otherCompatibility` + `unsupportedDevModels`.
- Guidelines checkbox "I've read Print Profile Guidelines" = `instanceSetting.isPrinterTested` (**required**).

## Required to publish

- STL: title, 4:3 cover, 3:4 cover, categoryId, description (summary), license, visibility.
- .3mf: the above **plus** a print profile (profileTitle, ≥1 profile picture, isPrinterTested=true).

## Adapter functions (`makerworld-web.ts`)

`mwCheckSession`, `mwUploadFile`, `mwSlicerCompatibility`, `mwCreateDraft`, `mwUpdateDraft`,
`mwPublish` (create-save-with-publish + submit), `mwDelete`, `mwSuggestTags`, `mwListMyDesigns`.

## Worker routes (`index.ts`), auth via `X-MW-Cookie`

- `GET  /api/v1/makerworld/web/check` — session valid?
- `GET  /api/v1/makerworld/web/whoami` — signed-in user profile for account labels. Adapter `mwWhoami` → `GET /api/v1/design-user-service/my/profile` → `{handle,name,uid,avatar}`. (Note: `/my/profile` AND `/my/preference` both return the profile; the `/my/user…` variants 404.)
- `POST /api/v1/makerworld/web/upload` — multipart `file` (+ `useType`,`fileName`) → presign+PUT → `{url,key}`
- `POST /api/v1/makerworld/web/publish` — JSON `MakerWorldPublishInput` (+ `draftOnly`) → create [+ publish] → `{id,status}`
- `POST /api/v1/makerworld/web/delete` — `{id}`
- `GET  /api/v1/makerworld/web/my-creations` — list
- `GET  /api/v1/makerworld/web/suggest-tags?keyword=` — tag autocomplete

## Upload entry points (4 found) — coverage

- `/en/my/models/publish?type=original` — regular model (STL or .3mf). **Handled.**
- `/en/my/models/publish?type=remix` — **same page/flow** as original, just `type=remix` → set `modelSource:'remix'` + link the original via `relateDesignInfo`/`original`. **Handled** (link resolution = pass the original model id).
- `/en/my/laser-and-cut-models/publish?type=original` — **separate product**: "Bambu **Suite** file (`.lac`)", different endpoint namespace (`laser-and-cut-models`). **NOT implemented** (niche; its own flow — future work).
- `/en/my/models/import` — "Import from connected account — **Thangs / Thingiverse**". Imports *into* MakerWorld *from* other sites — the reverse of ModelPrep. **Out of scope.**

## Conditional fields (combinations)

- **Laser & Cut model = Yes** (within a regular model) → reveals "Please add the related model" (search/link a laser-cut model) → `relateDesignInfo` with that model id.
- **CyberBrick = Yes** → reveals **"Control Configuration Files (.json)"** upload → the `cyberBrick` block (`cyberBrickNeeded:true`, `controlConfig[]`, `motionConfig[]`, `mainControlConfig`, `controllerCover`, …). **NOT yet exposed as adapter input** (RC-model niche; the schema fields exist as passthrough — needs a capture of the cyberBrick payload to wire fully).
- The adapter accepts `remixOriginalIds` (→ `relateDesignInfo`/`original`) covering remix + laser-cut linking; `cyberBrick`/`paidSetting`/`boms`/docs are passthrough.

## Error handling & success verification

- MakerWorld validates at **`POST /draft/<id>/submit`**: an incomplete/invalid draft returns **`400 {"code":400,"error":"…"}`** (the `PUT` accepts anything; submit is the gate).
- `mwJson()` surfaces both HTTP errors and **200-with-`{code>=400}`** bodies, plus Cloudflare challenges, as clear exceptions; `mwPublish()` throws an actionable "publish rejected: [code] … Required: …" message (covers bad .3mf, forbidden words, empty/ON BOM).
- `mwVerifySubmitted()` confirms the model entered the pipeline. **Final approval is an async review** ("verifying" → public) — not confirmable synchronously; a 200 submit = accepted-for-review.
- **Auto-cleanup on failure (worker routes):** both `/publish` and `/laser-cut/publish` create the draft, then publish. If publish/submit throws AFTER create, the route now **deletes the half-built draft** (`mwDelete`/`mwDeleteLaserCut`, best-effort) and returns `{error, message, draftId, cleanedUp}` so a failed publish never orphans a draft on the user's account. (Before this, every failed-submit test left an orphan — they hide on the SSR-only `/@<handle>/draft` + `…/laser-and-cut-models/draft` pages, NOT in any `my/design*/draft` JSON API, which all 404/405.)

## Verified corrections + added flows (2026-06-20, agent QA + live tests)

- **Auth:** cookie-only is sufficient; the `X-BBL-*` headers are optional extras (we still send them — harmless, avoids edge 401s). The localStorage IM Bearer token is NOT accepted by the API.
- **Image uploads:** use the SAME `useType:"makerworld/model"` as models (NOT a separate image/cover type — those 400). `/my/process-files` + `/user/upload/picsearch` are internal/deprecated (400 when called directly) — the adapter does NOT use them.
- **3:4 cover field = `coverPortrait`** (confirmed). `profileCover` is the *print-profile* cover (3mf step), not the model 3:4.
- **Remix vs related-link:** remix → `original:[{id,designType:0}]` (`modelSource:"remix"`); a linked Laser&Cut model → `relateDesignInfo:{needRelate:true,id,designType:1,…}`. (Previously conflated.)
- **✅ Remix linking FIXED + live-validated (2026-06-20).** Each `original[]` entry needs
  `link` (the source URL) + `designId` (NOT `id`) + `title/author/homepage/cover/license`
  (`insideOriginalInfo:null`, `relatedUid:0`, `relatedUser:null`). A bare `{id,designType:0}`
  ⇒ "originals url is empty" / third-party-fetch error. Shape captured from a real remix model
  (`/design-service/design/<id>` → `originals[]`). For a MakerWorld-internal source: `designId`
  = model id, `link` = `<MW_BASE>/models/<id>`; for an external source (Printables/Thingiverse):
  `designId:0`, `link` = the external URL. The adapter resolves each `remixOriginalId` via
  `mwFetchOriginalRef` (GET design detail → name/handle/cover/license) before building the draft;
  the worker route does this when `modelSource:'remix'`. Validated: remix of model 25748 →
  200 verifying → deleted.
- **Related-model search:** `GET /api/v1/design-service/my/design/relate?relateDesignType=<0|1>&keyword=` → `{canUseDesign:[{id,title,cover,status,designType}]}` (0=3D, 1=Laser&Cut). Adapter: `mwSearchRelatedDesigns`. **Live-verified (35 results).**
- **Token refresh:** current endpoint `POST /api/v1/user-service/user/refreshtoken` `{refreshToken}` (the apps' `/v1/...` 404s). refreshToken lives in an HttpOnly cookie. Adapter: `mwRefreshToken` (uses refreshToken from the supplied cookie).
- **CyberBrick:** gated by `userInfo.rcUpload` (server-side eligibility; hidden otherwise). `.json` control configs upload via `/my/upload`. Adapter accepts a `cyberBrick` input → the `cyberBrick` block (controlConfig[] etc.). Not testable without an rcUpload account.
- **BOM catalog item:** `parentIds[]` + `quantity` are NOT in the catalog tree — the picker adds them when selecting a leaf (quantity = user; parentIds = ancestor path).
- **✅ Real .3mf publish WORKS (live 2026-06-20, private).** A sliced Bambu Studio `.3mf` published end-to-end **including the print profile** — MakerWorld **slices the `.3mf` server-side on submit** and auto-generates plates/print-time/printer-compatibility (we do NOT need to call `mwSlicerCompatibility` or send plate data; sending `model3mf` + a `printProfile{title,isPrinterTested}` is enough). The published model showed `Print Profile (1): "0.2mm layer, 2 walls, 15% infill" · 1 plate · 3.6h` with printer compatibility detected. Caveat: do NOT then open MakerWorld's draft "Add Print Profile" page for an already-published model — it throws a generic "Oops" (the step is already done by our submit).
- **Delete endpoints differ by state:** drafts + "verifying" → `DELETE /design-service/my/draft/<draftId>`; a **fully-published design** (a PRIVATE model publishes instantly) → `DELETE /design-service/design/<designId>` (the draft endpoint 403s on it; design id ≠ draft id). `mwDelete` now tries draft first, then falls back to the published-design endpoint.
- **UI-expansion fields live-validated (2026-06-20, via local Worker + capture-kit cookie, private→delete):**
  - ✅ **BOM** — the picker's `BomCatalogItem` shape (`{value,sku,title,label,image,pieces,handle,parentIds,quantity}` from a real `kits` catalog leaf) publishes + deletes cleanly.
  - ✅ **Documentation** — `designGuide`/`designOther` (`{name,url,size}`) accepted.
  - ✅ **Exclusive** — `exclusive:1` accepted.
  - ✅ **Related-model search** — `/related?type=0` returned 35 of the user's 3D designs.
  - ✅ **Remix link** — FIXED + validated (resolved `original[]` with link+designId+meta; see remix note above).
  - ❌ **Laser & Cut publish** — `…/draft2d/<id>/submit` returns a generic `[400]` with an `.svg`-only draft (no `.lac`). LC `instance.lacFile`/`lacInfo` are empty in our payload → **needs a real `.lac` (Bambu Suite file) to fill `lacFile`+`lacInfo` (plates/machineName/materialIds)** before submit will pass. Create still 200s; the route auto-deletes the draft on the failed submit.
- **Laser & Cut models (separate product) — IMPLEMENTED + create live-verified:** endpoints `…/my/draft2d`, `…/my/draft2d/<id>` (PUT), `…/my/draft2d/<id>/submit`, `DELETE …/my/draft2d/<id>`; SSR `…/laser-and-cut-models/drafts/<id>/edit.json`. Files (.lac/.svg/.dxf/images) via `/my/upload`. Body is **`{draft:{design:{…}, designSetting:{submitAsPrivate,syncToMWGlobal,postNeeded,postContent}, instance:{lacFile,lacInfo,lacCustomInfo,pictures}, extra:{draftSetting:{createWithLac}}, uploading:{…}, tempDetails:[], mode:"uploadFile", clickWhich, model2DInfo:{}}}`** — note `design.boms`/`design.steps` are OBJECTS (`{needed,…}`), `design.pictures` (not designPictures), `docBom/docGuide/docOther` (not design*). Adapter: `mwCreateLaserCutDraft`/`mwUpdateLaserCutDraft`/`mwPublishLaserCut`/`mwDeleteLaserCut`; Worker: `POST /api/v1/makerworld/web/laser-cut/{publish,delete}`.

## Gotchas

- The page **header has a visual-search file input** and cover uploads open a **cropper** — only
  relevant to the capture harness, not the adapter (the adapter posts urls directly).
- Cover crop modal confirm button is labelled **"Submit"**.
- Drafts list is `/@<handle>/draft` (NOT `/my/models`, which 404s); verifying = `/@<handle>/verifying`.
- Re-capture flow when something breaks: use the kit at `/Users/alex/makerworld-capture/`
  (`bash run.sh`, `capture-*.mjs`) — it decrypts the user's Chrome cookies + injects into a
  stealth browser, so it needs no login.

### Print Profile Pictures = `auxiliaryPictures` (confirmed live 2026-06-22)
The "Print Profile Pictures (n/37)" on the .3mf Step 3 are sent in the **top-level
`auxiliaryPictures`** array — NOT `profilePictures` (that name is only a client-side React
state var, never serialized). Captured from a live PUT `/my/draft/<id>` for a profile with 6
photos, cross-checked against GET `/design-service/design/<id>` (`auxiliaryPictures` ==
`instances[0].pictures`, `profileCover` == `instances[0].cover`). Item shape:
`{ isRealLifePhoto: 0, name: "<filename>.jpg", url: "<…/instance/<hash>.jpg>" }` (all 3 fields;
`isRealLifePhoto` defaults 0 for programmatic uploads). `profileCover` MUST be sent explicitly =
`auxiliaryPictures[0].url` (`""` when none — not auto-derived). `designPictures` (Model Pictures)
uses the same item shape but `…/design/<hash>.jpg` URLs. Spec: max **37**, jpg/png/webp/gif,
≤30 MB/piece (20 MB CN), no enforced aspect ratio (no crop applied by the widget).

## Browser-agent verified findings (2026-06-21)

Captured by an agent with full browser access (license config module + live PUT round-trips
+ a real submitted→rejected test). These resolve the items the Worker can't observe (SSR/HTML
is Cloudflare-blocked server-side).

### License — exact API `license` values
The PUT body sends ONLY the `license` string; the backend derives all share/commercial flags
from it (the 4 license radio questions are just UX). **CC licenses use SHORT CODES; SDFL/
Exclusive use the full string.** UI label → API value:

| UI label | API `license` |
|---|---|
| Creative Commons Public Domain | `CC0` |
| Creative Commons Attribution | `BY` |
| Creative Commons Attribution-Share Alike | `BY-SA` |
| Creative Commons Attribution-NoDerivatives | `BY-ND` |
| Creative Commons Attribution-Noncommercial | `BY-NC` |
| Creative Commons Attribution-Noncommercial-Share Alike | `BY-NC-SA` |
| Creative Commons Attribution-Noncommercial-NoDerivatives | `BY-NC-ND` |
| Standard Digital File License | `Standard Digital File License` |
| MakerWorld Exclusive License | `MakerWorld Exclusive License` |
| Standard Digital File License - Community Use | `Standard Digital File License - Community Use` |
| Standard Digital File License - Platform Print Only (SDFL-PPO) | `Standard Digital File License - Platform Print Only (SDFL-PPO)` |

All 11 accepted by PUT (200); `BY-SA` additionally verified through our full publish+submit.
(ModelPrep: `MW_LICENSE_MAP`/`MW_LICENSE_OPTIONS` in deploy/src/App.jsx use these values.)

### Verifying / Failed (rejected) models — SSR only
Both are Next.js `_next/data`, NOT JSON REST (so the Worker, Cloudflare-blocked on SSR,
CANNOT fetch them — the desktop app's real browser CAN):
- Verifying: `GET /_next/data/{buildId}/en/@{handle}/verifying.json?handle={handle}`
- Failed:    `GET /_next/data/{buildId}/en/@{handle}/verify-failed.json?handle={handle}`
- `pageProps`: `{ drafts:[…], uploadCount:{instCnt,verifyingCnt,failedCnt,draftCnt,designCnt,presetCnt}, … }`.
  The profile tab counts come from `uploadCount` (no separate call). Also `pageProps.sliceFailReason`
  = 95-entry slicer-error code list.
- **Status model:** a draft's `status=8` covers BOTH verifying and failed; distinguish by
  `resultType` (0 = still pending/verifying, non-zero = rejected) + `resultDesc` (human reason).
  `status=1` (+ a real `designId`) = LIVE (appears in `/my/design/published`). `opStatus` exists
  only on live designs (=1). Example rejection: `resultType 6401`, `resultDesc "System detected
  no real life photo"` (a content-policy AI check, not a slicer error).
- **WORKER-FETCHABLE failure detection (browser-agent verified 2026-06-22):** for a KNOWN
  draft id, `GET /api/v1/design-service/my/draft/<id>` (cookie-only, JSON — Worker CAN fetch)
  returns the slicing result at the TOP level: `resultType != 0` ⇒ failed with `resultDesc`
  (e.g. `"The 3mf was not generated by Bambu Studio"`, resultType 20); `== 0` ⇒ verifying or
  published. This is the path ModelPrep uses (Worker `GET …/makerworld/web/draft-status?id=`,
  adapter `mwDraftStatus`, frontend auto-checks ~6s post-publish). The notification feed
  `/en/my/notification/3DModel` is SSR-only (NOT fetchable); its failure object is
  `pageProps.list[].draftSliceFailed.draftInfo.{id,resultDesc,resultType,instanceTitle}`
  (`type` 101 = slice/verify failed, 102 = published). `GET /design-service/design/<id>`
  → 200 + `status=1` = the model is actually LIVE.

### Description (`summary`) format — CKEditor schema (browser-agent verified 2026-06-22)
`summary` is a CKEditor HTML field with a FIXED schema — send matching HTML, not raw Markdown
(else `#`/`**` render literally). Stored mapping (our `mdToMakerWorldHtml` emits exactly this):
`#`/`##`/`###` → `<h2>`/`<h3>`/`<h4>` (H1 is remapped to H2 — never stored); bold → `<strong>`;
italic → `<i>` (NOT `<em>`); `<u>`; color → `<span style="color:#hex">`; align → `<p style="text-align:…">`;
`<ul>`/`<ol>`/`<li>`; link → `<a target="_blank" rel="noopener noreferrer" href="…">`; quote →
`<blockquote><p>`; table → `<figure class="table"><table><thead><tbody>…`. **Stripped/unsupported:**
inline `<code>` (kept as plain text), strikethrough `<s>/<del>`, `<pre>`/code blocks, `<hr>`, font-size
buttons (only pasted `style="font-size:…"` survives). No extra server-side sanitization observed —
the editor does the conversion; sending `<h1>` via API may store as `<h1>`, so emit `<h2>`+ for headings.

### Other
- **Token refresh** `POST /api/v1/user-service/user/refreshtoken {refreshToken}` is LIVE
  (400 "field refreshToken is not set" if missing; 401 if invalid). Success body shape still
  UNVERIFIED (refreshToken is HttpOnly, unreadable from JS).
- **Text limits (UI-enforced, verified 2026-06-22):** **title (`title`) ≤50 chars**; **tags ≤50** with **≤100 chars per tag**; description (`summary`) has no hard cap observed. All client-side only — the PUT does NOT enforce them (50 and 100 tags both 200). Mirrored in `PLATFORMS.makerworld.limits = { titleMax: 50, tagMax: 50, tagCharMax: 100 }` and enforced on the Details step.
- **categoryId:** no leaf enforcement at PUT (parent 400 and leaf 401 both accepted).
- **submitAsPrivate** in `designSetting`/`instanceSetting` is a BOOLEAN (our adapter already sends bool).
- **edit.json** `pageProps` keys confirmed: `draft, categories (11 top-level), boms,
  filamentBoms, materials, forbiddenWords (64 entries), id, userInfo`.
- `modelFiles[].modelUrl` in the PUT may carry signed CDN query params (`?at=&exp=&key=&uid=`);
  the backend ignores them — the bare CDN path is fine (what we send).
