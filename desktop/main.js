// ModelPrep desktop (Electron) main process.
//
// Why this app exists: a website cannot read a MakerWorld login session (browser
// same-origin policy + HttpOnly cookies), and MakerWorld's Cloudflare blocks server-side
// login. A desktop app CAN: it opens MakerWorld's real login in an embedded window, the
// user signs in normally, and the app reads the resulting session cookie and hands it to
// the ModelPrep web app — which then drives uploads through the Worker exactly as before.
//
// The captured session is stored ONLY in the ModelPrep app's own localStorage (the app
// already does this for the paste flow); this process just captures + forwards it.

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');

// Must match the User-Agent the Worker replays with (backend/src/adapters/makerworld-web.ts),
// so the cf_clearance the embedded login earns is bound to a UA the Worker also sends.
const WORKER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
// Where the ModelPrep web app lives. Override with MODELPREP_URL for local dev.
const MODELPREP_URL = process.env.MODELPREP_URL || 'https://iamdjem.github.io/modelprep/';
// Load the MakerWorld homepage and let the user click its own "Sign In" — the same
// approach the MakerStats iOS app uses. (There is no /en/login page; it 404s.)
const MW_LOGIN_URL = 'https://makerworld.com/';
const MW_PARTITION = 'persist:makerworld'; // persistent session so cf_clearance survives
const WANT = ['token', 'cf_clearance', 'refreshToken'];

function mwSession() { return session.fromPartition(MW_PARTITION); }

// Read MakerWorld cookies from the embedded session; return the assembled string or null.
// Signed in == `token` OR `refreshToken` present (matches MakerStats iOS's auth check);
// cf_clearance is bundled when present (Cloudflare sets it while browsing) — the Worker
// needs it for server-side replay, but it shouldn't gate login detection.
async function readMwCookie() {
  const cks = await mwSession().cookies.get({ domain: 'makerworld.com' });
  const map = {};
  for (const c of cks) { if (WANT.includes(c.name) && c.value) map[c.name] = c.value; }
  if (!map.token && !map.refreshToken) return null;
  return WANT.filter((n) => map[n]).map((n) => `${n}=${map[n]}`).join('; ');
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 880, backgroundColor: '#f4f3ee',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(MODELPREP_URL);
  return win;
}

// Open MakerWorld's login in a child window; resolve with the cookie once the user is
// signed in (token + cf_clearance present), reject if they close it or it times out.
function openLoginAndCapture(parent) {
  return new Promise((resolve, reject) => {
    const login = new BrowserWindow({
      width: 460, height: 800, parent, modal: false, title: 'Sign in to MakerWorld',
      webPreferences: { partition: MW_PARTITION, contextIsolation: true, nodeIntegration: false },
    });
    login.webContents.setUserAgent(WORKER_UA);
    login.loadURL(MW_LOGIN_URL, { userAgent: WORKER_UA });

    // MakerWorld's social sign-in (Google/Apple/Facebook) uses window.open() popups.
    // Allow them, in a child window sharing the same session + UA, so OAuth completes
    // and writes the session cookie back into our partition (which the poll then sees).
    login.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        parent: login, width: 480, height: 700,
        webPreferences: { partition: MW_PARTITION, contextIsolation: true, nodeIntegration: false },
      },
    }));
    login.webContents.on('did-create-window', (child) => { try { child.webContents.setUserAgent(WORKER_UA); } catch { /* */ } });

    let done = false;
    const finish = (fn, val) => { if (done) return; done = true; clearInterval(poll); clearTimeout(timer); if (!login.isDestroyed()) login.close(); fn(val); };

    const poll = setInterval(async () => {
      try { const cookie = await readMwCookie(); if (cookie) finish(resolve, cookie); } catch { /* keep polling */ }
    }, 1500);
    const timer = setTimeout(() => finish(reject, new Error('Login timed out — please try again.')), 5 * 60 * 1000);
    login.on('closed', () => { if (!done) { done = true; clearInterval(poll); clearTimeout(timer); reject(new Error('Sign-in window was closed.')); } });
  });
}

ipcMain.handle('mw:status', async () => ({ connected: !!(await readMwCookie()) }));

ipcMain.handle('mw:connect', async (evt) => {
  // If a valid session already exists in the embedded browser, reuse it silently.
  const existing = await readMwCookie();
  if (existing) return { ok: true, cookie: existing };
  const parent = BrowserWindow.fromWebContents(evt.sender);
  try { return { ok: true, cookie: await openLoginAndCapture(parent) }; }
  catch (err) { return { ok: false, error: err && err.message ? err.message : String(err) }; }
});

ipcMain.handle('mw:disconnect', async () => {
  // Clear the embedded MakerWorld session so the next connect requires a fresh login.
  await mwSession().clearStorageData({ storages: ['cookies'] });
  return { ok: true };
});

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
