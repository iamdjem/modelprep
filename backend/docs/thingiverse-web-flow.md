# Thingiverse upload flow map

Audit date: **2026-08-01**
Surface: authenticated production account, `https://www.thingiverse.com/thing:0/edit`, current production bundles, and official developer/legal pages
Original audit mutation boundary: **read-only**. Written clearance to enable the mapped ModelPrep flow was recorded from the product owner on **2026-08-01**. The owner then explicitly accepted the current Thingiverse Terms for the certification action and authorized Save as Draft. Browser draft `7390453` and exact packaged-app draft `7390455` were created and retained unpublished; no listing was published.

## Integration decision

**IMPLEMENTED, ENABLED, AND LIVE-CERTIFIED FOR UNPUBLISHED DRAFTS AFTER WRITTEN CLEARANCE.** Thingiverse has a documented OAuth 2 API and supports desktop applications. The API License Agreement revised 2026-02-19 had created a product/legal gate for ModelPrep's multi-platform workflow. The product owner recorded that this conflict was cleared on 2026-08-01. ModelPrep enables its tested request adapter, isolated session bridge, project options, draft/publish separation, and readback by default. An injectable fail-closed override remains for emergency/test builds. Save Draft is the production-safe default; public publication remains uncertified and requires a separate explicit action and acceptance of current terms.

Sources:

- **OFFICIAL:** `https://www.thingiverse.com/developers/getting-started`
- **OFFICIAL:** `https://www.thingiverse.com/legal/api`
- **OFFICIAL:** `https://www.thingiverse.com/developers/swagger`
- **OFFICIAL:** `https://www.thingiverse.com/changelog`

## Live form

The authenticated editor has five steps: Upload, Thing Info, Basic Info, Details, and License. Final actions are Save as Draft and Publish. Publishing requires at least one model file and acceptance of the current terms.

### Files and media

- **LIVE DOM:** primary formats `.stl`, `.obj`, `.3mf`, `.scad`, `.jpg`, `.txt`.
- **LIVE DOM:** additional accepted formats include `amf`, `dae`, `3ds`, `x3d`, `blend`, `ply`, `fcstd`, `dxf`, `ai`, `svg`, `cdr`, `ps`, `eps`, `epsi`, `sch`, `brd`, `png`, `gif`, `doc`, and `docx`.
- **LIVE DOM:** computer and Dropbox sources; pictures recommend at least 1024 px width.
- **OFFICIAL:** image maximum is 5 MB per the current changelog.
- **UNKNOWN:** model-file size, image count, and required aspect ratio. Do not enforce guessed values.
- **CURRENT BUNDLE:** rich detail sections support text, uploaded images, and video URLs. Video is not a gallery file-upload role.

### Required and optional metadata

- **LIVE DOM:** name, summary, category, license, and terms are required for publication. Summary and notes support Markdown.
- **LIVE DOM:** AI-generated, Work in Progress, customizable (SCAD-dependent), Remix plus source Thing/Thing ID, tags, and NSFW.
- **LIVE DOM:** print settings include printer brand/model, rafts, supports, resolution, infill, material, filament brand/color/name, and notes.
- **LIVE DOM:** optional Post Printing, How I Designed This, and arbitrary custom sections.
- **LIVE DOM:** Education Project mode adds grades, subjects, standards, overview/background, lesson plan/activity, materials, skills, duration, preparation, handouts/assets, rubric/assessment, and references.
- **LIVE DOM:** groups and design tools may be attached after publication.

### Categories

**LIVE DOM — dynamic taxonomy; store IDs, never picker positions.** Top-level categories and current children:

- 3D Printing: Accessories, Extruders, Parts, Printers, Tests
- Art: 2D Art, Art Tools, Coins & Badges, Interactive Art, Math Art, Scans & Replicas, Sculptures, Signs & Logos
- Fashion: Accessories, Bracelets, Costume, Earrings, Glasses, Jewelry, Keychains, Rings
- Gadgets: Audio, Camera, Computer, Mobile Phone, Tablet, Video Games
- Hobby: Automotive, DIY, Electronics, Music, R/C Vehicles, Robotics, Sport & Outdoors
- Household: Bathroom, Containers, Decor, Household Supplies, Kitchen & Dining, Office, Organization, Outdoor & Garden, Pets, Replacement Parts
- Learning: Biology, Engineering, Math, Physics & Astronomy
- Models: Animals, Buildings & Structures, Creatures, Food & Drink, Model Furniture, Model Robots, People, Props, Vehicles
- Tools: Hand Tools, Machine Tools, Tool Holders & boxes, Parts
- Toys & Games: Chess, Construction Toys, Dice, Games, Mechanical Toys, Playsets, Puzzles, Toy & Game Accessories
- Other

### Licenses

**CURRENT BUNDLE:** `cc`, `cc-sa`, `cc-nd`, `cc-nc`, `cc-nc-sa`, `cc-nc-nd`, `pd0`, `gpl`, `lgpl`, `bsd`, `cern-ohl-s`, `cern-ohl-w`, and `cern-ohl-p`.

## First-party website request contract

This is a **REQUEST CONTRACT**, not a supported public API commitment:

```text
POST  /api/files/0/uploadFile                 multipart file, optional type -> pending upload id
POST  /api/things                            create complete Thing payload
POST  /api/files/0/FinalizeFiles             {target_id, target_type:"thing", pending_uploads:[{id,rank}]}
POST  /api/things/{id}/publish                publish
GET   /api/things/{id}/edit                   canonical editor metadata readback
GET   /api/things/{id}/files                  file readback
GET   /api/things/{id}/images                 ordered gallery readback
```

The current form sends `category` (numeric ID), `description` (summary), pending model files in `files`, existing images in `images`, `is_customizer`, `is_wip`, `is_ai`, `tags`, `license`, `thing_groups`, `thing_programs`, `is_remix`, `ancestors`, `details_parts`, `included_apps`, and education fields. Pending IDs remain numeric. Pending model/gallery/detail images are finalized only after creation. Empty Tips/Design/education parts omit `data`, and only explicit custom sections are serialized. NSFW for a regular account is the `NSFW` tag, not the admin-only `is_nsfw` flag.

## 2026-08-01 live certification evidence

- **First-party browser contract:** draft `7390453` used one 3MF and one image.
  Upload responses returned HTTP 200 pending IDs; create/update returned HTTP
  200; the editor persisted the unpublished state, title, summary, Mechanical
  Toys category `124`, CC BY-NC, model file, and gallery image.
- **Exact packaged app:** BUILD F8B1E49 first created detailed certification
  draft `7390455`; ModelPrep completed create, finalize, and edit/files/images
  readback. A separate signed-in first-party edit inspection confirmed all 3
  model files, 10 ordered uploaded photos, 2 generated STL renders, title,
  summary, 8 tags, category `124`, CC BY-NC, and the explicit unpublished banner.
  The later four-at-a-time closeout batch created draft `7390480` and again
  passed exact-app unpublished readback.
- **Corrected defects:** reconnect previously waited on stale storage instead of
  the successful same-page token exchange; the HTTP 500 creation failure came
  from an implicit malformed custom section and stringified pending IDs. The
  real-test fixture also used stale category `69`; it now uses `124`.

## ModelPrep parity requirements

The enabled implementation covers isolated session storage; ordered files/images; Markdown metadata; AI/WIP/customizable/remix/source/NSFW; print settings; custom and education sections; draft-first safety; publish as a separate explicit action; edit/files/images readback; and independent receipts. The current 80-value production taxonomy is stored by ID (never picker position). The unpublished core path is browser-proven and exact-packaged-app live-certified; public and optional branches remain separate evidence gaps.

## 2026-08-04 independent browser revalidation

The retained editor was rechecked visually and through its rendered controls.
Files, gallery, category, tags, license, AI/WIP/Remix/NSFW, print settings and
custom/education sections remain represented. The platform disables **Let
Others Customize** unless at least one `.SCAD` model file exists. Therefore
ModelPrep must disable that option without SCAD, fail preflight if stale saved
state still requests it, and repeat the same validation in the desktop adapter
before constructing a Thing payload.
