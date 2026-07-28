# ModelPrep Desktop

The ModelPrep desktop app wraps the web app and adds real, isolated sign-in
windows for **MakerWorld** and **Printables**. No browser extension and no
copying Printables cookies by hand.

## Why a desktop app (and not the website)

A **website** is forbidden by the browser from reading another site's login session
(same-origin policy + `HttpOnly` cookies). A **desktop app** can open each
platform's real login page in an embedded, platform-isolated session. The main
process uses that session to broker requests to the ModelPrep Worker; raw
cookies never enter the remotely loaded renderer.

## Run it (development)

```bash
cd desktop
npm install     # downloads Electron (~100 MB)
npm start
```

This opens ModelPrep (`https://iamdjem.github.io/modelprep/`) in a desktop window. To point
it at a local dev build instead: `MODELPREP_URL=http://localhost:5173 npm start`.

## How sign-in works

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

## Files

- `main.js` — Electron main process. Opens the MakerWorld login window with the **same User-Agent the
  Worker uses** (so the `cf_clearance` it earns is valid for the Worker's server-side replay),
  in a persistent session partition; polls for the session cookies; encrypts Worker-issued
  sessions with Electron `safeStorage`; and brokers authenticated Worker requests so the raw
  MakerWorld token never enters the remotely loaded renderer or its `localStorage`. It also
  owns the isolated Printables/Prusa OAuth session and injects it only into
  `/api/v1/printables/web/*` renderer requests. On desktop, the main process
  validates those route names and replays the corresponding GraphQL operation
  directly from the user's network, avoiding Printables throttling of
  Cloudflare-to-Cloudflare requests.
- `preload.js` — exposes a minimal `window.modelprepDesktop` API to the web app, which
  feature-detects it to show the one-click sign-in (see `MakerWorldUploadFlow` in
  `deploy/src/App.jsx`).
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

- Desktop MakerWorld and Printables sessions are encrypted under Electron's app data and
  requests are restricted to their own `/api/v1/<platform>/web/*` path on the configured
  ModelPrep Worker. The renderer stores only opaque desktop-managed account markers. Existing desktop
  `localStorage` sessions migrate into secure storage the next time Settings opens.
- Email/password is an advanced fallback. It preserves MakerWorld's `tfaKey` through the
  emailed-code step and surfaces CAPTCHA challenges as a prompt to use the MakerWorld window.
- If sign-in is rejected after logging in, the session may need the Cloudflare check
  re-solved — click **Sign in to MakerWorld** again.
