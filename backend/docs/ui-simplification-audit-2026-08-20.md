# UI simplification audit — 2026-08-20

> **Status: fully implemented, 2026-08-20.** All five stages shipped on
> `codex/clean-design-system` (`3c1257d`, `135b966`, `c7dd7f2`, `010a20b`, `8de4b43`),
> along with six follow-up changes from Alex reviewing the running app. Alex's answers
> to the four open questions are at the end of this document. What is left over from
> the audit, and what to do next, is in
> `backend/docs/clean-design-system-handoff-2026-08-20.md`. Everything below is the
> original analysis, kept as the record of why each change was made. The numbers in it
> describe the app **before** the work, not now: the 37-alarm empty project, the ten
> places one problem appeared, the six severity vocabularies and the ~300 lines of dead
> UI are all gone.

Goal restated: a creator drops model files, print profiles, and photos; ModelPrep maps
everything to ten platforms' differing requirements as automatically as possible; shared
metadata is written once and adapted per platform; per-platform customization is opt-in;
the app never shouts about optional gaps when an upload is possible.

Method: visual walk of every screen in the running app (including the expanded
MakerWorld options panel, the Publish accordions, and the empty first-run state), plus
two code-extraction passes: the per-platform requirements matrix from `PLATFORMS`,
`platformPreflight`, the ten options components, `shared-defaults.js`,
`platform-files.js`, and `platform-workflow.js`; and a duplication/flow inventory.

## The numbers

- **Happy path today: 6 screens, ~32 clicks** (3 files + 10 photos, all accounts
  connected, publish everywhere). About 15 of those clicks are per-platform compliance
  answers hidden one card-expander deep on the Platforms screen; 5 more are the
  MakerWorld profile ritual on Profiles. Two-thirds of the post-ingestion cost is
  "customization" the flow makes mandatory.
- **One project problem renders in up to 10 places** (sidebar checkmark, top-bar chip,
  platform card pill, Needs-attention panel, Publish subtitle, readiness card,
  preflight panel, batch receipt, skipped-footer, per-platform upload flow box).
- **~24 distinct error/warning surfaces** using at least six severity vocabularies
  (errors/warnings, blockers/warnings, Needs attention, blocked/warning/ready,
  "Heads up"/"Still needed", "Possible duplicate"/"Issues").
- **The wizard is stricter than the platforms**: Details refuses to continue without a
  description, category, and a tag, all of which preflight itself treats as mere
  warnings. The gate teaches users that warnings are blockers.
- **~300 lines of dead UI** (the old Package/AssetInspector family, including a sixth
  readiness surface) plus a fully unreachable manual-export card system: all ten
  platforms are live, so the "Export & future connections" group is permanently empty.

## Headline findings

1. **The empty state is an alarm wall.** A brand-new project on Publish reports
   "Pre-flight: 27 blockers · 10 warnings across 6 platforms" — the same missing title
   and missing files repeated once per platform. One empty project produces 37 alarms.
2. **Publish tells the same status five times on one screen**: the destination readiness
   list, the preflight text panel, the publish target cards ("Not connected · will
   skip" × 10), a "Skipped until connected:" summary line, and the destination
   accordions.
3. **The platform options panels duplicate the shared step.** Category, license, and
   (twice) summary appear inside per-platform panels as well as in Details; per-file
   role dropdowns appear both in the Files table and per destination.
4. **Automation exists but stops short.** Slicer detection, role routing, shared
   category/license mapping, and image auto-attach all work — but remix/provenance,
   AI disclosure, NSFW, print settings, and summaries are typed by hand per platform
   even where the data already exists in the package.

## Platform requirements matrix (from code)

Legend: auto = filled by shared-defaults or parsing; manual = requires input;
blocker = preflight error; warn = uploads anyway.

| Platform | Hard requirements beyond shared basics | Auto today | Manual today (candidates to automate) |
|---|---|---|---|
| MakerWorld | category, cover crops (4:3+3:4), profile block when Bambu 3MF routed as profile (name, photo, real-photo confirm, guidelines), forbidden words | category, license, initial profile pick | AI flag, NSFW, BOM (filament data is parsed!), remix block |
| Printables | live category, AI yes/no (null default = permanent blocker), remix source | category (live match), license, summary derived | AI answer, authorship/remix |
| Cults3D | explicit category + license (no fallback for 'standard'), paid price bounds | category, CC licenses | manufacturing details (3MF has it), AI flag |
| MyMiniFactory | category path (auto for only 6/13 shared), license, no-AI declaration checkbox | partial category, license | declaration, dimensions (parsed!), material qty (= filament grams), print time (= parsed estimate) |
| Thingiverse | summary (manual), category, remix Thing ID, .scad when customizable | category (13/13), license | summary (derive like Printables), print settings (printer/material/resolution/infill — all parsed) |
| Thangs | primary part on multi-file (UI shows a default but never persists it — false blocker), filename charset | category, license fallback | persist the default primary part |
| Nexprint | live category, originality 1/2/3, source when adapted, cover crop 4:3 | category, license | originality default, BOM from parsed filament |
| Creality | category, license, Original-only sources, two cover crops | category, license | — (remix blocked by platform) |
| MakerOnline | leaf category (needs connected account), permission, printMethod, kit gates | category, license | printMethod from parsed 3MF |
| MakerRoad | 1–3 categories (missing map for Educational/Other), 3–10 images, printMethod (no default), real-photo confirm | category (11/13), license | printMethod default FDM from parsed profile |

Safe outcomes per platform (what "publish" actually does): drafts (Printables, Nexprint,
MakerOnline, Thingiverse), private objects (MakerWorld, MMF, Creality, Thangs), secret
live publication (Cults3D), review submission (MakerRoad).

## Automation gaps, ranked by clicks saved

1. **One shared provenance block** (Original / Remix + source URL + what changed) →
   fills up to ~18 inputs and pre-answers 8 hard blockers across MakerWorld, Printables,
   Nexprint, MakerOnline, MakerRoad, Thingiverse, MMF.
2. **One shared AI-disclosure field** → replaces 9 per-platform controls, including
   Printables' null-default hard blocker.
3. **Print settings from the parsed 3MF** → threemf.js already extracts printer,
   material, layer height, infill, print time, filament grams, units; Thingiverse
   printSettings, MMF tips/quantity/time, Thangs units, Cults manufacturing details,
   MakerOnline print description can all pre-fill.
4. **Derive the Thingiverse summary from the description** (Printables already does
   this) → deletes one blocker on every project.
5. **One shared NSFW toggle** → replaces 7 controls.
6. **Complete the category maps** (MMF 7 missing rows, MakerRoad 2) → deletes the
   residual category blockers; pure data work.
7. **Persist Thangs' displayed primary-part default** → deletes a false blocker.
8. **Default MakerRoad printMethod** from the sliced profile (or FDM).
9. **Seed MakerWorld BOM / MakerRoad printers+materials** from parsed filament and
   printer model.

## Noise inventory (fires without blocking a real upload)

- Tag and category violations double-reported: generic warning + platform error for the
  same fact.
- "Description is empty" warned for every platform, including where optional.
- Automatic fixes announced as warnings (Nexprint AI tag auto-append, Printables tag
  simplification, Creality instruction-file routing).
- Permanent platform limitations restated per project as warnings (Nexprint profile
  block not transmitted, Creality 3MF-as-geometry, MakerOnline resin behavior,
  Printables no-profile-section) — true forever, actionable never.
- The same video warned five times (once per non-supporting platform) while three other
  platforms drop video silently.
- Any warning turns a destination card amber ("Ready with warnings"), so harmless notes
  visually downgrade destinations that would upload unchanged.
- Dead rule: an unreachable MakerWorld real-photo warning in the generic path.
- Readiness phase classification regex-matches error text, so unrelated errors
  containing "profile"/"3mf" are miscounted into the Package phase.
- Two unverifiable self-attestation checkboxes are hard blockers (MakerRoad real-photo,
  MMF no-AI declaration).

## Proposed severity policy (three tiers instead of two)

- **Blocker (red, counts in badges):** the platform would reject the upload or the app
  cannot build the package. Shown once, at the destination that owns it.
- **Will-adapt note (quiet, grouped):** ModelPrep will change something automatically
  (truncate gallery, simplify tags, add a required tag, skip video). One collapsed
  "What ModelPrep will adapt" list per destination; never amber-colors a card.
- **Optional gap (invisible by default):** description empty where optional, no video,
  unfilled specialist fields. Appears only inside the platform's own panel as plain
  field state, never in preflight, never in counts.
- Empty projects short-circuit: before any files exist, every screen shows a single
  quiet "Add files to get started" instead of per-platform math.

## Duplication map (from code)

1. **Shared metadata**: category + license editable in Details AND in all ten platform
   panels (auto-mapped, but the overrides are always visible, not behind an "override"
   affordance). Description has four platform-local siblings (Printables summary,
   Thingiverse summary, MakerWorld laser profile, MakerOnline profile description).
2. **File selection**: editable in three places (Files role column, per-file
   MakerWorld/Printables expanders, per-destination PlatformFilePicker), displayed in a
   fourth (export cards).
3. **Readiness**: computed once, rendered on 8+ surfaces.
4. **Import**: top-bar Import (replaces project) vs Files dropzone (appends) — same
   verb, different semantics; photos also enter via a third path (auto-mirror to
   gallery).
5. **Persistence**: Templates vs continuous autosave vs default-platforms — and
   default-platforms itself has two UIs (Platforms "Save as default" button and
   Settings → Defaults tab) writing the same storage key.
6. **Previews**: the focal-crop result renders in four places; the adapted description
   in four places.
7. **Profiles screen is a MakerWorld page wearing a generic name** (visibility,
   guidelines, compatible printers are MakerWorld fields).

## Top bar and duplication proposals

Current top bar: project name · readiness chip · Settings · Templates · Import · Try
demo · New · Review and publish.

- **Import duplicates the Files dropzone** (same intake pipeline). Move Import into the
  Files screen next to "Add files"; folder import is a Files-context action, not a
  global one.
- **New belongs to the project identity**, not the action row: fold into a small menu on
  the project name (New project / Templates / Try demo), which also absorbs the
  Templates dropdown and the demo toggle — three buttons become one menu. Exit-demo
  stays visible as the Demo pill (click to exit).
- **Review and publish + readiness chip stay** — that pairing is the top bar's real job.
- **Settings stays** (accounts live there).
- Net: 7 controls → 4 (name-menu, chip, Settings, publish CTA).

## Screen-by-screen simplification

- **Files:** keep table + roles + filters (core). The per-file "MakerWorld/Printables
  file settings" expanders under every row are power-user fields (folder path, note,
  open-source flag) shown 2× per file all the time; collapse into a single "Platform
  file settings" affordance on the row actions, or move into the per-destination panel
  where the rest of platform customization lives.
- **Details:** becomes the single home of everything shared, extended with the new
  shared fields: provenance (Original/Remix + source), AI disclosure, NSFW — one form
  that pre-answers ten platforms.
- **Images:** core as is; video panel already appears only when a destination supports
  it (good pattern — generalize it).
- **Profiles:** appears only when a sliced 3MF exists (already gated); fine.
- **Platforms:** the destination list stays the customization home. Panels reorganize
  into: (1) Needs attention (blockers only), (2) Platform-specific fields that have no
  shared source, (3) "Same as shared" read-only rows with an Edit override for
  category/license/summary-type fields (replacing editable duplicates), (4) Advanced
  (limits, formats, release plan) stays collapsed.
- **Publish:** one destination list is the single status surface (outcome + blockers +
  will-adapt count + publish/connect action per row), absorbing the preflight panel,
  the target-card grid, and the skipped-line. Project review card stays. Destination
  accordions reduce to "Preview listing" per row.

## Cleanups with no downside (no decision needed)

- Delete the dead Package/AssetInspector component family (~300 lines).
- Remove or gate the unreachable manual-export card machinery.
- Remove the unreachable MakerWorld warning in generic preflight.
- Collapse the two default-platforms UIs into one.
- Stop the Details gate from being stricter than preflight (gate on files+title only;
  everything else follows the severity policy).
- Drop the per-row "Ready" status pill in Files (says nothing) and the static
  FileSizeWarnings panel (preflight enforces the real caps).
- Fix the readiness phase regex misclassification.

## Decisions (Alex, 2026-08-20)

1. **Per-destination file-role overrides stay.** `DestinationFileRoleRow` keeps its
   place in the platform panels. The Files-table role remains the default; the panel
   override is the escape hatch when a platform needs a file in a different slot.
2. **Templates fold into duplicating a project.** Drop the Templates dropdown rather
   than move it into the project-name menu; a project library plus "duplicate" covers
   the same need without a third persistence format beside autosave and default
   platforms.
3. **The two attestations move to publish time.** MyMiniFactory's no-AI declaration
   and MakerRoad's real-photo confirmation stop being standing preflight errors. They
   become a confirmation in the publish step for those destinations, required before
   their upload runs. Nothing uploads unconfirmed; the app just stops showing two
   permanent red rows it cannot verify anyway.
4. **Destination selection stays fully manual.** File types never enable a
   destination, and the app does not suggest one either. Files change how a selected
   destination is configured, never whether it is selected.
