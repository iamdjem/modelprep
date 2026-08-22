# Clean design system branch: handoff, 2026-08-20

Read this first when continuing UI/design work. The platform-certification track has
its own handoff (`NEXT_AGENT_PROMPT.md`, `platform-current-state-2026-08-08.md`); this
document covers the `codex/clean-design-system` branch only.

## Status in one paragraph

The redesign is done and so is the whole UI simplification audit, all five stages, plus
a copy pass and a header and settings rework on top. On 2026-08-21 nine more changes
landed from Alex reviewing the running app: four desktop faults around sign-in and
transport, four UI rules, and two publish rules that were stricter than the platforms
themselves. `deploy/src/App.jsx` is 14,406 lines. Everything is committed and pushed to
`origin/codex/clean-design-system`; the working tree is clean. There is no half-finished
work to pick up. The next agent is choosing what to do next, not finishing something.

Read "What happened after the audit" before touching waiting states, dropdowns, file
previews or the MakerWorld and MyMiniFactory publish rules. Each entry names the fault
and the evidence, and several were caused by a rule of ours being stricter than the
platform it was modelling.

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
- Tests: `cd deploy && npx vitest run` (569 tests; `settings.test.jsx` "fallback chain"
  is timing-sensitive, has a 20s timeout, rare flake), `cd desktop && npm test` (245),
  `cd backend && npm test` (33) plus `npm run typecheck`.
- Tests that drive a dropdown go through `deploy/src/select-harness.js`. Ours is a
  listbox, so `fireEvent.change` with a value does nothing: `chooseOption` opens it and
  clicks, `optionLabels` reads what is on offer, `expectFieldValue` reads `data-value`
  where a native select answered `toHaveValue`.
- `renderer-target.test.js` fails if `main.js` requires a module the build does not
  ship. A missing one only shows up as "Cannot find module" at launch, which is how
  `printables-session.js` first shipped broken.
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
  metadata rail, collapsing below `lg`. The grid was capped at `max-w-6xl`; it now grows
  to 1600px and fills the leftover height from `lg` up (see "Details fills the step" below).
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
- **Details fills the step** (2026-08-20, after the audit). On a 2000px window the step
  used 1152 of the 1680px content column and stopped 400px above the Back/Next bar, so
  it read as broken next to Files, Images, Platforms and Publish, which all fill. The
  grid now grows to 1600px, the rail steps to 380px at `2xl`, and from `lg` the
  description takes the leftover height, which also makes Write, Preview and Adaptations
  one fixed box instead of three that resize the page. Below `lg` nothing changed, so the
  320px floor and normal scrolling stay.
- **Printables sign-in closes itself** (2026-08-20, `desktop/`). Reported live. After
  signing in the window stayed open, closing it by hand did not connect either, and only
  a second open-and-close worked. The cause was that we detected sign-in by asking the
  Printables GraphQL API, so anything that stopped the API answering (429, a stall, no
  timeout anywhere) counted as "not signed in" over a session already sitting in the jar.
  It is a local cookie check now. See "How Printables sign-in is detected" below.

- **MakerRoad sign-in window** (2026-08-20, `desktop/`). Their login page is a hard
  `width: 1152px`; our 1120px window clipped the card by 38px, cutting the password
  field and the Log In button. Window is 1240x900 with `minWidth: 1180` now. The other
  sign-in windows are fine, measured at the same time, except Thangs, which rate-limited
  us before we could. See `makeroad-web-flow.md`.
- **Thingiverse ran into Cloudflare** (2026-08-20, `desktop/`). A working session reported
  "not authenticated (HTTP 403)" with the challenge page pasted into the UI, because
  `session.fetch` gets challenged no matter what cookies or User-Agent it carries.
  Thingiverse now uses the in-page transport Cults already had. See
  `thingiverse-web-flow.md` for the measurements.
- **Waiting states, app-wide** (2026-08-20). The app had two spinner idioms (four uses of
  Tailwind's `animate-spin` bypassed the reduced-motion guard), `.mp-pulse`/`.mp-scan`
  defined and never used, no skeletons, no progress bars, no `aria-busy`, and silence
  during photo import and file hashing. DESIGN.md named "progress bars, skeletons" in its
  vocabulary and gave no rule for any of it. The rule now comes from MDS
  (mews.design): button loading state for what the person started, Spinner for what the
  system started, Skeleton for content on its way, status indicators for rows. Primitives:
  `LoadingButton`, `Spinner`, `Skeleton`, `SkeletonRows`, `FieldSkeleton`, `WorkingStatus`.
  Pinned by `deploy/src/waiting-states.test.jsx`. See DESIGN.md, "Waiting".

- **File previews show the file** (2026-08-20). The demo fixture pointed the two STL rows
  at gallery photos (`images[2]`, `images[8]`), so the Files screen advertised a "TOP /
  ISOMETRIC VIEW" card where the model goes, and because the renderer skips any file that
  already carries a `previewDataUrl`, the demo never ran the real STL renderer at all.
  The fixture attaches no previews now. The 3mf uses its own `Metadata/plate_1.png` and
  the STLs get drawn from geometry, the same as a file you add yourself. Also: the raster
  went from 96px to 256px, since the slider reaches 128px and a 2x display doubles that;
  the ambient floor went from 0.30 to 0.45, which lifts the darkest face from tone 70 to
  104 against a tile of 38; and the preview tile now looks like the button it always was.
  A puck still reads flat, because 78% of its pixels are one tone. That is the model, not
  the renderer: a faceted test shape spends only 38% on its dominant tone.

- **One dropdown, everywhere** (2026-08-20). The app had 61 native `<select>`s beside one
  hand-built category picker. On macOS a native select paints a dark OS menu, so every
  licence, category and action picker looked foreign next to the field above it. They are
  all `Select` now (`App.jsx`), generalised from `CategorySelect`, following MDS: search
  from eight options, groups from `option.group`, `role="combobox"` and `data-value` on
  the trigger so it keeps what a select gave assistive tech and tests. 17 of them gained
  an accessible name they never had, since a bare `<Label>` names nothing. Tests drive it
  through `src/select-harness.js` (`chooseOption`, `optionLabels`, `expectFieldValue`).
  Watch for: the conversion was scripted, and the script got four things wrong that had to
  be fixed by hand (a label that mixed text and an expression, a `className={expr}` turned
  into a literal string, a dropped inline `style`, and `disabled={expr}` flattened to
  `disabled: true`). If something looks off in a panel nobody has opened yet, suspect that
  list first.

- **Unsliced Bambu projects, and pictures one platform cannot take** (2026-08-20). Two
  blockers with no remedy. MakerWorld's readiness demanded a configured print profile for
  any `.3mf` while the Profiles step only created one for a file it could prove was
  sliced, so an unsliced Bambu project was unpublishable and the step that could fix it
  was empty. MakerWorld slices server-side (makerworld-web-flow.md line 229, live publish
  2026-06-20), so `lib/print-profiles.js` now gives a profile to any sliced project and to
  an unsliced Bambu one. Separately, an oversized picture blocked MyMiniFactory, and since
  the gallery is project-wide the only fix was shrinking it for everyone;
  `lib/platform-images.js` skips what a platform cannot take, reports it as an adaptation,
  hands the lead to the next usable picture, and takes a per-platform cover override.
  Every uploader inherits this through `orderedPlatformImages`.

## 2026-08-21: header, panels and the project library

Alex reviewed the running app again. Uncommitted at the time of writing; run
`cd deploy && npx vitest run` (581) and `cd desktop && npm test` (245).

- **Top bar** is brand, project menu, New project, Try demo, Settings. "Review
  and publish" is gone (Publish is a sidebar step), so is the "0 of 5 steps
  done" chip and the sidebar footer: both repeated the check the sidebar already
  draws beside each finished step. A collapsed sidebar shows that check as a
  badge on the icon. The folder-import receipt dialog is gone too.
- **Platform panels**: MakerWorld used its own `inputCls` on `Select` (double
  border), muted 12px labels and a search box above a Select that already
  searches; all normalised to `Label` + bare `Select`. The 44rem readability cap
  now covers `.mp-select` as well as inputs, and textareas share it, so every
  single-column control in a panel has the same right edge. Limits stats cluster
  left instead of spreading across the panel.
- **Project library** (`lib/project-library.js`, `project-library.test.jsx`).
  Every project has an `id`; its text lives in localStorage under
  `modelprep:projects:v1`, its files in IndexedDB under the same id
  (`storageId`). The single autosave slot is migrated once by
  `migrateLegacyAutosave` and its restore bar is gone: launch reopens the last
  open project. New project and folder import create entries instead of wiping.
  The project menu offers rename, duplicate, recent projects and "All projects…"
  (a right-edge `ProjectsPanel` with open, duplicate, delete). Names:
  typed name, else listing title, else "Project 21 Aug 2026". Release plans
  carry `projectId`; a due scheduled plan for a project that is not open asks
  ("Open and publish") before switching, because every uploader works on the
  open project. Background publishing of a non-open project is not built.

- **Platform panels, second pass** (same day). Sections and subsections carry an
  icon picked from the title (`SECTION_ICONS`, `SectionTitle`, `iconForSection`);
  common fields carry one picked from the label text (`FIELD_ICONS` in `Label`
  and `FieldCaption`). "Files and roles" is collapsed to a summary line ("9 files ·
  2 manual · 1 not accepted") and lists only non-photo files; photos belong to the
  Images step. "Remember these settings" (`lib/platform-defaults.js`,
  `PlatformDefaultsRow`) stores a platform's answers minus anything bound to this
  project (files, pictures, remix sources, contest, price, auto flags) and
  `freshProject()` applies them; Settings → Defaults lists and forgets them.

- **Required marks and Clear** (same day). `lib/platform-required.js` lists, per
  platform, label patterns for the fields preflight rejects without; `Label` and
  `FieldCaption` read the scope from `RequiredCtx` (the platform panel provides its
  id, Details provides "details") and show a red asterisk titled "Required by X". A
  literal "(required)" in a label is stripped so it is not said twice. Choices
  persist in project state; clearing is explicit: `ClearButton` on `SectionTitle`
  and `MwSection` (Source & remix, Linked model, CyberBrick, BOM, Documentation),
  "Reset {platform} settings" beside Remember (two presses, four-second arm), and
  "Clear details" on the Details header (same two-press pattern).

- **Needs attention lines are links** (same day). `lib/issue-targets.js` maps a
  preflight message to a step, a platform panel and a label pattern; `IssueLink`
  renders it, `goToIssue` in App switches step (and opens the platform card through
  `openPlatformId`), then an effect finds the label (`label`, `[data-field-caption]`,
  `[data-section-title]`), scrolls, focuses the control and flashes it (`.mp-flash`).
  Account messages open Settings for that platform. The Publish row's "Fix" button
  uses the same path and its expanded body lists every blocker as a link. New
  wording falls back to the Platforms step; add a rule when a message gains a
  field.
- **Known, not fixed**: MakerWorld's "Model source" select snaps back to Original
  because shared-defaults writes Details' origin into it on every render. It
  should either read "Same as Details step" or become a real override like licence.

- **The writer is a header action** (same day). The tinted "Write the listing for
  me" banner is gone. `DraftListingControl` sits in the Details header beside Clear
  details: "Draft from photos" (or "Draft listing" without photos), primary while the
  listing is empty and ghost once there is text, "Drafting…" while busy, with a
  "Reads your N photos" caption. It opens `DraftPanel`, a right-edge panel
  (520px) with a full-height hint textarea (Cmd+Enter drafts), the Draft button and
  a footer that names the provider or links "Set up AI". After a run the panel
  shows the status and a "Waiting for your say" list of Replace / Keep mine cards
  with Replace all; the same offers also sit beside the field labels once the panel
  is closed. `runGenerate` fills
  only empty fields and flashes them (`mp-flash`); fields that already had text get a
  `DraftOffer` beside their label with Replace and Keep mine. The status line is a
  `role="status"` paragraph under the header that clears itself (6s, 12s for a
  warning).

- **Draft panel, two modes** (same day). The header button reads "Improve listing"
  once anything is written and "Draft from photos" / "Draft listing" when nothing is.
  The panel has a segmented switch, "Improve what I wrote" / "Start from a prompt",
  defaulting to the listing's state. Improve sends `improveBrief()` (existing title,
  description, tags, the maker's direction) as a multi-line hint; both
  `aiUserInstruction` and `backend/src/adapters/ai-listing.ts` pass a multi-line hint
  through as the instruction instead of quoting it as a "one-line hint". Improve with
  no provider refuses with a message; the offline writer only serves create mode.
  Tags are merged (yours always survive) and the card says "3 new, 5 kept". Every
  proposal is editable in its card (input, textarea, comma list for tags) before
  "Use this" / "Use all"; Replace, Keep mine and Use all all report in the status box.
  Pinned by `draft-listing.test.jsx`.

- **Dark mode** (same day). Every colour now goes through a token: the 258
  `rgba(38,42,35,x)` ink literals became `--ink-aNN` steps (NN = alpha × 100),
  primary and white alphas likewise (`--primary-aNN`, `--surface-aNN`), and the
  known hex literals became the tokens they mirrored (`--ink`, `--primary`,
  `--danger-text`, `--success-text`, `--warn-text`, `--api`, plus new `--info-tint`,
  `--info-text`, `--accent-warm`, `--accent-warm-text`, `--danger`, `--surface-glass`,
  `--on-primary`). The dark palette lives in `:root[data-theme="dark"]` and under
  `prefers-color-scheme: dark` for `:root:not([data-theme="light"])`. Preference:
  `modelprep:theme` (system | light | dark), `applyTheme()` sets `data-theme` on
  `<html>`, chosen in Settings → Appearance (its own tab: Mode, Dark palette, Accent). Platform brand dots and the
  3D canvas keep their own colours on purpose. New colours must be tokens.
  Named dark palettes (`DARK_PALETTES`, `modelprep:palette`, `data-palette` on `<html>`):
  Graphite (ours), Tokyo Night, Catppuccin Mocha, Nord, Dracula, GitHub Dark, One Dark,
  VS Code Dark Modern, Telegram Night, Slack Dark, Solarized Dark, Monokai Pro, Gruvbox
  Dark, Rosé Pine, Ayu Dark, Night Owl. Accents (`ACCENTS`, `modelprep:accent`,
  `data-accent`): Brand green, Orange, Blue, Purple, Pink, Teal, Amber, Red, each with a
  light value and a dark value, plus "Theme colour" in dark (each palette's signature,
  `THEME_ACCENTS`). All blocks are generated from tables in the session script
  (`scratchpad/themes2.py` at the time); to add a theme or accent, add a row and
  regenerate, or hand-write the same token list. "System" is resolved by `applyTheme()`
  with one `matchMedia` listener; there are no `prefers-color-scheme` blocks in the CSS,
  because emitting every palette twice made the stylesheet 184KB and jsdom-rendered
  tests time out. Trap: canvas code cannot read CSS variables; `makeSampleImage` and the
  demo tint tables keep literal colours, and photo wells use `--canvas` (dark in both
  themes) rather than `--ink`, which is light in dark mode.
- **Files takes videos** (same day). The Files drop zone accepted photos but refused the
  clip beside them; `addVideos` in `FilesSection` now routes mp4/mov/webm into
  `project.media` the way Images does, with a "Video added to Images" notice.

- **Side panel widths** (same day): connect 480px, Projects and draft 640px, Settings
  720px, all `min(Npx, 90vw)`. Recorded in DESIGN.md.

- **Reconnect false alarms** (2026-08-21, `desktop/`). MyMiniFactory, MakerRoad and Cults
  showed "Reconnect" at launch while their session cookies (`PHPSESSID`, `X-Token`,
  `_session_id`) were live for another one to three weeks. `recoverDesktopAccount` trusted
  only the network identity read, and a launch that gets challenged or rate-limited
  (this machine relaunched the app eight times that afternoon) returned nothing.
  `desktop/session-liveness.js` now judges the jar: a live session cookie keeps the account
  connected (`unverified: true`, label unchanged); only a missing or expired one asks for
  the sign-in window. A definite rejection by the platform
  ("Token错误", 401, "unauthorized", "login required": `isDefiniteSignOut`) is recorded by
  the MMF and MakerRoad validators (`noteAuthFailure`) and overrides the cookie for a
  minute, so a dead token still asks for sign-in; at the time MakerRoad's token really was
  rejected while MyMiniFactory only got "Redirect was cancelled". The other validators
  still swallow errors silently; give them `noteAuthFailure` when their rejection
  wording is known. Same rule Printables already had. Keep-alive only runs while the
  app is open; a session can still age out if the app stays closed past the platform's
  own expiry (MMF and MakerRoad rotate a 7-day cookie, Cults 3 weeks, MakerWorld and
  Printables hold 30-day refresh tokens).
- **Side panels** share one adaptive width, `.mp-panel { max-width: clamp(480px, 44vw,
  800px) }`, replacing the per-panel steps from earlier in the day.

- **Background mode** (2026-08-21, `desktop/background-mode.js`, wired in `main.js`).
  Sessions live in this app's partitions, so only the app can refresh them; background
  mode keeps the app resident after the last window closes (menu bar item from
  `trayTemplate.png`, Dock hidden) and writes a LaunchAgent,
  `~/Library/LaunchAgents/com.modelprep.desktop.keepalive.plist`, that runs the app
  with `--hidden` at login (`launchAgentPlist`, rewritten on every start so a moved .app
  keeps a valid path; packaged builds only). Not Electron's login item: its "open as
  hidden" flag is ignored on macOS 13+, so the window would open at every login; any
  legacy login item is removed. Keep-alive runs every 4 h (first pass 60 s after a hidden
  start, 10 min after a normal one) and 30 s after the Mac wakes (`powerMonitor`).
  Preference in `background-mode.json` (default on); IPC `background-mode:get/set/refresh`;
  tray menu: Open, status, Refresh now, the toggle, Quit; `app.isQuitting` separates Quit
  from closing the window. Settings → Accounts shows the switch, last refresh and Refresh
  now (`BackgroundKeepAliveSetting`). Turning it off with no window open quits.
  Found on the way: `main.js` binds `fs` to `node:fs/promises` and `fsSync` to `node:fs`,
  and eleven sync calls (release plans, the diagnostics log, error log) were on the wrong
  one and silently never wrote. All moved to `fsSync`.

- **Design polish pass** (2026-08-21, from Alex's screenshots). Profiles runs the
  width (name beside visibility, cover beside photos, 1600px cap) instead of a 760px
  column; the unselected profile tab was hard-coded white; compatible printers got
  Select all, Clear and 13px rows; "I have read the guidelines" is remembered on this
  computer (`modelprep:ack:makerworld-profile-guidelines`) so the next profile starts
  ticked (a per-model claim like "real printed photo" is not remembered on purpose).
  Shared rules: checkboxes and radios 16px in the brand colour; file inputs draw the
  ghost button through `::file-selector-button`; every `.mp-btn` in a platform panel is
  the 34px small size. Related-model search and BOM inputs use `mp-input-sm` and ghost
  buttons. The Files role column is a fixed 16rem with both selects full width. The
  project-name button truncates at `min(72ch, 44vw)` instead of 38ch.

- **Screen-by-screen walkthrough** (2026-08-21, evening, after the polish pass). Every
  step, the Settings panel and the MakerWorld, Printables, Cults3D, Thangs and
  Thingiverse panels were measured in the browser (computed heights, font sizes and
  weights grouped per screen) in light and dark. Root causes and fixes, all in
  `GlobalStyles` unless named: control scale moved to 34px/14px and 28px/13px (was
  rem fractions, see DESIGN.md "Type and controls, measured"); platform panels force
  34px on buttons and text fields; `SectionTitle` is 14/600 ink (was 11px muted
  uppercase, indistinguishable from a hint); `MwSection` hints 12px, badge uses
  `--primary-a12` (was an rgba literal), body spacing 12px; option-row labels unified
  through `label:has(> input[type=checkbox|radio])`; file inputs 34px ghost button;
  MakerWorld 3D/Laser switch is `.mp-segmented`; Images "Set as cover" is a real
  `.mp-btn` (its `--ink` fill under white text was the unreadable white button in dark
  mode); profile photo-picker caption scrim fixed at `rgba(0,0,0,0.72)`; Settings
  account inputs use `.mp-input` (were 38px cards); `FIELD_ICONS` gained name, tags,
  photo/cover, category-anywhere and batch-action patterns so neighbouring labels all
  carry an icon; step subtitles cap at 72ch (Images wrapped one word at 576px); the
  Cults3D details textarea and the Help problem textarea use `.mp-input`. Still open:
  "Printables summary (required, 120 characters)" keeps its literal "(required" because
  `stripRequiredSuffix` only removes a bare "(required)"; Profiles has Select all in
  the body and Clear in the subsection header, which is consistent with other
  subsections but reads as two places.

- **Five steps, decision-first panels** (2026-08-21, late). Profiles is no longer a
  step: `SECTIONS` drops it, `ProfilesSection` takes `embedded` and renders inside
  `MakerWorldOptions` as the "Print profile" `MwSection` (needs `updateProject`, which
  `PlatformsSection` passes through `PlatformCard`; tests rendering `MakerWorldOptions`
  alone get no subsection). Images goes straight to Platforms. `lib/issue-targets.js`
  points every profile message at the platforms step with `platformPanel`. Limits and
  Accepted formats moved out of the panel body into the header's "Requirements &
  evidence" disclosure. `ReleasePlanControls` left `PlatformCard`; `ReleasePlanPanel` on
  Publish (above the platform rows, `data-testid="release-plan-panel"`) renders one per
  enabled live platform with the platform name as title. Tests renumbered (Platforms is
  step 4, Publish step 5). Companion docs: `platform-field-matrix-2026-08-21.md` (what
  each panel asks, derived / reference / decision / unique) and
  `research-multi-platform-publishing-2026-08-21.md` (how video, podcast and music
  distributors handle the same problem).

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
- Waiting: who started the work decides the component (MDS mapping).
- One Select for every dropdown; search from eight options; under five, MDS wants a
  different control entirely.

## Where to go next

Nothing is half-done. In rough order of value:

1. ~~A project library~~ Built 2026-08-21 (see above). Left: publishing a due project in
   the background without switching to it, and an export-to-folder for a project.
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

## How Printables sign-in is detected

Ground truth, read off the live `persist:printables` partition on 2026-08-20: Prusa's
OAuth hand-back writes `auth.access_token` (2 hours) and `auth.refresh_token` (30 days)
on `.printables.com` at the moment sign-in completes. Every other cookie on the domain
(`cookieyes-consent`, `cf_clearance`, `client-uid`, the api subdomain's `csrftoken`) is
already there before anyone signs in and says nothing about it.

So the sign-in window watches the partition, not the API:

- `desktop/printables-session.js` holds the pure parts: which cookies are the session,
  whether a non-expired one is present, the cookie header, and the three-way whoami
  state. Unit-tested in `printables-session.test.js`.
- `runLoginCapture` takes a `subscribe` hook. Printables subscribes to
  `session.cookies.on('changed')`, so the window closes on the tick the cookie is
  written rather than up to a poll later.
- The identity read is a nicety layered on top, bounded twice (fetch timeout, then a
  whole-check deadline). **Only a definite "signed out" keeps the window open.** A 429,
  a timeout or an offline machine resolves on the cookie alone and the connect handler
  stores the session anyway; the renderer runs its own whoami straight after.
- `runLoginCapture` also releases its in-flight lock after `attemptTimeoutMs` (20s), so
  one hung attempt can no longer silence every later poll.

Verified under real Electron with a throwaway partition and synthetic cookies (no
account, no network): API answers → closes in ~300ms; API rate-limited → closes, session
kept; API never answers → closes on the budget; Printables says signed out → stays open;
no sign-in → stays open; closed by hand → still captured.

**The same shape of bug is still live on the other platforms.** Nexprint, Creality,
MakerOnline, MyMiniFactory, MakerRoad and Thangs all gate their sign-in window on a
network validation, so any of them can hold a window open over a session that already
exists. MakerWorld is the one that was always right: `readMwCookie` decides on
`token`/`refreshToken` being present. Each needs its own cookie ground truth before
being converted.

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
