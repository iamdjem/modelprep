# Thangs upload flow map

Audit date: **2026-08-01**
Surface: authenticated `iamdjem` production account, portfolio/upload entry, official help center, current Next.js/Turbopack bundles, and first-party request definitions
Mutation update: on **2026-08-01** the authenticated first-party browser flow uploaded private item `1583118` (`desk-dragon-bambu.3mf`). The current bundle showed that signed PUTs use `application/octet-stream` for model files; ModelPrep was incorrectly sending model MIME types and has been corrected. A separate reconnect defect was traced to ModelPrep's obsolete cookie-only validator: current Thangs stores the access token and current-user record in origin local storage, keeps a refresh cookie, and authenticates API requests with `Authorization: Bearer`. ModelPrep now captures that access token inside the isolated main-process window, encrypts it with Electron safe storage, and verifies it against `GET https://production-api.thangs.com/users/current?likes=false`. The token is never sent to the renderer. The exact packaged app subsequently created private model `1583272` and passed details, attachments, license, category, visibility and metadata readback, completing safe-core isolated-path certification.

## Integration decision

**SUPPORTED PUBLIC API NOT FOUND; EXPERIMENTAL DESKTOP PATH IMPLEMENTED AND SAFE CORE LIVE-CERTIFIED.** The official help center describes website upload, bulk upload through Thangs Sync, a membership API for some exclusive sellers, and custom model/membership APIs for qualifying professional designers. It does not document a generally available third-party model-upload API. Treat all routes below as a **REQUEST CONTRACT**, not a public API. ModelPrep's isolated-session, corrected signed-upload, validation, create/assets, and details/attachments/license readback path is live-certified for one private single-part model. Optional multipart/bulk/assembly, versions, plans, paid/membership, public/access and other branches remain separate.

Official source: `https://thangs.com/resources/help-center-articles/how-do-i-upload-my-models`

## Product workflow and capabilities

- **OFFICIAL:** MyThangs → Add New or the global Upload model button.
- **OFFICIAL:** one or multiple files can be uploaded and grouped as a multipart model.
- **OFFICIAL:** Upload & Edit opens the editor for images, description, tags, categories, and other metadata.
- **OFFICIAL:** new models default to private.
- **OFFICIAL:** Thangs Sync supports bulk upload from a computer.
- **LIVE DOM:** authenticated profile was empty and showed Upload model plus drag/drop/browse entry points.
- **LIVE DOM:** planned maintenance was active during the audit; no mutation was attempted.

## Files, roles, and limits

### Model files

**CURRENT BUNDLE:** `.stl`, `.3mf`, `.step`, `.stp`, `.obj`, `.glb`, `.fbx`, `.blend`, `.usdz`, `.gltf`.

**CURRENT BUNDLE:** complex model formats are `.gltf` and `.blend`. Current help says `.3mf`, `.fbx`, and `.glb` are single-part-only. The editor can represent single, bulk, multipart, assembly, dependencies, versions, primary parts, and units.

### Reference and attachment files

**CURRENT BUNDLE:** broad reference set includes CAD/source, archives, documents, print files, and images. Premium non-model files include ZIP. Images include `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif`, and `.heic`. Model-license files accept `.pdf`, `.txt`, and `.md`.

### Current size policy

- **CURRENT BUNDLE:** hard model threshold 250 MB; files over it are moved to reference files when eligible.
- **CURRENT BUNDLE:** reference maximum 500 MB.
- **CURRENT BUNDLE:** soft warning thresholds 50 MB and 220 MB; print threshold is represented as 95 MB/100,000,000 bytes.
- **CURRENT BUNDLE:** empty files and filenames containing `" / \\ : $ # & @ ?` plus newline, tab, `* < > %` are rejected.
- **CURRENT EDITOR (2026-08-07):** the Images field states "Image dimensions should be at least 336x410px, with a 1 / 1.22 aspect ratio for best results." Aspect is a recommendation for the model card, not a validity rule; originals of any aspect upload and display. ModelPrep now offers a `1200x1464` card crop alongside the original pass-through so the focal point is the author's choice.
- **CURRENT EDITOR (2026-08-07):** Videos are **not uploadable files**. The field reads "Provide a YouTube or Instagram Reel link to feature a video in the model page slideshow." ModelPrep sends nothing here and has no video-link field for any platform; `project.media` holds uploaded video files, which Thangs cannot accept. NOT IMPLEMENTED.
- **UNKNOWN:** total file count and image count. Do not guess them.

## Listing data model

**CURRENT BUNDLE / REQUEST CONTRACT:** the model schema and submission builder include:

- name and description
- category path and tags
- images/attachments and separate reference files
- `isPublic` (private by default), `accessTypeId`, plans/tier assignments, and marketplace price data
- `allowRemix`, AI-generated flag, and feedback flag
- units, folder/workspace, primary part, multipart/assembly structure, dependencies, and versioning
- standalone files with independent name, description, license, folder, visibility, and plan IDs
- license file plus Thangs license metadata
- print instructions are a separate model-page capability and download as PDF

Paid listings, memberships, bundles, print-store products, and plan assignment are account-gated branches and must not be advertised as available until the account is approved and each branch is certified.

## First-party request sequence

This is the current website contract observed in first-party bundles:

```text
GET  users/current?likes=false                 authenticated session verification
POST models/upload-urls                       {fileNames,directory,sendContentLengthRangeHeader:false} -- MODEL PARTS AND LICENSES ONLY
POST attachments/upload-urls                  {fileNames,directory,sendContentLengthRangeHeader:false} -- PHOTOS AND REFERENCE FILES
PUT  signed object URL                        raw bytes
POST models/validatefiles                     {fileNames:[...]}
POST v2/models                                array of model payloads -> model ids
POST v2/models/assets                         GONE -- returns 404 (see note below); do not call
GET  models/{id}/details                      edit/readback metadata
GET  models/{id}/attachments                  attachment readback
GET  v2/models/{id}/license                   license readback
POST standalone-files/upload-urls?...         standalone presign
POST standalone-files                         standalone metadata
```

**Presign route decides file classification.** The first-party uploader picks the route by file kind, in its upload worker (not the page bundle, which is why an earlier capture missed it):

```js
`${standalone ? 'standalone-files' : attachment ? 'attachments' : 'models'}/upload-urls`
```

Only model parts take `models/upload-urls`; non-model files (photos and reference files) take `attachments/upload-urls`, which stores under `uploads/attachments/<uuid>/`. Attachment-route uploads are not sent to `models/validatefiles`. Licenses stay on the model route, matching `UPLOAD_MODEL_LICENSE`.

**CORRECTION (2026-08-07): the presign route does NOT determine `attachmentType`.** An earlier revision of this file claimed it did, reasoning from a live public model whose images sit under `uploads/attachments/`. A live end-to-end publish from the packaged app disproved it: with photos correctly presigned through `attachments/upload-urls`, model `1585777` still listed all ten `.jpg` files under the editor's Attachments section with an empty Images gallery. **The real cause is still unknown.** Do not treat the route as the fix. The leading untested hypothesis is the create path: Thangs' own uploader posts everything in one `POST v2/models` with attachments inline, whereas ModelPrep creates a bare draft with `POST v4/models` and then applies metadata with `PUT v4/models/{id}/details`, which may file every attachment as a resource. A secondary discrepancy: the web create sends attachment entries keyed `newFileName`, ModelPrep sends `filename`. Confirming either requires reading `GET models/{id}/attachments`, which needs the bearer token.

`attachmentType` is server-assigned and is either `image` or `resource`; the client's own predicate is extension-based (`isImage = isAnAcceptedType(file, PHOTO_FILE_EXTS)`). At create time the web app filters the payload's `attachments` down to images only, sending everything else as `referenceFiles`.

**Field names verified against `GET models/{id}` on a live public model.** Descriptions are **Markdown**, not HTML (`"**NN-14 Blaster**\n_Easy Print_\n\n..."`); sending HTML round-trips as literal tags in both the editor field and its Preview. The AI flag is **`isAiGenerated`**; the spelling `aiGenerated` appears nowhere in Thangs' client and is silently dropped. Remix permission is `allowRemix`, which is distinct from `isRemix` (the model is a derivative).

The presign response uses `signedUrl` and `newFileName`. The submit builder creates one payload per root/single/multipart model. Each part uses the exact keys `originalFileName`, `originalPartName`, `filename`, `size`, and `isPrimary`. `POST v2/models/assets` **no longer exists (2026-08-07)**. Probed unauthenticated against the live API: `v2/models` and `v4/models` both answer `401` (route present, auth required) while `v2/models/assets`, `v4/models/assets` and `models/assets` all answer `404`. The first-party bundle still dispatches it from `GENERATE_ASSETS_ASYNC` with no `await` and no `catch`, so the 404 is invisible in Thangs' own client. ModelPrep added the call on the theory that it was what generated thumbnails and image derivatives; it made every publish fail with HTTP 404 and was reverted. Asset generation is **not** the missing piece. The root carries attachments, dependencies, workspace/folder, visibility/access, license, remix, AI, tags/categories, units, marketplace/plans, and related metadata. Current categories are read from `GET categories/root?includeEmpty=true` and persisted as a path value rather than a picker index.

## ModelPrep parity requirements

Parity requires isolated authenticated storage; explicit private default; single/bulk/multipart/assembly choices; model, image, reference, standalone, dependency, and license roles; signed upload progress/retry; server validation; dynamic category/tag/license/plan reads; units/primary part/folder/workspace; remix/AI/feedback; paid/membership branches only when eligible; asset generation; canonical metadata/attachment/license readback; and version support. The private free single-part safe core is certified at model `1583272`; certify each optional structure, version, plan, commercial and public/access branch independently.
