# ModelPrep renderer

React + Vite renderer used by the hosted demo and bundled inside the Electron
desktop app.

For current implementation status and continuation, read
[`../backend/docs/modelprep-current-handoff-2026-08-01.md`](../backend/docs/modelprep-current-handoff-2026-08-01.md).

## Current role

The renderer owns:

- the six-step project workflow;
- file/media/profile project state and autosave/restore;
- shared title, description, tags, category, license, and print fields;
- platform-specific transforms and option panels for ten direct targets;
- Settings, opaque account markers, status and Reconnect UI;
- preflight, individual publishing, four-at-a-time desktop batch scheduling, and
  isolated receipts;
- failed-only retry and privacy-safe aggregate resource reports;
- simulation-only Demo and explicit Real Upload Test fixtures;
- responsive layout and visible development build timestamp.

The renderer does **not** own raw desktop credentials. Cookies, passwords,
bearer tokens, CSRF values, and signed-storage credentials stay in Electron
main. The renderer calls a minimal preload bridge and uses opaque account ids.

## Ten direct targets

MakerWorld, Printables, Cults3D, MyMiniFactory, Nexprint, Creality Cloud,
MakerOnline, MakerRoad, Thangs, and Thingiverse are represented in Settings,
Platforms, preflight, Publish, and batch receipts.

The hosted web build cannot reuse Electron's isolated account partitions. It can
use supported Worker/browser fallbacks where implemented, but the complete
direct publishing product is the desktop app.

## Local development and verification

```bash
cd /Users/alex/modelprep/deploy
npm install
npm run dev       # http://localhost:5173
npm test
npm run build
npm run preview   # http://localhost:4173
```

Point local development at a Worker with `deploy/.env.local`:

```text
VITE_WORKER_URL=http://localhost:8787
```

Current automated baseline on 2026-08-02: 37 test files and 173 tests pass. The
former `NexprintOptions` missing-key warning is fixed and regression-covered.

## Packaged renderer pairing

Packaged builds embed `deploy/dist` into the `.app`, preventing hosted/preload
version skew. Build and run the canonical local app from the repo root:

```bash
./script/build_and_run.sh --verify
```

Use `/Users/alex/modelprep/desktop/dist/mac-arm64/ModelPrep.app`, not a stale
copy under `/Applications`. Never use a respawning `launchctl submit` job for QA.

## Hosted deployment

The GitHub Pages demo is `https://iamdjem.github.io/modelprep/`. Pushes to
`main` that touch `deploy/**` use `.github/workflows/deploy.yml`.

A source edit or local build does not authorize a commit, push, or hosted
deployment. Verify the hosted build separately from the packaged app.

## Source map

- `src/App.jsx`: workflow, platform definitions/options, preflight, upload flows,
  Settings and receipts.
- `src/lib/accounts.js`: multi-account store and opaque desktop markers.
- `src/lib/batch-publish.js`: batch isolation/concurrency.
- `src/lib/<platform>*.js`: per-platform renderer payload/transport helpers.
- `public/demo/`: bundled simulation/real-test fixture assets.
- `vite.config.js`: renderer build marker and bundling.

## Safety rules

- Demo is simulation-only until the user explicitly creates a real test copy.
- Loading Real Upload Test must never upload; only the explicit action mutates.
- Safe defaults are private, secret, or unpublished draft.
- Public publication must remain explicit.
- Do not restore guessed Printables/Cults crop or count limits.
- Printables rich-description images have a separate proven 8 MiB limit; its
  gallery count, per-gallery-image bytes and fixed aspect ratio remain unknown.
- Every successful mutation needs platform id/status/readback evidence; a submit
  response alone is not certification.
