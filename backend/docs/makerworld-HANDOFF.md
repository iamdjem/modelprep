# MakerWorld integration - historical handoff

> This July 18 document is historical. The current cross-platform pickup point
> is `modelprep-current-handoff-2026-08-01.md`; the current MakerWorld contract is
> `makerworld-web-flow.md` plus `platform-upload-requirements-live.md`. In
> particular, the packaged desktop now performs direct on-device transport and
> supports the mapped model-video path, so the Worker-first diagram below is not
> the current desktop architecture.

Original pick-up doc for the agent that continued the MakerWorld upload integration.
Last updated: 2026-07-18. Read this first, then `makerworld-upload-flow-map.md` (the complete
current path map) and `makerworld-web-flow.md` (the low-level API reference).

---

## TL;DR

ModelPrep's MakerWorld upload implementation is complete locally for regular raw/`.3mf` and
Laser raw/`.lac` modes. It includes account sign-in/refresh/capability checks, direct presigned
uploads at MakerWorld's real 150/200 MB limits, draft-only saves, profile and optional-field UI,
status/list/delete handling, and mirrored frontend/backend validation. The remaining work is
**deployment** plus four controlled live checks that need special assets/account capability or
would mutate the MakerWorld account. See `makerworld-upload-flow-map.md` for the exact boundary.

---

## How it works (architecture)

```
ModelPrep React UI (deploy/)  →  user picks options and a saved MakerWorld account
   → Cloudflare Worker (backend/) exchanges/refreshes auth and obtains a presigned upload URL
   → browser PUTs bytes directly to MakerWorld S3
   → Worker creates a regular draft or Laser draft2d → save-only OR update+submit → status/list
   →  model enters MakerWorld "verifying" review
```

- **Auth:** the Worker can exchange email/password (and, when requested, an emailed code) for
  MakerWorld's token and refreshToken. Desktop/browser-session and token/cookie paste remain
  fallbacks. The saved account secret is forwarded in `X-MW-Cookie` and replayed as `Cookie`.
- **CRITICAL Cloudflare finding:** server-side fetches of MakerWorld `/api/v1/*` JSON endpoints
  **pass** (200), but HTML pages and `/_next/data` SSR **403 "Just a moment"** server-side. So
  the publish API works from the Worker, but the BOM catalog (SSR-only) can't be fetched
  server-side — it must be harvested by a real browser.

---

## What's IMPLEMENTED (with code references)

### Backend adapter — `backend/src/adapters/makerworld-web.ts`
- Session/auth helpers, `mwHeaders`, `mwJson` (+ `mwErrDetail` for MakerWorld `{code,error}`).
- `mwCheckSession` — session liveness (GET my/message/count → 200).
- `mwPresignUpload` + `mwUploadFile` — presign-only for direct browser PUT, plus the legacy
  Worker-proxy upload. Models and images use `useType:"makerworld/model"`.
- Native 3MF compatibility is detected while MakerWorld processes the upload. The obsolete standalone compatibility GET currently returns 400 and is intentionally not called; ModelPrep sends only user-selected additional overrides.
- `mwCreateDraft` / `mwUpdateDraft` / `mwPublish` / `mwDelete` / `mwDraftStatus`.
- `buildDraftPayload` — the full draft JSON (both paths + all optional sections).
- `mwSuggestTags` (tag autocomplete), `mwListMyDesigns`.
- BOM catalog: `mwFetchCatalog`, `mwFetchCatalogStandalone`, `BomCatalog`/`BomCatalogNode` types, `trimCatalogNode`, `mwBuildId`.
- `mwSearchRelatedDesigns` (remix / related-model search), `mwRefreshToken`, and
  `mwUploadCapabilities` (`rcUpload`/upload eligibility; JSON profile first, SSR fallback).
- **Laser & Cut product** (`draft2d`): `mwCreateLaserCutDraft` / `mwUpdateLaserCutDraft` / `mwPublishLaserCut` / `mwDeleteLaserCut` + `buildLaserCutPayload` + `LaserCutPublishInput`.
- Input types: `MakerWorldPublishInput` (linked model, internal/external remix attribution, CyberBrick, BOM including free-text parts, docs, community post, Exclusive acknowledgement, raw-file metadata, and independent print-profile visibility/photos/compatibility), plus the `.lac`-aware `LaserCutPublishInput`, `BomCatalogItem`, `RelatedModelRef`, `MwFileRef`, and `CyberBrickInput`.

### Worker routes — `backend/src/index.ts` (auth via `X-MW-Cookie`; added to CORS allow-headers)
- `GET  /api/v1/makerworld/web/check`
- `POST /api/v1/makerworld/web/login` / `…/login-code`
- `GET  /api/v1/makerworld/web/whoami` / `…/capabilities`
- `POST /api/v1/makerworld/web/upload/presign` (JSON metadata; browser PUTs bytes to S3)
- `POST /api/v1/makerworld/web/upload` (multipart `file`)
- `POST /api/v1/makerworld/web/publish` (JSON `MakerWorldPublishInput`, `+draftOnly`)
- `POST /api/v1/makerworld/web/delete` (`{id}`)
- `GET  /api/v1/makerworld/web/my-creations`
- `GET  /api/v1/makerworld/web/suggest-tags?keyword=`
- `GET  /api/v1/makerworld/web/bom-catalog` (R2 cache + best-effort refresh)
- `GET  /api/v1/makerworld/web/related?type=0|1&keyword=`
- `POST /api/v1/makerworld/web/refresh`
- `GET  /api/v1/makerworld/web/draft-status?id=`
- `POST /api/v1/makerworld/web/laser-cut/publish` / `…/laser-cut/delete`
- `GET  /api/v1/makerworld/web/laser-cut/draft-status?id=`

### Frontend — `deploy/src/App.jsx` + `deploy/src/lib/makerworld*.js`
- `MakerWorldUploadFlow` handles account selection, preflight, direct upload, draft save, publish,
  status, list, and delete. `MakerWorldOptions` exposes all regular/Laser conditional fields.
- `.lac` metadata parsing, forbidden-word checks, account capability checks, mode gating, and
  transport/error handling are split into focused helper modules with tests.
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
- **Cloudflare:** `/api/v1/*` works server-side with the token. HTML/`_next/data` may still 403
  without a browser cookie, so capability lookup prefers the JSON profile service and the BOM
  catalog still has a browser-harvest fallback.
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
- ◑ Implemented with automated coverage, NOT live-mutated in this pass: **token refresh**
  (would rotate the saved token) and **CyberBrick** (the inspected account has `rcUpload:false`).

---

## Remaining work after the 2026-07-18 parity pass
1. **Deploy Worker first, then frontend:** deployment was not authorized in this pass. The new
   frontend depends on `/upload/presign` and `/capabilities` being present on the Worker.
2. **Live `.lac` submit:** needs a real Bambu Suite file and approval for private create→delete.
3. **Raw Laser submit:** the historical SVG-only submit returned a generic 400; the corrected
   payload is regression-tested but still needs private create→delete verification.
4. **CyberBrick submit:** needs an account with `rcUpload=true`; the inspected current account
   reports `false`, and ModelPrep now hides/blocks the option for that account.
5. **Large-file CORS:** run one authenticated direct-S3 upload above 95 MB after deployment to
   prove current MakerWorld bucket CORS from the production frontend origin.
6. **Catalog/policy freshness:** keep the browser harvest available. It refreshes the bundled
   BOM catalog and the 64-entry forbidden-word seed; MakerWorld submit remains authoritative.

---

## Open questions requiring special assets or account capability
1. Does a current Bambu Suite `.lac` fixture populate any additional plate keys beyond the tolerant local JSON parser and captured `lacInfo`/`model2DInfo` contract?
2. Does MakerWorld accept the captured raw SVG/DXF payload after all current cover/source fields are supplied, or is another generated `model2DInfo` field required?
3. Can an `rcUpload`-enabled account confirm the CyberBrick control/motion/main-controller payload end to end?

## Decisions needed from the product owner
- Deploy now? (Worker first, then frontend; no deployment or Git publish was done here.)
- Test assets/authority: a real `.lac`, an `rcUpload`-enabled account, a >95 MB safe fixture,
  and approval for private create→delete validation.

---

## Quick commands
```bash
cd /Users/alex/modelprep/backend && npm test && npm run typecheck
cd /Users/alex/modelprep/deploy  && npm test && npm run build
cd /Users/alex/modelprep/backend && npx wrangler dev --port 8787 --local   # run Worker locally
# catalog refresh (needs playwright + a MakerWorld cookie):
MW_COOKIE='token=…; cf_clearance=…' node backend/scripts/harvest-bom-catalog.mjs
# capture kit (browser, decrypts Chrome cookies — research):
cd /Users/alex/makerworld-capture && node capture-publish2.mjs   # etc.
```
