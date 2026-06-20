# ModelPrep — MakerWorld Connect (browser extension)

One-click "Connect MakerWorld" for ModelPrep. Replaces the manual cookie-paste.

## Why an extension (and not an in-app login)

MakerWorld is behind **Bambu SSO + Cloudflare bot-protection**, so ModelPrep **cannot log
in server-side** the way it does for Cults3D. And a normal web page is **forbidden by the
browser** from reading the MakerWorld session cookie (it's `HttpOnly`). A browser extension
*is* allowed to read it. So the extension reads the user's already-logged-in MakerWorld
session and hands it to ModelPrep — the same cookie the paste box wants, but in one click.

It sends nothing to any third party: it only writes the cookie into ModelPrep's own
`localStorage` (key `modelprep:makerworld-cookie`) in the user's browser.

## Install (unpacked, for now)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** → select this `extension/` folder.
4. Pin the **ModelPrep — MakerWorld Connect** icon to the toolbar.

## Use

1. Be logged into **makerworld.com** in the same browser.
2. Open ModelPrep (`https://iamdjem.github.io/modelprep/`).
3. Click the extension icon → **Connect to ModelPrep**.
   - It reads your MakerWorld session, writes it into ModelPrep, and reloads the tab —
     ModelPrep shows **Connected**, no DevTools or copy-paste.
   - If it says "Not logged into MakerWorld", click **Open MakerWorld to log in** first.

## How it works (files)

- `manifest.json` — MV3; permissions `cookies`, `scripting`, `tabs`; host access to
  `makerworld.com` (read the session) + the ModelPrep origins (write its `localStorage`).
- `popup.html` / `popup.js` — reads `token` + `cf_clearance` (+ `refreshToken`) via
  `chrome.cookies`, finds/opens the ModelPrep tab, injects the cookie with
  `chrome.scripting.executeScript`, reloads.
- `icon.png` — toolbar icon.

To support a different ModelPrep URL (e.g. a custom domain), add it to `MODELPREP_URLS`
in `popup.js` and to `host_permissions` in `manifest.json`.

## Publishing to the Chrome Web Store (later)

Zip this folder and submit via the Chrome Web Store Developer Dashboard ($5 one-time dev
fee). Same package works for the Edge Add-ons store. Until then, "Load unpacked" is fine
for you + testers.

## Security notes

- The cookie includes a live MakerWorld session (`token` ≈ 24h). It never leaves the
  user's machine except to ModelPrep's own `localStorage`.
- The extension only activates when the user clicks **Connect** — it does not run in the
  background or read cookies for any other site.
