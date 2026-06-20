# ModelPrep Desktop

The ModelPrep desktop app — wraps the ModelPrep web app and adds a real **in-app
"Sign in to MakerWorld"** that captures your session legitimately. No browser extension,
no copying cookies by hand.

## Why a desktop app (and not the website)

A **website** is forbidden by the browser from reading another site's login session
(same-origin policy + `HttpOnly` cookies), and MakerWorld's Cloudflare blocks server-side
login. A **desktop app** is allowed to: it opens MakerWorld's real login page in an embedded
window, you sign in normally, and the app reads the resulting session and hands it to the
ModelPrep app. Uploads then run through the same Cloudflare Worker as the website.

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
2. Click it → a MakerWorld login window opens. Sign in (and solve any Cloudflare/2FA prompt).
3. The app detects the session (`token` + `cf_clearance`), closes the window, validates it,
   and you're connected — ready to publish. The session is reused next time (no re-login
   until it expires); **disconnect** clears it.

## Files

- `main.js` — Electron main process. Opens the login window with the **same User-Agent the
  Worker uses** (so the `cf_clearance` it earns is valid for the Worker's server-side replay),
  in a persistent session partition; polls for the session cookies; exposes `mw:connect` /
  `mw:status` / `mw:disconnect` over IPC.
- `preload.js` — exposes a minimal `window.modelprepDesktop` API to the web app, which
  feature-detects it to show the one-click sign-in (see `MakerWorldUploadFlow` in
  `deploy/src/App.jsx`).
- `package.json` — Electron + electron-builder config (DMG / NSIS / AppImage targets).

## Build installers (later)

```bash
npm run dist    # electron-builder → DMG (mac) / installer (win) / AppImage (linux)
```

Add an app icon and code-signing before distributing. `icon.png` is a placeholder.

## Notes

- The captured session is stored only in the ModelPrep app's own `localStorage` (key
  `modelprep:makerworld-cookie`) — the same place the website's paste flow stores it.
- If sign-in is rejected after logging in, the session may need the Cloudflare check
  re-solved — click **Sign in to MakerWorld** again.
