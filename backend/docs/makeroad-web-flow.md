# MakerRoad upload flow map

> **CORRECTION (2026-08-07).** The "live-certified private draft M2134222528"
> claim is wrong in effect: a private Save still enters MakerRoad review, and
> ALL seven retained drafts sit under Drafts > Rejected Models ("cover is not a
> real photo"). The required Print Method was empty on every draft because the
> server drops English labels (`FDM`); ModelPrep now resolves print methods to
> live `printerType` catalog ids and the readback fails on status-looking
> fields, lost descriptions, and lost printType. See
> `live-ui-verification-2026-08-07.md`.

## Sign-in window size (2026-08-20)

MakerRoad's login page is not responsive. `.login-page-con` is a hard `width: 1152px`
and the sign-in card is its right-hand flex child, so any narrower window cuts the card
off. Our old window was 1120px, which leaves 1114px of content, so the card's right edge
landed at 1152 and clipped the password field and the Log In button by 38px. Measured on
the live page, then again in Electron at three sizes: 1120 clips by 38px, 1180 fits with
11px to spare, 1240 fits with 41px.

The sign-in window is 1240x900 now with `minWidth: 1180`, clamped to the display's work
area. We cannot fix this from here. Only their CSS can make the page reflow, so we give
it the width it demands.

Checked at the same time, all clean at their current sizes: MakerOnline, MyMiniFactory
and Thingiverse at 1120, Creality at 1040, Nexprint (ELEGOO sign-in) at 920. Thangs
answered 429, so it went unmeasured.

## 2026-08-08 continuation audit boundary

MakerRoad redirected normal Chrome to Log In, so its current create/edit form
could not be re-inspected authenticated. No credential was entered and no item
changed. The latest live evidence remains the 2026-08-07 signed-in inspection
of all seven rejected saves; the code comparison is current as of 2026-08-08.

The newer print-method resolver and rejection/status checks are locally
implemented but have no corrected live save. Readback remains conditional and
partial: it checks title, visibility, plan, pay type, status-looking fields,
non-empty description/print type and role counts only when present. It does not
compare exact names/order, categories, tags, licence, AI/NSFW, printers,
materials, colors, attribution, schedule timestamp, price value, or terms.

All seven retained saves remain rejected historical artifacts. “Save private
draft” is misleading because saved items enter review. No optional or corrected
print-method branch is live-certified.

Audit date: **2026-08-02** (refreshed against the current production page and bundles)
Surface: authenticated production upload page `https://www.makeroad.com/printable_3D_model/upload`, live English DOM, current Nuxt bundles, and first-party request definitions
Mutation update: on **2026-08-01** an early packaged attempt transmitted private-test assets but `/api/models/info` rejected the final Save because the `X-Token` login cookie was not mirrored into the required `X-Token` header. ModelPrep now mirrors it and validates sessions through authenticated `GET /api/user` instead of the public taxonomy endpoint. After the service returned, exact-app private draft `M2134222528` saved successfully and passed edit readback through `/api/models/getEdit?id=M2134222528&uploadType=1`, completing safe-core certification. Recheck authenticated availability after future service outages. On **2026-08-02**, the live upload DOM and the current route bundle (`COhJdF3H.js`, SHA-256 `1ff4c2d8ba040c8380a1c6535012e543d653e34c92f06866eeabf7f087b08f35`; application bundle `BZUL9akC.js`, SHA-256 `7b2e368859cd0dff8f4a9dbd915ad6e15813c54f5fb361b0f31557ae0d541578`) showed no native video input, upload role, or `/api/models/info` serializer field.

## Integration decision

**NO PUBLIC DEVELOPER UPLOAD API FOUND; EXPERIMENTAL DESKTOP PATH IMPLEMENTED,
BUT THE FORMER SAFE-CORE CERTIFICATION IS WITHDRAWN.** The production site
exposes a complete first-party JSON/multipart contract under
`https://www.makeroad.com/api`. Treat it as a **REQUEST CONTRACT**, not a
supported public API. ModelPrep has a tested UI, isolated-session transport,
dynamic metadata, four upload roles, token-aware save/review submission, and
edit-readback path. Public/review, paid, remix, schedule and other optional
branches remain separate. The current native upload form has no video input or
save serializer field, so ModelPrep must warn and not send video media rather
than guessing a contract.

## Live workflow

Six sections: Upload Type, Upload Files, Model Description, Print Information, Model Information, and Publication Settings. Final actions are Save, Preview, and Publish. Publishing requires agreement to the Terms of Service and Privacy Policy.

### Upload types

- **LIVE DOM:** Original Model (default) and Remix Model.
- **LIVE DOM:** Print Makes / Print Configurations is present but disabled on this page.
- **CURRENT BUNDLE:** Remix requires an original model search result or source URL.

### Files and current limits

- **LIVE DOM / CURRENT BUNDLE:** model files require at least one 3MF/STL/OBJ; maximum 80; total model files maximum 500 MB; drag reorders. The broad drop area also advertises SCAD and other 2D/3D files.
- **LIVE DOM / CURRENT BUNDLE:** print-configuration files are `.3mf`, maximum 10.
- **LIVE DOM / CURRENT BUNDLE (2026-08-02):** images `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`; 3–10 images; recommended 1:1; maximum 10 MB each; order determines cover. There is no native video input, upload role, or create/update serializer field in the current route bundle. Video media is unsupported by the current form and must not be guessed or sent.
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

Parity requires a UI card and isolated session; original/remix; all four file roles with ordering and exact limits; rich description; live categories/tags/printers/materials/colors; all seven licenses; AI/NSFW; public/private; scheduled and paid branches gated by eligibility; terms as an action-time gate; Save as the safest initial state; preview and edit readback; pending-review receipts; and per-platform failure isolation. The free private Save core is certified at `M2134222528`; certify public/review, paid, remix, scheduled and other optional combinations independently. Keep video unsupported unless a future first-party UI and serializer contract appears.

## 2026-08-02 full form-to-adapter audit

The signed-in create page and retained private draft editor were reopened
read-only on 2026-08-02. The current page still presents all six native
sections and the current route bundle fingerprint in the opening audit note.
The retained editor repopulated its title after hydration. No Save, Preview,
Publish, visibility change, or upload was triggered. The exact package now
fails closed after a save when `getEdit` changes title, visibility, publication
plan, price type, or any present model/profile/document/image role count.

| Current form concern | ModelPrep state | Evidence and boundary |
| --- | --- | --- |
| Original/private/free Save, title/rich description, category, tags, license, FDM, models and ordered images | Live-certified safe core | Exact packaged draft `M2134222528` and `getEdit?uploadType=1` readback. |
| Title, privacy, plan, price type and asset-role counts at readback | Implemented and locally verified | New fail-closed renderer check has focused test coverage; its stronger comparison has not yet been exercised by another live save. |
| 3MF print configurations and instruction documents | Implemented and request-mapped | Current form/bundle limits and role serializer are mapped; no specialist live draft was authorized. |
| Dynamic printers/materials/colors and free-entry tags | Implemented and browser-mapped | Values come from current authenticated metadata endpoints; exact optional combinations remain untested live. |
| Remix/source, AI, NSFW, seven licenses, schedule, points/cash | Implemented/mapped, action-gated | Current UI and bundle contracts are mapped, but each is a separate authorized certification branch. |
| Terms and public review submission | Explicit-action-only | Native UI blocks Publish until terms agreement; no public review submission was made. |
| Video | Unavailable in current native form | No video input, upload role, or serializer field exists. ModelPrep warns and never sends it. |
