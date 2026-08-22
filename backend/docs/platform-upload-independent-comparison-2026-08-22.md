# Independent audit comparison, 2026-08-22

This comparison reconciles two separate browser passes:

- `platform-workflow-mapping-audit-2026-08-22.md` combined signed-in forms, current ModelPrep source, and retained verification evidence.
- `platform-upload-flow-independent-audit-2026-08-22.md` used a clean-context agent that inspected only native signed-in forms. It did not read repository documents, source, memory, or the first audit before writing its report.

Neither pass uploaded a file, saved a draft, published a listing, accepted terms, or changed account state.

## Result

The independent pass confirmed the main field map and found five native branches that the first comparison did not represent clearly enough:

1. MakerWorld has `Share` as a third source type. ModelPrep exposes only Original and Remix.
2. Cults3D has `OFFLINE` as a third visibility state and `OPEN PRICE` as a separate price mode.
3. Thingiverse has separate `Thing`, `Edu Project`, and `Upload a Make` entry paths.
4. Creality Cloud has separate `Upload 3D Models`, `Upload Print Files`, and `Import from crealitycloud.cn` paths.
5. MakerRoad displayed `Price to Download` as fixed `Free`, while ModelPrep still exposes Free, Points, and Cash from an earlier request contract.

The fifth item is a contract conflict, not a cosmetic documentation gap. Paid MakerRoad uploads should not be treated as confirmed-current until a fresh first-party request inspection proves that the account or another branch still accepts Points and Cash.

## Platform comparison

| Platform | Independent confirmation | Newly documented native controls | Difference or evidence boundary |
|---|---|---|---|
| MakerWorld | Confirms raw models, dual covers, 16 pictures, one short video, category, tags, licence questions, visibility, description, documentation, BOM, exclusivity, and a separate Bambu profile editor | Third source state `Share`; 14-day Exclusive Launch option; rich-editor `Boost Me`, `Membership`, and shared header or footer; exact printer compatibility list; up to 37 profile pictures | ModelPrep lacks the Share source state. The Laser and Cut linked-model branch remains untraversed in the independent pass |
| Printables | Confirms required name, summary, leaf category, origin, AI answer, licence, political content, NSFW, rich description, and exact accepted file list | Full visible category and licence menus; Reupload points warning; Remix difference requirement; NSFW helper explicitly includes political statements | Independent pass could not reach later media or manufacturing controls without a file. The first audit remains stronger for implemented and retained later behavior |
| Cults3D | Confirms usage, category, up to three subcategories, meta tags, 20 tags, 1 GB files, media constraints, AI declaration, comments, price, licence, and visibility | `OPEN PRICE`; `OFFLINE`; full subcategory tree; complete native licence list; manager actions | ModelPrep reduces price to Free or Paid amount and visibility to Secret or Public. Open Price and Offline are unmapped |
| MyMiniFactory | Confirms title, visibility, 100 MB file limit, advanced print data, remix source search, Scan The World, licence questions, and the no-generative-AI declaration | Public is the new-form default; category choices disabled after two retained selections; precise negative wording of the support-free checkbox; units `mm`, `cm`, `in`; exact technology options | Full taxonomy remained unsafe to enumerate. The independent pass did not expose premium Store or Archive Mode, so the first audit still defines those unsupported branches |
| Thingiverse | Confirms the five-part editor, required model file, 1024 px image guidance, name, summary, category, AI, WIP, Customizer, remix, tags, NSFW, print settings, content blocks, licence, and terms | Separate Thing and Edu Project choices; separate Upload a Make entry; Dropbox upload source; filament material list; group sharing; used design tools; disallowed content categories | Upload a Make is not represented in ModelPrep. Education JSON exists in ModelPrep, but the distinct Edu Project journey is not independently certified |
| Thangs | Confirms six audience choices, 20 tags, images, video control, attachments, folder, compatibility flags, Remixable, AI, attribution, licence, and manager actions | Full visible category tree; exact six audience labels; `Add new license`; processing states; manager actions such as collaborator, plan, workspace, and print-on-demand assignment | The independent form proves that private or public is too narrow. It did not prove whether `Add a video` uses an embed URL or an upload, so the first audit's embed detail should retain its earlier evidence label |
| Nexprint | Confirms the mandatory Single model or Batch upload choice and exact first-step model formats | Native step names and empty-account boundary | The independent account had no retained model, so all Model Information controls remained file-gated. The first audit's retained editor remains the stronger source for category, rich description, tags, BOM, licence, activity, collection, images, attachments, and visibility |
| Creality Cloud | Confirms the split between native print-configuration 3MF and ordinary geometry | Standalone Upload Print Files path with up to 100 `.gcode`, `.gz`, `.cxdlp`, `.cxline`, or `.cxdlpv4` files; import path; supported Creality Print, OrcaSlicer, and Bambu Studio versions; automatic conversion to Creality configuration | ModelPrep does not expose standalone print-file upload or import. The independent pass was file-gated before listing information, so the first retained editor remains stronger for price, BOM, covers, source, category, licence, and visibility |
| MakerOnline | Confirms required source, AI, licence, images, title, two-level category, permission, print method, description, Creative Kit answer, and conditional remix source | Remix link maximum 1000 and NoDerivatives rule; Exclusive eligibility threshold of 50 model downloads or 20 online prints; full licence explanations; all visible category roots | Independent pass stopped before Add Files. The first audit remains stronger for the Anycubic profile and model-file step |
| MakerRoad | Confirms separate model, 3MF configuration, image, and instruction inputs; 3 to 10 images; 80 models; required print method; printer and material choices; AI; NSFW; licence questions; visibility; schedule; acknowledgement; and review states | Category selector mixes content, material, difficulty, and printing-technique facets; exact printer and material brands; separate rejected and delisted outcomes for models and makes | Live form showed fixed Free pricing. ModelPrep exposes Points and Cash. Paid support needs a fresh request-contract check before use |

## New mapping gaps

These gaps were absent or understated in the first comparison.

| Priority | Platform | Native capability | Current ModelPrep state |
|---:|---|---|---|
| 1 | MakerRoad | Current form exposes only fixed Free price | ModelPrep exposes Free, Points, and Cash. The paid branch may be stale or account-gated |
| 2 | MakerWorld | Source type `Share` | Only Original and Remix are available |
| 3 | Cults3D | Visibility `OFFLINE` | Only Secret and Public are available |
| 4 | Cults3D | Price mode `OPEN PRICE` | ModelPrep represents Free or Paid with an amount, not the native mode directly |
| 5 | Creality Cloud | Standalone Upload Print Files | ModelPrep publishes model listings only |
| 6 | Creality Cloud | Import from `crealitycloud.cn` | Not represented |
| 7 | Thingiverse | Upload a Make | Not represented |
| 8 | Thingiverse | Distinct Edu Project journey | Education data exists, but the entry type and complete native journey are not certified |
| 9 | MakerWorld | 14-day Exclusive Launch option | ModelPrep has the broader Exclusive program, not this separate launch choice |
| 10 | MakerRoad | Category selector includes material, difficulty, and technique facets | ModelPrep treats the values as category paths and does not explain the mixed taxonomy |

## Required-field conclusions

The independent pass sharpened the minimum normal-upload checklists.

| Platform | Independently visible minimum before a normal submission can proceed |
|---|---|
| MakerWorld | Accepted model content, Laser and Cut answer, covers and pictures, name, category leaf, three licence questions, visibility, description. A profile also needs compatible Bambu 3MF, name, real printed photo, visibility, and guidelines declaration |
| Printables | File, name, summary, category leaf, origin branch, AI answer, licence. Remix and Reupload add source requirements |
| Cults3D | Name and listing copy, usage, category and suitable subcategory, direct files, compliant media, conditional AI declaration, price mode, licence, visibility |
| MyMiniFactory | Design Title, accepted 3D file, categories, licence answers, resulting licence, required original non-AI declaration |
| Thingiverse | Model file, name, summary, category, licence, terms. Remix adds source attribution |
| Thangs | Supported file and `Model Name *` are the only independently marked minimums. Category, audience, and licence are likely gates but were not proven without Save or Finish |
| Nexprint | Upload mode and at least one supported file before Model Information. Later requirements remain independently gated |
| Creality Cloud | Content path, file-type branch, and compatible model or print file before listing information. Later requirements remain independently gated |
| MakerOnline | Source, AI status, licence, images, title, category leaf, permission, print method, description, Creative Kit answer, then files on the next step |
| MakerRoad | Original or Remix, source link when Remix, model file, 3 to 10 images, title, description, categories, print method, three licence answers, conditional schedule time, acknowledgement |

## What the second pass did not disprove

Some differences come from evidence access, not disagreement:

- Nexprint's later editor was available to the first pass through a retained edit URL. The independent account route showed no model, so its report stops at the file gate.
- Creality's first pass used a retained model editor. The independent report stops before listing information but adds the separate print-file and import paths.
- MakerOnline's first pass reached Add Files through a retained editor. The independent report documents step 1 in greater detail and stops before the file step.
- Printables' independent report stops at its file gate. Current source and retained evidence remain necessary for later file classifications and paid account branches.
- MyMiniFactory's independent report preserved the retained category selections, so it intentionally did not enumerate the complete disabled tree.

The reports should stay separate. The independent report is the native-form inventory. The first report is the ModelPrep mapping audit. This file records where they agree and where the implementation or evidence still needs work.
