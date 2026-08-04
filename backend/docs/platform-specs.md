# Per-platform listing specs (text + image limits)

Consolidates what we know about each marketplace's listing limits. Confidence:
**HIGH** = read from the platform's own form/API; **MED** = help doc / empirical; **UNKNOWN** =
not verified (we deliberately do NOT enforce a guessed number). Mirrored in
`deploy/src/App.jsx` → `PLATFORMS[].limits` / `.covers`; enforced on the Details + Images steps.

For the authenticated base audit from 2026-07-29 and certification updates
through 2026-08-02, including conditional flows, formats, taxonomies, API
contracts, media behavior, fingerprints, and the implementation-gap ledger, see
`platform-upload-requirements-live.md`. It supersedes older assumed crop/count
values for MakerWorld, Printables, and Cults3D.

For current implementation/certification status and continuation order, use
`modelprep-current-handoff-2026-08-01.md`. This file is the compact requirements
matrix, not the primary handoff.

## Text limits (title / tags / description)

| Platform | Title max | Tags (count) | Per-tag chars | Tag format | Desc max | Confidence |
|---|---|---|---|---|---|---|
| **MakerWorld** | 50 | 50 | 100 | free text | none (HTML `summary`) | HIGH (live form) |
| **Printables** | 255 | UNKNOWN | 25 | lowercase a–z0–9, **no spaces/punctuation** | no client cap | HIGH title/tag-format; tagMax UNKNOWN |
| **Nexprint** | 80 | 20 | 50 | Unicode text/emoji/spaces; trimmed and deduplicated | 10000 | HIGH (signed-in form + current prod bundle, 2026-07-31) |
| **Cults3D** | UNKNOWN | 20 | UNKNOWN | free tags in a 300-char field; separate fixed meta tags | UNKNOWN | HIGH tag count/current DOM; other caps UNKNOWN |
| **MyMiniFactory** | UNKNOWN (`required`, no `maxlength`) | 20 | UNKNOWN | comma-separated; leading `#` removed | UNKNOWN (no client cap); dimensions 100 chars and material quantity 45 chars | HIGH dimensions/material + tag count; title/desc/per-tag UNKNOWN (signed-in form, 2026-08-03) |
| **Thingiverse** | no current client cap observed | UNKNOWN | UNKNOWN | free-create/autocomplete; spaces normalize to `_` | no current client cap observed | HIGH signed-in DOM/bundle, 2026-08-01; counts UNKNOWN |
| **Thangs** | UNKNOWN | UNKNOWN | UNKNOWN | dynamic tags/category path | UNKNOWN | current bundle + official help, 2026-08-01; caps UNKNOWN |
| **MakerRoad** | 60 | UNKNOWN | UNKNOWN | autocomplete/free-entry; custom values encoded separately | no current client cap observed | HIGH signed-in DOM/bundle, 2026-08-01; tag caps UNKNOWN |
| **Creality Cloud** | 60 | 20 | UNKNOWN | comma entry, no `#` | no client cap observed | HIGH title/tag count (signed-in form + prod bundle, 2026-07-31) |
| **MakerOnline** | 100 | 20 | 20 | Enter commits Unicode text | 9000 plain-text chars | HIGH (signed-in DOM + prod bundle, 2026-07-31) |

Notes:
- Printables also has a separate **summary** field = 120 chars (HIGH).
- Printables rich-description images use a separate active-editor upload with
  an **8 MiB** pre-presign limit; this is not the unknown gallery-image limit.
- MakerWorld text limits are **UI-only** (the PUT accepts over-limit values). See `makerworld-web-flow.md`.
- The remaining UNKNOWN platforms expose no documented caps — verify from each authenticated upload
  form's `maxlength` (same approach as the MakerWorld capture) before enforcing numbers.

## Image / cover specs

| Platform | Cover aspect(s) | Gallery max | Per-file size | Formats | Confidence |
|---|---|---|---|---|---|
| **MakerWorld** | required 4:3 + optional 3:4 | 16 model pictures, separate from covers | ≤30 MiB (20 MiB CN) | jpg/png/webp/gif; one MP4/MOV video ≤30s | HIGH (live DOM + current bundle, 2026-07-29) |
| **Printables** | no upload-time ratio/crop observed | UNKNOWN | UNKNOWN | jpg/jpeg/png/webp/gif/heic/heif; ZIP input | HIGH behavior/formats; count/size UNKNOWN |
| **Cults3D** | no upload-time ratio/crop observed | UNKNOWN | ≤10 MiB / images ≤8000×8000 px | jpg/jpeg/png/webp/gif/webm/mp4 | HIGH (live DOM + current bundle, 2026-07-29) |
| **MyMiniFactory** | first ordered image is primary (`primary_image` radio keyed by filename) | UNKNOWN — no client cap in current DOM/bundle | ≤5 MiB (`maxFileSize: 5*1024*1024`) | no client allow-list; server-side only. ModelPrep normalizes to JPEG | HIGH size/behavior (current inline uploader, 2026-08-03); count and extensions UNKNOWN |
| **Thingiverse** | no required crop observed; pictures recommend ≥1024 px width | UNKNOWN | ≤5 MB images | stl/obj/3mf/scad plus broad CAD/docs; jpg/png/gif images | HIGH form/formats + official image limit, 2026-08-01; count/model size UNKNOWN |
| **Thangs** | no required crop verified | UNKNOWN | model 250 MB threshold; references ≤500 MB | stl/3mf/step/stp/obj/glb/fbx/blend/usdz/gltf; jpg/jpeg/png/gif/webp/avif/heic media | HIGH current bundle, 2026-08-01; image cap UNKNOWN |
| **MakerRoad** | recommended 1:1 | 3–10 images | ≤10 MB each | jpg/jpeg/png/gif/bmp/webp; video role exposed but contract UNKNOWN | HIGH signed-in DOM/current bundle, 2026-08-01 |
| **Nexprint** | required fixed 4:3 crop; 2000×1500 recommended | 9, separate from cover | ≤100 MiB each | jpg/jpeg/png/webp/gif; no current video slot | HIGH (signed-in form + current prod bundle, 2026-07-31) |
| **Creality Cloud** | required web 4:3 + app 3:4 | 9, separate from covers | ≤20 MiB each | jpg/jpeg/png/webp/gif | HIGH (signed-in form + prod bundle, 2026-07-31) |
| **MakerOnline** | first ordered image is cover; no required crop observed | 20 total, including cover | ≤30 MiB each | jpg/jpeg/png/gif/webp/heic | HIGH (signed-in DOM + prod bundle, 2026-07-31) |

The legacy Printables 4:3/25 and Cults3D 1:1/20 guesses have been removed from
`PLATFORMS[]`. Both targets now preserve original ordered media and represent
their unverified gallery caps as unknown. Do not reintroduce those values as
platform requirements.

## MakerWorld documentation uploads (verified 2026-06-22)

- **Assembly Guide** → `designGuide[]`: pdf/png/jpg/webp/gif; images ≤30 MB, pdf ≤50 MB; **max 25**.
- **Other Files** → `designOther[]`: txt/pdf/zip; txt ≤2 MB, pdf ≤50 MB, zip ≤100 MB; **max 10**.
- Enforced client-side in `MakerWorldOptions.validateDocs`.

## Status of real-publish integrations

Status vocabulary used here and in the handoff:

- **implemented**: production-shaped code exists and has automated coverage;
- **live-certified**: a signed-in account accepted a safe real artifact and the
  adapter read it back;
- **fully certified**: every supported conditional branch has account-backed
  evidence. No platform has reached this final state yet.

| Platform | Publish | Notes |
|---|---|---|
| MakerWorld | ✅ real (direct Electron flow; Worker fallback on web) | STL + Bambu-3MF + Laser & Cut paths; encrypted desktop session; direct metadata and signed-S3 uploads; one ≤30s MP4/MOV model-video path is implemented but not live-certified |
| Cults3D | ✅ real (direct Electron flow; Worker fallback on web) | Markdown + flat-keyword/current-meta-tag mapping, manufacturing settings, AI/comments, typed image/video media, category/license flow, encrypted multi-account credentials and direct signed-S3 uploads; no guessed crop/count policy |
| Printables | ✅ real (first-party web contract) | draft-first GraphQL flow, rich HTML, taxonomy IDs, file folders/notes, native HEIC conversion, G-code/SLA/retained ZIP and publication readback; specialist draft `1797772` and public model `1797774` live-certified; gallery cap remains unknown |
| Nexprint | ✅ real draft path certified in browser and Electron | encrypted desktop session; first-party REST + presigned object upload; latest exact-app unpublished draft `2083625532272496640` passed model/image/BOM/taxonomy/license readback; public and broader attachment/eligibility branches remain |
| Creality Cloud | ✅ real private path certified | encrypted isolated desktop session; first-party JSON + short-lived Aliyun STS upload; latest exact-app Original/private model `6a6e3f28753b84f6aab190a8` passed file/cover/metadata readback; existing-draft edit, public and conditional branches remain |
| MakerOnline | ✅ real unpublished draft path certified | encrypted isolated desktop session; first-party multipart/JSON contract; latest exact-app unpublished draft `316221` passed ordered image/file, metadata, taxonomy/license and visibility readback; `.3mf`, docs, public and conditional branches remain |
| MyMiniFactory | ✅ real private path certified, core **and** advanced | encrypted passwordless desktop session; first-party image/presign/form contract; hierarchical categories, metadata/license/declarations, Private default and object readback. Advanced private object `829284` was re-read read-only by the corrected exact package on 2026-08-03 and verified for private state, categories `60/462`, 10 images, 3 files and remix parent `829056`. Public review, ZIP/archive and premium branches (account-gated) remain uncertified |
| Thingiverse | ✅ real unpublished draft path certified | complete upload/create/finalize/publish/readback path; same-page token recovery; latest exact-app draft `7390480` saved and read back; public and optional editor branches remain separate |
| Thangs | ✅ real private single-part path certified | encrypted local-storage bearer-token recovery, authenticated current-user check, signed uploads, validation, model/assets and three-part readback; latest exact-app private model `1583272` passed full readback |
| MakerRoad | ✅ real private Save path certified | authenticated `X-Token`, four file roles, dynamic metadata, save/review submission and required `uploadType=1` edit readback; title/privacy/plan/price-type/role-count mismatches fail closed; latest exact-app private draft `M2134222528` passed; native video is absent from the current form |

The latest exact-app closeout batch ran four destinations at once and finished
10 succeeded, 0 failed using only private/draft/secret defaults. See
`platform-live-certification-audit-2026-08-01.md` for current receipts and the
per-platform remaining branch matrix in the canonical handoff.

### Continuation order

The ten-platform direct set and every safe core private/draft/secret path are now
live-certified in the exact packaged app. Continue with optional branches one at
a time: public publication, paid/account-gated paths, remix/source variants,
special model/profile/document types, memberships/plans, video, scheduled
publishing and platform-specific declarations. MakerRoad's native video contract
is still unknown and must not be guessed. No platform is fully certified.

This order is a current engineering handoff, not a permanent product promise.
Re-rank it when new user feedback or platform API access changes.

## One-click multi-platform publish

The Publish step coordinates the ten implemented upload flows—MakerWorld,
Printables, Cults3D, Nexprint, Creality Cloud, MakerOnline, MyMiniFactory, MakerRoad, Thangs, and Thingiverse—from one button. It uses the active account
for each selected platform and continues to the next platform when one upload
fails. Up to four desktop destinations run at once while each destination keeps
its own request order; browser fallback remains serial. A completed partial
failure can retry failed destinations only while preserving successful receipts.
The individual publish buttons remain available.

The bundled Demo project is simulation-only even when real accounts are
connected. It reports an unpublished MakerWorld draft, unpublished Printables
draft, secret/unlisted Cults3D listing, unpublished Nexprint draft, and a private Creality model simulation without
sending files or metadata to any platform. Non-demo projects preserve each
platform's configured publish visibility; Printables and Nexprint are draft-first,
while Creality is private-first unless the user explicitly selects public publishing. MakerOnline is
draft-first; its latest exact-app safe-core receipt is retained draft `316221`.

The Publish panel labels every target `real`, `simulation`, or `missing`, then
keeps a per-platform receipt with queued/working, draft, private, secret, public,
approval-pending, simulated, or failed status; concise error detail; result URL
when available; and a final success/failure count.
