# HANDOFF — pick up here

You're the next agent (or future-self) picking up the ModelPrep project. This file is the **one place to start** — read this, then dive in.

Last updated: 2026-05-26 (after the Cults3D web-flow Phase A/B/C/D ship + repo move).

---

## TL;DR

ModelPrep is in production. Live at https://iamdjem.github.io/modelprep/. End-to-end one-click publish to Cults3D works for real creators using real accounts (web flow, not GraphQL — Cults's GraphQL is documented but feature-limited; the web flow is reverse-engineered but strictly better).

**Nothing critical is broken.** Everything pending is forward-looking work the user has consciously deferred. You should not need to fix anything to "make it work" — you should be picking the next strategic move.

---

## 60-second orientation

| Where | What |
|---|---|
| Repo | https://github.com/iamdjem/modelprep — monorepo (frontend + backend + CDN) |
| Local | `/Users/alex/modelprep` |
| Frontend | https://iamdjem.github.io/modelprep/ — Vite + React, auto-deploys on push to `main` when `deploy/**` changes |
| Worker (backend) | `modelprep-backend.iamdjem.workers.dev` — Cloudflare Worker, deploy manually (`cd backend && npx wrangler deploy`) |
| CDN (legacy/backup) | `cdn.makerstats.io` — Cloudflare Pages serving R2; only used by the GraphQL backup flow, not by the active web flow |
| Cults test account | email + password in `backend/.dev.vars` (gitignored). It's a throwaway test account; treat it as such. |

**Read these BEFORE editing code:**

1. `ARCHITECTURE.md` — system overview, diagram, deploy map. The single source of truth.
2. `backend/docs/cults3d-web-flow.md` — deep reference for the web flow (12+ documented gotchas, full request sequences, how to recover when Cults breaks something).
3. `backend/docs/graphql-flow-and-cdn-backup.md` — sister doc for the older GraphQL flow + R2 + CDN, kept as disaster-recovery backup.
4. `docs/distribution-plan.md` — forward-looking thoughts about sharing publicly. Not implemented.

If you find yourself re-debugging a Cults endpoint, **read those docs first** — most of what you'd hit is already documented.

---

## What's DONE (production)

### Cults3D integration (web flow)

- Reverse-engineered the cults3d.com upload form. Adapter is `backend/src/adapters/cults3d-web.ts`.
- Six functions: `cultsWebLogin`, `cultsWebUploadFile`, `cultsWebCreateCreation`, `cultsWebPublishPrice`, `cultsWebUnpublish` (soft), `cultsWebDelete` (hard), `cultsWebListMyCreations` (scrape My Designs).
- Worker routes: `POST /api/v1/cults3d/web/{publish|unpublish|delete}` + `GET /api/v1/cults3d/web/my-creations`.
- Files upload directly to Cults's own S3 (no need for `cdn.makerstats.io`); tags work as plain text; secret/public visibility supported; permanent delete supported.
- Auto-deactivates orphan drafts on publish/price failure so failed publishes don't leave clutter on user accounts.
- Frontend: `CultsUploadFlow` in `deploy/src/App.jsx`. Connect form takes email + password; per-publish visibility toggle (defaults to "secret" for safety); done-state shows design URL + slug + Deactivate button. "My listings on Cults" panel inside the connected state shows all the user's listings with per-row Open/Deactivate/Delete buttons.

### Cults3D integration (GraphQL flow) — kept as backup

- `backend/src/adapters/cults3d.ts` + `cults3d-mappings.ts` (mappings are shared with web flow — don't delete).
- Route `POST /api/v1/cults3d/publish` (JSON body with URLs).
- Requires R2 staging (`POST /api/v1/upload`) + `cdn.makerstats.io` because Cults's cover-image fetcher denies `*.workers.dev` / `*.r2.dev` / `*.pages.dev`.
- **Not currently used by the frontend**, but deployed + verified working. See `backend/docs/graphql-flow-and-cdn-backup.md` for how to switch back if the web flow ever dies.

### Infrastructure

- Monorepo migration from three separate folders to `iamdjem/modelprep`; full git history preserved under `deploy/` via filter-repo.
- R2 lifecycle: `staging/` prefix auto-expires after 48h.
- CORS locked to `localhost:5173|4173` + `iamdjem.github.io`.
- GitHub Pages auto-deploy via `.github/workflows/deploy.yml` (frontend only; backend + CDN deploy via manual `wrangler` commands — no `CF_API_TOKEN` in repo secrets).
- Predecessor repo `iamdjem/modelprep-prototype` archived with README redirect.

### Documentation

- `ARCHITECTURE.md` updated to reflect monorepo + both Cults flows.
- `backend/docs/cults3d-web-flow.md` written: 500+ lines, every gotcha, full request sequences, recovery playbook.
- `backend/docs/graphql-flow-and-cdn-backup.md` written: covers what the GraphQL/CDN backup path is, why it exists, how to switch back.
- `docs/distribution-plan.md`: tiered recommendation for sharing publicly.
- Per-piece READMEs (`backend/README.md`, `cdn/README.md`, `deploy/README.md`).

---

## What's PENDING (consciously deferred — pick one to work on)

### 1. Distribution polish (the user has explicitly considered + paused)

**Scope:** ~30 min total. Three small additions before sharing the live URL beyond a few trusted creators.

- Add a privacy line to the Connect form explaining what we do with the password (1 paragraph). Right now the UI just shows password fields with no disclosure.
- Add a kill switch: `WEB_FLOW_DISABLED=1` env var on the Worker that returns 503 with a friendly message. Lets you pause publishing without redeploying when Cults breaks something or you need maintenance.
- Replace the dev-mode footer text ("cd backend && npm run dev in the modelprep monorepo") in `deploy/src/App.jsx` with a creator-friendly link (open-source repo / how it works / contact).

**Why not yet:** the user wanted to share with 1-2 trusted creators first to see if it works at all before polishing. Open question: have those creators provided feedback yet? If yes, polish next. If still pending verification, hold off.

**Where:** `deploy/src/App.jsx` `CultsUploadFlow` component for the UI changes; `backend/src/index.ts` for the kill switch.

**Detailed reasoning:** [`docs/distribution-plan.md`](docs/distribution-plan.md)

### 2. MakerWorld integration — NOW SUBSTANTIALLY BUILT (2026-06-20)

**Status update:** No longer "pending" — the MakerWorld web-flow was reverse-engineered,
implemented, and largely live-validated. **See [`backend/docs/makerworld-HANDOFF.md`](backend/docs/makerworld-HANDOFF.md)**
for the full handoff (what's built, learned, fixed, what remains) and
[`backend/docs/makerworld-web-flow.md`](backend/docs/makerworld-web-flow.md) for the API reference.

Built: adapter `backend/src/adapters/makerworld-web.ts` (upload→create→update→submit→delete,
both STL + .3mf paths, BOM, remix/related linking, CyberBrick, Laser&Cut `draft2d` flow, token
refresh, catalog), Worker routes `/api/v1/makerworld/web/*`, a `MakerWorldUploadFlow` UI in
`deploy/src/App.jsx`, a bundled BOM catalog `deploy/src/data/makerworld-bom-catalog.json`, and
a refresh script `backend/scripts/harvest-bom-catalog.mjs`. Auth = user-supplied session cookie
(HttpOnly → paste/extension). Capture kit lives at `/Users/alex/makerworld-capture/` (gitignored).

Remaining (see the MakerWorld handoff): expand the UI (BOM picker etc.), deploy the Worker,
production connect UX, and finish/verify niche flows (real 3mf publish, LC publish, CyberBrick).

**(Original notes below, kept for context.)** Same web-flow pattern as Cults.

**What's needed:**

1. Capture: log in to MakerWorld with a throwaway account, do one complete upload (with tag autocomplete triggered), then one delete. Save sanitized HAR + per-request files at `/Users/alex/MakerStats-Android/output/makerworld-capture/` matching the structure of the prior Cults capture.
2. Adapter: `backend/src/adapters/makerworld-web.ts` mirroring `cults3d-web.ts`. Functions: login, upload, create, publish, unpublish/delete, list-my-creations.
3. Worker routes: `POST /api/v1/makerworld/web/{publish|unpublish|delete}` + `GET /api/v1/makerworld/web/my-creations`.
4. Frontend: add MakerWorld card to the platform list (probably mirror `CultsUploadFlow` as `MakerWorldUploadFlow`).

**Specific things to look for during the capture** (these matter):

- Auth scheme — JWT/Bearer or session cookie?
- Bot protection — hCaptcha / Turnstile? If so, automation in a serverless Worker may be infeasible.
- Tag autocomplete API — critical, we missed the equivalent on Cults and ended up unable to sync tags via GraphQL (we later wired it via web flow).
- File upload mechanism — single multipart, chunked, signed S3-like? Test with a few-MB file so chunking (if any) kicks in.
- Categories — static `<select>` or separate XHR? Integer IDs or Relay base64?

**Reference:** the Cults equivalent at `backend/docs/cults3d-web-flow.md` shows the level of documentation a successful MakerWorld capture should support.

### 3. Other platforms (Thingiverse, Printables, MMF, Thangs)

**Scope:** ~1 session each.

- **Thingiverse**: has a public REST API with OAuth — different shape than Cults web flow. Documented at https://www.thingiverse.com/developers/.
- **Printables**: limited public API; upload requires web flow.
- **MyMiniFactory (MMF)**: has an API; check current docs.
- **Thangs**: smaller community; lowest priority.

**Strategic note:** the user has been clear they don't want to speculatively build these before getting feedback on whichever 1-2 platforms ship first. Get MakerWorld + Cults real-user feedback before starting any of these.

### 4. AI description helper

**Scope:** ~1 session. Vision LLM (Claude / GPT-4V / similar) takes the cover image + project state, returns suggested title/description/tags. Self-contained — doesn't depend on any platform integration. Could be a real differentiator.

**Status:** not started. Worth doing if user wants a "wow" feature for early creator feedback.

### 5. Memory portability (small, optional)

Agent-side memory is currently at `/Users/alex/.claude/projects/-Users-alex-Downloads-files--2-/memory/` because that's the directory the Claude Code session was launched from originally. When a new session is launched from `/Users/alex/modelprep` (the repo's new location), it'll get a fresh empty memory dir (`-Users-alex-modelprep`) and won't auto-load the project notes.

**Two options:**

- Copy the 7 memory files to `/Users/alex/.claude/projects/-Users-alex-modelprep/memory/` so future sessions started from the new path pick them up.
- Do nothing — next session re-reads `ARCHITECTURE.md` + `backend/docs/cults3d-web-flow.md` and gets the same context from scratch.

User has not chosen. Either works.

---

## Things to be careful about

### When editing `backend/src/adapters/cults3d-web.ts`

Read `backend/docs/cults3d-web-flow.md` first. 12+ documented gotchas explain why specific lines are the way they are. Examples:

- The login URL has a HYPHEN (`/en/users/sign-in`), not underscore (`/en/users/sign_in` — that 404s).
- Login redirect is 303, not 302. Accept both.
- The S3 policy response is FLAT — no `{url, fields}` wrapper.
- S3 POST policy requires a `Content-Type` form field even when empty.
- Rails array fields need an empty leader: `creation[usages][]=&creation[usages][]=3dp`.
- Pricing enum is `free|priced|open_priced`, NOT `free|paid|open`.

### When adding a new request header from the frontend

Update `Access-Control-Allow-Headers` in `backend/src/index.ts` too. Otherwise the browser blocks the preflight and the fetch fails with "Failed to fetch" client-side, with nothing inbound on `wrangler tail`. This is the most common recurring trap.

### When changing the publish payload shape

The frontend sends platform-neutral fields (`category`, `license`, `free`, `price`, `tags`); the Worker maps to Cults-specific IDs in `backend/src/adapters/cults3d-mappings.ts`. Both flows reuse this mapping. If you change the mapping, both flows are affected.

### When deploying

```bash
cd /Users/alex/modelprep
cd backend && npx wrangler deploy      # Worker — manual, no auto-deploy
cd cdn && npx wrangler pages deploy public --project-name=modelprep-cdn --branch=main  # CDN — manual
git push origin main                    # Frontend — auto-deploys via GH Actions if deploy/** changed
```

No staging environment, no rollback. Verify with `wrangler tail` for live logs.

---

## Operational state

- Repo: clean working tree, on `main`, in sync with `origin/main`.
- Last commit: `fea1a60` "cultsWebLogin: distinguish unconfirmed-email vs not-authenticated vs unknown redirect".
- Worker, frontend, CDN: all deployed, all in sync with `main`.
- Test account: a throwaway Cults account exists with creds in `backend/.dev.vars`. Email confirmation done.
- No known bugs. No active fires.

---

## How to verify everything still works (~3 min)

```bash
# 1. Worker liveness
curl https://modelprep-backend.iamdjem.workers.dev/api/v1/health

# 2. Web-flow auth + my-creations (need test account creds from .dev.vars)
curl https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/my-creations \
  -H "X-Cults-Email: <email>" \
  -H "X-Cults-Password: <password>"

# 3. Frontend bundle has the latest commit baked in
curl -s https://iamdjem.github.io/modelprep/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'
# Compare to dist/assets/ in the last successful GH Actions run

# 4. (Optional) Full publish smoke test — would create a real OFFLINE listing
# Use the curl recipe in backend/docs/cults3d-web-flow.md "How to verify it's still working"
```

If any of those fail, look at `wrangler tail` and the docs first. Most failure modes are documented.

---

## When you change the code, change the docs in the same commit

This is a hard rule from the user (memory ref: `modelprep-docs-policy`). Specifically:

- Changes to `backend/src/adapters/cults3d-web.ts` → update `backend/docs/cults3d-web-flow.md` in the same commit
- Changes to routes / file layout / deploy steps → update `ARCHITECTURE.md` + relevant README
- New gotchas discovered during debugging → add to the gotchas list (it's the most valuable section of the doc)
- New strategic decisions → consider whether `docs/distribution-plan.md` needs revisiting

The user has emphasized: "don't 'docs later', always in the same commit."
