# ModelPrep compact vertical workflow-header design QA

- Source visual truth: `/tmp/modelprep-density-audit/packaged-wide-expanded.jpeg`
- Accepted design intent: replace the wide side-by-side title/subtitle layout with a smaller title and a concise subtitle directly underneath; keep subtitles on one line while space permits and allow natural wrapping at narrow widths.
- Browser implementation screenshot: `/tmp/modelprep-vertical-header-audit/browser-1280-files.png`
- Packaged implementation screenshot: `/tmp/modelprep-vertical-header-audit/packaged-wide-files.jpeg`
- Six-screen packaged contact sheet: `/tmp/modelprep-vertical-header-audit/all-wide-screens.png`
- Full comparison: `/tmp/modelprep-vertical-header-audit/header-full-comparison.png`
- Focused comparison: `/tmp/modelprep-vertical-header-audit/header-focused-comparison.png`

## Viewport and normalization

- Source and packaged implementation: 1265 x 768 Computer Use exports from the same maximized Electron window.
- Browser implementation: 1280 x 720 CSS pixels at device pixel ratio 1.
- State: Files empty state for the direct comparison; complete Demo project for the six-screen verification.
- No density normalization was needed for the packaged source and implementation because their dimensions, app shell, state, and capture surface match.

## Evidence

The focused comparison shows the accepted hierarchy change: the title is reduced from 44px to 36px and the 14px subtitle sits 4px beneath it. The packaged implementation preserves the step label, divider, typography family, and surrounding layout while making the title block easier to scan.

At 1280px, every complete-Demo subtitle measures one 20px line and every workflow header measures 99px. The subtitle has no fixed line clamp, truncation, no-wrap rule, or artificial maximum width, so it wraps naturally when available space becomes narrower. No horizontal overflow or browser console warning was observed.

## Fidelity surfaces

- Fonts and typography: existing display and body families and weights are preserved; title size is 30px at compact widths and 36px from the small breakpoint upward.
- Spacing and layout rhythm: the title/subtitle gap is 4px; the header bottom padding is 12px compact and 16px from the small breakpoint upward.
- Colors and tokens: existing heading, muted-copy, divider, background, and orange step-label tokens are unchanged.
- Image quality and assets: no images or assets were modified.
- Copy and content: the previously shortened 57–92 character subtitles are unchanged.
- Icons: no icon or control changed in this iteration.
- Responsiveness: the hierarchy remains vertical at every width; copy occupies the available width and wraps naturally only when required.
- Accessibility: semantic heading/paragraph order is preserved and no text is truncated or hidden.

## Findings

No actionable P0, P1, or P2 mismatch remains.

## Comparison history

- Pass 1: replaced the wide flex row with a compact vertical stack, reduced title size, reduced the title/subtitle gap, removed the subtitle width cap, and retained natural wrapping.
- Post-fix evidence: all six packaged wide screens keep their subtitles on one line; the browser rendering has no overflow or console errors.

## Follow-up polish

No required P3 follow-up.

final result: passed

# ModelPrep platform comparison design QA

## Target

- Source visual: `/Users/alex/.codex/visualizations/2026/08/22/01a02b0f-850d-7933-8e36-94fde7812eda/modelprep-design-comparison/07-relay-a-matrix.png`
- Source size: 1827 x 1324 pixels
- Implementation route: `http://127.0.0.1:4174/`
- Intended state: Sample project, Platforms step, comparison matrix collapsed
- Intended desktop viewport: 1440 x 900 CSS pixels at 1x density
- Intended narrow viewport: 800 x 900 CSS pixels at 1x density

## Implementation checks

| Check | Result | Evidence |
| --- | --- | --- |
| Five-step structure stays intact | Passed | Images continues to Platforms. Platforms is step 4. Publish is step 5. |
| Comparison fields stay visible | Passed in component tests | Platform, native category, native licence, requested outcome, readiness, evidence, and issues render for all ten destinations. |
| Existing editor remains authoritative | Passed in interaction tests | Selecting a matrix row opens the existing `PlatformCard`. |
| Readiness keeps one authority | Passed in source review | Rows use `platformPreflight`, `publishBlockers`, and `destinationReadinessSummary`. |
| Unknown is not labelled Ready | Passed in component tests | Unknown rows show `Local checks pass` plus `Unknown`, not `Ready`. |
| Narrow destination dossier | Passed in source and responsive-rule review | The matrix switches to a focused dossier below 1100 CSS pixels and retains category, licence, outcome, readiness, and evidence. |
| File dependency view | Passed in interaction tests | Files includes an optional Used by destinations view derived from current routing. |
| Production build | Passed | Vite production build completed. |

## Visual comparison

The source reference was inspected at original resolution before implementation. A matched implementation screenshot could not be captured. The in-app browser blocked local page inspection under its URL security policy after the original preview server had stopped. The preview server is running again on port 4174, but the same browser inspection was not retried or moved to another browser surface.

Because the implementation screenshot is missing, spacing, wrapping, density, and responsive appearance are not visually certified in this pass.

## Iteration history

1. Built the desktop matrix using the reference hierarchy, with ModelPrep's existing tokens and platform marks.
2. Replaced the old stacked overview with row selection that opens the current platform editor.
3. Added a narrow dossier that keeps the important mapping fields visible.
4. Added focused component and interaction tests, then fixed the old Connect and Reconnect action inside the matrix.
5. Attempted live visual comparison. Browser inspection was blocked before an implementation screenshot could be captured.

## Remaining severity

- P0: none found by build or interaction tests.
- P1: live visual comparison is blocked, so visible layout regressions remain unassessed.
- P2: the production build still reports its existing large-chunk warning.

final result: blocked
