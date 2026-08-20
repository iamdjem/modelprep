# ModelPrep ten-platform current state — 2026-08-08

This is the shortest authoritative status ledger for the current dirty
worktree. Read it together with `modelprep-current-handoff-2026-08-01.md` for
architecture and historical details, and
`demo-upload-live-verification-2026-08-08.md` for retained-object evidence.

## Executive answer

All ten platform upload flows have been explored and documented at least for
their normal safe upload path. The coherent calibration-puck demo was exercised
against every destination that passed preflight. That does **not** mean every
platform is fully verified or ready for arbitrary production uploads.

- Shared title, description, tags, licence, visibility and ordered-image
  transport are working on the independently inspectable retained results.
- The demo now contains two truthful STL model sizes, one matching but unsliced
  Bambu Studio 3MF project, ten coherent synthetic images and representative
  metadata. The 3MF is raw-model evidence only until a genuinely sliced project
  replaces it.
- Cults3D's original S3 transport failure is repaired and its retained secret
  editor was manually verified with all three files, all ten media records and
  the expected metadata.
- MakerRoad upload transport works, but synthetic imagery is rejected by the
  platform review (`status=1`). Demo uploads may proceed with a warning; normal
  projects still require a confirmed real-print photo.
- **Corrected 2026-08-08:** the "print-profile routing" gap was misdiagnosed.
  The supplied 3MF was never uploaded to Printables, Nexprint, Creality Cloud,
  MakerOnline or MakerRoad because ModelPrep's own automatic per-platform file
  selection unticks a print profile sliced by another vendor's slicer. The
  fixture profile is Bambu; those five platforms' native slicers are Prusa,
  Elegoo, Creality Print, Anycubic and Elegoo. Nothing was routed wrongly and no
  transport failed. See `printables-web-flow.md` for the live proof table.
  Printables, Nexprint and Creality are retained-certified for their respective
  ordinary-model roles. MakerOnline's deliberate dual-role attempt stopped
  before save. Local archive inspection now proves the bundled project is
  unsliced, so the demo disables its profile role instead of fabricating parser
  values.
  MakerRoad remains pending real-photo evidence.
- No platform is fully certified across public, paid, remix, video, specialist,
  membership, agreement-gated and account-gated combinations.

## Evidence vocabulary

- **Local:** source/request tests pass.
- **Package:** exact signed `desktop/dist/mac-arm64/ModelPrep.app` exercised.
- **Retained:** an account-backed object exists and important fields were read
  back or inspected.
- **Partial:** a relevant surface was blocked, omitted or not independently
  rendered.
- **Uncertified:** transport may have completed, but retained state or platform
  acceptance did not pass the required check.
- **Fully certified:** every supported branch has retained evidence. There are
  currently no fully certified platforms.

## Platform ledger

| Platform | Strongest current evidence | Confirmed working | Remaining or blocked |
|---|---|---|---|
| MakerWorld | Package preflight; older retained private evidence | Regular-3D mapping, covers/gallery and core metadata have prior retained proof | Calibration fixture correctly blocked because no physical-print photo; new fixture/profile not retained-certified; Laser/Cut, CyberBrick, video, public and eligibility branches remain partial |
| Printables | **Retained draft `1803724`** — both defects fixed and read back | Ten ordered images (all fetched 200/non-zero), **all three files including the Bambu 3MF in `stls`**, category `12` Test Models, CC BY-NC, author, No AI, title, summary, tags, structured HTML description, unpublished | `.3mf` is an ordinary model file here; there is no profile surface. G-code main-printer/material, rich-content media, remix/reupload, unpacked ZIP, approval-gated publish, public lifecycle and Store/Club remain uncertified. Draft `1803506` retained as the before-state |
| Cults3D | Retained secret creation ending `b01addf327b6843d212e` manually inspected | S3 transport repaired; both STLs, 3MF, ten media records, Markdown, manufacturing details, category, keywords/meta-tags, AI and comments retained | Immediate automated edit readback encountered temporary 404/Cloudflare challenge; some CDN thumbnails were still processing; paid/open-price/public and broader taxonomy branches remain uncertified |
| MyMiniFactory | Fresh exact-package authenticated owner re-read of private object `831756` | Private; 10 images ordered by retained position; expected cover `cover-model-derived-render-of-the-34-mm-calibration-puck.jpg`; 3 files; categories `60/462`. The read-only action used ModelPrep's isolated connected session and created or edited nothing. | This is authenticated retained/API evidence rendered in ModelPrep, not native MyMiniFactory page-DOM proof. Normal Chrome remains signed out; premium store/archive/public-review branches remain account/action-gated. |
| Thingiverse | Retained draft `7393174` editor inspected | Both STLs, 3MF, ten uploaded images, Markdown, tags, licence and structured print settings retained. Correct category `129` (`3D Printing › 3D Printing Tests`) is pinned locally and the product link now opens `/thing:0/edit`. | Existing retained draft still needs an explicitly authorized save of category `129`. One of twelve rendered thumbnails remains 0x0 because its resize URL contains anomalous `h=1`; the original asset and other eleven thumbnails exist. Public and rich optional branches remain uncertified. |
| Thangs | Earlier package submit/readback for private model `1586259`; fresh isolated-session read-only attempt failed | Corrected receipt route and earlier app readback | Fresh authenticated `status?id=1586259` ended with `net::ERR_CONNECTION_CLOSED`; it was not retried and nothing was created or edited. Normal Chrome still cannot render the private route; independent image/model/profile association and paid/version/bulk/assembly branches remain incomplete. |
| Nexprint | **Retained draft `2086143258366976000`** — all three files read back | Cover + nine gallery, **all three files including the Bambu 3MF in `modelFileList` at exact bytes** (36,084 / 54,084 / 30,787), title, `3D Printer › Testing Models`, HTML description, six tags (hyphens preserved), BOM, CC BY-NC, Original, unpublished `status 0` | `settingInfoList` is `[]`: Nexprint's real print-profile block is still sent empty, so Print Profile is 0. `extra`/`is3MF` is null even for a retained 3MF, so it is deliberately not asserted. Rendered edit DOM not verified (REST gateway, no page session; separate browser is signed out). Populated profiles, attachments, public, activities, collections and remix remain uncertified. Draft `2086068343743848448` untouched as before-state |
| Creality Cloud | **Retained object `6a777ac80389871f0cd5e0c0` — API-certified once settled.** Before-state `6a77222f75286de2e7e68468` untouched | Nine gallery covers plus pc/app crops, two STLs at exact bytes with parsed bounding boxes, title, category `1645`, structured description and licence | All three files settled including the **Bambu 3MF with real parsed geometry** (34 × 34 × 4.4, volume 3960.40) — Creality ingests it as an ordinary `modelList` entry, not rejected. `modelCount 3`, `totalFileSize 120955`, `isShared false`, category `1645`, CC BY-NC, 9+1+1 covers, Print Configuration empty, 0 instructions. The first readback failed only because Creality settles asynchronously; bounded polling now fixes that. **Creality masks filtered words in retained filenames** (`bambu` → `*****`), so files are matched by `fileMd5` and names checked mask-tolerantly. Rendered UI/DOM still unmet; remix, edit-existing, public and paid remain uncertified |
| MakerOnline | Existing draft `317477` inspected; authorized dual-role package attempt stopped pre-save | Existing safe core retains ten images, two STLs and core metadata. New code verifies ordered native file/image keys, native bytes, parsed geometry, exact profile/parser state, description/taxonomy/licence/visibility/flags and draft status; preserves receipts and polls one saved id. Local inspection proves the bundled Bambu project is unsliced, removes fabricated demo parser values, and keeps it raw-only. | The Bambu 3MF parse-info response omitted every required parser field, so the gate created no draft and did not retry. Same-3MF raw + profile retention now requires a genuinely sliced truthful 3MF plus fresh action-time authorization; masking, upload `model_size`, docs, kits, sync, Exclusive, public/paid and rendered edit DOM remain uncertified |
| MakerRoad | Package upload/save; retained response `status=1` | Upload transport and rejection detection work; demo-only synthetic-photo warning works; future errors retain the edit URL | Platform rejected synthetic cover in review, so the result is uncertified; independent retained UI inspection and acceptance with real photos remain outstanding |

## Shared-defaults slice — 2026-08-13

- New `deploy/src/lib/shared-defaults.js` materializes the Details-step
  category and license into per-platform options ("we pick a close match for
  each" is now true). Static audited ids are used for MakerWorld, Cults,
  MyMiniFactory, Thingiverse, Thangs, Creality, Nexprint and MakerOnline;
  MakerRoad receives label `categoryPaths` resolved against its live taxonomy
  at upload; Printables stays server-driven and is matched against the live
  `/api/v1/printables/meta` list by label path.
- Auto-filled fields carry `categoryAuto`/`licenseAuto` flags; panels show a
  "Matched from your Details …" note and flip the flag off on manual change.
  When a platform has no equivalent license (for example `standard` on
  MyMiniFactory/Thingiverse/Thangs/MakerRoad) the legacy default is used and
  labeled "Closest available". Cults keeps its explicit-choice policy for the
  paid Standard license.
- CC BY-NC-ND (`ccbyncnd`) added to the shared license list and to every
  platform license map. The four hardcoded platform license defaults (MMF `5`,
  Thingiverse `cc-nc`, Thangs `CC BY-NC`, MakerRoad index `2`) are now empty
  and resolve from the shared license; legacy saved projects with stored
  values are treated as manual choices and left untouched.
- Autosave fingerprints ignore auto-managed fields so materialized defaults do
  not re-offer a handled restore snapshot.
- Companion UX reference: `platform-difference-matrix-ux.md` (all twelve
  difference dimensions per platform with current handling flags).
- Evidence: deploy 510/511 (the one failure is the pre-existing
  `settings.test.jsx` fallback-chain timeout, which passes in isolation and
  also failed with this slice disabled), new `shared-defaults.test.js` 23/23,
  production build clean. Upload transports were not modified; values reach
  them through the same option fields as before.

## Session-warm correction — 2026-08-13 (latest)

- Live diagnosis against the real `persist:printables` partition proved two
  things: the stored Printables session was fully valid (plain fetch whoami
  returned the account), and `session.fetch` is entirely non-functional on
  these partitions (`net::ERR_BLOCKED_BY_CLIENT`, even with no custom
  headers). Consequences: the earlier partition-fetch change broke Printables
  validation (false "Reconnect needed" while visibly signed in, sign-in window
  never auto-closing), and the long-standing `warmPersistentSession` fetch
  warm has been a silent no-op for every platform because its errors are
  swallowed.
- Reverted Printables API calls to plain fetch (proven working).
  `warmPersistentSession` now performs a real hidden `BrowserWindow` page load
  on the platform's session (locked down like remote windows, destroyed after
  load + 3 s grace). This is also the correct rotation mechanism: Printables
  auth is expiring access/refresh token cookies rotated only by the site's own
  client-side refresh inside a page.
- Settings → Diagnostics now shows per-platform session keep-alive results
  (IPC `session-keepalive:status`).
- Desktop 222/222; package rebuilt, codesign verified, relaunched.

## Package-phase input and session-longevity slice — 2026-08-13 (later)

- The whole Package phase is now a drop target at all times (overlay "Drop to
  add to your package"); previously only the empty state accepted drops, so a
  package started with photos could never receive model files by drag.
- Bulk selection actions (Remove, Change role, Group as one asset, Clear)
  moved from the below-the-fold list footer into a sticky action bar that
  appears directly under the toolbar whenever files are selected.
- New `desktop/session-keepalive.js` (started in `app.whenReady`): every six
  hours, for platforms with stored session material only, it re-runs the same
  silent recovery ladder as the Reconnect button (validate, first-party page
  warm inside the platform partition, revalidate, re-mirror the encrypted
  blob). Sequential, failure-silent, never changes account status, Cults
  excluded (its recovery can open a window). This addresses the observed
  frequent sign-outs of the sliding-cookie platforms.
- Printables root cause fixed: its API broker and whoami used Node's global
  fetch, so every rotated `Set-Cookie` was discarded and the session aged
  out. Printables API traffic now goes through `persist:printables` with
  `credentials: 'include'` (matching the certified MyMiniFactory pattern);
  non-Printables hosts (signed storage) keep the plain fetch.
- Evidence: deploy 510/511 (same single pre-existing flaky timeout), desktop
  **222/222**, keep-alive module 8/8 incl. a packaging-allowlist assertion,
  package rebuilt, strict codesign verified, relaunched. Live-browser QA:
  photos-then-STL drop lands, drag overlay renders, select-all + Remove
  clears the package.

## Implemented during this continuation

- Replaced the invalid dragon/cube/PCB fixture with a coherent calibration-puck
  fixture and matching Bambu Studio profile.
- Added truthful demo metadata, representative category combinations and fixture
  integrity tests.
- Corrected several description-formatting, taxonomy, receipt and platform
  routing defects recorded in the platform-specific flow documents.
- Corrected Thangs receipt URL construction.
- Repaired Cults3D S3 networking by routing signed storage requests through the
  Electron partition session while keeping authenticated Cults requests in the
  page; added pacing and bounded post-create readback retries.
- Made MakerRoad distinguish upload transport from platform review rejection,
  retain the saved URL on readback failure, and allow disclosed synthetic media
  only for the demo fixture.
- Added MakerOnline fail-closed retained certification, native upload-response
  provenance, structural profile-parser comparison, a pre-save parser gate,
  bounded same-id polling, exactly-once save semantics and retained receipt
  preservation. The dual-role draft itself has not been created.

## Verification baseline

- Renderer/deploy suite: **452/452 passed**.
- Desktop suite: **208/208 passed**.
- Backend suite: **31/31 passed**; backend TypeScript clean.
- Production renderer/package build completed.
- Exact package passed `codesign --verify --deep --strict` and satisfies its
  designated requirement.
- The package is Developer-ID signed for local QA. Notarization remains unproven
  because Electron Builder did not have `APPLE_TEAM_ID`.
- `git diff --check` passed.
- Exact-package UI QA proves the scanned unsliced Bambu 3MF appears under
  **Model files** (three models total) and the Publish summary reports **0 print
  profiles**. MakerOnline's profile role remains disabled.
- No ModelPrep process/helper or `io.makerstats.modelprep.local|qa|preview`
  LaunchAgent remained after QA.
- No retained object was published or deleted. No commit or push occurred.

## Printables slice — 2026-08-08

- Root cause of the missing 3MF is ModelPrep's automatic file selection, not
  platform routing. Live public readback proves Printables files a `.3mf` under
  `stls`: it is an ordinary model file with no profile role.
- Added fail-closed verification against the **selected source files**
  (`printablesSourceFileMismatches`). The previous check compared the saved
  model against a payload built from Printables' own processing response, so a
  dropped file agreed with itself and passed.
- Preflight and both receipts now name any print profile the platform is not
  being sent. Silent omission is what made this read as a platform defect.
- Fixture category corrected to `12` (`3D Printers › Test Models`); the fixture
  now opts its Bambu profile in explicitly for Printables.
- The shared auto-exclusion default was deliberately **not** changed. It affects
  five platforms and is a product decision, not a Printables fix.
- Deploy 417/417, desktop 207/207, backend 31/31, `tsc` clean, package rebuilt
  and strict-codesign verified with all three changes present in its renderer.
- Retained-byte integrity closed. Introspection is disabled on Printables, so a
  negative-validation probe established that `STLType` has **no** file-path or
  URL field; `fileSize` is the only authoritative byte signal. Both status
  queries now select it through a readback-only `PrintablesRetainedFile` type
  kept separate from the mutation input. Re-reading `1803724` proved Printables
  stores model files byte-for-byte (36,084 / 54,084 / 30,787 exact), so the
  check fails closed on positive size, exact source-size equality and a missing
  size. Printables integrity only: this says nothing about Thingiverse
  thumbnails, which are a different pipeline.
- **Retained-certified as authorized: unpublished draft `1803724`.** The exact
  signed package, driven through its own UI with the other nine platforms
  toggled off, produced the first Printables listing that retains the supplied
  3MF (in `stls`, alongside both STLs) and the correct `Test Models` category.
  Ten images retained in order and individually fetched at 200/non-zero bytes.
  Nothing was published, retried or deleted; draft `1803506` is untouched as the
  before-state. The app was quit cleanly with no process or LaunchAgent left.

## What is left

1. **Nexprint is retained-certified for the safe core** by draft
   `2086143258366976000`: all three files land in `modelFileList` at exact
   bytes, `settingInfoList` is empty, cover plus nine gallery, metadata and
   unpublished state all read back. Remaining there: a populated `settingList`
   print profile (name, plates, profile cover, introduction), attachments,
   public publish, activities/world-first, collections and remix. Rendered edit
   DOM is still unverified because ModelPrep uses a REST gateway with no
   Nexprint page session and a separate browser is signed out.
2. **Creality Cloud is API-certified once settled** at retained object
   `6a777ac80389871f0cd5e0c0`: all three files, including the Bambu 3MF, retained
   with exact bytes and parsed geometry. Bounded polling and mask-tolerant name
   checking are implemented. Rendered UI/DOM and optional branches remain.
3. **MakerOnline's authorized dual-role attempt stopped safely before save.**
   `/api/file/parse-info` omitted printers, nozzle, layer, plates and parseType,
   so no draft exists and no retry occurred. Diagnose the parser contract or
   use a truthful MakerOnline-compatible profile before another authorized run.
4. **MakerRoad remains pending real physical-print photos** and an accepted
   retained result. Do not weaken the production photo gate.
5. With explicit action-time authorization, save Thingiverse draft `7393174`
   once with the already selected category `129`, then re-read it. Do not
   re-upload merely to repair the isolated resize derivative.
6. Reopen MyMiniFactory and Thangs using their ModelPrep-authenticated sessions
   for independent rendered DOM/UI verification.
7. Recheck Cults automatic readback after normal Cloudflare clearance without
   creating another listing; distinguish CDN processing from missing media.
8. Use real physical-print photos for the next MakerWorld and MakerRoad
   certification. Do not weaken production photo validation.
9. Re-run one platform at a time after each fix. Verify visible thumbnails,
   model files, profile roles, description structure, category, tags, licence,
   visibility and every selected option against the retained edit UI and DOM.
10. Treat public, paid, remix, video, specialist and account-gated branches as
   separate certification work requiring truthful fixtures and action-time
   authorization.
11. MakerOnline's bundled demo 3MF is intentionally raw-only because it is
   unsliced. Dual-role coverage requires a genuine sliced 3MF and a newly
   authorized draft attempt. MakerRoad's profile-file branch remains
   uncertified.

## Safety and retained artifacts

Do not retry the Cults creation or MakerRoad save from this run. Do not delete,
publish or otherwise modify any retained object without explicit authorization.
The working tree intentionally contains a large uncommitted platform-audit and
implementation set; preserve it exactly and inspect `git status --short` before
working.
