# One-platform-at-a-time implementation and certification playbook

Current as of: **2026-08-02**

Use this with `modelprep-current-handoff-2026-08-01.md` and the selected
`<platform>-web-flow.md`. It records the method used to close the Printables
specialist/public branches so the next platform is handled with the same
evidence standard.

## Safety and authority

1. Run `git status --short`; preserve the deliberately dirty worktree.
2. Read the canonical handoff, live audit, requirements matrix, platform specs,
   desktop live-testing guide, and the selected platform flow map completely.
3. Read-only signed-in inspection is allowed when requested. A draft/private
   upload, public listing, paid action, terms acceptance, or deletion is a
   separate external mutation. Obtain authority for the exact action and
   platform. Permanently deleting a platform object requires confirmation at
   the delete button even when cleanup was discussed earlier.
4. Never print cookies, tokens, passwords, CSRF values, signed URLs, OAuth
   codes, storage grants, or raw authenticated responses. Credentials remain in
   Electron main and the renderer receives only opaque account markers.
5. Preserve every result ID/URL and visibility. Failed submits can still leave
   account objects; inspect the authenticated model/draft list before assuming
   nothing was created.

## Tools and evidence collection

- Use the **Computer Use** skill through `node_repl` and its plugin-owned
  `@oai/sky` wrapper for the exact packaged Electron UI and native macOS file
  choosers. Always fetch a fresh accessibility tree after an action and derive
  new element indexes. Use native selectors by filename for certification
  fixtures; do not use AppleScript/System Events.
- Use the **Chrome** skill for read-only signed-in website inspection when the
  isolated ModelPrep partition does not expose enough rendered detail. Chrome
  sign-in is not proof that ModelPrep's isolated account is connected.
- Inspect current downloaded first-party JavaScript bundles and request
  operations with `rg`. Record client/build versions and SHA-256 fingerprints
  where the platform has no stable public API.
- Prefer current official documentation for stable limits; otherwise use live
  DOM, bundle constants, GraphQL/REST schemas, safe negative validation, and
  persisted editor/readback evidence. Keep unproven counts/crops/limits
  `UNKNOWN`.
- Use the exact signed app at
  `/Users/alex/modelprep/desktop/dist/mac-arm64/ModelPrep.app`. Never use a stale
  `/Applications/ModelPrep.app` or a `launchctl` keepalive job.

## Required implementation sequence

### 1. Map the whole first-party flow read-only

Capture every create/edit step and conditional branch:

- identity and account capability/eligibility;
- title, summary, rich description, tags, categories/subcategories, licenses;
- originality/remix/reupload, source attribution, AI/NSFW/political flags;
- gallery/cover/crop/order, video, documentation and specialist media;
- model, source, profile, G-code/SLA, archive and attachment buckets;
- printers, materials/filaments, BOM/kits, print settings and instructions;
- free/paid/membership/plan controls, price/currency/fees and agreements;
- draft/private/secret/public/review lifecycle and existing-object editing;
- server/client limits, accepted extensions and unknowns.

For conditional controls, record both the shipped bundle contract and whether
the signed-in account actually renders it. Bundle presence alone does not prove
account eligibility.

**A static DOM/props read is not a map.** MyMiniFactory proved this on
2026-08-03: reading the create form's server-rendered HTML reported 40 named
fields as if they were one flat form, when only **7** are visible on load and
the rest sit behind a closed "Advanced Settings" accordion. The same static pass
misclassified Scan The World as account-gated when it is merely collapsed, and
missed that the remix checkbox reveals a parent **search autocomplete** rather
than an ID field. Always finish with an interactive pass: toggle every control,
record what each reveals, and diff the visible field set before and after. Never
submit during this pass.

### 2. Capture the request and readback contracts

For each step, record endpoint/operation, method, accepted input shape,
response IDs, upload ordering, storage protocol, polling, finalize/publish
operation, edit/status/list readback, and delete operation. Distinguish fields
returned for display from fields accepted as mutation input. Printables proved
why this matters: processed G-code returned a `printer` object that its current
`GcodeFileInputType` rejected.

Use safe server validation errors as schema evidence, then encode that evidence
in tests. Never blindly replay an ambiguous create failure; first check the
platform's draft/model list for a newly created object.

### 3. Design shared mapping plus explicit user control

Map fields in three layers:

1. shared project value (title, description, tags, license, ordered media);
2. deterministic platform adaptation (HTML/Markdown/plain text, taxonomy ID,
   filename/media role, safe visibility default);
3. platform-only controls shown in that platform's expanded options or per-file
   settings.

Automatic mapping must be visible in preview and reversible. When no reliable
mapping exists, require the user to choose a native value. Account-gated fields
stay hidden/disabled with an explanation until capability evidence is present.
Do not force one platform's concepts—MakerWorld BOM/filament, Printables
G-code metadata, MakerRoad schedule, Thangs assembly/plan—into misleading shared
fields.

### 4. Wire all three runtime layers

- `deploy/src/App.jsx` and `deploy/src/lib/<platform>*.js`: controls, project
  propagation, transform, preflight, upload orchestration, result/readback UI.
- `desktop/main.js`, `desktop/preload.js`, `desktop/<platform>-direct.js`:
  isolated encrypted session, allow-listed virtual routes, native choosers,
  first-party requests and safe diagnostics.
- `backend/src/adapters/` and `backend/src/index.ts`: matching Worker/reference
  adapter when that platform has a hosted fallback.

Keep request order inside each publisher. Keep the global scheduler at four
until retained four-active telemetry is reviewed. A failed-only retry must not
rerun successful destinations.

### 5. Verify locally and in the exact package

Add focused request-shape, validation, renderer-control, bridge and readback
tests. Then run full renderer, desktop and backend suites, backend typecheck,
production build, `git diff --check`, package/sign, strict codesign, and exact
runtime inspection. Confirm there is one normal ModelPrep process and no
keepalive job.

### 6. Live-certify from safest to most consequential

1. private/draft/secret specialist fixture;
2. persisted edit/status readback for every requested field and ordered asset;
3. optional remix/paid/account-gated branch independently;
4. explicit public/review branch independently;
5. delete only after exact action-time confirmation, then verify absence from
   list/status.

A 200 response or returned ID is not certification. Certification requires the
expected visibility/state plus persisted metadata and assets. Retain receipts
on both success and mismatch.

## Current platform queue

| Platform | Flow map and adapter | Proven base | Next isolated branches |
|---|---|---|---|
| Printables | `printables-web-flow.md`; `desktop/printables-direct.js`; `backend/src/adapters/printables-web.ts` | Safe draft plus G-code/SLA/retained-ZIP/converted-HEIC draft `1797772`; public model `1797774` live | Delete `1797774` only after confirmation; Store/Club requires eligible account; approval-gated account, remix/reupload, unpacked ZIP and rich-description image upload remain separate |
| Cults3D | `cults3d-web-flow.md`; `desktop/cults-direct.js`; Worker adapter | Secret free core and canonical ordered edit readback; settings/meta-tags/AI/comments propagated locally | Typed MP4/WebM, paid/open-price, public, usages/subcategories/meta-tags, deactivate/reactivate |
| MyMiniFactory | `myminifactory-web-flow.md`; `desktop/myminifactory-direct.js` | Private object `829056`, hierarchical category and hydrated asset readback | Public review, remix/source, declarations, advanced print data, license/category combinations |
| Nexprint | `nexprint-web-flow.md`; `desktop/nexprint-direct.js` | Unpublished core `2083625532272496640` | Public, BOM/originality/activity eligibility, broader attachments/extensions, high-count ordering |
| Creality Cloud | `creality-web-flow.md`; `desktop/creality-direct.js` | Original/private core `6a6e3f28753b84f6aab190a8` | Existing-draft edit, public, non-original/remix, instruction files, parsed print settings, paid eligibility |
| MakerOnline | `makeronline-web-flow.md`; `desktop/makeronline-direct.js` | Unpublished core `316221` | Parsed 3MF/profile media, docs, remix, public, paid, Creative Kit, China sync, Exclusive, resin, large/high-count |
| MakerRoad | `makeroad-web-flow.md`; `desktop/makeroad-direct.js` | Private Save `M2134222528` plus `uploadType=1` readback; local fail-closed readback comparison | Current native form has no video input or serializer: keep video unsupported; public review, paid points/cash, remix, schedule, print metadata/instructions |
| Thangs | `thangs-web-flow.md`; `desktop/thangs-direct.js` | Private single-part `1583272`, three-part readback | Multipart/bulk/assembly, versions/dependencies, standalone assets, plans/tiers, paid/membership, public/access |
| Thingiverse | `thingiverse-web-flow.md`; `desktop/thingiverse-direct.js` | Unpublished draft `7390480` | Public, remix/ancestors, custom rich sections, education/app fields, WIP/customizer/AI/NSFW, broader media |
| MakerWorld | `makerworld-web-flow.md`; `desktop/makerworld-direct.js`; Worker adapter | Private core `9053658`; broadest mapping already present | User will verify video manually; genuine LAC submit, public, remix, Exclusive/CyberBrick, BOM/docs edge cases |

Finish one platform's selected branch and update its flow map, requirements
matrix, live-audit ledger, canonical handoff, and next-agent prompt before moving
to the next platform.
