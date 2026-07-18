# MakerWorld upload flow map

Current implementation map for ModelPrep's MakerWorld integration.
Last code and live-form verification: **2026-07-18**.

This document answers three separate questions:

1. Which MakerWorld screen/path is being represented?
2. Which ModelPrep UI, validation, and Worker route handles it?
3. Which parts are automated, live-verified, or still require a controlled account mutation?

## 1. Entry and account flow

```text
Settings > Accounts > MakerWorld
  ├─ email + password
  │    POST ModelPrep /makerworld/web/login
  │      ├─ token returned -> save token + refreshToken in browser account store
  │      └─ verification required -> email code -> /login-code -> save session
  ├─ desktop/browser session fallback
  └─ token/cookie paste fallback

Connected account
  ├─ /check             session liveness
  ├─ /whoami            account label
  ├─ /capabilities      rcUpload + uploadAllowed + defaultLicense
  └─ /refresh           rotate access token and retain/rotate refreshToken
```

Secrets stay in the local browser account store. The Worker receives the active account in
`X-MW-Cookie`; MakerWorld receives it as its normal `Cookie` header.

The current live upload entry is MakerWorld's header **Upload** menu. The old
`/en/my/upload` URL is a 404. Current paths inspected under the signed-in account:

- `/en/my/models/publish?type=original`
- `/en/my/models/publish?type=remix`
- `/en/my/laser-and-cut-models/publish?type=original`
- `/en/my/models/import` (third-party import; intentionally outside ModelPrep's outbound-publish scope)

## 2. Project preparation shared by every mode

```text
Files -> Details -> Images -> Profiles -> Platforms -> Publish
```

- **Files:** raw model files, Bambu Studio `.3mf`, raw Laser files, or Bambu Suite `.lac`.
- **Details:** title, rich description, tags, license, category source data.
- **Images:** 4:3 cover, portrait cover, and ordered gallery. ModelPrep sends JPEG output.
- **Profiles:** regular `.3mf` print-profile data. `.lac` uses the dedicated profile controls in
  MakerWorld's Platforms card because its profile belongs to the Laser product.
- **Platforms:** choose 3D/Laser mode and MakerWorld-only options.
- **Publish:** preflight, upload, draft/save or submit, status, list, and delete.

Before any bytes leave the browser, `makerWorldPublishIssues()` checks:

- mode/extension match;
- 200 MB raw/`.lac` and 150 MB `.3mf` limits, plus 250 MB total;
- title, description, tags, current forbidden terms, category, cover, gallery;
- remix URL/license/change explanation;
- Exclusive acknowledgement;
- `.3mf`/`.lac` profile name, pictures, visibility, and confirmations;
- documentation file types/counts/sizes;
- CyberBrick path, control JSON, and connected-account eligibility.

The backend repeats the payload-critical checks before creating a draft. Structured issues are
returned to the UI instead of being collapsed to `invalid_publish`.

## 3. Mode decision tree

```text
MakerWorld product
  ├─ 3D Model
  │    ├─ Bambu Studio .3mf present
  │    │    ├─ one selected initial .3mf profile
  │    │    ├─ optional raw model files
  │    │    ├─ linked Laser model
  │    │    ├─ CyberBrick only if account rcUpload=true
  │    │    └─ createWith3mf=true + printProfile payload
  │    └─ raw STL/CAD/other
  │         ├─ raw model files only
  │         ├─ linked Laser model
  │         ├─ no CyberBrick question
  │         └─ createWith3mf=false
  └─ Laser & Cut
       ├─ Bambu Suite .lac
       │    ├─ one selected primary .lac profile package
       │    ├─ optional additional raw Laser files (including additional .lac files)
       │    ├─ local plain/ZIP JSON metadata extraction
       │    ├─ dedicated Laser profile name/description/visibility/pictures
       │    ├─ linked 3D model
       │    ├─ CyberBrick only if account rcUpload=true
       │    └─ createWithLac=true + lacInfo/lacCustomInfo/model2DInfo
       └─ raw .lac/SVG/DXF/image/AI
            ├─ one or more raw Laser files; .lac is treated as source, not a profile
            ├─ linked 3D model
            ├─ no CyberBrick question
            └─ createWithLac=false
```

This matches the current live first and second screens: CyberBrick is present on the `.3mf`
and `.lac` paths, and absent from raw 3D and raw Laser paths.

## 4. Optional field mapping

| ModelPrep option | MakerWorld representation |
|---|---|
| Original/remix | `modelSource`, resolved `original[]`; external Laser sources keep `designType:1` |
| Cross-product link | `relateDesignInfo` (`designType:1` for linked Laser, `0` for linked 3D) |
| Visibility | independent design/profile `submitAsPrivate` booleans |
| License | exact MakerWorld license string |
| BOM | kits, filaments, materials, and free-text other parts |
| Documentation | assembly-guide and other-file arrays |
| Community post | `postNeeded` + `postContent` |
| Exclusive | `exclusive` after explicit terms acknowledgement |
| Raw-file options | note, protected/open-source state, folder path, CDN/upload key |
| CyberBrick | control/motion/main-controller/MicroPython files; requires `rcUpload=true` |

Tag suggestions use MakerWorld's live suggest endpoint when connected and local AI fallback
otherwise. The BOM picker uses the Worker's cached catalog with the bundled catalog as fallback.
The browser harvest refreshes both the BOM seed and MakerWorld's current forbidden-word seed.

## 5. File transport

```text
Browser -> Worker POST /upload/presign {fileName,size,useType}
Worker  -> MakerWorld POST /design-user-service/my/upload
Worker  <- signed S3 PUT URL + CDN prefix/key
Browser -> signed S3 URL (raw bytes, no MakerWorld auth header)
Browser <- 200
Browser builds {name,size,url,key,cdnPrefix}
```

- `.3mf`: maximum 150 MB.
- All other MakerWorld upload files: maximum 200 MB.
- Direct S3 avoids Cloudflare Worker's approximately 100 MB request-body ceiling.
- The old Worker multipart `/upload` remains a compatibility fallback for files at or below
  95 MB when direct browser-to-S3 upload fails.

Deployment order matters: deploy the Worker (presign and capability routes) before the frontend.

## 6. Draft and publish state machines

### Regular 3D

```text
uploaded references
  -> POST MakerWorld /design-service/my/draft (clickWhich=next)
  -> draft id
  ├─ Save as draft: stop and return /my/models/drafts/<id>/edit
  └─ Publish:
       PUT /my/draft/<id> (clickWhich=publish)
       POST /my/draft/<id>/submit
       -> verifying
       -> GET /my/draft/<id> for resultType/resultDesc
       -> GET published list for live presence
```

### Laser & Cut

```text
uploaded references
  -> POST MakerWorld /design-service/my/draft2d
  -> Laser draft id
  ├─ Save as draft: stop and return /my/laser-and-cut-models/drafts/<id>/edit
  └─ Publish:
       PUT /my/draft2d/<id> (clickWhich=publish)
       POST /my/draft2d/<id>/submit
       -> verifying
       -> GET /my/draft2d/<id> for resultType/resultDesc
       -> related?type=1 for live presence
```

If create succeeds but update/submit fails, the Worker attempts immediate cleanup and returns
`draftId` plus `cleanedUp`. Delete tries the draft endpoint first and falls back to the published
design endpoint when MakerWorld has already promoted the record.

## 7. ModelPrep Worker surface

| Route | Purpose |
|---|---|
| `POST /makerworld/web/login` | email/password token exchange |
| `POST /makerworld/web/login-code` | emailed verification code |
| `GET /makerworld/web/check` | session liveness |
| `GET /makerworld/web/whoami` | account label |
| `GET /makerworld/web/capabilities` | CyberBrick/upload eligibility |
| `POST /makerworld/web/refresh` | access-token refresh |
| `POST /makerworld/web/upload/presign` | direct-S3 grant |
| `POST /makerworld/web/upload` | <=95 MB compatibility proxy |
| `GET /makerworld/web/suggest-tags` | live tag suggestions |
| `GET /makerworld/web/bom-catalog` | cached BOM catalog |
| `GET /makerworld/web/related` | own-design search/linking |
| `POST /makerworld/web/publish` | regular draft/save/submit |
| `GET /makerworld/web/draft-status` | regular result status |
| `GET /makerworld/web/my-creations` | regular live designs |
| `POST /makerworld/web/delete` | regular delete |
| `POST /makerworld/web/laser-cut/publish` | Laser draft/save/submit |
| `GET /makerworld/web/laser-cut/draft-status` | Laser result status |
| `POST /makerworld/web/laser-cut/delete` | Laser delete |

All table paths are under `/api/v1`.

## 8. Verification status and what is genuinely left

Implemented and automated:

- all four 3D/Laser raw/profile mode branches;
- direct large-file transport and proxy fallback;
- separate regular and Laser draft/status/list/delete handling;
- `.lac` metadata parser using generated ZIP fixtures;
- profile, remix, forbidden-word, size, CyberBrick, and account-capability validation;
- save-as-draft and submit flows;
- desktop/mobile rendered UI checks and clean console.

Historically live-verified:

- regular raw/private publish then delete;
- Bambu Studio `.3mf` private publish with print profile then delete;
- regular remix, BOM, docs, Exclusive, related search;
- Laser create then delete.

Still requires an explicit controlled live mutation:

1. Final `.lac` submit with a real Bambu Suite fixture, followed by delete.
2. Final raw SVG/DXF Laser submit, followed by delete (the historical SVG submit returned a
   generic 400 even though draft creation worked).
3. CyberBrick submit using an account where MakerWorld reports `rcUpload=true`, followed by delete.
4. One authenticated direct-S3 browser upload above 95 MB to prove current bucket CORS in the
   deployed Worker/frontend environment.

Those are external verification boundaries, not known missing UI/payload branches. Do not run
them without the required fixture/account and approval to create/delete private MakerWorld data.
