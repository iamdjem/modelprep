# ModelPrep platform integration handoff - historical July 31 checkpoint

> **Superseded for current continuation.** Start with
> `modelprep-current-handoff-2026-08-01.md` and use
> `NEXT_AGENT_PROMPT.md` for the maintained copy-paste prompt. This file remains
> useful for the original investigation protocol and implementation narrative,
> but its status tables, continuation queue, and embedded prompt predate the
> completed MakerRoad/Thangs/Thingiverse wiring and August certification fixes.

Date: **2026-07-31**
Repository: `/Users/alex/modelprep`
Branch at handoff: `codex/modelprep-usability-pass`
HEAD at handoff: `f8b1e49`

## Purpose

This was the July 31 pickup point for platform work. It records the build-out
history and investigation method, but current status and remaining work now live
in `modelprep-current-handoff-2026-08-01.md`.

Do not reconstruct status from old chat messages or the hosted demo. Start from
this file and verify the current checkout.

## Worktree warning

The repository is broadly dirty. Many current platform integrations and flow
documents are modified or untracked. They are intentional user work. Before any
change:

```bash
cd /Users/alex/modelprep
git status --short
git branch --show-current
```

Do not reset, restore, clean, broadly stage, commit, push, deploy, delete, or
publish unless the user explicitly requests that action. Make narrow edits and
preserve unrelated files.

## Required reading order

1. `modelprep-current-handoff-2026-08-01.md` - canonical current implementation and continuation.
2. `platform-live-certification-audit-2026-08-01.md` - latest live results, retained artifacts, and fixes.
3. `platform-specs.md` - compact status, limits, and media rules.
4. `platform-upload-requirements-live.md` - dated cross-platform DOM/API/requirement audit.
5. `desktop-live-upload-testing.md` - account persistence and safe certification procedure.
6. `platform-one-by-one-implementation-playbook.md` - current repeatable mapping and implementation method.
7. `platform-integration-handoff-2026-07-31.md` - this historical implementation narrative.
8. The target platform map:
   - `makerworld-web-flow.md`
   - `printables-web-flow.md`
   - `cults3d-web-flow.md`
   - `nexprint-web-flow.md`
   - `creality-web-flow.md`
   - `makeronline-web-flow.md`
9. `../../desktop/README.md` - Electron trust boundary and file map.
10. `../../README.md` - current repository overview.

For MakerWorld also read `makerworld-upload-flow-map.md`. The older
`makerworld-HANDOFF.md` contains useful history but is not the cross-platform
pickup point.

## Evidence labels

- **Mapped** - signed-in DOM, option tree, production bundle, or request contract documented.
- **Implemented** - production-shaped adapter/UI/desktop code exists with automated tests.
- **Locally verified** - mocks, builds, rendered controls, and non-mutating account reads pass.
- **Live-certified** - the signed-in production account accepted a safe real artifact and ModelPrep read it back.
- **Fully certified** - every advertised conditional branch has account-backed evidence. No current platform is fully certified.
- **Simulation** - Demo-only receipt; no files or metadata left the app. Never cite this as upload proof.

## Architecture and security contract

The React renderer keeps a common Worker-shaped route contract. In the desktop
app, Electron main allow-lists and resolves each route locally. Raw cookies,
tokens, passwords, storage grants, and signed URLs stay outside renderer storage.

Desktop sessions:

| Platform | Desktop session or credential storage |
|---|---|
| MakerWorld | `persist:makerworld` plus encrypted cookie fallback |
| Printables | `persist:printables` plus encrypted cookie fallback |
| Cults3D | per-account credentials encrypted with Electron `safeStorage` |
| Nexprint | `persist:nexprint` plus encrypted token/cookie fallback |
| Creality Cloud | `persist:creality` plus encrypted token/user/device/cookie fallback |
| MakerOnline | `persist:makeronline` plus encrypted token/cookie fallback |

Only opaque desktop account markers may enter renderer `localStorage`. Every
platform must have its own persistent partition and route namespace. Do not
reuse cookies between platforms or invent a shared browser profile.

## Current status at a glance

The table below is intentionally frozen at the July 31 checkpoint. It is not
current status: all ten safe cores were later live-certified, and the latest
receipts and optional-branch queue are in
`modelprep-current-handoff-2026-08-01.md`. Printables specialist draft `1797772`
and public model `1797774` are later August evidence.

| Platform | Mapping | Code | Account-backed evidence | Current completion class |
|---|---|---|---|---|
| MakerWorld | Complete core + many conditional branches | Implemented | Private raw/3MF flows and Laser create; four-platform batch artifact `9036878` | Core live-certified; optional matrix incomplete |
| Printables | Complete current form/GraphQL/storage map | Implemented | Private author/remix drafts and batch draft `1796023` | Draft path live-certified; public/optional matrix incomplete |
| Cults3D | Complete two-page Rails/S3 map | Implemented | Secret/unlisted listing in four-platform batch | Core secret path live-certified; pricing/media matrix incomplete |
| Nexprint | Complete signed-in DOM/taxonomy/REST map | Implemented | Browser draft `2083124902374207488`; Electron draft `2083139560975958016` | Core unpublished draft path live-certified |
| Creality Cloud | Complete current form/category/license/JSON/OSS map | Implemented | Original/private model `6a6cc6ab96c1c2d13f2b1a6b` | Core private path live-certified |
| MakerOnline | Complete signed-in DOM/options/multipart map | Implemented | Electron unpublished draft `316077` | Core unpublished draft path live-certified |
| MyMiniFactory | Complete signed-in form/options/upload/category map | Implemented | Private object `828462`; submit reached production but the old redirect receipt failed and categories were empty | Core private create proven; fixed redirect/category readback requires one controlled recheck |
| Thingiverse | Complete signed-in DOM/category/license/request map plus official API review | Implemented and enabled after written clearance recorded 2026-08-01; draft-first path mock-tested | Read-only account/form inspection only | At this checkpoint one harmless draft/readback remained; later completed as exact-app draft `7390480` |
| Thangs | Official-help, authenticated entry, file/limit/schema and first-party signed-upload map | Implemented and locally tested | Read-only account/bundle inspection only | Permission/live-certification gate; no generally available public model-upload API found |
| MakerRoad | Complete live form, taxonomy, limit, license and create/update/readback map | Implemented and locally tested, including UI | Read-only authenticated form/bundle inspection only | Permission/live-certification gate |

The UI now contains ten target cards and ten direct-code paths. Local adapter,
desktop, build, and rendered checks are not account-backed live certification.

### Continuation note — 2026-08-01

The MyMiniFactory checkpoint was resumed without making a new account mutation.
Read-only production inspection reconfirmed the required unchecked
original/no-generative-AI/Terms declaration and retained object `828462` as
Private with 16 ordered images, three files, and the known empty category array.
The adapter now reads the exact edit-form title, visibility, category IDs,
ordered image names, and object-file set; the renderer fails closed on any
mismatch. Local evidence is backend **25/25** plus TypeScript, desktop **50/50**,
renderer **140/140**, production build, valid Developer ID signature, and an
exact packaged-app runtime showing the 2026-08-01 build marker and MyMiniFactory
Connected/Active with live taxonomy and Private default.

`script/build_and_run.sh` was also corrected to remove launch jobs before
terminating ModelPrep and to run the renderer embedded in the newly packaged
app. This prevents an old process from respawning during packaging and winning
Electron's single-instance lock. The remaining gate is unchanged: obtain
action-time creator confirmation and explicit authorization before creating one
new harmless Private object. No upload, publish, edit, delete, deploy, commit,
or push occurred in this continuation.

## Implemented platform details

### MakerWorld

Method:

- no documented public model-upload API was found;
- ModelPrep mirrors MakerWorld's first-party JSON endpoints and presigned S3 upload;
- the desktop entry bundles the shared backend adapter for direct on-device calls;
- regular 3D and Laser & Cut use separate draft/status/delete namespaces.

Primary code:

- `../src/adapters/makerworld-web.ts`
- `../src/makerworld-auth.ts`
- `../src/makerworld-validation.ts`
- `../../desktop/makerworld-direct-entry.ts`
- `../../deploy/src/lib/makerworld.js`
- `../../deploy/src/lib/makerworld-upload.js`
- `../../deploy/src/App.jsx`

Implemented: original/remix, raw files, Bambu `.3mf`, print profile, docs, BOM,
related models, private/public, status/delete, Exclusive payloads, CyberBrick
payload validation, and Laser raw/`.lac` branches.

Live evidence: historical raw/private and Bambu `.3mf` private publish/delete;
remix/BOM/docs/related/Exclusive checks; Laser create/delete; retained batch
artifact `9036878`.

Remaining:

- live-certify the implemented MP4/MOV model-video upload and readback path;
- final genuine Bambu Suite `.lac` submit/delete;
- final raw SVG/DXF Laser submit/delete;
- CyberBrick submit with an eligible `rcUpload=true` account;
- deployed direct-S3 browser proof above 95 MB.

### Printables

Method:

- no documented stable third-party upload API was found;
- ModelPrep mirrors the first-party GraphQL and signed-storage contract;
- Prusa Account OAuth stays inside `persist:printables`;
- files use presign, direct storage upload, CRC32C finish, processing poll,
  draft update, readback, and optional publish/approval request.

Primary code:

- `../src/adapters/printables-web.ts`
- `../src/adapters/printables-meta-snapshot.ts`
- `../../desktop/printables-direct.js`
- `../../desktop/printables-session-cache.js`
- `../../deploy/src/lib/printables-auth.js`
- `../../deploy/src/lib/printables-model.js`
- `../../deploy/src/lib/printables-upload.js`
- `../../deploy/src/App.jsx`

Live evidence: drafts `1793654`, `1793728`, `1793734`, and batch draft
`1796023`. Author/remix fields, ordered images, files, category, license, tags,
summary, and content flags were read back.

Remaining:

- public publish/poll/delete cycle with explicit authorization;
- Store/Club and approval-required branches;
- retained ZIP, unpacked ZIP, G-code, SLA, and authenticated converted HEIC;
- live-certify the original-image/no-invented-cap behavior now used by ModelPrep.

### Cults3D

Method:

- Cults has official GraphQL, but it does not expose the complete current upload workflow;
- ModelPrep mirrors the authenticated Rails form and signed S3 flow;
- desktop uploads directly to Cults/S3 to avoid Worker subrequest limits;
- creation metadata and price/license/visibility are separate pages.

Primary code:

- `../src/adapters/cults3d-web.ts`
- `../src/adapters/cults3d-mappings.ts`
- `../../desktop/cults-direct.js`
- `../../deploy/src/lib/cults-auth.js`
- `../../deploy/src/App.jsx`

Live evidence: core upload/create/readback and secret/unlisted batch listing
`articulating-desk-dragon-print-in-place-7f718cba22111be2ef99`.

Remaining:

- live-certify the implemented typed WebM/MP4 illustration path;
- paid and open-price combinations;
- multi-usage, up to three subcategories, fixed meta tags, and broader licenses;
- public/secret/deactivated transitions and controlled cleanup;
- live-certify the original-media/no-invented-cap behavior now used by ModelPrep.

### Nexprint

Method:

- no documented third-party upload API was found;
- ModelPrep mirrors Nexprint's first-party REST gateway;
- sequence: presign -> object PUT -> file registration -> create/update batch -> `getEditInfo` readback;
- bearer/session material remains in Electron main.

Primary code:

- `../../desktop/nexprint-direct.js`
- `../../deploy/src/lib/nexprint-auth.js`
- `../../deploy/src/lib/nexprint-upload.js`
- `../../deploy/src/App.jsx`

Live evidence:

- browser UI draft `2083124902374207488`;
- ModelPrep Electron draft `2083139560975958016`;
- both remained unpublished and were read back.

Remaining:

- ordered multi-image gallery persistence;
- activity/creator-fund eligibility and collections matrix;
- broad model/attachment extension matrix;
- richer supported-slicer `settingList` extraction;
- batch mode where each file becomes a separate listing;
- public publication.

### Creality Cloud

Method:

- no documented third-party model-upload API was found;
- ModelPrep mirrors first-party `/api/cxy/...` JSON plus short-lived Aliyun STS uploads;
- new models support Private or Public;
- `modelDraft/edit` edits an existing `draftId`; it does not create a new draft;
- new non-public ModelPrep uploads are therefore private-first.

Primary code:

- `../../desktop/creality-direct.js`
- `../../deploy/src/lib/creality-auth.js`
- `../../deploy/src/lib/creality-upload.js`
- `../../deploy/src/lib/creality.js`
- `../../deploy/src/App.jsx`

Live evidence: Original/private model
`6a6cc6ab96c1c2d13f2b1a6b`, one STL, web/app cover records, category and
`isShared:false` read back.

Important fixed failure: the six-platform batch sent a new upload to
`modelDraft/edit` without `id` and received `参数非法`. The current native client
shows Save Draft only for an existing `draftId`. ModelPrep now rejects that
unsupported action before the API and normalizes new private-safe uploads to
Private.

Remaining:

- existing-draft edit certification;
- public publication;
- multi-gallery, instruction files, and other model extensions;
- structured Remix/Non-original attribution and proof images;
- eligible paid branch;
- native Print Settings Info parsing and printer compatibility.

### MakerOnline

Method:

- no documented third-party model-upload API was found;
- ModelPrep mirrors MakerOnline's first-party JSON/multipart contract;
- raw token/cookies stay in Electron main;
- upload scenes: raw `1`, image `2`, print `.3mf` `5`, profile image `6`, documentation `8`;
- safe default is `save-draft`, followed by `edit-info` readback.

Primary code:

- `../../desktop/makeronline-direct.js`
- `../../deploy/src/lib/makeronline-auth.js`
- `../../deploy/src/lib/makeronline-upload.js`
- `../../deploy/src/lib/makeronline.js`
- `../../deploy/src/App.jsx`

Mapped/implemented: source/license, images, title, live categories, tags,
permissions, FDM/Resin/Both, Quill description, docs, NSFW, Creative Kits,
China sync eligibility, exclusivity eligibility, raw files, server 3MF parsing,
print-profile metadata/images, draft/public save, and readback assertions.

Live evidence: the exact packaged ModelPrep app uploaded one ordered image and one
valid cube STL, saved unpublished draft `316077`, and read it back through
`edit-info` on 2026-07-31. The canonical edit page independently showed the exact
title, category `104` (`Toys&Games / Characters`), one image, Private permission,
no print profile, and one `desk-dragon-S.stl` file. Public submission remained
disabled. The draft is intentionally retained for account review.

Remaining later gates: `.3mf` parsing/profile media, documentation, Remix, public,
Creative Kit, China sync, Exclusive, Resin-only, paid, high-count, and large-file
combinations.

## Continuation order

1. **MyMiniFactory certification** - create and read back one harmless Private object after action-time declaration confirmation.
2. **MakerRoad certification** - after supported-access confirmation, create one free Private Save and verify `/models/getEdit`.
3. **Thangs certification** - after supported/custom API confirmation, create one private free single-part STL and verify details, attachments, and license.
4. **Thingiverse** - written clearance was recorded on 2026-08-01; run one harmless draft/readback certification before any public test.

### New-platform discovery checkpoint — 2026-08-01

Authenticated read-only discovery is complete for Thingiverse, Thangs, and
MakerRoad. No files were transmitted, no drafts/listings were created, and no
platform terms were accepted. Canonical maps are:

- `thingiverse-web-flow.md`
- `thangs-web-flow.md`
- `makeroad-web-flow.md`

Thingiverse exposes the cleanest documented OAuth/API surface, but its current
API agreement creates a direct legal/product conflict for a multi-platform
publisher. Thangs exposes private-default bulk/multipart capabilities and a
complete signed-upload contract in its client, while its official help limits
model/membership API access to qualifying sellers. MakerRoad exposes the most
complete implementation-ready first-party contract—four file roles, exact
limits, live taxonomies, seven licenses, private/save, scheduling/pricing,
create/update and edit readback—but no public developer upload API was found.

Do not implement multiple new platforms in one unverified batch. Complete one
platform's map, adapter, isolated account, tests, and safe certification before
starting the next.

## Required investigation protocol for every platform

### 1. API decision

1. Search current official developer documentation, terms, and upload help.
2. Record whether a documented third-party upload API exists and whether its
   scopes permit model creation, file upload, draft/private visibility, edit,
   status/readback, and deletion.
3. Prefer a supported official API.
4. If it is incomplete or absent, document that boundary and inspect the
   first-party signed-in web client. Never call an undocumented first-party
   contract an official public API.

### 2. Signed-in browser investigation

Use the user's real signed-in account and the actual upload/edit pages.

- Use Chrome control for the user's authenticated Chrome session.
- Use the in-app Browser for local ModelPrep rendered QA.
- Use Computer Use for native app windows, file pickers, or controls not exposed
  through browser DOM automation.
- Use DOM snapshots and scoped locators for visible fields.
- Use developer/network tooling or CDP to inspect the page's own request and
  response sequence, headers, payloads, storage uploads, status calls, and errors.
- Inspect the current production JavaScript bundles for conditional fields and
  schemas that are not visible for the current account.

Do not copy secrets into documents or chat. Redact cookies, bearer tokens, CSRF
tokens, signed object URLs, S3/OSS policy fields, verification phrases, email,
and private account identifiers. Record only reusable field/endpoint shapes.

### 3. DOM and option map

Create or update `backend/docs/<platform>-web-flow.md` with:

- audit date, URLs, locale, account capability class, and production build fingerprint;
- every page/step, modal, menu, submenu, tab, and final action;
- all required/optional fields, labels, defaults, counters, `maxlength`, and validation;
- every select/radio/checkbox value and conditional combination;
- live category and license sourcing; never use picker positions as API ids;
- file roles, accepted extensions, counts, sizes, dimensions, aspect ratios, ordering, folders, and replacement behavior;
- cover/gallery/video/profile/document distinctions;
- originality/remix/source proof, AI/NSFW, price, contests, kits, regional sync, exclusivity, and account-gated options;
- draft/private/secret/public states and whether a true new draft exists;
- readback, edit, list, soft-unpublish, and destructive-delete behavior.

Mark every value **LIVE DOM**, **CURRENT BUNDLE**, **REQUEST CONTRACT**,
**OFFICIAL**, **UNKNOWN**, or **MODELPREP POLICY**. Do not turn assumptions into
platform limits.

### 4. Network/request map

Document the exact first-party lifecycle without credentials:

```text
identity/config/taxonomy
-> storage authorization or presign
-> direct object upload
-> file registration/processing poll
-> draft/private create or update
-> final submit when explicitly public
-> detail/status/edit-info readback
-> list/edit/soft-unpublish/delete map
```

For each request record method, path, content type, safe header names, body shape,
response ids/status, ordering dependencies, retry/poll behavior, and failure
cleanup. If production uses GraphQL, record operation names and variables. If it
uses multipart scenes/buckets, record the role mapping.

### 5. Implementation template

Follow the six existing integrations:

- isolated Electron partition and real platform login;
- encrypted `safeStorage` fallback;
- read-only identity validation and account discovery on relaunch;
- opaque renderer account marker only;
- platform-specific virtual route allowlist;
- direct on-device upload from Electron main;
- renderer adapter for media/metadata mapping;
- explicit preflight for every known rule and fail-closed unsupported branch;
- Demo simulation that cannot make network mutations;
- safest real default: draft, private, or secret depending on what the platform truly supports;
- create response plus account-backed readback before success;
- per-platform receipt and failure isolation in the batch coordinator.

### 6. Verification and mutation boundary

Local verification must include adapter/unit tests, renderer option/preflight
tests, production build, `git diff --check`, and rendered UI/console QA. It does
not certify production acceptance.

For live certification:

1. obtain explicit authorization for the specific real account mutation;
2. test only one platform first;
3. use a harmless clearly labelled fixture;
4. select the safest non-public state;
5. verify persisted metadata, media order/count, files, visibility, and URL using
   the platform's readback/detail endpoint;
6. record the created id and whether it is retained;
7. do not delete, publish publicly, accept terms, or enter paid/exclusive programs
   without separate authorization;
8. only after every platform passes individually, run the selected-platform batch.

## Current verification commands

```bash
cd /Users/alex/modelprep

npm --prefix backend test
npm --prefix backend run typecheck
npm --prefix desktop test
npm --prefix deploy test -- --run
npm --prefix deploy run build
git diff --check

# Rebuild, restart, and verify the exact local packaged app:
./script/build_and_run.sh --verify
```

Latest local evidence at this handoff:

- backend: **24/24** tests passed; TypeScript check passed;
- desktop: **40/40** tests passed;
- renderer: **131/131** tests passed;
- packaged app: `/Users/alex/modelprep/desktop/dist/mac-arm64/ModelPrep.app`;
- packaged renderer build time observed: **2026-07-31 18:15 local**;
- Developer ID signature verified on disk;
- no commit, push, deploy, notarization, or public publication was performed as part of this documentation handoff.

## Known retained account artifacts

These are evidence, not cleanup instructions:

- MakerWorld: `9036878` from the four-platform private batch;
- Printables: `1793654`, `1793728`, `1793734`, and `1796023`;
- Nexprint: `2083124902374207488`, `2083139560975958016`, plus an older partial draft described in its flow map;
- Cults3D: `articulating-desk-dragon-print-in-place-7f718cba22111be2ef99`;
- Creality: `6a6cc6ab96c1c2d13f2b1a6b`; older diagnostics are described in `creality-web-flow.md`.

Do not delete any retained artifact without explicit user approval. Do not infer
that a result URL is public; verify the saved visibility/state.

## Historical ready-to-paste prompt

The maintained prompt is `NEXT_AGENT_PROMPT.md`. The block below is preserved
only as historical context and must not be used as the current continuation
instructions.

```text
Continue ModelPrep platform integration work in /Users/alex/modelprep.

Start by reading, in order:
1. backend/docs/platform-integration-handoff-2026-07-31.md
2. backend/docs/platform-specs.md
3. backend/docs/platform-upload-requirements-live.md
4. backend/docs/desktop-live-upload-testing.md
5. the target platform's backend/docs/*-web-flow.md
6. desktop/README.md

Before changing anything, run `git status --short` and `git branch --show-current`.
The worktree is intentionally broad and dirty. Preserve every unrelated modified
or untracked file. Do not reset, restore, clean, broadly stage, commit, push,
deploy, delete account artifacts, or publish publicly unless I explicitly ask.

The direct desktop publishers are MakerWorld, Printables, Cults3D,
Nexprint, Creality Cloud, MakerOnline, and MyMiniFactory. The first six have a certified safe core path;
MyMiniFactory is implemented with live Private-object certification pending. Do not call any platform fully certified until
its complete optional matrix has account-backed evidence.

Proceed platform by platform. Certify MyMiniFactory privately. Authenticated
read-only discovery for Thingiverse, Thangs, and MakerRoad is complete in their
dated flow maps. Before wiring a new publisher, resolve the support/permission
gate: request a documented upload contract from Thangs and MakerRoad, and obtain
written clarification of Thingiverse's API-license conflict. If MakerRoad access
is approved, implement it first; it has the strongest complete private/save,
create/update, taxonomy, file-limit, and edit-readback map. It is not yet
represented in the UI.

For every new or refreshed platform:
- research current official APIs, developer scopes, terms, and upload help first;
- prefer an official supported upload API when it covers the required workflow;
- otherwise use the real signed-in account and real upload/edit page;
- use Chrome control for the signed-in browser, the in-app Browser for local
  ModelPrep QA, and Computer Use for native windows/file pickers;
- inspect the rendered DOM, every page/menu/submenu/modal/conditional option,
  current production bundles, and the page's actual network requests/responses;
- map identity/config, taxonomy, file roles, presign/storage upload, registration,
  processing, draft/private create, explicit public submit, status/readback,
  edit/list/unpublish/delete, and failure cleanup;
- never log or document cookies, tokens, signed URLs, CSRF fields, verification
  phrases, credentials, or other secrets;
- label evidence as OFFICIAL, LIVE DOM, CURRENT BUNDLE, REQUEST CONTRACT, UNKNOWN,
  or MODELPREP POLICY; never present guessed caps/crops as platform rules;
- create/update backend/docs/<platform>-web-flow.md and update the canonical
  platform status/gap documents before claiming completion;
- implement an isolated Electron partition, encrypted session fallback, opaque
  renderer marker, route allowlist, direct on-device upload, preflight, Demo-safe
  simulation, safest non-public default, readback verification, tests, and batch
  failure isolation following the six existing templates;
- test one platform individually before any multi-platform batch.

Do read-only discovery without asking. Before the first real upload, public
publish, permanent deletion, paid/exclusive enrollment, or other consequential
account mutation, state the exact action and obtain the required authorization.
Record every real artifact id, visibility, readback result, and retention decision.

Use these verification commands after implementation:
`npm --prefix backend test`
`npm --prefix backend run typecheck`
`npm --prefix desktop test`
`npm --prefix deploy test -- --run`
`npm --prefix deploy run build`
`git diff --check`
`./script/build_and_run.sh --verify`

Report implemented vs locally verified vs live-certified separately, include
exact file paths and commands, list every remaining branch, and leave the repo
unstaged/uncommitted unless I explicitly request source-control actions.
```
