# Clean design system branch — handoff, 2026-08-20

Read this first when continuing UI/design work. The platform-certification track has
its own handoff (`NEXT_AGENT_PROMPT.md`, `platform-current-state-2026-08-08.md`); this
document covers the `codex/clean-design-system` branch only.

## What this branch is

A full redesign of the ModelPrep renderer onto a new design system, with all feature
work from the package-workspace branch merged in. Base commit `50f017d` (tip of
`codex/fix-nexprint-key-warning`), 17 commits on top. Everything is committed; the
working tree is clean.

- **Design system**: Inter only, pure white ground, moss-green primary (#5A7430 family,
  OKLCH hue 120), quiet pills, segmented controls, 4px grid, tokens in `GlobalStyles`
  inside `deploy/src/App.jsx` (`:root` variables; old names like `--accent` are aliases).
  Rules and the two-column layout policy: `DESIGN.md` at repo root. Product context:
  `PRODUCT.md`. The original standalone prototype still exists at
  `deploy/prototype.html` (+ `deploy/src/prototype/`).
- **Shell**: brand + live per-step metas in the sidebar, slim top bar (project name,
  readiness chip, Settings/Templates/Import/demo/New, "Review and publish" CTA), no
  bottom status bar (status lives in the sidebar footer, `data-testid="status-bar"`).
- **Screens**: Files is role-grouped tables with real STL/3MF previews, role selects,
  role filter, hash-based duplicate detection; Details is one focused column with the
  collapsible AI panel; Images is a filmstrip + full-width editor with drag reorder;
  Profiles is a single column with a selector only when >1 profile; Platforms is a
  single-column destination list with readiness pills and accordion panels; Publish is
  stacked (review → destination readiness → preflight → batch panel → accordions).
- **Merged features** (from the redesign worktree, via a symbol-level three-way merge):
  calibration-puck demo, worker hashing + STL preview pre-generation, file role model,
  shared category/license auto-mapping with AutoMatchNote, sliced-3MF profile gating,
  package→gallery image sync, per-destination readiness (`platform-workflow.js`),
  MakerOnline verification, plus the new lib layer (project-store, assets,
  asset-processing, archive, build-plate, interactive-build-plate, makeronline-verify,
  shared-defaults, platform-workflow, demo-stl) and desktop asset-library /
  session-keepalive.
- **3D viewer**: `components/InteractiveBuildPlate.jsx` + `SlicerBuildPlate` in
  App.jsx. This session fixed z-fighting (scene-scaled near/far), replaced hairline GL
  grid lines with a mipmapped texture quad, thinned the generic plate, added a bevel,
  removed floating fake controls, made the camera frame the model, model-based zoom
  floor, Solid/Wireframe/X-ray modes in the modal header, enriched dimension strip
  (triangles + fits-plate verdict), full-width dialog.

## Worktree topology (important)

| Path | Branch | State |
|---|---|---|
| /Users/alex/modelprep | codex/fix-nexprint-key-warning | DIRTY, certification work, do not touch without authorization (see NEXT_AGENT_PROMPT.md) |
| /Users/alex/modelprep-package-workspace-redesign | codex/package-workspace-redesign | DIRTY, the feature source that was merged here; kept as reference, do not clean |
| /Users/alex/modelprep-clean-design-system | codex/clean-design-system | THIS branch, clean, all work committed |
| ~/.codex/worktrees/modelprep-local-slicer-backburner | codex/local-slicer-backburner | parked |

The uncommitted diffs in the first two worktrees are NOT fully absorbed: the
certification worktree's platform-adapter diff overlaps but was superseded by the
redesign worktree's versions; reconcile deliberately if certification work resumes.

## How to run and verify

- Dev server: launch config `prototype` in /Users/alex/modelprep/.claude/launch.json →
  port 5199 (serves the real app at `/` and the old prototype at `/prototype.html`).
- Tests: `cd deploy && npx vitest run` (504 tests; `settings.test.jsx` "fallback chain"
  is timing-sensitive, has a 20s timeout, rare flake), `cd desktop && npm test` (222),
  `cd backend && npm test` (33) + `npm run typecheck`.
- Package: `cd desktop && CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist` →
  `desktop/dist/mac-arm64/ModelPrep.app` (+DMG). Signed with the local identity,
  notarization skipped. To run without disturbing the user's real profile/sign-ins:
  launch the binary with `MODELPREP_USER_DATA_DIR=<scratch dir>`; the user's packaged
  app from the redesign worktree may hold the default profile's single-instance lock.
- Dev shell against the dev server: `cd desktop && MODELPREP_URL=http://localhost:5199/
  MODELPREP_USER_DATA_DIR=<scratch> npm start`.

## Where we stopped: the simplification audit (decision pending)

`backend/docs/ui-simplification-audit-2026-08-20.md` is the current work product: a
full flow/duplication/noise audit with a platform requirements matrix. Nothing from it
is implemented yet. Alex has NOT yet answered its four open questions (per-destination
file-role overrides keep/drop; Templates keep/fold; attestation checkboxes as blockers
vs publish-time confirm; auto-enabling destinations from file types).

Proposed implementation order once Alex decides:
1. Free cleanups (dead Package/AssetInspector family ~300 lines, unreachable
   manual-export machinery, dead MakerWorld preflight rule, duplicate
   default-platforms UI, Details gate stricter than preflight, Files "Ready" pill,
   FileSizeWarnings panel, readiness-regex misclassification).
2. Three-tier severity policy (blockers once at the owning destination; quiet
   "will adapt" notes that never amber a card; optional gaps invisible outside the
   platform panel; empty-project short-circuit).
3. Shared fields: provenance block, AI disclosure, NSFW, print settings from parsed
   3MF, Thingiverse summary derivation, category-map data gaps, Thangs primary-part
   persist, MakerRoad printMethod default.
4. Top bar: name-menu (New/Templates/demo), Import into Files, keep chip + Settings +
   publish CTA.
5. Publish consolidation to one destination list.

## Other known follow-ups

- Viewer: fullscreen toggle, screen-space orientation cube, triangle-count guardrail
  for software GL, double-click recenter, View menu outside-click/Escape close.
- Asset-library workspace (collections, watched folders, inspector, disk indexing)
  merged as code + desktop support but not surfaced in the Files UI.
- Release packaging: notarization needs APPLE_TEAM_ID; currently skipped.
- `backend/docs/platform-difference-matrix-ux.md` overstates shared-defaults gaps
  (predates shared-defaults.js); update when touched.

## Conventions that matter here

- Alex's writing style: no em dashes anywhere; plain words; sentence case.
- Tests are updated when they pin old cosmetics, never weakened on behavior.
- Every visual change is verified in the browser (port 5199) and usually re-packaged;
  screenshots at grazing angles for viewer work.
- Colors only via tokens; platform brand dots and canvas-internal colors are the
  exceptions. Dark grounds only inside the 3D canvas.
