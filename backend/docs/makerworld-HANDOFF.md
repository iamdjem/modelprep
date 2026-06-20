# MakerWorld integration — HANDOFF

Pick-up doc for the next agent continuing the MakerWorld upload integration in ModelPrep.
Last updated: 2026-06-20. Read this first, then `makerworld-web-flow.md` (the API reference).

---

## TL;DR

ModelPrep publishes 3D models to MakerWorld by **replaying MakerWorld's internal web API**
with the user's session cookie (server-side, no browser at runtime). The **backend adapter +
Worker routes are built and largely live-validated**. The main remaining work is the **frontend
UI** (expose all options + a catalog picker), **deployment**, and a few **niche live
verifications** (real 3mf publish, Laser&Cut publish, CyberBrick) that need a browser agent /
special test assets.

---

## How it works (architecture)

```
ModelPrep React UI (deploy/)  →  user picks options, supplies MakerWorld session cookie
   →  Cloudflare Worker (backend/)  forwards cookie as X-MW-Cookie, replays MakerWorld API:
        POST /my/upload (presign) → PUT to AWS S3 → create draft → update → submit → (verify)
   →  model enters MakerWorld "verifying" review
```

- **Auth:** MakerWorld is behind Bambu SSO + Cloudflare, so we CANNOT log in server-side. The
  user supplies their own session cookie (`token` + `cf_clearance` [+ `refreshToken`]). The
  Worker sends it as the `Cookie` header + `X-BBL-*` headers + a browser UA.
- **CRITICAL Cloudflare finding:** server-side fetches of MakerWorld `/api/v1/*` JSON endpoints
  **pass** (200), but HTML pages and `/_next/data` SSR **403 "Just a moment"** server-side. So
  the publish API works from the Worker, but the BOM catalog (SSR-only) can't be fetched
  server-side — it must be harvested by a real browser.

---

## What's IMPLEMENTED (with code references)

### Backend adapter — `backend/src/adapters/makerworld-web.ts`
- Session/auth helpers, `mwHeaders`, `mwJson` (+ `mwErrDetail` for MakerWorld `{code,error}`).
- `mwCheckSession` — session liveness (GET my/message/count → 200).
- `mwUploadFile` — `POST /api/v1/design-user-service/my/upload` (presign) → `PUT` AWS S3 → returns `{url,key,size,cdnPrefix}`. Models AND images use `useType:"makerworld/model"`.
- `mwSlicerCompatibility` — `GET /api/v1/iot-service/api/slicer/device/compatibility` (3mf).
- `mwCreateDraft` / `mwUpdateDraft` / `mwPublish` (PUT clickWhich:"publish" + `POST …/draft/<id>/submit`) / `mwDelete` / `mwVerifySubmitted`.
- `buildDraftPayload` — the full draft JSON (both paths + all optional sections).
- `mwSuggestTags` (tag autocomplete), `mwListMyDesigns`.
- BOM catalog: `mwFetchCatalog`, `mwFetchCatalogStandalone`, `BomCatalog`/`BomCatalogNode` types, `trimCatalogNode`, `mwBuildId`.
- `mwSearchRelatedDesigns` (remix / related-model search), `mwRefreshToken`.
- **Laser & Cut product** (`draft2d`): `mwCreateLaserCutDraft` / `mwUpdateLaserCutDraft` / `mwPublishLaserCut` / `mwDeleteLaserCut` + `buildLaserCutPayload` + `LaserCutPublishInput`.
- Input types: `MakerWorldPublishInput` (covers `relatedModel`, `cyberBrick`, `remixOriginalIds`, `boms`, `designGuide/Other`, `communityPost`, `paidSetting`, `exclusive`, `printProfile`), `BomCatalogItem`, `RelatedModelRef`, `MwFileRef`, `CyberBrickInput`.

### Worker routes — `backend/src/index.ts` (auth via `X-MW-Cookie`; added to CORS allow-headers)
- `GET  /api/v1/makerworld/web/check`
- `POST /api/v1/makerworld/web/upload` (multipart `file`)
- `POST /api/v1/makerworld/web/publish` (JSON `MakerWorldPublishInput`, `+draftOnly`)
- `POST /api/v1/makerworld/web/delete` (`{id}`)
- `GET  /api/v1/makerworld/web/my-creations`
- `GET  /api/v1/makerworld/web/suggest-tags?keyword=`
- `GET  /api/v1/makerworld/web/bom-catalog` (R2 cache + best-effort refresh)
- `GET  /api/v1/makerworld/web/related?type=0|1&keyword=`
- `POST /api/v1/makerworld/web/refresh`
- `POST /api/v1/makerworld/web/laser-cut/publish` / `…/laser-cut/delete`

### Frontend — `deploy/src/App.jsx`
- `MakerWorldUploadFlow` component (search "function MakerWorldUploadFlow") — connect via cookie
  paste, category/visibility/license, covers+gallery upload, 3mf print-profile fields, community
  post, publish + delete. Wired in the render switch (`platform.id === 'makerworld'`).
- **UI expansion DONE (2026-06-20):** product-mode toggle (3D Model ↔ Laser & Cut); collapsible
  advanced sections — Source/remix (modelSource + remix-original search via `/related?type=0`),
  Linked model (3D→link LC `type=1`, LC→link 3D `type=0`), **BOM picker** (`MwBomPicker` cascade
  over the bundled catalog + Product-ID lookup `mwFindBySku` + free "other parts"), Documentation
  uploads (Assembly Guide → `designGuide`/`docGuide`, Other → `designOther`/`docOther`), Exclusive
  toggle. Helpers above the component: `loadMwCatalog` (lazy `import()`), `mwFindBySku`,
  `mwCatalogItem`, `MwBomPicker`, `MwRelatedSearch`, `MwSection`.
- **Bundled catalog:** `deploy/src/data/makerworld-bom-catalog.json` (kits/filaments/materials,
  ~548KB) + `makerworld-categories.json`. **Lazy-loaded** via dynamic `import()` → code-split into
  its own chunk (`makerworld-bom-catalog-*.js`, ~519KB, only fetched when BOM picker opens).

### Catalog refresh — `backend/scripts/harvest-bom-catalog.mjs`
- Playwright harvest (needs `npm i -D playwright` + `MW_COOKIE`). Reliable refresh (the Worker
  self-refresh is best-effort only, due to the Cloudflare SSR block).

### Reference docs + research
- `backend/docs/makerworld-web-flow.md` — **canonical API reference** (endpoints, payloads, field map, entry points, errors, all verified corrections).
- `/Users/alex/makerworld-capture/` — **the capture kit** (OUTSIDE the repo, gitignored area; outputs contain live tokens). `MAKERWORLD-FLOW.md` = fullest reference; `cookies.mjs` = Chrome-cookie decrypt; `capture-*.mjs` = the Playwright capture/QA scripts; `out/` = HARs/screenshots/api-logs.
- Project memory: `makerworld-capture-auth`, `makerworld-upload-flow`, `modelprep-makerworld-status`.

---

## What we LEARNED (key facts / gotchas)
- **Cloudflare:** `/api/v1/*` works server-side; HTML/`_next/data` 403 server-side (catalog = browser-only). `cf_clearance` is required + UA-bound.
- **Capture-only Cloudflare bypass:** decrypt the user's Chrome cookies (macOS Keychain) + inject into a stealth real-Chrome (remove `--enable-automation`/`--use-mock-keychain`/`--password-store=basic`). See `makerworld-capture-auth` memory.
- **Two upload paths:** STL/CAD (2 steps) vs `.3mf` Bambu Studio (3 steps incl. Print Profile).
- **File upload:** one endpoint, `useType:"makerworld/model"` for models AND images. `/process-files` + `/picsearch` are dead (400) — don't call them.
- **3:4 cover = `coverPortrait`** (NOT `profileCover`, which is the print-profile cover).
- **Remix vs link:** remix → `original:[{id,designType:0}]`; Laser&Cut link → `relateDesignInfo:{…,designType:1}`. (Was a bug — fixed.)
- **Publish = 2 calls:** `PUT …/draft/<id>` (clickWhich:"publish") then `POST …/draft/<id>/submit {}`. **Submit is the validation gate** — incomplete = `400 {"code":400,"error":…}` (generic; not field-specific).
- **BOM catalog** lives in `edit.json` `pageProps.{boms,filamentBoms,materials}` (+ `categories`, `forbiddenWords`); a category→product→variant tree. `parentIds`/`quantity` are added by the picker, not in the catalog.
- **Laser & Cut** is a separate product: `draft2d` endpoints, a `.lac` "Bambu Suite" file, and a distinct nested body (`instance.lacFile/lacInfo`, `boms`/`steps` as objects, `extra.createWithLac`, `uploading` flags). Body captured + create live-verified.
- **CyberBrick** is gated by `userInfo.rcUpload` (server-side); `.json` control configs.
- **Token refresh:** `POST /api/v1/user-service/user/refreshtoken {refreshToken}` (old `/v1/...` 404s).

## What we FIXED
- remix/`original[]` vs `relateDesignInfo` conflation (correctness bug).
- Error surfacing: `mwJson` now reports MakerWorld `{code,error}` (HTTP + 200-with-error-code) + Cloudflare challenges; `mwPublish` throws an actionable "publish rejected: …" message.
- Laser&Cut `draft2d` body (first inference 400'd → captured exact body → create now 200).
- Capture hygiene: single-tab + clean `ctx.close()` (stop force-killing, which orphaned windows).

## What's LIVE-VALIDATED vs implemented-only
- ✅ Validated live (local Worker): full STL publish→delete; upload(presign→S3); create/update/submit/delete; related-search (35 results); LC **create**→delete; cookie decrypt+inject + 200 auth.
- ✅ **NEW (2026-06-20) UI-expansion fields validated live (private→delete):** BOM picker output (real catalog kit leaf), Documentation (`designGuide`/`designOther`), Exclusive (`exclusive:1`). See flow doc "UI-expansion fields live-validated".
- ✅ **Worker auto-cleanup added + validated:** `/publish` + `/laser-cut/publish` delete the draft if publish/submit fails (returns `{draftId,cleanedUp}`) — failed publishes no longer orphan drafts. (Cleaned up all test orphans this session via the capture-kit browser sweep; the SSR-only draft pages are the only place orphans show — no JSON draft-list API exists.)
- ✅ **Remix link FIXED + validated:** `original[]` needs `link`+`designId`+meta (not bare `{id}`); adapter resolves via `mwFetchOriginalRef`. Remix of model 25748 → 200 verifying → deleted.
- ❌ **Laser & Cut publish** fails at submit with an `.svg`-only draft (`[400]`); **needs a real `.lac`** to fill `lacFile`/`lacInfo`. LC create still works.
- ✅ **Real .3mf publish VALIDATED (2026-06-20):** a sliced Bambu `.3mf` published private incl. a working **print profile** (1 plate, 3.6h, printer compat) — MakerWorld slices server-side on submit; no slicer-compat call needed. (The "Oops" error a tester hit was from manually clicking MakerWorld's "Add Print Profile" on an already-published model — not our bug.)
- ✅ **Delete fixed:** published designs (private = instant publish) delete via `/design-service/design/<id>`, not the draft endpoint; `mwDelete` now falls back to it.
- ◑ Implemented to captured spec, NOT fully live-tested: **token refresh** (didn't fire — would rotate token), **CyberBrick** (needs `rcUpload` account).

---

## What is NOT implemented yet (remaining work)
1. ~~**Frontend UI expansion**~~ **DONE (2026-06-20):** BOM picker, remix/related-model search, Laser&Cut linking + product mode, Documentation uploads, Exclusive toggle — all built in `MakerWorldUploadFlow` and `npm run build`-verified (catalog lazy code-split). Live end-to-end test of the NEW fields still pending (needs a session; the additive fields all map to validated backend inputs).
2. **Deploy:** Worker is local-only (`wrangler dev`); deploy it (`cd backend && npx wrangler deploy`) + push the frontend. Add `X-MW-Cookie` already in CORS.
3. **Production "Connect MakerWorld" UX:** cookie is HttpOnly → MVP = manual paste (built); better = a one-click **browser extension**.
4. **Niche flows to finish/verify:** LC *publish* requirements + real `.lac` `lacInfo`; CyberBrick full publish (needs `rcUpload`); exact per-path client-side validation rules; token-refresh response shape; forbiddenWords client-side check (harvestable from SSR).
5. **Catalog refresh automation:** schedule the harvest (or rely on best-effort Worker refresh + manual).

---

## Open questions for the browser agent (need a live session / special assets)
1. Real **3mf publish** (private→delete) with a valid sliced Bambu `.3mf`: the print-profile/instances/plates the publish requires + slice flow + errors.
2. **Laser & Cut publish** (private→delete): what `…/draft2d/<id>/submit` requires (covers? `lacInfo` machine/material/plates?) + the full LC publish body.
3. Real **`.lac`** upload: what fills `instance.lacFile`/`lacInfo`.
4. **CyberBrick:** is `userInfo.rcUpload` true? If so, capture a full CyberBrick publish.
5. **Per-path client-side validation rules** (exact required fields + messages) for STL/3mf/remix/laser-cut.
6. **Token refresh** response body shape.
7. **Limits:** max tags; must `categoryId` be a leaf?

## Decisions needed from the product owner
- Deploy now? (needs Cloudflare/wrangler login + GH push.)
- UI scope: full picker in one pass vs core-first.
- Connect UX: browser extension vs paste MVP.
- Test assets: a valid sliced `.3mf`, a `.lac`, and an `rcUpload`-enabled account.

---

## Quick commands
```bash
cd /Users/alex/modelprep/backend && npx tsc --noEmit        # typecheck backend
cd /Users/alex/modelprep/deploy  && npm run build           # build frontend
cd /Users/alex/modelprep/backend && npx wrangler dev --port 8787 --local   # run Worker locally
# catalog refresh (needs playwright + a MakerWorld cookie):
MW_COOKIE='token=…; cf_clearance=…' node backend/scripts/harvest-bom-catalog.mjs
# capture kit (browser, decrypts Chrome cookies — research):
cd /Users/alex/makerworld-capture && node capture-publish2.mjs   # etc.
```
