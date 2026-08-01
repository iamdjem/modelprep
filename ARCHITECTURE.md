# ModelPrep architecture

Current as of 2026-08-01. For implementation status and continuation, read
[`backend/docs/modelprep-current-handoff-2026-08-01.md`](backend/docs/modelprep-current-handoff-2026-08-01.md).

## Product flow

ModelPrep imports model files, images/videos, profiles, documentation, and shared
listing metadata once. The renderer transforms that source into ten
platform-specific packages, runs preflight, and coordinates private/draft-first
publishing with isolated receipts.

```text
Files -> Details -> Media -> Profiles -> Platforms -> Preflight/Publish
                                      |
                                      +-> per-platform taxonomy, license,
                                          visibility, file/media roles,
                                          optional fields and validation
```

## Runtime pieces

| Area | Responsibility |
|---|---|
| `deploy/` | React/Vite renderer, project state, shared-field propagation, platform options, preflight, batch scheduler, receipts, Settings and opaque account markers |
| `desktop/` | Electron shell, isolated persistent sessions, encrypted recovery, login/reconnect windows, allow-listed IPC, direct platform adapters, signed-storage uploads and packaged renderer |
| `backend/` | Cloudflare Worker hosted-web fallback plus shared MakerWorld/Printables/Cults adapters and validation |
| `cdn/` | Legacy/fallback staged-file delivery for older Worker flows |

The packaged `.app` ships the renderer it was built with. The hosted GitHub Pages
renderer is used by the web demo and unpackaged fallback, but cannot read another
site's authenticated browser session.

## Desktop trust boundary

```text
React renderer
  | opaque account id + safe identity + virtual /api/v1/<platform>/web/* request
  v
preload allow-list
  v
Electron main
  | encrypted safeStorage + persist:<platform> partition
  | direct first-party API / signed storage
  v
platform
```

Passwords, tokens, cookies, CSRF fields, storage credentials, and full browser
state stay in Electron main. The renderer stores only opaque desktop markers.
Every virtual route is prefix-validated before dispatch. Platform adapters live
in `desktop/*-direct.js`; shared or hosted fallbacks live in
`backend/src/adapters/`.

## Ten direct publishers

MakerWorld, Printables, Cults3D, MyMiniFactory, Nexprint, Creality Cloud,
MakerOnline, MakerRoad, Thangs, and Thingiverse are wired through Settings,
Platforms, preflight, individual Publish, and one-click batch receipts.

Batch publishing runs at most two desktop flows concurrently, keeps each
platform's request ordering, and does not stop unaffected destinations after one
failure. Browser fallback is serial. Safe defaults are private, secret, or
unpublished draft; public publication remains explicit.

## Session lifecycle

Each platform has a dedicated `persist:<platform>` partition and encrypted
recovery state. Startup and Reconnect validate server identity, attempt silent
recovery/rotation, then open the isolated sign-in window only when required.
Chrome login is unrelated to these partitions.

Platform-specific session contracts and known failures are documented in
`desktop/README.md`, `backend/docs/desktop-live-upload-testing.md`, and each
`backend/docs/*-web-flow.md`.

## Hosted fallback and deployment

- Frontend: GitHub Pages from `deploy/`.
- Worker: Cloudflare Worker from `backend/`; deployment is manual.
- CDN: Cloudflare Pages/R2 fallback from `cdn/`; deployment is manual.
- Desktop: Electron Builder from `desktop/`; local QA artifact is
  `desktop/dist/mac-arm64/ModelPrep.app`.

Do not confuse local source/test success, a signed QA app, a notarized release,
hosted deployment, and account-backed live certification. They are separate
evidence layers.

## Verification

```bash
cd deploy && npm test && npm run build
cd ../backend && npm test && npm run typecheck
cd ../desktop && npm test
cd .. && ./script/build_and_run.sh --verify
git diff --check
```

For live testing rules and process cleanup, use
`backend/docs/desktop-live-upload-testing.md`. Never use a respawning
`launchctl submit` job for packaged QA.
