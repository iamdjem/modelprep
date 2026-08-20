# Creality Cloud authenticated upload flow

Live audit: **2026-07-31**. Surface: signed-in production account on
`https://www.crealitycloud.com/create-model-new?editType=editModel` (the editor is a
same-origin `/flowprint/create-model` iframe). This document records the observed DOM,
production JavaScript contract and read-only request traffic. No public listing was
created during discovery.

## Method and API choice

Creality documents uploads through its website/app and publishes a separate batch-upload
tool guide, but no documented third-party model-upload API or developer upload scope was
found. The production editor uses private first-party JSON endpoints and short-lived
Aliyun STS credentials. ModelPrep therefore uses the same pattern as the other
first-party-only integrations:

1. open Creality's real sign-in/editor in `persist:creality`;
2. keep `model_token`, `model_user_id`, cookies and STS credentials in Electron main;
3. expose only `desktop-managed-creality-session-v1` to the renderer;
4. upload from the user's computer directly to Creality's Aliyun buckets;
5. edit an existing draft when a `draftId` exists, or create a new private/public model;
6. read the saved object back before reporting success.

Current certification update: the later exact packaged closeout retained
Original/private model `6a6e3f28753b84f6aab190a8`; images, model files,
metadata and private-state readback passed. The 2026-07-31 models below remain
valid diagnostic evidence. Existing-draft edit, public, non-original/remix,
instruction/print-settings and eligible paid branches remain separate.

## 2026-08-08 signed-in continuation audit

The current new-model page and embedded FlowPrint editor were reopened as
`user8155669516` without selecting a file or submitting. The form confirms
files/folders, three source modes, 60-character title, category, 20 tags, dual
4:3/3:4 covers, nine images, NSFW, licence questions, Public/Private, required
rich description, instruction files, and the complete one-3MF Print Settings
branch with separate cover/gallery/description and compatible printers.

Current visible image help says `jpg/gif/png, <=20MB`; older `.jpeg/.webp`
evidence is not independently current-form certified. Paid state was not visible
at this blank-form depth.

ModelPrep implements only the Original core. It does not send structured
Remix/Non-original attribution or proof images, the native parsed 3MF profile
and its media/description/printers, Boost Me, inline editor assets, per-file
notes, or paid/agreement branches. Retained evidence shows the practical result:
the 3MF was absent and only two STL files persisted.

Receipt verification also accepts absent fields and compares only optional
title/category/visibility plus minimum raw-model count. It does not certify
asset names/order, descriptions, tags, licence, maturity, instructions, source,
profile fields, or paid/agreement state.

Official references:

- <https://www.crealitycloud.com/help-center/how-to-upload-3d-models>
- <https://www.crealitycloud.com/help-center/creality-cloud-file-batch-upload>
- <https://www.crealitycloud.com/help-center/Creality-Cloud-supported-formats>
- <https://www.crealitycloud.com/policy/user-agreement>

## DOM map

### Model files

- Multiple files; the native form also offers **Create Folder**.
- Accepted: `.stl`, `.obj`, `.ply`, `.off`, `.3mf`, `.3ds`, `.wrl`, `.dae`,
  `.step`, `.stp`.
- A `.3mf` may be uploaded as a normal model. The separate Print Settings Info path is
  described below.

### Model source

- **Original** (`1`).
- **Remix Models** (`3`). Shows a Creality model search/URL field. The selected source is
  submitted as structured `modelOrigin` objects, not just a string URL.
- **Non-original** (`2`). May require proof images (`workRegist`, up to six in the current
  bundle) in addition to source attribution.
- The UI warns that CC BY-ND and CC BY-NC-ND sources do not permit derivatives.

ModelPrep's direct action currently accepts Original only. Remix/Non-original remain
mapped in the UI but fail preflight instead of inventing attribution/proof structures.

### Required metadata

- **Name**: required; live counter is `0 / 60`.
- **Category**: required; two-level picker; top-level nodes are also selectable
  (`checkStrictly: true`, expand-on-hover).
- **Tags**: up to 20.
- **Model Cover**: required.
  - web cover: 4:3;
  - app cover: 3:4 and displayed larger in the app;
  - `.jpeg`, `.jpg`, `.png`, `.webp`, `.gif`; 20 MB maximum per image.
- **Model gallery**: up to 9; 4:3 recommended; the page asks for real-print photos.
- **Maturity checkbox**: “Models may include nudity, violence, blasphemy, or other
  potentially disturbing content.” Maps to `general` / `restricted`.
- **License**: required; all eight combinations are mapped below.
- **Visibility**: required for new models.
  - Public (`isShared: true`): visible/downloadable and eligible for rewards;
  - Private (`isShared: false`): stored in the user's cloud storage;
  - Draft: the separate `modelDraft/edit` API edits an existing draft id; the
    current new-model page does not create a new draft.
- **Model Description**: required by the native submit validator; TinyMCE rich text.

### Rich-text editor controls

The model and print-setting descriptions expose Undo, Redo, font size, Bold, Italic,
text color, clear formatting, alignment, bullets, numbering, decrease/increase indent,
image insertion and link insertion. The model description additionally exposes
**Boost Me**.

Boost Me opens **Edit boost**, with a short “Boost Me” label and a call-to-action message
up to 500 characters. It is not the upload-page AIGC helper. The optional AIGC helper is
`POST /api/cxy/v2/ai/modelCreateAssistant` and can suggest category, tags and description
from a cover/title; ModelPrep does not call it automatically.

### Instruction files

Multiple files are accepted:

`.txt`, `.pdf`, `.doc`, `.xls`, `.html`, `.rtf`, `.gif`, `.bmp`, `.docx`, `.xlsx`,
`.pptx`, `.wps`, `.png`, `.ppt`, `.jpg`, `.jpeg`.

### Print Settings Info (optional)

- Exactly one `.3mf` print setting.
- Native Creality Print 5.0+ `.3mf` is preferred.
- OrcaSlicer 1.4+ and Bambu Studio 1.07+ files are offered conversion to Creality Print.
- Separate required 4:3 print-setting cover plus up to 9 images, each at most 20 MB.
- Separate TinyMCE description.
- Printer compatibility is derived from the parsed `.3mf`; the checkboxes remain
  disabled until parsing completes.
- Printer taxonomy is live and must not be hard-coded:
  `POST /api/cxy/v2/device/printerTypeListNew {"ignoreEngine":true}`.
- The current hot/compatible section included K2 Plus, K2 Pro, K2, K2 SE, SPARKX i7,
  Creality Hi, Ender-3 V4 and K1-family variants. **More Models** expands the dynamic
  taxonomy.

The model `model3mf` object contains `filekey`, `size`, `name`, `thumbnail`,
`relationPrinters`, `printerName`, `layerHeight`, `currBedType`, `nozzleDiameter`,
`sparseInfillDensity`, `isCanPrint`, `plateList`, `secondName`, `wallLoops`, `covers` and
`desc`. ModelPrep does not synthesize these fields from its current mock profile parser;
a `.3mf` is safely uploaded as a normal model until a real parser can certify them.

### Account-gated options

Creality's official guide describes Free/Paid. The production bundle renders price only
when `POST /api/cxy/v3/user/checkUserCondition` permits paid models. The newly-created
account did not expose price, so ModelPrep does not claim or show paid publishing for it.
No additional public/private fields appeared for this account.

### Native final action

The page's **Submit** creates a model. The official guide also describes a copyright
statement before public publishing. If Creality presents a new agreement/modal at action
time, ModelPrep must stop for the user's confirmation; it must not accept legal terms
silently.

## Category taxonomy (exact API ids)

Captured from `categoryList {"type":7}` on 2026-07-31. These are not the picker
array positions; a create request with a position such as `12` is normalized by
the service to uncategorized (`0`).

- `1731` 3D Printers
  - `1316` 3D Printer Parts; `1904` 3D Printer Accessories; `1645` Test Models;
    `6006` Other
- `1670` Art & Design
  - `1662` Digital Art; `1584` Sculptures & Artworks; `1341` Badges & Coins;
    `1997` Industrial Design & Prototypes; `6005` Other
- `1809` Toys & Games
  - `1575` Board Games & Card Games; `1141` Construction Toys; `1793` Game Props;
    `6007` Other
- `1519` Hobbies & DIY
  - `1741` Electronics & RC (Remote Control); `1648` Robots & Mechs;
    `1194` Drones & Aircraft; `1420` Sound & Audio Equipment;
    `1246` Sports & Exercise Equipment; `6004` Other
- `1010` Household
  - `1150` Home Decorations & Ornaments; `1096` Lighting & Lamps;
    `1775` Home Appliance Accessories; `1671` Tools & Spare Parts; `1151` Pets;
    `6000` Other
- `1175` Fashion
  - `1966` Cosplay; `1693` Jewelry & Accessories; `1598` Apparel, Shoes & Hats;
    `1647` Personal Accessories; `6002` Other
- `1501` Education
  - `1974` Stationery & Learning Tools; `1343` Educational Aids; `6003` Other
- `1952` Miniatures
  - `1025` Characters & Creatures; `1888` Miniature Games & Accessories;
    `1846` Props & Terrain; `1982` Vehicles & Machinery; `6008` Other
- `1160` Medical & Health
  - `1192` Medical & Health Equipment; `1765` Personal Care Devices; `6001` Other
- `6012` MakeNow
  - `6014` MagicRelief; `6010` CubeMe; `6013` SnapForm; `6011` SignForge

## License question map

The native UI asks whether adaptations and commercial use are allowed. Some combinations
add “Allow sharing or redistributing of your work or its derivatives?”

| Stored license | Adaptations | Commercial | Sharing/redistribution |
| --- | --- | --- | --- |
| `CC BY` | yes | yes | no/normal CC attribution |
| `CC0` | yes | yes | yes/public domain |
| `CC BY-SA` | ShareAlike | yes | derived from SA |
| `CC BY-ND` | no | yes | derived from ND |
| `CC BY-NC` | yes | no | derived from CC |
| `CC BY-NC-SA` | ShareAlike | no | derived from SA |
| `CC BY-NC-ND` | no | no | yes within ND terms |
| `CXY-SL` | no | no | no; personal use only |

The production combination keys are respectively `1,1,2`, `1,1,1`, `3,1,0`, `2,1,0`,
`1,2,0`, `3,2,0`, `2,2,1`, `2,2,2`.

## Session and request headers

Authentication state is held in cookies named `model_token` and `model_user_id`. The
Nuxt request wrapper mirrors them into `__CXY_TOKEN_` and `__CXY_UID_`. Requests also
send:

`__CXY_APP_CH_`, `__CXY_APP_ID_`, `__CXY_APP_VER_`, `__CXY_BRAND_`, `__CXY_DUID_`,
`__CXY_OS_LANG_`, `__CXY_OS_VER_`, `__CXY_PLATFORM_`, `__CXY_REQUESTID_`, and
`__CXY_TIMEZONE_`.

`__CXY_DUID_` must reuse the persisted `__CXY_DUID_` / `model_device_id` cookie.
ModelPrep does not synthesize a new device id for each saved session.

ModelPrep keeps their values in Electron main and safeStorage. Logs, tests, renderer state
and Worker traffic contain no raw token/cookie/STS value.

## File-upload transport

1. `POST /api/cxy/v2/common/getOssInfo` returns:
   - endpoint `oss-accelerate.aliyuncs.com`;
   - image bucket/CDN (`pic2-creality` / `https://pic2-cdn.creality.com/`);
   - file bucket/CDN (`file2-creality` / `https://file2-cdn.creality.com/`);
   - private internal model-staging bucket.
2. `POST /api/cxy/account/v2/getAliyunInfo` returns short-lived
   `accessKeyId`, `secretAccessKey`, `sessionToken` and lifetime.
3. The page uploads with Aliyun OSS. Roles and buckets:
   - `crealityCloud/upload/…` → image bucket (covers/gallery);
   - `doc/…` and generated `gcode/…` → file bucket;
   - `model/…`, `texture/…` and `file3mf/…` → private internal staging bucket;
   - the create service validates model keys in that internal bucket before it
     accepts `modelList`.
4. Raw-file keys use `<role>/<content-md5>.<extension>`; the native image
   cropper instead uses `crealityCloud/upload/<content-md5>.<extension>`.
5. The production page uses multipart uploads with 1/2/5 MiB parts depending on file
   size, four parallel parts and a 180-second timeout. ModelPrep uses the official OSS SDK
   from Electron with the same STS credentials and content-disposition metadata.

## Save, publish and read-back APIs

### Draft

`POST /api/cxy/v3/modelDraft/edit`

This endpoint edits an existing draft and requires its `id`. In the production
new-model route, the **Save draft** control is rendered only when the URL already
contains `draftId`; calling it without an id returns `参数非法` (invalid parameter).
Creality's supported non-public action for a brand-new upload is therefore
**Private**, through `modelGroupCreate` with `isShared: false`. ModelPrep rejects
new-draft creation before making the request, but retains this mapping for future
editing of an already-existing draft.

```json
{
  "id": "existing-draft-id",
  "modelInfo": { "...": "base model info" },
  "modelFiles": [{
    "fileKey": "model/...",
    "fileName": "part",
    "fileSize": 123,
    "folderName": "default",
    "folderSort": 1
  }],
  "otherFiles": [{ "fileKey": "doc/...", "fileName": "guide.pdf", "fileSize": 456 }]
}
```

The current first-party client flattens root-level files as `folderName: "default"` and
`folderSort: 1`. For browser-renderable formats it may include a type-2 `cover`. It
explicitly skips that rendered-cover record for `.3mf`, `.step`, and `.stp`; ModelPrep
must preserve this per-format distinction. An empty gallery omits `modelInfo.covers`.

The first step's two file modes are also distinct: a slicer-generated **Print
Configuration File** is not a raw model entry. Until the parsed Creality print-setting
path is enabled, ModelPrep excludes any `.3mf` already linked to a project print profile
from `modelFiles`; ordinary, non-profile `.3mf` models remain supported there.

**Correction (2026-08-08).** The paragraph above describes behaviour that no
longer exists. `crealityRawModelFiles` stopped excluding profile-linked `.3mf`
files on 2026-08-07; it now filters on format and blob only, so an ordinary or
profile-linked `.3mf` both stay in `modelFiles`. The only thing still removing
the fixture's Bambu profile was the **shared** auto-exclusion default
(`platform-files.js`), because Creality's native slicer is Creality Print. See
the slice below.

Read back with `POST /api/cxy/v3/modelDraft/detail {"id":"…"}`. List with
`POST /api/cxy/v3/modelDraft/list {"page":1,"pageSize":50}`.

### Private/public model

`POST /api/cxy/v3/model/modelGroupCreate`

```json
{
  "groupItem": {
    "pcCovers": [], "appCovers": [], "covers": [],
    "categoryId": "1575", "groupName": "…", "groupDesc": "…",
    "isShared": false, "modelSource": 1, "pricingMethod": 0,
    "isPay": false, "license": "CC BY-NC", "maturityRating": "general",
    "include3mf": false, "printType": [1], "tags": [],
    "displayVersion": "cxy-gen2", "colorFilament": [], "type": 1
  },
  "modelList": [], "otherFiles": []
}
```

The response id is `result.groupItem.id`. Read back with
`POST /api/cxy/v3/model/modelGroupDetail {"id":"…"}` and verify title plus `isShared`.

### Related mapped endpoints

- `POST /api/cxy/v2/common/categoryList {"type":7}` (`7` is the current
  production client's `MODEL_V3` enum value; the returned ids are stable API
  ids, not picker positions)
- `POST /api/cxy/v3/model/fileListPage`
- `POST /api/cxy/v3/model/fileOtherListPage`
- `POST /api/cxy/v3/model/upload3mf`
- `POST /api/cxy/v3/model/3mfEdit`
- `POST /api/cxy/v3/model/modelGroupBaseInfoEdit`
- `POST /api/cxy/v3/model/modelFileAndOtherEdit`
- `POST /api/cxy/v3/model/originModel`
- `POST /api/cxy/v3/model/3mfDetail`
- `POST /api/cxy/v3/model/3mfList`
- `POST /api/cxy/v3/model/3mfPrinterList`
- `POST /api/cxy/v3/model/convert3mfInsert` and `convert3mfDetail`
- tag validation/recommendation: `/api/cxy/v2/tagv2/checkBlack`,
  `/api/cxy/search/tagSearch`, `/api/cxy/v2/tagv2/recommendList`
- moderation: `/api/cxy/v2/green/content`, `/api/cxy/v2/green/image`
- video pre-upload exists at `/api/cxy/v2/common/preUploadVideo`, but the current model
  form exposes no direct video file field; Creality's guide suggests a YouTube link.

## ModelPrep coverage and safety boundary

Implemented:

- isolated sign-in, encrypted session and account discovery;
- exact current category/license/source/maturity/visibility UI;
- 4:3 web and 3:4 app covers;
- up to nine 4:3 gallery images;
- all live model-file extensions and instruction-file extensions;
- rich description, tags, category, license and NSFW rating;
- existing-draft edit plus private and explicit public create actions;
- draft/model read-back verification;
- Demo mode remains simulation-only.

Intentionally gated:

- Remix/Non-original direct submission until structured attribution and proof objects can
  be certified for a real source;
- paid publishing until the signed-in account is eligible;
- parsed Print Settings Info until ModelPrep has a real `.3mf` parser rather than its
  prototype preview data;
- public publishing is never part of certification unless the user explicitly requests
  it at action time.

## Live private certification (2026-07-31)

The source ModelPrep Electron adapter completed a real account-backed Original/private
create and first-party read-back:

- model id: `6a6cc6ab96c1c2d13f2b1a6b`;
- title: `ModelPrep Private Certification 2026-07-31`;
- visibility: `isShared: false`;
- category: `1575` (Toys & Games › Board Games & Card Games);
- assets: one accepted STL, one 4:3 web cover, and one 3:4 app-cover record;
- result: <https://www.crealitycloud.com/model-detail/6a6cc6ab96c1c2d13f2b1a6b>.

## Draft contract correction (2026-07-31)

The first six-platform real batch exposed that the draft route had only been
mock-tested: `modelDraft/edit` returned `参数非法`. A same-day comparison with
the current signed-in `/flowprint/create-model` client established that the Save
Draft action is available only when the route already contains a `draftId`.
`modelDraft/edit` is an edit endpoint, not a new-draft endpoint. Calling it
without `id` was the direct cause of the error.

ModelPrep now rejects unsupported new-draft creation before any request, keeps
existing-draft edit support when an id is supplied, and normalizes new
non-public uploads to **Private**. A targeted private create/readback succeeded
as model `6a6cc6ab96c1c2d13f2b1a6b`; the other five batch destinations were not
re-run, avoiding duplicates.

An earlier private diagnostic create, `6a6c8db2753b84f6aaa20e7e`, exposed that
captured picker positions were not category ids: the service persisted category `0`.
That finding led to the live `categoryList {"type":7}` map and a submit-time allowlist.
Both private artifacts were retained because deletion was not part of the authorized
test. No public model was created.

This certifies this account's Original/private STL + cover create/read-back path. It
does not certify editing an existing Draft, public publishing, other model extensions, instruction files,
multiple gallery images, Remix/Non-original, paid models, or parsed Print Settings Info.

## File-staged form audit (2026-08-04)

Signed-in Chrome audit of `create-model-new` with a harmless 1.44 KB fixture
(`test-cube.stl`) staged through the native model-file input. No Submit was
clicked, no model/draft was created, no form was persisted. The only server-side
artifact is one unused OSS staging object,
`model/273387bf4cbd5f0c919e9ad79d3e8b6f.stl`, in the internal staging bucket
(bucket host observed live: `internal-creality-usa.oss-us-east-1.aliyuncs.com`),
confirming the documented `model/<content-md5>.<ext>` key pattern and
`getAliyunInfo` STS transport end to end.

Corrected understanding of gating: the complete form — license questions,
visibility, description, instruction files and Print Settings Info — is rendered
in the DOM before any file is selected (it sits below the fold inside the
`/flowprint/create-model` iframe, `second-step` layout). The only truly gated
controls are the printer-compatibility checkboxes, which stay disabled until a
`.3mf` print-settings file has been parsed, and the price section described
below.

New form-contract details confirmed live:

- The model-file `accept` attribute adds MIME types beyond the ten extensions:
  `model/stl`, `model/obj`, `model/mtl`, `model/ply`, `model/3mf`,
  `model/vnd.3ds`, `model/vnd.collada+xml`, `model/step`,
  `application/vnd.ms-package.3dmanufacturing-3dmodel+xml`,
  `application/octet-stream`.
- Each staged file row exposes an editable display-name input (60 characters,
  the extension is a fixed suffix), a per-file `note` input (60 characters), a
  drag-reorder handle and a delete control. Folder names are editable, also 60
  characters, defaulting to `default`.
- Each tag is limited to 30 characters at the input level, in addition to the
  20-tag cap.
- The visible cover/gallery label reads `jpg/gif/png, ≤ 20MB`, while the actual
  image `accept` attribute is `.jpeg,.png,.jpg,.webp,.gif` — `webp` is accepted
  by the input but not advertised. Do not advertise webp in ModelPrep until the
  create service is proven to accept it.
- Visibility radios: Public = `1` (the default selection), Private = `0`.
  Because the native default is Public, ModelPrep must always send an explicit
  `isShared` value.
- A **Set Price / Model Sale Agreement** section exists in the bundle with
  radios Free = `0` and Paid = `1` ("You can set pricing after uploading the
  model file."). On this Premium account and form state it is rendered
  `display:none` **and** disabled, so paid publishing remains account/state
  gated exactly as `checkUserCondition` implies. It was not enabled or
  exercised.
- License question flow verified live: adaptations No + commercial No reveals
  the third question ("Allow sharing or redistributing of your work or its
  derivatives?"); Yes resolves to CC BY-NC-ND and No resolves to the CXY
  standard license ("personal use only") under the "Copyright License 4.0"
  banner, matching the existing combination table.
- Selecting Remix Models or Non-original reveals the same source field ("Paste
  the URL or directly search for models within Creality Cloud.") plus the
  CC BY-ND / CC BY-NC-ND no-derivatives warning. No proof-image (`workRegist`)
  section renders before a source is chosen; that sub-branch remains unmapped.
- Switching Model Source cleared the staged file list in this session; treat
  source selection as destructive to staged files until proven otherwise.
- The current hot/compatible printer list rendered as: K2 Plus, K2 Pro, K2,
  K2 SE, SPARKX i7, Creality Hi, Ender-3 V4, K1 Max 2025_CFS-C, K1C 2025_CFS-C,
  K1 SE_CFS-C, K1_CFS-C, K1C_CFS-C, plus **More Models** — live taxonomy, do
  not hard-code.
- Form validation is submit-triggered only; field blur produces no messages.
  Submit was not clicked (explicitly out of the authorized read-only scope), so
  the exact required-field message texts remain uncaptured.
- The `.3mf` Print Settings parse/conversion flow was not exercised (no
  print-settings file was staged); it stays classified as mapped but
  action-gated pending ModelPrep's real `.3mf` parser.

## 2026-08-08 profile-selection slice — a third distinct shape

Creality is neither Printables (no profile concept at all) nor Nexprint (a
profile block that ModelPrep sends empty). It has **two mutually exclusive
first-step upload modes**, and the answer to "where does the Bambu 3MF belong"
is `modelList`, as an ordinary model.

### Destination

- **Ordinary model in `modelList`.** `.3mf` is in `CREALITY_MODEL_FORMATS`, and
  `crealityRawModelFiles` keeps it. Retained entries carry a real parsed
  bounding box, so Creality genuinely ingests the geometry.
- **Not the parsed Print Configuration surface.** That is a separate mode whose
  `model3mf` object needs `filekey`, `size`, `name`, `thumbnail`,
  `relationPrinters`, `printerName`, `layerHeight`, `currBedType`,
  `nozzleDiameter`, `sparseInfillDensity`, `isCanPrint`, `plateList`,
  `secondName`, `wallLoops`, `covers` and `desc`. ModelPrep has no real `.3mf`
  parser, so it does not synthesize them; `model3mfCount`, `authModel3mfCount`
  and `model3mfList` stay `0`/`[]` and `include3mf` stays `false`.
- **Not an instruction/other file.** `.3mf` is absent from
  `CREALITY_INSTRUCTION_FORMATS`.
- Creality skips the rendered type-2 cover record for `.3mf`, `.step` and
  `.stp`, which ModelPrep already preserves.

The stale claim that ModelPrep "excludes any `.3mf` already linked to a project
print profile from `modelFiles`" was corrected above: that exclusion was removed
on 2026-08-07. Only the shared auto-exclusion default was still dropping the
profile, because Creality's native slicer is Creality Print.

### What the readback authoritatively exposes

Read-only inspection of retained private model `6a77222f75286de2e7e68468`
(2026-08-08, no mutation) via `model/modelGroupDetail`. Each `modelList` entry:

```text
id  createTime  userId  modelId  fileName  fileMd5  fileSize  fileFormat
status  modelColor  isPay  coverUrl  cover  fileKey  encryptState  isBroken
makeThumbnailErr  price  numOfPayment  encryptFailType  x  y  z  volume
isPurchased  cxbinv2  textures  material  lackTextures  lackMaterial
folderName  folderSort
```

Two contract details that would silently break a naive check:

1. **`fileName` carries no extension** (`modelprep-calibration-puck-S`); the
   dotted extension lives in `fileFormat` (`.stl`). Comparing a full source
   filename against `fileName` fails on every upload.
2. **Creality rewrites tags and category names server-side.** Tags submitted in
   English came back as `3D打印机`, `支持免费`, `熔融沉积成型`, `校准`,
   `测试模型` (only `upload test` survived verbatim), and `categoryName` is
   `测试模型`. Equality checks on either would fail a correct upload, so
   neither is asserted; the stable `categoryId` is checked instead.

The retained model also confirms the selection cause: `modelCount: 2`,
`totalFileSize: 90168` (36,084 + 54,084) and no 3MF, with `model3mfCount: 0`
and `include3mf: false`. Gallery splits as 9 `covers` plus one `pcCovers` and
one `appCovers` crop. `isShared: false`, `status: 2`, `maturityRating:
"general"`, `printType: [1]`, `isPay: false`.

**Open ambiguity:** `isOriginal` read `false` on a model submitted with
`modelSource: 1` (Original). Its meaning is unconfirmed, so it is reported here
and deliberately not asserted.

### Implemented

1. `crealityReadbackIssues` / `crealityExpectedFiles` /
   `crealityExpectedImages` (`deploy/src/lib/creality.js`) fail closed on:
   model-file count **and** `modelCount`; base name; `fileFormat` **present and
   equal** (a missing value fails on its own, because it is the only field
   distinguishing a retained `.3mf` from a retained `.stl`); positive and exact
   `fileSize`; **`fileMd5` against the md5 embedded in the upload record's
   `fileKey`**; `isBroken` and `makeThumbnailErr`; **parsed geometry**
   (`x`/`y`/`z`/`volume` all positive, so "Creality accepted this model" means
   more than "Creality stored these bytes under this name"); `categoryId`;
   `license`; title; **ordered gallery identity by cover-URL basename**, with
   `pcCovers` and `appCovers` verified independently and exactly;
   **`isShared === false`** for a private upload (missing or null fails);
   `totalFileSize` present, finite, positive and exactly equal;
   **`model3mfList` present and empty, `model3mfCount` 0 and `include3mf`
   false**; and instruction files by count and total bytes including the
   zero-instruction state. The previous check only rejected *fewer* files than
   uploaded, so a renamed, truncated or broken retained model passed.

   Instruction-file identity **cannot** be certified: the readback exposes only
   `otherFileCount` and `totalOtherFileSize`, with no retained list.

   **The geometry check is deliberately fail-closed for the non-rendered-preview
   formats (`.3mf`, `.step`, `.stp`).** Creality already skips their
   browser-rendered cover record, and whether it parses a bounding box from them
   at all is unproven. If it does not, **Creality will retain a perfectly valid
   object while ModelPrep reports the upload uncertified.** That asymmetry is
   intended: an uncertified report on a retained object is recoverable, whereas
   a certified claim about geometry that was never parsed is not. Expect this to
   be the most likely failure of the first authorized 3MF run, and treat such a
   failure as a finding about Creality's parser, not as a defect in the check.
   The retained object must not be deleted or retried in that case.

   `fileMd5` and the parsed bounding box were confirmed stable read-only on
   `6a77222f75286de2e7e68468`: every retained file carries a 32-hex `fileMd5`
   (the same digest Nexprint reports as `msgDigest` for identical bytes) and
   positive `x`/`y`/`z`/`volume`. Whether Creality parses geometry from a
   **`.3mf`** is still unproven — the geometry check will fail closed and report
   it rather than let a name-and-size match imply usable geometry.
2. Preflight now separates an unticked profile that never uploads (named
   warning, with filenames) from one that uploads without being parsed into a
   Print Configuration. The old warning only covered the second.
3. The demo fixture opts the Bambu profile into Creality explicitly
   (`fileSelection: 'manual'`), and its coverage claim reads `ordinary-3mf`
   plus `empty-print-configuration`.

The shared auto-exclusion default is unchanged and the profile was not enabled
on any other platform.

### Evidence and status

Deploy **417/417**, desktop **207/207**, backend **31/31**, `tsc` clean,
production build, package rebuilt and strict-codesign verified,
`git diff --check` clean. No object was created, updated, published, retried or
deleted; private model `6a77222f75286de2e7e68468` was opened read-only and is
unchanged as the before-state.

Every field the hardened verifier depends on was confirmed present on that real
retained object: `fileFormat` on every file, 32-hex `fileMd5` on every file,
positive parsed geometry on every file, `isBroken false`, `modelCount 2`,
`totalFileSize 90168`, `isShared false`, distinct pc/app/gallery cover
basenames, `model3mfList` an empty array with `model3mfCount 0` and
`include3mf false`, and `otherFileCount`/`totalOtherFileSize` both 0.

### Authorized private-create attempt — 2026-08-08: retained but UNCERTIFIED

One private create was authorized and performed exactly once through the exact
signed package, with the other nine platforms disabled (`1/10 SELECTED`). All
pre-submission confirmations passed: three files ticked including
`modelprep-calibration-puck-bambu.3mf`, category `1645`
(`3D Printers › Test Models`), licence `CC BY-NC`, `Original` (`modelSource 1`),
action `Create private model (recommended)`, and preflight showing exactly one
warning with the accurate text:

> 1 3MF file uploads as plain model files: ModelPrep doesn't build Creality
> Print Configurations yet, so their print settings won't be parsed into the
> listing.

**Creality created the object and the verifier failed closed.** Reported issues:

1. `modelprep-calibration-puck-S.stl`: no parsed geometry (x/y/z/volume)
2. `modelprep-calibration-puck-M.stl`: no parsed geometry (x/y/z/volume)
3. `modelprep-calibration-puck-bambu.3mf`: **absent from the saved model list**

Classified **retained but uncertified**. It was not published, retried, deleted
or edited, and existing object `6a77222f75286de2e7e68468` is untouched.

Two things this establishes:

- **The immediate readback is not the settled state.** The pre-existing object
  `6a77222f75286de2e7e68468` reports parsed geometry on both STLs, so Creality
  populates `x`/`y`/`z`/`volume` **asynchronously** after create. The verifier
  runs immediately and therefore sees an unprocessed model. This is a real
  defect in ModelPrep's verification timing, not in the geometry check itself:
  the check must poll for processing to settle before judging.
- **The 3MF's absence at that moment is unexplained.** It may be the same
  asynchronous processing, or Creality may reject a Bambu `.3mf` in
  `modelList`. Both STLs appeared immediately while the 3MF did not, which is
  suggestive but not conclusive. Do not assume either without evidence.

### Defect found by this run: the error path lost the object id

The fail-closed throw happened before any receipt was set, so the created
model's id and URL were discarded and ModelPrep could no longer locate what it
had just created. The allow-listed Creality routes are `whoami`, `upload`,
`submit`, `status` (id required) and `drafts` (drafts only, and a private model
is not a draft), so the object could not be re-found from the app afterwards.
The id is recoverable only from the Creality account's own model list.

This is the same class of defect already fixed for MakerRoad. It is now fixed
here too: the Creality flow records the retained id/state/URL the moment
`submit` returns, shows a provisional receipt, and preserves the retained object
in the error receipt and batch result when verification fails.

### Asynchronous-processing contract and bounded certification

Creality settles a new model **after** `modelGroupCreate` returns. Evidence: the
pre-existing object `6a77222f75286de2e7e68468` reports parsed `x`/`y`/`z`/
`volume` on every file, while the 2026-08-08 create reported none on either STL
and no `.3mf` at all when read immediately. Certifying against the first
readback therefore judges an unprocessed model.

`certifyCrealityModel` now polls the **same saved id** and never resubmits:

- interval **3 s**, timeout **120 s**, both exported constants. The interval
  matches the first-party editor's own polling pace; the timeout is long enough
  for a small multi-file model to index while still bounded, so a stuck model is
  reported rather than waited on indefinitely.
- **Still-settling** issues that keep polling: missing parsed geometry, a file
  absent from `modelList`, and the counts/sizes that grow with it
  (`model files`, `modelCount`, `total model bytes`, and absent
  `fileSize`/`fileFormat`/`fileMd5`).
- **Hard contradictions fail immediately**, without waiting out the timeout:
  wrong title, category or licence; shared visibility; `isBroken`; an md5
  mismatch; a wrong retained identity or format; `makeThumbnailErr`; a
  contradictory Print Configuration state; or unexpected instruction files.
- On timeout the receipt is preserved and the **exact unresolved fields** are
  reported as retained-but-uncertified.

`runCrealityUpload` wraps submit + certify so the retained id/state/URL is
captured the moment `submit` returns and survives any later failure. Tests cover
delayed success, immediate hard failure, timeout, and that `submit` is called
**exactly once** regardless of how many times certification polls.

**This is locally tested, not live-proven.** No object has been created since
the fix.

### Lost-ID boundary for the first authorized run

The object created on 2026-08-08 could not be re-found from ModelPrep. The
allow-listed Creality routes are `whoami`, `upload`, `submit`, `status` (id
required) and `drafts` (drafts only; a private model is not a draft) — verified
by probe, with `my-models` returning 404. `creality:connect` returns silently
when a session already exists, so it opens no inspectable page session either.

Mapping a private-model-list endpoint would mean guessing endpoint names against
a live authenticated account, which is discovery by trial rather than a
documented contract, so it was not attempted. **The id must be read from the
Creality account's own model list by the user.** The object is the newest
private *ModelPrep Calibration Puck — Upload Test Fixture*. Until it is
supplied, the 3MF's settled outcome stays unresolved: it is unknown whether the
`.3mf` was merely unprocessed at create time or is genuinely rejected from
`modelList`.

### RESOLVED — retained object `6a777ac80389871f0cd5e0c0` is fully settled

`https://www.crealitycloud.com/model-detail/6a777ac80389871f0cd5e0c0`
(id supplied by the user from their own Creality model list; ModelPrep still
cannot enumerate private models). Re-read read-only, no mutation:

| Concern | Settled value |
|---|---|
| `modelCount` / `totalFileSize` | **3** / **120,955** (36,084 + 54,084 + 30,787) |
| `…-S.stl` | `.stl`, 36,084 B, md5 `7eaf8672…`, 22 × 22 × 3.2, volume 1194.30 |
| `…-M.stl` | `.stl`, 54,084 B, md5 `2948a00d…`, 34 × 34 × 4.4, volume 3960.39 |
| **`…-bambu.3mf`** | **`.3mf`, 30,787 B, md5 `ea1d6835…`, 34 × 34 × 4.4, volume 3960.40** |
| health | `isBroken false`, `makeThumbnailErr 0`, `status 2` on all three |
| visibility / state | `isShared false`, `status 2` |
| category / licence / title | `1645` / `CC BY-NC` / exact |
| covers | 9 gallery + 1 pc + 1 app |
| Print Configuration | `model3mfList []`, `model3mfCount 0`, `include3mf false` |
| instructions | `otherFileCount 0`, `totalOtherFileSize 0` |

**Both open questions are answered:**

1. **The asynchronous-processing diagnosis is confirmed.** Everything the first
   readback reported as missing is present once settled. The first readback was
   simply too early; the bounded polling added for this is the correct fix.
2. **Creality does ingest a Bambu `.3mf` as an ordinary `modelList` entry and
   parses real geometry from it** (34 × 34 × 4.4 mm, volume 3960.40 — matching
   the 34 mm puck the profile contains). It is not rejected. The
   non-rendered-preview formats do get parsed geometry, so the deliberately
   fail-closed geometry check is satisfiable for `.3mf`.

### New contract finding: Creality MASKS filtered words in retained filenames

`modelprep-calibration-puck-bambu` came back as
`modelprep-calibration-puck-*****` — the competitor brand name replaced by
exactly five asterisks, character for character (both names are 32 characters).
The `.stl` names are untouched.

This is the same class as the translated tags and `categoryName`: a field
Creality rewrites server-side, so exact equality would reject a correct upload.
The verifier now:

- matches retained files by **`fileMd5`**, the authoritative identity — the md5
  of the exact bytes, equal to the md5 in the upload key and not rewritten;
- checks the name **mask-tolerantly** (`crealityNameMatches`): same length, with
  every position matching or masked `*`. A genuine rename is still rejected.

Replaying the corrected verifier against the settled object returns **zero
issues**.

**Classification: retained and API-certified.** The object matches every
authoritative field. Rendered UI/DOM remains a separate, still-unmet level:
ModelPrep drives Creality through a REST gateway with no page session, and no
separate browser sign-in was attempted.

### Historical note on the first run

The first authorized run proved the
verification is genuinely fail-closed on a real object, but it did not certify
the 3MF's retained `modelList` entry, its `fileFormat`, or the parsed-geometry
outcome. Rendered UI/DOM evidence is a separate, still-unmet certification
level: ModelPrep drives Creality through a REST gateway with no page session,
and no separate browser sign-in was attempted.
