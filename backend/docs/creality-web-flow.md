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
