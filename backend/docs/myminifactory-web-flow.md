# MyMiniFactory direct desktop upload flow

Date captured: 2026-07-31; current-form refresh: 2026-08-02

## 2026-08-08 continuation audit and premium-branch correction

ModelPrep's packaged/development UI was inspected read-only with its managed
MyMiniFactory account still connected as `iamdjem`. The normal Chrome profile
was signed out, so this pass did **not** claim a fresh authenticated create-form
DOM capture and did not upload, submit, save, accept terms, or edit anything.
The reachable ModelPrep UI and transport were compared with the current
first-party Creator Portal guides:

- [How to upload an object](https://creator.myminifactory.com/how-to-upload-an-object)
- [Using Archive Mode to upload files](https://creator.myminifactory.com/using-archive-mode-to-upload-files)
- [The Store FAQ](https://creator.myminifactory.com/the-store-faq)

The safe core and advanced print/remix/licence mapping below remain strong, but
the prior “Comprehensively mapped” and “premium branches mapped” wording was too
broad. Current confirmed gaps are:

- **Sell STL Files is not implemented.** The first-party flow says the premium
  creator toggle reveals object price, purchase message, and post-purchase
  message. ModelPrep has no MyMiniFactory store toggle, price, or either message
  in its UI, request, parser, or readback.
- **Premium file limits are not capability-driven.** The official Store FAQ
  documents 500 MB per file for Premium Creators, while this account's captured
  form reports 100 MiB. ModelPrep hardcodes 100 MiB and never reads/exposes the
  premium limit, so a premium account would be rejected too early.
- **Archive/ZIP mode is documented but not mapped or implemented.** The official
  branch supports up to 25 archives at about 5 GB each and has no generated 3D
  viewer. ModelPrep always sends `fileMode=0`, `watermarkPdfs=false`, uses the
  normal presigned-file path, and exposes no archive mode or capability state.
- **Remix-parent UX remains partial.** The native form searches and selects a
  real parent; ModelPrep accepts raw comma-separated IDs and validates only that
  at least one ID is present, not that the object exists before upload.
- **Native category divergence remains risky.** ModelPrep requires and submits
  category IDs during create even though the captured native create form had no
  category control; the server historically accepted this, but it is
  undocumented create-time behavior and needs a future authorized recheck.
- **Public review remains action-gated.** The official approval documentation
  confirms a software check plus human review and recommends a real printed
  photo; a successful submit is not proof that the object is live.

Scan The World remains explicitly out of ModelPrep product scope per the user's
2026-08-04 decision. The unexplained `license_store` field remains deliberately
unmapped until MyMiniFactory documents its semantics. Neither should be folded
into the store-price gap by guessing.

ModelPrep uses MyMiniFactory's authenticated first-party web form because no current documented third-party object-upload API was found. The integration runs only in Electron. Cookies, the form CSRF token, and the per-upload folder name remain in the isolated `persist:myminifactory` partition and main process; the renderer stores only `desktop-managed-myminifactory-session-v1`.

MyMiniFactory's current default sign-in is passwordless: the creator enters an
email address and then a confirmation code. The resulting browser cookies are
the session; there is no password for ModelPrep to store. Validation and upload
requests must use Electron's partition-backed Chromium `session.fetch`. Node's
standalone HTTP stack receives Cloudflare 403 responses even when those cookies
are valid. After successful validation, ModelPrep mirrors the cookie set and
matching user agent into Electron `safeStorage` as a mode-0600 encrypted fallback.

## Captured contract

1. `GET /upload/object` validates the account and supplies `uniqFolderName` plus `threedobject_temp_type[_token]`.
2. Images use multipart `POST /upload/files-upload` with `uniqFolderName`, `fileType=1`, and `fileToUpload`.
3. Object files use `POST /upload/presigned-url`, a direct `PUT`, then `POST /upload/presigned-url/complete`.
4. `POST /upload/object` submits URL-encoded metadata, ordered image records, completed file UUIDs, license flags, visibility, advanced print fields, and the CSRF token. Required categories use `categories=<JSON array of integer ids>`.
5. In Electron's managed Chromium session, ModelPrep follows the submit redirect
   and recovers the final object URL from `response.url`, then reads its title
   back before reporting success. `redirect: manual` is not usable here because
   Electron cancels that redirect before exposing its headers.

## Current limits and choices

- Free-account object file limit observed in the signed-in form: 100 MiB per file and 500 object files.
- Object images: jpg/jpeg/png/gif, 5 MiB each. ModelPrep normalizes gallery images to JPEG before transfer.
- Tags: 20 maximum; leading `#` is removed.
- Visibility: Private (`0`) or Public (`2`). ModelPrep defaults to Private.
- Units: mm, cm, or in. Technologies: FDM, DLP/SLA, or SLS.
- All 15 license values exposed by the form are mapped, including Creative Commons and MyMiniFactory commercial/exclusive variants.
- Advanced fields include printing tips, time range (**in minutes** — see the 2026-08-03 visual pass), dimensions, technology, material quantity, support-free, and remix parent object IDs.

### Current signed-in form refresh — 2026-08-02

Read-only inspection of `/upload/object` and retained private editor
`/object/edit/829056` confirmed the same two POST forms and upload endpoints.
The current upload bundle is `upload.d84d0147.js` (SHA-256
`27966af62fa5c06867a5d5da724d514999dbda879ff6d20b7116fdaac193a8d7`).
The native blank form currently selects **Public** (`2`), so ModelPrep's explicit
Private (`0`) default remains an essential safety override.

- Dimensions has `maxlength=100`; material quantity has `maxlength=45`.
- The native current form exposes mm/cm/in and FDM/DLP-SLA/SLS exactly as
  ModelPrep does. It exposes 15 license values, the original/no-AI declaration,
  remix-parent lookup, and Scan The World fields. Scan The World sits inside the
  collapsed Advanced Settings accordion and is available to this account; it is
  not mapped by scope decision, not by gating (corrected 2026-08-03).
- Retained private object `829056` read back categories `[60,462]`, license `5`,
  printing tips, time `3–5` (minutes, not hours), dimensions, unit `0`, FDM, material `45 g`, and
  server value `support_free=1`, in addition to the already-certified title,
  visibility, ordered image and object-file evidence.
- ModelPrep now validates the two observed character limits before authentication
  and fails closed when requested advanced print/license/remix values differ in
  canonical edit readback. The current hydrated editor uses checked
  `remix-checkbox` (rather than the older submitted `threedobject_type[remix]`),
  and the parser now accepts both forms.
- Authorized exact-package test object `829284` was created and retained as
  **Private** on 2026-08-02. The original package correctly failed closed on the
  old remix-control parser; independent signed-in editor readback verified its
  title, private state, categories, 10 images, 3 files, print values, remix
  parent `829056`, and CC BY-NC-SA license.

## 2026-08-03 exact-package re-read of `829284` and the defects it exposed

The corrected exact package re-read retained Private object `829284` **read-only**
and the receipt now succeeds:

> Existing private MyMiniFactory object 829284 re-read and verified.
> private · 10 images · 3 files · categories 60/462 · remix of 829056

No object was created, edited, or deleted; the run issues `GET` requests only.
The advanced print/license/remix branch is therefore **exact-app live-certified**.

Reaching that receipt required fixing three real defects. None of them were
visible from the certified upload path, because that path only ever re-reads the
canonical slug URL that `submit` returns:

1. **Redirect cancellation.** An existing object is addressed as
   `/object/<id>`, which MyMiniFactory 302s to its canonical slug. `status()`
   requested it with `redirect: 'manual'`, and Electron cancels a manual
   redirect with `ERR_ABORTED`, so every re-read failed with
   `Redirect was cancelled`. `status()` now follows the redirect in the managed
   Chromium session exactly as `submit` does, and reports the canonical URL.
   `objectIdFromUrl` now also accepts the bare numeric `/object/<digits>` form.
2. **Boolean-attribute parsing.** The current editor emits **three different
   boolean-attribute styles in one document**, and the parser only handled two:

   | Control | Raw markup | Previously parsed |
   |---|---|---|
   | `license_id` | `selected=""` | **no — read back as null** |
   | `threedobject_type[visibility]`, `[technology]`, `[dimensionsUnit]` | `selected="selected"` | yes |
   | `remix-checkbox` | bare `checked` | yes |

   The old regex required a bare attribute or `selected="selected"`, so
   `selected=""` never matched and **license never read back at all**. Per the
   HTML specification a boolean attribute is true whenever present, whatever its
   value; `hasBooleanAttribute` now implements that for `selected` and `checked`
   while still rejecting `data-selected`/`unselected`.
3. **Collapsed Dimensions control.** `.mp-input` hard-sets `width: 100%`, which
   outranks the `w-20` utility in the cascade and squeezed the Dimensions text
   field to roughly 19 px in the packaged app — the value was present but
   invisible and unusable. That row now uses inline flex sizing.

`threedobject_type[support_free]` is **not** a checkbox on the edit page: the
current editor renders a single hidden input carrying the persisted value, so
`matchValue(...) === '1'` is the correct read. This was verified read-only
against the live page and is now covered by a fixture.

Do not invoke the batch retry control for a MyMiniFactory receipt failure: it
re-enters the create flow and could duplicate a retained Private object. Use the
read-only **Verify existing object** control instead.

## 2026-08-03 comprehensive signed-in create-surface audit

Read-only inspection of `/upload/object` while signed in as `iamdjem`. Current
uploader bundle `upload.d84d0147.js`, 824,245 bytes, SHA-256
`27966af62fa5c06867a5d5da724d514999dbda879ff6d20b7116fdaac193a8d7`
(unchanged from the 2026-08-02 fingerprint).

Authoritative limits, read from the server-rendered `UploadFilesWrapper`
React-on-Rails props rather than inferred:

| Value | Current setting | Evidence |
|---|---|---|
| `config.fileSizeLimit` | 104,857,600 bytes (100 MiB) per object file | current React props |
| `config.filesPerObject` | `"500"` | current React props |
| `config.archiveFileSizeLimit` | 5,368,710,000 bytes (~5 GB) | current React props |
| `config.archiveFilesPerObject` | 25 | current React props |
| `allowedFileExtensions` | 55 entries (`fbx` listed twice) | current React props |
| `api.file_upload_url` | `https://www.myminifactory.com/upload/files-upload` | current React props |
| `can_use_zip_mode` | **`false` for this account** | current React props |
| `isPremiumCreator` | **`false` for this account** | current React props |
| `file_mode` | `0` | current React props |
| Image size cap | `maxFileSize: 5*1024*1024` (5 MiB) | current inline uploader script |
| Image `fileType` | `1` | current inline uploader script |
| Image count cap | **none in the client** | absent from current DOM/bundle — UNKNOWN |
| Image extension allow-list | **none in the client** | absent from current DOM/bundle — server-side only |
| `primary_image` | radio keyed by uploaded filename | current inline uploader script |

Taxonomy and enumerations confirmed to match ModelPrep exactly: visibility
`Private=0` / `Public=2` (only two values), units `mm=0` / `cm=1` / `in=2`,
technology `''` / `FDM` / `DLP/SLA` / `SLS`, and all 15 license IDs
(`1`–`11`, `13`–`16`). Character limits `dimensions maxlength=100` and
`filament_quantity maxlength=45` are unchanged. `threedobject_temp_type[name]`
is `required` with **no** `maxlength`; description and tags expose no client cap.

Fields present in the current create form that ModelPrep does **not** map:

- **Scan The World** (`stw-checkbox` gate, then `stw_object_type[...]`):
  `title` (512), `url` (1024), `strDate` (255), `dimension` (255),
  `accession` (255), `period` (255), `medium` (512), `credit` (512),
  `stwartist` (1,895 options), `stwplace` (849 options) and `object_status`
  (`None`/`To Scan`/`Scanned`/`Under Review`/`Meshed`). This is a
  museum/heritage submission programme, not a generic object field.
- **`threedobject_temp_type[license_store]`** — a "License store" checkbox whose
  semantics and eligibility are not documented in the current form.

Both are deliberately left unmapped: forcing them into the shared schema would
misrepresent a heritage-scanning programme and an undocumented commercial flag.
They are recorded as *visible but unmapped*, not as absent.

## 2026-08-03 edit-page vs create-page control inventory

Server-rendered HTML for both pages was fetched and diffed, because that is what
the main-process adapter parses. The create form exposes **40** named fields, the
edit form **54**. They are not two views of one form:

- **Different field prefix.** Create submits `threedobject_temp_type[...]`; edit
  renders `threedobject_type[...]`. The adapter already writes one and reads the
  other.
- **Tags are renamed.** `threedobject_temp_type[tags]` on create becomes
  `threedObjectTags` on edit.
- **Paired visible control plus value carrier.** Edit renders both a visible
  checkbox and a separate persisted value:
  `support_free` (checkbox) alongside `threedobject_type[support_free]`
  (hidden, carries the value), and `remix-checkbox` (checkbox) alongside
  `threedObjectRemixParents` (text). Read the carrier, not the checkbox, except
  for remix where the checkbox is the state and the carrier holds the parents.
- **`categories` and `threedUploadedFileUuids` do not exist on the edit form.**
  Categories come from the `UploadCategories` React payload and object files
  from `UploadFilesWrapper`; both are already handled.
- **Gallery rows are explicit.** Edit renders
  `threedobject_type[images][N][fileName]`, `[uploadedBy]` and **`[position]`**,
  plus one `primary_image` radio per image, and a
  `threedobject_images_block_changed` dirty flag. Retained object `829284`
  renders 10 rows with `position` `0`–`9`.
- Create-only: `fileMode`, `watermarkPdfs`, `uploadedfiles[]`,
  `uploadedImagesPersistJson`, the whole Scan The World block and
  `stw-checkbox`.

Two gaps this inventory exposed, both now fixed:

1. **Gallery order came from the array index, not `position`.** The two agree on
   `829284`, so nothing was wrong in practice, but `position` is the value the
   platform persists for ordering and an index sort would silently compare the
   wrong sequence after a reorder. Readback now sorts by `position` when every
   row carries one and falls back to the array index otherwise, reporting which
   was used as `imageOrderSource`.
2. **`primary_image` was submitted but never read back.** The edit page marks the
   persisted cover with a checked radio. Readback now returns `primaryImage`,
   and the read-only verification fails closed when it is not the first ordered
   image. It is enforced only when the page reports a primary, and the certified
   upload path is deliberately unchanged so its existing certification still
   holds.

Re-certified against `829284` from the exact package on 2026-08-03:

> private · 10 images (ordered by position, cover
> cover-desk-dragon-wide-workshop-hero.jpg) · 3 files · categories 60/462 ·
> remix of 829056

## 2026-08-03 interactive conditional-section pass

The earlier passes read server-rendered HTML and React props. That established
which controls exist, but **not** what is actually shown or what each control
reveals. Toggling the controls in the signed-in page (no submit at any point)
changed two conclusions.

**The create form is an accordion, not a flat form.** Only **7 of 40** named
fields are visible on load:

`fileToUpload[]`, `threedobject_temp_type[name]`,
`threedobject_temp_type[visibility]`, `threedobject_temp_type[not_ai]`,
`threedobject_temp_type[license_store]`, `#submit-upload`, plus the unrelated
newsletter `EMAIL`.

Everything else sits behind `p.advanced-settings-tool.closed` ("Advanced
Settings"), which is **closed by default** and wraps `div.advanced-settings`.
Expanding it takes the visible count to 17 and reveals the license select, print
tips, time, dimensions, unit, technology, material quantity, support-free, remix
and the Scan The World gate.

`tags`, `description` and `howto` carry `display:none` on the element itself:
each is driven by a widget (tokenizer / rich editor), so the raw control is
never the thing the creator interacts with.

Conditional reveals, measured by toggling:

| Control | Reveals | Notes |
|---|---|---|
| `threedobject_temp_type[remix]` | `query` | a **parent search autocomplete**, not a raw ID field |
| `stw-checkbox` | 12 `stw_object_type[...]` controls | inside Advanced Settings |
| `threedobject_temp_type[license_store]` | nothing | standalone flag |
| `threedobject_temp_type[support_free]` | nothing | standalone flag |

**Correction to an earlier entry in this document.** Scan The World was recorded
today as "present in DOM but not visible — hidden by an ancestor for this
account", implying an eligibility gate. That was wrong: `#stw-checkbox` is inside
the collapsed Advanced Settings accordion and becomes fully visible and enabled
once that accordion is opened. It is **available to this account**, not gated. It
remains deliberately unmapped because it is a museum/heritage submission
programme, which is a scope decision, not an availability one.

**License flags are not driven by the license select.** `no_derivatives`,
`non_commercial` and `exclusive` render as radio pairs that are **never visible
and never checked**, and changing `license_id` across ids 1/5/7/8/11/15 leaves
all three unset. The visible control is the `license_id` select alone, so the
native form submits those three names empty. ModelPrep always submits computed
`0`/`1` values for them from its own `licenseFlags` table. That table is
internally consistent with the platform's own license names (id 5 BY-NC-SA →
non-commercial only; 7 BY-NC-ND → non-commercial + no-derivatives; 10 Exclusive
Noremix Commercial → exclusive + no-derivatives; 15 MMF Noremix Commercial →
no-derivatives), and object `829284` read back `license_id 5` correctly, so the
extra fields are currently harmless. They are nevertheless a **deliberate
divergence from the native contract** and are recorded as such rather than
assumed safe.

**Not tested:** the `#showondrop` container is already `display:block` at
baseline and no fields were observed to be gated behind a file drop, but this was
not confirmed by actually uploading a file to the create form.

## 2026-08-03 visual pass on the rendered page — and the bug it caught

The DOM and interactive passes both worked from element names and attributes.
Actually **looking** at the signed-in page found something neither could.

### Print time is stored in MINUTES, not hours

The native control reads **“Time to print … in minutes”**, and retained object
`829284` renders on its object page as:

> Time to do **3 - 5 minutes** · Material Quantity 45 g · Dimensions 120 × 75 × 45

ModelPrep labelled this field **“Print time range (hours)”**. A creator entering
`3`–`5` meaning hours published `3`–`5` **minutes** — a 60× error on live data.

Every read-back check passed throughout, because the numbers round-trip
unchanged: ModelPrep sent `3`/`5` and read back `3`/`5`. **No read-back
assertion can catch a units mismatch** — only comparing the rendered meaning
against the platform's own label can. This is the strongest argument in the
repository for ending every platform audit with a visual pass.

Fixed: the label now reads “Print time range (minutes)” and the Real Upload Test
fixture now carries `180`–`300` (3–5 hours expressed correctly). Retained object
`829284` still holds `3`–`5` minutes on the platform; correcting it is an edit
and needs its own authorization.

### ModelPrep also fabricated a print-time range that was never entered

Found while verifying the units fix. ModelPrep defaulted `timeFrom: 0`,
`timeTo: 50` and hard-coded `Number(input.timeTo || 50)` in the submit, so any
object whose creator never touched the field published **"0 - 50 minutes"**. The
native form leaves those two inputs empty and MyMiniFactory then shows no print
time at all. Like the units bug, it read back unchanged (`0`/`50` in, `0`/`50`
out), so no assertion could catch it.

Fixed: empty now means unspecified end to end — empty default, empty-preserving
inputs with Min/Max placeholders, and empty strings submitted rather than a
substituted range. An unset range reads back as `0`/`0`, which the verification
already treats as equal.

### The native create form has no category control

`/upload/object` contains **no** `categories` field, no category select, and no
`UploadCategories` React component — that component appears only on
`/object/edit/<id>`. Categories are a post-creation concept in the native flow.

ModelPrep nonetheless submits `categories=<JSON array>` in the create POST, and
the server accepts and persists it (`829056` and `829284` both read back
`[60,462]`). This works, but it is **undocumented API surface the native create
flow never exercises**, so it deserves a re-check whenever the form changes.

### Other things only visible on the rendered page

- The file drop zone states **“Your file limit is 100.0 MB”**, confirming
  `config.fileSizeLimit` in the UI itself.
- **Visibility defaults to `Public`** on the blank native form. ModelPrep's
  forced Private default is a genuine safety override, not a cosmetic one.
- The License block is a React triad of Yes/No buttons — *allow remixes*,
  *allow commercial use*, *allow exclusive sharing* — above an “All available
  licenses” select and a CC badge. For the default it shows remix **Yes**,
  commercial **No**, exclusive **No**, which is exactly BY-NC-SA (`5`).
  ModelPrep's `licenseFlags` table agrees with that semantic reading.
- Refining an earlier note in this document: the legacy
  `no_derivatives` / `non_commercial` / `exclusive` radio inputs really do stay
  unchecked, and programmatically changing `license_id` does not check them —
  but that is because the visible picker is React state that never mirrors into
  them, **not** because the picker fails to reflect the licence. The picker is
  visible and correct; the radios are vestigial and `license_id` is
  authoritative.
- `threedobject_temp_type[license_store]` renders **orphaned at the bottom-left,
  below Submit and outside the form card**, with no help text. It is inside the
  `<form>` and enabled, but its placement strongly suggests a vestigial or
  internal control. Still deliberately unmapped.
- Description and Printing tips are rich-text editors with a restricted toolbar
  (bold, italic, bullet list, numbered list, link only). ModelPrep sends HTML,
  which suits that subset.
- An “Open a Store … Choose your plan” upsell occupies the panel beside
  Visibility, consistent with `isPremiumCreator: false`.

## Coverage matrix — current as of 2026-08-03

| Surface / branch | Classification | Strongest evidence | Certification state |
|---|---|---|---|
| Passwordless isolated identity | implemented, connected | exact packaged Settings (10-account check) | connected only |
| Private create: images, model files, categories, core metadata | implemented and verified | retained exact-app object `829056` plus hydrated editor | **live-certified** |
| Advanced print values, license and remix fields | implemented and verified | exact-package read-only receipt for `829284` on 2026-08-03 | **exact-app live-certified** |
| Fabricated default print time | **was wrong, now fixed** | native leaves the range empty; ModelPrep substituted 0-50 | any object that never set a print time published "0 - 50 minutes"; empty is now preserved end to end |
| Print time range units | **was wrong, now fixed** | native label "in minutes"; object page renders "Time to do 3 - 5 minutes" | ModelPrep said hours, publishing a 60x error that read back clean. Label and fixture corrected; retained `829284` still holds 3-5 minutes and needs an authorized edit to correct |
| Categories at create time | **divergence from native flow** | create form has no category field or `UploadCategories` component | ModelPrep submits `categories` on create and the server accepts it; re-check whenever the form changes |
| Visibility default | mapped, safety-critical | native blank form defaults to **Public** | ModelPrep forces Private; this override is load-bearing |
| Advanced Settings accordion (closed by default, wraps 10 controls) | mapped | interactive toggle, 2026-08-03 | ModelPrep exposes these directly, so the accordion has no ModelPrep equivalent |
| Remix parent entry | mapped, **diverges from native UX** | interactive toggle, 2026-08-03 | native reveals a `query` search autocomplete; ModelPrep takes raw comma-separated IDs, so it cannot pre-validate that a parent exists |
| `no_derivatives` / `non_commercial` / `exclusive` radios | **deliberate divergence** | interactive toggle + visual pass, 2026-08-03 | the visible picker is a React Yes/No triad that correctly shows the licence; these legacy radios stay unchecked and are not mirrored from it, so a native submit sends them empty while ModelPrep always sends computed 0/1. `license_id` is authoritative. Harmless today — `829284` read back `license_id 5` |
| File-drop staging (`#showondrop`) | **untested** | container is `display:block` at baseline | confirming nothing is gated on file drop requires uploading a file to the create form |
| Remix with parent objects | implemented and verified | same receipt: `remix of 829056` | **exact-app live-certified** |
| Read-only re-read of an existing object | implemented and verified | new `Verify existing object` control; GET-only; desktop + renderer tests | **exact-app live-certified** |
| License readback (`selected=""`) | implemented and verified | live raw edit HTML; `hasBooleanAttribute`; regression fixture | **exact-app live-certified** via `829284` |
| Object-file limits: 100 MiB/file, 500 files | mapped and enforced, extremes **manually deferred by the user** | current `UploadFilesWrapper` React props | contract-proven from platform config; user elected on 2026-08-03 to skip exercising the extremes |
| 55 accepted model extensions | mapped | current React props | only `.stl`/`.3mf` exercised live |
| Image size 5 MiB, `fileType=1` | mapped and implemented | current inline uploader script | live-certified for 10 ordered images |
| Gallery order from persisted `position` | implemented and verified | edit-page inventory; `imageOrderSource: position` in the live receipt | **exact-app live-certified** |
| `primary_image` cover readback | implemented and verified | checked radio on edit page; live receipt names the cover | **exact-app live-certified** (read-only path; upload path unchanged) |
| Image count cap | **UNKNOWN** | absent from current DOM and bundle | must stay unknown; do not guess |
| Image extension allow-list | **UNKNOWN (server-side only)** | no client restriction in current DOM/bundle | ModelPrep normalizes to JPEG |
| Title / description / tag character caps | **UNKNOWN** | `name` is `required` with no `maxlength`; no client cap on description/tags | tags capped at 20 by earlier evidence |
| `dimensions` 100 chars, `filament_quantity` 45 chars | mapped and enforced | current `maxlength` attributes | validated before authentication |
| Visibility `Private=0` / `Public=2` | mapped | current select exposes exactly two values | Private live-certified; **Public action-gated** |
| Public review flow | mapped, **manually deferred by the user** | current DOM value `2` and submit control | user elected on 2026-08-03 to certify this only with a genuine model, never the test fixture; awaiting that model |
| Original/no-AI declaration | implemented | current required checkbox and desktop preflight | locally verified; alternative combinations action-gated |
| ZIP / archive mode (~5 GB, 25 archive files) | documented, **not implemented; account-gated** | `can_use_zip_mode: false` for this account plus current first-party Archive Mode guide | ModelPrep always sends normal `fileMode=0`; no archive UI/payload/readback |
| Premium creator file limit | documented, **not implemented dynamically** | `isPremiumCreator: false` here; current Store FAQ documents 500 MB per file for Premium | ModelPrep hardcodes this free account's 100 MiB cap |
| Sell STL Files: price, purchase message, post-purchase message | documented, **not implemented; account-gated** | current first-party upload guide | absent from ModelPrep UI/payload/readback |
| Scan The World (`stw-checkbox` + 12 `stw_object_type[...]` controls) | **available to this account**, deliberately unmapped | interactive toggle, 2026-08-03 | sits inside the collapsed Advanced Settings accordion; fully visible and enabled once opened. Not gated — unmapped is a scope decision (heritage-submission programme). **Product-scope decision confirmed by the user on 2026-08-04: Scan The World is out of ModelPrep scope; keep documented-only, do not serialize.** |
| `threedobject_temp_type[license_store]` | **offered and enabled**, deliberately unmapped | current signed-in form, 2026-08-03 | visible, enabled and unchecked for this account; the form states only the label “License store”, so its semantics are genuinely unknown and it is not mapped |
| Object deletion | not implemented | — | never attempted; requires explicit authority |

**Comprehensively mapped:** no. The free-account create/edit surface reachable
in the 2026-08-03 capture was classified, but current first-party documentation
confirms premium Sell STL Files and Archive Mode branches that ModelPrep does
not expose or serialize. Within the previously reachable free-account surface,
every control on `/upload/object` **and** `/object/edit/<id>` was
classified, the two forms are diffed field by field, and every control has been
interactively toggled to record what it reveals. The one untested conditional is
file-drop staging (`#showondrop`), which needs a file uploaded to the create
form to confirm.

Note on method: static DOM/props inspection alone was **not** sufficient. It
reported 40 create-form fields as though they were all presented together, when
only 7 are visible on load and the rest sit behind a closed accordion. It also
misclassified Scan The World as account-gated. Any future re-audit of this or
another platform must include an interactive pass, not just a DOM read.
**Fully certified:** no. Public/review, ZIP mode, premium/store branches, the
extension and count extremes, and the two unmapped surfaces all lack live
evidence, and two of them cannot be reached with this account at all.

## Categories

The authenticated edit form loads its current taxonomy from
`GET /api/store/categories`. The hidden submit field is `categories`, containing
a JSON array. A hierarchical selection includes every ID in the selected path;
for example Toys → Articulated is `[60,462]`. ModelPrep loads this endpoint live
when connected and keeps the following 2026-07-31 snapshot as an offline fallback:

- `1015` Tabletop
  - `617` Accessories; `1304` Anime & Manga; `1145` Busts; `1319` Full Color;
    `1325` Game Bundles; `1324` Storage; `1313` Trench Crusade;
    `786` Vehicles & Machines
  - `785` Characters & Creatures → `780` Fantasy Universe, `784` Historical
    Universe, `782` Sci-Fi Universe, `783` Thriller Universe
  - `787` Terrain → `1153` Fantasy Terrain, `1158` Sci-Fi terrain
  - `1306` Wargaming → `1311` Fantasy, `1312` Historical, `1310` Sci-fi
- `1303` PDF Only → `1323` Maps, `1322` Painting Guides, `1320` RPG,
  `1321` Wargames
- `60` Toys → `462` Articulated, `1309` Cuties, `1308` Marbles,
  `1307` Mechanical Marvels, `100` Puzzles & Games, `529` Scaled Models
- `57` Home & Decor
  - `150` Garden & Outdoors; `252` Workshop & Tools
  - `335` Home Decor → `389` Candle holders, `399` Clocks, `397` Fixtures,
    Fittings & Utilities, `372` Ornaments, `398` Picture Frames,
    `362` Vases, pots and planters
  - `149` Organizer & Storage → `377` Bookends & Bookmarks, `382` Pen Holders
- `120` RC Cars → `1282` Accessories Exterior, `1283` Accessories Interior,
  `1291` Accessories Spare Parts, `1274` Buggy, `1273` Crawler,
  `1292` Drag Racing, `1275` Drifting, `1276` Monster Truck, and scale classes
  `1278` 1:10, `1279` 1:14, `1280` 1:16, `1281` 1:24, `1299` 1:6,
  `1277` 1:8.

The live form also requires the creator to certify that the object and imagery are original, made without generative AI, and comply with MyMiniFactory's Terms and Conditions. ModelPrep exposes that declaration in Platforms and refuses upload until it is checked.

## Implementation

- `desktop/myminifactory-direct.js`: first-party request adapter, validation, upload transaction, submit, and read-back.
- `desktop/main.js`: encrypted isolated session, sign-in capture, discovery, request broker, and disconnect.
- `desktop/preload.js`: minimal renderer bridge.
- `deploy/src/lib/myminifactory-auth.js`: opaque desktop-session transport.
- `deploy/src/lib/myminifactory-upload.js`: file/image upload helper.
- `deploy/src/App.jsx`: metadata options, validation, connection UI, private/public flow, progress, and verified receipt.

## Certification boundary

Passwordless session capture is live-verified: the packaged app rediscovered
`iamdjem` after restart, displayed it as Connected/Active, and created the encrypted
fallback. The 2026-07-31 batch also created Private object `828462`; its edit form
proved that the original ModelPrep request left the required category array empty.
ModelPrep now requires a category path, submits its IDs, and reads them back from
`/object/edit/<id>` before reporting success. Public submission remains a separate
explicit action.

Read-only reinspection on 2026-08-01 confirmed that retained object `828462`
still has Private visibility (`0`), 16 ordered images with the first image marked
primary, three object files, and the original empty `categories=[]`. The current
upload form still presents the original/no-generative-AI/Terms declaration as an
unchecked required checkbox. ModelPrep's read-back now fails closed unless the
edit form returns the exact title and requested visibility, every selected
category ID, the exact ordered image-name list, and the exact object-file set.

The current raw edit response does not contain server-rendered download anchors
for object files. It stores them in the `UploadFilesWrapper` React-on-Rails JSON
payload (`files[].filename`); browser JavaScript creates the visible links during
hydration. The desktop adapter parses that payload directly and keeps anchor
parsing only as a compatibility fallback.

The final corrected readback passed the full desktop suite (now 92 tests), production
renderer build, signed packaged-app launch, and authorized private uploads on
2026-08-01. The latest exact-app object `829056` was saved and read back by
ModelPrep, then independently verified in the first-party hydrated editor:
private state, category IDs `60` and `462`, ten ordered images, title, tags, full
description, and files `desk-dragon-bambu.3mf`, `desk-dragon-M.stl`, and
`desk-dragon-S.stl`. Public review remains a separate explicit certification
branch.

An earlier submit returned HTTP 500 but the same fixture and four-way scheduler
later passed, so the failure is not evidence of a deterministic concurrency or
payload defect. The adapter now records sanitized status, response type/size,
path, trace id, and safe server error/title details without logging cookies,
CSRF values, signed URLs, upload UUIDs, or request payload values. Do not blindly
replay an ambiguous failed create; use the batch's failed-only retry after
reviewing whether MyMiniFactory may already have created an object.

## 2026-08-09 isolated-session owner re-read

The rebuilt exact package used ModelPrep's still-connected isolated account to
perform the dedicated **Verify existing object (read-only)** action for object
`831756`. The authenticated owner read succeeded without creating or editing
anything: visibility `private`, ten images ordered by retained `position`, cover
`cover-model-derived-render-of-the-34-mm-calibration-puck.jpg`, three files, and
category IDs `60/462`. This is fresh retained/API evidence displayed by the
packaged ModelPrep UI. It is not native MyMiniFactory hydrated-page DOM proof;
the normal Chrome profile remains signed out, so that distinct evidence level
is still blocked.
