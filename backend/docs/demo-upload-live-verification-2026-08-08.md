# Demo upload retained-result verification — 2026-08-08

Scope: exact signed packaged app
`desktop/dist/mac-arm64/ModelPrep.app`, bundled demo project, all ten connected
destinations, safest configured state only. The user explicitly authorized this
upload-and-inspect pass. No public action, terms acceptance, deletion, cleanup,
commit, or push occurred.

## Executive result

The batch reported **8 succeeded / 2 failed**, but the demo is not valid
certification content and several success receipts are false positives.

Critical fixture mismatch:

- `desk-dragon-S.stl` and `desk-dragon-M.stl` are 1.46 KB generated cubes, not
  articulated dragons. MakerWorld displays the dragon cover as their file-card
  preview, visually masking the mismatch.
- `desk-dragon-bambu.3mf` is a valid Bambu Studio archive, but its embedded
  `Auxiliaries/.thumbnails/thumbnail_middle.png` depicts an electronics
  enclosure/PCB, not a desk dragon. Its model metadata names `Body1` with 660
  faces. The listing title, prose, tags and synthetic dragon images therefore
  misattribute unrelated geometry.
- The gallery consists of synthetic renders, not actual-print photographs. It
  cannot certify real-photo eligibility or truthful public listing content.

Do not retry or publicly publish this fixture. Replace all model geometry and
the profile with one coherent model matching the images/prose before the next
certification run.

## Exact retained results

| Platform | Result | Live retained/UI verification |
|---|---|---|
| MakerWorld | Private draft `9137596` | Two cube STLs persisted; dragon thumbnails/covers render; 9 gallery images plus both cover crops render; title, tags, CC BY-NC and Private persisted. Category is `Decor`, not the shared `Toys & Games` label. Four print-setting lines still collapse into one paragraph. `Add Print Profile` is shown; no retained profile is visible. |
| Printables | Draft `1803319` | Ten photos are retained; only the two STL cubes appear under Model Files; 3MF is absent. Title, summary, Action Figures & Statues, Original, No AI and CC BY-NC persist. Hyphenated tags still become `printinplace`, `desktoy`, `nosupports`; headings flatten and the four settings collapse. |
| Cults3D | Failed before creation | First S3 upload failed: `Failed to fetch (POST 3,321 bytes)` to `https://s3.eu-west-3.amazonaws.com/files.cults3d.com`. No result id was returned and no retry was attempted. |
| MyMiniFactory | Private object `831729` | Exact-app submit/readback succeeded, but normal Chrome is signed out and the private object redirects to Login, so rendered UI could not be independently inspected. Treat visual parity as blocked, not certified. |
| Thingiverse | Draft `7393142` | All three files persist in order. Ten uploaded images render in order plus one platform-generated `desk-dragon-M.png` preview. Full summary + Markdown description now persists; category Toys & Games / Construction Toys / Mechanical Toys, eight tags, flags off and CC BY-NC persist. Structured Print Settings remains empty. |
| Thangs | Private model `1586227` | Correct title, Markdown, categories, eight tags, ten actual Images, Private sharing and CC BY-NC persist. Attachments show only `desk-dragon-M.stl` and the 3MF; the primary S STL is not visibly associated, overall size remains `-`, and the model/file association is still broken. Receipt URL was malformed as `/designer/model/1586227`; the real preview route is `/designer/iamdjem/3d-model/1586227`. |
| Nexprint | Draft `2086034539440377856` | Cover and nine gallery images render in order. Only the two STL cubes persist; 3MF/profile is absent. Title, Original, category Toys & Games / Others, description, eight tags, BOM and CC BY-NC persist. Four print-setting lines still collapse. |
| Creality Cloud | Private model `6a7702b70389871f0cd0351b` | Ten images render, title, Toys & Games / Other, full description, eight normalized tags and CC BY-NC persist. The page shows `Add Print Configuration`; the 3MF profile is absent. Only the two STL path remains. |
| MakerOnline | Draft `317457` | Ten images, title, Toys&Games / Characters, eight tags, Private, Both, No AI, CC BY-NC and the description persist. The four print-setting lines now render separately. Step 2 explicitly selects `I don't have Print Profile Files` and contains only the two STL cubes; the 3MF/profile is absent. |
| MakerRoad | Save created an uncertified state | ModelPrep failed closed on readback `status=1`. Normal Chrome is signed out, so the new item cannot be independently located/rendered in this pass. Given the seven earlier rejected saves, do not call this a private draft or success. No retry occurred. |

## Cross-platform conclusions

1. **File/profile routing remains broken.** The same 3MF is absent on
   MakerWorld, Printables, Nexprint, Creality and MakerOnline. Thangs retains it
   only as an attachment. Thingiverse alone retains it as an ordinary file.
2. **Images now transport successfully on the inspectable results.** MakerWorld,
   Thingiverse, Thangs, Nexprint, Creality and MakerOnline visibly render the
   new gallery assets. Printables retains ten photo slots. MMF visual proof is
   blocked by the separate browser session.
3. **Description fixes are inconsistent.** MakerOnline and Creality preserve the
   four setting lines; MakerWorld, Printables and Nexprint still collapse them.
   Thingiverse and Thangs retain Markdown correctly.
4. **Receipts overclaim.** MakerWorld, Printables, Thangs, Nexprint, Creality and
   MakerOnline reported success despite missing/misclassified 3MF or file
   association, wrong category/formatting, or malformed URLs.
5. **The fixture itself invalidates semantic certification.** Transporting real
   bytes is insufficient when the bytes depict cubes/electronics while all
   listing metadata and images claim an articulated dragon.

## Required next slice before another upload

- Replace the two generated cubes and unrelated 3MF with one coherent,
  redistributable desk-dragon model/profile; validate embedded thumbnails and
  geometry identity before packaging.
- Make readback fail closed on exact file names/roles/counts, image order,
  title/category/tags/licence/visibility and normalized description.
- Fix platform-specific 3MF routing, Thangs association/URL, remaining line
  collapse, Printables tag normalization, MakerWorld category, and Cults S3
  transport.
- Only after local tests pass, request a new explicit private/draft upload run.
  Do not reuse or retry the retained objects above as certification proof.

## Implementation update — 2026-08-08

The invalid dragon fixture has now been replaced locally; this does **not**
retroactively certify any retained object above and no second live upload has
been performed.

- The new fixture is **ModelPrep Calibration Puck — Upload Test Fixture**.
- Its two watertight binary STLs are generated from the same source geometry:
  22 × 3.2 mm and 34 × 4.4 mm circular pucks with a 0.8 mm top chamfer.
- `modelprep-calibration-puck-bambu.3mf` was generated by Bambu Studio 2.7 from
  the 34 mm STL. Its `Metadata/model_settings.config` names that exact STL and
  reports 1,080 faces. It is a genuine but unsliced Bambu project: the embedded
  printer model and G-code reference are empty and `slice_info.config` has no
  plate. It is truthful as an ordinary 3MF, not as a print profile. The old
  PCB/enclosure archive is removed.
- Ten replacement WebP assets are model-derived diagrams/renders. They disclose
  that they are synthetic and do not claim to be physical-print photos.
- `realPhotoConfirmed` is false. MakerWorld's physical-photo-only profile branch
  therefore fails closed until a user supplies and confirms a real photo.
- Known test-model categories are now selected for Nexprint (`1422473859022859`),
  Creality (`1645`), MakerOnline (`36`), MakerRoad (`Professional Fields › Test
  Models`), and Thangs (`3D Printer Parts & Accessories/Test Prints &
  Calibration`).
- Thangs receipts now resolve the authenticated username and use the real
  `/designer/<username>/3d-model/<id>` route.
- New fixture tests verify truthful copy, files, photo declaration, categories,
  Bambu project identity and removal of dragon/PCB/enclosure claims.

Local evidence at this checkpoint (historical; the current baseline is
371/207/31 in `platform-current-state-2026-08-08.md`): renderer suite
**361/361 passed**, desktop suite **205/205 passed**, backend suite
**31/31 passed**, backend TypeScript
passed, and the production renderer built. `desktop/dist/mac-arm64/ModelPrep.app`
was rebuilt and signed as `io.makerstats.modelprep` by Developer ID team
`UTZ4TVACJS`; `codesign --verify --deep --strict` passed. Electron Builder skipped
notarization because `APPLE_TEAM_ID` was not present, so this is signed local QA
evidence, not notarization/release evidence.

The exact package was launched normally. Its Files UI showed two model files with
round-puck thumbnails and one 30.1 KB Bambu Studio print profile; its status bar
showed 3 files, 10 media assets and 10/10 platforms. Details showed the calibration
title, truthful prose, Tools, and CC BY-NC. Images showed ten coherent puck assets
including the synthetic-fixture disclosure. Nothing was uploaded. The app was
quit normally and no ModelPrep process/helper or QA LaunchAgent remained.

A new private one-platform-at-a-time live certification run remained outstanding
at that checkpoint. The user subsequently authorized the pairwise run documented
below.

## Pairwise calibration-puck certification run — 2026-08-08

The exact rebuilt and signed app submitted the coherent calibration-puck fixture
to every ready destination in one four-slot batch. All destinations remained at
their safest configured visibility. MakerWorld was truthfully skipped because
the fixture has no physical-print photograph. The batch finished **7 succeeded /
2 failed**, with MakerWorld separately blocked before upload. No failed upload
was retried and no retained object was published or deleted.

The fixture intentionally covers representative combinations instead of every
possible option: original and non-AI, CC BY-NC, private/draft/secret visibility,
two STL model files, one Bambu Studio 3MF profile, ten ordered synthetic images,
rich description, tags/category, FDM/support-free print settings, and one
Nexprint BOM row. Paid, remix, public, AI-assisted, NSFW, terms-gated and
physical-photo-only branches remain out of scope because they would be false or
require separate authorization.

### New retained results

| Platform | Result | Retained UI/DOM evidence |
|---|---|---|
| MakerWorld | Blocked before upload | Correct fail-closed result: `realPhotoConfirmed=false` does not satisfy MakerWorld's physical-print-photo requirement. No object was created. |
| Printables | Draft `1803506` | All ten ordered images render; title, summary, six tags, Original, No AI, description and CC BY-NC persist. Both STLs appear under Model Files. **The 3MF is absent** and the category is wrongly `Action Figures & Statues`. |
| Cults3D | Failed before creation | First S3 transfer failed: `Failed to fetch (POST 37,929 bytes)` to `https://s3.eu-west-3.amazonaws.com/files.cults3d.com`. No result id; no retry. |
| MyMiniFactory | Private object `831756` | Exact-app submit/readback reported the private object saved and read back. Normal Chrome redirects the private result to Login, so independent rendered image/file/profile verification is blocked. |
| Thingiverse | Draft `7393174` | All three source files persist in order: both STLs and the Bambu 3MF. The editor contains all ten uploaded images plus two platform-generated STL previews; the first upload is the cover. Full Markdown description, tags, CC BY-NC, Original/No AI and structured printer/material/raft/support/layer/infill/notes fields persist. Several fresh resize-service thumbnail URLs still returned zero-sized images after a recheck, although their underlying uploads and both generated STL preview images exist. Category mapping remains suspicious because the editor exposes Toys & Games subcategories for this calibration fixture. |
| Thangs | Private model `1586259` | Exact-app receipt used the corrected `/designer/iamdjem/3d-model/1586259` route and reported full readback. Opening that private route in normal Chrome produced Thangs' not-found page, so independent rendered file/image/profile parity is not certified in that browser session. |
| Nexprint | Draft `2086068343743848448` | Cover plus nine gallery images all render; title, Original, `3D Printer / Testing Models`, rich description, six tags, PLA BOM row and CC BY-NC persist. Only the two STLs appear. **The 3MF/profile is absent.** |
| Creality Cloud | Private model `6a77222f75286de2e7e68468` | Ten images render at non-zero dimensions; title, `3D Printers / Test Models`, structured description, six normalized tags and CC BY-NC persist. `View STL/CAD Files` contains exactly the two STLs. **The 3MF is absent and the listing offers `Add Print Configuration`.** |
| MakerOnline | Draft `317477` | Ten images render; title, `3D Printer / Test Models`, six tags, Private, FDM, Original, No AI, CC BY-NC and rich description persist. File step contains exactly the two STLs and explicitly selects **`I don't have Print Profile Files`**. The supplied 3MF/profile is absent. |
| MakerRoad | Uncertified save | Adapter failed closed on retained `status=1`; no result id/URL was exposed. Do not classify it as a draft or success and do not retry without diagnosing the review rejection. |

### Certification conclusion and next implementation slice

The coherent fixture proves that title/description/image/license/tag transport is
working on the four independently inspectable retained pages, and Thingiverse
proves the source 3MF itself is valid and uploadable. It also turns the previous
theoretical 3MF concern into a reproducible cross-platform defect: Printables,
Nexprint, Creality and MakerOnline all drop or misclassify the same profile.

The next code slice must therefore be platform-specific profile routing and
readback, not another broad upload:

1. Route the Bambu 3MF into each platform's actual profile/print-configuration
   surface where supported; otherwise retain it truthfully as a model/attachment
   and say so in preflight.
2. Make success readback fail closed on expected source-file names, roles and
   counts, including an explicit expected-versus-retained profile assertion.
3. Correct Printables' calibration/test-model category and verify Thingiverse's
   selected category path, rather than accepting a generic fallback.
4. Diagnose Thingiverse's resize-thumbnail failures separately from source-image
   persistence.
5. Reopen MMF and Thangs through their isolated authenticated sessions for
   rendered proof; repair Cults S3 transport and MakerRoad `status=1` before any
   retry. MakerWorld remains blocked until a real physical print photo exists.

## Cults3D and MakerRoad failure repair — 2026-08-08

The user authorized test-mode synthetic imagery and one-platform repair checks.
No successful destination from the earlier batch was rerun.

- **Cults3D storage transport is repaired and live-proven.** Signed S3 POSTs now
  use Electron's partition network session instead of page JavaScript, avoiding
  cross-origin CORS masking while Cults/Cloudflare requests stay in the
  authenticated page. First-party calls are serialized and paced, and edit
  readback has a bounded post-create retry window. Secret creation
  `modelprep-calibration-puck-upload-test-fixture-b01addf327b6843d212e`
  retained both STLs, the Bambu 3MF, ten ordered media IDs/files, title,
  Markdown description, manufacturing details, Tool category, tags,
  `functional_part`/`no_support`, AI false and comments enabled. The immediate
  automatic edit readback hit HTTP 404 while Cloudflare rechecked the hidden
  session; the same retained editor became available after the challenge
  cleared and was inspected read-only. Several new CDN thumbnails were still
  processing, but the underlying media records and filenames persisted. Do not
  retry this creation.
- **MakerRoad transport works; review is the blocker.** The demo-only path now
  permits disclosed synthetic imagery as a warning, while normal projects still
  require a confirmed real-print photo. One corrected demo save uploaded all
  roles and again returned retained `status=1`, matching the platform's prior
  “cover is not a real photo” rejections. ModelPrep continues to classify this
  as uncertified, but now preserves the retained edit URL in error receipts so
  visual transport can be inspected without calling review rejection an upload
  transport failure. No second retry was made.

### Final verification after the repair

- Deploy/renderer tests: **364/364 passed** (historical checkpoint; the
  current baseline is 371/371).
- Desktop tests: **207/207 passed**.
- The production package was rebuilt after the retained-URL change.
- `codesign --verify --deep --strict --verbose=2` reports the exact
  `desktop/dist/mac-arm64/ModelPrep.app` valid on disk and satisfying its
  designated requirement.
- `git diff --check` passed.
- No additional upload was made during final package verification. No
  ModelPrep process/helper or temporary ModelPrep LaunchAgent remained.
- Notarization remains outside this evidence: the build was Developer-ID signed
  for QA, but `APPLE_TEAM_ID` was unavailable to Electron Builder.

## Correction — the "3MF routing defect" was a selection default

Later on 2026-08-08 the cross-platform conclusion above ("File/profile routing
remains broken") was traced and found to be wrong. It is retained here because
the retained-result observations are accurate; only the diagnosis was not.

ModelPrep's own automatic per-platform file selection
(`deploy/src/lib/platform-files.js`) unticks a print profile sliced by a vendor
whose slicer is not that platform's native one. The fixture profile is Bambu
Studio, so it was never uploaded to Printables (Prusa), Nexprint (Elegoo),
Creality Cloud (Creality Print), MakerOnline (Anycubic) or MakerRoad (Elegoo),
and was uploaded everywhere else. Verified in a real renderer against the real
fixture; the resulting partition matches every row of the tables above exactly,
including MakerOnline's retained "I don't have Print Profile Files" and
Creality's "Add Print Configuration".

Two claims above must therefore be read as corrected:

- "The same 3MF is absent on MakerWorld, Printables, Nexprint, Creality and
  MakerOnline" — the file was not sent, not mis-routed. MakerWorld does receive
  it; that row was blocked before upload for the separate real-photo reason.
- "Thingiverse alone retains it as an ordinary file" — Thingiverse is one of
  five platforms that received it. Printables would also file it as an ordinary
  model file: live public readback of model `1472993` returns a `.3mf` inside
  the `stls` bucket, and Printables has no print-profile surface at all.

Printables now sends the profile, warns by filename when any profile is not
being sent, and fails closed on the selected source files rather than on a
payload derived from the platform's own processing response. Nexprint, Creality
Cloud, MakerOnline and MakerRoad are unchanged and still omit it.

One authorized unpublished draft, **`1803724`**, confirms the Printables fix on
the platform: `stls` holds `…-S.stl`, `…-M.stl` and `…-bambu.3mf` in order,
category is `12` Test Models, licence CC BY-NC, authorship `author`, AI/NSFW/
political false, `datePublished` null, and all ten gallery assets fetch at
HTTP 200 with 22–43 KB each in upload order. Only Printables was enabled for
that run. Nothing was published, retried or deleted, and every earlier retained
object — including draft `1803506`, kept as the before-state — is untouched.

For the reconciled platform-by-platform status and next work order, use
`platform-current-state-2026-08-08.md`.
