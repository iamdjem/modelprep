# ModelPrep design system

Prototype lives at `deploy/prototype.html` (run the deploy dev server and open
`/prototype.html`). Tokens and component classes: `deploy/src/prototype/tokens.css`.
The production app does not use this yet; the prototype exists to evaluate the direction.

## What it replaces

The current UI (paper `#EDE9DE` ground, orange `#FF5722`, Big Shoulders Display uppercase
labels, mono tracked eyebrows, numbered phases, ASCII job-sheet framing). Those are the
saturated AI-industrial defaults and they fight legibility. The replacement is calm and
token-driven, in the register of Mews and Linear.

## Foundations

- **Color.** OKLCH everywhere. Pure white ground `oklch(1 0 0)`. One brand color: moss
  green, hue 120 (`--primary: oklch(0.51 0.115 120)`), used only for primary actions,
  selection, and progress. A second neutral (`--surface-sunken`) carries the sidebar and
  hover states. Semantic roles (success, warning, danger, info) are tints plus a dark ink
  of the same hue; every text-on-tint pairing clears WCAG AA 4.5:1.
- **Typography.** Inter only, weights 400/500/600. Fixed rem-free pixel scale: 12, 13, 14
  (working size), 16, 18, 21, 26. No uppercase tracking, no display font, no mono outside
  real data. Tabular numerals for counts and sizes.
- **Spacing.** 4 px grid. Screen gutter 24 px, card padding 20 px, control height 34 px
  (28 px small).
- **Shape.** Radius 6 (controls), 8 (cards), 12 (large surfaces), pill for badges.
- **Elevation.** Three shadow tokens, all low-opacity ink of the brand hue. Borders do most
  of the separating; shadows are for raised things (menus, modals).
- **Motion.** 140 to 200 ms, ease-out only, state changes only. Reduced-motion collapses to
  instant.
- **Layers.** Semantic z-scale: dropdown 100, sticky 200, backdrop 300, modal 400,
  toast 500, tooltip 600.

## Navigation (the flow rethink)

The wizard sidebar ("phase 01 of 04") becomes a plain project sidebar:

- Top: project switcher, then search (⌘K).
- Prepare group: Package, Listing, Destinations, Publish. Each row carries live status at
  the right edge (file count, checkmark, 6/10, "1 blocked") instead of step numbers, so it
  reads as a checklist you can enter in any order, not a locked wizard.
- Workspace group: Library, Connections, Settings. Connections stops being a modal.
- Top bar: breadcrumb, overall readiness, and one persistent "Review and publish" action.
- The old bottom status bar is gone; its content lives in the nav statuses and top bar.

## Component vocabulary

Buttons (primary, secondary, ghost, danger, small, disabled), inputs with hint and error
lines below the field, selects, tag input, switches, segmented control, badges (neutral and
semantic), cards, tables with hover rows, progress bars, skeletons, kbd. Every interactive
class in `tokens.css` defines default, hover, focus-visible, active, and disabled.

## Rules

- No raw hex in screens; platform brand dots are the one exception.
- Warnings render as a tinted inline panel with an icon, never a side stripe.
- Empty states teach (the Package dropzone says what formats it takes).
- Blocked and skipped destinations are always visible in the queue with the reason.
