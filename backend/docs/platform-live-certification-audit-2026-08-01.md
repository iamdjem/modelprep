# ModelPrep platform live certification audit

Audit date: **2026-08-04**
Repository: `/Users/alex/modelprep`
Packaged runtime: `desktop/dist/mac-arm64/ModelPrep.app`
Runtime marker: **BUILD 570A8DD - AUG 4, 11:06 AM**

## Purpose and evidence boundary

This is the single closeout ledger for the ten current direct-publishing targets.
It separates implementation and automated evidence from an actual accepted
production artifact. A green Settings badge means the isolated ModelPrep desktop
session passed that platform's authenticated identity check; it does not mean the
user happens to be signed in to the same site in Chrome, and it does not certify
every optional upload branch.

Most authorized live checks used private, draft, secret, or unpublished test
content. The separately authorized Printables public lifecycle created model
`1797774`, which remains public pending exact deletion confirmation. Nothing was
deleted. Every created artifact below is retained for creator review.

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
| Printables | Connected | Live-certified specialist draft and normal-public lifecycle from exact packaged app | [specialist draft 1797772](https://www.printables.com/model/1797772/edit); [public model 1797774](https://www.printables.com/model/1797774-articulating-desk-dragon-print-in-place) | Draft: eleven ordered images including converted HEIC, G-code, SLA/SL1, retained ZIP and full metadata. Public: verified draft, publication and persisted live-state readback | Delete `1797774` after exact confirmation; Store/Club eligible account, approval account, remix/reupload, unpacked ZIP and rich-description upload |
| Cults3D | **Reconnect needed in isolated app; signed in in Chrome** | Live-certified, secret, exact-app four-way batch; current edit readback contract browser-proven | [latest secret design](https://cults3d.com/en/3d-model/game/articulating-desk-dragon-print-in-place-6f02ba1cd366b9cb06a5) | Ordered media/files, metadata, free CC BY-NC and secret state readback passed; the signed-in edit form currently exposes ordered persisted blueprint/illustration IDs and filenames | Reconnect the isolated app session before another ModelPrep upload; optional subcategory/meta-tags, paid/open-price, public and live video branches |
| MyMiniFactory | Connected as `iamdjem` | Live-certified core private path **and** advanced specialist branch, both from the exact package | [core object 829056](https://www.myminifactory.com/object/edit/829056); [advanced private object 829284](https://www.myminifactory.com/object/edit/829284) | `829284` re-read read-only by the corrected exact package on 2026-08-03: private, categories `60/462`, 10 ordered images, 3 files, print tips/time/dimensions/unit/FDM/material, support-free, remix parent `829056`, CC BY-NC-SA, title | Public review, ZIP/archive and premium branches (account-gated), file/extension extremes and deletion remain uncertified |
| Nexprint | Connected | Live-certified, unpublished, exact-app batch | [latest draft 2083625532272496640](https://www.nexprint.com/en/editUpload/2083625532272496640) | Models, images, tags, BOM, taxonomy/license and draft readback passed | Public and optional attachment/eligibility/extension combinations |
| Creality Cloud | Connected | Live-certified, private, exact-app batch | [latest model 6a6e3f28753b84f6aab190a8](https://www.crealitycloud.com/model-detail/6a6e3f28753b84f6aab190a8) | Images, files, metadata, private Original state and readback passed | Public, draft-edit, non-original attribution and eligible optional branches |
| MakerOnline | Connected | Live-certified, unpublished, exact-app batch | [latest draft 316221](https://www.makeronline.com/en/upload?id=316221) | Ordered images/files, metadata, taxonomy/license, private draft state and readback passed | 3MF profiles, documentation, remix, public, paid, Creative Kit, China sync, resin and large-file cases |
| Thangs | Connected as `iamdjem` | Live-certified, private, exact packaged app | [latest private model 1583272](https://thangs.com/designer/model/1583272) | Single-part model plus references/images; details, attachments, license, category, private state and metadata readback passed | Multipart/bulk/assembly, versions, plans, paid, public and optional editor branches |
| MakerRoad | Connected as `iamdjem` | Live-certified, private, exact-app batch | private draft `M2134222528` | Ordered images, model/profile roles, metadata and private state saved and read back through the required `uploadType=1` route | Current production DOM/bundle has no video input or serializer; public, paid, remix, schedule and other optional branches remain uncertified |
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
| Printables | Ordered photos, native HEIC/HEIF chooser and JPEG conversion; no fixed crop/count guess | Current model/source family plus live-proven G-code, SLA/SL1 and retained ZIP through signed storage | Live taxonomy, tags, authorship/license and per-file G-code controls mapped; direct public lifecycle proven |
| Cults3D | Ordered typed media; the old guessed square crop and guessed 20-media cap were removed | Images plus typed MP4/WebM video and model files | Category, license, price and visibility mapped; optional paid/subcategory still needs live proof |
| MyMiniFactory | Ordered photos; no unverified hard crop/count claim | Raw object files and captured first-party image upload | Hierarchical category IDs, tags, license, print data, remix and declaration fields mapped; required categories now fail closed and read back |
| Nexprint | Required 4:3 cover plus ordered gallery | Raw files and attachments accepted by its current form | Live category, tags, BOM, license, originality and AI disclosure mapped |
| Creality Cloud | Separate web/app covers plus ordered gallery | Raw model files through Aliyun multipart | Live folder/category/license/tags, instructions, visibility, maturity and originality mapped |
| MakerOnline | Ordered images | Raw models, documents and optional parsed 3MF profiles | Live taxonomy and common metadata mapped; optional matrix listed above is not fully certified |
| Thangs | Image count/dimensions/crop remain unknown—ModelPrep must not guess | STL, 3MF, STEP/STP, OBJ, GLB, FBX, BLEND, USDZ, GLTF plus broad references; 3MF/FBX/GLB are single-part-only | Categories, tags, license, references, private state and structures mapped; optional editor branches incomplete |
| MakerRoad | 3–10 images, current UI recommendation 1:1, max 10 MB each | 3MF/STL/OBJ models, 3MF profiles, captured document family; current form has no native video field | Live categories/printers/materials/colors/tags/licenses, AI/NSFW, remix, schedule and price mapped; recheck authenticated availability after outages |
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

- Desktop: **144/144 tests passed**.
- Renderer: **38 files, 224/224 tests passed**.
- Backend: **31/31 tests passed**; `tsc --noEmit` passed.
- Production renderer build passed (1,605 modules). Vite reports only its normal
  large-chunk advisory.
- The current local QA bundle is ad-hoc hardened-runtime signed, identifier
  `io.makerstats.modelprep`; `codesign --verify --deep --strict` passes. The
  configured Developer ID identity was unavailable in this execution context,
  so this is not distribution-signing evidence.
- Runtime inspection used the exact source bundle, not `/Applications/ModelPrep.app`.
- Exact runtime marker **BUILD 570A8DD - AUG 4, 11:06 AM** loaded the bundled
  renderer, displayed Settings account count 9, showed Cults3D as Reconnect
  needed, and visibly rendered Thingiverse Customizer disabled without SCAD.
  This final runtime check was read-only.
- The former `NexprintOptions` missing-key warning is fixed and covered by a
  console-error regression assertion.
- Privacy-safe aggregate resource telemetry is packaged and idle-runtime proven.
  Completed batches now retain the latest 10 doubly sanitized aggregate reports
  locally and expose a local JSON download; no live four-publisher telemetry
  sample has been authorized yet, so completed-report packaged UI state remains
  component-proven rather than live-batch-proven.
- The Printables public run retained a one-active sample with an approximately
  1,164.4 MB peak app working set, four processes and 4.1% CPU. This is not the
  still-required four-active concurrency sample and does not justify raising the
  scheduler above four.
- MakerWorld's MP4/MOV branch now fails closed if draft-status readback omits or
  changes the submitted `designVideo` metadata. This is implemented/local
  evidence only; no video upload or new live artifact was created during this
  follow-up.
- Cults3D's current signed-in edit form was inspected read-only on the retained
  secret listing. It returned three ordered blueprint IDs/names and ten ordered
  illustration IDs/names. Both desktop and Worker transports now compare those
  canonical persisted fields plus title and visibility, retain the receipt on
  mismatch, and report the branch uncertified. MP4/WebM is locally covered, but
  no video or other new Cults artifact was uploaded.
- Follow-up local validation now keeps both Cults transports aligned with the
  current uploader: JPEG/PNG/WebP/GIF/MP4/WebM only, an image first, and a
  10 MiB cap for every media item. GIF and oversized-video regressions are
  covered; no account mutation occurred.
- A full read-only Cults form, price, edit, My Creations and current-uploader
  audit on 2026-08-02 added renderer-to-transport propagation for manufacturing
  settings, the current 12 allow-listed meta tags, AI disclosure and comments.
  This is implemented/local evidence only; no optional Cults listing was made.
- A full read-only MakerRoad create/editor/bundle audit on 2026-08-02 confirmed
  all six current sections and the absence of a video field/serializer. Its
  renderer now fails closed when edit readback changes title, privacy, plan,
  price type or any present upload-role count. No new MakerRoad artifact was
  created.
- A 2026-08-02 signed-out Cults asset re-check found the deployed
  `packs/manifest.json` pointing at a newer upload pack
  (`upload-f6d1a2a902153d3b47f2.js`) than the fingerprinted one, which still
  resolves byte-identically. The newer pack removes the client-side `.rar`
  rejection; the `&`/`>`/`<` file-name rule is unchanged in both. ModelPrep now
  enforces that file-name rule fail-closed before authentication in the direct
  Electron and Worker transports. No signed-in screen was reachable, so the
  comprehensive Cults audit remains open and no new artifact was created.
- Printables specialist draft `1797772` passed exact-app end-to-end native HEIC
  selection/conversion, eleven-image ordering, G-code, SLA/SL1, retained ZIP and
  metadata readback. Public model `1797774` then passed draft verification,
  publication and live-state readback. It remains public; deletion has not been
  authorized or certified. Diagnostic drafts `1797764` and `1797758` may remain.

## 2026-08-03 MyMiniFactory closeout and comprehensive audit

Retained Private object `829284` was re-read **read-only** by the corrected exact
package. The receipt succeeded — `private · 10 images · 3 files · categories
60/462 · remix of 829056` — so the advanced print/license/remix branch is now
exact-app live-certified. No object was created, edited or deleted.

Three defects were fixed to reach it, none reachable from the certified upload
path: `status()` used a manual redirect that Electron cancels when re-reading an
existing `/object/<id>`; the parser could not read `selected=""`, so
**`license_id` never read back at all**; and `.mp-input`'s `width: 100%`
collapsed the Dimensions field to ~19 px in the packaged app. A GET-only
**Verify existing object** control now exists so a failed MyMiniFactory receipt
can be re-read without any risk of duplicating an object.

A comprehensive signed-in read-only audit classified every control on the current
create form. `can_use_zip_mode` and `isPremiumCreator` are both **false** on this
account, so ZIP/archive mode (~5 GB, 25 archive files) and premium branches are
recorded as account-gated rather than absent. Image count, image extension
allow-list and title/description caps stay UNKNOWN. Full matrix in
`myminifactory-web-flow.md`.

## Exact continuation order

1. MyMiniFactory's core and advanced branches are both exact-app live-certified.
   Its remaining branches are public review, account-gated ZIP/premium modes,
   file/extension extremes and deletion — each a separate authorized test.
2. Treat Printables specialist/public implementation as complete for the current
   free account. Delete `1797774` only after exact confirmation; use an eligible
   account for Store/Club or approval-gated publication.
3. Use `platform-one-by-one-implementation-playbook.md` for each next platform.
   MakerWorld video is deferred for the user's manual check, so begin Cults3D
   with a fresh read-only audit and one isolated optional branch.
4. Treat Thingiverse unpublished draft `7390480` as the completed latest exact-app core
   proof. Certify public and optional branches only as separate explicit tests.
5. Treat Thangs private single-part model `1583272` as complete. Certify its
   multipart, plan, paid, public and other optional branches individually.
6. Treat MyMiniFactory exact-app private object `829056` as the completed core
   proof. Certify public review and optional branches separately.
7. Treat MakerRoad private draft `M2134222528` and the corrected
   `/models/getEdit?...&uploadType=1` readback as proven; do not create a duplicate
   merely to retest it.
8. Certify the optional/public/paid branches one platform at a time. Do not use a
   ten-platform public batch as a certification shortcut.

## 2026-08-03 signed-in browser sweep across all ten platforms

Method: signed-in Chrome, per platform — rendered-page screenshot, DOM/`accept`
extraction, and comparison against ModelPrep's mapping. This is the visual pass
that MyMiniFactory proved a static DOM read cannot substitute for. No mutations.

| Platform | Result | Detail |
|---|---|---|
| MyMiniFactory | 6 defects found and fixed | see `myminifactory-web-flow.md` |
| MakerWorld | **2 gaps** | `Share` model type unreachable in UI; per-image 30 MB cap unenforced |
| Cults3D | **clean — audit gate closed** | signed-in reached at last. Photo `accept` = gif/jpeg/jpg/mp4/png/webm/webp, exactly ModelPrep's list (page prose omits gif — the attribute is authoritative). 41 file formats incl. `.rar`; 1 GB/file matches `maxFileMb: 1024`; tags 20; photos 10 MB / 8000×8000 |
| Printables | clean + 1 minor divergence | 58/58 formats identical and in order; title 255; summary 120. Gallery `accept` is gif/jpeg/png/webp only — no HEIC, which confirms ModelPrep's HEIC→JPEG conversion is required, not optional. **Divergence:** the tag hint permits spaces but `normalizePrintablesTag` strips them, so `desk toy` → `desktoy` where Printables would split it into two tags |
| Nexprint | clean | 30/30 formats identical including the unusual `.elesat`; title 80, tags 20/50 chars, description 10000; batch-upload mode already documented with `createOrUpdateBatch` |
| Creality Cloud | clean so far, **partially reachable** | visible stage matches: title 60, tags 20, covers 4:3 + 3:4 ≤ 20 MB, Model Source Original/Remix/Non-original. Gallery, visibility, license and print settings render only after a file is added, so they were not reachable read-only |
| MakerOnline | clean | images 0/20 ≤ 30 MB (jpg/png/gif/webp/jpeg/heic), title 100, tags 20; Model Source, AI declaration, Permissions and Printing Method all mapped |
| MakerRoad | clean | all six sections; 80-file cap enforced by `LIMITS.models`; images 3–10 at 1:1; title 60; no video field. Upload type 3 (Print Makes / Print Configurations) is **disabled on the live form**, so restricting to 1\|2 is correct |
| Thangs | **audited; 1 bug fixed + 1 ledger gap** | Verified by HTTP status against a signed-in session: `/3d-model/upload` **and** `/upload` both return **404** (the SPA renders a marketing shell, so `/upload` looks fine — status, not appearance, is authoritative). There is no direct upload URL: uploading starts from **Add new → Upload** on My Thangs, a button with no href. `UPLOAD_URLS.thangs` corrected to `/mythangs` (200). **Ledger gap:** My Thangs → All Files lists **six** "Articulating Desk Dragon — Print-in-Place" entries plus a loose `desk-dragon-bambu.3mf`, all dated 2026-08-01, but this ledger records only `1583272`. The other retained artifacts are undocumented and need their ids, visibility and keep/remove decision recorded |
| Thingiverse | clean + 1 minor divergence | `/upload` returns **HTTP 500 even while signed in as `iamdjem`**, so that route is platform-side broken; the editor was audited instead via retained draft `7390480`. Gallery holds ModelPrep's `01`-`10` in exact order plus the two STL renders Thingiverse generates (10 + 2 = 12, as documented); 3 Thing files; category Toys & Games -> Mechanical Toys (`124`); 8 tags; CC BY-NC; AI/WIP/Remix/NSFW and the four optional rich sections all present. No `accept` attributes and no `maxlength` anywhere, which confirms keeping its counts and caps UNKNOWN is correct. **Divergence:** "Let Others Customize" is **disabled by the platform unless a `.SCAD` file is uploaded**, but ModelPrep exposes `customizable` as an unconditional checkbox |

Net after the 2026-08-03 follow-up: **nine of ten audited at visual depth**.
Only Creality remains partial (its later sections render only after a file is
added). Two stale entry-point URLs were found and fixed — `UPLOAD_URLS.thangs`
(404) and `UPLOAD_URLS.thingiverse` (500). All ten `UPLOAD_URLS` have now been
loaded and checked by HTTP status; the other eight return 200.

## 2026-08-04 independent visual, DOM and developer-tools validation

Method: every retained/edit or create entry point was reopened in the user's
signed-in Chrome profile. Each reachable page was visually inspected and its
rendered labels, inputs, limits, `accept` values and conditional controls were
compared with the detailed platform flow document and ModelPrep's current
preflight/payload code. MakerWorld's active Next.js route asset was also
identified through the browser's CDP network log. No file was selected, no form
was submitted and no account data was changed.

| Platform | Current-page validation | Mapping result / action |
|---|---|---|
| MakerWorld | Retained draft editor rendered Original, Remix and disabled Share; raw-model formats, landscape/portrait covers, gallery/video controls and the visible JPG/GIF/PNG `<= 30 MB` image rule were re-read | Detailed map remains current. The missing 30 MB per-image preflight is now implemented and tested. Share remains capability-gated because this account cannot select it |
| Printables | Retained editor rendered title, 120-character summary, tags, Original/Remix/Reupload and the AI declaration; retained files include model, G-code, SL1 and ZIP branches | Detailed map remains current. Whitespace handling is corrected and tested so `desk toy` becomes two platform tags rather than `desktoy` |
| Cults3D | Signed-in edit DOM exposed the two upload inputs, three-subcategory rule, AI/comments controls and the current 41-format / 1 GB-per-file file copy; media controls expose image and video branches | No new implementation gap. The input contract, not abbreviated helper prose, remains authoritative for GIF support |
| MyMiniFactory | Current create DOM exposed core upload, Support, Remix, Scan The World and License sections, including the complete heritage metadata branch and the otherwise unexplained `license_store` checkbox | Core and advanced print/remix/license map remains current. Scan The World is documented but intentionally not serialized; `license_store` remains unmapped because the live page provides no semantics beyond its label |
| Nexprint | Retained draft rendered upload, Original/Remix/Share, NSFW, cover, model information and the documented BOM/taxonomy branches | No new implementation gap; the current 30-format matrix, 100-model/100-attachment caps, 20 tags and 100 BOM rows remain mapped |
| Creality Cloud | Signed-in edit entry rendered only the file-gated shell in this no-mutation pass; the reachable stage still establishes title/tags, dual covers and Original/Remix/Non-original | **Partial.** Gallery, license, visibility and print-setting combinations cannot be independently revalidated without selecting a real file and must not be guessed |
| MakerOnline | Retained editor rendered title/category/tags, Public/Private, Original/Remix, AI, permissions, FDM/resin method, 9,000-character description and documentation control | No new implementation gap. Documentation, 3MF profile, paid/kit and eligibility combinations remain separate live-proof branches |
| MakerRoad | Retained editor rendered all six sections: up to 80 model files, 3MF print configuration, 3-10 square images, instruction documents and 60-character title | No new implementation gap; no video control was present and disabled type 3 remains intentionally unavailable |
| Thangs | My Thangs rendered the authenticated Add new entry point; its menu exposes Upload, Create folder and Create collection, while direct `/upload` routes remain invalid | Current `/mythangs` entry mapping is correct. Multipart, version, plans/paid and public branches remain separate account/action proofs |
| Thingiverse | Retained editor exposed files, gallery, category/tags/license, AI/WIP/Remix/NSFW, print settings, custom/education sections; Customizer was disabled without a `.SCAD` file | The SCAD-only Customizer gate is now implemented and tested in UI, renderer preflight and desktop payload validation; unexpressed size/count limits remain UNKNOWN |

This pass confirms that the safe-core mapping is complete for nine platforms at
the currently reachable visual depth. It does **not** turn file-gated,
account-gated, paid, public or destructive branches into certified behavior.
