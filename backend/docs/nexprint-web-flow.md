# Nexprint signed-in upload map and ModelPrep adapter

Audit date: **2026-07-31**
Entry point: <https://www.nexprint.com/en/upload>
Production build fingerprint: `1044bde5-7d0a-4a77-87e3-f5d36b9e4fb9`
Account state: signed in with a newly created ELEGOO/Nexprint account
Mutation boundary: the bundled demo 3MF and cover were uploaded, an unpublished
draft was saved, and that draft was reopened read-only; no public listing,
delete, or subsequent edit was completed

This is the dated source of truth for Nexprint's current upload page, option
tree, client validation, first-party request flow, and ModelPrep mapping.
Nexprint does not currently publish a documented third-party upload API.
ModelPrep therefore uses the same authenticated REST and presigned-storage
contract as Nexprint's production web client, from Electron main only.

Current certification update: the later exact packaged closeout created and
read back unpublished draft `2083625532272496640`, including models, images,
tags, BOM, taxonomy/license and draft state. The 2026-07-31 browser and Electron
drafts below remain valid earlier evidence. Public, activity eligibility,
broader extensions/attachments and high-count ordering remain separate.

That contract is **undocumented and changeable**. A passing unit test proves the
mapped contract, not that the current production account still accepts it.

## 2026-08-08 signed-in continuation audit

The blank upload page, Single/Batch switch, and retained draft
`2083625532272496640` were reopened read-only as `U0037149840`. No file was
selected and no item was changed.

- The visible model list still matches ModelPrep's 30 unique formats (the page
  prints `.fcstd` twice).
- The retained editor shows three raw files, Original, NSFW, cover, nine ordered
  photos, metadata, current events, rich description, eight tags, one BOM row,
  CC BY-NC, attachments, collection, and both final actions.
- Current attachment help omits `.gcode` and `.goo`, which ModelPrep still
  accepts. Treat both as drift-risk until staged upload or bundle evidence proves
  the current contract.
- The retained 3MF has no visible print-profile section. ModelPrep always sends
  `settingList: []`; parsed profile name, cover mode, plates and introduction are
  unimplemented.
- The live rich editor exposes image/media/table/code and other controls that
  ModelPrep cannot explicitly author or upload.

Receipt verification requires a readback object and checks only status when it
is present. It does not compare metadata, source, assets/order, description,
tags, NSFW, BOM, licence, collections, activities or print settings. `verified`
is therefore not a field-level persisted receipt.

## 2026-08-08 profile-selection slice — destination established, not assumed

The 3MF was absent from calibration draft `2086068343743848448` for the same
reason as on Printables: ModelPrep's automatic file selection unticks a profile
sliced by another vendor's slicer, and Nexprint's native slicer is Elegoo while
the fixture profile is Bambu. Nothing was mis-routed. But Nexprint's **semantics
are not Printables' semantics**, so the destination was established from
Nexprint's own contract rather than carried over.

### Where a `.3mf` actually belongs here

- **Model file, not attachment.** `.3mf` is in the model-extension list and is
  absent from the attachment list, and the submit places it in `modelFileList`.
- **Flagged, not plain.** The submit adds `fileExtension: { is3MF: true }` to
  that record, which an `.stl` does not carry.
- **Nexprint does have a real print-profile concept** — `settingList` on submit,
  `settingInfoList` on readback, plus profile name, plate previews, profile
  cover and a 1,000-character introduction. ModelPrep always sends
  `settingList: []`, so a retained 3MF is an ordinary model file and the listing
  shows `Print Profile (0)`.

This is the opposite shape from Printables, which has no profile concept at all.
Do not unify them.

### What the readback authoritatively exposes

Read-only re-inspection of retained draft `2086068343743848448` (2026-08-08, no
mutation) shows `model-base-info/getEditInfo` returning per model file:

```text
fileId  fileName  fileSize  fileUrl  fileExt  extra
isCreator  creator  createTime  thumbnailFileId  thumbnailFileUrl
msgDigest  multiViews
```

Both retained STLs came back at their exact source byte counts (36,084 and
54,084), so `fileSize` is an authoritative integrity signal. That draft holds
exactly the two STLs, no 3MF, `settingInfoList: []`, zero attachments, one
`coverImgFileId` and nine `modelPicList` entries — Nexprint splits the gallery
into one cover plus up to nine photos.

**`fileExtension` / `is3MF` is not echoed back.** The corresponding readback
field `extra` was `null`. The new checks therefore assert filename, count,
`fileSize` and `fileExt` only, and deliberately do not assert the `is3MF`
marker: there is no evidence it round-trips, and asserting it would fail closed
on an unproven contract.

### Implemented

1. `nexprintReadbackIssues` / `nexprintExpectedFiles`
   (`deploy/src/lib/nexprint-upload.js`) fail closed on model-file count, exact
   filename, positive and exact retained `fileSize` and `fileExt`; on the
   **exact cover `fileId`**; on **ordered gallery identity** (fileId, fileName,
   fileExt, bytes per position, so an equal-length reordering fails); on
   **exact attachment identity and order**, including the zero-attachment state;
   on `settingInfoList` being **present and empty** (a missing array fails
   separately from a populated one); and on **contradictory `status` /
   `isPublished`** in either direction plus a draft/published mismatch against
   what was requested. Previously the receipt checked only `status`, which the
   doc already conceded was "not a field-level persisted receipt".
2. Preflight now separates two facts that were conflated: a profile that is not
   ticked never uploads at all (named-omission warning, with filenames), versus
   a profile that does upload but arrives without Nexprint's profile block. The
   old warning asserted the second even when the first was true.
3. The demo fixture opts the Bambu profile into Nexprint explicitly
   (`fileSelection: 'manual'`), and its coverage claim now reads
   `ordinary-3mf` **plus** `empty-print-profile-block` so it states what is
   actually exercised.

The shared auto-exclusion default is unchanged, and the profile was not enabled
on any other platform.

### Evidence and status

Deploy **417/417**, desktop **207/207**, backend **31/31**, `tsc` clean,
package rebuilt and strict-codesign verified, `git diff --check` clean. No
upload, publish, retry or deletion occurred; draft `2086068343743848448` was
opened read-only and is unchanged.

Model files are now compared by **upload identity and position**, not by name:
expectations carry the `fileId` Nexprint registered for each uploaded file,
while the source filename and byte count are still asserted against that record
so a wrong or mis-sized upload fails before any retained state is consulted.
Because Nexprint truncates an upload's base name to 80 characters, the retained
name expectation comes from the record and `nexprintUploadName` mirrors that
truncation. Both publication fields are now required to be present: a missing
`status` or `isPublished` fails on its own, in addition to the contradiction
checks.

The final checks were replayed read-only against retained draft
`2086143258366976000` through the rebuilt package: positions 0–2 are
`…-S.stl` (`2086143256625868800`, 36,084 B), `…-M.stl`
(`2086143257158537216`, 54,084 B) and `…-bambu.3mf`
(`2086143257657663488`, 30,787 B); cover `2086143249717846016`; nine gallery
photos in `gallery-01`…`gallery-09` order; zero attachments; `settingInfoList`
present and empty; `status 0` / `isPublished false` in agreement — **zero
issues**. The `uploadNexprintFile` transport and error-detail tests that an
earlier edit overwrote have been restored from git, alongside new negatives for
an HTTP-200 response with an incomplete file record and a non-ok response.

`uploadNexprintFile` now rejects any success response missing `fileId`,
`fileUrl`, `fileName`, `fileExt` or a positive `fileSize`. This was confirmed
against `desktop/nexprint-direct.js` before being enforced: `validateUpload`
rejects an absent or unknown extension for every role before an upload starts
(so `fileExt` is always present and already lower-cased) and `trimUploadName`
always yields a name, but the adapter checks only an **upper** size bound — a
zero-byte upload would otherwise have passed, and that is the one field this
boundary genuinely tightens. `sourceRecordIssues` additionally compares the
record's `fileExt` against the source extension, case-normalized, so a Bambu
`.3mf` registered as an `.stl`, or with no extension at all, fails before any
retained state is consulted.

### Retained certification — unpublished draft `2086143258366976000`

Edit route: `https://www.nexprint.com/en/editUpload/2086143258366976000`

The user authorized exactly one new unpublished draft. The exact signed package
was driven through its own UI: demo fixture loaded via `TRY DEMO`, the other
nine platforms toggled off (`1/10 SELECTED`), all three files confirmed ticked
for Nexprint, `Save draft`, `Original`, `3D Printer › Testing Models` and
`CC BY-NC` confirmed in the options panel, then the per-platform
`SAVE UNPUBLISHED DRAFT` action. Preflight reported one warning — the
`Print Profile (0)` notice, correctly fired because the profile *is* being sent.
Existing draft `2086068343743848448` was not touched.

Authenticated `getEditInfo` readback:

| Concern | Retained |
|---|---|
| `modelFileList` | **All three source files, in order** |
| names / ext / bytes | `…-S.stl` stl 36,084 · `…-M.stl` stl 54,084 · `…-bambu.3mf` **3mf 30,787** — every byte count exact |
| 3MF metadata | distinct `msgDigest`; `thumbnailFileId`, `multiViews` null |
| `extra` / `is3MF` | **`null` even for the real 3MF** |
| `settingInfoList` | `[]` — Print Profile count 0 |
| cover + gallery | `coverImgFileId` present + 9 `modelPicList` entries |
| attachments | 0 |
| title / description | exact; description retained as HTML with `<h1>` + `<p>` |
| category | `3D Printer` → Testing Models (`1422473859022859`) |
| tags | `calibration, test-model, 3d-printer, support-free, fdm, upload-test` |
| licence / originality / NSFW | `licenseType 2` (CC BY-NC) · `originalityType 1` (Original) · false |
| BOM | one row: PLA filament ×1, "Any color" |
| state | `status 0`, `isPublished false` — unpublished |

Three findings worth carrying forward:

1. **`extra` is null even for a genuine retained 3MF.** The `fileExtension:
   { is3MF: true }` marker the submit sends does not round-trip in any readback
   field. Not asserting it was correct; do not add such a check later.
2. **Nexprint preserves hyphenated tags verbatim** (`test-model`, `3d-printer`),
   unlike Printables which strips separators. Do not share tag normalization
   between them.
3. **An unpublished Nexprint draft is not a private object.** `status 0` and
   `isPublished false`, but `isPrivate false` and `open true`. Draft state here
   is publication status, not visibility.

### Rendered DOM boundary

Rendered edit-UI verification was **not** achieved this pass and is not claimed.
ModelPrep drives Nexprint through a REST gateway from Electron main, so there is
no Nexprint page session to inspect, and loading the edit route in a separate
browser redirects to `account.elegoo.com` (ELEGOO Unified Sign-In). No sign-in
was attempted. Every field above therefore comes from Nexprint's own
authenticated `getEditInfo` — the same record its editor renders from — and the
`Print Profile (0)` display is inferred from `settingInfoList: []` rather than
read off the page. A rendered pass needs a separately signed-in browser.

Still uncertified: populated `settingList` print profiles (name, plates, profile
cover, introduction), attachments, public publish, activities/world-first
eligibility, collections, remix/reprint originality, and high-count ordering.

## Evidence and verification boundary

- **LIVE DOM**: inspected on the signed-in upload page.
- **CURRENT BUNDLE**: inspected from the JavaScript loaded by that page.
- **REQUEST CONTRACT**: mapped from the production client and read-only network
  capture. Initial authenticated calls included account key/user-data and
  message-state routes.
- **OFFICIAL RULES**: Nexprint's current UGC terms and creator-fund activity
  pages.
- **LOCAL TEST**: ModelPrep adapter tests with mocked production-shaped
  responses.
- **LIVE FILE UPLOAD**: the authenticated page accepted
  `deploy/public/demo/desk-dragon-bambu.3mf`, displayed it as a 3MF, extracted
  one print plate and its preview, accepted
  `deploy/public/demo/desk-dragon-landscape.webp` as the cropped cover, and
  enabled both continuation actions.
- **LIVE DRAFT**: the production page saved draft
  `2083124902374207488`. Its canonical edit route was then loaded directly and
  populated the persisted model, media, category, profile, and license fields.
- **PUBLICATION BOUNDARY**: the account reported zero published models after
  certification. Public publish was deliberately not tested.

After Chrome's “Allow access to file URLs” permission was enabled, the browser
file chooser successfully transmitted the repository demo 3MF and cover. The
live DOM then exposed the complete model-information step. The completed form
was saved with `Save as draft`; the account's Publish manager showed the result
under Draft and still showed zero Published Models. Opening the saved entry and
then loading its canonical edit URL directly both read back the persisted
fields:

```text
https://www.nexprint.com/en/editUpload/2083124902374207488
```

The Draft manager contained two entries after the test: the complete
`ModelPrep Nexprint draft certification` entry and an older partial
`desk-dragon-bambu` entry. Both were retained because deletion was outside the
authorized mutation boundary.

## Page decision tree

### Step 1: Upload

The first screen begins with `Upload Mode`:

1. **Single model** — multiple files that belong to the same model or its
   accessories.
2. **Batch upload** — every selected file is treated as a different model.

The DOM contains separate file inputs for single-model input, replacement, and
batch input. Single-model input permits multiple files.

Accepted model extensions:

```text
.3ds .3mf .amf .blend .dwg .dxf .elesat .f3d .f3z .factory .fcstd
.iges .ipt .obj .ply .py .rsdoc .scad .shape .shapr .skp .sldasm
.sldprt .slvs .step .stl .stp .studio3 .zpr .stpz
```

The live form recommends 3MF. The current client recognizes print settings
from ELEGOO Slicer, ELEGOO SatelLite, Orca Slicer, and Bambu Studio. It parses
print settings, thumbnails/previews, multiviews, and a digest before opening
model information. An ordinary 3MF without a supported print profile is still
represented as `{is3MF:true}` and can continue without a `settingList`.

Live demo result:

- `desk-dragon-bambu.3mf` was accepted as a single-model upload
- the page identified it as `3MF`
- one `Plate 1` preview was extracted
- the generated print-profile name was
  `0.2mm layer, 3 walls, 15% infill`
- the print-profile introduction was prefilled with Nexprint's guidance text
- `Save as draft` and `Model Information` both became enabled
- `desk-dragon-landscape.webp` was accepted and cropped as the model cover
- the saved draft read back the title
  `ModelPrep Nexprint draft certification`, category `Tools / Parts`,
  originality `Original Model`, event `Not Interested`, BOM `No`, and the
  default Creative Commons Attribution license

Limits:

- model files: maximum **100**
- model file size: maximum **2 GiB each**
- attachments: maximum **100**, maximum **2 GiB each**
- attachment extensions:

```text
.ai .bgcode .cdr .csv .ctb .gcode .goo .ini .ino .lys .lyt .pdf
.svg .txt .zip
```

Nexprint's production client creates the storage path as:

```text
SHA256(first 9999 bytes)-timestamp-SHA256(filename).extension
```

It stores a full-file MD5 as `msgDigest` for model files.

### Step 2: Model information

Required submission fields:

- at least one uploaded model file
- cover file id and URL
- title
- category id from the current server taxonomy
- originality
- license

Optional/conditional fields:

- description
- gallery
- tags
- NSFW
- source URL or Nexprint model id for adapted/reprinted work
- bill of materials
- user collections
- currently eligible activities/contests
- world-first release when an eligible activity/account permits it
- parsed 3MF print settings

The signed-in DOM exposes these additional controls and combinations:

- originality: `Original Model`, `Remix models`, or `Share models`
- separate `Contains NSFW content` checkbox
- required cover uploader; optional `Photo of the make` gallery `(0/9)`
- one selected print profile per uploaded 3MF, its extracted plate count,
  editable profile name, profile cover as either `Use model cover` or
  `Manual upload`, and a rich-text introduction capped at 1,000 characters
- dynamic category picker
- mutually managed event choices, with `Not Interested` selected by default
- rich-text model description capped at 10,000 characters
- tags `(0/20)`
- BOM question defaulting to `No`
- license composition as three questions: allow remix/share, commercial use,
  and redistribution/derivatives; the current default resolves to CC BY
- optional attachments and optional account collection picker
- final actions: `Back`, `Publish`, and `Save as draft`

Field map:

| UI field | Current constraint | Submit field |
|---|---|---|
| title | required, max 80 characters | `modelName` |
| description | rich HTML, empty allowed, otherwise max 10,000 characters | `modelDetail` |
| category | required, dynamic taxonomy | `classificationId` |
| originality | 1 original, 2 adapted, 3 reprint | `originalityType` |
| source | required for adapted/reprint; URL or Nexprint model id | `originUrl` / `originModelId` |
| license | required; numeric 0–7 | `licenseType` |
| tags | max 20, max 50 characters each | `modelTagList` |
| NSFW | boolean | `nsfw` |
| cover | required, fixed 4:3 crop | `coverImgFileId` / `coverImgUrl` |
| gallery | max 9, ordered | `modelPicList` |
| attachments | max 100 | `modelAttachList` |
| model files | max 100 | `modelFileList` |
| BOM | optional, max 100 complete rows | `modelMaterialInfoVOList` |
| collections | optional account data | `modelCollectionIds` |
| activities | optional account-eligible data; removed for reprints | `joinActivityIds` |
| world first | conditional | `worldFirstRelease` |
| save/publish | draft 0, publish 1 | `status` |

### Live category taxonomy

The public production taxonomy returned **8 navigation categories and 43
selectable subcategories (51 nodes total)** on 2026-07-31. There was no third
level. ModelPrep loads this endpoint at runtime and recursively renders only
leaf nodes as selectable full paths; the first-level categories are navigation
groups in Nexprint's own two-column picker, not valid final selections.

| Navigation category (id) | Selectable subcategories (id) |
|---|---|
| Toys & Games (`1422473858908160`) | Miniature Model (`1422473859006464`); Building Blocks (`1422473859006465`); Board Game (`1422473859006466`); Cosplay Costumes & Props (`1422473859006467`); Others (`1422473859006468`) |
| Electronics & Digital (`1422473858908161`) | Arduino & Raspberry (`1422473859006469`); Drones, Robots & RC Equipment (`1422473859014656`); Video Games & VR (`1422473859014657`); Smartphone, Computer & Digital Photography (`1422473859014658`); Smart Wearables (`1422473859014659`); Others (`1422473859014660`) |
| Home & Decoration (`1422473858908162`) | Organization & Storage (`1422473859014661`); Ornamentation (`1422473859014662`); Furniture & Replacement Parts (`1422473859014663`); Office Supplies (`1422473859014664`); Education & Stationery (`1422473859014665`); Personal Health Care (`1422473859014666`); Kitchen & Bathroom (`1422473859014667`); Gardening & Courtyard (`1422473859014668`); Pets (`1422473859014669`); Others (`1422473859014670`) |
| Sports & Cars (`1422473858908163`) | Outdoor Sports (`1422473859014671`); Car Accessories (`1422473859014672`); Others (`1422473859014673`) |
| Fashion (`1422473858908164`) | Clothes (`1422473859014674`); Accessories (`1422473859014675`); Bag (`1422473859014676`); Shoes (`1422473859022848`); Others (`1422473859022849`) |
| Art & Music (`1422473858908165`) | 2D Art (`1422473859022850`); 3D Art (`1422473859022851`); Art Tools (`1422473859022852`); Coins & Badges (`1422473859022853`); Sculpture (`1422473859022854`); Logo & Identification (`1422473859022855`); Music (`1422473859022856`); Others (`1422473859022857`) |
| Tools (`1422473858908166`) | Tools & Accessories (`1422473859022860`); Parts (`1422473859022861`); Others (`1422473859022862`) |
| 3D Printer (`1422473859022863`) | 3D Printer Parts (`2`); 3D Printer Accessories (`1422473859022858`); Testing Models (`1422473859022859`) |

Taxonomy endpoint:

```text
GET /api/v1/model-library-server/model-classification/tree
```

ModelPrep does not silently fall back to guessed or stale category ids when
the current tree is unavailable. The category remains unselected and publish
validation fails closed.

License values:

| Value | License |
|---:|---|
| 0 | CC BY |
| 1 | CC BY-SA |
| 2 | CC BY-NC |
| 3 | CC BY-NC-SA |
| 4 | CC BY-ND |
| 5 | CC BY-NC-ND |
| 6 | CC0 |
| 7 | Standard Digital File License |

BOM rows:

- maximum 100 rows
- material name: required, max 80 characters
- quantity: required positive number, up to four digits in the current UI
- remark: optional, max 1,000 characters

### Media

Cover:

- accepted: jpg/jpeg/png/webp/gif
- maximum: 100 MiB
- fixed 4:3 crop
- current recommendation: 2000×1500

Gallery:

- maximum 9
- accepted: jpg/jpeg/png/webp/gif
- maximum 100 MiB each
- reorderable
- original aspect is retained by the gallery widget

The current form has no video input and its cover/gallery/attachment contracts
do not accept MP4/MOV/WebM. ModelPrep must report video as unsupported rather
than silently place it in the image gallery.

Creator-fund submissions add policy requirements outside the base upload gate:
the current official activity page requires at least two images, including one
real printed photo. It recommends an ELEGOO Slicer 3MF for FDM or SatelLite STL
for resin. ModelPrep loads eligible activities dynamically rather than
hard-coding expired contest names.

## First-party API map

Gateway:

```text
https://www.nexprint.com/gateway
```

Authenticated headers used by the production client:

```http
Authorization: Bearer <account token>
Client-Id: Nexprint
User-Lang: en
```

The account token is stored by Nexprint's page as `auth_token`. ModelPrep's
renderer never receives it. Electron owns `persist:nexprint`, encrypts a
fallback with `safeStorage`, and exposes only the opaque
`desktop-managed-nexprint-session-v1` marker.

Read-only/supporting routes:

```text
POST /api/v1/model-user-server/member/user_data
GET  /api/v1/model-library-server/model-classification/tree
GET  /api/v1/model-library-server/model-activity/can-join-activity
GET  /api/v1/model-library-server/model-collection/collections/page
POST /api/v1/model-library-server/model-tag/upload-page/recommend
GET  /api/v1/model-library-server/model-base-info/tagSuggest
GET  /api/v1/model-library-server/model-base-info/getEditInfo
GET  /api/v1/model-library-server/model-base-info/list/page
```

Upload sequence for every cover/gallery/model/attachment file:

1. `GET /api/v1/infra-server/file/presigned-url?path=...`
2. `PUT` raw bytes to the returned `uploadUrl` with the file content type.
3. `POST /api/v1/infra-server/file/create` with
   `configId,url,path,name,type,size,fileExtension?`.
4. Store the returned file id with the public file URL.

Create/update:

```text
POST /api/v1/model-library-server/model-base-info/createOrUpdateBatch
body: {"modelInfoList":[...]}
```

The successful envelope is `code === 0`; the saved item is returned in
`data.modelInfoList`. ModelPrep immediately reads it back with `getEditInfo`.

Management:

```text
GET    /api/v1/model-library-server/model-base-info/list/page
DELETE /api/v1/model-library-server/model-base-info/{id}
```

Draft edit URL:

```text
https://www.nexprint.com/en/editUpload/{id}
```

Published URL:

```text
https://www.nexprint.com/en/models/{modelCode-or-id}
```

## ModelPrep mapping and safety

Implemented locally:

- persistent isolated Nexprint browser partition and real sign-in page
- encrypted main-process token/cookie fallback
- route allowlist; no renderer token exposure
- live identity validation
- live category tree
- account-scoped eligible activities and collections
- cover crop, ordered original-aspect gallery, models, and attachments
- presign → PUT → file registration
- original/adapted/reprint source mapping
- all eight licenses
- tags, NSFW, AI disclosure, BOM, collections, activities, world-first flag
- draft-first batch default and explicit public action
- post-submit `getEditInfo` read-back
- recent-model listing
- Demo mode always simulates, even with a connected Nexprint account

Production browser flow now live-certified:

- model and cover upload
- one real unpublished draft
- direct canonical edit-page read-back of the persisted required fields,
  selected options, file, cover, and parsed 3MF print profile
- verification that the account still reported zero published models

Still not live-certified:

- gallery upload and server-saved ordering
- server acceptance of every model/attachment extension
- supported-slicer 3MF `settingList` extraction parity (ModelPrep currently
  submits the accepted generic `{is3MF:true}` fallback plus the model digest)
- public publish and public URL visibility
- dynamic activity/creator-fund eligibility for this new account
- batch mode where each selected file becomes a separate listing

The production browser upload/draft path passed its minimum unpublished
certification gate as draft `2083124902374207488`. The source ModelPrep Electron
flow subsequently created and read back unpublished draft
`2083139560975958016` during the four-platform real batch. That certifies the
core Electron draft path for the bundled fixture, but not public publishing or
every optional combination. Both certified drafts and the older partial draft
were deliberately retained; remove any of them only with user approval.

## Official policy constraints

Current UGC rules:
<https://www.nexprint.com/en/terms?pathName=ugc>

- creators retain ownership but grant Nexprint a broad global, royalty-free,
  non-exclusive, sublicensable, perpetual license for platform operation,
  improvement, and promotion
- AI-generated content must be labeled in the title, description, or tags;
  ModelPrep adds `AI-generated` to tags when selected
- models that redeemed platform benefits generally cannot be voluntarily
  deleted for two years without returning the benefit or receiving approval
- engagement/reward manipulation automation is prohibited

Creator-fund activity:
<https://www.nexprint.com/en/activities/1-million-creator-fund>

The adapter automates the creator's own upload form; it does not automate
engagement, rewards, likes, downloads, or activity manipulation.
