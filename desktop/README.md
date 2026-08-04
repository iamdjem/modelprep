# ModelPrep Desktop

The ModelPrep desktop app wraps the web app and adds isolated authentication
and upload transport for **MakerWorld**, **Printables**, **Cults3D**, **Nexprint**,
**Creality Cloud**, **MakerOnline**, **MyMiniFactory**, **MakerRoad**, **Thangs**,
and **Thingiverse**. No
browser extension and no copying Printables cookies by hand.

## Why a desktop app (and not the website)

A **website** is forbidden by the browser from reading another site's login session
(same-origin policy + `HttpOnly` cookies). A **desktop app** can open each
platform's real login page in an embedded, platform-isolated session. The main
process uses that session to call each platform directly from the user's device;
raw cookies never enter the remotely loaded renderer.

## Run it (development)

```bash
cd desktop
npm install     # downloads Electron (~100 MB)
npm start
```

Unpackaged development opens ModelPrep (`https://iamdjem.github.io/modelprep/`)
unless `MODELPREP_URL` points it at a local build. Packaged builds instead ship
their matching renderer inside the `.app`, which prevents a newer hosted page
from running against an older desktop preload/IPC bridge.

For the current account-persistence and real-upload certification procedure,
see `backend/docs/desktop-live-upload-testing.md`.

For the cross-platform implementation ledger, exact remaining branches,
continuation order, critical lessons, and ready-to-paste next-agent prompt, see
`backend/docs/modelprep-current-handoff-2026-08-01.md` and
`backend/docs/NEXT_AGENT_PROMPT.md`.

Before implementing another optional platform branch, also follow
`backend/docs/platform-one-by-one-implementation-playbook.md`.

For an intentional local live-account integration test, the development app
can reuse the installed app's encrypted sessions and origin storage without
copying credentials into the renderer:

```bash
MODELPREP_URL=http://localhost:4173 \
MODELPREP_USER_DATA_DIR="$HOME/Library/Application Support/modelprep-desktop" \
npm start
```

When the override is present, the renderer safely rebuilds any missing account
cards from the encrypted main-process sessions. Only display identities and
opaque account ids cross the preload bridge; cookies, bearer tokens, and
passwords remain in the main process.

`MODELPREP_USER_DATA_DIR` is opt-in; ordinary development runs remain isolated.

## How sign-in works

Every direct platform uses its own persistent Electron browser partition plus
an encrypted `safeStorage` recovery copy. At startup the app silently validates
saved accounts and warms a read-only first-party page when necessary so a site
can rotate sliding session cookies. If recovery succeeds, no window opens. If a
site has actually expired or revoked the session, **Reconnect** is available in
Settings, Platforms, and Publish; it retries silent recovery and only then opens
that platform's isolated sign-in window. Server-controlled session lifetimes
cannot be extended past the platform's own policy.

1. In ModelPrep, go to a project → **MakerWorld** → the connect box shows **Sign in to
   MakerWorld** (the website's cookie-paste is replaced by this button in the app).
2. Click it → a window opens on **makerworld.com**. Click MakerWorld's own **Sign In**
   (top-right) and log in — email/password, or Google/Apple/Facebook (their OAuth popups
   are supported). Solve any Cloudflare/2FA prompt.
3. The app detects the session (`token`/`refreshToken` cookie, matching the MakerStats iOS
   auth check), closes the window, validates it, and you're connected — ready to publish.
   The session is reused next time (no re-login until it expires); **disconnect** clears it.

   (Loading the homepage + using MakerWorld's own Sign In mirrors the MakerStats iOS app —
   there is no standalone `/en/login` page; it 404s.)

For Printables, Settings → Accounts → Printables opens
`printables.com/model/create`. Printables redirects to its real Prusa Account
OAuth/PKCE page as needed, including social-account popups. The app validates
the completed session with a read-only profile query and stores its encrypted
fallback separately from MakerWorld in `persist:printables`.
The native gallery chooser accepts HEIC/HEIF even where Chromium's file input
filter does not; Electron passes only file bytes and safe metadata to the
renderer, which converts HEIC/HEIF to JPEG before upload. Per-G-code controls
cover layer height, nozzle diameter, duration hours, integer weight grams and
exclude-from-total. The adapters strip processed readback's display-only
`printer` field before `modelUpdate`, and SLA input remains id/folder/name/note.
Exact-app specialist draft `1797772` and public model `1797774` passed persisted
readback; `1797774` remains public and deletion requires exact confirmation.

For Cults3D, Settings → Accounts → Cults3D accepts the account credentials in
the renderer only long enough to pass them to Electron main. Electron validates
them directly against Cults, encrypts each account independently with
`safeStorage`, and returns an opaque account ID. Publish/list/deactivate/delete
requests then run from Electron main directly against Cults and its signed S3
upload endpoint. This avoids the Cloudflare Worker subrequest ceiling and keeps
passwords and upload bytes out of the Worker.

For Nexprint, Settings → Accounts → Nexprint opens
`https://www.nexprint.com/en/upload` in `persist:nexprint`. The app captures the
completed ELEGOO/Nexprint session, validates it with the read-only user-data
route, and encrypts a fallback. Uploads use Nexprint's first-party
presign → object PUT → file registration → create/update → read-back sequence
directly from Electron main. Nexprint does not document this as a stable
third-party API, so `backend/docs/nexprint-web-flow.md` records the dated build
fingerprint and live-certification boundary.

For Creality Cloud, Settings → Accounts → Creality Cloud opens the production
create-model page in `persist:creality`. Electron captures `model_token` and
`model_user_id` plus Creality's persisted device id, encrypts the session,
obtains short-lived Aliyun credentials, uploads directly to Creality storage,
then creates and reads back a private model or an explicitly requested public
model. The draft API edits an existing `draftId`; it does not create a new draft.
Creality does not publish a
third-party model-upload API; `backend/docs/creality-web-flow.md` records the
dated DOM, option, request and safety map.

For MakerOnline, Settings → Accounts → MakerOnline opens
`https://www.makeronline.com/en/upload` in `persist:makeronline`. Electron captures
the `mo_access_token` cookie after MakerOnline authenticates it, encrypts the
session, and performs the first-party multipart file upload plus draft/create and
edit-info readback from the user's computer. The renderer sees only the opaque
desktop marker. MakerOnline does not document a public third-party upload API;
`backend/docs/makeronline-web-flow.md` records the dated DOM, full option tree,
file scene map, import workflow, implementation coverage, and certification boundary.

For MyMiniFactory, Settings → Accounts → MyMiniFactory opens
`https://www.myminifactory.com/upload/object` in `persist:myminifactory`.
The current passwordless flow accepts an email address and emailed confirmation
code; its resulting cookies are the authenticated state. Electron validates them
through that same Chromium partition, encrypts a fallback, and keeps the upload form's CSRF token
and folder identifier in main-process memory. Images, presigned object files,
metadata submission, and object read-back run directly from the user's computer.
`backend/docs/myminifactory-web-flow.md` records the dated contract and declaration gate.

For MakerRoad, Electron uses `persist:makeroad`, requires authenticated
`GET /api/user`, and mirrors the `X-Token` login cookie into the first-party
header. The adapter's private Save and required `uploadType=1` edit readback are
live-certified as draft `M2134222528`. Recheck authenticated availability after
outages. Native video remains unmapped; public/review, paid, remix and schedule
are separate branches.

For Thangs, the current site stores its bearer access token in origin local
storage and refresh state in cookies. Electron captures the token only inside
the isolated `persist:thangs` window, encrypts it with `safeStorage`, and
verifies the account against `production-api.thangs.com/users/current`. Do not
restore cookie-only validation or manually set a cross-origin `Referer` in
`session.fetch`; both caused the false `Reconnect needed` state.

For Thingiverse, the complete draft-first/publish adapter is enabled after
written clearance recorded on 2026-08-01. Save Draft remains the safe default;
public publication is a separate explicit action. Exact-app unpublished draft
`7390480` passed upload, create, finalize and persisted readback.

## Files

- `main.js` — Electron main process. Opens the MakerWorld login window with the same
  User-Agent as the shared adapter (so any `cf_clearance` remains valid), polls for
  the session cookies, encrypts sessions with Electron `safeStorage`, and dispatches
  authenticated MakerWorld requests directly from the device. The renderer keeps
  Worker-shaped virtual route names for web/desktop parity, but Electron validates
  and resolves those routes locally; the raw MakerWorld token never reaches the
  remotely loaded renderer or its `localStorage`. It also
  owns the isolated Printables/Prusa OAuth session and injects it only into
  `/api/v1/printables/web/*` renderer requests. On desktop, the main process
  validates those route names and replays the corresponding GraphQL operation
  directly from the user's network, avoiding Printables throttling of
  Cloudflare-to-Cloudflare requests. Cults Worker-shaped renderer requests are
  similarly validated, but are dispatched by `cults-direct.js` straight to
  Cults/S3 with encrypted per-account credentials. Nexprint renderer requests
  are restricted to `/api/v1/nexprint/web/*`; Electron resolves them through
  `nexprint-direct.js` using the encrypted partition session.
  Creality requests are restricted to `/api/v1/creality/web/*` and resolved by
  `creality-direct.js`; its token, user id and Aliyun STS credentials remain in
  Electron main.
  MakerOnline requests are restricted to `/api/v1/makeronline/web/*` and resolved
  by `makeronline-direct.js`; its access token and cookies remain in Electron main.
- `cults-direct.js` — direct Cults login, signed-S3 upload, create, price,
  list, deactivate, and delete transport. It mirrors the Worker's response
  contract so the React flow has one code path for desktop and web fallback.
- `makerworld-direct-entry.ts` — desktop entry point for every MakerWorld route,
  including sign-in, presign/upload, drafts, regular publishing, Laser & Cut,
  status, list, delete, refresh, tags, BOM, and related-model lookup. The desktop
  build bundles it with the shared backend adapter into the generated
  `makerworld-direct.cjs` before start, test, or packaging.
- `printables-direct.js` — direct Printables identity, GraphQL, signed-storage,
  processing poll, draft/public, readback/list/remix/delete transport. It
  normalizes mutation input independently from richer processed readback.
- `nexprint-direct.js` — direct Nexprint identity, taxonomy, activity,
  collection, presign/upload/register, draft/publish, read-back, list, and
  delete transport. The renderer receives normalized file/model records but no
  token or cookie.
- `creality-direct.js` — direct Creality identity, OSS authorization/upload,
  draft/private/public create and read-back transport. Remix/Non-original and
  parsed Print Settings Info are fail-closed until their structured data is
  independently certified.
- `makeronline-direct.js` — direct MakerOnline identity, live category/kit/account
  eligibility, multipart upload, 3MF parse, draft/public save, and edit-info
  readback transport.
- `myminifactory-direct.js` — direct MyMiniFactory identity, image upload,
  presigned object-file upload, URL-encoded metadata submit, and object read-back.
- `preload.js` — exposes a minimal `window.modelprepDesktop` API to the web app, which
  feature-detects it to show the one-click sign-in (see `MakerWorldUploadFlow` in
  `deploy/src/App.jsx`). It also exposes a privacy-safe resource snapshot that
  returns only aggregate publisher counts, process counts, memory, and CPU. The
  bridge does not accept or return platform, account, file, listing, URL,
  request, cookie, or token data.
- `resource-telemetry.js` — bounds and aggregates Electron process metrics for
  the Publish status panel. Samples are diagnostic only and never gate or alter
  upload scheduling. After a batch completes, the renderer applies a second
  allow-list sanitizer, retains at most 10 aggregate reports in local storage,
  and offers a local JSON download for idle/active/completion comparison. These
  reports exclude run, platform, account, file, listing, URL, request, cookie,
  and token data.
- `codex-listing.js` — runs listing generation through the Codex CLI already
  installed on the maker's machine, so photo-based Title/Description/Tags come
  out of their ChatGPT/Codex subscription instead of a metered API key. Only the
  prompt and down-rezzed photos cross the bridge; the ChatGPT credentials stay in
  `$CODEX_HOME` and never reach the renderer or the Worker. Each run is
  `--ignore-user-config --ephemeral -s read-only` in a temp workspace that is
  deleted afterwards, with `--output-schema` pinning the reply to the listing
  JSON the renderer already parses. Browser builds cannot use this provider —
  a web page cannot start a local process — so the AI picker disables it there.
- `claude-listing.js` — the same deal for the Claude Code CLI, so a maker on a Claude
  plan gets photo-based listings without an API key. Claude Code has no image flag:
  it reads photos with its Read tool, so they are written into a temp working
  directory and the prompt names them, with `--allowedTools Read` granting that one
  capability and nothing else. `claude auth status` reports whether the CLI is signed
  in to an account or to a metered key, which is what the panel shows.
- `cli-process.js` — the plumbing both CLI agents share: finding a program on the bare
  PATH a Finder-launched app inherits, running it with a timeout and bounded output,
  writing the photos to disk, and deleting the workspace afterwards. Adding another CLI
  agent is an adapter plus a row in `CLI_AI_AGENTS` in `main.js`.
- `local-ai.js` — detects local model servers (Ollama, LM Studio) and proxies their
  chat calls. Both jobs have to happen in the main process: the renderer is a
  remotely loaded page, so a request to `http://localhost` is cross-origin and the
  server would have to be reconfigured (`OLLAMA_ORIGINS`) before a free local model
  worked at all. Detection keeps only models that can read an image, since every
  listing starts from photos. Every URL is pinned to loopback, so renderer settings
  can never point this bridge at a remote host.
- `main.js` / `preload.js` also expose the native Printables gallery chooser.
  It returns in-memory bytes and safe filename/type/size metadata, never local
  filesystem paths or platform credentials.
- `package.json` — Electron + electron-builder config (DMG / NSIS / AppImage targets).

## Build a signed + notarized macOS release

The app is configured to sign with **Developer ID Application** + **hardened runtime**
(`build/entitlements.mac.plist`) and notarize via an App Store Connect API key. Requires the
Developer ID Application cert in the keychain (Team `UTZ4TVACJS`). Notarization credentials
are passed via env (the `.p8` lives in `~/.appstoreconnect/private_keys/`, never in the repo):

```bash
export APPLE_API_KEY=~/.appstoreconnect/private_keys/AuthKey_52965D335T.p8
export APPLE_API_KEY_ID=52965D335T
export APPLE_API_ISSUER=98eccd7f-e7d0-4a71-91df-08fa462afb61
export APPLE_TEAM_ID=UTZ4TVACJS
npm run dist                      # → dist/ModelPrep-<ver>-arm64.dmg (signed + notarized)
# electron-builder notarizes + staples the .app; staple the DMG too:
xcrun stapler staple "dist/ModelPrep-1.0.0-arm64.dmg"
```

Verify: `spctl -a -t exec -vv dist/mac-arm64/ModelPrep.app` → `accepted / Notarized Developer ID`.

NOTE: a Developer ID Application cert can only be created by the **Account Holder** (Xcode →
Settings → Accounts → Manage Certificates → + → Developer ID Application) — the App Store
Connect API key can notarize but cannot create that cert. Current build is **arm64**; add
`"target": ["dmg"]` per-arch or `--x64`/`--universal` for Intel/universal.

## Notes

- Desktop MakerWorld, Printables, Nexprint, Creality, MakerOnline,
  MyMiniFactory, MakerRoad, Thangs, and Thingiverse sessions and Cults3D
  credentials are encrypted
  under Electron's app data. Requests are restricted to each platform's validated
  `/api/v1/<platform>/web/*` virtual route and dispatched locally; none of these
  desktop upload flows calls the ModelPrep Worker. The renderer stores only opaque
  desktop-managed account markers. The hosted web app keeps the Worker path as a
  browser fallback.
- Email/password is an advanced fallback. It preserves MakerWorld's `tfaKey` through the
  emailed-code step and surfaces CAPTCHA challenges as a prompt to use the MakerWorld window.
- If sign-in is rejected after logging in, the session may need the Cloudflare check
  re-solved — click **Sign in to MakerWorld** again.
- For local packaged QA, use `../script/build_and_run.sh --verify` and the exact
  `dist/mac-arm64/ModelPrep.app`. Verification requires both that bundle's main
  process and renderer. Never create a respawning `launchctl submit` job; stale
  jobs previously interfered with user input.
