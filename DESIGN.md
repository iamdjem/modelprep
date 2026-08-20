# ModelPrep design system

The whole renderer runs on this. Tokens live in `GlobalStyles` inside
`deploy/src/App.jsx` as `:root` variables; older names like `--accent` are aliases kept
for code that has not been touched yet. The standalone prototype that started it is
still at `deploy/prototype.html` (run the deploy dev server and open `/prototype.html`),
with its own copy of the tokens in `deploy/src/prototype/tokens.css`. The prototype is
history now, not the source of truth: when the two disagree, App.jsx wins.

Most rules below were written before the app was built. The ones marked with a screen
name are the ones a real screen has since proved or corrected.

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

The wizard sidebar ("phase 01 of 04") became a plain project sidebar. What shipped:

- Six rows, named for what they hold: Files, Details, Images, Profiles, Platforms,
  Publish. Each carries live status at the right edge (file count, checkmark, 6/10)
  instead of a step number, so it reads as a checklist you can enter in any order.
- Settings is a panel on the right edge rather than a modal, and a "Connect X" button
  opens that one platform rather than the whole list.

Still only a plan: the project switcher and search (⌘K), and a Workspace group holding
a Library. A library is the piece the flow most obviously lacks; Templates were removed
in favour of duplicating a project, and nothing offers that yet.
- Top bar: the brand sits over the sidebar column, the same width as it and divided by
  the same border, so the two read as one rail rather than a logo floating inside a nav.
  The collapse control lives at the bottom of that block, at the seam it actually moves,
  as a 32px circle. Then the project name as a real button (bordered, chevron, wide
  enough not to crop), overall readiness, and one persistent "Review and publish".
- **One edge, unbroken.** The brand rail's divider, the sidebar's border and the two
  bottom bars are the same line. That means the header shares the content row's max
  width and centring, the rail cancels the row's padding so its divider runs the full
  height of the bar, and the sidebar's status bar and the step's Back/Next bar are both
  64px so their rules meet the divider at one point. A notice belongs in the content
  column: a full-width strip under the top bar cuts the rail and pushes the sidebar
  down.
- Sidebar rows are click targets first: 20px icon, 15px label, 12px of padding, 8px
  radius, 4px apart, 256px expanded and 88px collapsed. Sized to match the MakerStats
  desktop rail, which is the same shape of navigation.
- The old bottom status bar is gone; its content lives in the nav statuses and top bar.

## Screen layout: when two columns are allowed

Two columns cost attention, so they have to buy something back. The test is whether the
panes are used at the same moment.

- **Single focused column** is the default for forms and anything read in sequence:
  one flow in task order, capped around `max-w-3xl` so lines stay readable on a wide
  display. Fields that belong together (width and height) pair up in a `sm:grid-cols-2`
  row inside that column. Profiles and Publish use this.
- **Content plus a metadata rail** is the shape for an editor: one long-form field the
  screen is about, and short fields that classify it. Details uses it, because you pick
  the category and type tags with the description in front of you. The main column
  takes the remaining width, the rail is a fixed 340 px, the pair collapses to one
  column below `lg`, and the whole grid caps at `max-w-6xl` so the description does not
  stretch to unreadable line lengths on a wide display. The rail does not scroll
  independently and is not sticky: you fill it, you do not consult it.
- **Every field opens with the same header row.** One 28 px row holding the label, plus
  whatever sits at its right edge (a character counter, a segmented control), then 8 px
  to the control. Without it a plain label carrying its own margin puts one column's
  control a few pixels above its neighbour's, and the two columns stop reading as a
  grid. Keep hint text out of the first field of a column: two lines of it knock every
  row below out of step with the other side.
- **A control that only ever holds one of a fixed list is a select**, not a card with a
  chooser behind it.
- **Open the thing that was asked for.** A button that names one platform opens that
  platform, not the list it belongs to. "Connect Printables" used to open the whole
  Accounts list at the top, nine sign-ins above the one you wanted. The list is still
  one click away, at the bottom of the focused panel.
- **A panel on an edge, not a dialog in the middle**, for anything with sections or
  anything you open mid-task. Settings is one: full viewport height, fixed width, only
  its body scrolls, so every section is the same size and the tab strip never moves
  under the pointer. A centred dialog sized to its content resizes and re-centres each
  time you switch section. It also keeps the screen you came from visible, which is what
  you want when you connect an account halfway through publishing. Details' licence field was a card, a Change button, five filter
  chips and a scrolling list, all inside half a row: every filter click resized it and
  moved the fields below. Eight options in a grouped `<select>` say the same thing and
  cannot shift the page.
- **List plus detail** is allowed only when you pick on one side while working on the
  other, and only when the list is worth a permanent column. A rail that is usually
  empty (Profiles, which normally holds one profile) becomes a selector that appears
  only when there is a choice.
- **Filmstrip plus canvas** beats list-plus-detail when the items are visual and their
  order is horizontal. Gallery images use it: bigger thumbnails, order that reads
  left-to-right with matching arrows, and a full-width editor.
- **Tables** for tabular data (Files), **single-column rows** for a list of the same
  kind of thing (Destinations). Neither needs a companion pane.
- Sticky side rails are reserved for things you refer to *while* acting. A checklist you
  read once before acting (preflight) belongs in the flow, not pinned beside it.

## Component vocabulary

Buttons (primary, secondary, ghost, danger, small, disabled), inputs with hint and error
lines below the field, selects, tag input, switches, segmented control, badges (neutral and
semantic), cards, tables with hover rows, progress bars, skeletons, kbd. Every interactive
class in `tokens.css` defines default, hover, focus-visible, active, and disabled.

## Rules

- No raw hex in screens; platform brand dots are the one exception.
- Inline colour is `backgroundColor`, never the `background` shorthand, and hover is a
  class rather than a style mutation. React writing the shorthand leaves a serialization
  jsdom cannot re-parse, which crashes any test that clones the node.
- **Three severities, not two.** A blocker is red, counted, and shown once at the
  platform that owns it. An adaptation is something ModelPrep does by itself: collapsed,
  quiet, never colours a card. An optional gap is invisible outside that platform's own
  panel. Nothing that is not a problem may look like one.
- An empty project says one thing ("Add files to get started"), not the same missing
  title once per platform.
- Empty states teach (the Files dropzone says what formats it takes).
- Blocked and skipped platforms are always visible in the queue with the reason, and
  nothing uploads while a publish-time confirmation is outstanding.
- Straight quotes, sentence case, no em dashes, in interface copy as much as in prose.
  Name the screen a user can see, never "step 03".
