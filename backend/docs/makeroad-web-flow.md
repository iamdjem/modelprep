# MakerRoad upload flow map

Audit date: **2026-08-01**
Surface: authenticated production upload page `https://www.makeroad.com/printable_3D_model/upload`, live English DOM, current Nuxt bundles, and first-party request definitions
Mutation update: on **2026-08-01** an early packaged attempt transmitted private-test assets but `/api/models/info` rejected the final Save because the `X-Token` login cookie was not mirrored into the required `X-Token` header. ModelPrep now mirrors it and validates sessions through authenticated `GET /api/user` instead of the public taxonomy endpoint. After the service returned, exact-app private draft `M2134222528` saved successfully and passed edit readback through `/api/models/getEdit?id=M2134222528&uploadType=1`, completing safe-core certification. Recheck authenticated availability after future service outages.

## Integration decision

**NO PUBLIC DEVELOPER UPLOAD API FOUND; EXPERIMENTAL DESKTOP PATH IMPLEMENTED AND SAFE CORE LIVE-CERTIFIED.** The production site exposes a complete first-party JSON/multipart contract under `https://www.makeroad.com/api`. Treat it as a **REQUEST CONTRACT**, not a supported public API. ModelPrep has a tested UI, isolated-session transport, dynamic metadata, four upload roles, token-aware save/review submission, and edit-readback path. Private Save is live-certified; public/review, paid, remix, schedule and other optional branches remain separate. Native video format, size and serializer behavior remain unknown.

## Live workflow

Six sections: Upload Type, Upload Files, Model Description, Print Information, Model Information, and Publication Settings. Final actions are Save, Preview, and Publish. Publishing requires agreement to the Terms of Service and Privacy Policy.

### Upload types

- **LIVE DOM:** Original Model (default) and Remix Model.
- **LIVE DOM:** Print Makes / Print Configurations is present but disabled on this page.
- **CURRENT BUNDLE:** Remix requires an original model search result or source URL.

### Files and current limits

- **LIVE DOM / CURRENT BUNDLE:** model files require at least one 3MF/STL/OBJ; maximum 80; total model files maximum 500 MB; drag reorders. The broad drop area also advertises SCAD and other 2D/3D files.
- **LIVE DOM / CURRENT BUNDLE:** print-configuration files are `.3mf`, maximum 10.
- **LIVE DOM / CURRENT BUNDLE:** images `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`; 3–10 images; recommended 1:1; maximum 10 MB each; order determines cover. The current translation also exposes Upload Video, but accepted video format/size and submission serialization remain **UNKNOWN**.
- **LIVE DOM / CURRENT BUNDLE:** instruction documents `pdf`, `txt`, `doc`, `docx`, `ppt`, `pptx`, `xls`, `xlsx`; maximum 5; total maximum 50 MB.
- **REQUEST CONTRACT:** `POST /api/upload/webuploader` sends multipart field `file` and returns an uploaded-file id. `/api/upload/ossurl` and `/api/upload/base64upload` also exist in the current client.

### Metadata

- **LIVE DOM:** title is required, maximum 60.
- **LIVE DOM:** rich description is required; current editor supports headings, formatting, links, images, and related rich-text tools.
- **LIVE DOM / CURRENT BUNDLE:** one to three dynamic categories are required.
- **LIVE DOM:** tags are free-entry/autocomplete; count and per-tag length are **UNKNOWN**.
- **LIVE DOM:** required print method is one or more of FDM, LCD, Others; optional compatible printers, material brand/type, and colors.
- **LIVE DOM:** AI-generated and NSFW flags.

### Categories

**LIVE DOM:** dynamic tree from `/api/settings/modelsClassify`; use values/IDs, never picker positions.

- FDM Filaments: Engineering, Universal Filament, Transparent, Flexible, Glow-in-the-Dark, Other, PLA Wood, PLA Metal
- Home & Living: Decor, Storage Supplies, Daily Items, Kitchen & Bath, Office Supplies, Pet Supplies, Light fixture, Other
- Art & Design: Trendy Toy IP, Relief Art, Keychains, Original decoration, Artwork, Other
- Hobbies and DIY: Remote Control Models, Vehicle Models, Military Models, Aircraft Models, Robots & Mecha, Miniature Model, Digital Accessories, DIY, Other
- Fashion Wearables: Face Accessories, Jewelry, Bags, Shoes, Other
- Games & Toys: Tabletop Games, Game Props, Game Figurine, Toy Ornaments, Kids' Toys, Other
- Tools: Summer Water Play Tools Collection, Household Tools, Storage Tools, Gardening Tools, Picnic & Camping, Stationery & Aids, Other, RC Car Accessories
- Professional Fields: Engineering & Industrial, Medical and Health Devices, Test Models, 3D Printer Accessories, Other

### Printers, materials, and colors

- **LIVE DOM:** printer brands currently include Elegoo, HeyGears, Nova3D, Formlabs, Phrozen, Fusion3, Prusa, Anycubic, Creality, and Bambu Lab. Models are dynamic from `/api/settings/printer` and `/api/settings/printerType`.
- **LIVE DOM:** materials are filterable by FDM/LCD/Others. Current brands include KEXCELLED, RuiBen, Inslogic, DaJian, JAYO, bing3d, CHG, R3D, Fusrock, Xingyu Technology, Aliz, Raise3D, Polymaker, Anycubic, Creality, Bambu Lab, eSUN, and SUNLU. Values are dynamic from `/api/settings/material`.
- **REQUEST CONTRACT:** tags and colors come from `/api/settings/tag` and `/api/settings/color`; custom tag/color values are encoded with `#{...}`.

### Licenses

**CURRENT BUNDLE:** CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, CC BY-NC-ND, CC BY-ND, and CC0/Public Domain. The UI derives these from three choices: attribution waiver, adaptations (no/yes/share-alike), and commercial use.

### Publication

- **LIVE DOM:** Public (default) or Private.
- **CURRENT BUNDLE:** optional scheduled publishing with timezone and required time.
- **CURRENT BUNDLE:** Free, Points, or Cash download pricing; Points/Cash require a value and may be account-gated.
- **CURRENT BUNDLE:** Save routes a new item to unpublished management; Publish routes it to review/pending management. Do not describe Save as published.

## Create/update request contract

```text
POST multipart /api/upload/webuploader        file -> uploaded id
GET           /api/settings/modelsClassify   categories
GET           /api/settings/printer          printers
GET           /api/settings/material         materials
GET           /api/settings/tag              tags
GET           /api/settings/color            colors
POST          /api/models/info               create/save/preview/publish
PUT           /api/models/info               update existing id
GET           /api/models/getEdit            canonical edit readback
GET           /api/models/preview            preview readback
POST          /api/models/visible            visibility change
```

The current serializer sends uploaded IDs as pipe-delimited strings (`fileModel`, `filePrintconf`, `fileDoc`, `pics`); `descColumn` as the selected category value array; `descTag` as pipe-delimited `#{tag}` values; and `printType`/`color` as pipe-delimited strings. Native enums are original `2`, remix `1`; public `1`, private `2`; immediate `1`, scheduled `2`; and free/points/cash `1`/`2`/`3`. Free uses an empty `payValue`. License triples `(shareNosign, shareEdit, shareBusiness)` are CC BY `(1,2,2)`, CC BY-SA `(1,3,2)`, CC BY-NC `(1,2,1)`, CC BY-NC-SA `(1,3,1)`, CC BY-NC-ND `(1,1,1)`, CC BY-ND `(1,1,2)`, and CC0 `(2,2,2)`.

## ModelPrep parity requirements

Parity requires a UI card and isolated session; original/remix; all four file roles with ordering and exact limits; rich description; live categories/tags/printers/materials/colors; all seven licenses; AI/NSFW; public/private; scheduled and paid branches gated by eligibility; terms as an action-time gate; Save as the safest initial state; preview and edit readback; pending-review receipts; and per-platform failure isolation. The free private Save core is certified at `M2134222528`; certify public/review, paid, remix, scheduled and other optional combinations independently. Do not implement native video until its current request contract is captured.
