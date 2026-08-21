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

## Transport: requests run inside the page (2026-08-20)

Thingiverse is behind Cloudflare, and Cloudflare judges the client, not the
cookies. Measured against the live site with a throwaway partition and no
account:

| transport | `GET /api/v2/users/me` |
|---|---|
| `session.fetch`, plain | 403, "Just a moment..." challenge HTML |
| `session.fetch` + Chrome User-Agent | 403, same challenge |
| fetch from inside a page on the origin | 401 JSON from Thingiverse |
| `session.fetch` after that page banked `cf_clearance` | 403, same challenge |

So a signed-in session was reporting "Thingiverse session is not authenticated
(HTTP 403: `<!DOCTYPE html>...Just a moment...`)" in the UI, with the challenge
page pasted into the error. The session was fine; the request never arrived.

Thingiverse now uses the transport Cults3D already had, `createWindowFetch` in
`cults-window-fetch.js`. One hidden `BrowserWindow` sits on the `persist:thingiverse`
partition, loaded on `/thing:0/edit`, and every request runs inside it through
`executeJavaScript`. The direct client is unchanged, since it takes an injected
`fetchImpl`. Verified end to end. The real client over the real transport gets a genuine
401 for a made-up token, which is Thingiverse answering.

Two consequences worth remembering:

- Uploads now cross into the page as one base64 blob in a script, capped at
  256MB by the transport (`DEFAULT_MAX_BODY_BYTES`). This is the same path Cults
  file uploads take.
- The browser drops `Cookie`, `Origin`, `Referer` and `User-Agent` when the client
  sets them, because scripts may not set those headers. The page supplies its own,
  which is why the hidden page loads the editor rather than the home page.

A Cloudflare challenge is also classified separately now
(`isCloudflareChallenge`, error code `cloudflare_challenge`). It is not evidence
of a bad session, it does not clear the stored one, and the check retries once
after 3 seconds in case the hidden page is still solving the interstitial.

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

The enabled implementation covers isolated session storage; ordered files/images;
Markdown metadata; AI/WIP/customizable/remix/source/NSFW; draft-first safety;
publish as a separate explicit action; and edit/files/images endpoint readback. The
current 80-value production taxonomy is stored by ID (never picker position).
The unpublished core path is browser-proven and exact-packaged-app
live-certified; public and optional branches remain separate evidence gaps.

Do not describe all print settings, rich sections, education, groups, design
tools, or complete field-by-field readback as implemented parity. The adapter
has payload slots for several of them, but the current product UI and upload
lifecycle do not expose or verify the complete live form.

## 2026-08-04 independent browser revalidation

The retained editor was rechecked visually and through its rendered controls.
Files, gallery, category, tags, license, AI/WIP/Remix/NSFW, print settings and
custom/education sections remain represented. The platform disables **Let
Others Customize** unless at least one `.SCAD` model file exists. Therefore
ModelPrep must disable that option without SCAD, fail preflight if stale saved
state still requests it, and repeat the same validation in the desktop adapter
before constructing a Thing payload.

## 2026-08-08 signed-in upload-flow re-audit

This pass inspected the current signed-in `thing:0/edit` flow, all normal Thing
sections, the separate Education Project mode, every category label, all
licences, the Remix branch, design tools, account group state, and retained
draft `7390480`. Only unsaved local form state changed. No file was selected or
uploaded and no Thing was saved, published, accepted, or deleted.

### Confirmed current parity

- The entry point remains `https://www.thingiverse.com/thing:0/edit`. The live
  create menu links there. ModelPrep's direct adapter uses the correct URL.
- All 80 current category labels match `THINGIVERSE_CATEGORIES`, and all 13
  current licence choices match `THINGIVERSE_LICENSES`.
- Core fields are represented: ordered model files and gallery images, name,
  Markdown body, category, tags, AI, WIP, SCAD-gated Customizer, Remix plus
  source Thing ID, NSFW tag, licence, draft/publish separation, and publish-time
  terms acknowledgement.
- The 2026-08-07 local fix now builds the Thing body from the explicit summary
  plus the full project Markdown description. Eight direct-adapter tests pass,
  including the body and SCAD gates. This is **locally verified only**: retained
  draft `7390480` still contains only its one-line summary and proves the old
  content-loss behavior, not the fix.

## 2026-08-09 retained category and thumbnail follow-up

Rendered inspection of draft `7393174` proved that category `124` is
`Toys & Games › Mechanical Toys`, not a suitable calibration-fixture category.
The correct current taxonomy entry is category `129`, rendered as
`3D Printing › 3D Printing Tests` in the native editor. The demo fixture now
uses `129` and a regression test pins that mapping. The existing draft has the
correct category selected locally, but it has not been saved pending the final
browser mutation confirmation.

The gallery contains the ten ordered source images plus two platform-generated
STL renders. Eleven of the twelve rendered thumbnails have positive dimensions.
Only the second source image remains `0 × 0`; its generated resize URL contains
an anomalous `h=1`, while the original CDN asset remains retained. This is a
Thingiverse resize-derivative defect, not missing source-image persistence, and
must not be generalized to other platforms or repaired by re-uploading the
draft without separate authorization.

### Newly bounded gaps

1. **The general platform link was wrong and is now fixed locally.**
   `PLATFORM_URLS.thingiverse` used to point to
   `https://www.thingiverse.com/create`, which resolves to the profile of a user
   named `create` (`/create/designs`), not the uploader. It now uses
   `/thing:0/edit`, matching the authenticated adapter.
2. **Structured print settings are only partially exposed.** The live form has
   printer brand and dependent model selectors; tri-state rafts and supports;
   resolution; infill; filament material (PLA, Tough PLA, ABS, TPU, PETG, CPE,
   PC, PVA, or Other); filament brand; color; other-material name; and Markdown
   notes. ModelPrep exposes only free-text printer/model, material, resolution,
   and infill. The adapter accepts several hidden keys, but users cannot select
   them through ModelPrep and no live readback proves them.
3. **Rich sections are not end-to-end mapped.** Post Printing, How I Designed
   This, and arbitrary custom sections each accept ordered text, uploaded images,
   and video. ModelPrep provides a raw JSON textarea and does not upload/finalize
   detail images, attachments, or video URLs as structured section content.
4. **Education Project is schema-shaped, not product-mapped.** The live mode has
   grades (Kindergarten through Higher Education), subjects, NGSS/CCSS standards,
   Overview & Background, Lesson Plan & Activity, Materials Needed, Skills,
   Duration, Preparation, Handouts & Assets, Rubric & Assessment, and References;
   its content sections also accept text/image/video. ModelPrep exposes one raw
   JSON textarea. Its default detail-type list has no explicit Handouts & Assets
   entry, and there is no live metadata picker, section builder, asset uploader,
   validation, or persisted branch proof.
5. **Design tools and groups are absent from the product flow.** The current
   form offers 68 design tools. This account has no group choices, and group
   sharing requires publication. The adapter has `thing_programs` and
   `thing_groups` fields, but the renderer neither exposes nor sends
   `programIds`/`groupIds`.
6. **Readback is not complete verification.** ModelPrep requests edit, files,
   and images, but the renderer currently checks only that a readback object
   exists. It does not compare title/body, category, tags, licence, flags,
   sources, sections, education data, file order, or gallery order against the
   intended payload. A partial save can therefore report “verified.”

### Current verdict

- **Normal unpublished Thing, safe core:** live-certified historically. The
  full-description repair is locally tested but still needs one separately
  authorized draft/readback to become live evidence.
- **Structured print settings, rich sections, Education Project, design tools,
  groups, Remix, Customizer, and public publish:** not fully mapped or not
  separately live-certified. Do not call Thingiverse fully certified.
- The smallest safe implementation slice is: correct the platform link, expose
  the missing print-setting controls, and make readback field-by-field before
  requesting any account-backed draft verification.
