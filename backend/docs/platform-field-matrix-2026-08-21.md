# Platform field matrix, 2026-08-21

Built from the code, read-only, at the working tree after the five-step change. Line numbers refer to `deploy/src/App.jsx` unless another file is named. Sources: `App.jsx`, `lib/platform-required.js`, `lib/platform-defaults.js`, `lib/platform-files.js`, `lib/shared-defaults.js`, `lib/platform-workflow.js`, `lib/makerworld.js`, `lib/batch-publish.js`.

> This remains a code-structure snapshot, not the current native-form audit.
> For the signed-in 2026-08-22 comparison, all requested field groups, and the
> implementation gaps per platform, use
> `platform-workflow-mapping-audit-2026-08-22.md`. That audit corrects the old
> Creality pricing claim and records native controls that this panel-oriented
> table does not represent. The clean-context verification and its comparison
> are in `platform-upload-flow-independent-audit-2026-08-22.md` and
> `platform-upload-independent-comparison-2026-08-22.md`.

## How the four kinds are decided

A field is **derived** when `deriveSharedDefaultPatches` writes it from the Details, Files, Images or Profiles steps and the panel only offers an override (`lib/shared-defaults.js:372-472`). The override is recorded by clearing `categoryAuto` / `licenseAuto`, and `AutoMatchNote` (`App.jsx:8800-8809`) tells the user the value came from Details.

A field is **reference** when it renders text only. Limits and accepted formats are no longer fields at all: they sit in the card header's "Requirements and evidence" disclosure (`App.jsx:10424-10429`), which reads `platformWorkflow` and `destinationMediaTreatment` from `lib/platform-workflow.js:173-188`.

A field is **decision** when nothing upstream can answer it and preflight blocks without it.

A field is **unique** when only one platform declares it in `initialProject.platforms` (`App.jsx:1038-1095`).

**Required** is `isRequiredField(platformId, labelText)` (`lib/platform-required.js:9-30`), a regex over the label text, rendered as an asterisk by `Label` and `FieldCaption`. The rules were derived from what `platformPreflight` reports as errors (`App.jsx:5322-5679`).

**Remembered** is the inverse of `isProjectBound` (`lib/platform-defaults.js:15-19`). The pattern `/file|image|photo|cover|remix|related|parent|verifyObjectId|contest|Auto(Exact)?$|^enabled$|^price$/i` is a substring test, so any key containing `file` (including every key containing `profile`) and any key containing `related` are excluded.

## MakerWorld

Panel: `MakerWorldOptions`. Preflight: `makerWorldPublishIssues`, `lib/makerworld.js:188-302`.

| Field | Kind | Required | Remembered | Source step | Notes |
|---|---|---|---|---|---|
| Product type (3D Model / Laser & Cut) | decision | no | yes (`productMode`) | Platforms | Switches the whole panel and the accepted-format list. |
| Laser & Cut upload mode (raw / .lac) | decision, unique | no | yes (`laserMode`) | Platforms | |
| Primary Bambu Suite profile package | derived | no | no (`primaryLacFileId`) | Files | Options are the project's `.lac` files. |
| Machine name, process type, material IDs, other tools overrides | reference override, unique | no | yes (`laserInfo`) | Files | Read from the `.lac` package; typed only to correct it. |
| Laser & Cut profile name | decision, unique | yes | no (`laserProfile`) | Platforms | `/profile name/i`; blocker `makerworld.js:244`; 60-char cap. |
| Laser profile description, visibility | decision, unique | no | no | Platforms | |
| Use main model cover as profile cover; additional pictures (n/37) | derived, unique | no | no | Images | Cap enforced at `makerworld.js:251`. |
| Category | decision (own taxonomy) with derived seed | yes | yes (`categoryId`) | Details | Seeded from `SHARED_CATEGORY_DEFAULTS[*].makerworld` (`shared-defaults.js:35-182`); leaves only, from `data/makerworld-categories.json`. Blocker `makerworld.js:264`. |
| Source (Laser & Cut only) | derived | no | yes (`modelSource`) | Details | Written by `provenancePatch` (`shared-defaults.js:299-300`). |
| Visibility | decision | no | yes (`visibility`) | Platforms | Default `private`. |
| Initial Bambu Studio print profile | derived | no | no (`primaryProfileFileId`) | Files | One initial 3MF only; the rest stay raw models. |
| License | derived ("Same as Details step") | no | yes (`license`) | Details | Empty means the Details licence mapped by `MW_LICENSE_MAP`. Override for MakerWorld-only licences (Exclusive, SDFL-PPO). |
| Print profiles (embedded Profiles editor) | derived | yes (name, photo, confirmations) | no | Profiles | `ProfilesSection` with `embedded` inside the panel. Blockers `makerworld.js:290-297`. |
| Model source (3D) | derived | no | yes | Details | |
| Remix URL / search your MakerWorld designs | derived | yes when remix | no (`remixUrl`, `remixModel`) | Details | Blocker `makerworld.js:225-228`. |
| Original model license | decision, unique | yes when remix | no (`remixLicense`) | Platforms | Blockers `makerworld.js:230-231`. |
| What did you change? | derived | yes when remix | no (`remixDescription`) | Details | Same text as `provenance.changes`; blocker `makerworld.js:229`. |
| Linked Laser & Cut / 3D model | decision, unique | no | no (`relatedModel`) | Platforms | |
| CyberBrick toggle | unique | no | yes (`cyberBrick`) | Platforms | Auto-cleared when the account lacks `rcUpload`. |
| CyberBrick control configuration JSONs | unique | yes when CyberBrick on | no (runtime only) | Platforms | Blocker `makerworld.js:254,271`. Held in `mwRuntimeCyberBrick`, never serialised. |
| CyberBrick motion JSONs / main controller JSON / MicroPython | unique | no | no (runtime only) | Platforms | |
| Bill of Materials: Product ID, kits, filaments, materials | unique | no | yes (`boms`) | Platforms | Catalogue `data/makerworld-bom-catalog.json`. |
| Other parts (free text) | unique | no | yes (`otherParts`) | Platforms | |
| Assembly guide / Other files | unique | no | no (runtime only) | Platforms | Held in `mwRuntimeDocs`. |
| Exclusive Model Program + terms | decision, unique | yes when exclusive on | yes | Platforms | Blockers `makerworld.js:267,270`. Remixes are ineligible. |
| Also create a community post | decision, unique | no | yes (`communityPost`) | Platforms | |

## Printables

Panel: `PrintablesOptions`. Preflight: `App.jsx:5396-5434`.

| Field | Kind | Required | Remembered | Source step | Notes |
|---|---|---|---|---|---|
| Batch action (draft / publish) | decision | no | yes (`publication`) | Platforms | |
| Printables summary (120 chars) | derived | no in practice | yes (`summary`) | Details | Label says "(required)" but blank falls back to the description; no preflight error exists for it. |
| Printables category | decision (live taxonomy) with derived seed | yes by preflight, not marked | yes (`categoryId`) | Details | Seeded by `matchPrintablesCategory` against the live `/api/v1/printables/meta` list. Blocker `App.jsx:5414`. The mark does not render: the rule is `/^category/i` and the label reads "Printables category". |
| Printables license | derived | no | yes (`licenseId`) | Details | Blank means the mapped project licence. List filtered by free vs paid. |
| Authorship (author / remix / reupload) | derived plus a unique third state | no | yes (`authorship`) | Details | `provenancePatch` writes author/remix and never overwrites `reupload`. |
| Original model URL or Printables ID | decision, unique | yes when remix or reupload | no (`remixParents`) | Platforms | Blocker `App.jsx:5419`. The parent must be a Printables model. |
| Paid Store model | unique | no | yes (`store`) | Platforms | Gated on `designerStatus` and `storeActive` from `/printables/web/whoami`. |
| Club model | unique | no | yes (`club`) | Platforms | |
| Store price (whole USD) | decision, unique | yes when Store on | no | Platforms | Bounds enforced by `printablesPaidIssues`. |
| Exclude commercial usage for Club tiers | unique | no | yes | Platforms | |
| Store fee / store-limit / reupload notices | reference | no | n/a | Platforms | |
| ZIP handling (unpack / keep as Other) | decision, unique | no | yes (`zipMode`) | Files | 256 MiB cap. |
| Political content | decision, unique | no | yes | Platforms | |

## Cults3D

Panel: `CultsOptions`. Preflight: `App.jsx:5371-5394`.

| Field | Kind | Required | Remembered | Source step | Notes |
|---|---|---|---|---|---|
| Price (USD): Free / Paid + amount | decision, unique | yes | no (`free` is remembered) | Platforms | Rendered because `fields: ['price']`. Bounds 0.65 to 1200. |
| Cults3D category | decision (own taxonomy) with derived seed | yes | yes (`categoryId`) | Details | Blocker refuses a fallback. |
| Cults3D license | derived, filtered by price class | yes | yes (`licenseType`) | Details | `CULTS_LICENSE_MAP` maps the CC family; the paid Standard licence has no map and no fallback. Free/paid mismatch blocks. |
| Visibility (secret / public) | decision | no | yes (`visibility`) | Platforms | |
| Manufacturing settings | decision, unique | no | yes (`details`) | Platforms | |
| Platform labels (meta tags) | decision, unique | no | yes (`metaTags`) | Platforms | |
| Allow comments | decision, unique | no | yes (`showComments`) | Platforms | |
| 3D-printing usage note, review note | reference | no | n/a | Platforms | |

## MyMiniFactory

Panel: `MyMiniFactoryOptions`. Preflight: `App.jsx:5565-5593`.

| Field | Kind | Required | Remembered | Source step | Notes |
|---|---|---|---|---|---|
| Category | decision (own taxonomy) with derived seed | yes | yes (`categoryIds`) | Details | Live tree when a desktop session exists, otherwise the audited snapshot. Five shared categories have no MMF match by design. |
| Visibility (private / public) | decision | yes | yes (`publication`) | Platforms | |
| License | derived | yes | yes (`licenseId`) | Details | `MMF_LICENSE_MAP`; the unmappable `standard` falls back to id 5 flagged inexact. |
| Technology (FDM / DLP-SLA / SLS) | derived from the sliced 3MF | no | yes | Files | `packageDerivedPatch` writes `FDM` when the profile names a printer. |
| Material quantity | derived from the sliced 3MF | no | yes | Files | Filled from `filamentGrams`. 45-char cap. |
| Dimensions + unit | decision, unique | no | yes | Platforms | 100-char cap. |
| Print time range (minutes) | decision, unique | no | yes | Platforms | MMF stores minutes; an earlier hours label silently published 3 to 5 minutes. |
| Printing tips | decision, unique | no | yes (`printingTips`) | Platforms | |
| Prints without supports | decision, unique | no | yes (`supportFree`) | Platforms | |
| This object is a remix | derived | no | no (`remix`) | Details | |
| Parent MyMiniFactory object IDs | decision, unique | yes when remix | no (`remixParentIds`) | Platforms | A URL cannot express this. |
| Verify an existing object (read-only) | decision, unique | no | no (`verifyObjectId`) | Platforms | Reads back; never writes. |
| Required declaration (original, no generative AI) | decision, unique | yes, asked at publish | yes (`confirmOriginalNoAi`) | Publish | A `confirmations` entry satisfied by the Publish-step tick. |

## Thingiverse

Panel: `ThingiverseOptions`. Preflight: `App.jsx:5635-5650`.

| Field | Kind | Required | Remembered | Source step | Notes |
|---|---|---|---|---|---|
| Action (draft / publish) | decision | no | yes (`publication`) | Platforms | |
| License | derived | no | yes (`license`) | Details | `THINGIVERSE_LICENSE_MAP`, fallback `cc-nc` flagged inexact. |
| Summary | derived | no | yes (`summary`) | Details | Falls back to the description. |
| Category | decision (own taxonomy) with derived seed | yes | yes (`categoryId`) | Details | The only platform with a real "Other" leaf. |
| Work in progress | decision, unique | no | yes (`wip`) | Platforms | |
| Customizable | decision, unique | conditionally | yes (`customizable`) | Files | Disabled unless a `.scad` file is present. |
| Remix | derived | no | no (`remix`) | Details | |
| Source Thing ID | decision, unique | yes when remix | yes (`sourceThingId`) | Platforms | Remembered although project-specific: no `PROJECT_BOUND` pattern matches the key. |
| Accept Thingiverse publishing terms | decision, unique | yes when publishing | yes (`termsAccepted`) | Platforms | |
| Printer / Material / Resolution / Infill | derived from the sliced 3MF | no | yes (`printSettings`) | Files | Filled by `packageDerivedPatch`. |
| Custom sections (JSON), Education project data (JSON) | decision, unique | no | yes | Platforms | |

## Thangs

Panel: `ThangsOptions`. Preflight: `App.jsx:5625-5633`.

| Field | Kind | Required | Remembered | Source step | Notes |
|---|---|---|---|---|---|
| Visibility (private / public) | decision | no | yes (`publication`) | Platforms | |
| Structure (single / bulk / multipart / assembly) | decision, unique | validated | yes (`structure`) | Platforms | |
| Units | derived from the 3MF `<model unit>` | no | yes (`units`) | Files | |
| Primary part | derived from Files | yes | no (`primaryFileId`) | Files | `thangsPrimaryFilePatch` stores the first model file so preflight stops asking. |
| Category path | decision (own taxonomy) with derived seed | no | yes (`category`) | Details | Live endpoint or the 2026-08-01 snapshot. |
| Folder ID / Workspace ID | decision, unique | no | yes | Platforms | Account-level, so remembering them is correct. |
| Resume existing private draft ID | decision, unique | numeric if set | yes (`resumeDraftId`) | Platforms | Recovery only; remembering it is a hazard. |
| Access type ID / Plan IDs, Dependency model IDs, Version notes, Allow remix / Enable feedback | decision, unique | no | yes | Platforms | |
| Paid marketplace listing + price | decision, unique | yes price when on | `marketplace` yes, `price` no | Platforms | |
| License (free text) | derived | no | yes (`license`) | Details | `THANGS_LICENSE_MAP`, fallback `CC BY-NC` flagged inexact. |
| Native audience modes, compatibility flags, video embed, inspiration attribution, dynamic licence picker | unsupported native fields | varies | n/a | Platforms | The current ModelPrep panel reduces audience to private or public and does not expose these retained native controls. |
| 250 MB reference-file rule, read-back note | reference | no | n/a | Platforms | |

## Nexprint

Panel: `NexprintOptions`. Preflight: `App.jsx:5435-5477`.

| Field | Kind | Required | Remembered | Source step | Notes |
|---|---|---|---|---|---|
| Batch action (draft / publish) | decision | no | yes (`publication`) | Platforms | |
| Originality (original / adapted / reprint) | derived plus a unique third state | yes | yes (`originalityType`) | Details | Reprint has no shared equivalent. |
| Nexprint model ID (instead of the source URL) | decision, unique | one of the two | yes (`sourceModelId`) | Platforms | Preflight accepts either the Details URL or this ID. |
| Category | decision (live taxonomy) with derived seed | yes | yes (`categoryId`) | Details | Second-column leaves only. |
| License | derived | yes | yes (`licenseType`) | Details | Seeded from `NEXPRINT_LICENSE_MAP`. |
| Upload mode (single model / batch upload) | unsupported native field | yes before file upload | n/a | Files | ModelPrep creates one listing and does not expose the native batch branch. |
| Include bill of materials; rows (n/100) | decision, unique | rows must be valid | yes (`hasBom`, `bom`) | Platforms | |
| Eligible activities and contests | decision, unique | no | yes (`activityIds`) | Platforms | Loaded live per account; not a static checkbox. |
| Your collections | decision, unique | no | yes (`collectionIds`) | Platforms | |
| World-first release | decision, unique | no | yes (`worldFirstRelease`) | Platforms | Hidden for Reprint. |
| AI-tag notice, creator-fund note | reference | no | n/a | Platforms | |

## Creality Cloud

Panel: `CrealityOptions`. Preflight: `App.jsx:5478-5506`.

| Field | Kind | Required | Remembered | Source step | Notes |
|---|---|---|---|---|---|
| Batch action (private / public) | decision | no | yes (`publication`) | Platforms | |
| Model source (original / remix / non-original) | derived plus a unique third state | effectively yes | yes (`modelSource`) | Details | Anything other than Original is a hard blocker: ModelPrep will not guess at attribution. |
| Category | decision (own taxonomy) with derived seed | yes | yes (`categoryId`) | Details | |
| License | derived | yes | yes (`license`) | Details | Seeded from `CREALITY_LICENSE_MAP`. |
| Price (free / paid) | unsupported native field | native form requires a choice | n/a | Platforms | The signed-in 2026-08-22 editor exposes both states. The adapter hardcodes free. |
| Bill of Materials | unsupported native field | yes/no is required in the live editor | n/a | Platforms | Not sent by ModelPrep. |
| Boost Me rich-description control | unsupported native field | no | n/a | Platforms | Not represented by the shared rich-description mapping. |
| What ModelPrep sends | reference | no | n/a | Platforms | Ordinary model files, instruction files, dual covers, gallery, title, description, category, tags, licence, NSFW, visibility and Original source. |

ModelPrep has no Creality print-profile field. It uploads 3MF as plain model geometry (`lib/platform-files.js:84-90`), while the native product has a distinct Creality Print Configuration concept.

## MakerOnline

Panel: `MakerOnlineOptions`. Preflight: `App.jsx:5507-5551`.

| Field | Kind | Required | Remembered | Source step | Notes |
|---|---|---|---|---|---|
| Batch action (draft / public) | decision | no | yes (`publication`) | Platforms | Public also forces `permission: 1`. |
| Model source (original / remix) | derived | yes | yes (`source`) | Details | |
| Original work URL | derived | yes when remix | yes (`originalUrl`) | Details | NoDerivatives licences are refused for a remix. |
| Category | decision (live taxonomy) with derived seed | yes | yes (`categoryId`) | Details | |
| License | derived | yes | yes (`license`) | Details | Seeded from `MAKERONLINE_LICENSE_MAP`. |
| Model permissions (public / private) | decision | yes | yes (`permission`) | Platforms | Distinct from the draft action. |
| Printing method (both / FDM / resin) | decision | yes by preflight, not marked | yes (`printMethod`) | Platforms | Rule is `/print method/i`, label reads "Printing method", so no asterisk renders. |
| Upload .3mf as MakerOnline print profiles | decision, unique | no | no (`includePrintProfile` contains "file") | Files | Not a blocker. |
| Print profile title, description | decision, unique | no | yes | Platforms | |
| This model uses Creative Kits; kit list | decision, unique | yes to pick one when on | `relatedKits` no, `storeKitIds` yes | Platforms | The `/creative kit/i` rule never renders because this is a plain checkbox. |
| Sync to MakerOnline China | decision, unique | account-gated | yes (`syncChina`) | Platforms | |
| Exclusive model | decision, unique | account-gated | yes (`exclusive`) | Platforms | Forces original, public, licence 8 and print profiles on. |
| Coverage note (20 images, dormant paid pricing) | reference | no | n/a | Platforms | |

## MakerRoad

Panel: `MakerRoadOptions`. Preflight: `App.jsx:5552-5564` and `5594-5623`.

| Field | Kind | Required | Remembered | Source step | Notes |
|---|---|---|---|---|---|
| Native action (save / submit) | decision | no | yes (`publication`) | Platforms | Save is a review submission; no private draft in tested flows. |
| Upload type (original / remix) | derived | no | yes (`uploadType`) | Details | |
| Original model URL | derived | yes when remix | yes (`referUrl`) | Details | |
| Categories (n/3) | decision (live taxonomy) with derived seed | yes | yes (`categoryIds`, `categoryPaths`) | Details | Seeded as label paths, resolved against the live taxonomy at upload. |
| License | derived | no | yes (`licenseIndex`) | Details | `MAKEROAD_LICENSE_MAP`, fallback index 2 flagged inexact. |
| Visibility (private / public) | decision | no | yes (`visibility`) | Platforms | |
| Print methods (FDM / LCD / Others) | decision, unique | yes | yes (`printMethods`) | Platforms | Read-back checks it persisted. |
| Compatible printers, Materials, Colors | decision, unique | no | yes | Platforms | |
| Download price (free / points / cash) + value | decision, unique | yes value when not free | yes | Platforms | |
| Schedule public availability + time | decision, unique | yes time when on | yes (`scheduled`, `planTime`) | Platforms | The `/publication time/i` rule never renders because this is a plain checkbox. |
| Accept MakerRoad terms | decision, unique | yes when submitting | yes (`termsAccepted`) | Platforms | |
| Real print photo confirmation | decision | yes, asked at publish | no | Profiles or Publish | Satisfied by a profile's `realPhotoConfirmed` or the Publish-step tick. |
| Licence mapping and coverage note | reference | no | n/a | Platforms | |

## Where steps converge and differ

| Field | MakerWorld | Printables | Cults3D | MyMiniFactory | Thingiverse | Thangs | Nexprint | Creality | MakerOnline | MakerRoad |
|---|---|---|---|---|---|---|---|---|---|---|
| Title | same | same | same | same | same | same | same | same | same | same |
| Description | same | same | same | same | same | same | same | same | same | same |
| Tags | same | mapped | same | same | same | same | same | same | same | same |
| AI disclosure | mapped | mapped | mapped | native declaration | mapped | mapped | mapped as tag | no native field seen | mapped | mapped |
| NSFW | mapped | mapped | n/a | n/a | mapped | n/a | mapped | mapped | mapped | mapped |
| Category | own taxonomy | own taxonomy | own taxonomy | own taxonomy | own taxonomy | own taxonomy | own taxonomy | own taxonomy | own taxonomy | own taxonomy |
| Licence | mapped | mapped | mapped | mapped | mapped | mapped | mapped | mapped | mapped | mapped |
| Visibility | same | same | same | same | same | native audience gap | same | same | unique rule | unique rule |
| Origin / remix | mapped | unique rule | n/a | mapped | mapped | native attribution gap | unique rule | unsupported beyond Original | mapped | mapped |
| Price | n/a | unique rule | unique rule | premium branch gap | n/a | unique rule | n/a | unsupported native field | n/a | unique rule |
| Images | mapped | same | same | mapped | same | mapped | mapped | mapped | same | unique rule |
| Videos | uploaded media | description embed | uploaded media | n/a | section URL | native embed gap | description media | n/a | n/a | n/a |
| Files | same | unique rule | same | same | same | unique rule | same | same | same | same |
| Print profile | unique rule | n/a | n/a | n/a | settings only | compatibility gap | n/a | native configuration gap | unique rule | mapped |
| Release plan | same | same | same | same | same | same | same | same | same | unique rule |

*same*: the step's value is sent unchanged. *mapped*: a documented per-platform transform runs (`shared-defaults.js`, `platformImagePlan`, `normalizePrintablesTags`). *own taxonomy*: the platform has its own tree that the shared value only seeds. *n/a*: no such field. *unique rule*: a constraint no other platform imposes.

Row-by-row evidence:

- **Title.** Every adapter sends `project.title`; only the caps differ (`limits.titleMax`: 50 MakerWorld, 255 Printables, 80 Nexprint, 60 Creality, 100 MakerOnline, 60 MakerRoad; unset for Cults3D, MyMiniFactory, Thingiverse and Thangs by the no-invented-caps rule at `App.jsx:568-571`).
- **Description.** Shared markdown, converted per `descFormat`. MakerWorld Laser & Cut has no description field and warns instead of silently dropping it.
- **Tags.** Printables normalises to lowercase single words and says so as an adaptation. Everyone else takes the list with a per-platform count and character cap.
- **Category.** Ten trees, no two alike. `SHARED_CATEGORY_DEFAULTS` declares one audited native value per platform per shared category; Printables is matched live; MyMiniFactory is deliberately sparse and "Other" maps only on Thingiverse.
- **Licence.** Five platforms are filled by `LICENSE_TARGETS`; MakerWorld, Printables, Nexprint, Creality and MakerOnline use their own map constants at the panel. Cults3D is the only one with no fallback, because its free-versus-paid class couples to price.
- **Visibility.** Eight platforms are a two-state choice. MakerOnline splits it into a draft action plus a stored `permission`. MakerRoad has no accepted private path: every Save enters review.
- **Origin and remix.** `provenancePatch` covers eight platforms. Cults3D and Thangs have no origin field. Printables adds `reupload`, Nexprint adds `Reprint`, Creality adds `Non-original`, and the platform-only identifiers (Thingiverse Thing ID, MyMiniFactory parent object IDs, Printables parent model) stay in their panels because a generic URL cannot express them.
- **Price.** ModelPrep maps four selling branches: Cults3D free or paid USD, Printables Store and Club, Thangs marketplace, and MakerRoad free, points, or cash. The native MyMiniFactory premium Store and Creality Free or Paid controls are not mapped.
- **Images.** One ordered gallery with one cover and a focal point. MakerWorld, Nexprint and Creality get real crops. MyMiniFactory re-encodes at quality 90 with a 2400 px longest edge. Thangs offers an optional card crop. MakerRoad is the only hard range: 3 to 10 images or nothing publishes.
- **Videos.** ModelPrep uploads shared video only to MakerWorld and Cults3D. Printables can embed YouTube or Vimeo in its description, Thingiverse can store a URL in a structured section, Nexprint has rich-editor media, and Thangs has a native embed URL that ModelPrep does not expose.
- **Files.** One package, one role per file per destination (`lib/platform-files.js:100-121`). Printables has a ZIP mode choice; Thangs rejects some filename characters and pushes anything over 250 MB to references.
- **Print profile.** `NATIVE_PROFILE_PLATFORMS` is MakerWorld and MakerRoad (`lib/platform-files.js:47`); the picker also offers the profile role to MakerOnline. Creality and Nexprint keep the 3MF as ordinary geometry.
- **Release plan.** Every platform is in `LIVE_PUBLISH_PLATFORM_IDS`, so all ten get a plan row, now on Publish. MakerRoad also has a native scheduled time of its own.

## What each step feeds

**Files.** Every platform reads the same list through `platformCandidateFiles` and a per-destination role. `.3mf` becomes a profile automatically for MakerWorld and MakerRoad, manually for MakerOnline. `.scad` enables the Thingiverse Customizer. `.lac` exists only for MakerWorld Laser & Cut. `.zip` is a Printables-only decision. The sliced 3MF also fills Thingiverse print settings, MyMiniFactory technology and material quantity, and the Thangs unit.

**Details.** Title and description reach all ten. Category seeds ten native trees. Licence seeds ten native lists. Origin, AI disclosure and NSFW are written once and fanned out by `AI_TARGETS` (eight platforms, all but MyMiniFactory and Creality), `NSFW_TARGETS` (seven, all but Cults3D, MyMiniFactory and Thangs) and `provenancePatch` (eight, all but Cults3D and Thangs).

**Images.** The ordered gallery and cover feed all ten. Crops feed MakerWorld, Nexprint and Creality. Videos feed MakerWorld and Cults3D. The MakerWorld Laser & Cut profile picks its cover and up to 37 pictures from the same gallery.

**Profiles (now inside the MakerWorld panel).** MakerWorld consumes the whole editor: name, visibility, description, cover, photos, the real-photo confirmation and the guidelines acknowledgement. MakerRoad borrows exactly one field, `realPhotoConfirmed`, as an alternative to its own publish-time confirmation. No other platform reads it.

**Platforms.** The ten cards. Shared parts: readiness pill, "Needs attention", adaptations disclosure, optional line, per-destination file roles, per-destination cover override, remember-settings row. Limits and accepted formats sit in the header disclosure.

**Publish.** `platformPreflight` per enabled platform, `publishBlockers`, the two publish-time confirmations (MyMiniFactory declaration, MakerRoad real photo), the release-plan panel, the batch runner.

## Candidates to unify

- **The Printables category required mark does not render.** `platform-required.js:12` is `/^category/i` but the label is "Printables category". Preflight does block. Changing the rule to `/categor/i`, as MakerRoad already uses, fixes it.
- **The MakerOnline print-method mark does not render** for the same reason: rule `/print method/i`, label "Printing method".
- **Three rules can never match anything**: `/creative kit/i` and MakerRoad's `/publication time|publish at/i` target plain checkboxes, not `Label` or `FieldCaption` elements.
- **The contest picker is dead UI.** It renders only when `platform.fields.includes('contestEntry')` and no platform declares that field. Nexprint's real equivalent is loaded live per account. The static select should go.
- **The summary field is duplicated.** Printables and Thingiverse each have a summary that falls back to the description the same way. One shared "short summary" in Details, with a per-platform override, would remove two panel fields and one preflight branch.
- **Nine batch-action selects say the same thing in four labels**: "Batch action" (Printables, Nexprint, Creality, MakerOnline), "Native action" (MakerRoad), "Action" (Thingiverse), "Visibility" (Thangs, MyMiniFactory, MakerWorld). The key is `publication` everywhere except MakerWorld. One label and one control would make the card's "native outcome" line legible without opening it.
- **Remembered settings carry project-specific values.** `isProjectBound` misses `summary`, `sourceThingId`, `sourceModelId`, `resumeDraftId`, `versionNotes`, `bom`, `boms`, `otherParts`, `planTime` and `payValue`. A Thing ID or a BOM from the last project starting the next one is exactly the failure the module's comment says it exists to prevent.
- **`includePrintProfile` and `relatedKits` are excluded from remembering by accident** ("Profile" contains "file", "relatedKits" contains "related"). An explicit list beats a substring regex.
- **Print settings are asked three times.** Thingiverse takes printer, material, resolution and infill; MyMiniFactory technology and material quantity; MakerOnline a profile title and description; MakerRoad printers, materials and colours. `packageDerivedPatch` already fills the first two from the sliced 3MF. Extending it to MakerRoad's lists and MakerOnline's description would empty most of those fields automatically.

## Must stay per platform

- **Category.** Ten incompatible trees, several fetched live per account. The shared value can seed but not replace them.
- **Cults3D price and licence.** Coupled: a free licence on a paid listing and the reverse are both hard errors, and the range is Cults3D's own.
- **MakerWorld category, Exclusive program, CyberBrick and the Bill of Materials.** No analogue anywhere else. Exclusive is mutually exclusive with remix; CyberBrick requires the Bambu 3MF path and an account capability; the BOM catalogue is Bambu's product list.
- **The third origin states.** Printables `reupload`, Nexprint `Reprint`, Creality `Non-original`. Forcing them into the shared two-state control would lose a state or invent one.
- **Platform-only identifiers.** Thingiverse source Thing ID, MyMiniFactory parent object IDs, Printables parent model: identifiers in the platform's own namespace, not URLs.
- **Account-gated toggles.** Printables Store and Club, MakerOnline China sync and Exclusive, Nexprint activities, Thangs marketplace. Each reads a live eligibility endpoint; a shared control would lie for nine accounts out of ten.
- **The two self-attestations.** The MyMiniFactory original-and-no-AI declaration and the MakerRoad real-photo confirmation are unverifiable by ModelPrep and are asked once at publish. Merging them would attach one platform's terms to another's upload.
- **MakerRoad's review reality.** Every Save enters review. Its terms checkbox, its own scheduled time and its 3-to-10 image range follow from that.
