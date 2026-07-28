# Printables upload parity: live contract, requirements, and implementation plan

Last audited: 2026-07-28

Live account used for read-only inspection: `iamdjem` (`@iamdjem_3163385`)

Create page: `https://www.printables.com/model/create`

GraphQL endpoint: `https://api.printables.com/graphql/`

## Status and safety boundary

This document is the canonical ModelPrep record for Printables model uploads. The
live account, create form, shipped JavaScript, GraphQL operations, category and
license queries were inspected with an authenticated browser. No draft was
created, no file was uploaded, and nothing was published or deleted during the
audit. Those are account mutations and require an explicit live-test confirmation.

Implementation status:

- [x] Live form, validation, taxonomy, licenses, auth, files, images, publishing,
      draft, remix, delete, and status flows mapped
- [x] Worker GraphQL adapter and routes
- [x] Direct-storage presign/finish/poll contract
- [x] Electron persistent Printables session design
- [x] Frontend account, options, upload, draft, publish, and status design
- [ ] Dedicated-account live draft round trip
- [ ] Dedicated-account live public publish and delete round trip
- [ ] Re-audit on upstream GraphQL client-version changes

Printables does not advertise this as a stable third-party upload API. ModelPrep
replays the first-party web form contract. Treat upstream schema changes as an
integration risk and keep all GraphQL operations isolated in
`backend/src/adapters/printables-web.ts`.

## Authentication

Printables uses Prusa Account OAuth with PKCE:

- authorization host: `https://account.prusa3d.com`
- authorization path: `/o/authorize/`
- public client id observed in boot config:
  `EK15sodB6SmoUXmOshtCBS4PA3Bkvwgwnb8Ux5Mj`
- scope: `basic_info`
- redirect returns to Printables `/login?state=...`
- authenticated GraphQL is cookie based (`credentials: include`)

ModelPrep must not imitate a password form. Desktop sign-in opens the real
Printables page in Electron partition `persist:printables`, supports OAuth
popups in the same partition, validates the session with a read-only `me` query,
and stores an encrypted cookie fallback with Electron `safeStorage`.

The renderer receives only `desktop-managed-printables-session-v1`. It sends
Worker-shaped `/api/v1/printables/web/*` requests to the Electron main process,
which validates the route and replays the corresponding GraphQL operation
directly from the user's network. This avoids Printables throttling
Cloudflare-to-Cloudflare requests. Raw cookies do not enter `localStorage`.

The Worker routes remain useful as a documented reference and non-desktop
diagnostic surface, but the supported authenticated desktop path does not
depend on Worker egress to `api.printables.com`.

Web-only ModelPrep cannot securely capture the first-party session and should
direct users to the desktop app.

## Client and request headers

Current first-party client:

- GraphQL client version: `v4.8.4`
- API: `https://api.printables.com/graphql/`
- media root: `https://media.printables.com`
- file root: `https://files.printables.com`

GraphQL requests are JSON `POST`s with:

```http
Accept: application/json
Accept-Language: en-US,en;q=0.9
Content-Type: application/json
Graphql-Client-Version: v4.8.4
Origin: https://www.printables.com
Referer: https://www.printables.com/model/create
Cookie: <desktop-managed Printables session>
```

HTTP 429 is a rate-limit condition and must be surfaced separately. GraphQL
`errors` and mutation `errors { field messages }` must both reach the user.
The public category/license response is cached at the Worker edge for 24 hours;
its CORS headers are reconstructed per request rather than stored in the cache.
A bundled snapshot from the last live audit is served for one hour when the
upstream taxonomy is throttled or unavailable, so publishing setup remains
usable while still retrying live metadata after the shorter fallback TTL.

## Form requirements

### Metadata

- model name: required for publish, maximum 255 characters
- summary: required for publish, maximum 120 characters
- description: rich HTML/Tiptap content, not Markdown
- main category: required; query the live category tree, do not hardcode it
- tag labels: lower-case letters and numbers, 1–25 characters per tag
- despite its GraphQL `ID` scalar, `modelUpdate.tags` accepts canonical tag
  labels, not numeric database IDs; ModelPrep removes separators before saving
- license: required; query live licenses, filtering non-selectable/store-only
  choices where applicable
- authorship: required enum, exactly `author`, `remix`, or `reupload`
- AI use: explicit yes/no is required for publish
- NSFW and political-content booleans
- remix: Printables or supported external parent plus `remixDescription`
- reupload: source link; no remix description
- a draft may be partial
- publishing requires at least one image and one model/print file

The first selected image is sent as `mainImage`. Printables does not expose the
MakerWorld cover-orientation controls; upload gallery images in the user's
selected order and use the first as cover.

### Files and limits

Normal file maximum: 1 GiB (`1,073,741,824` bytes).

ZIP retained as an archive: 256 MiB (`268,435,456` bytes).

Rich-description image maximum: 8 MiB.

File-name maximum: 150 characters.

Accepted model-page extensions observed in the live upload input:

```text
.3dm .3ds .3dxml .3mf .ai .amf .asm .bgcode .blend .cdr .csv .ctb
.dwg .dxf .easm .f3d .f3z .factory .fcstd .gcode .gif .heic .heif
.iges .igs .ini .ino .ipt .jpeg .jpg .lys .lyt .obj .par .pdf .ply
.png .prt .py .rsdoc .scad .shape .shapr .skp .sl1 .sl1s .sldasm
.sldprt .slvs .step .stl .stp .studio3 .svg .txt .webp .zip .zpr
```

Images accept GIF, JPEG/JPG, PNG, WebP, HEIC, and HEIF. The web client converts
HEIC/HEIF to JPEG before upload. A ZIP may be unpacked into model files or kept
as one Other file (`unzip: false`).

The audited client did not expose a definitive server-side gallery-count or
total-package cap. ModelPrep conservatively keeps the existing 25-image UI cap
and labels the total cap as “Not published”; do not present either as an
official Printables limit without a fresh server-side validation.

## Exact upload protocol

### 1. Presign each file

```graphql
mutation UploadModel(
  $fileName: String!
  $folder: String!
  $unzip: Boolean!
  $imageHash: String
  $imageHeight: Int
  $imageWidth: Int
) {
  upload: printFileUpload2(
    fileName: $fileName
    folder: $folder
    unzip: $unzip
    imageHash: $imageHash
    imageHeight: $imageHeight
    imageWidth: $imageWidth
  ) {
    ok
    errors { field messages }
    uploadData { url fields }
    fileUpload { id }
  }
}
```

For images, include intrinsic width/height when known. `imageHash` is optional.

### 2. Upload directly to object storage

Use every returned `uploadData.fields` value exactly and append the file last:

```js
const form = new FormData();
for (const [key, value] of Object.entries(uploadData.fields)) {
  form.set(key, value);
}
form.append('file', file);
await fetch(uploadData.url, { method: 'POST', body: form });
```

Do not route file bytes through the Worker; the 1 GiB Printables limit is larger
than a Worker request-body limit.

### 3. Compute CRC32C and finish

Printables computes CRC32C with the Castagnoli reversed polynomial `0x82F63B78`.
The checksum is the four-byte unsigned result in big-endian order, Base64
encoded.

```graphql
mutation UploadModelFinished($fileUploadId: ID!, $crc32c: String) {
  uploadFinished: printFileUploadFinished(
    fileUploadId: $fileUploadId
    crc32c: $crc32c
  ) {
    ok
    errors { field messages }
    output { id filePath }
  }
}
```

### 4. Poll processing

The first-party page begins after roughly 50 ms and polls about once per second:

```graphql
query PollFileUploads($ids: [ID!]!) {
  fileUploads: modelFileUploads(ids: $ids) {
    id
    notInspectedFiles
    isUploadFinished
    isProcessed
    gcodes { id name folder note weight layerHeight nozzleDiameter printDuration excludeFromTotalSum order }
    stls { id name folder note order }
    slas { id name folder note layerHeight printDuration order }
    otherFiles { id name folder note order }
    images { id filePath order }
  }
}
```

Stop only when every upload is processed. `notInspectedFiles` is a parsing or
inspection failure and must be shown, not silently discarded.

Map processed objects into model inputs:

- images: `{ id }`
- STL/SLA/Other: `{ id, folder, name, note }`
- G-code: the same plus `weight`, `material`, `nozzleDiameter`, `layerHeight`,
  `printDuration`, and `excludeFromTotalSum`

## Draft/update and publish

The create/update mutation is `modelUpdate`:

```graphql
mutation ModelUpdate(
  $tags: [ID], $id: ID, $description: String, $category: ID,
  $license: ID, $mainImage: ID, $name: String, $draft: Boolean,
  $summary: String, $remixParents: [ID], $nsfw: Boolean,
  $aiGenerated: Boolean, $politicalContent: Boolean,
  $authorship: PrintAuthorshipEnum, $remixDescription: String,
  $slas: [SLAFileInputType], $gcodes: [GcodeFileInputType],
  $stls: [STLFileInputType], $otherFiles: [OtherFileInputType],
  $images: [PrintImageInputType]
) {
  modelUpdate(
    tags: $tags, id: $id, description: $description,
    category: $category, license: $license, mainImage: $mainImage,
    name: $name, draft: $draft, summary: $summary,
    remixParents: $remixParents, nsfw: $nsfw,
    aiGenerated: $aiGenerated, politicalContent: $politicalContent,
    authorship: $authorship, remixDescription: $remixDescription,
    slas: $slas, gcodes: $gcodes, stls: $stls,
    otherFiles: $otherFiles, images: $images
  ) {
    ok
    errors { field messages }
    output { id slug name datePublished }
  }
}
```

Use `draft: true` for an unpublished draft. A public submission is two explicit
steps: save the complete model with `draft: false`, then:

```graphql
mutation PrintPublishRequest($printId: ID!) {
  printPublishRequest(printId: $printId) {
    ok
    errors { field messages }
    output { id status created }
  }
}
```

Some accounts require approval. Do not report “live” from a successful request
alone; read back `datePublished` and the publish-request state.

## Status, edit, remix, lists, and delete

Status/edit uses `print(id:)` and reads:

- `datePublished`
- `draftReason`
- `publishApprovalRequired`
- `publishRequests { id status created }`
- editable model fields and processed files/images

Remix resolution:

- Printables model ID: `print(id:)`
- URL: `remixUrlInfo(url:)`
- search UI: `searchPrints2(query:, limit: 50)`

Deletion:

```graphql
mutation PrintDelete($id: ID!) {
  printDelete(id: $id) {
    ok
    errors { field messages }
  }
}
```

Authenticated listings use `drafts`, `moreDrafts`, and `userModels`. ModelPrep's
initial parity slice verifies a known ID after each mutation; a full in-app
catalog can be added with those exact list operations once their paging UI is
needed.

## Taxonomy and licenses

Fetch live via the Worker `/api/v1/printables/meta`. Categories have IDs, levels,
and paths; render level-0 groups with their level-1 choices. The audited root
groups included Household, Gadgets, Art & Design, Fashion, Tools, Toys & Games,
Hobby & Makers, Other, and Education.

Audited license IDs:

| ID | License |
|---:|---|
| 7 | CC0 |
| 1 | CC BY |
| 2 | CC BY-SA |
| 8 | CC BY-ND |
| 3 | CC BY-NC |
| 4 | CC BY-NC-SA |
| 6 | CC BY-NC-ND |
| 9 | GPL v2 |
| 12 | GPL v3 |
| 10 | LGPL |
| 11 | BSD |
| 13 | Standard Digital File |
| 17 | Open Community License v1.1 |
| 18 | CERN OHL-S v2 |
| 19–23 | OCL variants |

IDs 14 and 15 are store/commercial choices; 16 was not selectable in the
audited create form. Always prefer current API flags over this snapshot.

## ModelPrep route map

Public:

- `GET /api/v1/printables/meta`

Desktop-session routes:

- `GET /api/v1/printables/web/check`
- `GET /api/v1/printables/web/whoami`
- `POST /api/v1/printables/web/upload/presign`
- `POST /api/v1/printables/web/upload/finish`
- `POST /api/v1/printables/web/upload/status`
- `POST /api/v1/printables/web/model`
- `POST /api/v1/printables/web/publish`
- `GET /api/v1/printables/web/status?id=...`
- `GET /api/v1/printables/web/my-models`
- `POST /api/v1/printables/web/remix/resolve`
- `POST /api/v1/printables/web/delete`

## Release and live-test plan

1. Run Worker adapter tests and TypeScript checks.
2. Run desktop bridge tests, frontend tests, and a production build.
3. In the packaged app, connect the dedicated Printables account through the
   real Prusa/Printables sign-in window and confirm the account handle.
4. With explicit confirmation, create one clearly labelled unpublished draft
   using one image and one small STL/3MF.
5. Read it back by ID; verify files, image order, HTML, tags, category, license,
   authorship, AI flag, and draft state.
6. With separate explicit confirmation, publish that test model, poll until
   `datePublished` is present, open the resulting Printables URL, then delete it.
7. Re-run remix/reupload and retained-ZIP cases with disposable drafts.
8. Deploy the Worker before deploying the frontend/desktop bundle.

## Official references

- Printables create page: `https://www.printables.com/model/create`
- Printables profile: `https://www.printables.com/@iamdjem_3163385`
- Printables GraphQL endpoint: `https://api.printables.com/graphql/`
- Printables terms: `https://www.prusa3d.com/page/terms-of-service-of-printables-com_231249/`
- Prusa EasyPrint help (a distinct print-delivery feature, not model upload):
  `https://help.prusa3d.com/article/easyprint_898029`
