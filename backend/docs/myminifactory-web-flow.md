# MyMiniFactory direct desktop upload flow

Date captured: 2026-07-31

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
- Advanced fields include printing tips, time range, dimensions, technology, material quantity, support-free, and remix parent object IDs.

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

The final corrected readback passed the full desktop suite (88 tests), production
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
