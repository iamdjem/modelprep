# MakerOnline authenticated upload and import flow

Live audit: **2026-07-31**. Surfaces:

- `https://www.makeronline.com/en/upload`
- `https://www.makeronline.com/en/importThirdPartyModel`

The audit used a signed-in production account, the rendered DOM, the production
Nuxt bundles, and read-only request/response inspection. Discovery did not upload
a file, save a draft, publish a model, link a third-party profile, or expose the
account's token/verification phrase in this document.

## API choice and trust boundary

No documented public third-party model-upload API was found. MakerOnline's current
site uses a consistent, same-origin first-party JSON/multipart API. ModelPrep uses
that contract from Electron, following the same boundary as Nexprint and Creality:

1. open MakerOnline's real upload/sign-in page in `persist:makeronline`;
2. capture the `mo_access_token` cookie after MakerOnline itself authenticates;
3. keep the raw token and complete cookie string in Electron main plus encrypted
   `safeStorage` fallback;
4. expose only `desktop-managed-makeronline-session-v1` to the renderer;
5. dispatch only allow-listed `/api/v1/makeronline/web/*` virtual routes locally;
6. upload directly from the user's computer to MakerOnline;
7. save an unpublished draft by default, or publish only after an explicit public
   action;
8. read the saved object back through `edit-info` before reporting success.

The current contract is first-party and undocumented, so it can drift. A successful
mock suite/build proves the local mapping, not a live account-backed upload.

## Upload decision tree

```text
Step 1: listing information
├─ source: Original | Remix
│  └─ Remix → original work URL (required; max 1000)
├─ AI assistance: No | Yes
├─ license (8 choices)
├─ ordered images (1–20; first is cover)
├─ title, category, tags, permissions, print method
├─ rich description and optional documentation
├─ NSFW disclosure
├─ Creative Kits: No | Yes → one or more current store kits
├─ China sync (only for eligible linked accounts; Public + non-NSFW)
└─ Exclusive (only for eligible accounts; forces stricter combination)

Step 2: files
├─ print_file_type = 1 → .3mf print profile(s), parsed metadata,
│  profile title, profile pictures, profile description
└─ print_file_type = 0 (or Resin) → no print-profile fields
   └─ raw model files remain required
```

## Step 1 DOM and option map

### Source and licensing

- **Original**: `source: 1`.
- **Remix**: `source: 2`; shows required `original_link`, maximum 1,000
  characters. The page warns that the original license must permit derivatives.
- **AI assistance**: without AI `ai_help: 0`; with AI `ai_help: 1`.
- Licenses:

| Value | Label |
| --- | --- |
| `1` | CC BY |
| `2` | CC BY-SA |
| `3` | CC BY-NC |
| `4` | CC BY-NC-SA |
| `5` | CC BY-ND |
| `6` | CC BY-NC-ND |
| `7` | CC0 |
| `8` | Standard Digital File License |

Remix plus `5` or `6` is rejected by ModelPrep rather than sending an internally
contradictory derivative.

### Model images

- Required; **1–20**.
- Accepted: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.heic`.
- Maximum: **30 MB each**.
- First image becomes the default cover.
- Native UI supports drag/long-press reordering.
- Request record: `{url, thumbnail_url, is_main}`; the first item carries
  `is_main: 1`.
- ModelPrep preserves the user's ordered source image rather than inventing a
  platform-required crop. Its platform preview uses a 4:3 local presentation
  recommendation only.

### Required metadata

- **Title**: required, maximum **100** characters.
- **Category**: required, current two-level live taxonomy; only leaf ids are sent.
- **Tags**: optional, maximum **20**; each tag maximum **20** characters; Enter
  commits a tag in the native UI.
- **Model Permissions**: Public `1` or Private `2`.
- **Printing Method**:
  - FDM `1` → `print_types: [1]`;
  - Resin `2` → `print_types: [2]`;
  - Both `3` → `print_types: [1,2]`.
- **Description**: required by the native validator; Quill HTML; maximum **9,000
  plain-text characters**.

The Quill toolbar exposes bold, italic, underline, strike, size, text/background
color, alignment, heading levels 1–6, blockquote, code block, ordered/bullet lists,
indent, link, and image insertion. Inline description images use upload scene `2`
and a 10 MB cap.

### Documentation

- Optional, multiple.
- Accepted: `.pdf`, `.txt`, `.xls`, `.xlsx`, `.doc`, `.ppt`, `.pptx`, `.png`,
  `.jpg`, `.gif`, `.svg`.
- Current uploader component limits the field to 50 files and 500 MB each.
- Request shape:
  `{doc_id, file_name, file_size, key, url}`.

### NSFW, regional sync, exclusivity, and kits

- `is_adult_nsfw`: covers nudity, violence, profanity, and disturbing themes.
- NSFW disables China synchronization.
- “Sync to MakerOnline China” is rendered only when the signed-in account's
  cross-region authorization is eligible. Private models cannot sync.
- The audited new account returned no linked China authorization.
- Exclusive eligibility is account-gated. The audited account returned the
  first-party message that at least 20 prints are required. The visible help copy
  also describes account-wide downloads ≥50 **or** online prints ≥20.
- Exclusive submissions require Original, Public, Standard Digital File License,
  a print profile, printed photos, and assembly documentation when relevant.
- Creative Kits are optional. “Yes” requires at least one `store_kit_id`. Current
  signed-in options on 2026-07-31:
  1. LED Kit for Light Up Saber
  2. Star Tunnel Kit
  3. Sunglasses Creative Kit
  4. LED Lamp Creative Kit
  5. Wireless Mouse Creative Kit
  6. Carousel Creative Kit
  7. Forklift Wireless Charger Kit
  8. Laptop Cooler Kit
  9. Metal Findings Kit
  10. Led Relief Components Kit
  11. Anycubic Motion Kit

ModelPrep loads the kit list and both eligibility decisions live instead of treating
this dated list as permanent.

## Category taxonomy

Source: `GET /api/category/options`, captured 2026-07-31. The app loads this tree
live; this snapshot is the audit/change record.

- `33` 3D Printer
  - `35` Parts & Upgrades; `34` Accessories; `36` Test Models
- `37` Household
  - `38` Home Decor; `39` Garden; `40` Kitchen; `41` Office; `42` Festivities;
    `43` Living Room; `44` Pets; `45` Other Household
- `46` Hobby&DIY
  - `47` Automotive; `48` Electronics; `49` Music; `50` Sports&Outdoor; `51` RC;
    `52` Robotics; `53` Mechanical Parts; `54` Other Hobby&DIY
- `55` Tools
  - `56` Gadgets; `61` Organizers; `60` Hand Tools; `59` Machine Tools;
    `58` Medical Tools; `57` Other Tools
- `62` Toys&Games
  - `69` Action Figures; `104` Characters; `68` Board Games; `67` Building Toys;
    `66` Outdoor Toys; `65` Puzzle; `64` Vehicles; `63` Other Toys&Games
- `70` Art
  - `75` 2D Plate; `74` Sculptures & Statues; `105` Animals; `73` Signs & Logos;
    `72` Badges; `71` Other Art
- `76` Fashion
  - `81` Accessories; `80` Bags & Purses; `79` Clothing; `78` Jewelry;
    `77` Other Fashion
- `82` Education
  - `89` Biology; `88` Chemistry; `87` Geography; `86` Engineering;
    `85` Physics &Astronomy; `84` Mathematics; `83` Other Education
- `90` Costumes & Cosplay
  - `94` Costumes; `93` Masks; `92` Props; `91` Other
- `95` Miniatures
  - `101` Characters; `100` Architecture; `99` Creatures; `98` Gaming Accessories;
    `97` Fantasy&Sci-Fi; `96` Other
- `106` Health & Fitness
  - `107` Wellness; `108` Accessibility
- `109` Pop Culture
  - `110` Characters; `111` Memes & Trends; `112` Other
- `113` Generative 3D Model
  - `114` Make My Phone Case; `115` Make My Light; `117` AI Modeling
- `119` Creative Kit Model (leaf)

## Step 2 file map

### Raw model files

- Maximum **100**, **500 MB each**.
- Accepted:

```text
.stl .obj .3mf .3ds .amf .blend .dwg .dxf .f3d .f3z .factory .fcstd
.iges .ipt .ply .py .rsdoc .scad .shape .shapr .skp .sldasm .sldprt
.slvs .step .stp .studio3 .123dx .thing
```

- Request shape: `{file_name, file_size, url}`.

### Print profiles

- First question: has a 3MF print profile (`print_file_type: 1`) or has no print
  files (`0`).
- Resin skips the print-profile branch.
- `.3mf` only, maximum **100**, **500 MB each**.
- Upload scene `5`, followed by:

```http
POST /api/file/parse-info
Content-Type: application/json

{"file_type":1,"file_key":["…"]}
```

`file_key` is an array even for a single profile. Production rejects a scalar
with `The file key must be an array.` ModelPrep unwraps the corresponding first
parse result before building `print_files`.

- The parser returns printer/nozzle/layer/plate and preview metadata. ModelPrep
  forwards those returned values; it does not synthesize proprietary slicing data.
- Profile title: required when a profile is used, maximum 100, native default is the
  first `.3mf` filename.
- Profile pictures: upload scene `6`, maximum 100, images up to 30 MB. Native UI
  copies the first model picture if none was selected.
- Profile description: separate reduced rich-text editor, maximum 1,000.
- Request keys:
  `{file_name,file_size,url,simple_url,thumbnail,self_model,printers,nozzle,layer,plates,parse_type}`.

## Authentication and first-party endpoints

The production axios wrapper reads `mo_access_token` from cookies and sends its
decoded value directly in the `Authorization` header (no `Bearer` prefix). Requests
also send the session cookies and `language: en`.

Read/configuration:

- `GET /api/user/personal/info?noredirect`
- `GET /api/category/options`
- `GET /api/mold/store-options`
- `GET /api/moldExclusive/getExclusiveMoldPermission`
- `GET /api/sync-auth/getAuth?user_id=…`
- `GET /api/mold/edit-info?id=…`

Upload:

```http
POST /api/file/upload
Content-Type: multipart/form-data

file=<bytes>
scene_type=<number>
file_uid=<client-generated id>
```

| Role | Scene |
| --- | ---: |
| raw model | `1` |
| gallery/cover/inline rich image | `2` |
| print-profile `.3mf` | `5` |
| print-profile picture | `6` |
| documentation | `8` |

Save/publish:

- `POST /api/mold/save-draft` — unpublished draft.
- `POST /api/mold/create` — create/public action.
- `POST /api/mold/edit` — edit an existing model.
- `POST /api/print-profile/create` / `edit` and corresponding `edit-info` exist for
  standalone profile editing.

The base model payload contains:

```text
source, license, original_link, images, title, category_id, tags,
permissions, print_types, desc, docs, is_adult_nsfw, ai_help, is_sync,
is_related_kits, store_kit_ids, print_file_type, parse_type, print_files,
print_title, print_images, print_desc, files, exclusive_type, is_free, price
```

The current form defaults `is_free: 1`. Pricing code exists in the bundle, but the
audited upload form exposed no paid-model control. ModelPrep therefore sends free and
does not claim paid publishing.

## Third-party import page

This is a migration tool, not ModelPrep's outbound upload transport.

- Supported providers: **Printables** and **Thingiverse** only.
- Step 1: enter a profile URL on one of those domains.
- Step 2: copy the generated verification text.
- Step 3: paste it into the third-party profile bio, then verify.
- Imported selections become MakerOnline drafts and open through `/en/upload?id=…`.

Endpoints:

- `GET /api/mold/external/account`
- `GET /api/mold/external/load?link=…&cursor=…`
- `POST /api/mold/external/import`
  `{link, external_ids:[…]}`
- `GET /api/mold/external/import-results`

The load/import requests also send `X-identity-anonymous-id`. The server-generated
verification phrase is a secret proof token and must never be logged or documented.

## Implemented coverage and certification boundary

Implemented locally:

- isolated persistent sign-in and encrypted fallback;
- live account identity, taxonomy, kit list, China-sync eligibility, and exclusive
  eligibility;
- all current visible Step 1 choices and conditional combinations;
- every audited upload role and server 3MF parsing;
- ordered images, raw models, documentation, print-profile images/metadata;
- draft-first one-click batch integration plus explicit public action;
- edit-info title/category/image/file readback checks;
- demo safety, payload/transport tests, UI option tests, account-marker tests, and
  production frontend build.

Live-certified core path (2026-07-31):

- the exact packaged ModelPrep app uploaded one ordered image and one valid cube STL;
- `/api/mold/save-draft` returned draft id `316077`;
- ModelPrep read the draft back through `/api/mold/edit-info`;
- the native edit page independently showed title
  `ModelPrep MakerOnline Unpublished Test 2026-07-31`, category `104`
  (`Toys&Games / Characters`), one image, Private permission, no print profile,
  and one `desk-dragon-S.stl` file;
- public Submit remained disabled and the draft is intentionally retained for
  account review.

Not yet live-certified: `.3mf` parsing/profile media, documentation, public
publishing, Remix, Creative Kit, China sync, Exclusive, paid, Resin-only, and
high-count/large-file combinations. Core live certification is not full optional-
matrix certification.

The exact continuation procedure and reusable next-agent prompt are in
`modelprep-current-handoff-2026-08-01.md`.
