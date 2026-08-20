# ModelPrep current implementation handoff

> **CURRENT PICKUP POINT — 2026-08-09:** Start with
> `platform-current-state-2026-08-08.md`. It reconciles the completed ten-platform
> exploration, the coherent calibration-puck upload run, the Cults3D/MakerRoad
> repairs, exact retained evidence, current test/package baseline and remaining
> work. The detailed historical sections below remain useful for architecture
> and platform-specific context, but any older claim that all ten safe-core paths
> are certified or that the dragon fixture is current is superseded.

> **HISTORICAL MATERIAL BELOW (updated 2026-08-08).** Live real-browser verification found this file's
> status and retained-evidence claims outdated: MMF objects 828462/829039/
> 829043/829056 are deleted, Printables public model 1797774 is gone, all seven
> MakerRoad "private" saves were review-REJECTED (never validly certified), a
> Nexprint model went PUBLIC (G9526987), and a 2026-08-07 run added
> undocumented items on six platforms. Read
> `live-ui-verification-2026-08-07.md` (findings, same-day fixes, and the
> 2026-08-08 MakerWorld upload-flow follow-up) and
> `platform-audit-2026-08-07.md` before trusting anything below.

Current status ledger as of: **2026-08-08**
Repository: `/Users/alex/modelprep`
Canonical packaged app: `/Users/alex/modelprep/desktop/dist/mac-arm64/ModelPrep.app`
Last runtime marker verified: **BUILD 570A8DD - AUG 4, 11:06 AM**

## 2026-08-09 MakerOnline override

This section supersedes older MakerOnline and Creality continuation statements
below. Printables, Nexprint and settled Creality safe-core file retention are
certified at the boundaries recorded in `platform-current-state-2026-08-08.md`.
The active platform is MakerOnline.

**Later 2026-08-09 result:** the explicitly authorized exact-package attempt
uploaded the safe fixture assets but stopped before `save-draft`. MakerOnline's
`parse-info` response omitted printers, nozzle, layer, plates and parseType for
the Bambu 3MF, and the pre-save gate correctly created no object. It was not
retried. `App.jsx`'s missing `buildMakerOnlineExpectation` import and the demo's
automatic exclusion of the Bambu 3MF were fixed first; focused renderer tests,
desktop MakerOnline tests, production build/package and strict codesign passed.

Same-day read-only browser follow-up: Thingiverse draft `7393174` still had the
wrong `Toys & Games / Mechanical Toys` category; `3D Printing / 3D Printing
Tests` was selected locally but not saved pending final browser confirmation.
Exactly one of its 12 gallery thumbnails remained 0x0 (the second uploaded
image); the original retained asset and the other 11 thumbnails rendered.
Cults secret design `4759509` is now rendered-certified on its detail page with
ten images, three files, metadata and secret/free state. Normal Chrome still
redirects MMF `831756` to login and shows not-found for Thangs `1586259`.
The rebuilt exact package subsequently re-read MMF `831756` through its isolated
owner session: private, ten position-ordered images with the expected cover,
three files and categories `60/462`. This is retained/API evidence in ModelPrep,
not native MMF DOM. The corresponding Thangs read-only recheck ended once with
`net::ERR_CONNECTION_CLOSED`; it was not retried and changed nothing.

MakerOnline's read-only contract is mapped as a fourth distinct 3MF shape: a
`.3mf` can be an ordinary raw model and the platform also exposes a separate
server-parsed print-profile branch. Local archive inspection now proves the
calibration fixture's Bambu 3MF is unsliced: its printer model and G-code
reference are empty and slice-info has no plate. ModelPrep no longer fabricates
demo parser values and keeps this file raw-only. Simultaneous retention needs a
genuinely sliced truthful 3MF and remains unproved.

Implemented and package-verified:

- `deploy/src/lib/makeronline-verify.js` builds expectations from native upload
  records and checks ordered raw files/images, exact native bytes and keys,
  positive or authoritative-exact geometry, profile identity, structural parser
  output, profile media, metadata, flags and live-confirmed draft status `3`;
- `desktop/makeronline-direct.js` separates native filename/size from local
  convenience fallbacks so missing transport evidence cannot certify itself;
- incomplete `parse-info` output stops before `save-draft`;
- the save happens exactly once, retained id/state/URL are captured immediately,
  and bounded polling rechecks only that id;
- focused and full evidence is deploy `452/452`, desktop `208/208`, backend
  `31/31`, TypeScript/build/package/codesign/diff checks clean.

No new MakerOnline object was created. The next smallest action first requires
a genuinely sliced compatible 3MF and then the user's action-time authorization
for one private MakerOnline-only `save-draft` through the exact signed package,
with no retry. Verify the same 3MF in both `files` and `print_files`, parser
values, images/cover, description, category, tags, licence, permission, source,
print method, flags and draft state. Rendered UI/DOM is a separate evidence
level.

Final exact-package UI QA also caught and fixed a shared presentation/state
leak: the unsliced 3MF was still grouped and counted as a print profile after
the MakerOnline toggle was disabled. Scanned unsliced 3MFs now move into Model
files, their auto-generated profile records are removed, and the packaged
Publish summary shows three files and zero print profiles.

## 2026-08-08 continuation override

The newest read-only, signed-in upload-flow audit started with MakerWorld. Use
this section ahead of the older implementation ledger below.

> **Newest live result:** `demo-upload-live-verification-2026-08-08.md` records
> an authorized exact-package upload to all ten targets and retained UI checks.
> Eight adapters reported success, but multiple receipts are false positives and
> the fixture itself is invalid: both named dragon STLs are cubes and the Bambu
> 3MF depicts an electronics enclosure. Do not retry or publicly publish it.

- Regular MakerWorld 3D is substantially mapped. Its live 70-leaf category
  picker exactly matches `deploy/src/data/makerworld-categories.json`; raw-file
  controls, dual covers, video, 16-picture gallery, remix/linking, license,
  visibility, rich description, docs, BOM, Exclusive, and 3MF profile state are
  present. The August 7 line-break and picture-shape fixes still require one
  authorized private upload/readback before certification.
- MakerWorld Laser & Cut and CyberBrick are **not fully mapped**. Current gaps:
  LAC profile visibility is serialized inside `instance` instead of sibling
  `instanceSetting`; Laser video is disabled; Laser BOM/steps/community post are
  hardcoded empty/off; CyberBrick omits framework, firmware, creation protection,
  controller cover and switch covers; LAC picture item shape and profile
  description are unproven; A1 compatibility is `N2S` in code versus `N2` in
  the flow doc; and the platform card still displays an invented 250 MB total.
- Do not run a LAC certification upload yet. First correct and locally test the
  serializer/UI gaps, then capture the first-party LAC step-3 request. A later
  private 3MF/LAC transmission still needs action-time authorization.
- The platform-by-platform continuation order requested on 2026-08-08 is:
  MakerWorld audit/documentation (done), Printables upload-flow audit (done),
  then the remaining popular platforms one at a time.
- Printables safe core is substantially mapped for a free original listing, and
  its live accepted file list matches ModelPrep. It is **not fully mapped for
  G-code**: the live editor requires one main 3D printer, ModelPrep has no such
  picker/payload, and retained draft `1797772` again hides the API-retained
  G-code while showing only its SL1 print file. Per-G-code material is also not
  selectable. Rich images/tables/video embeds and Store/Club remain uncertified;
  the audited account exposes no paid controls. Do not treat the UI's “typically
  $5–$150” price hint as a verified contract.
- The next smallest implementation slice for Printables is a server-driven main
  printer picker plus model-level `printer` serialization/readback, followed by
  optional per-G-code material. That work should be locally tested before asking
  for an authorized draft upload. The next platform audit should continue only
  after preserving this boundary.
- Thingiverse upload-flow audit is now complete. All 80 current category labels
  and 13 licences match the snapshots, and the ordinary unpublished safe core
  remains the strongest branch. Do **not** rely on the older “no safe-core gap”
  or “complete readback” wording for optional parity.
- Current Thingiverse gaps: the general platform link uses `/create` (another
  user's profile) instead of `/thing:0/edit`; the UI exposes only four of the
  structured print-setting fields; rich and Education sections are raw JSON
  without image/video/asset upload; Handouts & Assets has no explicit default
  mapping; 68 live design tools and account groups are not exposed or sent; and
  readback checks existence rather than field/order equality.
- The Thingiverse body fix (summary plus full Markdown description) passes all
  eight direct-adapter tests but has not been uploaded after the fix. Retained
  draft `7390480` still demonstrates the old one-line body. Correct the entry
  link, complete print-setting UI/payload mapping, and implement fail-closed
  readback comparisons before requesting a new authorized draft verification.
- Cults3D upload-flow audit is now complete read-only. The live create form and
  retained edit still support the documented safe core, but ModelPrep hardcodes
  only 3D-printing usage, sends no subcategory, and offers no exact Cults
  category/licence picker. Its price UI is free/fixed USD only; the live CZK
  editor also exposes open price (0–26,000 CZK), fixed price (14–26,000 CZK),
  currency-specific bounds, and discounts. Current receipt verification compares
  only title, visibility, and ordered file/media IDs/names—not the rest of the
  metadata, taxonomy, AI/comments, price/currency, or licence.
- Do not call Cults fully mapped or fully read back. The next safe code slice is
  exact category/subcategory/usage controls, currency-aware fixed/open pricing,
  and complete metadata/price readback. No Cults mutation was authorized. The
  next platform in the popular-platform queue is **MyMiniFactory**.
- MyMiniFactory continuation audit is complete at a mixed evidence boundary:
  normal Chrome was signed out, while the ModelPrep-managed account still
  reported connected as `iamdjem`. The historical private free-account core and
  advanced metadata readback remain strong, but the current first-party creator
  guides invalidate the older “comprehensively mapped” claim.
- Missing MyMiniFactory branches: Premium **Sell STL Files** (price, purchase
  message, post-purchase message), capability-driven 500 MB Premium file limits,
  and Archive Mode (25 archives around 5 GB; no 3D viewer). ModelPrep hardcodes
  100 MiB, always sends `fileMode=0`, and has no store/archive payload or
  readback. Remix parents are raw IDs without native-style lookup validation;
  category-at-create remains undocumented platform behavior.
- No MyMiniFactory mutation was authorized. Before another certification upload,
  implement capability discovery, premium/store/archive branches, and matching
  readback. Public submit remains review acceptance rather than proof of a live
  listing. The next popular-platform audit is **Thangs**.
- Thangs continuation audit is complete signed-in/read-only. The live editor has
  six audience modes, four print-compatibility flags, video embeds, distinct
  inspiration/remix attribution, and dynamic licences.
- Units, bulk/multipart/assembly, access type, plans, dependencies, version notes
  and feedback are phantom ModelPrep UI: the adapter drops them. Save creates one
  draft; it does not implement separate bulk models, assembly, or versions.
- Retained `1585793` still has empty Images, ten JPG Attachments and size `-`;
  corrected local v4 association is not live-certified. Verification checks
  response presence rather than submitted/persisted equality.
- Do not call Thangs fully mapped, fully read back, or corrected-v4 certified.
  No mutation occurred. The next popular-platform audit is **MakerOnline**.
- MakerOnline continuation audit is complete signed-in/read-only. The current
  create form still matches the documented ordinary and conditional Step 1
  controls; the account is Exclusive-ineligible and China sync is unavailable.
  Its Draft tab contains eight retained drafts. Draft `316221` shows 20 images,
  three raw files including the 3MF, expected metadata/category/licence, and zero
  Print Profile Files.
- MakerOnline is not completely mapped or verified: inline Quill description
  images are not authorable in ModelPrep, while receipt logic accepts absent
  fields and checks only title/category plus minimum image/raw-file counts. It
  does not certify exact order/names or the rest of the metadata, optional docs,
  profiles, kits, sync, or Exclusive branches. Exclusive should also be gated on
  its actual-print-photo and applicable assembly-instruction requirements.
- No MakerOnline mutation occurred. Do not call optional branches certified and
  do not remove any of the eight retained drafts. The next popular-platform
  audit is **Nexprint**.
- Nexprint continuation audit is complete signed-in/read-only. Single/Batch and
  the 30 unique raw formats remain current. Draft `2083625532272496640` retains
  the core assets/metadata, but its 3MF has no visible profile section and the
  adapter always sends `settingList: []`. Current attachment help omits `.gcode`
  and `.goo` although ModelPrep accepts both; treat them as drift-risk. The rich
  editor also has asset/media/table controls ModelPrep cannot author. Receipt
  logic verifies only object presence and optional status—not persisted fields.
- Creality Cloud continuation audit is complete signed-in/read-only. Its full
  file-gated form confirms the raw/core fields plus structured Remix/
  Non-original, instruction files, Boost Me, and the separate parsed-3MF Print
  Settings media/description/printer branch. ModelPrep sends only Original core
  metadata/assets/instructions; retained evidence shows its 3MF was dropped.
  Receipt logic checks only an optional subset and is not fail-closed.
- MakerRoad continuation is complete at a mixed boundary: normal Chrome is
  signed out, so current authenticated UI could not be refreshed. The August 7
  live evidence still controls: all seven saves are rejected. The print-method
  resolver and rejection checks are local-only and need a newly authorized save;
  exact metadata/options remain outside readback. “Save private draft” is still
  misleading because MakerRoad sends saved items through review.
- No platform mutation occurred in these three passes. The requested ten-platform
  upload-flow continuation audit is now complete, with the gaps above remaining
  implementation and separately authorized live-certification work.

This is the canonical pickup point for the next agent. When another document
disagrees with this file, use this file for current status and use the
platform-specific flow map for low-level request details. The July 31 handoff is
historical context, not the current continuation queue.

## First five minutes

1. Run `git status --short` before editing. The worktree is deliberately very
   dirty and contains the user's current implementation. Do not reset, clean,
   restore, broadly stage, commit, push, deploy, publish, or delete unless the
   user explicitly asks.
2. Read this file, then `platform-live-certification-audit-2026-08-01.md`,
   `platform-upload-requirements-live.md`, `platform-specs.md`, and the relevant
   `*-web-flow.md` document. Before implementing another optional branch, also
   read `platform-one-by-one-implementation-playbook.md`.
3. Treat a green account badge as authenticated identity evidence only. It does
   not prove upload mutation or optional-branch parity.
4. Do not create a real listing merely to check whether code is wired. Real
   account mutation requires a specific safe target and action-time authority.
5. For packaged QA, run the exact local bundle normally. Never create a
   `launchctl submit` keepalive job; it can respawn and steal mouse/keyboard focus.

The ready-to-paste continuation prompt is also available as
`backend/docs/NEXT_AGENT_PROMPT.md`.

## What ModelPrep is

ModelPrep is a desktop-first multi-platform publishing tool for 3D-printing
creators. A creator imports model files, images, videos, print profiles, and
documentation once; enters shared title, description, tags, category, license,
and print information once; reviews per-platform adaptations; then publishes to
selected platforms with isolated receipts and failures.

The current product flow is:

1. Files
2. Details
3. Images and compatible videos
4. Print profiles
5. Platforms and platform-specific options
6. Preflight and Publish

Shared metadata propagates into every selected platform package. Platform
adapters then transform description format, taxonomy, license, visibility,
media roles, cover behavior, file roles, and optional fields without changing
the shared project source.

## Current architecture

There are four repo areas with distinct responsibilities:

- `deploy/`: React/Vite renderer. Owns project state, field propagation,
  platform options, preflight, batch orchestration, receipts, Settings, account
  markers, and Demo/Real Upload Test UX.
- `desktop/`: Electron shell. Owns isolated persistent browser partitions,
  encrypted recovery state, interactive reconnect windows, allow-listed virtual
  routes, direct platform requests, signed-storage uploads, and packaged builds.
- `backend/`: Cloudflare Worker and shared adapters. It remains a hosted-web
  fallback and contains shared MakerWorld/Printables/Cults logic and validation.
  The ten packaged desktop flows resolve locally and do not send platform
  credentials through the Worker.
- `cdn/`: legacy/fallback staged-file delivery used by older Worker paths. Direct
  Electron publishers normally upload to each platform's first-party storage.

Packaged builds ship the matching renderer inside the `.app`. This prevents a
new hosted renderer from running against an old preload/IPC bridge. Unpackaged
development can point at a local or hosted renderer through `MODELPREP_URL`.

The renderer uses Worker-shaped virtual routes such as
`/api/v1/<platform>/web/*`. Electron validates the exact prefix and dispatches
the request to the corresponding main-process adapter. Raw cookies, passwords,
bearer tokens, CSRF values, and signed-storage credentials stay in Electron.
The renderer receives only an opaque account marker and a safe identity label.

## Authentication and recovery contract

All ten platforms have direct account wiring and currently show connected in
the verified packaged runtime. Each platform has its own persistent partition;
Electron `safeStorage` holds encrypted recovery state. Settings, Platforms, and
Publish share the same status and Reconnect action.

Reconnect behavior is deliberately low-friction:

1. validate the cached main-process context;
2. validate encrypted recovery state;
3. warm a read-only first-party page when sliding cookies/local storage may need
   rotation;
4. open the isolated interactive sign-in window only if silent recovery fails.

Chrome sign-in is separate from ModelPrep's partitions. A platform can expire or
revoke its own session; ModelPrep must then show `Reconnect needed` rather than a
false green state.

Important platform-specific auth details:

- MakerWorld: cookie/refresh-token session; direct email-code fallback preserves
  `tfaKey`; CAPTCHA falls back to the platform window.
- Printables: Prusa OAuth/PKCE session and read-only GraphQL identity query.
- Cults3D: per-account persistent Chromium session; direct Rails/S3 flow through
  that partition so Cloudflare clearance and cookies stay browser-bound.
- Nexprint: encrypted token/cookie state.
- Creality Cloud: token, user id, device id, cookies, and short-lived Aliyun STS.
- MakerOnline: raw decoded `mo_access_token` plus cookies; no `Bearer` prefix.
- MyMiniFactory: passwordless email + confirmation code; Chromium-partition
  cookies and user agent are required because standalone Node networking gets
  Cloudflare 403 responses.
- MakerRoad: authenticated `X-Token` cookie mirrored into the `X-Token` header.
- Thangs: access token lives in origin local storage, refresh state in cookies;
  Electron encrypts the token and validates `GET
  https://production-api.thangs.com/users/current?likes=false`.
- Thingiverse: isolated web/API session; production mutation enabled after
  written clearance recorded on 2026-08-01.

## Status vocabulary

- **Mapped:** DOM, bundle, taxonomy, and request contract documented.
- **Implemented:** production-shaped adapter, renderer flow, and tests exist.
- **Locally verified:** automated/request-shape/rendered checks pass.
- **Connected:** packaged Electron identity verification currently passes.
- **Browser contract proven:** first-party browser accepted a safe mutation, but
  ModelPrep's isolated path is not yet certified.
- **Live-certified:** ModelPrep or the explicitly mapped safe flow created an
  account-backed non-public artifact and important persisted fields were read
  back.
- **Fully certified:** every supported optional/public/paid branch has live
  evidence. No platform is fully certified.

## Ten-platform implementation ledger

| Platform | Implemented core | Current evidence | Still open |
|---|---|---|---|
| MakerWorld | Regular 3D, raw files, Bambu 3MF profiles, covers/gallery/video transport, documentation/BOM, private/public, remix, Laser and Cut, readback | Connected; latest exact-app private receipt `9053658`; core four-way batch path live-certified | Live-certify video, genuine LAC final submit, public, CyberBrick/exclusive and optional matrices |
| Printables | Draft/publish GraphQL flow, signed storage, original/remix, files/folders/notes, ordered media, native HEIC/HEIF selection and JPEG conversion, G-code/SLA/retained-ZIP handling, taxonomy/license and fail-closed readback | Connected; specialist draft `1797772` and public model `1797774` were created from the exact packaged app and read back | Delete public model only after confirmation; Store/Club eligible account, approval-gated account, remix/reupload, unpacked ZIP and rich-description upload round trips |
| Cults3D | Rails/S3 two-page flow, Markdown, typed image/video media, files, taxonomy/subcategory, tags/meta-tags, license, price, secret/public, readback | Historical exact-app secret listing slug ends `6f02ba1cd366b9cb06a5`; current Chromium-session auth change is locally verified and awaits interactive packaged reconnect | Reconnect/read-only packaged verification; paid/open-price, public, optional subcategories/usages and live video branch |
| MyMiniFactory | Passwordless session, Chromium fetch, images, presigned objects, hierarchical categories, license/declarations, print details, private/public, readback | Connected; latest exact-app private object `829056` passed app readback plus independent hydrated-editor verification. Current advanced-field readback hardening is locally verified | Public review branch and other optional paths; retain safe HTTP failure diagnostics |
| Nexprint | REST/presign/register/create-or-update/readback, cover + gallery, model/BOM/attachments, taxonomy, license, draft/public | Connected; latest exact-app unpublished draft `2083625532272496640`; core path live-certified | Public, broader attachment/extension/activity eligibility combinations |
| Creality Cloud | Aliyun upload, web/app covers, private/public create, existing-draft edit, taxonomy/license/print info, readback | Connected; latest exact-app private model `6a6e3f28753b84f6aab190a8`; Original/private core live-certified | Existing-draft edit, public, non-original attribution and account-gated branches |
| MakerOnline | Multipart roles for images/raw models/3MF profiles/docs, draft/public, live taxonomy, license/kits, readback | Connected; latest exact-app unpublished draft `316221`; core path live-certified | 3MF profile, docs, remix, public, paid, Creative Kit, China sync, resin, large-file and eligibility branches |
| MakerRoad | Isolated session, authenticated identity, dynamic taxonomy, model/profile/image/instruction roles, Original/Remix, private Save/review Publish, readback | Connected; latest exact-app private draft `M2134222528` saved and read back; service and corrected `uploadType=1` route are live-proven | Public, paid, remix, schedule and optional branches; current first-party form has no video input or serializer, so video remains unsupported |
| Thangs | Encrypted token recovery, private/public, model/reference/image/license/standalone roles, signed PUT, validation, single/bulk/multipart/assembly, resumable private drafts, assets and three-part readback | Connected as `iamdjem`; latest exact-app private model `1583272` saved and fully read back | Multipart, version, plans, paid, public and other optional branches |
| Thingiverse | Draft-first upload/create/finalize/publish, ordered files/media, taxonomy, license, optional metadata and readback | Connected as `iamdjem`; latest exact-app unpublished draft `7390480`; core draft path live-certified | Public publication and optional rich-section/education/remix branches |

## Retained live evidence

Do not delete these without explicit authority. They are useful readback fixtures:

The latest four-at-a-time closeout batch retained these ten safe-default results:

- MakerWorld private receipt `9053658`.
- Printables unpublished draft `1797292`.
- Cults3D secret listing
  `articulating-desk-dragon-print-in-place-6f02ba1cd366b9cb06a5`.
- MyMiniFactory private object `829056`.
- Thingiverse unpublished draft `7390480`.
- Thangs private model `1583272`.
- Nexprint unpublished draft `2083625532272496640`.
- Creality Cloud private model `6a6e3f28753b84f6aab190a8`.
- MakerOnline unpublished draft `316221`.
- MakerRoad private draft `M2134222528`.

Earlier diagnostic and certification fixtures are also retained:

- MakerWorld private draft `9049481`.
- Printables unpublished draft `1796986`.
- Printables specialist unpublished draft `1797772`: eleven ordered images
  including a native-selected HEIC converted to JPEG, G-code, SLA/SL1 and a
  retained ZIP, with metadata and asset readback passed.
- Printables public model `1797774`, currently live at
  `https://www.printables.com/model/1797774-articulating-desk-dragon-print-in-place`.
  It must remain public until the user explicitly confirms permanent deletion
  at action time. Diagnostic drafts `1797764` and `1797758` may also remain and
  must not be deleted without exact authority.
- Cults3D secret design `4733079`.
- MyMiniFactory exact-app private object `829043`; failed-receipt object `829039`
  is also complete and exposed the raw React file-payload defect. Older object
  `828462` exposed the missing-category defect.
- MyMiniFactory private specialist object `829284`, created by the exact package
  on 2026-08-02. It is retained; advanced-field persistence is browser-proven,
  while its corrected exact-package status receipt is still pending. Do not use
  retry to create a second object.
- Nexprint unpublished draft `2083537552623091712` (other earlier browser and
  Electron draft ids remain documented in `nexprint-web-flow.md`).
- Creality Cloud private model `6a6deda7d8fef9bfd45b0527`.
- MakerOnline unpublished draft `316188` (earlier core fixture `316077` is also
  referenced by older docs).
- Thangs private browser item `1583118`.
- MakerRoad earlier draft `M2134224533` and temporary assets from the pre-token
  failed attempt may also remain server-side.
- Thingiverse browser-contract draft `7390453` and exact packaged-app draft
  `7390455`; both are unpublished and intentionally retained.

The dated exact readback ledger is
`platform-live-certification-audit-2026-08-01.md`.

## Cross-platform parity already implemented

- Ten platforms appear in Settings, Platforms, preflight, Publish, batch
  receipts, account discovery, reconnect, and Real Upload Test.
- One-click batch publishing continues other destinations after a failure and
  runs at most four desktop publishers concurrently. Each platform preserves its
  own internal request order; browser fallback is serial.
- A completed partial failure exposes `Retry N failed only`. It preserves all
  successful receipts and reruns only failed destinations, avoiding duplicate
  uploads to platforms that already succeeded.
- Demo remains simulation-only. Real Upload Test loads bundled sample content
  but performs no mutation until the explicit upload action.
- Safe defaults are private, secret, or unpublished draft. Public publication is
  always explicit.
- Shared fields propagate to every target, with per-platform transforms and
  fail-closed preflight for unsupported conditional branches.
- Media order is preserved. Printables and Cults no longer receive guessed crop
  ratios or guessed image limits. Cults has typed image/video handling.
- MakerWorld accepts one compatible MP4/MOV model video in validation/transport.
- Category and subcategory mapping is dynamic where available; MyMiniFactory
  sends integer category ids and reads them back from its React payload.
- Responsive header/layout regression is covered across every workflow section.
- The header shows build date/time during development so stale packaged apps are
  obvious.
- Single-instance locking and normal-launch tooling prevent duplicate local apps.

## Critical bugs and lessons already carried forward

### Stale or respawning app processes

Temporary `launchctl submit` QA jobs respawned ModelPrep and stole focus. This was
not necessary application behavior. Always launch the exact bundle normally and
verify no `io.makerstats.modelprep.local`, `.qa`, or `.preview` job remains.
`/Applications/ModelPrep.app` and the backup app can be stale; use
`desktop/dist/mac-arm64/ModelPrep.app` for local QA.

### Settings versus Publish connection mismatch

Old UI mixed Chrome sign-in, stale renderer markers, and verified Electron
sessions. Account discovery and status now come from main-process identity
checks. All three surfaces expose Reconnect without forcing navigation away.

### Thangs false expiry

Thangs was signed in. ModelPrep only captured cookies, while current Thangs uses
a local-storage bearer token. After token capture was added, Electron still
canceled requests because the adapter manually supplied an invalid cross-origin
`Referer`. Removing the manual referrer fixed the request. Never manually set
forbidden browser headers in `session.fetch`; let Chromium generate them.

Thangs signed storage also rejects model MIME types for the signed PUT. Match the
first-party helper: `application/octet-stream` for binary models, with explicit
text/PDF exceptions.

### MakerRoad false connected state

The original identity probe used a public taxonomy endpoint, so any cookie could
look authenticated. Current validation requires authenticated `/api/user` and an
`X-Token`, which is also mirrored into write requests. The site later returned;
private drafts now save and read back. Recheck authenticated availability before
future mutations instead of falling back to the public taxonomy probe.

### MyMiniFactory passwordless and readback behavior

There is no traditional password to store. The email-code browser session is the
credential. Use the same Chromium partition and user agent for validation and
upload. Managed submit must follow the redirect and inspect `response.url`;
`redirect: manual` is canceled by Electron. Categories are required integer ids
and must survive edit/readback; the old object with zero selected categories is
not acceptable certification. The raw edit response does not server-render file
download links. Its authoritative file list is the `files` array inside the
`UploadFilesWrapper` React-on-Rails JSON payload; links appear only after browser
hydration. Parse that payload and retain link parsing only as a compatibility
fallback.

### MyMiniFactory closed out — 2026-08-03

Retained Private object `829284` was re-read **read-only** from the corrected
exact package and the receipt succeeded: `private · 10 images · 3 files ·
categories 60/462 · remix of 829056`. Nothing was created, edited or deleted.
The advanced print/license/remix branch is now **exact-app live-certified**.

Three real defects had to be fixed to get there, none visible from the certified
upload path (which only ever re-reads the canonical URL `submit` returns):

1. `status()` used `redirect: 'manual'`, and Electron cancels a manual redirect
   with `ERR_ABORTED`, so re-reading an existing `/object/<id>` always failed.
   It now follows the redirect in the managed session, like `submit`.
2. The current editor emits `selected=""` for `license_id`,
   `selected="selected"` for visibility/technology/units, and a bare `checked`
   for the remix control. The old regex only matched the latter two, so
   **license never read back at all**. Boolean attributes are now handled per
   the HTML spec (present ⇒ true).
3. `.mp-input`'s `width: 100%` outranked the `w-20` utility and collapsed the
   Dimensions field to ~19 px in the packaged app; its value was present but
   invisible. That row now uses inline flex sizing.

A read-only **Verify existing object** control was added to the MyMiniFactory
panel (mirroring Thangs' "Verify existing draft"). It calls the GET status route
only, so it can never create or duplicate an object. Use it instead of
`Retry N failed only` whenever a MyMiniFactory receipt fails after a create.

The create and edit forms were then diffed field by field (40 vs 54 named
fields). They differ structurally: different field prefix, tags renamed to
`threedObjectTags`, paired visible-control-plus-value-carrier for support-free
and remix, and `categories`/`threedUploadedFileUuids` absent from edit entirely.
That inventory exposed two more gaps, both fixed and re-certified: gallery order
was taken from the array index rather than the persisted `position`, and
`primary_image` was submitted but never read back. The receipt now reads
`10 images (ordered by position, cover cover-desk-dragon-wide-workshop-hero.jpg)`.

A comprehensive signed-in read-only audit of `/upload/object` classified every
control on the current create form. See `myminifactory-web-flow.md` for the
evidence matrix. Newly recorded: `config.fileSizeLimit` 100 MiB,
`filesPerObject` 500, `archiveFileSizeLimit` ~5 GB, `archiveFilesPerObject` 25,
55 accepted extensions, image cap 5 MiB. `can_use_zip_mode` and
`isPremiumCreator` are both **false on this account**, so ZIP/archive mode and
premium branches are account-gated rather than missing. Scan The World (11
controls) and `license_store` are visible but deliberately unmapped. Image
count, image extension allow-list and title/description caps remain **UNKNOWN**
and must not be guessed.

### MyMiniFactory specialist verification handover — 2026-08-02

The user explicitly authorized exactly one retained Private specialist object.
The exact packaged app created object `829284`, then failed closed during
readback because the current hydrated editor marks a remix with
`remix-checkbox`, while the parser only accepted the older submitted
`threedobject_type[remix]` name. The failure was therefore a false negative,
not evidence that creation failed.

The signed-in first-party editor independently proved retained object `829284`:
Private visibility; categories `[60,462]`; 10 ordered images; three files;
title, tags and description; print tips; time `3–5`; dimensions
`120 × 75 × 45` in mm; FDM; material `45 g`; support-free; CC BY-NC-SA; and
remix parent `829056`. The direct parser now accepts both current and legacy
remix control names, and the renderer retains an artifact id/URL when a later
readback fails so the object can be inspected rather than blindly duplicated.

Evidence classification is deliberately narrow: the branch is mapped,
implemented, locally tested, created by the exact package, and browser-proven.
It is **not** yet exact-app live-certified because the corrected package has not
captured a successful status/readback receipt for this existing object. The next
smallest step is an isolated, read-only exact-package re-read of `829284`; do
not press `Retry 1 failed only` and do not submit another MyMiniFactory create.

### MakerOnline 3MF parsing

The parse-profile endpoint expects `file_key` as an array. The earlier scalar
payload produced: `The file key must be an array.` This is fixed and covered.

### Unverified limits and crops

Do not turn recommendations or old UI guesses into platform requirements.
Printables has no verified 4:3 requirement or 25-image cap; Cults has no verified
square crop or 20-media cap. Unknown stays unknown until current DOM/bundle or
official documentation proves it.

### Thingiverse clearance

The previous API-license gate was a deliberate safety decision, not an adapter
defect. Written product-owner clearance was recorded on 2026-08-01. Production
mutation now defaults enabled, with an injectable emergency fail-closed override.
Draft remains the safe action; public still requires explicit selection and
current terms.

## Current verification baseline

### 2026-08-01 six-of-ten batch failure investigation

The packaged ten-platform real test returned six successes and four failures.
Those four receipts were debugged against the live sites and the exact packaged
app without deleting retained artifacts:

- **MyMiniFactory:** object creation succeeded on earlier attempts, but the
  attachment-race diagnosis was incomplete. Private object `829039` proved that
  the raw `/object/edit/<id>` response contains zero download anchors even when
  all three files are present; those filenames live in the `UploadFilesWrapper`
  React-on-Rails JSON and become anchors only after browser hydration. The
  direct adapter now parses that payload, with old anchors as fallback. Exact
  packaged private object `829043` then passed ModelPrep readback and independent
  first-party verification for title, private state, category IDs `60` and
  `462`, ten ordered images, and all three files.
- **MakerRoad:** private draft `M2134224533` was created with the complete model,
  profile, image, and metadata set. Fresh service navigation is available. The
  readback failed because the live edit endpoint requires
  `/api/models/getEdit?id=M2134224533&uploadType=1`; omitting `uploadType=1`
  returns HTTP 400. The direct adapter and test now use the exact 200 route.
- **Thangs:** the obsolete v2 all-in-one create returned HTTP 500. ModelPrep now
  follows the first-party v4 draft-first sequence, omits absent folder/workspace
  keys, accepts the primitive create ID, sends attachment objects, and can resume
  an existing private draft after a post-create details failure. Private model
  `1583177` passed packaged readback for details, attachments, and persisted
  license. The certification fixture uses one small STL as the single model and
  keeps the remaining files as references.
- **Thingiverse:** the HTTP 401 was an expired/misclassified isolated session.
  Uploads require the short API token returned by
  `exchange_session_for_token`, while identity uses its JWT. Recovery now
  exchanges and verifies identity in the same signed-in first-party page, closes
  automatically, encrypts the session, and shows `iamdjem` as Connected. A
  manual first-party draft (`7390453`) then proved the current upload/create/
  finalize/edit contract. The remaining HTTP 500 came from an implicit malformed
  custom rich-text section and stringified pending upload IDs in ModelPrep, plus
  the fixture's stale category `69`. ModelPrep now sends only explicit custom
  sections in the current first-party shape, preserves numeric upload IDs, uses
  Mechanical Toys category `124`, and mirrors the current default detail/app/
  education parts. Exact packaged draft `7390455` was saved and independently
  read back in the signed-in editor: unpublished state, 3 ordered model files,
  10 ordered uploaded images plus 2 generated STL renders, title, summary, 8
  tags, category `124`, and CC BY-NC all persisted.

The desktop batch concurrency is now four by explicit product-owner direction;
it is an application setting, not a platform limit. The scheduler preserves each
platform's internal request order and starts the next queued destination when a
slot opens. Browser fallback remains serial. Monitor image encoding, memory,
signed upload traffic, session contention, rate limits, and retry behavior before
raising it further.

### 2026-08-01 ten-of-ten closeout batch

The rebuilt exact packaged app ran the bundled safe-default project with four
desktop publishers active at once. All ten destinations completed successfully:
MakerWorld private, Printables draft, Cults3D secret, MyMiniFactory private,
Thingiverse draft, Thangs private, Nexprint draft, Creality Cloud private,
MakerOnline draft, and MakerRoad draft. Every receipt contained a result id/URL
and platform readback passed. MyMiniFactory object `829056` was additionally
opened in the signed-in first-party editor and independently verified for its
private state, hierarchical categories `[60, 462]`, ten ordered images, three
files, title, tags, and full description.

The earlier MyMiniFactory HTTP 500 did not reproduce with the same fixture and
four-way scheduler. It is therefore not evidence of a deterministic concurrency
or payload defect. Safe response diagnostics were added so a future failure can
surface status, response type/size, path, trace id, and a sanitized server error
without logging cookies, CSRF values, signed URLs, or upload credentials. Do not
blindly retry an ambiguous failed create request; use failed-only retry after
reviewing its receipt because the platform may have created an object before
returning an error.

Verified through 2026-08-02 after the ten-of-ten closeout batch, failed-only
retry, Nexprint warning fix, resource-telemetry/report follow-up, and the
MyMiniFactory specialist readback correction:

- Renderer: 37 test files, 176 tests passed.
- Desktop: 96 tests passed, including the current hydrated-editor remix-control
  readback fixture.
- Backend: 28 tests passed.
- Backend TypeScript: `tsc --noEmit` passed.
- Renderer production build passed.
- `git diff --check` passed.
- Signed arm64 `.app` passed `codesign --verify --deep --strict`.
- Signature: Developer ID Application, team `UTZ4TVACJS`.
- Exact packaged runtime marker **BUILD 570A8DD - AUG 2, 06:06 PM** loaded the
  bundled `file://.../Resources/renderer/index.html`, showed Settings account
  count 10, and retained Printables receipt `1797774` as “Confirmed live on
  Printables.” No upload or delete was triggered during this read-only check.
- Packaged runtime correctly shows all ten connected accounts; Thingiverse is
  `iamdjem` Connected after same-page exchange and identity verification.
- Only the exact `desktop/dist/mac-arm64/ModelPrep.app` process was running; no
  Vite server or ModelPrep keepalive job remained.

### 2026-08-04 independent validation supplement

- Renderer: 38 test files, 224 tests passed.
- Desktop: 144 tests passed.
- Backend: 31 tests passed; `tsc --noEmit` passed.
- Production renderer build passed (1,605 modules); only the existing Vite
  large-chunk advisory remains.
- The rebuilt arm64 QA bundle passed `codesign --verify --deep --strict` with an
  ad-hoc hardened-runtime signature. The configured Developer ID identity was
  unavailable, so distribution signing remains separate evidence.
- Exact runtime marker **BUILD 570A8DD - AUG 4, 11:06 AM** loaded from the
  bundled renderer. Settings reported 9 connected accounts and Cults3D as
  Reconnect needed. The Thingiverse panel visibly disabled Customizer without a
  SCAD file and displayed the corresponding requirement.

The `NexprintOptions` React missing-key warning is fixed. The component now
starts without another platform's temporary category objects and the focused
test fails if React writes any console error.

Privacy-safe resource telemetry is implemented across the Electron bridge and
batch scheduler. It records only aggregate publisher counts, Electron process
counts, app/main working-set memory, and total CPU percentage; it excludes run,
platform, account, file, listing, URL, request, cookie, and token data. Sampling
is bounded to 32 entries per batch and failures never block publishing. A
completed batch now produces a second, allow-listed privacy pass, retains the
latest 10 reports in renderer-local storage, and offers a local JSON download.
Reports contain only completion time, aggregate batch totals/concurrency,
aggregate peaks, and sanitized samples; stored input is sanitized again when it
is loaded. The exact signed packaged app displayed an idle fixture baseline on
2026-08-02 of 0 active publishers, 541.5 MB app working set, 4 processes, and 0%
CPU. No upload was started. This is packaged-runtime proof of telemetry wiring
and the renderer/build path, not live four-publisher load evidence; the retained
report/download state is locally component-tested because creating a completed
real batch still requires explicit action-time authorization.

The packaged `--verify` launcher now requires both the exact bundle's main
process and its renderer, and clears preview, local, and QA launch jobs before
building. This closes a false-positive case where a missing packaged module let
the main process remain alive without a renderer window. A packaging regression
test also requires `resource-telemetry.js` in Electron Builder's file allowlist.

MakerWorld model-video certification is now fail-closed at readback. The upload
path already accepts one MP4/MOV of at most 30 seconds and the adapter returns
`designVideo` from draft status. The renderer now retains the submitted video
reference and refuses to call the optional branch certified if the live draft
readback omits it or changes its filename/storage path. This is implemented and
locally verified only; no video was uploaded and the branch is not
live-certified.

Local media-input QA also passed with a generated 3.0-second, 1280x720 MP4
(126,615 bytes) derived from the existing desk-dragon demo image. The production
renderer preview displayed the file as `3.0s`, reported `Duration accepted by
MakerWorld`, produced no console warnings/errors, and kept preflight free of
MakerWorld video blockers. The only preflight warning remained Printables tag
normalization. The exact packaged app exposes the same video control, but its
native macOS chooser requires manual selection for the account-backed run. No
file was transmitted to a platform during this QA.

The QA app is signed but the local `--verify` build skipped notarization because
`APPLE_TEAM_ID` was not supplied. Do not call this a notarized release artifact.

Cults3D's retained secret creation was also re-opened read-only in the current
signed-in edit page. The live form exposes three ordered blueprint IDs/names and
ten ordered illustration IDs/names through the same hidden fields and asset
links used by submit. Desktop direct and Worker fallback paths now read that
canonical edit state plus My Creations visibility after publish. Any title,
visibility, ordered ID, or filename mismatch retains the artifact URL but marks
the result failed/uncertified; this includes MP4/WebM illustration persistence.
Focused desktop and backend tests pass. No Cults mutation or new artifact was
created, so typed video remains implemented/local and browser-contract proven,
not live-certified.

The immediate follow-up closed the Cults media preflight parity gap found by
that read-only audit. Direct Electron and the Worker fallback now accept the
current JPEG/PNG/WebP/GIF/MP4/WebM media set, require an image first, and reject
every media item over 10 MiB before authentication/upload. Tests cover GIF
acceptance, video-first rejection, oversized-video rejection, and the shared
Worker preflight. This is not live video certification and created no artifact.

## 2026-08-02 Cults3D and MakerRoad exhaustive read-only refresh

The current signed-in Cults create, price, edit and My Creations surfaces plus
the current uploader bundle were re-audited without mutation. The newly exposed
ModelPrep controls now propagate manufacturing settings, the 12 current fixed
meta tags, AI disclosure and comment permission through desktop and Worker
transports; unknown meta-tag values fail before authentication. This is source,
focused-test and current-browser-contract evidence only. The retained secret
core remains the only live-certified Cults branch.

The current signed-in MakerRoad create page, retained private draft editor and
route bundle were also re-audited without mutation. All six native sections
remain mapped; video is absent from the native form and serializer. The renderer
now rejects a completed save if canonical edit readback changes title, privacy,
plan, price type or a present role count. The retained private draft remains the
only live-certified MakerRoad branch; no new artifact was created.

## 2026-08-02 Cults3D signed-out bundle-drift re-audit

A later same-day pass could reach only **public** Cults assets: the isolated
browser available to that session was signed out, and `/en/creations/new`
redirected to `/en/log-in-choice`. No authenticated screen or request was
observed, so **the signed-in comprehensive Cults audit gate is not satisfied by
this pass** and the platform is still not comprehensively mapped.

What the public evidence did establish:

- Both previously fingerprinted bundles still resolve byte-identically, and the
  rendered login page still loads the documented `application` bundle.
- The deployed `packs/manifest.json` now points at a **newer upload pack**
  (`upload-f6d1a2a902153d3b47f2.js`). Which pack the auth-gated create page
  serves is UNKNOWN.
- The newer pack **removes the client-side `.rar` rejection**. The prior
  documented claim that RAR "is not effectively accepted" is now true only of
  the older pack; server-side behavior was never tested. Corrected in
  `platform-upload-requirements-live.md` §3.4.
- The uploader's forbidden file-name rule (`&`, `>`, `<`, failing with
  `Invalid character “X”` before the S3 policy request) is present and
  unchanged in **both** packs, and ModelPrep did not enforce it.

That last item was implemented in both transports: direct Electron and the
Worker fallback now fail closed before authentication when any model or
illustration file name contains those characters. Implemented and locally
tested only — no Cults artifact was created and nothing new is live-certified.
The retained secret core remains the only live-certified Cults branch.

## 2026-08-02 Printables current-contract refresh

The signed-in `iamdjem` account was first audited read-only on the current create
page and retained draft editor. The live DOM still exposes the three authorship
branches, explicit AI/NSFW/political controls, complete category/license lists,
rich-text toolbar, ordered images, and Print/Model/Other file buckets. Switching
the blank create form from draft to published only changed `SAVE DRAFT` to
`PUBLISH NOW`; no Store/Club/price fields were rendered for this account. The
temporary blank-form choices were discarded without saving during that mapping
pass.

The current site/client version is `v4.8.10`. Its editor retains the implemented
`modelUpdate`, presign, CRC32C finish, processing-poll, publish-request and
readback contracts. ModelPrep's backend and desktop request headers now match
that client version. The current bundles also reconfirmed a 95-character
per-file note limit and 60-character limit for each folder-name segment;
renderer controls, preflight, submission validation and tests now enforce those
bounds. Current bundle inspection also proves that the active rich-description
image uploader rejects files larger than 8 MiB before presigning. Gallery count,
gallery-image byte and fixed-aspect-ratio limits remain unknown. Full
fingerprints and evidence are in `printables-web-flow.md` and
`platform-upload-requirements-live.md`.

### 2026-08-02 Printables specialist and public closeout

The exact signed packaged app created unpublished specialist draft `1797772`
and independently read back eleven ordered images, including a HEIC converted
to JPEG inside ModelPrep, one G-code, one SLA/SL1 and one retained ZIP plus the
expected title, summary, rich description, tags, category, license and draft
state. Per-file G-code controls now cover layer height, nozzle diameter, print
duration in hours, whole-number weight in grams and exclusion from aggregate
totals. The current mutation contract requires decimal strings for
layer/nozzle/duration, integer weight, and rejects the processed readback's
display-only `printer` object. SLA mutation input accepts only id, folder, name
and note even when processed readback exposes computed details.

The same exact app created draft `1797774`, verified it, published it and polled
readback until live. It remains public pending separate action-time deletion
confirmation, so deletion is not certified. Store/Club is blocked on this
free-only account, while approval-gated publishing requires an account where
`publishApprovalRequired` is true. Failed diagnostic attempts can leave drafts;
`1797764` and `1797758` remain pending explicit cleanup authority.

## Per-platform remaining work

There is no known missing implementation in any platform's safe core
private/draft/secret upload and readback path. All ten safe cores are implemented,
connected, locally verified, and live-certified in the exact packaged app. The
remaining work is optional-branch implementation hardening and individual live
certification; no platform is fully certified.

| Platform | Code or contract still incomplete | Implemented but not live-certified |
|---|---|---|
| MakerWorld | No safe-core gap. Keep genuine `.lac` handling under change detection; do not infer unsupported video variants. | One MP4/MOV video, genuine LAC final submit, public, remix, Exclusive, CyberBrick, documentation/BOM edge cases and other eligible matrices. |
| Printables | No safe-core or specialist-file gap. Exact gallery count, per-gallery-image byte cap and fixed aspect-ratio limit remain unknown. | Permanent deletion of public `1797774`; Store/Club on an eligible account; approval-gated publishing; remix/reupload; unpacked ZIP and authenticated rich-description image round trips. |
| Cults3D | Manufacturing settings, current fixed meta tags, AI disclosure and comments now propagate through both transports with local coverage. The uploader's `&`/`>`/`<` file-name rule is now enforced fail-closed in both transports. Title/description and total-media caps remain unknown; current `.rar` behavior and the pack served to the auth-gated create page are UNKNOWN after the 2026-08-02 manifest drift. Ordered edit/list asset readback is fail-closed in both transports. | Public, paid/open-price, multiple usage licenses, optional subcategory/meta-tags, typed MP4/WebM video and deactivation/reactivation. |
| MyMiniFactory | No safe-core, advanced-field or readback gap. Comprehensively mapped on 2026-08-03: every control on the current create form is classified. Image count, image extension allow-list and title/description caps are UNKNOWN in the current client and must stay unknown. Scan The World and `license_store` are visible but deliberately unmapped. | Public review; ZIP/archive mode and premium branches (both account-gated: `can_use_zip_mode` and `isPremiumCreator` are false on this account); 500-file and 100 MiB extremes; the wider extension matrix; object deletion. Advanced print/license/remix is now exact-app live-certified via the read-only re-read of `829284`. |
| Nexprint | No safe-core gap. Keep activity/eligibility and extension rules dynamic. | Public, full attachment/BOM/originality matrix, activity eligibility, broader model extensions and high-count ordering cases. |
| Creality Cloud | No safe-core gap. Keep Aliyun/session fingerprints under change detection. | Existing-draft edit, public, Remix/Non-original attribution, instruction files, parsed Print Settings Info, other extensions/media and eligible paid controls. |
| MakerOnline | No safe-core gap. Keep taxonomy, kits and eligibility server-driven. | Parsed 3MF/profile media, documentation, Remix, public, paid, Creative Kit, China sync, Exclusive, Resin-only, high-count/large-file and other eligibility branches. |
| MakerRoad | Current production DOM/bundle has no native video input, upload role, or serializer; keep video unsupported and warn rather than guessing. Readback now fails closed on title, privacy, plan, price type and present role-count mismatches. Recheck availability/auth before mutation after outages. | Public/review, paid Points/Cash, remix/source, schedule, print metadata, instructions and other optional combinations. |
| Thangs | No safe-core gap. Optional commercial/plan controls must remain gated by account eligibility. | Multipart/bulk/assembly, versions/dependencies, standalone assets, plans/tiers, paid/marketplace/membership, public/access and other editor branches. |
| Thingiverse | No safe-core gap. Continue monitoring the current token exchange and editor schema. | Public publication, remix/ancestors, custom rich sections, education fields, app associations, WIP/customizer/AI/NSFW and broader file/media combinations. |

Cross-platform work still open:

1. Certify the rows above one branch at a time with explicit action-time authority;
   never use a ten-platform public batch as a shortcut.
2. During the next explicitly authorized private/draft/secret batch, retain the
   aggregate resource samples and compare idle, four-active, and completion
   peaks. Do not raise concurrency above four until that load evidence exists.
3. Re-audit first-party DOM, bundle fingerprints, request schemas and unknown
   limits before public release or whenever a platform breaks.

## 2026-08-04 Cults3D sign-in repair

Cults now returns HTTP 403 with `cf-mitigated: challenge` to the old standalone
Node sign-in request before credentials are submitted. The Rails/S3 publishing
contract itself remains unchanged. ModelPrep now opens the real Cults sign-in
and security check in a persistent Chromium partition per opaque account ID,
validates `/en/creations/new`, and routes all Cults/S3 adapter traffic through
that partition. Status and discovery are live-validated rather than inferred
from stored credentials. Browser builds fail closed instead of forwarding a
password to the Worker.

Legacy main-process credential records are preserved until the browser
reconnect succeeds, then overwritten with label/session metadata. Any legacy
renderer password is scrubbed immediately and the account is marked reconnect.
Focused adapter, preload, account-migration, auth-routing and Settings tests are
local evidence only. A packaged interactive reconnect plus read-only create-page
validation remains required; no upload or platform mutation is authorized by
this repair.

The first packaged attempt did not pass that gate: checking Cloudflare's
"Verify you are human" control looped on the challenge page. Root cause in our
implementation was a Chrome 149 UA forced onto Electron 33 / Chromium 130 plus
a 1.2-second authenticated-page probe running behind the challenge. The second
repair upgrades the runtime to Electron 43 / Chromium 150, derives Cults's UA
from the exact runtime, pauses validation while the challenge page is visible,
and uses a fresh `persist:cults-v2-*` partition. This second repair is tested
and packaged locally but must not be called live-verified until the interactive
window reaches the real Cults sign-in/create page.

Computer-use and DevTools verification of that packaged build showed that the
global `app.disableHardwareAcceleration()` did remove both WebGL contexts, but
it was not the decisive failure. A second signed build with normal GPU support
reported hardware-backed WebGL/WebGL2, `navigator.webdriver: false`, and the
correct Chromium 150 UA. It still exposed no WebGPU adapter, advertised only
`Chromium` (not Google Chrome) in client hints, and Cloudflare closed the
challenge POST before returning 403 under a new Ray ID. The GPU experiment is
reverted because it did not solve sign-in and revives the prior multi-canvas
SIGBUS risk. Current evidence therefore classifies Cults' managed challenge as
rejecting the embedded Electron browser; this path is not live-verified.

## How to continue one platform at a time

Use `platform-one-by-one-implementation-playbook.md` as the execution contract.
It records the mapping, bundle/request inspection, shared-versus-native UI
design, three-runtime-layer wiring, packaged verification and live-readback
method used for Printables. Finish and document one selected branch before
moving to another platform.

Printables is complete for the currently eligible specialist and normal-public
branches. Its next action is deletion only if the user confirms the exact live
model. Store/Club and approval publishing need different eligible accounts. With
MakerWorld video deferred for the user's manual verification, the next platform
implementation target is Cults3D, beginning with a fresh read-only form/bundle
audit and then one safe isolated optional branch. Public, paid and cleanup
actions each retain their own authority gate.

## Exact files to start from

- Renderer/orchestration: `deploy/src/App.jsx`
- Account store: `deploy/src/lib/accounts.js`
- Batch scheduler: `deploy/src/lib/batch-publish.js`
- Platform renderer helpers: `deploy/src/lib/<platform>*.js`
- Electron main/session bridge: `desktop/main.js`, `desktop/preload.js`
- Direct adapters: `desktop/*-direct.js`
- Shared Worker adapters: `backend/src/adapters/`
- Packaged launch: `script/build_and_run.sh`
- Limits/status matrix: `backend/docs/platform-specs.md`
- Full live requirements: `backend/docs/platform-upload-requirements-live.md`
- Live artifact ledger: `backend/docs/platform-live-certification-audit-2026-08-01.md`
- Per-platform details: `backend/docs/<platform>-web-flow.md`
- Reusable implementation method:
  `backend/docs/platform-one-by-one-implementation-playbook.md`

## Verification commands

```bash
cd /Users/alex/modelprep
git status --short
git diff --check

cd deploy && npm test && npm run build
cd ../backend && npm test && npm run typecheck
cd ../desktop && npm test
cd .. && ./script/build_and_run.sh --verify

codesign --verify --deep --strict --verbose=2 \
  desktop/dist/mac-arm64/ModelPrep.app

ps ax -o pid=,command= | rg '[M]odelPrep|[v]ite'
launchctl list | rg 'io\.makerstats\.modelprep\.(local|qa|preview)' || true
```

Do not run a live upload merely because tests pass. Inspect the rendered preflight
and request authority immediately before each account mutation.

## 2026-08-08 demo-certification continuation

The latest live retained-object audit and the local fixture replacement are in
`demo-upload-live-verification-2026-08-08.md`. Start there before using the demo.
The old desk-dragon assets were semantically invalid (cube STLs plus an unrelated
PCB/enclosure 3MF) and have been replaced by one coherent calibration-puck
fixture. The exact rebuilt/signed app has now run the authorized private/draft
pairwise batch: seven retained successes, Cults S3 failure, MakerRoad
`status=1`, and MakerWorld truthfully blocked for lack of a physical-print photo.

Independent retained-page inspection confirms that all ten supplied images and
the rich listing metadata render on Printables, Nexprint, Creality and
MakerOnline. Thingiverse retained both STLs, the Bambu 3MF, all uploads and its
structured print settings. The principal current defect is now concrete:
Printables, Nexprint, Creality and MakerOnline retain only the two STLs and drop
or misclassify the same 3MF/profile; MakerOnline explicitly says it has no print
profile. Printables also falls back to `Action Figures & Statues`, and several
fresh Thingiverse resize-service thumbnails fail even though source uploads are
present. MMF and Thangs passed exact-app readback but normal Chrome could not
render their private results, so their visual parity remains partial.

Do not run another broad batch or click failed-only retry. Implement
platform-specific 3MF/profile routing plus exact file-role/count readback first,
fix the Printables category, then recertify one affected platform at a time.
Cults transport, MakerRoad rejection, isolated-session MMF/Thangs rendering and
MakerWorld real-photo eligibility remain separate blockers. Exact receipts and
field-level evidence are in `demo-upload-live-verification-2026-08-08.md`.

The subsequent two-failure repair separated transport from review. Cults signed
S3 uploads now bypass page CORS through the Electron partition session while
Cloudflare-protected first-party calls remain paced in-page. Secret calibration
fixture `modelprep-calibration-puck-upload-test-fixture-b01addf327b6843d212e`
was created and its retained editor shows all three files, ten media records and
the expected metadata. MakerRoad demo transport is allowed to use disclosed
synthetic imagery, but the resulting save still returns `status=1`; ordinary
projects remain real-photo-gated and the rejected demo is never called
certified. Error receipts now preserve its retained edit URL for visual audit.

## 2026-08-08 correction: the 3MF gap was ours, not the platforms'

The work order above ("implement platform-specific 3MF/profile routing") rested
on a wrong diagnosis and should not be followed as written.

The supplied Bambu 3MF never reached Printables, Nexprint, Creality Cloud,
MakerOnline or MakerRoad because ModelPrep's automatic per-platform file
selection unticks a print profile sliced by another vendor's slicer
(`deploy/src/lib/platform-files.js`). Those five platforms' native slicers are
Prusa, Elegoo, Creality Print, Anycubic and Elegoo. The five platforms that did
retain the 3MF are exactly the ones whose native slicer is Bambu or none. No
routing was wrong and no transport failed.

Printables specifically has **no print-profile surface**: live public readback
of model `1472993` returns a `.3mf` inside the `stls` bucket, so a profile is an
ordinary model file there. Printables' nearest equivalent is the model-level
main 3D printer plus per-G-code metadata, still unimplemented.

Fixed for Printables only: the fixture now opts the profile in and selects
category `12` (`3D Printers › Test Models`, was `36` = Action Figures &
Statues); preflight and both receipts name any profile that is not being sent;
and readback fails closed against the **selected source files** rather than
against a payload derived from the platform's own processing response, which
could never detect a dropped file. Deploy 371/371, desktop 207/207, backend
31/31, `tsc` clean, package rebuilt and strict-codesign verified.

Retained-certified by authorized unpublished draft `1803724`: the exact signed
package, driven through its own UI with the other nine platforms toggled off,
produced the first Printables listing that retains the supplied 3MF (filed in
`stls` beside both STLs) and the `Test Models` category, with ten ordered images
all fetched at 200/non-zero bytes. Draft `1803506` is untouched as the
before-state.

Printables byte retention is also closed. Introspection is disabled upstream, so
a negative-validation probe established that `STLType` exposes no file-path or
URL field and `fileSize` is the only authoritative byte signal; both status
queries now select it via a readback-only `PrintablesRetainedFile` type kept
apart from the mutation input. Re-reading `1803724` showed byte-for-byte
retention (36,084 / 54,084 / 30,787 exact), so readback fails closed on positive
size, exact source-size equality and a missing size. That is Printables
integrity only and is unrelated to Thingiverse's zero-sized resize thumbnails,
which are a separate pipeline and a separate open item.

Creality Cloud is a third distinct shape and was mapped from its own contract on
2026-08-08. A `.3mf` belongs in `modelList` as an ordinary model; Creality's
parsed Print Configuration mode is separate and needs a real `.3mf` parser, so
`model3mfCount`/`include3mf` stay `0`/`false`. Two contract details would break
a naive check: `fileName` is stored **without** the extension (`fileFormat`
carries the dotted extension), and Creality **translates tags and category names
server-side** (English tags came back as `3D打印机`, `校准`, `测试模型`), so
neither is asserted and the stable `categoryId` is checked instead. A stale claim
that ModelPrep excludes profile-linked `.3mf` files from `modelFiles` was
corrected: that exclusion was removed on 2026-08-07, leaving only the shared
auto-exclusion default. `isOriginal` read false on a `modelSource: 1` model and
is an open ambiguity. Creality's verifier was then hardened: `fileFormat` and `totalFileSize` must be
present as well as equal, `isShared` must be explicitly `false` for a private
upload, `modelCount` is exact, gallery identity and order are compared by
cover-URL basename with `pcCovers`/`appCovers` checked independently,
`model3mfList`/`model3mfCount`/`include3mf` must be present-and-empty/0/false,
instruction files are checked by count and total bytes (identity is not
retained), `fileMd5` is checked against the md5 embedded in the upload
`fileKey`, and parsed geometry (`x`/`y`/`z`/`volume`) must be positive so
usable geometry is never inferred from name and size alone. One authorized private create then ran on 2026-08-08 and **failed closed**:
Creality retained the object, but its immediate readback reported no parsed
geometry on either STL and no `.3mf` in `modelList`. The pre-existing object has
parsed geometry, so Creality populates it asynchronously and ModelPrep judges
too early — the next slice is polling until processing settles, then resolving
whether the Bambu `.3mf` is merely unprocessed or actually rejected. The run
also exposed a lost-object-id defect (the fail-closed throw discarded the new
model's id and URL, and no allow-listed route can enumerate private models);
that is now fixed by recording the retained id/state/URL as soon as `submit`
returns and preserving it in the error receipt. Certification was also replaced
with bounded polling of the same saved id (3 s interval, 120 s timeout, never a
resubmit): still-settling fields keep polling, hard contradictions fail at once,
and a timeout reports the exact unresolved fields. Both are **locally tested,
not live-proven** — nothing has been created since. The first object's id is
**unrecoverable from ModelPrep**: only `whoami`/`upload`/`submit`/`status`/
`drafts` are allow-listed, `my-models` is 404, and `creality:connect` opens no
page session when a session exists, so the id must come from the user's own
Creality model list. The object is **`6a777ac80389871f0cd5e0c0`** (id supplied by the user from their
own Creality model list) and, once settled, it is **API-certified**: all three
files present, the Bambu `.3mf` ingested as an ordinary `modelList` entry with
real parsed geometry (34 × 34 × 4.4, volume 3960.40), `modelCount 3`,
`totalFileSize 120955`, `isShared false`, category `1645`, CC BY-NC, 9+1+1
covers, Print Configuration empty, zero instructions — the corrected verifier
returns zero issues. Two contract findings came out of it: Creality settles
asynchronously (the first readback was simply too early), and it **masks
filtered words in retained filenames** (`bambu` → `*****`, character for
character), so files are matched by `fileMd5` and names checked mask-tolerantly.
Rendered UI/DOM remains unmet. Do not retry or delete the object. Creality is
**retained/API-certified once settled**; private model
`6a77222f75286de2e7e68468` is untouched as the before-state.

Direction set by the user on 2026-08-08: **keep the auto-exclusion default** and
give Nexprint, then Creality Cloud, then MakerOnline, then MakerRoad the same
per-platform treatment Printables received (correct the false fixture coverage
claim, explicit fixture opt-in, preflight warning naming the unsent profile,
fail-closed source-file readback), one platform at a time. Each platform's own
contract decides whether a `.3mf` is an ordinary model file, an attachment or a
real profile role; do not bulk enable it everywhere. All four still omit the
profile today. This sentence is historical for Nexprint/Creality: both have now
completed their safe-core retained slices. MakerOnline is implemented and awaits
one authorized dual-role draft; MakerRoad remains pending. Detail:
`printables-web-flow.md`, `nexprint-web-flow.md`, `creality-web-flow.md`, and
`makeronline-web-flow.md`.

## Documentation authority map

- **Current truth and continuation:** this file.
- **Copy-paste prompt:** `NEXT_AGENT_PROMPT.md`.
- **Current live receipts/certification:**
  `platform-live-certification-audit-2026-08-01.md`.
- **Exact limits, formats, fields, transformations, and unknowns:**
  `platform-upload-requirements-live.md` and `platform-specs.md`.
- **Account persistence and safe testing:** `desktop-live-upload-testing.md`.
- **Platform request contracts:** each `*-web-flow.md` file.
- **One-platform implementation/certification method:**
  `platform-one-by-one-implementation-playbook.md`.
- **Historical build-out narrative:**
  `platform-integration-handoff-2026-07-31.md`, root `HANDOFF.md` history in git,
  and older MakerWorld/Cults documents. Do not use historical continuation queues
  over this one.
