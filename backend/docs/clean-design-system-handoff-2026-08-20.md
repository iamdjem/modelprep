# Clean design system branch: handoff, 2026-08-20

Read this first when continuing UI/design work. The platform-certification track has
its own handoff (`NEXT_AGENT_PROMPT.md`, `platform-current-state-2026-08-08.md`); this
document covers the `codex/clean-design-system` branch only.

## Status in one paragraph

The redesign is done and so is the whole UI simplification audit, all five stages, plus
a copy pass and a header and settings rework on top. `deploy/src/App.jsx` is 13,885
lines, down from 14,727 at the start of the audit, while gaining the shared-disclosures
block, the severity tiers and a rebuilt Publish screen. Everything is committed and
pushed to `origin/codex/clean-design-system`; the working tree is clean. There is no
half-finished work to pick up. The next agent is choosing what to do next, not
finishing something.

## What this branch is

A full redesign of the ModelPrep renderer onto a new design system, with all feature
work from the package-workspace branch merged in. Base commit `50f017d` (tip of
`codex/fix-nexprint-key-warning`), 35 commits on top, tip `7324afe`.

- **Design system**: Inter only, pure white ground, moss-green primary (#5A7430 family,
  OKLCH hue 120), quiet pills, segmented controls, 4px grid, tokens in `GlobalStyles`
  inside `deploy/src/App.jsx` (`:root` variables; old names like `--accent` are aliases).
  Rules and the layout policy: `DESIGN.md` at repo root, which now also carries the
  rules this session established (see "Rules added to DESIGN.md"). Product context:
  `PRODUCT.md`. The original standalone prototype still exists at
  `deploy/prototype.html` (+ `deploy/src/prototype/`).
- **Shell**: the brand sits in the top bar over the sidebar column, same width, same
  divider, with the collapse control as a 32px circle at that seam. Then the project
  name as a bordered menu button (rename, new project, try demo), the readiness chip,
  Settings, and "Review and publish". No bottom status bar; status lives in the sidebar
  footer (`data-testid="status-bar"`, 64px, matching the step's Back/Next bar).
- **Screens**: Files is role-grouped tables with real STL/3MF previews, role selects, a
  role filter and hash-based duplicate detection, with "Import a folder" beside "Add
  files"; Details is a content column (title, description) plus a 340px metadata rail
  (category, licence, tags, origin and disclosures); Images is a filmstrip plus
  full-width editor with drag reorder; Profiles is a single column with a selector only
  when there is more than one profile; Platforms is one destination list with readiness
  pills and accordion panels; Publish is the project review card, one publish action,
  then one row per platform that expands to its listing preview and its own upload
  controls.
- **Settings** is a right-edge panel, not a dialog. A "Connect X" button anywhere in the
  app opens a 420px panel for that one platform; "All accounts and settings" widens it
  to the full five-tab panel.
- **Merged features** (from the redesign worktree, via a symbol-level three-way merge):
  calibration-puck demo, worker hashing + STL preview pre-generation, file role model,
  shared category/license auto-mapping with AutoMatchNote, sliced-3MF profile gating,
  package→gallery image sync, per-destination readiness (`platform-workflow.js`),
  MakerOnline verification, plus the new lib layer (project-store, assets,
  asset-processing, archive, build-plate, interactive-build-plate, makeronline-verify,
  shared-defaults, platform-workflow, demo-stl) and desktop asset-library /
  session-keepalive.
- **3D viewer**: `components/InteractiveBuildPlate.jsx` + `SlicerBuildPlate` in
  App.jsx. Fixed z-fighting (scene-scaled near/far), replaced hairline GL grid lines
  with a mipmapped texture quad, thinned the generic plate, added a bevel, removed
  floating fake controls, camera frames the model, model-based zoom floor,
  Solid/Wireframe/X-ray modes in the modal header, enriched dimension strip (triangles
  plus fits-plate verdict), full-width dialog.

## Worktree topology (important)

| Path | Branch | State |
|---|---|---|
| /Users/alex/modelprep | codex/fix-nexprint-key-warning | DIRTY, certification work, do not touch without authorization (see NEXT_AGENT_PROMPT.md) |
| /Users/alex/modelprep-package-workspace-redesign | codex/package-workspace-redesign | DIRTY, the feature source that was merged here; kept as reference, do not clean |
| /Users/alex/modelprep-clean-design-system | codex/clean-design-system | THIS branch, clean, all work committed and pushed |
| ~/.codex/worktrees/modelprep-local-slicer-backburner | codex/local-slicer-backburner | parked |

The uncommitted diffs in the first two worktrees are NOT fully absorbed: the
certification worktree's platform-adapter diff overlaps but was superseded by the
redesign worktree's versions; reconcile deliberately if certification work resumes.

## How to run and verify

- Dev server: launch config `prototype` in /Users/alex/modelprep/.claude/launch.json →
  port 5199 (serves the real app at `/` and the old prototype at `/prototype.html`).
- Tests: `cd deploy && npx vitest run` (538 tests; `settings.test.jsx` "fallback chain"
  is timing-sensitive, has a 20s timeout, rare flake), `cd desktop && npm test` (222),
  `cd backend && npm test` (33) plus `npm run typecheck`.
- Package: `cd desktop && CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist` →
  `desktop/dist/mac-arm64/ModelPrep.app` (plus DMG). Signed with the local identity,
  notarization skipped. The packaged renderer lives at
  `ModelPrep.app/Contents/Resources/renderer/`, NOT inside `app.asar`; grep there to
  confirm a build really contains your change, and read `renderer/version.json` for the
  commit it was built from.
- Run the packaged app without touching Alex's real profile and platform sign-ins:
  launch the binary directly with `MODELPREP_USER_DATA_DIR=<scratch dir>`. `open -n`
  does NOT pass environment variables through, so it uses the real profile. The app
  runs a session-keepalive pass ten minutes after launch against every platform with a
  stored session, which is why the scratch profile matters on a UI-only track.
- Dev shell against the dev server: `cd desktop && MODELPREP_URL=http://localhost:5199/
  MODELPREP_USER_DATA_DIR=<scratch> npm start`.

## The UI simplification audit: all five stages done

`backend/docs/ui-simplification-audit-2026-08-20.md` was the plan: a flow, duplication
and noise audit with a platform requirements matrix. Alex's answers to its four open
questions are recorded at the end of that document. All five stages are implemented.

1. **Free cleanups** (`3c1257d`). Removed the dead Package/AssetInspector family and its
   helpers, makeCubeStl/mockParseThreeMF, WORKFLOW_PHASES, the two permanently empty
   export groups, the unreachable MakerWorld real-photo warning, the duplicate "Save as
   default" button, the Files "Ready" pill and Status column, and FileSizeWarnings.
   Three behaviour fixes: file removal prunes per-destination routing
   (`pruneDestinationFileState` existed and was never called), the Details gate asks
   only for a title, and package-phase readiness stopped word-matching "profile" in
   unrelated errors. The .zip fallback on Publish was trapped inside the dead export
   group and is reachable again.
2. **Three-tier severity** (`135b966`). `platformPreflight` returns `errors`,
   `adaptations`, `optional` and `confirmations`; `warnings` remains the union of the
   middle two so adapters and receipts keep working. A destination is blocked, awaiting
   a confirmation, or ready, never "ready with warnings". The two unverifiable
   self-attestations (MMF no-AI, MakerRoad real photo) became publish-time checkboxes on
   the destination row, and every upload path gates on `publishBlockers(report)` rather
   than `errors`, so nothing uploads unconfirmed. Empty projects short-circuit to "Add
   files to get started" instead of 37 alarms.
3. **Shared fields** (`c7dd7f2`). Details owns provenance (origin, source URL, what
   changed), AI disclosure and NSFW; `shared-defaults.js` writes each into every
   platform's native field and the duplicated panel controls are gone. Print settings
   come from the sliced 3MF (Thingiverse printSettings, MMF technology and material
   quantity, Thangs unit). The Thingiverse summary derives from the description via a
   shared `buildListingSummary`. Thangs stores its primary part. Category maps gained
   MMF Hobby & DIY and Holiday & Seasonal plus MakerRoad Educational; the remaining gaps
   are deliberate and documented in `shared-defaults.js`.
4. **Top bar** (`010a20b`). Seven controls became four. Templates were removed rather
   than relocated, per decision 2: they were never persisted, so a "saved" template
   vanished on reload. Import moved to the Files screen.
5. **Publish consolidation** (`8de4b43`). One row per platform carries outcome,
   blockers, adaptation count, account, confirmation and receipt, and expands to that
   platform's preview and upload controls. The separate readiness list, preflight panel,
   target-card grid and two "skipped until…" lines are gone, along with the manual
   .zip/copy-paste package machinery no live platform could reach.

## What happened after the audit

Six more changes, all from Alex reviewing the running app.

- **Details is an editor** (`6f5783b`). The licence card opened an inline chooser inside
  half a row, whose height changed on every filter click and shoved the fields below it
  around. It is a grouped `<select>` now. The page became a content column plus a 340px
  metadata rail, capped at `max-w-6xl`, collapsing below `lg`.
- **Column baselines** (`9b69ef7`). Title/Category and Description/Licence were 8px and
  32px out of line. Every field opens with one `FieldHeader` (28px row, then 8px to the
  control) and the category hint that restated the page subtitle is gone.
- **Copy pass** (`d64b860`). 77 curly quotes converted to straight; "step 01/03" and
  "in Package" replaced with the screen names a user can actually see; "destination" and
  "target" standardised to "platform"; sidebar descriptions and screen subtitles
  rewritten inside the 100-character cap the header test enforces; six empty paragraphs
  cut. The Details writer got a button in the collapsed header and its long explanation
  moved to Settings → Help. For the record, it reads your photos and your one-line hint,
  nothing else.
- **Settings is a panel** (`759a131`). The dialog was sized to its content, so it
  resized and re-centred on every tab. Now full viewport height, 560px wide, and only
  the body scrolls.
- **Focused connect** (`6cef5a7`). All five "Connect X" buttons passed no platform, so
  they opened the whole Accounts list at the top. Each names its platform now and gets a
  420px single-platform panel.
- **The rail** (`8861b73`, `7324afe`). Brand moved from inside the sidebar to the top
  bar over the sidebar column; the collapse control moved with it; sidebar rows scaled
  up to the MakerStats desktop metrics (20px icon, 15px label, 40px row, 88px
  collapsed). Then four separate breaks in the left edge were measured and fixed: the
  rail's divider stopping 8px short at each end, the header not sharing the content
  row's max width (100px out at 2400px), the two bottom bars' rules landing 26px apart,
  and full-width notices cutting the rail in half.

## Rules added to DESIGN.md this session

Worth reading before touching layout, because each came from a bug Alex found:

- Content plus a metadata rail is the editor shape.
- A control that only ever holds one of a fixed list is a select, not a card with a
  chooser behind it.
- Every field opens with the same header row, and hint text stays out of the first field
  of a column.
- A panel on an edge, not a dialog in the middle, for anything with sections or anything
  opened mid-task.
- A button that names one platform opens that platform, not the list it belongs to.
- One edge, unbroken: the header shares the content row's max width and centring, the
  rail cancels the row padding, both bottom bars are 64px, and notices live in the
  content column.
- The top bar carries the brand over the sidebar column; sidebar rows are click targets
  first.

## Where to go next

Nothing is half-done. In rough order of value:

1. **A project library, and duplicating a project.** This is the replacement Templates
   was traded for (decision 2) and nothing offers it yet. `lib/project-store.js` exists
   and the UI does not use it.
2. **Settings → Accounts is 2.2 screens of scrolling** in a 560px panel. Connected
   accounts could collapse to one line each, leaving the sign-in form only for those
   that need it. Related: Help is documentation, not a setting, and is the main reason
   Settings still reads as a grab bag.
3. **Leftover design drift.** `mp-mono` tracked-uppercase micro-labels remain in the
   platform option panels and a few counters; DESIGN.md retired that treatment. Same for
   `mp-display` in places the type scale no longer uses.
4. **The rest of stage 3's automation**, scoped out deliberately: MMF dimensions and
   print-time range, Cults manufacturing details, MakerOnline print description,
   MakerWorld BOM and MakerRoad printers/materials seeded from parsed filament.
   MakerRoad's printMethod already defaults to FDM and every slicer ModelPrep detects is
   an FDM slicer, so there is nothing to derive there.
5. **Asset-library workspace** (collections, watched folders, inspector, disk indexing)
   is merged as code plus desktop support but is not surfaced in the Files UI.
6. **Viewer**: fullscreen toggle, screen-space orientation cube, triangle-count
   guardrail for software GL, double-click recenter, View menu outside-click and Escape.
7. **Release packaging**: notarization needs `APPLE_TEAM_ID`; currently skipped.
8. `backend/docs/platform-difference-matrix-ux.md` overstates shared-defaults gaps
   (it predates shared-defaults.js); update when touched.

## Traps worth knowing about

- **Inline `background` is a landmine.** React assigning the `background` shorthand
  makes jsdom expand it into every background longhand and then fail to re-parse its own
  serialization, which crashes any later testing-library query that clones the node
  (`Cannot set properties of undefined (setting 'background-color')`). All 173 inline
  uses are `backgroundColor` now and three `element.style.background` hover handlers are
  CSS classes. Keep it that way. CSS inside the `GlobalStyles` template literal is
  unaffected.
- **A controlled `<details open>` desyncs** whenever the native toggle event does not
  reach React, which is what jsdom does. Use a button and a conditional body, the way
  the Details writer panel and the Publish .zip row do.
- **`platformPreflight` returns early for MakerWorld**, delegating to
  `makerWorldPublishIssues` in `lib/makerworld.js`. Anything added to the generic path
  below that return never runs for MakerWorld. That is how the dead real-photo warning
  survived.
- **Gate uploads on `publishBlockers(report)`, never `report.errors`.** Errors alone
  miss outstanding publish-time confirmations.
- The screen shell (`data-testid="section-content"` first child) is pinned by
  `section-nav-layout.test.jsx` to stay `w-full min-w-0`; inner layout is free.
- Section header subtitles are capped at 100 characters by that same test. It is a good
  editor; fit the copy rather than raising the cap.

## Conventions that matter here

- Alex's writing style: no em dashes anywhere; plain words; sentence case; straight
  quotes. This applies to UI copy as much as to prose.
- Tests are updated when they pin old cosmetics, never weakened on behaviour. Several
  tests assert a proxy rather than the behaviour (for example "the word Settings appears
  twice"); when one of those breaks, replace it with the real assertion instead of
  restoring the proxy.
- Every visual change is verified in the browser at port 5199, and usually re-packaged;
  screenshots at grazing angles for viewer work. When the complaint is about alignment,
  measure with `getBoundingClientRect` rather than eyeballing a screenshot.
- Colors only via tokens; platform brand dots and canvas-internal colors are the
  exceptions. Dark grounds only inside the 3D canvas.
