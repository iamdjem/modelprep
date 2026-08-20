# Live upload requirements for all ten ModelPrep publishers

> Retained-result verification from the authorized 2026-08-08 exact-package
> demo batch is in `demo-upload-live-verification-2026-08-08.md`. Do not treat
> older safe-core receipt wording as stronger than that newer UI evidence.

Last live audit: **2026-08-02** (Printables read-only mapping plus authorized
specialist-draft and normal-public closeout; MyMiniFactory current-form and
retained-editor refresh; other platform dates remain in their sections)
Audited account surfaces: authenticated browser/desktop sessions for ten platforms
Scope: every upload platform currently implemented or implemented locally as a direct ModelPrep publisher

This is the canonical, dated requirements record for ModelPrep's upload adapters.
It records what the platforms expose today, which requirements are enforced by
the current production client, how the first-party request flow works, and where
ModelPrep still differs. Read it before changing platform limits, image
preparation, metadata mapping, publishing, or status verification.

For the current implementation ledger, continuation order, retained evidence,
and next-agent operating prompt, start with
`modelprep-current-handoff-2026-08-01.md`, then use this file for the detailed
cross-platform contract.

During the initial cross-platform mapping audit, no listing was publicly
published or deleted. Nexprint draft
`2083124902374207488` was created from the bundled demo model and cover, then
reopened read-only at its canonical edit URL. Existing drafts on the other
platforms were opened read-only to inspect conditional steps. MakerOnline discovery
was read-only; its later packaged-app certification created only the unpublished
draft recorded below.

Creality Cloud was added to the canonical map on 2026-07-31. Its complete
signed-in DOM, category/license matrix, first-party JSON/Aliyun request flow,
implementation coverage and certification boundary are in
`creality-web-flow.md`. The ModelPrep Electron adapter created private Original
model `6a6cc6ab96c1c2d13f2b1a6b` with one STL and both cover records, then read
back the exact title, category `1575`, one model file, both covers and
`isShared: false`. This certifies that private path, not every combination.

MakerOnline was mapped, implemented, and core-certified on 2026-07-31. Its complete
signed-in DOM, category/license/kit matrix, multipart scene map, save/create/
readback contract, and third-party import workflow are in `makeronline-web-flow.md`.
The packaged ModelPrep app uploaded one ordered image plus one cube STL, saved
unpublished Private draft `316077`, and read it back through `edit-info`. The native
edit page independently showed the exact title, category `104`, one image, no print
profile, and one `desk-dragon-S.stl` file; public Submit remained disabled. The
artifact is intentionally retained for account review.

MyMiniFactory was mapped and implemented on 2026-07-31. Its signed-in form,
image upload, presigned object-file upload, URL-encoded submit, license matrix,
advanced fields, declaration, and read-back contract are recorded in
`myminifactory-web-flow.md`. The latest exact packaged app created private object
`829056`; ModelPrep readback and an independent signed-in hydrated-editor check
verified title, private state, categories `[60, 462]`, ten ordered images, three
files, tags and full description. Public review and optional branches remain
separate certification gates.

On 2026-08-02, the exact packaged app created and retained private specialist
object `829284` with advanced print data, CC BY-NC-SA and remix parent `829056`.
The app failed closed at readback because the current hydrated editor names the
checked remix control `remix-checkbox`; the parser now accepts that current name
and the older submitted form.

2026-08-08 correction: “mapped” here applies only to the captured free-account
core and advanced print/remix/licence surface. Current first-party Creator
Portal documentation confirms unimplemented premium branches: Sell STL Files
(price plus purchase and post-purchase messages), Premium 500 MB-per-file
limits, and Archive Mode (25 archives around 5 GB each, without generated 3D
viewers). ModelPrep hardcodes 100 MiB and `fileMode=0`; it does not expose,
serialize, or read back those premium/store/archive options.

On 2026-08-03 the corrected exact package re-read `829284` **read-only** and the
receipt succeeded (`private · 10 images · 3 files · categories 60/462 · remix of
829056`), so the advanced print/license/remix branch is now exact-app
live-certified. Reaching it exposed three defects, all fixed: `status()` used a
manual redirect that Electron cancels when re-reading an existing `/object/<id>`;
the readback parser could not interpret `selected=""`, so **`license_id` never
read back at all**; and `.mp-input`'s `width: 100%` collapsed the packaged
Dimensions field to ~19 px. A GET-only `Verify existing object` control now
exists so a failed receipt can be re-read without any chance of duplication.

Current authoritative limits, read from the server-rendered `UploadFilesWrapper`
props on 2026-08-03: `fileSizeLimit` 104,857,600 bytes (100 MiB) per object file,
`filesPerObject` `"500"`, `archiveFileSizeLimit` 5,368,710,000 bytes (~5 GB),
`archiveFilesPerObject` 25, and 55 accepted model extensions. Images are capped
at 5 MiB by the current inline uploader (`maxFileSize: 5*1024*1024`, `fileType`
`1`, `primary_image` keyed by filename). **`can_use_zip_mode` and
`isPremiumCreator` are both `false` on this account**, so ZIP/archive mode and
premium branches are account-gated, not missing. Image count, image extension
allow-list and title/description character caps are absent from the current
client and remain UNKNOWN. Scan The World (11 controls) and
`threedobject_temp_type[license_store]` are visible but deliberately unmapped.

Nexprint is a different completion class from the other three: its signed-in
DOM/request contract and local adapter are implemented. The authenticated
production page accepted the repository demo 3MF and cover, extracted one
plate, saved unpublished draft `2083124902374207488`, and read the persisted
fields back from the direct edit route on 2026-07-31. The account still showed
zero published models. Treat Nexprint's **production browser draft path as
certified**.

On 2026-07-31 the source ModelPrep Electron build also completed a single real
four-platform batch with the bundled desk-dragon fixture. The runtime receipts
reported four successes and no failures:

- MakerWorld private listing/draft editor `9036878`
- Printables unpublished, metadata-verified draft `1796023`
- Cults3D secret/unlisted free listing
  `articulating-desk-dragon-print-in-place-7f718cba22111be2ef99`
- Nexprint unpublished draft `2083139560975958016`, read back through the
  canonical edit route

Creality was certified separately after the four-platform batch as private
model `6a6cc6ab96c1c2d13f2b1a6b`; it was not part of that earlier batch.

The artifacts were deliberately retained for account review; none was deleted
or made public. This certifies the four-platform orchestration and Nexprint's
Electron connected-account draft path for this fixture. It does not certify
every file type, paid/public branch, contest/activity combination, or account
state documented below.

On 2026-08-01 the final exact packaged app ran a four-at-a-time closeout batch
against all ten connected accounts. It completed **10 succeeded, 0 failed** with
MakerWorld private receipt `9053658`, Printables draft `1797292`, Cults3D secret
slug ending `6f02ba1cd366b9cb06a5`, MyMiniFactory private object `829056`,
Thingiverse draft `7390480`, Thangs private model `1583272`, Nexprint draft
`2083625532272496640`, Creality private model
`6a6e3f28753b84f6aab190a8`, MakerOnline draft `316221`, and MakerRoad private
draft `M2134222528`. Every result passed its adapter readback. This certifies all
ten safe core paths and the four-slot scheduler for the bundled fixture, not the
optional/public/paid matrices below. The artifacts are intentionally retained.

On 2026-08-02 the exact packaged app additionally created Printables specialist
draft `1797772` and public model `1797774`. The draft passed ordered converted
HEIC, G-code, SLA/SL1, retained ZIP and full metadata readback. The public model
passed verified-draft, publish and persisted-live readback and remains public
pending exact deletion confirmation. No artifact was deleted.

## Evidence labels

- **LIVE DOM** — observed on the authenticated production upload/edit page on
  2026-07-29.
- **CURRENT BUNDLE** — extracted from the production JavaScript loaded by that
  page on 2026-07-29.
- **REQUEST CONTRACT** — request/response shape used by the current first-party
  client or independently captured from the same web flow.
- **OFFICIAL PUBLIC API** — documented by the platform for third-party use.
- **UNKNOWN** — the live client did not publish a value. ModelPrep must not
  present a guessed value as a platform limit.
- **MODELPREP POLICY** — a local compatibility/recommendation choice, not a
  platform requirement.

The evidence rank is important. A convenient 4:3 crop or a 20-image local cap is
not a platform rule unless the current platform UI or bundle enforces it.

## Current API support classification

| Platform | Official third-party upload API? | Production path ModelPrep uses |
|---|---|---|
| MakerWorld | No documented public upload API found | Undocumented first-party `/api/v1/...` JSON services plus presigned S3 PUTs |
| Printables | No documented stable third-party upload API found | Undocumented first-party `https://api.printables.com/graphql/` contract plus signed object-storage POSTs |
| Cults3D | Official GraphQL exists, but its public documentation is primarily catalog/query oriented and does not expose the complete website upload flow | Authenticated Rails web form, signed S3 POST, creation form, then price/visibility form |
| Nexprint | No documented third-party upload API found in the official site or signed-in upload surface | Undocumented first-party `/gateway/api/v1/...` REST services plus presigned object-storage PUTs |
| Creality Cloud | No documented third-party model-upload API found | Undocumented first-party `/api/cxy/...` JSON services plus short-lived Aliyun STS multipart uploads |
| MakerOnline | No documented third-party model-upload API found | Undocumented first-party `/api/...` JSON/multipart services; raw token/cookies stay in Electron main |

Cults also documents a contact-gated “Publish to Cults” URL that pre-fills a
remote file:

```text
https://cults3d.com/en/creations/new?file_url=<URL-encoded-file>&origin=<approved-origin>
```

That link hands the user to Cults; it is not a complete unattended publish API.

Nexprint's complete dated field/request map is in
`nexprint-web-flow.md`. Its contract is first-party and undocumented, so build
fingerprints and live smoke tests matter before any release claim.

---

# 1. MakerWorld

## 1.1 Entry points and product branches

**LIVE DOM**

Upload menu:

- 3D original: `/en/my/models/publish?type=original`
- 3D remix: `/en/my/models/publish?type=remix`
- Laser & Cut original:
  `/en/my/laser-and-cut-models/publish?type=original`
- third-party import: `/en/my/models/import`

The model-information step exposes `Original`, `Remix`, and `Share` as
`modelSource` values. The upload-menu remix route enters the same wizard with
the remix source selected.

The third-party import page is not ModelPrep's outbound publisher. The current
page showed a connected Printables profile, while a separate verification hint
still said “only Thangs and Thingiverse”; treat that copy as an inconsistent
first-party UI, not an integration contract.

### 3D model decision tree

1. Required: “Do you have a Bambu Studio file (.3mf)?”
2. **Yes**:
   - three steps: Upload → Model Information → Print Profile Information
   - one Bambu Studio `.3mf`
   - optional raw/source files
   - linked Laser & Cut question
   - CyberBrick question
3. **No / raw files**:
   - two steps: Upload → Model Information
   - raw/source files
   - linked Laser & Cut question
   - no CyberBrick question on this branch

### Laser & Cut decision tree

1. Required: Bambu Suite `.lac` or raw design files.
2. **`.lac`**:
   - three steps: Upload → Model Information → Print Profile Information
   - one Bambu Suite `.lac`
   - optional raw/source files
   - linked 3D-model question
   - CyberBrick question
3. **Raw design files**:
   - two steps
   - linked 3D-model question
   - no CyberBrick question on this branch

## 1.2 Authentication and request headers

**REQUEST CONTRACT**

- Bambu SSO/browser session is the authoritative desktop login.
- Cookie-only authenticated API calls work; ModelPrep also sends the harmless
  MakerWorld client headers used by the site.
- The email/password fallback is a two-step token exchange and must preserve
  `tfaKey` through the emailed-code step.
- The renderer must not receive raw desktop cookies. The Electron main process
  owns the persistent MakerWorld partition.

Relevant service root:

```text
https://makerworld.com/api/v1/
```

Common headers used by the first-party client:

```http
X-BBL-Client-Version: 00.00.00.01
X-BBL-App-Source: makerworld
X-BBL-Client-Name: MakerWorld
```

MakerWorld has no documented stable third-party upload API. All endpoints below
are first-party web contracts and may change without notice.

## 1.3 3D files

### Bambu Studio profile file

**LIVE DOM + CURRENT BUNDLE**

- extension: `.3mf`
- maximum files: **1**
- maximum size: **200 MiB** (`209,715,200` bytes)
- must be a genuine Bambu Studio 3MF for the profile/slicing path
- server slicing and compatibility extraction happen after submit

### Raw/source model files

**LIVE DOM**

```text
.3ds .amf .dwg .dxf .f3d .factory .fcstd .iges .ipt .obj .ply
.rsdoc .scad .shape .shapr .skp .sldasm .sldprt .slvs .step .stl
.stp .studio3 .zip .3mf .stpz
```

**CURRENT BUNDLE**

- maximum size: **200 MiB per file**
- multiple files and folders are supported
- each file has a display/base name, optional note, folder path, and
  open-source/download-protection state
- a separate STEP/source file can improve cloud-slicing quality while keeping
  the editable design protected

## 1.4 Laser & Cut files

**LIVE DOM + CURRENT BUNDLE**

Primary Bambu Suite file:

- extension: `.lac`
- maximum files: **1**
- maximum size: **100 MiB** (`104,857,600` bytes)

Raw Laser & Cut input:

```text
.lac .svg .dxf .jpg .jpeg .png .bmp .webp .ai
```

The actual `accept` attribute currently contains `.png` twice. That duplicate is
a harmless production-client detail and should be retained only as a change
fingerprint, not copied into ModelPrep.

The raw-file byte limit was not displayed by the live form and was not located
in the inspected raw uploader bundle: **UNKNOWN**. Do not infer the `.lac`
100 MiB cap applies to every raw type without a server validation.

`.lac` profile submission additionally carries parsed plate, process, machine,
material, tool, and device compatibility metadata. The publish gate requires
usable plate/machine/process data.

## 1.5 Model covers, pictures, and the new video field

### Covers

**LIVE DOM + CURRENT BUNDLE**

- required web/app landscape cover: **4:3**
- optional app portrait cover: **3:4**
- current input accepts JPEG, PNG, WebP, and GIF
- visible helper copy still says `jpg/gif/png`, so the `accept` attribute is the
  stronger current source for WebP
- maximum size: **30 MiB** outside China, **20 MiB** in China
- one file per cover slot
- cropper aspect is fixed to the selected slot
- current cropper calls `getCroppedCanvas({maxWidth:1920,maxHeight:1440})`
  (a 3:4 crop therefore fits inside that bounding box)

`1920×1440` is current client output behavior for a full-size 4:3 crop.
`1500×2000`, used by older ModelPrep presets, is a ModelPrep output choice and
not a currently displayed MakerWorld requirement.

### Model pictures

**LIVE DOM + CURRENT BUNDLE**

- maximum: **16**, separate from the two cover slots
- formats: JPEG/JPG, PNG, WebP, GIF
- maximum size: **30 MiB each** outside China, **20 MiB** in China
- 4:3 is **recommended**, not upload-time cropped/enforced by the gallery widget
- order is preserved
- real print photography is a policy requirement; an accepted upload can still
  fail review with a “no real life photo” result

### Model video (new)

**LIVE DOM + CURRENT BUNDLE, confirmed 2026-07-29**

- optional
- maximum files: **1**
- MIME types: `video/mp4`, `video/quicktime`
- user-facing formats: MP4 or MOV
- maximum duration: **30 seconds**
- the video displays first on the model detail page
- byte-size cap: **UNKNOWN**; the inspected current dropzone does not set one
- video upload has its own `designVideo` field and
  `videosIsUploading`/`designVideo` loading state

ModelPrep exposes this as typed video media, separate from images. It validates
MP4/MOV and duration before upload, waits for the completed media URL, and
serializes `designVideo: [{name,url}]` without squeezing video into the image gallery.

## 1.6 Model metadata

**LIVE DOM + CURRENT BUNDLE**

| Field | Requirement/limit |
|---|---|
| source | required: original, remix, or share |
| name/title | required, maximum **50 characters** |
| category | required, dynamic current taxonomy |
| tags | maximum **50** |
| per-tag length | maximum **100 characters** |
| license | required, generated by the adaptation/commercial-use matrix |
| visibility | public or private |
| description | CKEditor rich HTML; no hard client cap observed |
| linked Laser & Cut / 3D model | optional conditional relation |
| documentation | optional, with limits below |
| exclusive program | optional and account/terms eligible |
| BOM | optional; when enabled it must contain at least one valid item |
| CyberBrick | conditional and account eligible |

The category taxonomy observed live:

- 3D Printer: 3D Printer Accessories; 3D Printer Parts; Test Models
- Art: 2D Art; Coin & Badges; Signs & Logos; Sculptures; Other Art Models
- Education: Biology; Chemistry; Engineering; Geography; Mathematics; Physics
  & Astronomy; Other Education Models
- Fashion: Bags; Clothes; Earrings; Footwear; Glasses; Jewelry; Rings; Other
  Fashion Models
- Hobby & DIY: Electronics; Music; RC; Robotics; Sport & Outdoors; Vehicles;
  Other Hobby & DIY
- Household: Decor; Festivities; Garden; Office; Pets; Other House Models
- Miniatures: Animals; Architecture; Creatures; People; Other Miniatures
- Props & Cosplays: Costumes; Masks & Helmets; Cosplay Weapons; Other Props &
  Cosplays
- Tools: Gadgets; Hand Tools; Machine Tools; Measure Tools; Medical Tools;
  Organizers; Other Tools
- Toys & Games: Board Games; Characters; Outdoor Toys; Puzzles; Construction
  Sets; Other Toys & Games
- Generative 3D Model: Hueforge & Lithophane; Make My Sign; Make My Vase; Pixel
  Puzzle Maker; Relief Sculpture Maker; AI Scanner; Image to Keychain; Make My
  Desk Organizer; PrintMon Maker; Statue Maker; Christmas Ornament Maker; Make
  My Lantern

Category IDs are dynamic server data. Resolve by current ID/label; do not rely
only on this label snapshot.

### License values

**REQUEST CONTRACT**

```text
CC0
BY
BY-SA
BY-ND
BY-NC
BY-NC-SA
BY-NC-ND
Standard Digital File License
MakerWorld Exclusive License
Standard Digital File License - Community Use
Standard Digital File License - Platform Print Only (SDFL-PPO)
```

The ordinary UI derives the CC result from:

- adaptations: yes / share-alike / MakerWorld-exclusive / MakerWorld plus
  community / no
- commercial use: yes / no

Remix submissions need a resolvable internal model or external source URL,
source metadata/license, and a change description. Licenses that forbid
derivatives must fail closed.

### Description schema

MakerWorld stores CKEditor HTML. Supported mappings include:

- headings (`h2`–`h4`)
- paragraph/alignment
- bold (`strong`), italic (`i`), underline, color spans
- ordered/unordered lists
- links
- blockquote
- tables

Inline code styling, strikethrough, code blocks, horizontal rules, and arbitrary
font-size controls are not reliable. ModelPrep must convert Markdown to this
HTML subset instead of sending Markdown verbatim.

## 1.7 Documentation, BOM, exclusive, and CyberBrick

### Documentation

**CURRENT BUNDLE**

Assembly Guide:

- formats: PDF, PNG, JPG/JPEG, WebP, GIF
- maximum files: **25**
- images: **30 MiB each**
- PDF: **50 MiB each**

Other Files:

- formats: TXT, PDF, ZIP
- maximum files: **10**
- TXT: **2 MiB**
- PDF: **50 MiB**
- ZIP: **100 MiB**

### BOM

The BOM may contain kits, filaments, materials, and other/free-text parts.
Catalog selections carry their server SKU/value plus ancestor `parentIds` and a
quantity. Other-part names are limited to 100 characters and notes to 500 in
the current client.

### Exclusive program

Only original, eligible models may enroll. The creator must accept the current
exclusive guidelines/agreement. Eligibility and reward rules are server/account
controlled.

### CyberBrick

CyberBrick is account-gated (`rcUpload`) and appears on the profile-bearing
3MF/`.lac` branches.

Current bundle-confirmed special requirements include:

- at least one control configuration
- controller/switch cover requirements when their corresponding configuration
  is used
- MicroPython ZIP: maximum **4 programs**
- uncompressed MicroPython content: maximum **800 KiB** (`819,200` bytes)
- `boot.py` required
- encrypted ZIP unsupported
- cover images: JPEG/PNG/WebP/GIF, one per slot, 1:1 crop, 30 MiB outside China
  / 20 MiB China
- main control JSON: maximum **20 KiB**
- firmware/controller modes include `cb_rc` and `user_mpy`

The exact eligible-account combinations still require an account with
`rcUpload:true`; the audited account was not used to submit any CyberBrick
payload.

## 1.8 Print profile fields

**LIVE DOM + CURRENT BUNDLE**

| Field | Requirement/limit |
|---|---|
| Bambu Studio `.3mf` | required |
| profile name | required, maximum **60 characters** |
| profile pictures | maximum **37** |
| profile picture types | JPEG, PNG, WebP, GIF |
| profile picture size | 30 MiB outside China / 20 MiB China |
| profile cover | explicitly selected from profile pictures |
| real print photo | at least one required by policy/publish gate |
| visibility | public or private, independent of model visibility |
| profile description | reduced rich-text schema |
| printer compatibility | derived from 3MF; creator may remove risky printers |
| guidelines checkbox | publish UI gate |

Observed current printer codes:

```text
P1S=C12
X1 Carbon=BL-P001
X1=BL-P002
X1E=C13
P1P=C11
P2S=N7
A1 mini=N1
A1=N2S
H2C=O1C2
H2D=O1D
H2D Pro=O1E
H2S=O1S
X2D=N6
A2L=N9
```

The live draft's “Add Print Profile” route returned MakerWorld's generic error,
while an existing profile edit page rendered correctly. This is a platform
route/state caveat, not evidence that the profile contract is absent.

## 1.9 Request lifecycle

**REQUEST CONTRACT**

Presign:

```http
POST /api/v1/design-user-service/my/upload
{"useType":"makerworld/model","fileNames":["name.ext"]}
```

Response includes:

```json
{
  "cdnPrefix": "https://makerworld.bblmw.com",
  "urls": ["<presigned AWS S3 PUT URL>"]
}
```

Then:

1. upload bytes to the presigned URL
2. create draft: `POST /api/v1/design-user-service/my/draft`
3. update draft: `PUT /api/v1/design-user-service/my/draft/<id>`
4. submit: `POST /api/v1/design-user-service/my/draft/<id>/submit`
5. poll the known draft and published design IDs

Laser & Cut uses the parallel `draft2d` namespace.

Important status rules:

- submit success is asynchronous acceptance, not proof of a live listing
- `status=8` may be verifying or failed
- `resultType=0`: no known failure; continue checking
- `resultType!=0`: failed; surface `resultDesc`
- `status=1` plus a valid `designId`, confirmed by design readback: live
- private publications may transition directly to live
- draft/verifying delete and published-design delete use different endpoints

Production fingerprint at audit:

```text
Next build ID: vE2BFAGb-CHbLrB8JA1mP
video bundle: static/chunks/53289-c5a96306d19d80b6.js
video bundle SHA-256: 8a0ab4da115015cd83a93b3c434853a88b8bb0ccfbd458099aea4967e4246b63
model-media bundle: static/chunks/28223-cace6a543c615651.js
model-media SHA-256: d45b92412c95706d0122ae1001cfedbc6d53c37a1e1d1cc0240ee1134e2498e9
profile-media bundle: static/chunks/64598-f17724f573c85e08.js
profile-media SHA-256: 5edbdbb3fb307d0f82dbd694a23dc3f84e9062704f40024c4f9922e830f9ae44
```

---

# 2. Printables

## 2.1 Entry points, authentication, and API status

**LIVE DOM**

- create: `https://www.printables.com/model/create`
- edit: `https://www.printables.com/model/<id>/edit`

Printables uses Prusa Account OAuth with PKCE and a first-party Printables
session. ModelPrep's desktop session lives in the Electron
`persist:printables` partition; file bytes are uploaded from the user's network.

**CURRENT BUNDLE**

```text
GraphQL endpoint: https://api.printables.com/graphql/
Graphql-Client-Version: v4.8.10
media root: https://media.printables.com
file root: https://files.printables.com
```

No stable public third-party upload API was found. This GraphQL schema is the
current first-party web contract and must be treated as changeable.

## 2.2 Authorship and publication branches

**LIVE DOM + CURRENT BUNDLE**

Authorship is required:

- `author` — original work
- `remix` — one or more Printables or supported external parents, plus a
  required “differences” rich-text description
- `reupload` — source URL/autosuggest, no remix-differences editor

All branches must respect the source license. Reupload is not allowed for
paid/Club models.

Publication lifecycle:

1. create/update a complete draft with `draft:true`
2. read it back and verify assets/metadata
3. if `publishApprovalRequired=false`, update the same ID with `draft:false`
4. if `publishApprovalRequired=true`, leave the verified draft and call
   `printPublishRequest`
5. poll `datePublished`, `draftReason`, and publish-request state

Printables has no private-live visibility observed in this flow. The safe
pre-publication state is a draft. Do not translate “private” into public
publication.

## 2.3 Metadata fields

**LIVE DOM + CURRENT BUNDLE**

| Field | Requirement/limit |
|---|---|
| model name | required for publish, maximum **255 characters** |
| summary | required, maximum **120 characters** |
| description | rich Tiptap HTML |
| main category | required |
| tags | canonical lower-case labels; per tag **1–25 characters** |
| total tag count | **UNKNOWN** |
| authorship | author / remix / reupload |
| AI generated | explicit yes/no required for publish |
| NSFW | boolean |
| political content | boolean |
| license | required and constrained by authorship/source/store state |
| main image | required; first ordered gallery image |
| model/print file | at least one required |

Description editor capabilities observed live:

- paragraph/text formatting
- bold, italic, strike
- links
- ordered and unordered lists
- indentation
- images
- blockquote
- tables
- YouTube/Vimeo embeds
- inline code and code block
- undo/redo

Rich-description image input:

```text
image/png, image/jpeg, image/gif, image/webp
```

Rich-description images use `FileUploadCreate(kind: RichContent)`, a signed
multipart upload, and `richContentFileUploadFinished`. The active `v4.8.10`
editor imports the uploader's **8 MiB** maximum from
`chunks/2.B59PbNQS.js`; `chunks/2.DSTJce1t.js` rejects larger images before
presigning. This is separate from the 16 MiB constant in the general limits
bundle.

## 2.4 Gallery media

**LIVE DOM**

Gallery input:

```text
.gif .jpeg .jpg .png .webp .heic .heif .zip
```

- HEIC/HEIF are converted client-side to JPEG
- the first ordered image is `mainImage`/cover
- images can be reordered
- an image can be set as cover
- images can be rotated; GIF rotation is disabled
- a published model cannot remove its last image
- no upload-time aspect-ratio crop or fixed ratio was observed
- current gallery count cap: **UNKNOWN**
- current per-gallery-image byte cap: **UNKNOWN**

Therefore Printables **does not currently justify ModelPrep's 4:3 crop or
25-image cap as platform requirements**. If retained, they must be labelled
ModelPrep policy/recommendation, not Printables limits. Prefer original media
and user order.

## 2.5 Accepted files and buckets

**LIVE DOM**

General upload input:

```text
.3dm .3ds .3dxml .3mf .ai .amf .asm .bgcode .blend .cdr .csv .ctb
.dwg .dxf .easm .f3d .f3z .factory .fcstd .gcode .gif .heic .heif
.iges .igs .ini .ino .ipt .jpeg .jpg .lys .lyt .obj .par .pdf .ply
.png .prt .py .rsdoc .scad .shape .shapr .skp .sl1 .sl1s .sldasm
.sldprt .slvs .step .stl .stp .studio3 .svg .txt .webp .zip .zpr
```

The current raw `accept` string contains `.zip` twice; the displayed list
de-duplicates it.

Print Files:

```text
.gcode .bgcode .sl1 .sl1s
```

Model Files:

```text
.3ds .3dxml .3mf .amf .asm .blend .dwg .dxf .f3d .f3z .factory
.fcstd .igs .iges .ipt .obj .ply .prt .py .rsdoc .scad .shape
.shapr .skp .sldasm .sldprt .slvs .step .stl .stp .studio3 .zpr
```

Other Files:

```text
.3dm .ai .cdr .csv .ctb .easm .ini .ino .lys .lyt .par .pdf .svg
.txt .zip
```

**CURRENT BUNDLE**

- normal file maximum: **1 GiB** (`1,073,741,824` bytes)
- ZIP retained without unpacking: **256 MiB** (`268,435,456` bytes)
- total filename maximum: **150 characters**
- per-file note maximum: **95 characters**
- each folder name/path segment maximum: **60 characters**
- folders supported in all buckets
- alphabetical sorting supported
- Shift multi-selection supported
- published models cannot remove their last file

Processed G-code readback includes:

- name, folder, note, order
- weight/material
- nozzle diameter
- layer height
- print duration
- `excludeFromTotalSum`

The current `GcodeFileInputType` accepts whole-number `weight`, `material`,
decimal-string nozzle diameter, layer height and print duration in hours, plus
`excludeFromTotalSum`. Its duration validation permits at most three digits
before the decimal, so ModelPrep caps the control at 999 hours. Processed
readback can include a display-only `printer` object, but the mutation input
rejects that field; both direct adapters strip it.

Processed SLA readback can include layer height and print duration, but the
current `SLAFileInputType` accepts only id, folder, name and note. Do not replay
computed SLA readback fields into `modelUpdate`.

## 2.6 Categories

**LIVE DOM, label snapshot**

- 3D Printers: Prusa Parts & Upgrades; Accessories; Anycubic Parts & Upgrades;
  Bambu Lab Parts & Upgrades; Creality Parts & Upgrades; Other Printer Parts &
  Upgrades; Voron Parts & Upgrades; Test Models
- Art & Design: 2D Plates & Logos; Sculptures; Wall-mounted; Other Art & Designs
- Costumes & Accessories: Cosplay & Costumes in general; Masks; Props; Other
  Costume Accessories
- Fashion: Men; Women; Other Fashion Accessories
- Gadgets: Audio; Computers; Photo & Video; Portable Devices; Video Games;
  Virtual Reality; Other Gadgets
- Healthcare: Home Medical Tools; Medical Tools
- Hobby & Makers: Automotive; Electronics; Mechanical Parts; Music; Organizers;
  RC & Robotics; Tools; Other Ideas
- Household: Bathroom; Bedroom; Garage; Home Decor; Kitchen; Living Room;
  Office; Outdoor & Garden; Other House Equipment; Pets
- Learning: Chemistry & Biology; Engineering; Haptic Models; Math; Other 3D
  Objects for Learning; Physics & Astronomy
- Seasonal designs: Autumn & Halloween; Spring & Easter; Summer; Winter &
  Christmas & New Year's
- Sports & Outdoor: Indoor Sports; Other Sports; Outdoor Sports; Winter Sports
- Tabletop Miniatures: Characters & Monsters; Miniature Gaming Accessories;
  Props & Terrains; Vehicles & Machines
- Toys & Games: Action Figures & Statues; Board Games; Building Toys; Outdoor
  Toys; Puzzles & Brain-teasers; Vehicles; Other Toys & Games
- World & Scans: Animals; Architecture & Urbanism; Historical Context; People

IDs and selectable states must come from current GraphQL taxonomy data.

## 2.7 Licenses and paid/Club combinations

**LIVE DOM**

Selectable labels observed:

```text
Creative Commons — Public Domain
Creative Commons — Attribution
CC Attribution — Share Alike
CC Attribution — NoDerivatives
CC Attribution — Noncommercial
CC Attribution — Noncommercial — Share Alike
CC Attribution — Noncommercial — NoDerivatives
GNU GPL v2.0
GNU GPL v3.0
GNU LGPL
BSD License
Standard Digital File License
Open Community License v1.1
OCL v1.1 + General Attribution v1
OCL v1.1 + Research & Development v1
OCL v1.1 + Micro Business v1
OCL v1.1 + GAtt v1 + Micro v1
OCL v1.1 + GAtt v1 + RnD v1
CERN Open Hardware Licence Version 2 - Strongly Reciprocal
```

The actual choices are filtered by:

- original/remix/reupload
- parent/source license
- free/Store/Club mode
- creator account entitlements
- tier benefits and commercial-use exclusions

**CURRENT BUNDLE, conditional but not rendered for the audited free account**

- free
- Club and/or paid Store for eligible designer accounts
- integer price with server-provided minimum/maximum
- Store fee (normally 20% unless the account has a custom fee)
- exclude-commercial-usage option based on tier benefits
- paid/Club models cannot use `reupload`
- server controls `maxStoreModels` and eligibility

Do not expose paid/Club controls merely because they exist in the bundle; query
the current account capabilities.

## 2.8 Upload and mutation contract

**REQUEST CONTRACT**

Presign:

```graphql
printFileUpload2(
  fileName: $fileName
  folder: $folder
  unzip: $unzip
  imageHash: $imageHash
  imageHeight: $imageHeight
  imageWidth: $imageWidth
)
```

The response supplies `uploadData.url`, every signed form field, and a
`fileUpload.id`. POST all signed fields to object storage, append the file last,
then compute CRC32C (Castagnoli reversed polynomial `0x82F63B78`) and call:

```graphql
printFileUploadFinished(fileUploadId: $id, crc32c: $crc32c)
```

Poll `modelFileUploads(ids:)` approximately once per second until every item is
processed. Surface `notInspectedFiles` rather than silently discarding them.

Current model update variables:

```text
tags, id, description, printer, category, variationOf, license, mainImage,
name, draft, summary, remixParents, nsfw, aiGenerated, politicalContent,
authorship, remixDescription, club, price, excludeCommercialUsage, slas,
gcodes, stls, otherFiles, images
```

Other current operations:

```text
ModelEditDetail
PrintPublishRequest
SearchRemixParentByUrl
SearchRemixParents
SearchRemixParentById
printDelete
drafts / moreDrafts / userModels
```

HTTP 429 must be surfaced as rate limiting. HTTP success with GraphQL `errors`
or mutation `errors { field messages }` is still failure.

Production fingerprint at the 2026-08-02 signed-in audit:

```text
SvelteKit/Graphql-Client-Version: v4.8.10
editor/model-form bundle: chunks/2.bQT76bXE.js
editor SHA-256: 69f94631947f3df45b414c41597989775b4cd7f58ce1fe0901e8d38962f88153
file-types bundle: chunks/2.BSEC-uPg.js
file-types SHA-256: f9335820ff3dd0839bc15aab681200cc706b3be9d8e47f43644439a3dcb6f1da
file-size limits bundle: chunks/2.DCumiKvf.js
file-size limits SHA-256: 4212c178e518d486c3ed04131428fb4035f4184d6c49336815e89eacd74c567f
text/file-detail limits bundle: chunks/2.vLWdOE1_.js
text/file-detail limits SHA-256: 03ec358b5464a93c834ad7f3d34737c9eec716b6c0121e26461c7b5092d20496
file-row bundle: chunks/2.CP5svT1t.js
file-row SHA-256: 337099946744dfdb114f8196edaccfbf1662d29125673e814125c31c5caccc4a
```

---

# 3. Cults3D

## 3.1 Two-page upload flow

**LIVE DOM**

Page 1:

```text
GET/POST https://cults3d.com/en/creations/new
POST target: /en/creations
```

Page 2:

```text
GET  /en/creations/<slug>/price/edit?currency_code=<ISO-4217>
POST /en/creations/<slug>/price
```

The first form creates an offline creation/draft. The second chooses price,
license, and visibility and performs the publish action.

## 3.2 First-page metadata

**LIVE DOM**

| Field | Form name | Requirement/limit |
|---|---|---|
| language | `creation[locale]` | current `en` |
| name | `creation[name]` | required; no current `maxlength` attribute |
| description | `creation[description]` | required; Markdown helper copy; no current maxlength |
| settings/instructions | `creation[details]` | optional; no current maxlength |
| usages | `creation[usages][]` | multi-select |
| category | `creation[category_id]` | required |
| subcategories | `creation[sub_category_ids][]` | maximum **3** |
| meta tags | `creation[meta_tags][]` | fixed vocabulary |
| free tags | `creation[flat_keywords]` | maximum **20 tags**; input `maxlength=300` |
| AI disclosure | `creation[made_with_ai]` | boolean |
| comments | `creation[show_comments]` | boolean |
| files | `creation[blueprint_ids][]` | uploaded/registered IDs |
| media | `creation[illustration_ids][]` | uploaded/registered IDs; order preserved |

Usages and API values:

```text
cnc_laser       CNC machining - Laser cutting
papercraft      Papercraft & Origami
sewing_pattern  Sewing pattern
electronics     Electronics - PCB
3dp             3D printing
```

Meta tags and API values:

```text
articulated
customizable
functional_part
hollow_model
multicolor
multi_material
no_support
print_in_place
remix
resin_print
scale_model
scan
```

Description guidance explicitly asks for use/originality, search keywords,
limitations/inspiration/credit. Details guidance asks for machine/process,
material, resolution/size/time/infill/supports, assembly/finishing, and safety
limitations.

## 3.3 Categories and subcategories

**LIVE DOM, IDs and labels**

- Art (`23`): Fan Art `37`; Sculptures & Busts `43`; Animals & Creatures `34`;
  People `40`; 2D Lithophanes `33`; Low Poly `38`; Signs & Logos `44`; Scans &
  Replicas `42`; Math Art `39`; Art Tools `35`; Coins `36`
- Fashion (`24`): Cosplay Props `46`; Masks `48`; Shoes `122`; Glasses `47`;
  Wallets `49`
- Jewelry (`26`): Keychains `54`; Earrings `53`; Bracelets `50`; Necklaces `55`;
  Rings `56`; Brooches & Badges `51`; Cufflinks `52`
- Home (`30`): Office `66`; Kitchen `63`; Bathroom `57`; Outdoor & Garden `67`;
  Furniture `60`; Home Decor `61`; Lamps `64`; Vases `71`; Pets `68`; Planters
  `70`; Cookie Cutters `58`; Food & Drink `59`; Molds `65`; Wall-mounted `72`;
  Piggy Banks `69`; Household Supplies `62`
- Architecture (`32`): Houses & Buildings `75`; Castles `73`; Famous Monuments
  `74`; Landscapes `76`; Maps `77`
- Gadget (`25`): Phones & Tablets `85`; Consoles & Video Games `82`; Computers
  `81`; Electronics `84`; Robots `41`; Drones `83`; Vehicle Accessories `86`;
  Clocks & Watches `80`; Audio & Music `78`; Cameras & Videos `79`
- Game (`31`): RPG & Tabletop `98`; Action Figures `87`; Auto & Moto `90`; Toys
  `99`; RC Vehicles `97`; Airsoft `89`; Trains `100`; Board Games `91`;
  Brainteasers & Puzzles `93`; Aircraft & Space `88`; Mechanical Toys `96`;
  Construction Toys `94`; Boats & Submarines `92`; Magic `95`
- Tool (`27`): 3D Printing & Accessories `101`; Spare Parts `105`; Vehicle Spare
  Parts `8`; Hand Tools `103`; DIY `102`; Machine Tools `104`; Tool Holders &
  Boxes `106`
- Naughties / NSFW (`28`): People NSFW `112`; Sextoys `111`; Dildos & Vibrators
  `108`; Hentai `109`; Creatures `107`; Lithophanes `110`
- Various (`29`): Seasonal & Celebrations `120`; Sports & Outdoor `121`;
  Prototyping `118`; Education `116`; Medical `117`; Dental `114`; Dioramas
  `115`; Books & Reading `113`; Recycling & Upcycling `119`; Software `7`

The category-to-subcategory relationship is carried by each option's
`data-parent-id`. Use the live page/metadata, not a hardcoded top-level-only
mapping.

## 3.4 Model files

**LIVE DOM**

Effective accepted formats:

```text
.3ds .3mf .ai .amf .bin .blend .bmp .curaprofile .dae .doc .dst
.dwg .dxf .eps .f3d .f3z .fcstd .fff .gbr .gbx .gcode .ini .mtl
.obj .pdf .ply .ppt .psd .rcp .scad .skp .sldasm .sldprt .step
.stl .stp .svg .txt .x3d .zip
```

- maximum size: **1 GiB per file**
- multiple files
- `STL` and `OBJ` at maximum **30 MiB** can appear in the 3D viewer
- external-download-link documents are forbidden; files must be uploaded to
  Cults
- filename characters `&`, `>`, and `<` are rejected by the current uploader
  before it requests an S3 policy, with the message `Invalid character “X”`.
  Confirmed present in both the originally captured upload pack and the newer
  pack the deployed manifest points at (2026-08-02). ModelPrep's direct Electron
  and Worker transports now mirror this rule and fail closed before
  authenticating.
- `.rar`: the raw input includes it. The **originally captured** pack rejected
  RAR client-side with “use .zip instead”, but the pack the deployed manifest
  currently points at has **removed that check** (2026-08-02 signed-out
  bundle diff). Which pack the auth-gated create page loads today is UNKNOWN,
  and server-side RAR behavior was never tested. Do not restate “RAR is not
  accepted” as a current platform requirement; ModelPrep implements no `.rar`
  branch in either direction.

## 3.5 Photos and videos

**LIVE DOM + CURRENT BUNDLE**

Actual accepted media:

```text
.jpg .jpeg .png .webp .webm .mp4 .gif
```

Visible helper copy lists JPG, PNG, WebP, WebM, and MP4 but omits the accepted
GIF input. The `accept` attribute is the stronger source.

- maximum size: **10 MiB per media file**
- maximum image dimensions: **8000×8000**
- multiple media
- order is drag-and-drop
- first illustration ID is the cover
- no upload-time aspect-ratio crop was observed
- no total media-count cap was exposed by the page/bundle: **UNKNOWN**
- creators are told to put photos of actual prints first
- filenames should be descriptive for search ranking

ModelPrep's direct Electron and Worker-fallback preflight mirror the supported
JPEG/PNG/WebP/GIF/MP4/WebM MIME types, require an image first, and reject every
media item over 10 MiB before any authenticated upload request. Image dimensions
and total media count remain server/UI concerns because the current transport
does not receive decoded pixel dimensions and Cults exposes no count cap.

Therefore Cults **does not currently justify ModelPrep's 1:1 crop or 20-media
cap as platform requirements**. The production thumbnail service may visually
crop previews, but the upload contract preserves the ordered original media.

## 3.6 Price, license, and visibility

**LIVE DOM, USD and CZK price pages**

Pricing values:

```text
priced       fixed paid price
open_priced  open/pay-what-you-want price
free         free
```

For the USD page audited:

- fixed price minimum: **US$0.65**
- fixed price maximum: **US$1200.00**
- open-price suggested minimum: **US$0**
- open-price maximum: **US$1200.00**
- step: **0.01**
- displayed example commission: 20%; creator revenue: 80%

Currency-specific bounds may differ. Read `min`, `max`, and `step` from the
current price page for the selected currency.

The signed-in CZK page rechecked on 2026-08-08 reports:

- fixed price minimum: **14 CZK**
- fixed price maximum: **26,000 CZK**
- open-price minimum: **0 CZK**
- open-price maximum: **26,000 CZK**
- step: **0.01**
- the paid branch exposes a separate **Add discount** flow

ModelPrep currently exposes only free/fixed **USD** pricing. It does not expose
open price, a currency selector, or the discount flow, and its persisted
readback does not compare price, currency, or licence.

License values:

```text
""             CULTS PU - Private Use (default)
cults_cu       CULTS CU - Commercial Use
cults_cu_nd    CULTS CU-ND - Commercial Use - No Derivative
cc_by          CC BY
cc_by_sa       CC BY-SA
cc_by_nd       CC BY-ND
cc_by_nc       CC BY-NC
cc_by_nc_sa    CC BY-NC-SA
cc_by_nc_nd    CC BY-NC-ND
cc_pddc        CC0 / public domain
cern_ohl       CERN Open Hardware Licence 1.2
gpl            GNU GPL 3.0
lgpl           GNU LGPL 3.0
mit            MIT
```

Visibility values:

```text
public
secret
deactivated   (displayed as Draft on the current page)
```

Secret is a real unlisted publication mode. Deactivated is offline/draft, not
secret.

## 3.7 Upload/request lifecycle

**CURRENT BUNDLE + REQUEST CONTRACT**

For every file:

1. GET `/en/file_uploaders/new?blueprint=true`
2. receive the flat S3 policy fields
3. POST multipart directly to
   `https://s3.eu-west-3.amazonaws.com/files.cults3d.com`
4. parse the S3 XML `<Key>`
5. POST JSON `{key}` to `/en/blueprints`
6. receive `{id,url}`

For media use `illustration=true` and `/en/illustrations`.

The current uploader:

- requests the policy with same-origin credentials, XHR, CSRF, and JSON headers
- sets signed S3 fields as Dropzone params
- posts with `Accept: application/xml`
- sends `Content-Type`
- registers the resulting object key with Cults
- preserves drag order by ordered hidden ID fields

Creation form:

```text
POST /en/creations

creation[locale]
creation[name]
creation[description]
creation[details]
creation[usages][]
creation[category_id]
creation[sub_category_ids][]
creation[meta_tags][]
creation[flat_keywords]
creation[blueprint_ids][]
creation[illustration_ids][]
creation[made_with_ai]
creation[show_comments]
```

For usages, subcategories, and meta tags, the Rails form sends an empty leading
array value before the selected values. Preserve it.

Price/publish form:

```text
POST /en/creations/<slug>/price
_method=patch
creation[in_store]
creation[currency]
creation[pricing]
creation[download_price]
creation[download_open_price]
creation[license_type]
creation[visibility]
commit=Publish
```

Unpublish/deactivate:

```text
POST /en/creations/<slug>/unpublish
```

Success must be verified from the redirect/canonical design page and the
authenticated creations list. HTTP success alone is insufficient.

### Official public API boundary

Cults officially documents:

- one GraphQL POST endpoint: `https://cults3d.com/graphql`
- HTTP Basic Auth with the generated API username/password
- catalog metadata such as photos, titles, descriptions, and tags
- no access to other users' 3D files
- the contact-gated publish-prefill URL described above

That public documentation does not describe the complete file-upload and
price/visibility mutation sequence. ModelPrep's full publisher therefore uses
the authenticated website contract.

Production fingerprint at audit:

```text
upload bundle: packs/js/upload-dfc75bcc2698cddf6698.js
upload bundle SHA-256: d56b237a01987065d9881f26f3a81e87c105e9ab77ebf238bec677440b65d653
application bundle: packs/js/application-55aa4a3c30b1ef4b0a5b.js
application SHA-256: b9c3effe7240fbf86b4654003c1faa1eaf44d03eea754cda6c0f187b5146841d
stylesheet: assets/cults-2927b7e4264b8fefcb47c71771bc61c6030d0ee461595d6f25ac669c653e0540.css
```

Drift re-check, 2026-08-02 (signed-out public assets only):

```text
both bundles above still resolve with byte-identical SHA-256
rendered login page still loads application-55aa4a3c30b1ef4b0a5b.js
login-page stylesheet changed to cults-0b91bd688519750ef53d08431c3db22e787f2dc0e27c616dac0e76cc850bc8a3.css

deployed packs/manifest.json now points at NEWER packs:
  upload.js      -> packs/js/upload-f6d1a2a902153d3b47f2.js
  upload SHA-256 -> 88e20ebd7825d23e19792358d9e4567d3f027dc4e45e4b39c049cd5b1809b956
  application.js -> packs/js/application-458468f4077b74a265e5.js
```

The only contract-relevant difference between the captured upload pack and the
manifest-current pack is the removed `.rar` check described in 3.4. The
`&`/`>`/`<` file-name rule is unchanged in both. Which pack the auth-gated
create page serves is UNKNOWN until a signed-in capture is possible. Full diff
and evidence classes are in `cults3d-web-flow.md`.

---

# 4. Cross-platform transformation contract

The single ModelPrep Publish button must create one platform-specific payload
per selected active account. It must not send one lowest-common-denominator
payload unchanged to all sites.

| Concern | MakerWorld | Printables | Cults3D |
|---|---|---|---|
| description | constrained CKEditor HTML | Tiptap rich HTML | Markdown/plain textarea |
| summary | none separate | required ≤120 | none separate |
| title | ≤50 | ≤255 | current max unknown |
| tags | ≤50, ≤100 chars each | canonical labels, ≤25 chars each, total unknown | free tags max 20 / 300-char input plus fixed meta tags |
| category | dynamic MakerWorld leaf | dynamic Printables category ID | exact category integer + up to 3 matching subcategory IDs |
| license | MakerWorld string/matrix | dynamic license ID constrained by source/store | Cults code |
| visibility | public/private | draft then public/approval | public/secret/deactivated |
| images | cover 4:3 + optional 3:4; 16 gallery | ordered originals; first is cover; cap unknown | ordered originals; first is cover; cap unknown |
| video | one MP4/MOV ≤30s | not observed in model gallery | JPG/PNG/WebP/GIF/WebM/MP4 media |
| files | 3MF/raw branches, 200 MiB; `.lac` branch | typed model/print/SLA/other buckets, 1 GiB | broad blueprint list, 1 GiB |
| print profile | native Bambu 3MF profile + ≤37 photos | G-code/SLA metadata in file buckets | settings are text/details; no equivalent Bambu profile object |

### Newly mapped platform parity matrix — 2026-08-01

| Concern | Thingiverse | Thangs | MakerRoad |
|---|---|---|---|
| support boundary | official OAuth/API; prior license concern cleared by product owner on 2026-08-01 | no general public upload API found; custom API is account-gated | no public developer upload API found |
| safest state | Save as Draft | Private by default | Save + Private |
| files | model/CAD/document formats; ordered finalization | model, reference, attachment, standalone, dependencies, versions | model, print-config 3MF, images, instructions |
| model structure | one Thing with ordered files | single, bulk, multipart, assembly, primary parts, units | original/remix listing with ordered ids |
| metadata | name, Markdown summary/details, tags, dynamic category | name/description, categories/tags, folder/workspace, units | title ≤60, rich description, 1–3 categories, tags |
| media | ordered images; no verified count/crop; video URL in rich sections | image attachments plus reference files; count/crop unknown | 3–10 ordered 1:1-recommended images ≤10 MB; current native form has no video field |
| print data | detailed print/filament settings | print instructions, license file, model assets | FDM/LCD/Others, printer, material, color; separate 3MF configs |
| provenance | original/remix/source, AI, WIP, customizable, NSFW | remix permission, AI, feedback | original/remix/source, AI, NSFW |
| license | 13 open-source/CC/hardware licenses | license metadata plus PDF/TXT/MD license file | seven CC/CC0 combinations |
| monetization | not mapped | plans/tiers, marketplace, memberships, bundle/print-store branches | Free/Points/Cash; paid branches may be gated |
| publication | draft/publish and complete readback | private/public/access/plans and details/attachments/license readback | save/preview/publish, public/private, schedule, review, edit readback |
| current code | complete draft/publish adapter, UI, session bridge and readback; exact-app draft `7390480` live-certified | complete encrypted-token adapter, UI, signed uploads and three-part readback; exact-app private model `1583272` live-certified | complete `X-Token` adapter, UI, four upload roles and readback; exact-app private draft `M2134222528` live-certified; video explicitly unsupported because the current form has no field |

2026-08-08 Thangs correction: the table records intended schema breadth, not
implemented parity. The adapter drops renderer-provided units, access type,
plans, dependencies, version notes and feedback; bulk/multipart/assembly do not
have distinct implemented workflows. The live editor also exposes six Audience
modes, four print-compatibility flags, video embed URL, inspiration attribution,
and dynamic licences that ModelPrep does not map. Readback fetches three
surfaces but does not compare submitted and persisted state.

All three now have their own encrypted persistent desktop partition, account
marker, options card, adapter, IPC/preload route namespace, request ordering,
error normalization, per-platform receipt, safe default, canonical readback, and
safe-core exact-app live certification. What remains is optional-branch
certification; MakerRoad's current native form has no video field, so video is explicitly unsupported until a future contract appears.

Rules for the coordinator:

1. validate and transform independently per platform
2. preserve user order unless the platform has distinct cover slots
3. never silently publish public when the requested private state has no
   equivalent; stop or create a draft
4. never silently change license to make a submission pass
5. carry only the number/types the platform actually accepts
6. surface per-platform partial failure while continuing other selected targets
7. verify each resulting platform ID/status independently
8. label simulations explicitly and never link them as real listings

---

# 5. Current ModelPrep parity and gaps (2026-08-02)

## Implemented

- one-button publishing to selected active MakerWorld, Printables, Cults3D,
  MyMiniFactory, Nexprint, Creality Cloud, MakerOnline, MakerRoad, Thangs, and
  Thingiverse accounts, with up to four desktop flows active at once and
  individual buttons retained
- per-platform description conversion, tag mapping, category/license choices,
  file upload adapters, and independent status handling
- MakerWorld 3D original/remix, raw/3MF, print profile, docs, BOM, linking,
  exclusive, CyberBrick payload support, private/public, delete/status handling
- MakerWorld Laser & Cut raw/`.lac` payload support and draft/create coverage
- Printables draft-first GraphQL upload, CRC32C finish/poll, original/remix/
  reupload payload support, configurable draft/public batch action, file
  folders/notes, native HEIC conversion, G-code/SLA/retained-ZIP controls,
  readback/publish/delete; specialist draft `1797772` and public model `1797774`
  are live-certified, while deletion remains pending exact confirmation
- Cults signed upload, blueprint/illustration registration, creation form,
  manufacturing settings, current allow-listed meta tags, AI/comments,
  price/license/visibility, unpublish, and fail-closed ordered edit/list
  readback for persisted IDs, filenames, title and visibility
- Nexprint encrypted desktop session, first-party REST/presigned upload,
  dynamic taxonomy/account options, draft-first create/update, and edit-info
  readback; both production browser and ModelPrep Electron
  upload/draft/readback paths are account-certified for the bundled fixture
- Creality encrypted desktop session, exact current category/license/source/
  maturity controls, first-party JSON plus Aliyun STS upload, existing-draft
  edit, private/public create, and read-back verification; the Original/private
  STL plus web/app-cover path is account-certified as model
  `6a6e3f28753b84f6aab190a8`
- MakerOnline encrypted desktop session, live category/kit/eligibility reads,
  all current metadata branches, multipart scenes 1/2/5/6/8, server 3MF parsing,
  draft/public create, and edit-info readback; the core unpublished one-image +
  one-STL path is account-certified as retained draft `316221`
- MyMiniFactory encrypted desktop session, current form metadata and all license
  choices, JPEG-normalized ordered images, presigned object-file upload,
  hierarchical category ids, Private/Public submit, and canonical object
  read-back; latest private object `829056` passed exact-app and independent
  hydrated-editor verification; safe submit diagnostics retain no credentials
- Thingiverse encrypted session, draft/publish adapter, ordered files/media,
  taxonomy, license, optional metadata and complete readback; written clearance
  recorded and production mutation enabled
- Thangs encrypted local-storage bearer-token recovery, authenticated identity,
  signed uploads, validation, model structures/assets and three-part readback
- MakerRoad authenticated `X-Token` session, four upload roles, dynamic metadata,
  private Save/review Publish and required `uploadType=1` edit readback; latest
  exact-app private draft `M2134222528` passed. The current renderer now also
  fails closed on readback title/privacy/plan/price-type or present role-count
  mismatches before it reports a save verified.

## Confirmed current gaps or misleading local defaults

1. **MakerWorld video is implemented but not live-certified.** ModelPrep accepts
   one MP4/MOV, preflights duration ≤30 seconds, uploads through the current
   model-media contract, waits for completion, and serializes `designVideo`.
   A harmless private draft with video still needs account-backed readback.
2. **Printables preserves original image geometry and has no enforced gallery
   count.** Its previously guessed 4:3 crop and 25-image cap were removed.
3. **Cults preserves ordered original media with no guessed total count.** Its
   previously guessed 1:1 crop and 20-media cap were removed.
4. **Cults typed video media is implemented but not live-certified.** MP4/WebM
   records remain separate from images and are sent only to Cults-compatible
   illustration upload paths. The 2026-08-01 signed-in edit-page audit proved
   ordered illustration IDs and persisted filenames are readable after submit;
   desktop and Worker transports now preflight the live MIME list (including
   GIF), image-first ordering, and the 10 MiB media cap; they retain the receipt
   but refuse certification when any ordered ID/name, title, or visibility
   differs. No video listing was created during this read-only audit.
5. **Cults title/description hard caps remain unknown.** Do not add guessed
   caps. Continue to enforce requiredness and server errors.
6. **Printables rich-description-image cap is 8 MiB in the active `v4.8.10`
   editor.** It is enforced before presign. Gallery count, gallery-image byte
   cap and fixed aspect-ratio requirements remain unknown.
7. **MakerWorld eligible CyberBrick combinations remain unsubmitted.**
8. **MakerWorld final `.lac` submit remains unverified with a genuine Bambu
   Suite fixture.**
9. **Printables specialist and normal-public branches are live-certified.**
   Exact-app draft `1797772` passed retained ZIP, G-code, SLA/SL1 and converted
   HEIC plus full readback; public model `1797774` reached persisted live state.
   Deletion awaits explicit confirmation. Store/Club and approval-required
   publishing require eligible accounts; unpacked ZIP, remix/reupload and rich
   description image upload remain separate round trips.
10. **Cults paid/open-price, multi-usage, subcategory, meta-tag, video, and
    public publication combinations need non-destructive dedicated test
    listings and cleanup.** Manufacturing settings, the current 12 fixed meta
    tags, AI disclosure and comments are now propagated and locally tested;
    that does not replace an authorized secret-branch persistence check.
11. **Nexprint's gallery ordering, activity eligibility, and
    extension matrix remain only mapped or locally tested.** Public publishing
    was deliberately excluded from the certification boundary.
12. **Creality is certified only for the tested Original/private combination.**
    Existing-draft editing, public publishing, the remaining file/media combinations,
    Remix/Non-original structured attribution, account-gated paid controls and
    parsed Print Settings Info remain deliberately gated; see
    `creality-web-flow.md`.
13. **MakerOnline is certified only for the tested unpublished core path.**
    `.3mf` parsing/profile media, documentation, Remix, public, Creative Kit,
    China sync, Exclusive, Resin-only, paid, and high-count/large-file branches
    remain separate certification gates; see `makeronline-web-flow.md`.
14. **MyMiniFactory's private safe core is live-certified.** Exact-app object
    `829056` and independent hydrated-editor readback confirmed hierarchical
    categories, assets, metadata and private visibility. Public review, remix,
    declarations, advanced print data and other optional combinations remain
    separate certification gates. The current signed-in refresh additionally
    observed native dimensions `maxlength=100` and material quantity
    `maxlength=45`; ModelPrep now enforces and reads those advanced fields back
    locally. Retained private specialist `829284` independently proved the
    advanced print/license/remix fields, but the original app readback receipt
    failed closed on the now-corrected `remix-checkbox` name; do not duplicate it.
    Sanitized failure diagnostics are implemented.
15. **Thingiverse's unpublished safe core is live-certified.** Exact-app draft
    `7390480` passed upload/create/finalize/readback after same-page token recovery.
    Public publication and rich-section/education/remix/optional fields remain
    explicit, separately certified branches; see `thingiverse-web-flow.md`.
16. **Thangs' private single-part safe core is live-certified.** Exact-app model
    `1583272` passed details, attachments, license and metadata readback. Multipart,
    bulk/assembly, versions, plans, paid/membership, public/access and other
    optional structures remain; see `thangs-web-flow.md`. The later v4 Images/
    part-association correction is local-only, and “passed readback” must not be
    expanded into exact field-by-field equality.
17. **MakerRoad's private Save core is live-certified.** Exact-app draft
    `M2134222528` passed authenticated create and required `uploadType=1` edit
    readback. A subsequent full form/bundle audit added local fail-closed
    comparisons for title, privacy, plan, price type and present asset-role
    counts. The current native form has no video input or serializer; public/review, paid, remix, schedule
    and other optional combinations remain separate gates; see
    `makeroad-web-flow.md`.

“Adapter implemented” and “all combinations live-certified” are different
states. Do not call a platform fully certified until every relevant row above
has account-backed create, asset readback, correct visibility/status, and
deliberate artifact-retention or cleanup evidence.

---

# 6. Change-detection checklist

Repeat this audit before a public release and whenever a platform upload breaks.

## MakerWorld

- capture Next build ID
- inspect `/my/models/publish`, remix, existing draft edit, existing profile
  edit, Laser & Cut publish, and import page
- diff every `input.accept`, `maxFiles`, `maxSize`, duration, counter, radio,
  and category option
- search current bundles for `videosIsUploading`, `designVideo`,
  `profilePictures`, `coverPortrait`, `createWith3mf`, `createWithLac`
- compare create/update/submit and status responses

## Printables

- completed read-only on 2026-08-02: recorded `v4.8.10`; inspected signed-in
  create and retained-draft edit surfaces; exercised unsaved author/remix/
  reupload and draft/public UI branches; diffed file types, text limits,
  categories, licenses, and current GraphQL operations; updated ModelPrep's
  client header and 95-character note/60-character folder-name controls
- completed exact-app specialist/private proof on 2026-08-02: draft `1797772`
  retained ZIP, G-code, SLA/SL1 and converted HEIC with ordered asset and
  metadata readback
- completed exact-app normal-public proof on 2026-08-02: model `1797774`
  reached persisted live state and remains public pending deletion confirmation
- still account/action gated: eligible Store/Club/price/tier/commercial-use
  rendered state; approval-required publishing; permanent deletion; unpacked
  ZIP, remix/reupload and authenticated rich-description image upload

## Cults3D

- inspect `/en/creations/new`, an existing edit page, and the same creation's
  `/price/edit` page
- diff React uploader props (`accept`, sizes, dimensions, URLs)
- diff usage/category/subcategory/meta-tag options and form names
- inspect currency-specific price min/max/step
- verify policy → S3 → register → creation → price → canonical readback
- re-check official `/en/api` and `/en/pages/graphql`

## Nexprint

2026-08-08: signed-in read-only inspection confirms the raw/core editor, but
current attachment help omits `.gcode` and `.goo` while ModelPrep accepts them.
The retained 3MF has no visible profile section and ModelPrep always sends an
empty `settingList`. Rich editor asset/media/table branches are unmapped.
Receipt verification checks only object presence and optional status, not the
submitted fields or ordered assets.

- record the current production build fingerprint and re-check the signed-in
  `/en/upload`, `/en/editUpload/{id}`, Publish manager Draft tab, taxonomy,
  activity, and collection surfaces
- diff upload modes, every file input accept list, size/count caps, text
  counters, originality/source branches, license combinations, BOM rows,
  profile-cover modes, and category options
- verify presign → raw PUT → file registration →
  `createOrUpdateBatch(status:0)` → `getEditInfo`
- confirm the canonical draft edit route reproduces model files, cover/gallery
  ordering, parsed 3MF settings, taxonomy ids, account options, and license
- verify the account's Published Models count remains unchanged during
  draft-only certification
- repeat the ModelPrep Electron connected-account certification when the
  first-party request contract or production bundle changes; do not infer
  future compatibility from the 2026-07-31 fixture

## MakerOnline

2026-08-08 signed-in correction: the blank production create form still matches
the detailed visible option map, and retained draft `316221` visibly contains 20
images, three raw files, its metadata/category/licence, and zero Print Profile
Files. The account now has eight retained drafts; the pass changed none of them.

This does not establish complete parity. ModelPrep has no control for native
inline Quill description images. Its current receipt tolerates absent fields and
checks only title/category plus minimum image/raw-file counts; it does not verify
exact order/names, description, tags, licence, permission/state, print method,
AI/NSFW, documentation, kits/sync/Exclusive, or print-profile metadata/media.
Exclusive was unavailable to this account and also requires actual printed
photos plus applicable assembly instructions. Keep all optional branches open.

- re-open `/en/upload` and `/en/importThirdPartyModel` in a signed-in account
- diff all file `accept` attributes, count/size limits, two-step conditional
  branches, taxonomy, licenses, kits, and account-gated eligibility responses
- verify scene `2` images → scene `1` raw files → optional scene `5` 3MF parse →
  scene `6` profile photos → scene `8` documentation → `save-draft` → `edit-info`
- confirm `Authorization` is still the raw decoded `mo_access_token` with no
  `Bearer` prefix and that no credential crosses the preload boundary
- verify the account's public creation count remains unchanged during draft-only
  certification
- re-check the Printables/Thingiverse import proof flow without logging its
  server-generated verification phrase

## MyMiniFactory

- re-open `/upload/object` in `persist:myminifactory` and confirm the current
  passwordless email-code session still validates through Chromium
- diff `uniqFolderName`, CSRF field names, image upload, presign/complete,
  accepted model/image families, declarations, licenses, visibility, print
  details, and hierarchical category ids
- verify managed submit follows the redirect and obtains the final object URL;
  do not restore `redirect: manual`
- inspect `/object/edit/{id}` and confirm title, Private state, ordered images,
  object files, tags, description, license, and every required category id
- use the GET-only `Verify existing object` control to re-read an existing
  object; never use `Retry N failed only` for a MyMiniFactory receipt failure,
  because that re-enters the create flow and can duplicate a retained object
- treat boolean attributes per the HTML spec: the same edit page emits
  `selected=""`, `selected="selected"` and bare `checked`, and
  `threedobject_type[support_free]` is a hidden input carrying its value rather
  than a checkbox
- recheck `can_use_zip_mode` and `isPremiumCreator` in the `UploadFilesWrapper`
  props before assuming ZIP/archive or premium branches are unavailable; they
  are account-gated, not absent
- keep Node-standalone/Cloudflare 403 distinct from an expired browser session

## Creality Cloud

2026-08-08: the signed-in full FlowPrint form confirms structured Remix/
Non-original attribution, Boost Me, instruction files, and a separate parsed
3MF profile with cover/gallery/description/printer compatibility. ModelPrep
does not serialize those source/profile/editor branches; retained evidence shows
the 3MF was dropped. Its receipt conditionally checks only title, visibility,
category and minimum raw-model count, leaving most persisted fields unverified.

- inspect the signed-in create iframe, current production bundle, category and
  license data, source/originality branches, cover slots, file/media roles, and
  account-gated controls
- verify token/user/device capture and short-lived Aliyun STS request/PUT flow
- distinguish new private/public model creation from editing an existing
  `draftId`; do not invent a new-draft route
- verify canonical model readback and fail closed on unsupported Non-original
  attribution or parsed print-settings structures

## Thingiverse

- recheck the authenticated five-step editor, official developer changelog/API
  pages, accepted file/media inputs, categories, licenses, optional metadata,
  terms checkbox, Save as Draft, Publish, and edit/readback endpoints
- retain the 2026-08-01 written-clearance record; keep the emergency injectable
  fail-closed override, but do not restore the production legal blocker
- certify Save as Draft separately from public Publish and record ordered
  file/media finalization plus complete metadata readback
- keep unknown model-size/image-count/aspect requirements unknown

## Thangs

- inspect current `thangs.com` bundles and
  `production-api.thangs.com` routes before changing auth or payloads
- confirm local-storage access-token capture, encrypted recovery, refresh cookie,
  and authenticated `users/current?likes=false` validation
- never restore cookie-only identity or manually set a cross-origin `Referer` in
  Electron `session.fetch`
- preserve first-party signed PUT content types: binary model uploads use
  `application/octet-stream`; text/Markdown/PDF use explicit textual types
- verify current create → signed PUT → `v4/models/validate-files` → draft part
  readback → `PUT v4/models/{id}/details`; do not restore retired `v2/models`
  all-in-one create or nonexistent assets routes
- compare intended and persisted details, images/order, references, parts/
  primary, audience, print compatibility, attribution and licence; response
  presence alone is not certification

## MakerRoad

2026-08-08: normal Chrome redirected to Log In, so this pass could not refresh
the authenticated form. The August 7 signed-in evidence remains controlling:
all seven saves were rejected. Local print-method and rejection handling fixes
have no corrected live save. Readback remains conditional and omits exact asset
identity/order and most metadata/optional fields; a Save must not be described
as a safely retained private draft because MakerRoad sends it through review.

- check fresh service availability before inspecting or mutating; a cached old
  page is not proof that the production route has returned
- require authenticated `/api/user` and mirror `X-Token` from cookie to header;
  never validate with public taxonomy alone
- recheck upload roles/counts/sizes, categories, printers/materials, licenses,
  Original/Remix, visibility, schedule, price, Save/Preview/Publish, and video
  serialization
- after availability returns, certify one private Save and `/models/getEdit`
  readback before describing the destination as upload-ready

Record the audit date, page URLs, production build/bundle filenames, SHA-256
fingerprints, and whether each fact came from DOM, bundle, request capture, or
server validation.

## Related implementation references

- `backend/docs/makerworld-web-flow.md`
- `backend/docs/makerworld-upload-flow-map.md`
- `backend/docs/printables-web-flow.md`
- `backend/docs/cults3d-web-flow.md`
- `backend/docs/nexprint-web-flow.md`
- `backend/docs/creality-web-flow.md`
- `backend/docs/makeronline-web-flow.md`
- `backend/docs/myminifactory-web-flow.md`
- `backend/docs/thingiverse-web-flow.md`
- `backend/docs/thangs-web-flow.md`
- `backend/docs/makeroad-web-flow.md`
- `backend/src/adapters/makerworld-web.ts`
- `backend/src/adapters/printables-web.ts`
- `backend/src/adapters/cults3d-web.ts`
- `desktop/main.js`
- `desktop/makerworld-direct-entry.ts`
- `desktop/myminifactory-direct.js`
- `desktop/nexprint-direct.js`
- `desktop/creality-direct.js`
- `desktop/makeronline-direct.js`
- `desktop/makeroad-direct.js`
- `desktop/thangs-direct.js`
- `desktop/thingiverse-direct.js`
- `deploy/src/App.jsx`
