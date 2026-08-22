# ModelPrep ten-platform difference matrix (UX view)

> Historical code and UX snapshot from 2026-08-13. Do not use its Top 10 list
> as the current mapping ledger. Shared category and licence mapping changed
> after this file was written. The current native inventory, ModelPrep mapping,
> and independent comparison are:
>
> - `platform-upload-flow-independent-audit-2026-08-22.md`
> - `platform-workflow-mapping-audit-2026-08-22.md`
> - `platform-upload-independent-comparison-2026-08-22.md`

Compiled 2026-08-13 from `backend/docs/platform-upload-requirements-live.md`, `platform-specs.md`,
the ten `*-web-flow.md` docs, `deploy/src/App.jsx` (`PLATFORMS` L439-563, `platformPreflight`
L2890-3187) and `deploy/src/lib/platform-workflow.js` in the `codex/package-workspace-redesign`
worktree. Line references are to that worktree.

Legend for how ModelPrep currently handles each difference:

- **AUTO**: adapted silently, no message anywhere
- **SHOWN**: explained proactively in the UI before Review
- **PRE-W**: surfaced only as a preflight warning (upload proceeds)
- **PRE-E**: preflight blocker
- **DECISION**: explicit per-destination user choice
- **DROP**: discarded with no message at any point

## 1. Description format and length caps

Shared input is one Markdown field; conversion is per-destination.

| Platform | Native format | Cap | Handling |
|---|---|---|---|
| MakerWorld | CKEditor HTML subset (h2-h4, lists, tables, links; no code blocks) | none client-side | md-to-HTML AUTO; Laser & Cut mode has no description field, text discarded (PRE-W) |
| Printables | Tiptap rich HTML + required separate 120-char summary | name 255 | summary auto-derived when not typed (AUTO) |
| Cults3D | Markdown + separate optional `details` field | unknown | passthrough AUTO; `details` is a DECISION |
| MyMiniFactory | restricted rich text (bold/italic/lists/link) | unknown | md-to-HTML AUTO |
| Thingiverse | Markdown summary + details; summary required | none observed | summary NOT auto-derived: hard blocker if empty (PRE-E, L3176) |
| Thangs | markdown | unknown | AUTO |
| Nexprint | rich HTML | 10,000 rendered HTML chars | counted on mdToHtml output (PRE-E L3019) |
| Creality | rich HTML | none observed | AUTO |
| MakerOnline | Quill HTML | 9,000 plain-text chars | counted on mdToPlain output (PRE-E L3087) |
| MakerRoad | rich HTML, required | none observed | AUTO |

Bug: the Adaptations tab (FormatTabs L5862-5880) labels Thingiverse "Plain" and Thangs "HTML"
while `PLATFORMS` declares both markdown. The user-facing explanation and the adapter disagree.

## 2. Title caps and forbidden content

- MakerWorld 50 (strictest) + forbidden-word list over title/description/tags (PRE-E)
- Creality / MakerRoad 60; Nexprint 80; MakerOnline 100; Printables 255
- Cults3D, MyMiniFactory, Thingiverse, Thangs: none declared (deliberately not guessed)
- Details step shows strictest cap across enabled destinations and names the owner, but only
  past 80% of the cap. Forbidden words are MakerWorld-only.

## 3. Tag rules

Shared entry normalizes: lowercase, spaces to hyphens, dedupe, capped at strictest tagMax.

| Platform | Count | Per-tag chars | Character rules | Handling |
|---|---|---|---|---|
| MakerWorld | 50 | 100 | free text | PRE-E count |
| Printables | unknown | 1-25 | a-z0-9 only; whitespace splits; `print-in-place` becomes `printinplace` | PRE-W |
| Cults3D | 20 | - | single 300-char field | PRE-E (check joins with ", " while transport joins with space: slightly stricter than reality) |
| MyMiniFactory | 20 | unknown | leading `#` stripped | PRE-E count |
| Thingiverse | unknown | unknown | spaces normalize to `_` | DROP |
| Thangs | unknown | unknown | dynamic | none |
| Nexprint | 20 | 50 | Unicode/emoji ok | PRE-E both (also double-reports with generic warning) |
| Creality | 20 | 30 | server rewrites/translates tags into Chinese on readback | PRE-E count/length; translation DROP |
| MakerOnline | 20 | 20 (strictest) | Unicode | PRE-E both |
| MakerRoad | unknown | unknown | custom values encoded `#{...}` | none |

## 4. Category / taxonomy

The shared category is a flat 13-label list. The Details copy says "we pick a close match for
each" but NO adapter maps it; 9 of 10 destinations require their own explicit pick and preflight
blocks when missing.

- MakerWorld: dynamic leaf id, 11 groups (PRE-E)
- Printables: GraphQL id, 2 levels (PRE-E)
- Cults3D: integer category + up to 3 subcategories, incl. NSFW branch 28 (PRE-E top level only)
- MyMiniFactory: JSON array carrying the whole path, e.g. [60,462]; native create form has no category control (PRE-E)
- Thingiverse: numeric id from ~80-node tree; store ids, never picker positions (PRE-E)
- Thangs: free category-path string; only destination with no gate
- Nexprint: 43 leaf-only ids; nav levels invalid; fails closed if live tree unavailable (PRE-E)
- Creality: exact API ids; picker position like 12 silently normalizes to uncategorized 0 (PRE-E)
- MakerOnline: 2-level, leaf only (PRE-E)
- MakerRoad: 1-3 categories, the only multi-select (PRE-E range)

## 5. Licenses

Shared list is 7 ids; CC BY-NC-ND is absent although 8 of 10 platforms support it.

| Platform | Mapping from shared license | Exclusive licenses |
|---|---|---|
| MakerWorld | MW_LICENSE_MAP, fallback SDFL | Exclusive, SDFL-CU, SDFL-PPO |
| Printables | PRINTABLES_LICENSE_MAP, fallback '13' | OCL v1.1 family; set filtered by authorship/Store/Club |
| Cults3D | no map, explicit choice required | Cults PU/CU/CU-ND; free/paid class enforced |
| MyMiniFactory | NONE: hardcoded licenseId 5 (CC BY-NC-SA) regardless of choice | MMF Exclusive matrix |
| Thingiverse | NONE: hard default 'cc-nc' | CERN-OHL trio |
| Thangs | NONE: free-text 'CC BY-NC'; live selector unmapped | license file as asset |
| Nexprint | NEXPRINT_LICENSE_MAP, fallback 7 | SDFL |
| Creality | CREALITY_LICENSE_MAP, fallback CXY-SL | CXY-SL |
| MakerOnline | MAKERONLINE_LICENSE_MAP, fallback 3; remix+ND blocked (PRE-E) | SDFL |
| MakerRoad | NONE: licenseIndex 2 | - |

So a shared "CC BY" reaches MMF, Thingiverse, Thangs and MakerRoad as something else with no
message anywhere (DROP). This is the worst silent-correctness issue in the matrix.

## 6. Images

| Platform | Cover | Gallery | Per-image cap | Notes |
|---|---|---|---|---|
| MakerWorld | required 4:3 + optional 3:4 | 16 + covers (17th image PRE-W) | 30 MiB PRE-E | jpg/png/webp/gif |
| Creality | required 4:3 web + 3:4 app | 9 + covers | 20 MiB | |
| Nexprint | fixed 4:3 crop | 1 + 9 | 100 MiB | gallery keeps original aspect |
| Thangs | optional 1:1.22 card crop | unknown | - | +avif/heic |
| MakerRoad | 1:1 recommended | 3-10 both bounds enforced PRE-E | 10 MB | |
| MakerOnline | first = cover | 1-20 (PRE-W) | 30 MB | +heic |
| Printables | first = cover | no cap known | unknown | HEIC converted client-side AUTO |
| Cults3D | first media = cover | unknown | 10 MiB + 8000x8000 PRE-E | +mp4/webm |
| MyMiniFactory | none | unknown | 5 MiB PRE-E | ALL images re-encoded JPEG q90, longest edge 2400px (only noted in Destinations media-treatment panel) |
| Thingiverse | none | unknown | 5 MB documented, not enforced | |

Legacy guessed crops (Printables 4:3/25, Cults 1:1/20) deliberately removed.

## 7. Video

- MakerWorld: 1 MP4/MOV up to 30 s (PRE-E on count/duration)
- Cults3D: MP4/WebM ordered media, 10 MiB, image must be first
- Nexprint/Creality/MakerOnline/MakerRoad/Thingiverse: none (each PRE-W)
- Printables, MyMiniFactory: none, DROP (no warning)
- Thangs: video is a YouTube/Reel URL field, not an upload; ModelPrep has no field (DROP)

## 8. 3MF / print profiles: five different fates

1. Native profile transmitted: MakerWorld (Bambu Studio only, PRE-E on other slicers; profile
   name <=60, photo, real-print confirmation, guidelines) and MakerRoad (<=10 config 3MFs).
2. No profile concept: Printables files 3MF under `stls` (PRE-W).
3. Profile block sent empty: Nexprint `settingList: []`, listing shows "Print Profile (0)" (PRE-W).
4. Parsed config not synthesized: Creality (14 fields ModelPrep cannot produce); 3MF uploads as geometry (PRE-W).
5. Server-side parser: MakerOnline parse-info; skipped for Resin listings (PRE-W).

Cults/MMF/Thingiverse/Thangs treat 3MF as a plain file with no message. Slicer gating is
advisory (suggests role, never excludes). Printables G-code uploads are stored but invisible in
their editor because ModelPrep sends no main-printer grouping (PRE-W).

## 9. Visibility / outcome models

- Unpublished draft: Printables, Nexprint, MakerOnline, Thingiverse
- Private object: MakerWorld, MyMiniFactory (native form defaults to Public; ModelPrep's private is a real safety override), Creality (no new-draft route), Thangs
- Secret unlisted publication (live!): Cults3D
- Review submission only, no draft path: MakerRoad (every save enters review; all tested saves rejected; disabled by default)

Forced review on public: MakerRoad always, MyMiniFactory, Printables (conditional), MakerWorld
(real-photo check). Terms gates at action time: Thingiverse, MakerRoad (PRE-E).
This dimension is the best-handled: platform-workflow.js outcome + evidence labels (SHOWN).

## 10. Special requirements

- Real print photo: MakerRoad PRE-E (warning for demo only); MakerWorld per-profile realPhotoConfirmed PRE-E. Note: the generic MakerWorld real-photo warning at L2925 is unreachable dead code (function returns for MakerWorld at L2891).
- AI disclosure: Printables explicit yes/no PRE-E; MMF declaration PRE-E; Nexprint auto-appends "AI-generated" tag PRE-W; the rest carry booleans.
- NSFW: Cults is a category (28); Thingiverse is the NSFW tag; MakerOnline NSFW blocks China sync PRE-E; MMF/Thangs/Nexprint unmapped.
- Remix: Creality rejects remix entirely PRE-E; MakerOnline bans remix+ND; MakerWorld requires source+license+changes, blocks ND sources; Printables requires parents+differences PRE-E; MMF/Thingiverse/MakerRoad each want different identifier shapes; Thangs inspiration attribution DROP.
- BOM: Nexprint (<=100 rows PRE-E) and MakerWorld only.
- Documentation: MakerWorld 25 guides/10 files; MakerOnline <=50 docs 500 MB PRE-E; MakerRoad <=5 docs 50 MB PRE-E; Nexprint <=100 attachments; Creality instruction files PRE-W.
- Paid: Cults 0.65-1200 USD, license-class coupling PRE-E (USD only; open price/currency/discounts unmapped); Printables Store/Club account-gated; MakerRoad Free/Points/Cash PRE-E; Thangs marketplace PRE-E; MakerOnline Exclusive needs >=20 prints PRE-E; MakerWorld Exclusive terms PRE-E.

## 11. Auth / connect UX

- MakerWorld: in-app email/password (180-day token); GeeTest CAPTCHA can force the desktop window
- Printables: Prusa OAuth + PKCE in isolated partition
- Cults3D: desktop browser window only (Cloudflare blocks non-browser login)
- MyMiniFactory: passwordless email code in isolated Chromium (Node fetch gets Cloudflare 403)
- Thingiverse: OAuth2 / same-page token recovery
- Thangs: browser sign-in, token lifted from localStorage, encrypted
- Nexprint: browser sign-in, encrypted REST session
- Creality: cookie capture + persistent device id + short-lived Aliyun STS
- MakerOnline: raw mo_access_token, no Bearer prefix
- MakerRoad: cookie mirrored to X-Token header; service availability flaky

## 12. Filenames and formats

- Thangs rejects filenames with " / \ : $ # & @ ? * < > % (PRE-E)
- Cults3D fails closed on & < > in filenames, but only inside the transports, after Publish is
  pressed, not in platformPreflight (timing inconsistency)
- Thingiverse narrowest model set (stl/obj/3mf/scad + tail); Thangs 10 mesh/CAD formats, 250 MB
- Printables ~60 extensions incl. gcode/bgcode/sl1/zip (256 MB retained-ZIP cap PRE-E)
- Per-file caps: MakerWorld 200 MiB 3mf; MakerOnline 500 MB; Nexprint 2048 MB; Printables/Cults
  1024 MB; MMF 100 MiB x 500 files; Creality and Thingiverse deliberately uncapped

## Top 10 seams for a user publishing to all ten at once

1. Shared Category does nothing; copy promises mapping; 9 manual pickers demanded at preflight. (Actively misleading)
2. Shared License silently ignored on MMF/Thingiverse/Thangs/MakerRoad (hardcoded defaults). (Not surfaced at all)
3. Tags mutate differently everywhere; Printables warned, Thingiverse and Creality silent.
4. Video silently dropped on Printables/MMF/Thangs; warned on five others.
5. "Draft" means five different things. (Best handled: outcome labels are proactive)
6. One 3MF, five fates; messaging uneven; nothing for Cults/MMF/Thingiverse/Thangs.
7. Image-count rules invert (MakerRoad requires 3-10; others truncate; five unknown); surfaced only at preflight, not in Media.
8. MMF re-encodes every image (JPEG q90, 2400px), buried in a panel; caps are blockers elsewhere.
9. Description caps measured on different renderings (Nexprint rendered HTML vs MakerOnline plain text); Thingiverse summary manual while Printables auto-derives.
10. Remix produces five different outcomes, five separately worded blockers.

Runners-up: Cults filename rule fires only in transport; duplicate tag warnings (generic +
specific) on Nexprint/Creality/MakerOnline; dead MakerWorld preflight code (L2925, L569 branch).
