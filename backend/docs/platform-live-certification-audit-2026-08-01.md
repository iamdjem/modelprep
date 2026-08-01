# ModelPrep platform live certification audit

Audit date: **2026-08-01**
Repository: `/Users/alex/modelprep`
Packaged runtime: `desktop/dist/mac-arm64/ModelPrep.app`
Runtime marker: **BUILD F8B1E49 - AUG 1, 08:56 PM**

## Purpose and evidence boundary

This is the single closeout ledger for the ten current direct-publishing targets.
It separates implementation and automated evidence from an actual accepted
production artifact. A green Settings badge means the isolated ModelPrep desktop
session passed that platform's authenticated identity check; it does not mean the
user happens to be signed in to the same site in Chrome, and it does not certify
every optional upload branch.

The authorized live checks used only private, draft, secret, or unpublished test
content. Nothing was made public or deleted. Every created artifact below is
intentionally retained for creator review.

Evidence classes used here:

- **Live-certified:** ModelPrep or the mapped first-party flow created a safe
  production artifact and its important persisted fields were read back.
- **Browser contract proven:** the current first-party browser flow accepted the
  operation, but the corresponding isolated ModelPrep desktop flow still has an
  open session or readback gate.
- **Implemented/local:** production-shaped code and tests exist, but no current
  accepted ModelPrep artifact proves the path.
- **Blocked:** ModelPrep deliberately will not mutate the account.

## Why Settings and Publish disagreed

The reported Publish screenshot mixed two states. Printables was an expired
isolated desktop session at that moment; Chrome sign-in did not refresh it.
Thangs was actually still signed in, but ModelPrep's obsolete cookie-only validator
could not recognize its current local-storage bearer-token session. Thingiverse
was genuinely connected but failed preflight under the legal
gate that was active at the time. Written clearance was subsequently recorded on
2026-08-01 and that gate is now removed. MakerRoad had
a more serious false positive: its session check called a public taxonomy endpoint,
so any site cookie could appear connected even without an authenticated token.

The current build fixes the explanation and the MakerRoad check. Settings now
explicitly says it verifies isolated ModelPrep sessions. MakerRoad requires the
authenticated `GET /api/user` response and an `X-Token` cookie; its API adapter
mirrors that cookie value into the first-party `X-Token` header. Consequently the
runtime initially showed **MakerRoad — Reconnect needed** instead of a false green
state. After reconnect it passes the authenticated identity check. Thangs now
captures its bearer token inside the isolated main-process window, encrypts it,
and verifies `GET /users/current?likes=false` against the production API. A manual
`Referer` header that Electron rejected before transmission was removed. The signed
packaged runtime now shows all ten accounts connected. Thingiverse recovery now
exchanges the isolated first-party session for its two token roles and verifies
`GET /api/v2/users/me` in that same signed-in page context before closing the
window and encrypting the recovered session. This fixes the prior false
reconnect-required state without weakening the identity check.

## Current result ledger

| Platform | Current desktop session | Best evidence | Retained artifact / result | What was read back | Remaining certification gap |
|---|---|---|---|---|---|
| MakerWorld | Connected | Live-certified, private, exact-app four-way batch | [latest private receipt 9053658](https://makerworld.com/en/my/models/drafts/9053658/edit) | Safe core upload and readback passed; earlier deep fixture proved STL, Bambu 3MF, covers/gallery, taxonomy, tags, license, description and private state | Video, genuine LAC final submit, public, remix, Exclusive/CyberBrick and optional matrices |
| Printables | Connected | Live-certified, unpublished, exact-app four-way batch | [latest draft 1797292](https://www.printables.com/model/1797292/edit) | 3 files, ordered photos, metadata and unpublished draft readback passed | Public, remix/approval, Store/Club, specialist file types and account-gated branches |
| Cults3D | Connected | Live-certified, secret, exact-app four-way batch | [latest secret design](https://cults3d.com/en/3d-model/game/articulating-desk-dragon-print-in-place-6f02ba1cd366b9cb06a5) | Ordered media/files, metadata, free CC BY-NC and secret state readback passed | Optional subcategory/meta-tags, paid/open-price, public and live video branches |
| MyMiniFactory | Connected as `iamdjem` | Live-certified private, exact packaged app plus independent hydrated-editor readback | [latest private object 829056](https://www.myminifactory.com/object/edit/829056) | title, private state, category IDs `60` and `462`, 10 ordered images, 3 files, tags and full description | Public review and optional branches remain uncertified |
| Nexprint | Connected | Live-certified, unpublished, exact-app batch | [latest draft 2083625532272496640](https://www.nexprint.com/en/editUpload/2083625532272496640) | Models, images, tags, BOM, taxonomy/license and draft readback passed | Public and optional attachment/eligibility/extension combinations |
| Creality Cloud | Connected | Live-certified, private, exact-app batch | [latest model 6a6e3f28753b84f6aab190a8](https://www.crealitycloud.com/model-detail/6a6e3f28753b84f6aab190a8) | Images, files, metadata, private Original state and readback passed | Public, draft-edit, non-original attribution and eligible optional branches |
| MakerOnline | Connected | Live-certified, unpublished, exact-app batch | [latest draft 316221](https://www.makeronline.com/en/upload?id=316221) | Ordered images/files, metadata, taxonomy/license, private draft state and readback passed | 3MF profiles, documentation, remix, public, paid, Creative Kit, China sync, resin and large-file cases |
| Thangs | Connected as `iamdjem` | Live-certified, private, exact packaged app | [latest private model 1583272](https://thangs.com/designer/model/1583272) | Single-part model plus references/images; details, attachments, license, category, private state and metadata readback passed | Multipart/bulk/assembly, versions, plans, paid, public and optional editor branches |
| MakerRoad | Connected as `iamdjem` | Live-certified, private, exact-app batch | private draft `M2134222528` | Ordered images, model/profile roles, metadata and private state saved and read back through the required `uploadType=1` route | Native video contract unknown; public, paid, remix, schedule and other optional branches remain uncertified |
| Thingiverse | Connected as `iamdjem` | Live-certified unpublished exact-app batch plus browser contract | [latest draft 7390480](https://www.thingiverse.com/thing:7390480/edit) | Ordered model files/photos, title/summary, tags, category, license and unpublished state readback passed; earlier browser/editor proof established the detailed contract | Public publication and optional rich-section/education/remix branches remain uncertified |

The latest closeout run used the exact packaged app, four concurrent destination
slots, and only safe private/draft/secret defaults. It finished **10 succeeded,
0 failed**. This proves the safe core of every direct adapter and the four-way
orchestrator for the bundled fixture. It does not certify optional/public/paid
branches. All ten closeout artifacts above are intentionally retained.

## Media, file and metadata parity snapshot

| Platform | Images / cover behavior implemented | Model/media formats implemented | Taxonomy and shared-field propagation |
|---|---|---|---|
| MakerWorld | Separate landscape and portrait covers; ordered gallery; up to 16 model pictures from the current form; MP4/MOV code path exists | Raw/source families plus Bambu 3MF/profile and mapped Laser roles | Live category/tags/license/profile mappings; common title/description/tags/license feed the platform adapter |
| Printables | Ordered photos; the old guessed 4:3 crop and guessed 25-image cap were removed | Current model/source upload family through signed storage | Live taxonomy, tags, authorship/license and per-file details mapped |
| Cults3D | Ordered typed media; the old guessed square crop and guessed 20-media cap were removed | Images plus typed MP4/WebM video and model files | Category, license, price and visibility mapped; optional paid/subcategory still needs live proof |
| MyMiniFactory | Ordered photos; no unverified hard crop/count claim | Raw object files and captured first-party image upload | Hierarchical category IDs, tags, license, print data, remix and declaration fields mapped; required categories now fail closed and read back |
| Nexprint | Required 4:3 cover plus ordered gallery | Raw files and attachments accepted by its current form | Live category, tags, BOM, license, originality and AI disclosure mapped |
| Creality Cloud | Separate web/app covers plus ordered gallery | Raw model files through Aliyun multipart | Live folder/category/license/tags, instructions, visibility, maturity and originality mapped |
| MakerOnline | Ordered images | Raw models, documents and optional parsed 3MF profiles | Live taxonomy and common metadata mapped; optional matrix listed above is not fully certified |
| Thangs | Image count/dimensions/crop remain unknown—ModelPrep must not guess | STL, 3MF, STEP/STP, OBJ, GLB, FBX, BLEND, USDZ, GLTF plus broad references; 3MF/FBX/GLB are single-part-only | Categories, tags, license, references, private state and structures mapped; optional editor branches incomplete |
| MakerRoad | 3–10 images, current UI recommendation 1:1, max 10 MB each | 3MF/STL/OBJ models, 3MF profiles, captured document family; video format/size still unknown | Live categories/printers/materials/colors/tags/licenses, AI/NSFW, remix, schedule and price mapped; recheck authenticated availability after outages |
| Thingiverse | Ten uploaded photos retained in order; Thingiverse added two STL renders after finalization | Three ordered model files live-proven; current editor file/media family remains enabled | Category `124`, 8 tags, CC BY-NC, title/summary and unpublished state read back; public and optional matrices remain open |

Shared project data is propagated into every adapter, then translated to
platform-native identifiers. This is not a promise that every optional native
field is interchangeable: profiles, BOM, printer/material compatibility,
platform declarations, paid eligibility, remix source, special campaigns, and
public terms remain platform-specific controls and preflight gates.

## Fixes made during this certification pass

1. Corrected Settings copy so Chrome sign-in is never confused with an isolated
   encrypted desktop session.
2. Refreshed Printables in its ModelPrep partition and confirmed the current
   draft flow.
3. Corrected MyMiniFactory readback to parse category IDs from the
   `UploadCategories` React-on-Rails payload and object filenames from the
   `UploadFilesWrapper` payload before hydration creates download links.
4. Corrected Thangs signed PUT content types to match its first-party storage
   helper (`application/octet-stream`, with its explicit text/PDF exceptions).
5. Enforced Thangs single-part-only 3MF/FBX/GLB behavior and kept incompatible
   files as references for multipart/bulk structures.
6. Made MakerRoad optional metadata endpoint failures non-fatal while keeping
   category resolution required.
7. Normalized MakerRoad category labels across the live `Games &Toys` spelling.
8. Added MakerRoad `X-Token` header mirroring and replaced the public taxonomy
   false-positive session check with authenticated `/api/user` validation.
9. Replaced Thangs cookie-only validation with encrypted local-storage bearer-token
   recovery and authenticated `/users/current?likes=false` verification; removed
   the manually supplied referrer that Electron rejected before transmission.
10. Kept the real upload fixture private/draft/secret-first and corrected its
   Cults, Nexprint and Creality category/license defaults.
11. Replaced respawning `launchctl submit` QA startup with a normal launch of the
    exact packaged binary, and explicitly signs/verifies that bundle.
12. Corrected Thingiverse reconnect to capture the token exchange and identity in
    the same signed-in page, then close and persist the verified session.
13. Aligned Thingiverse creation with the current first-party editor: numeric
    pending IDs, no implicit malformed description section, browser-shaped empty
    detail/education parts, current app association, and Mechanical Toys category
    `124` in the real-upload fixture.
14. Added sanitized MyMiniFactory submit diagnostics so a future HTTP failure
    records safe response metadata and trace/error text without credentials,
    cookies, CSRF values, signed URLs, or uploaded payload values.
15. Added failed-only batch retry. Successful receipts and result URLs remain
    intact; only failed destinations return to the four-slot scheduler.

## Verification

- Desktop: **88/88 tests passed**.
- Renderer: **37 files, 160/160 tests passed**.
- Backend: **25/25 tests passed**; `tsc --noEmit` passed.
- Production renderer build passed (1,604 modules). Vite reports only its normal
  large-chunk advisory.
- Packaged app signature: Developer ID Application, team `UTZ4TVACJS`, identifier
  `io.makerstats.modelprep`; `codesign --verify --deep --strict` passes.
- Runtime inspection used the exact source bundle, not `/Applications/ModelPrep.app`.
- Known non-blocking test warning: `NexprintOptions` renders an option list with a
  missing React key. This should be cleaned up, but it did not fail tests or the
  live upload path.

## Exact continuation order

1. Treat Thingiverse unpublished draft `7390480` as the completed latest exact-app core
   proof. Certify public and optional branches only as separate explicit tests.
2. Treat Thangs private single-part model `1583272` as complete. Certify its
   multipart, plan, paid, public and other optional branches individually.
3. Treat MyMiniFactory exact-app private object `829056` as the completed core
   proof. Certify public review and optional branches separately.
4. Treat MakerRoad private draft `M2134222528` and the corrected
   `/models/getEdit?...&uploadType=1` readback as proven; do not create a duplicate
   merely to retest it.
5. Certify the optional/public/paid branches one platform at a time. Do not use a
   ten-platform public batch as a certification shortcut.
