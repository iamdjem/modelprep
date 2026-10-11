# Platform audit gap implementation

Date: 2026-08-23
Branch: `codex/clean-design-system`

This pass compares the independent upload-flow audit with ModelPrep's current UI, preflight rules, and captured request transports. It implements fields only where the repository has enough evidence to name the request value and validate it. Other native journeys are shown as explicit boundaries so they cannot be mistaken for supported uploads.

## Implemented

| Area | Audit gap | Change |
|---|---|---|
| Remembered platform settings | The old substring filter could remember project IDs, attribution, summaries, BOM rows, schedules, and other project data | Replaced it with a platform-specific allowlist. Unknown fields now remain project-local by default |
| MakerWorld source | Native upload has Original, Remix, and Share, while ModelPrep had two effective states | Added Share to regular and Laser and Cut source controls, source attribution, payload validation, manual override persistence, and Exclusive incompatibility |
| MakerWorld programs | The independent audit found a separate 14-Day Exclusive Launch branch | Added an evidence boundary. The control stays unavailable until its request field and eligibility response are captured |
| Cults3D price | Native form supports Free, Paying, and Open Price | Added all three modes, range checks, correct paid-license rules, and `open_priced` transport fields |
| Cults3D visibility | Native form supports Secret, Public, and Offline | Added Offline to UI, preflight, Worker types, desktop transport, status text, and receipts |
| MakerRoad price | Current signed-in form shows fixed Free, while ModelPrep exposed stale Points and Cash choices | Removed paid choices from the active UI. Saved paid state fails closed and can be reset to the verified Free value |
| MakerRoad categories | Native picker mixes content, material, difficulty, and technique facets | Clarified the mixed-facet behavior instead of presenting the values as one ordinary category tree |
| Thingiverse category | Captured create request expects a category name string, while ModelPrep sent a numeric ID | The create payload now sends the native category name. ModelPrep retains the ID for edit and readback requests |
| Thingiverse journeys | Upload a Make and Create an Edu Project are separate journeys | Added an explicit boundary in the platform editor. Standard Upload a Thing remains the supported path |
| Thangs audience | Native UI shows six audience modes, while ModelPrep showed only Private and Public | Shows all six modes. Private and Public remain selectable. Four account-gated or unverified request modes are visible but disabled |
| Thangs licence | Native UI provides standard licences plus Add new license | Replaced the free-text-only field with audited standard licences and a custom-name path. Uploaded licence files remain an explicit boundary |
| Thangs advanced fields | Native UI also has video, attribution, print compatibility, attachments, collections, and gated audiences | Added an explicit unsupported notice. ModelPrep does not invent request fields for them |
| Creality Cloud journeys | Upload Print Files and Import are separate from Upload 3D Models | Added an explicit boundary. ModelPrep continues to support the audited Upload 3D Models path |
| Required descriptions | Independent forms explicitly require rich descriptions on Printables and MakerOnline | Added platform preflight blockers without marking Description as globally required |
| Required declarations | Several mandatory checkboxes were not recognized by the shared required marker | Added nested label extraction and required marks for MakerWorld guidelines and terms, MyMiniFactory declaration, Thingiverse terms, MakerRoad terms, and conditional MakerOnline Creative Kits |
| Five-step workflow copy | Images, Platforms, and Publish still exposed labels from the removed six-step flow | Images now continues to Platforms. Platforms identifies itself as step 4 and Publish as step 5 |

## Intentionally not guessed

| Platform | Remaining boundary |
|---|---|
| MakerWorld | 14-Day Exclusive Launch, Boost Me, Membership, and shared rich-editor header or footer fields lack a certified request contract |
| MyMiniFactory | Full live taxonomy, Store, and Archive Mode remain account-dependent or unverified |
| Thangs | Four audience request values, video transport, attribution, compatibility, attachment, and collection payloads remain unverified |
| Nexprint | Later fields remain file-gated in the independent account. Existing retained-editor evidence stays in use and unknown fields do not become Ready |
| Creality Cloud | Standalone print-file upload and import require separate transports and preflight rules |
| MakerRoad | Points and Cash remain disabled until a current eligible-account request capture proves them |

## Verification

The changes have unit and component coverage for the settings allowlist, required-field rules, shared MakerWorld defaults, MakerWorld Share, Cults open pricing and Offline visibility, Thingiverse category creation, MakerRoad Free-only behavior, Thangs audience presentation, and platform-specific description blockers.

No live upload, draft creation, publication, deletion, or retry was performed during this implementation pass.
