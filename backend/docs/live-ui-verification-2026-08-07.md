# Live platform-UI verification, 2026-08-07

> **2026-08-08 follow-up:** a new authorized exact-package private/draft batch
> and retained-result inspection is documented in
> `demo-upload-live-verification-2026-08-08.md`. It supersedes retained-result
> claims here where ids differ and proves the demo geometry itself is unrelated
> to its dragon listing metadata.

> **Fixes applied the same day (2026-08-07), after this verification ran.** See
> "Fixes applied" at the end of this file. Findings below describe the state
> BEFORE those fixes; the retained platform artifacts still show the pre-fix
> state until a new authorized upload run replaces them.

Real-browser verification of ModelPrep's actual uploads, performed in the user's
signed-in Chrome (Claude in Chrome), one platform at a time, strictly read-only.
Nine of ten platforms verified; MakerOnline was blocked (no Chrome session, its
login lives only in ModelPrep's Electron partition). This document records what
the live platform UIs actually show, as a companion to the code audit in
`platform-audit-2026-08-07.md`.

Verified accounts: Nexprint U0037149840, Creality user8155669516, MakerRoad
iamdjem, MyMiniFactory iamdjem, Printables iamdjem (3163385), Thingiverse
iamdjem, Cults3D chefalicious, Thangs iamdjem, MakerWorld @iamdjem.

## Urgent, user decision required

1. **Nexprint has a LIVE PUBLIC model**: `https://www.nexprint.com/en/models/G9526987`,
   "Articulating Desk Dragon — Print-in-Place", released 2026-08-07, category
   Tools > Parts, 6 views, **2 downloads by real users**. Its 3MF is the real
   bundled demo, but `desk-dragon-S.stl` and `desk-dragon-M.stl` are the 1.46 KB
   placeholder text blobs: the public has downloaded unprintable junk. Nothing
   was touched; unpublish/delete needs explicit user authority.
2. **Printables public model 1797774 is GONE** (404 even authenticated as owner;
   `print(id)` returns null). Docs say it "must remain public pending deletion
   confirmation"; it was already gone before this verification, possibly removed
   by moderation. Nothing from ModelPrep is publicly visible on Printables now.
3. **Printables public profile bio** contains the text "Free my models
   b5925eb181", publicly visible. Origin unknown; worth confirming who wrote it.
4. **MakerRoad rejected all seven "private" saves.** A private Save still enters
   platform review; every draft sits under Drafts > Rejected Models with
   "This model does not match the cover image" / "cover is not a real photo"
   (the AI-render covers). The docs' "live-certified private draft M2134222528"
   claim does not match the platform's actual state.
5. **MakerWorld has a real "no real life photo" rejection in the wild**: failed
   draft 9053156 (2026-08-01) shows exactly the resultType-6401 banner the audit
   predicted. Nuance: an identical gallery published fine the same day
   (3121670) and again today (3143310), so the check is nondeterministic;
   the missing `{isRealLifePhoto,name}` fields are a risk factor, not a proven
   deterministic cause.

Everything else on every platform is private/secret/unpublished; no other
accidental exposure was found.

## Cross-platform confirmations

### The single-newline paragraph collapse is live on SIX platforms (X1+)
The fixture's four-line block ("Layer height / Infill / Supports / Wall loops")
renders as ONE run-on paragraph on: Nexprint, Creality, MakerRoad,
MyMiniFactory, Printables, and **MakerWorld** (new finding: the separate
`mdToMakerWorldHtml` converter merges single newlines too, so the audit's
mdToHtml fix list should include it). Cults renders it correctly (native
Markdown, four lines). Thangs renders it correctly on the post-fix upload
(Markdown sent as-is). Thingiverse is worse, see below.

### Placeholder junk STLs are everywhere
`desk-dragon-S.stl` / `desk-dragon-M.stl` (~1.46 KB text blobs; "0 MB" on
MakerRoad, "2 KB" on MakerWorld) are present in essentially every retained
fixture on every platform, including the certified receipts, and were publicly
downloadable on Nexprint. Thingiverse additionally shows their auto-generated
renders as generic blue-cube gallery images. The demo `mkFile` blobs claim
4.18/7.64 MB in-app while being ~45 bytes to 1.5 KB on the wire.

### A run earlier today (2026-08-07) created new items on six platforms
Colon-variant title "Articulating Desk Dragon: Print-in-Place": Nexprint draft
2085653022910320640 (2 STLs, NO 3mf, still-collapsed description), Printables
draft 1802385 (10 images, only junk STLs, P4-stripped summary), Thingiverse
draft 7392725, MyMiniFactory object 831357 (Under Review, corrected 180-300 min
print time), Thangs 1585793 (post-fix Markdown works), MakerWorld private model
3143310 (with print profile). Plus the accidental Nexprint PUBLIC G9526987.
Cults got nothing (no post-FormData-fix run has executed there). None of these
are documented anywhere; the handoff docs are stale.

### Fixture/doc drift
Older fixtures use an em-dash title, today's use a colon. Retained-evidence
lists are wrong in several places: MMF objects 828462/829039/829043/829056 are
DELETED from the platform (829284's remix parent now dangles at deleted
829056); Printables 1797774 is gone; MakerRoad has 7 drafts where docs record 2;
Printables has 19 drafts where docs record ~9; Nexprint has 13 drafts;
Creality has ~8 undocumented duplicate private dragons; Thingiverse has 4
undocumented drafts; Thangs has 7 pre-fix duplicates.

## Per-platform verdicts (gaps only; everything not listed rendered correctly)

### Nexprint (draft 2083625532272496640) — mostly OK, two gaps
- **2026-08-08 continuation:** signed-in blank/retained forms still expose the
  core, but current attachment help omits `.gcode`/`.goo`, the retained 3MF has
  no visible profile section, and the rich editor exposes unmapped media/table
  tools. Current receipt logic checks only object presence and optional state.
- Print-settings paragraph collapse (X1) live.
- 3MF print profile never sent (`settingList: []`, nexprint-direct.js:217):
  public page shows "Print Profile(0)"; the platform supports it (a 07-31
  browser draft has one). Description meanwhile promises the profile.
- Correct: title, category, originality, NSFW off, cover 4:3, 9 ordered
  gallery photos, 3 files, 8 tags, BOM (PLA/1/Any color), CC BY-NC, no
  AI-generated tag. Platform has no video field and no price/AI checkbox.

### Creality Cloud (private 6a6e3f28753b84f6aab190a8) — three gaps
- **2026-08-08 continuation:** the signed-in full blank form reconfirms the
  structured source, Boost Me, instruction, and parsed-3MF media/description/
  printer branches. ModelPrep does not send those branches and its receipt
  checks only a small optional subset.
- **Every .3mf silently dropped** (audit C1 confirmed): only the 2 junk STLs
  are listed; description still advertises the Bambu profile.
- X1 collapse live.
- Missing features never populated: BOM section (fixture even carries BOM data
  used for Nexprint), Instruction Files, per-file 60-char notes, Boost Me.
- Doc corrections: paid Free/Paid radios are now visible and enabled (doc said
  hidden/disabled); tags display with hyphens turned into spaces; no UI
  evidence of any 2048 MB cap (supports X4 "invented").
- All 12 account models are private.

### MakerOnline — unblocked 2026-08-08; core visible, receipt incomplete
Normal Chrome is now signed in as `iamdjem`. The blank create form and its
Remix, licence, Creative Kit, NSFW, printing-method and eligibility branches
match the detailed flow map. No upload or save occurred.

Retained draft 316221 shows 20 images, the expected category/title/description/
tags/licence, and three raw files including the bundled 3MF, but Print Profile
Files remains 0. The account has eight retained drafts. This proves the ordinary
retained core, not documentation or parsed-profile transport.

New gaps: ModelPrep cannot author the native editor's inline description images,
and its `verified` receipt compares only optional title/category plus minimum
image/raw-file counts. It does not fail closed when those fields are absent and
does not verify order/cover, filenames, description, tags, licence, permission,
draft state, print method, AI/NSFW, docs, kits/sync/Exclusive, or profile fields.
Exclusive is account-ineligible and additionally requires actual print photos
and applicable assembly instructions. Optional branches remain unverified.

### MakerRoad (M2134222528 + 6 siblings) — worst case, "verified" was false
- **2026-08-08 continuation:** normal Chrome is signed out, so no fresh
  authenticated form claim is made. The local print-method/rejection fixes have
  no corrected live save, and most metadata/options remain outside readback.
- All 7 saves REJECTED by review (cover not a real photo / model does not match
  cover). Zero public exposure, zero downloads.
- **Required "Recommended Print Method" empty on every draft**: the server drops
  the English label `printType:'FDM'` (expects numeric ids). Publish would
  block on a required field.
- X1 collapse live. Headings survive fine (feared h1 mangling did not occur).
- M2134228873 (today-adjacent colon draft) is missing the 3MF profile role that
  its siblings have.
- Readback (title/visible/plan/payType/role counts only) certified all of the
  above as "verified": X6 confirmed with teeth.
- Never populated: Compatible Printers, Recommended Materials/Brand/Type,
  Color, Instructions documents.

### MyMiniFactory (829284 + new 831357) — gaps plus stale docs
- X1 collapse live on both objects.
- **Cover-crop lie**: app previews a 1920x1440 4:3 crop, but MMF stores the
  uncropped 2400x1600 original (downscaled only). The user approves a crop the
  platform never receives.
- mdToHtml's `<h1>/<h2>` persist in TinyMCE but MMF's toolbar cannot produce
  or properly render them (h1 flattens to plain grey text).
- 60x print-time bug still live on 829284 ("Time to do 3 - 5 minutes");
  831357 proves the fixture fix ("180 - 300 minutes").
- X7 harmless today: computed 0/1 declarations did not persist; license_id
  authoritative. AI flag is create-only (not on edit form, nothing rendered).
- MMF "private" is link-shareable per the platform's own banner, not fully
  hidden. 831357 is "Under Review" even though private.
- Account reality: only 2 objects exist; 828462/829039/829043/829056 deleted.

### Printables (specialist draft 1797772) — solid transport, three gaps
- P4 summary hyphen-stripping confirmed live ("A print in place articulated
  desk dragon", also in today's 1802385, so the bug is in the current build).
- X1 collapse live in the stored HTML.
- **G-code uploaded but invisible in Printables' own edit UI** (present via
  GraphQL with weight/layer/nozzle/duration; Print Files section renders only
  the SL1 row, most plausibly because `printer` is null and rows group by
  printer). The user cannot see, edit, or delete it from the platform.
- Headings survive in stored HTML but Printables' Tiptap editor loads them as
  plain paragraphs: a platform-side re-save would destroy them.
- Never populated: required "Main 3D printer" dropdown (would likely block a
  publish that includes print files), per-G-code material, rich-description
  media/tables/embeds.
- Eleven ordered images incl. HEIC-derived JPEG verified perfect; files,
  category, license, tags, No-AI, NSFW/political flags all correct.

### Thingiverse (draft 7390480) — flagship content gap
- **The entire long description is dropped**: the Thing's whole body is the
  one-line summary. Thingiverse has no separate description field (body =
  summary, Markdown-capable), so X1 is moot: nothing multi-line ever arrives.
- The sent print-settings details part does not persist ("Add Print Settings"
  pristine); bare custom/tips/design parts are silently ignored.
- X7 `included_apps:[1127]`: no visible UI effect; Customizer stays
  SCAD-gated and absent from the Apps tab; apps shown appear file-type-driven.
- All 7 Things unpublished; blue-cube junk renders in every gallery.
- Everything else exact: title, 8 tags, category 124, CC BY-NC, 12 ordered
  images, all four flags unchecked.

### Cults3D (secret 6f02ba…, design 4734430) — best in class
- Native Markdown renders perfectly, including the four-line block.
- All 15 creations SECRET, profile leaks nothing, no "[object FormData]"
  artifacts anywhere. Today's run created nothing (pre-fix uploads failed
  before creation; no post-fix run has happened).
- Never populated: `creation[details]` (dedicated print-settings field),
  subcategories (0 of 91), meta tags (0 of 12, though `articulated` and
  `print_in_place` exactly match), non-3dp usages, typed MP4/WebM video.
- License vocabulary confirmed: no `cults_pu` option exists, so the audit's
  predicted 422 on that fallback is real if the path runs.

### Thangs (post-fix 1585793 + 7 older) — Markdown fixed, two live gaps
- Markdown description fix VERIFIED working on today's upload (headings,
  bullets, four separate print-settings lines). The 7 older uploads still show
  literal `<h1>`/`<p>` tags (stale platform copies of the pre-fix bug).
- **LIVE GAP: photos still land under "Attachments", the Images gallery is
  empty on every model including post-fix**, so no cover/card crop can apply.
  The presign-route fix did not change classification; root cause still open.
- **LIVE GAP: model files are not associated in the edit UI** (empty Model
  section, size "-" in All Files, owner's "Preview model page" and workspace
  404) while a web-uploaded control file lists correctly.
- All 11 items private; no NSFW control exists on Thangs; AI toggle shows OFF
  everywhere (verify intended fixture value against the new isAiGenerated
  field with one readback).
- Never populated: print compatibility checkboxes, video links, remix
  attribution, folders.

### MakerWorld (3143310 today, 3121670, drafts) — good, two findings
- **mdToMakerWorldHtml also merges the four-line block into one paragraph**
  (new: the audit's X1 fix list must include this converter).
- The "no real life photo" rejection exists in the wild (failed draft 9053156)
  with identical content to items that passed: nondeterministic platform check,
  `{isRealLifePhoto,name,url}` mapper fix remains the cheap mitigation.
- Everything else verified correct: h1→h2/h2→h3 remap, both covers, 9/16
  gallery, print profile with printer-compat chips on the 3mf path, category,
  8 tags, CC BY-NC radios, Private everywhere (no accidental public among 37
  published models), video/BOM/documentation/exclusive left empty as expected.
- The Model Information step exposes NO AI and NO NSFW control at all, so the
  hardcoded `isAIGC:false` / never-sent nsfw have no UI counterpart there
  (API-level only). Two orphan untitled June profile drafts (8561049, 8536755)
  are cleanup candidates.

## Suggested fix priorities from live evidence

1. Decide Nexprint G9526987 (public junk, real downloads): unpublish/delete
   with user authority; then find how `open`/`firstCommitPublish` went public.
2. Fix the single-newline collapse in BOTH `mdToHtml` and `mdToMakerWorldHtml`
   (six platforms visibly affected).
3. Thangs image classification + file association (two live gaps that survive
   the recent fixes).
4. Thingiverse description strategy: put the real description (Markdown) into
   the body/summary field instead of dropping it.
5. MakerRoad printType numeric ids + readback of state/printType/descBody
   (rejected-in-review must never report "verified"); same X6 hardening for
   MMF (description+tags) and Printables (summary already covered by P4 fix).
6. Creality/Nexprint 3MF profile transport (silently dropped / never sent).
7. Replace the demo placeholder STL blobs with small REAL printable STLs so
   fixtures stop planting junk on live platforms.
8. MMF cover: stop showing the user a 4:3 crop that is never uploaded.
9. Printables: send `printer` (or a "Main 3D printer") with G-code so it is
   visible/editable on-platform.
10. MakerOnline: sign in once in Chrome, then run the same verification.

## Fixes applied, 2026-08-07 (same session, all tests green)

Code fixes landed for every code-fixable finding above. Nothing was published,
unpublished, or deleted on any platform; the retained artifacts still show the
pre-fix state.

1. `deploy/src/lib/format.js`: single newlines now render as `<br>` in BOTH
   `mdToHtml` and `mdToMakerWorldHtml` (the six-platform run-on-paragraph
   collapse); `mdToHtml` gained ordered lists, blockquotes, strikethrough,
   image-syntax de-mangling, `#{1,6}` headings with a per-platform
   `maxHeading` ceiling; MakerWorld headings clamp to the documented h2-h4.
2. Thingiverse (`desktop/thingiverse-direct.js`): the full Markdown description
   now rides in the Thing body after the summary line; bare
   `tips`/`design`/`custom` filler parts dropped; `included_apps` default `[1127]`
   removed; settings part sent only when print settings exist.
3. Thangs (`desktop/thangs-direct.js`): rebuilt to the first-party v4 contract
   read from the live bundle (`updateModelDetailsRequestFromState`): photos in
   `images`, non-image references in `attachments`, `visibility` string instead
   of the ignored `isPublic`, parts associated via `POST v4/models/validate-files`
   after create plus `partNames`/`primaryPart` from `GET v4/models/{id}`.
   `thangs-web-flow.md` updated; needs one authorized private upload to certify.
4. Creality: `.3mf` files are no longer silently dropped
   (`crealityRawModelFiles`), and the preflight warning now tells the truth.
5. Nexprint: gallery photos keep original aspect in the ZIP path
   (`preserveGalleryImages`), expired sessions raise a typed reconnect error
   instead of raw Chinese, attachments honour exclusions, and preflight now
   states that print-profile blocks (settingList) are not transmitted. The
   settingList vocabulary is still uncaptured; do not invent it.
6. MakerRoad: print methods resolve to live `printerType` catalog ids before
   submit (English labels were dropped server-side); readback now fails on
   status-looking fields, a lost description, or a lost printType, so a
   review-rejected save can no longer report "verified".
7. MyMiniFactory: `parseEditPage` returns description and tags and the readback
   compares them; the three licence flags are submitted empty like the native
   form; the cover is no longer shown as a 4:3 crop the platform never receives
   (uploads were always uncropped, max 2400px); the 5 MiB image cap moved into
   preflight; `maxImages || 20` no longer drops images 21+.
8. MakerWorld: `designPictures` items now carry
   `{isRealLifePhoto, name, url}` (both builders); laser-cut no longer sends the
   duplicate portrait crop and warns that description/category are discarded;
   `.3mf` cap corrected 150→200 MiB, `.lac` 200→100 MiB, invented raw/aggregate
   caps removed; `isAIGC` and `nsfw` are now real per-model controls
   (MakerWorldOptions) instead of hardcoded declarations.
9. Printables: hand-typed summaries ship verbatim (P4 hyphen-stripping fixed);
   `me.tiers { id name }` is queried so Club can activate; preflight warns that
   G-code without a printer is invisible in Printables' editor; invented 5-150
   price bounds relaxed to positive-whole-dollar with server-side bounds.
10. Cross-cutting: shared `projectHasVideo(project.media)` powers video
    warnings on Nexprint/Creality/MakerRoad/MakerOnline/Thingiverse (the old
    `project.files` checks were dead code); MakerOnline documentation honours
    exclusions and can no longer duplicate gallery photos, its invented
    1600x1200 crop is gone, and the `print_desc` fallback clamps to 1,000
    chars; Cults gained tag-count/keyword-chars/price/8000px preflight caps.
11. Demo fixture: the placeholder text-blob STLs are replaced by real,
    watertight, printable binary STLs with honest sizes
    (`deploy/src/lib/demo-stl.js`).

Still open (not code-fixable from here):
- Nexprint PUBLIC model G9526987 takedown: needs the user's explicit decision.
- Nexprint `settingList` and MakerRoad review-state field names: need one
  captured first-party request/response each.
- MakerOnline live verification: needs a Chrome sign-in to makeronline.com.
- Thangs v4 fix, MakerWorld designPictures fix, MMF empty-flag change and the
  Thingiverse body fix: all await one authorized private/draft upload run for
  live certification.
- Printables public profile bio text "Free my models b5925eb181": user to review.

## Follow-up upload-flow audit, 2026-08-08 — MakerWorld

This follow-up inspected the current signed-in MakerWorld create pages, retained
3MF draft `9053658`, live category picker, server-provided draft data, and the
current Next.js serializers in Chrome. It was strictly read-only: no file was
selected or transmitted and no draft was saved, submitted, published, or
deleted. The local worktree was not changed except for documentation.

### Verified current branches and safe core

- MakerWorld still has four outbound branches: raw 3D, Bambu Studio `.3mf`,
  raw Laser & Cut, and Bambu Suite `.lac`. Raw branches have two steps; profile
  branches have three. Original and Remix are available; Share is disabled for
  this account. `/my/models/import` is an inbound Printables/Thingiverse import
  and remains outside ModelPrep's outbound-publish scope.
- Regular 3D remains substantially mapped: per-file rename/folder/note/open-
  source controls; linked Laser model; separate 4:3 and 3:4 covers; one
  MP4/MOV up to 30 seconds; 16 ordered gallery images; title; tags; license;
  visibility; rich description; documentation; BOM; Exclusive; and separate
  model/print-profile state.
- All 70 bundled MakerWorld leaf categories exactly matched the current live
  category picker, including the 12 Generative 3D Model leaves.
- The retained 3MF draft confirms `instanceSetting.submitAsPrivate`, profile
  title/summary, and `auxiliaryPictures` with names and real-photo flags. It
  still contains the pre-fix collapsed print-settings paragraph, so the
  2026-08-07 line-break fix remains locally implemented but not live-certified.

### Newly confirmed gaps — do not call MakerWorld fully mapped

1. **Laser profile visibility is placed incorrectly.** The current Laser
   serializer has sibling `instanceSetting.submitAsPrivate`; ModelPrep puts
   `submitAsPrivate` inside `draft.instance`. Treat LAC profile privacy as
   unverified and potentially dropped until corrected and read back.
2. **Laser video is silently disabled.** The live Laser draft contract contains
   `designVideo` and an upload gate, while ModelPrep explicitly chooses no
   video whenever `isLC` is true.
3. **Laser BOM, assembly steps, and community post are omitted.** The current
   contract contains `design.boms`, `design.steps`, and
   `designSetting.postNeeded/postContent`; ModelPrep hides BOM/community controls
   for Laser, hardcodes BOM/steps empty, and hardcodes post off.
4. **CyberBrick is only partially exposed.** ModelPrep provides control,
   motion, main-controller, and MicroPython file inputs. The current route also
   validates framework, firmware version, creation protection, controller cover,
   and switch covers. The builder currently leaves most of these empty or uses
   fixed defaults.
5. **Laser picture metadata is unresolved.** The 2026-08-07 fix note above said
   both builders emit `{isRealLifePhoto,name,url}`, but the current Laser builder
   still emits `{url}`. Do not copy the 3D item shape into `design.pictures`
   without capturing the first-party LAC payload; record the contradiction and
   fail closed meanwhile.
6. **Laser profile description is not proven.** ModelPrep sends
   `instance.summary`, but the current default LAC instance shape does not
   expose that property. Capture the real step-3 request before claiming it.
7. **A1 compatibility is internally inconsistent.** Code sends `N2S`; the
   existing flow documentation records `N2`. Recapture the live compatibility
   response before selecting either as canonical.
8. **The platform card still displays an invented 250 MB aggregate cap.** Newer
   MakerWorld validation correctly treats raw-file/aggregate limits as unknown;
   the summary card still says 250 MB and must be reconciled.
9. MakerWorld's current Model Information UI exposes no AI or NSFW control.
   ModelPrep's toggles are API-level declarations and should be labelled as
   such rather than presented as visible-form parity.

### 2026-08-08 verdict and next safe slice

- **Regular 3D:** near-ready, but the line-break/image-shape changes still need
  one explicitly authorized private upload plus draft/live readback.
- **Laser & Cut / CyberBrick:** not ready for certification. Correct and test
  the serializer/UI gaps above before any account-backed LAC upload.
- No mutation is needed to continue locally: add payload tests for visibility,
  video, BOM/steps/post, and CyberBrick, then obtain one first-party LAC step-3
  request capture. Ask separately before transmitting a private 3MF or LAC.

## Follow-up upload-flow audit, 2026-08-08 — Printables

The next platform was inspected signed-in and read-only in Chrome: blank create
form, live category/license menus, Original/Remix/Reupload conditional state,
and retained specialist draft `1797772`. No upload, save, publish, or deletion
occurred.

- Safe core is mapped: Draft/Published, title, summary, dynamic category and
  license, tags, all authorship branches, required AI yes/no, NSFW, political
  content, ordered images, file buckets, folders, notes, and ZIP choice.
- The live accepted-extension list matches ModelPrep's current
  `PRINTABLES_FORMATS`. The current license menu includes CC, GPL/LGPL/BSD,
  Standard Digital File, OCL variants, and CERN OHL-S; ModelPrep correctly
  obtains selectable choices dynamically.
- Remix requires a source plus a rich-text differences field; reupload requires
  a source only. ModelPrep validates/resolves those branches, but no new live
  round trip was performed.
- The required live “Main 3D printer” field is still absent from ModelPrep and
  from its model payload. The retained draft again shows the SLA/SL1 print row
  but not the API-retained G-code. A warning is insufficient for complete
  G-code parity.
- Per-G-code material has no ModelPrep selector. Parsed material is forwarded
  only when already available, so this option is partial/unverified.
- Printables' editor supports rich images, tables, embeds, blockquotes, and code;
  ModelPrep only sends Markdown-derived HTML. Authenticated rich-content upload
  and platform-editor-safe heading behavior remain gaps.
- Store/Club controls are not rendered for this account. ModelPrep's capability-
  gated controls remain uncertified, and its “typically $5–$150” UI hint is not
  a verified platform bound.

Verdict: free original uploads without G-code or embedded rich media are
near-ready and historically live-proven. G-code is not fully mapped; Store/Club,
rich media, approval-gated publish, remix/reupload, and unpacked ZIP remain
separate live-certification branches.

## Follow-up upload-flow audit, 2026-08-08 — Thingiverse

The third platform in the one-at-a-time continuation was inspected signed-in
and read-only in Chrome. The normal Thing flow, Education Project flow, Remix,
all category labels, all licences, print settings, rich sections, design tools,
groups, and retained draft `7390480` were inspected without uploading, saving,
publishing, accepting terms, or deleting anything.

- All 80 live category labels and all 13 licences still match ModelPrep's
  snapshots. Core draft metadata, ordered files/media, AI/WIP/NSFW, Remix,
  SCAD-gated Customizer, licence, and draft/public separation are represented.
- The full-description correction in `desktop/thingiverse-direct.js` passes the
  eight direct-adapter tests but is not live-certified. Retained `7390480` still
  contains only the historical one-line body.
- ModelPrep's general Thingiverse link is incorrect: `/create` opens the profile
  of a user named `create`; the upload route is `/thing:0/edit`.
- Print-setting parity is partial. The live form also has printer brand, dynamic
  printer model, rafts, supports, filament brand/color/other material, and
  Markdown notes. ModelPrep exposes only printer/model, material, resolution,
  and infill.
- Post Printing, How I Designed This, and custom sections support ordered text,
  image, and video blocks. ModelPrep exposes raw JSON and has no matching detail-
  media upload/finalization path.
- Education Project supports grades, subjects, standards, nine lesson-content
  areas including Handouts & Assets, and rich text/image/video blocks. ModelPrep
  exposes raw JSON, lacks live selectors/builders/assets, and its default type
  list has no explicit Handouts & Assets entry.
- The current form exposes 68 design tools; ModelPrep exposes none. Group sharing
  is also absent (this account currently has no eligible groups).
- “Verified” is overstated: the renderer only checks that edit/files/images
  readback exists. It does not compare intended and persisted fields or order.

Verdict: the normal unpublished safe core is historically live-certified. The
description repair is local-only, and structured print settings, rich sections,
Education Project, design tools/groups, Remix/Customizer, public publish, and
field-by-field readback are not fully certified.

## Follow-up upload-flow audit, 2026-08-08 — Cults3D

The fourth platform was inspected signed-in and read-only in normal Chrome. The
blank create form, retained secret creation, and price editor were inspected
without uploading, saving, publishing, changing price, adding a discount,
accepting terms, deactivating, or deleting.

- The live form still exposes five usages, 10 top-level categories, up to three
  subcategories, 12 meta tags, up to 20 free tags, Markdown description,
  manufacturing instructions, ordered files/media, AI disclosure, and comments.
- Current visible file help lists 40 formats and omits `.rar`; visible media
  help lists JPG/PNG/WebP/WebM/MP4 and omits GIF. GIF remains bundle/local
  evidence only.
- The current CZK price page reports fixed 14–26,000 CZK and open 0–26,000 CZK,
  both step 0.01. It exposes all 14 documented licences, public/secret/offline,
  20% commission/80% revenue copy, and a separate discount flow.
- ModelPrep has no usage or subcategory selector and the direct request
  hardcodes only `3dp`. It has no open-price, currency, or discount UI; its
  renderer offers free or fixed USD only. Exact Cults category/licence choices
  are also hidden behind generic mapping/substitution.
- Readback is narrower than prior “metadata passed” language implied: it compares
  title, visibility, and ordered model/media IDs and filenames only. It does not
  compare description, instructions, taxonomy, tags, meta tags, AI/comments,
  price/currency, or licence.

Verdict: free/secret 3D-printing safe core remains historically certified, but
full option mapping and fail-closed verification are incomplete. Next safe
implementation slice is exact category/subcategory/usage selection, then
currency-aware fixed/open pricing, then complete metadata and price readback.

## Follow-up upload-flow audit, 2026-08-08 — MyMiniFactory

The fifth platform was audited read-only. Normal Chrome reached the current
MyMiniFactory login form rather than an authenticated uploader; the ModelPrep
desktop-managed account still reported connected as `iamdjem`. ModelPrep's
reachable UI/transport were therefore compared with the prior authenticated
form capture and current first-party Creator Portal documentation. No upload,
submit, save, terms acceptance, edit, or deletion occurred.

- Free-account safe core remains substantially mapped: files, ordered JPEG
  images/cover, title, HTML description, tags, live/snapshot category path,
  private/public, 15 licences, technology, material, dimensions/unit, print-time
  minutes, tips, support-free, remix parents, and original/no-AI declaration.
- Existing readback is unusually strong: it compares title, visibility,
  categories, description, tags, ordered images/cover, files, licence, advanced
  print values, support state, remix state, and parent IDs.
- Current first-party upload documentation exposes a premium **Sell STL Files**
  branch with price, purchase message, and post-purchase message. None exists in
  ModelPrep's MyMiniFactory UI, payload, parser, or readback.
- Archive Mode supports 25 archives around 5 GB each and no generated 3D viewer.
  ModelPrep always sends normal `fileMode=0`; it does not implement or expose
  the capability-gated archive branch.
- MyMiniFactory documents 500 MB per file for Premium Creators. ModelPrep
  hardcodes this free account's 100 MiB cap instead of reading account limits.
- Native remix selection searches for an existing object; ModelPrep takes raw
  IDs and cannot pre-validate them. Category-at-create remains undocumented
  divergence from the captured native flow.
- Public submit enters printability/software and human approval; acceptance is
  not live-publication proof. A genuine printed photo is recommended.

Verdict: the private free-account core and advanced metadata branch retain
strong historical certification, but MyMiniFactory is not comprehensively
mapped. The next safe implementation slice is capability discovery plus
premium file limits, Sell STL Files fields, and Archive Mode, followed by
readback for each. Public review still needs a genuine model and explicit
action-time authorization.

## Follow-up upload-flow audit, 2026-08-08 — Thangs

The sixth platform was inspected signed-in and read-only in Chrome. My Thangs,
Add new → Upload, and retained private editor `1585793` were inspected without
selecting a file, changing a value, saving, publishing, monetizing, or deleting.

- Audience has six modes; ModelPrep exposes only private/public plus generic
  paid, and its raw access/plan fields are dropped.
- Four print-compatibility flags, video embed URL, inspiration/remix attribution,
  and dynamic/addable licence selection are absent.
- Units, bulk/multipart/assembly, access type, plans, dependencies, version notes
  and feedback are phantom UI because the direct adapter drops them.
- `1585793` still shows empty Images, ten JPG Attachments and size `-`; the newer
  local v4 image/part correction has not been live-certified.
- “Verified” checks response presence, not intended/persisted equality.

Verdict: Thangs is not fully mapped or fail-closed verified. Implement exact
readback and remove/implement phantom controls before requesting one private
corrected-v4 certification upload.
