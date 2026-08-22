# Platform workflow and mapping audit, 2026-08-22

This document compares the current ModelPrep implementation with the signed-in native upload forms for all ten destinations. The browser inspection was read-only. No file was uploaded, no draft was saved, and no listing was published or changed.

A second clean-context browser pass is recorded in
`platform-upload-flow-independent-audit-2026-08-22.md`. The reconciliation is
in `platform-upload-independent-comparison-2026-08-22.md`.

The audit used four evidence levels:

1. **Live** means the field or rule was visible in the signed-in native form on 2026-08-22.
2. **File-gated** means the native site did not show the later form until a file was uploaded. Current ModelPrep source and retained verified editors fill that gap.
3. **Mapped** means ModelPrep currently has a source field and sends or transforms it for that platform.
4. **Certified** means a previous retained result was read back. Mapping and certification are different. A field can be implemented without every branch having a retained-result certificate.

## ModelPrep workflow

| Step | Shared input | Destination work |
|---|---|---|
| Files | Model files, documents, sliced 3MF packages, `.lac` packages | Assign a role per destination. Some platforms treat 3MF as a native print profile, while others treat it as model geometry. |
| Details | Title, description, shared category, tags, licence, origin or remix URL, change notes, AI disclosure, NSFW | Seed native taxonomies and enums. Keep destination-only attribution identifiers in the platform panel. |
| Images | Ordered gallery, cover and focal point, destination crops, video | Build the image order and native covers. Only MakerWorld and Cults3D receive uploaded video from the current shared media step. |
| Platforms | Native category, licence, visibility, price, publication action, profile and account-gated choices | Resolve each platform's own controls and block missing required choices. |
| Publish | Preflight, confirmations, release plan, upload, result verification | Submit only enabled destinations. A successful request is not accepted as proof until the adapter verifies the destination state at its supported evidence level. |

## Comparison table

The legend uses **Direct** when ModelPrep sends the shared value with formatting only. **Mapped** converts it to a native ID, enum, crop, or payload. **Conditional** depends on source, account, file type, or publication state. **Gap** means the native site has a control that ModelPrep does not currently expose or send. **None** means no separate native field was found.

| Group | MakerWorld | Printables | Cults3D | MyMiniFactory | Thingiverse | Thangs | Nexprint | Creality Cloud | MakerOnline | MakerRoad |
|---|---|---|---|---|---|---|---|---|---|---|
| Title | Direct, 50 | Direct, native required | Direct | Direct | Direct | Direct | Direct | Direct, 60 | Direct, 100 | Direct, 60 |
| Description | Mapped rich text | Markdown plus embedded media | Markdown plus YouTube links | Rich text | Markdown plus sections | Direct | Rich editor | Rich editor | Rich editor, 9000 | Rich editor |
| Tags | Direct, up to 50 | Normalized | Direct, up to 20 plus meta tags | Direct | Direct | Direct | Direct, up to 20 | Direct, up to 20 | Direct, up to 20 | Direct |
| Category | Native tree | Native tree | Native tree plus usage | Native tree, later or retained form | Native tree | Native tree | Native tree | Native tree | Two-level tree | Up to 3 native paths |
| Licence | Native map | Native map | Price-coupled map | Native map | Native map | Free-text map | Native rule map | Native rule map | Native map | Native rule map |
| Origin or remix | Original, Remix, Share. Share is a gap | Author, remix, reupload | No dedicated source selector seen | Remix plus parent object IDs | Original or remix plus Thing ID | Gap for inspiration attribution | Original, Remix, Share | Gap beyond Original | Original or remix | Original or remix |
| Price | None | Conditional Store and Club | Free, Paying, Open Price | Gap for premium Store | None | Conditional marketplace | None | **Gap. Free or Paid is live** | Dormant, not exposed by ModelPrep | **Conflict. Live form fixed Free; code also offers Points and Cash** |
| Visibility | Private or public | Draft or publish | Secret, Public, Offline | Private or public | Draft or publish | Mapped only to private or public | Draft or publish | Private or public | Draft action plus public or private permission | Save or submit plus public or private |
| Images | Dual crops, up to 16 gallery | Ordered gallery | Ordered media | Re-encoded gallery | Ordered gallery | Ordered gallery | Cover plus 9 gallery | Dual covers plus 9 gallery | First image cover, up to 20 total | 3 to 10, 1:1 recommended |
| Videos | One MP4 or MOV, max 30 seconds | Description embed only | MP4 or WebM gallery media | None seen | Section URL only | **Gap. Native embed URL** | Description media only | No direct upload seen | None seen | None seen |
| Model files | Raw files, Bambu 3MF, or Laser and Cut | Broad file list plus ZIP rule | Broad list, 1 GB each | Up to 100 MB on this account | Broad list | Eight formats in live first step | Single or batch mode | Broad model list | Up to 100 model files | Up to 80 model files |
| Print profiles | Native Bambu profile workflow | No separate profile object | No separate profile object | No separate profile object | Print settings, not a profile file | Native compatibility controls are a gap | No native profile block mapped | **Gap. Raw 3MF only** | Native Anycubic 3MF profile step | Native 3MF configuration files |
| AI disclosure | Mapped | Mapped, live required question | Mapped, live checkbox | Native declaration forbids generated AI | Mapped | Mapped in source, later form file-gated | Mapped as AI-generated tag | No separate live AI field seen | Mapped, live required question | Mapped |
| NSFW | Mapped | Mapped | No native control seen | No native control seen | Mapped | No native control confirmed | Mapped | Mapped | Mapped | Mapped |

Numbers in the Title row are known character limits. An omitted number means the live page or current source did not provide a reliable cap.

## MakerWorld

Live status. The current create flow was signed in, but the metadata form is file-gated. The first step and accepted formats were checked live. Later fields use current source plus retained signed-in form evidence.

| Group | Native fields and rules | Current ModelPrep mapping | Audit result |
|---|---|---|---|
| Title | Title, 50 characters for 3D model flow | Shared title | Mapped |
| Description | Rich description. Laser and Cut has a separate profile description branch | Shared description plus Laser and Cut profile description | Mapped, with a warning when the selected branch cannot take the shared description |
| Tags | Native tags, up to 50 in retained evidence | Shared tags | Mapped |
| Category | Own leaf taxonomy | Shared category seeds `categoryId`, user confirms native leaf | Mapped |
| Licence | Own licence list, including platform-only options | Shared licence map plus destination override | Mapped |
| Origin or remix | Original, Remix, or Share. Remix uses a source URL or native model, original licence, and change description | Shared provenance plus native remix fields | **Gap. Share is not exposed** |
| Price | No normal listing price field | None | Correct |
| Visibility | Private or public | Destination visibility | Mapped |
| Images | Separate 4:3 and 3:4 covers, up to 16 gallery images for normal models | Shared gallery plus native crops | Mapped |
| Videos | One MP4 or MOV, maximum 30 seconds | First supported shared video | Mapped |
| Model files | Live raw branch accepts `3ds`, `amf`, `dwg`, `dxf`, `f3d`, `factory`, `fcstd`, `iges`, `ipt`, `obj`, `ply`, `rsdoc`, `scad`, `shape`, `shapr`, `skp`, `sldasm`, `sldprt`, `slvs`, `step`, `stl`, `stp`, `studio3`, `zip`, `3mf`, `stpz`. Separate Bambu Studio 3MF and Laser and Cut branches exist | Per-file roles, one initial Bambu 3MF, raw model files, `.lac` package | Mapped |
| Print profiles | Profile name, description, visibility, cover, photos, real-photo confirmation and guidelines | Embedded Profiles editor and Bambu package parsing | Mapped |
| Other native fields | BOM, other parts, related model, CyberBrick files, Exclusive program, 14-day Exclusive Launch, community post | Destination panel | **Partial. The separate 14-day launch choice is not represented** |

Documentation correction. The old summary hid AI and NSFW and made the first-step product branch look like ordinary metadata. The independent retained editor also proved Share and the 14-day launch choice, which ModelPrep does not expose.

## Printables

Live status. The complete blank creation form was visible without uploading a file.

| Group | Native fields and rules | Current ModelPrep mapping | Audit result |
|---|---|---|---|
| Title | Required model name | Shared title | Mapped |
| Description | Required summary up to 120 characters plus Markdown description. Description can insert images and YouTube or Vimeo video | Shared description plus platform summary | Gallery text is mapped. Embedded description video is not a separate ModelPrep media target |
| Tags | Native tags | Shared tags are normalized to Printables rules | Mapped with adaptation |
| Category | Required native category | Live taxonomy match plus override | Mapped |
| Licence | Required native licence | Shared licence map plus override | Mapped |
| Origin or remix | Original, Remix, Reupload. Remix and reupload require a native parent | Shared provenance plus native parent field | Mapped |
| Price | Store model and Club model are account-gated. Store uses a whole USD price | Destination panel checks account eligibility | Mapped for implemented eligible accounts, not freshly visible on this blank form |
| Visibility | Draft or publish | Publication action | Mapped |
| Images | Ordered gallery | Shared ordered gallery | Mapped |
| Videos | No gallery video control seen. The description editor embeds YouTube or Vimeo | No destination video upload | Correct for gallery media. Documentation now records embedded video |
| Model files | Live form lists model, source, profile, document, image, archive, and machine-code formats, including 3MF, STL, OBJ, SCAD, GCODE, BGCODE, PDF, PNG and ZIP | Per-file roles plus ZIP unpack or keep rule | Mapped |
| Print profiles | No distinct native profile object in the creation form | Profile-like files remain files | Correct |
| Other native fields | Required AI yes or no, NSFW, Political Content, Work in Progress | AI and NSFW come from Details. Political Content is destination-only | Mapped |

Documentation correction. AI, NSFW, and embedded video were missing from the old comparison table.

## Cults3D

Live status. The first creation page was visible. Price, licence, and visibility remain on the later creation step and were not changed.

| Group | Native fields and rules | Current ModelPrep mapping | Audit result |
|---|---|---|---|
| Title | Name | Shared title | Mapped |
| Description | Markdown description plus manufacturing settings. YouTube links appear alongside photos | Shared description plus manufacturing settings | Mapped. YouTube placement is not a separate media target |
| Tags | Up to 20 free tags plus native meta tags such as articulated, customizable, print in place, resin print, scan | Shared tags plus native meta tags | Mapped |
| Category | Native category plus usage selector | Native category. ModelPrep fixes usage to 3D printing | **Gap. CNC or Laser, Papercraft, Sewing, and Electronics usages are not exposed** |
| Licence | Native licence coupled to free or paid state | Strict price-class map with no unsafe fallback | Mapped |
| Origin or remix | No dedicated origin selector was visible | No shared provenance mapping | Correct for the observed form |
| Price | Free, Paying, or Open Price. Earlier retained evidence also contains donation or offer behavior | Free or paid USD amount | **Gap. Open Price is not represented directly** |
| Visibility | Public, Secret, or Offline | Destination visibility | **Gap. Offline is not exposed** |
| Images | First item is cover. Live control lists JPG, PNG and WEBP, maximum 10 MB and 8000 by 8000 | Ordered shared gallery | Mapped |
| Videos | Live control lists WEBM and MP4 in the same ordered media area | Shared MP4 or WebM media | Mapped |
| Model files | Live list includes common CAD, mesh, profile, document and archive types. Maximum 1 GB per file. Only STL and OBJ up to 30 MB enter the 3D viewer | Per-file roles | Mapped |
| Print profiles | No separate profile object | Profile formats are ordinary files | Correct |
| Other native fields | AI checkbox, Allow comments, manager states and actions | Shared AI plus native comments option | Core fields mapped. Offline manager state is not a selectable ModelPrep outcome |

Documentation correction. The 2026-08-22 control does not list GIF as accepted media, while the current adapter still accepts it. Treat GIF support as unconfirmed until a first-party request contract is checked. The additional usage choices are also missing from ModelPrep.

## MyMiniFactory

Live status. The blank upload form and Advanced Settings were visible. Category was not visible before file upload, so current source and retained editor evidence cover that field.

| Group | Native fields and rules | Current ModelPrep mapping | Audit result |
|---|---|---|---|
| Title | Required Design Title | Shared title | Mapped |
| Description | Rich description plus Printing tips | Shared description plus destination printing tips | Mapped |
| Tags | Native tags | Shared tags | Mapped |
| Category | Hierarchical native categories, exposed later or in retained editor | Shared seed plus native IDs | Mapped with file-gated live evidence |
| Licence | Allow remixes, commercial use, exclusivity, resulting CC licence | Shared licence map | Mapped for current free branch |
| Origin or remix | Remix checkbox and parent MyMiniFactory object IDs | Shared provenance plus native parent IDs | Mapped |
| Price | Premium creator Store controls exist outside the free upload branch | Not exposed. Adapter hardcodes the normal free file mode | **Gap. Store pricing and purchase messages** |
| Visibility | Public or private | Publication option | Mapped |
| Images | Native picture uploader. Current adapter prepares JPEG at quality 90 with 2400 px longest edge | Shared gallery with destination conversion | Mapped |
| Videos | No native video field seen | None | Correct |
| Model files | 100 MB per file on this account. Premium and Archive modes have separate limits | Ordinary object files, 100 MiB limit, `fileMode=0` | Mapped only for the free normal branch |
| Print profiles | No separate profile object | 3MF stays an object file | Correct |
| Other native fields | Technology, material quantity, dimensions, time, tips, support-free, Scan The World, License store, declaration of original non-AI work | Most print fields and declaration are mapped | **Gap. Scan The World, License store, premium Store, and Archive Mode** |

Documentation correction. The previous implementation table covered the free upload contract but did not show Scan The World or License store. Premium Store and Archive Mode remain explicit unsupported branches.

## Thingiverse

Live status. The complete five-step editor was visible.

| Group | Native fields and rules | Current ModelPrep mapping | Audit result |
|---|---|---|---|
| Title | Required Name | Shared title | Mapped |
| Description | Required Summary plus Markdown description and structured sections | Shared description, summary, custom sections JSON, and Education JSON | Mapped |
| Tags | Native tags plus NSFW | Shared tags and NSFW | Mapped |
| Category | Native root and leaf taxonomy | Shared seed plus native category ID | Mapped |
| Licence | Native licence | Shared licence map | Mapped |
| Origin or remix | Remix checkbox and source Thing ID | Shared provenance plus native Thing ID | Mapped |
| Price | None | None | Correct |
| Visibility | Save as draft or Publish Thing | Publication action | Mapped |
| Images | Ordered pictures, minimum 1024 px width recommended | Shared gallery | Mapped |
| Videos | No gallery upload. A URL can be used in a structured rich section | ModelPrep does not send gallery video | Correct for gallery media |
| Model files | Broad file support. The live form names STL, OBJ, 3MF, SCAD, JPG and TXT as examples | Per-file roles | Mapped |
| Print profiles | Native printer, material, resolution and infill settings, not a profile file | Derived from sliced 3MF or destination override | Mapped |
| Other native fields | Thing or Edu Project type, separate Upload a Make path, AI Generated Content, Work in Progress, SCAD-gated Customizer, terms, post-print and design sections | Destination panel and Details disclosures | **Partial. Upload a Make is absent. Education data exists, but the distinct Edu Project journey is not certified** |

Documentation correction. AI and NSFW were omitted from the old comparison table. Video is a section URL, not an uploaded gallery item.

## Thangs

Live status. The first signed-in upload step was visible. The Edit and Finish steps are file-gated.

| Group | Native fields and rules | Current ModelPrep mapping | Audit result |
|---|---|---|---|
| Title | Later editor field | Shared title | Mapped in current adapter, live form file-gated |
| Description | Later editor field | Shared description | Mapped in current adapter, live form file-gated |
| Tags | Later editor field | Shared tags | Mapped in current adapter, live form file-gated |
| Category | Native category path | Shared seed plus native category | Mapped |
| Licence | Dynamic native licence picker | Free-text mapped licence | **Gap. Native licence IDs and addable licence choices are not represented exactly** |
| Origin or remix | Native inspiration and attribution controls in retained form evidence | Only allow-remix and feedback flags | **Gap. Inspiration attribution** |
| Price | Marketplace toggle and price, account-gated | Destination marketplace fields | Mapped for the captured branch |
| Visibility | Native audience has more than public and private states | ModelPrep sends private or public | **Gap. Six native audience modes collapse to two** |
| Images | Ordered media and optional card crop in current source | Shared gallery plus optional crop | Mapped |
| Videos | Native video embed URL in retained editor evidence | Not exposed | **Gap** |
| Model files | Live first step accepts `.3mf`, `.blend`, `.fbx`, `.glb`, `.gltf`, `.obj`, `.step`, `.stl`, `.usdz` | Single listing file flow, primary part, units, structure option | **Partial. Bulk, multipart, and assembly are represented as values but do not have independently certified native workflows** |
| Print profiles | Native print compatibility flags | Not exposed | **Gap** |
| Other native fields | Folder, workspace, access type, plans, dependencies, version notes, feedback, recovery draft | Destination panel | Mapped for current adapter fields |

Documentation correction. The old matrix understated the native form by representing visibility as public or private and omitting compatibility, video, inspiration, and the dynamic licence picker.

## Nexprint

Live status. The first upload step and a retained full editor were inspected read-only.

| Group | Native fields and rules | Current ModelPrep mapping | Audit result |
|---|---|---|---|
| Title | Model Name | Shared title | Mapped |
| Description | Rich editor with image, media, table, link, code block and other inserts. Maximum 10,000 characters | Shared description | Text is mapped. Native inline media and table branches are not modeled separately |
| Tags | Up to 20 | Shared tags. AI adds an AI-generated tag | Mapped |
| Category | Native taxonomy | Shared seed plus native ID | Mapped |
| Licence | Native allow-remix, share-alike, and commercial-use rules | Shared licence map | Mapped |
| Origin or remix | Original, Remix, Share and native source ID | Shared provenance plus native source model ID | Mapped |
| Price | None in current upload editor | None | Correct |
| Visibility | Save as draft or Publish | Publication action | Mapped |
| Images | Separate cover and up to 9 make photos | Shared cover crop plus gallery | Mapped |
| Videos | No gallery video control. Rich editor has Insert media | No gallery video upload | Correct for gallery media |
| Model files | First step requires Single model or Batch upload. Live accepted list includes common mesh and CAD formats | ModelPrep sends one listing | **Gap. Single or Batch upload mode is not exposed** |
| Print profiles | No native profile block in the retained editor | 3MF stays model geometry | Correct for current adapter contract |
| Other native fields | NSFW, AI tag, activity or contest, collections, BOM up to 100 rows, World-first Release | Details and destination panel | Mapped |
| Attachments | Live list: AI, BGCODE, CDR, CSV, CTB, INI, INO, LYS, LYT, PDF, SVG, TXT, ZIP | Current source also allows GCODE and GOO | **Mismatch. GCODE and GOO are not listed by the live control** |

Documentation correction. The old matrix omitted the required Single or Batch upload decision and the rich editor branches. The attachment allow-list is stale in code and must be rechecked before sending GCODE or GOO.

## Creality Cloud

Live status. A retained full editor was inspected read-only. No save action was used.

| Group | Native fields and rules | Current ModelPrep mapping | Audit result |
|---|---|---|---|
| Title | Model Name, maximum 60 | Shared title | Mapped |
| Description | Rich description with image and Boost Me controls | Shared description | Shared text is mapped. **Boost Me is a gap** |
| Tags | Up to 20 | Shared tags | Mapped |
| Category | Native taxonomy | Shared seed plus native ID | Mapped |
| Licence | Native remix, share-alike, and commercial-use rules | Shared licence map | Mapped |
| Origin or remix | Original, Remix, Non-original | ModelPrep deliberately supports Original only | **Gap. Remix and Non-original attribution are blocked** |
| Price | Required Free or Paid control was live on the current account | Adapter hardcodes free with `pricingMethod: 0` and `isPay: false` | **Gap and prior documentation error** |
| Visibility | Public or private | Publication option | Mapped |
| Images | Separate 4:3 web and 3:4 app covers, up to 9 gallery images. JPG, GIF and PNG up to 20 MB | Shared gallery plus both cover crops | Mapped |
| Videos | No direct model video upload was visible | No direct gallery video | Correct |
| Model files | STL, OBJ, PLY, OFF, 3MF, 3DS, WRL, DAE, STEP, STP and other listed formats. Files have native notes | Per-file models and notes | Mapped for ordinary model files |
| Print profiles | Native Creality Print Configuration is distinct from raw model geometry | Raw 3MF is uploaded as a model file | **Gap. No parsed native print configuration** |
| Other native fields | NSFW, instruction files, required BOM yes or no, standalone Upload Print Files, import from `crealitycloud.cn` | NSFW and instruction files are mapped | **Gap. BOM, standalone print-file upload, and import are not sent** |

Documentation correction. Paid controls are not account-gated on the current account. The existing matrix statement was wrong. BOM and Boost Me were also absent from the ModelPrep coverage table.

## MakerOnline

Live status. A retained Step 1 editor and the Add Files step were inspected read-only.

| Group | Native fields and rules | Current ModelPrep mapping | Audit result |
|---|---|---|---|
| Title | Maximum 100 | Shared title | Mapped |
| Description | Rich description, maximum 9000. Print profile description maximum 1000 | Shared description plus profile description | Mapped |
| Tags | Up to 20 | Shared tags | Mapped |
| Category | Two-level native category | Shared seed plus native ID | Mapped |
| Licence | Native licence | Shared licence map | Mapped |
| Origin or remix | Original or Remix plus original work URL | Shared provenance | Mapped |
| Price | No active price control in the current upload steps. ModelPrep contains dormant paid fields | Not exposed | Correct for the observed account and form |
| Visibility | Draft or public action plus separate Public or Private permission | Publication action and permission | Mapped |
| Images | JPG, PNG, GIF, WEBP, JPEG, HEIC, maximum 30 MB each, up to 20 total. First image is cover | Shared ordered gallery | Mapped |
| Videos | No native model video field seen | None | Correct |
| Model files | Up to 100 files. Live list includes STL, OBJ, 3MF and many CAD formats | Per-file roles | Mapped |
| Print profiles | Anycubic Slicer 3MF question, profile file, printer and plates, title, photos, description | Optional native profile conversion and profile fields | Mapped, but complete profile readback remains a separate certificate |
| Other native fields | Required AI yes or no, NSFW, printing method, documentation, Creative Kits, China sync, Exclusive eligibility | Details and destination panel | Mapped for eligible branches |

Documentation correction. The old comparison omitted AI and NSFW. The current live limits and the separate profile Add Files step are now recorded explicitly.

## MakerRoad

Live status. The complete upload form was visible without changing it.

| Group | Native fields and rules | Current ModelPrep mapping | Audit result |
|---|---|---|---|
| Title | Maximum 60 | Shared title | Mapped |
| Description | Rich description | Shared description | Mapped |
| Tags | Native tags | Shared tags | Mapped |
| Category | Up to 3 paths | Shared seed plus native paths | Mapped |
| Licence | Native adaptation, attribution, share-alike and commercial-use rules | Shared licence map | Mapped |
| Origin or remix | Original or Remix plus source URL | Shared provenance | Mapped |
| Price | The independent live form displayed fixed Free. Earlier request contracts expose Free, Points, and Cash | Destination price and value supports all three | **Conflict. Revalidate Points and Cash before treating paid upload as current** |
| Visibility | Public or private, optional scheduled publication | Destination visibility and schedule | Mapped |
| Images | JPG, JPEG, PNG, GIF, BMP, WEBP. Recommended 1:1. Minimum 3, maximum 10 | Shared ordered gallery | Mapped |
| Videos | No native video field seen | None | Correct |
| Model files | 3MF, STL or OBJ, up to 80 files | Per-file model roles | Mapped |
| Print profiles | Separate 3MF Print Configuration Files | Native profile role | Mapped |
| Other native fields | Print Makes and Print Configurations upload types, AI, NSFW, print method, printers, material brand and type, color, instruction documents, mixed category and printing facets, terms | Most listing fields and documents are mapped | **Gap. Print Makes and the upload-type Print Configurations branch are disabled or unsupported. The mixed taxonomy is presented as ordinary categories** |

Documentation correction. AI, NSFW, instruction formats, file count, and the disabled native upload types were missing from the old summary. Save still has a review-side effect in the tested native workflow, so it must not be described as a safe private draft.

## Gaps by priority

| Priority | Platform | Missing or inaccurate behavior | Why it matters |
|---|---|---|---|
| 1 | Creality Cloud | Paid pricing, BOM, Boost Me, Remix or Non-original attribution, native print configuration | The live form exposes these on the current account. The adapter silently forces Free and Original, so the old docs were materially wrong. |
| 2 | Thangs | Full audience enum, print compatibility, video embed, inspiration attribution, exact licence picker, certified structure workflows | ModelPrep currently compresses several native choices into simpler fields. |
| 3 | Nexprint | Single or Batch upload decision, exact live attachment allow-list, rich inline media, native batch workflow | The first native decision changes the meaning of the uploaded file set. |
| 4 | MakerRoad | Current live form fixed Free, while ModelPrep offers Points and Cash | The paid request contract may be stale or account-gated. It needs a fresh first-party request inspection. |
| 5 | MyMiniFactory | Scan The World, License store, premium Store, Archive Mode | The current adapter covers the normal free listing path only. |
| 6 | Cults3D | Additional usages, Open Price, Offline, full price behavior, current GIF contract | These choices change discovery, sales behavior, visibility, or media acceptance. |
| 7 | MakerWorld | Share source, 14-day launch option, and the remaining Laser and Cut gate | The core flow is mapped, but these native branches are absent or not freshly traversed. |
| 8 | Thingiverse | Upload a Make and complete Edu Project journey | The normal Thing flow is mapped. The other content types are not complete native journeys in ModelPrep. |
| 9 | Printables | Embedded YouTube or Vimeo media as a first-class mapping, eligible Store and Club refresh | Core listing fields are mapped. These are conditional branches. |
| 10 | MakerOnline | Full native profile retained-result equality and account-gated branch refresh | The fields are present and mapped. Proof is narrower than the implemented surface. |

## Documentation audit

| Document | Finding | Correction |
|---|---|---|
| `platform-field-matrix-2026-08-21.md` | Useful code snapshot, but its compact convergence table omitted shared AI and NSFW. It also said Creality paid controls were account-gated and reduced several native forms too far | Marked as a code snapshot and linked here. Creality, media, profile, and native-field corrections are recorded in this audit |
| `platform-upload-requirements-live.md` | Canonical detail was last headed as a 2026-08-02 audit even though later retained evidence existed | Added a 2026-08-22 read-only refresh and linked this comparison |
| Per-platform `*-web-flow.md` files | Strong transport and retained-result records, but they are not a single current field comparison | Retained as protocol evidence. This document is the cross-platform field and gap index |
| Screenshot matrix supplied for this audit | Too coarse to distinguish native absence, mapping, account gates, file gates, rich-editor media, and unsupported controls | Replaced by the comparison and ten platform tables above |

## Implementation evidence anchors

| Source | What it establishes |
|---|---|
| `deploy/src/lib/shared-defaults.js:267-289` | The exact AI and NSFW destination fan-out from the shared Details step |
| `deploy/src/lib/platform-files.js:29-90` | Slicer recognition, native profile destinations, and the rule that keeps Creality and Nexprint 3MF files as model geometry |
| `deploy/src/lib/platform-images.js:68-126` | Destination cover, order, crop, and MyMiniFactory conversion behavior |
| `deploy/src/lib/platform-workflow.js:173-188` | Media limits and treatments shown in destination requirements |
| `deploy/src/App.jsx:328-341` | Current Nexprint attachment allow-list, including the GCODE and GOO entries that conflict with the live control |
| `desktop/creality-direct.js:213-214` | The current Creality adapter forces `pricingMethod` to `0` and `isPay` to `false` |
| `deploy/src/App.jsx:5322-5679` | Destination preflight, required choices, and adaptations before publish |
| `deploy/src/App.jsx:12427-12436` | All ten direct upload flows used by the Publish step |

## What is verified and what remains

This audit verified that each signed-in native upload surface was reached, every field that could be inspected without an upload or save was recorded, current ModelPrep source was reconciled with those fields, and no external state changed.

MakerWorld metadata, Thangs later steps, MyMiniFactory category, and Cults3D later price and licence controls are partially verified because they are file-gated or step-gated. Their rows combine live entry-step evidence with current source and retained earlier editors.

This audit did not verify that every platform would accept a new submission today, that every optional branch persists after a write, or that account-gated paid programs are enabled. Those claims require an authorized upload followed by persisted readback.
