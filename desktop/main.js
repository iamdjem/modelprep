// ModelPrep desktop (Electron) main process.
//
// Why this app exists: a website cannot read a MakerWorld login session (browser
// same-origin policy + HttpOnly cookies), and MakerWorld's Cloudflare blocks server-side
// login. A desktop app CAN open each platform's real login in an isolated embedded
// session. Raw cookies remain in the main process and an encrypted safeStorage fallback;
// the renderer sees only opaque account markers.

const { app, BrowserWindow, ipcMain, session, shell, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { validateWorkerUrl } = require('./auth-bridge');
const { handlePrintablesRequest, printablesWhoamiDirect } = require('./printables-direct');
const { createPrintablesSessionCache } = require('./printables-session-cache');

// The app renders multiple <canvas> cover previews; GPU-accelerated canvas can crash the
// renderer with EXC_BAD_ACCESS/SIGBUS on some Macs. Software rendering is plenty fast here
// and avoids the crash.
app.disableHardwareAcceleration();

// Must match the User-Agent the Worker replays with (backend/src/adapters/makerworld-web.ts),
// so the cf_clearance the embedded login earns is bound to a UA the Worker also sends.
const WORKER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
// Where the ModelPrep web app lives. Override with MODELPREP_URL for local dev.
const MODELPREP_URL = process.env.MODELPREP_URL || 'https://iamdjem.github.io/modelprep/';
// Load the MakerWorld homepage and let the user click its own "Sign In" — the same
// approach the MakerStats iOS app uses. (There is no /en/login page; it 404s.)
const MW_LOGIN_URL = 'https://makerworld.com/';
const PRINTABLES_LOGIN_URL = 'https://www.printables.com/model/create';
const WORKER_URL = process.env.MODELPREP_WORKER_URL || 'https://modelprep-backend.iamdjem.workers.dev';
const MW_PARTITION = 'persist:makerworld'; // persistent session so cf_clearance survives
const PRINTABLES_PARTITION = 'persist:printables';
const WANT = ['token', 'cf_clearance', 'refreshToken'];
const printablesAuthCache = createPrintablesSessionCache();

function mwSession() { return session.fromPartition(MW_PARTITION); }
function printablesSession() { return session.fromPartition(PRINTABLES_PARTITION); }
function encryptedSessionPath() { return path.join(app.getPath('userData'), 'makerworld-session.bin'); }
function encryptedPrintablesSessionPath() { return path.join(app.getPath('userData'), 'printables-session.bin'); }

async function readEncryptedSession() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = await fs.readFile(encryptedSessionPath());
    return safeStorage.decryptString(encrypted) || null;
  } catch { return null; }
}

async function storeEncryptedSession(cookie) {
  if (!cookie || typeof cookie !== 'string') throw new Error('A MakerWorld session is required.');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this device.');
  await fs.mkdir(path.dirname(encryptedSessionPath()), { recursive: true });
  await fs.writeFile(encryptedSessionPath(), safeStorage.encryptString(cookie), { mode: 0o600 });
}

async function clearEncryptedSession() {
  try { await fs.unlink(encryptedSessionPath()); } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
  }
}

async function readEncryptedPrintablesSession() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = await fs.readFile(encryptedPrintablesSessionPath());
    return safeStorage.decryptString(encrypted) || null;
  } catch { return null; }
}

async function storeEncryptedPrintablesSession(cookie) {
  if (!cookie || typeof cookie !== 'string') throw new Error('A Printables session is required.');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this device.');
  await fs.mkdir(path.dirname(encryptedPrintablesSessionPath()), { recursive: true });
  await fs.writeFile(encryptedPrintablesSessionPath(), safeStorage.encryptString(cookie), { mode: 0o600 });
}

async function clearEncryptedPrintablesSession() {
  try { await fs.unlink(encryptedPrintablesSessionPath()); } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
  }
}

// Read MakerWorld cookies from the embedded session; return the assembled string or null.
// Signed in == `token` OR `refreshToken` present (matches MakerStats iOS's auth check);
// cf_clearance is bundled when present (Cloudflare sets it while browsing) — the Worker
// needs it for server-side replay, but it shouldn't gate login detection.
async function readMwCookie() {
  const cks = await mwSession().cookies.get({ domain: 'makerworld.com' });
  const map = {};
  for (const c of cks) { if (WANT.includes(c.name) && c.value) map[c.name] = c.value; }
  if (map.token || map.refreshToken) {
    return WANT.filter((n) => map[n]).map((n) => `${n}=${map[n]}`).join('; ');
  }
  return readEncryptedSession();
}

async function readPrintablesBrowserCookie() {
  const cookies = await printablesSession().cookies.get({});
  const relevant = cookies.filter((cookie) => {
    const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase();
    return domain === 'printables.com' || domain.endsWith('.printables.com');
  });
  if (!relevant.length) return null;
  return relevant.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function validatePrintablesCookie(cookie) {
  if (!cookie) return null;
  try {
    return await printablesWhoamiDirect(cookie);
  } catch (error) {
    console.error(
      '[printables-auth] direct whoami failed:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function readPrintablesContext({ force = false } = {}) {
  const browserCookie = await readPrintablesBrowserCookie();
  const stored = await readEncryptedPrintablesSession();
  const candidates = [...new Set([browserCookie, stored].filter(Boolean))];
  for (const cookie of candidates) {
    const identity = await printablesAuthCache.validate(
      cookie,
      validatePrintablesCookie,
      { force },
    );
    if (identity) return { cookie, identity };
  }
  return null;
}

async function readPrintablesCookie(options) {
  return (await readPrintablesContext(options))?.cookie ?? null;
}

async function rebuildBody(bodyType, body) {
  if (bodyType === 'none' || body == null) return undefined;
  if (bodyType === 'text') return String(body);
  if (bodyType === 'form-data' && Array.isArray(body)) {
    const form = new FormData();
    for (const entry of body) {
      if (entry?.kind === 'text') form.append(entry.name, String(entry.value ?? ''));
      else if (entry?.kind === 'file') {
        form.append(entry.name, new Blob([entry.bytes], { type: entry.mimeType || 'application/octet-stream' }), entry.fileName || 'upload.bin');
      }
    }
    return form;
  }
  throw new Error('Unsupported desktop MakerWorld request body.');
}

async function workerResponse(res) {
  const headers = {};
  for (const [name, value] of res.headers.entries()) headers[name] = value;
  return { status: res.status, headers, body: await res.text() };
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 880, backgroundColor: '#f4f3ee',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(MODELPREP_URL);

  const isApp = (url) => url.startsWith(MODELPREP_URL) || url.startsWith('http://localhost');
  // External links (the published-model URL, "open upload page", etc.) open in the user's
  // real browser — where they're already signed into MakerWorld — not blank inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url) && !isApp(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  // Same for in-place navigations to an outside site (don't navigate the app away).
  win.webContents.on('will-navigate', (e, url) => {
    if (/^https?:/.test(url) && !isApp(url)) { e.preventDefault(); shell.openExternal(url); }
  });
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

function openPrintablesLoginAndCapture(parent) {
  return new Promise((resolve, reject) => {
    const login = new BrowserWindow({
      width: 720, height: 860, parent, modal: false, title: 'Sign in to Printables',
      webPreferences: {
        partition: PRINTABLES_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    login.loadURL(PRINTABLES_LOGIN_URL);
    login.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        parent: login, width: 560, height: 760,
        webPreferences: {
          partition: PRINTABLES_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
        },
      },
    }));

    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(timer);
      if (!login.isDestroyed()) login.close();
      fn(value);
    };
    const poll = setInterval(async () => {
      try {
        const cookie = await readPrintablesBrowserCookie();
        const identity = await validatePrintablesCookie(cookie);
        if (cookie && identity) finish(resolve, { cookie, identity });
      } catch { /* keep polling while OAuth completes */ }
    }, 1500);
    const timer = setTimeout(
      () => finish(reject, new Error('Printables sign-in timed out — please try again.')),
      5 * 60 * 1000,
    );
    login.on('closed', () => {
      if (!done) {
        done = true;
        clearInterval(poll);
        clearTimeout(timer);
        reject(new Error('Sign-in window was closed.'));
      }
    });
  });
}

ipcMain.handle('mw:status', async () => ({ connected: !!(await readMwCookie()) }));

ipcMain.handle('mw:connect', async (evt) => {
  // If a valid session already exists in the embedded browser, reuse it silently.
  const existing = await readMwCookie();
  if (existing) { await storeEncryptedSession(existing); return { ok: true }; }
  const parent = BrowserWindow.fromWebContents(evt.sender);
  try {
    const cookie = await openLoginAndCapture(parent);
    await storeEncryptedSession(cookie);
    return { ok: true };
  }
  catch (err) { return { ok: false, error: err && err.message ? err.message : String(err) }; }
});

ipcMain.handle('mw:store-session', async (_evt, cookie) => {
  await storeEncryptedSession(cookie);
  return { ok: true };
});

ipcMain.handle('mw:login', async (_evt, payload = {}) => {
  const route = payload.code ? 'login-code' : 'login';
  const body = payload.code
    ? { account: payload.account, code: payload.code, ...(payload.tfaKey ? { tfaKey: payload.tfaKey } : {}) }
    : { account: payload.account, password: payload.password };
  const res = await fetch(`${WORKER_URL}/api/v1/makerworld/web/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.ok && data.cookie) {
    await storeEncryptedSession(data.cookie);
    delete data.cookie;
  }
  return { status: res.status, data };
});

ipcMain.handle('mw:request', async (_evt, request = {}) => {
  const cookie = await readMwCookie();
  if (!cookie) return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'missing_makerworld_session' }) };
  const url = validateWorkerUrl(request.url, WORKER_URL);
  const headers = { ...(request.headers || {}), 'X-MW-Cookie': cookie };
  const res = await fetch(url, {
    method: request.method || 'GET',
    headers,
    body: await rebuildBody(request.bodyType, request.body),
  });
  const result = await workerResponse(res);
  if (res.ok && new URL(url).pathname.endsWith('/refresh')) {
    try {
      const data = JSON.parse(result.body);
      if (data.cookie) {
        await storeEncryptedSession(data.cookie);
        data.cookie = 'desktop-managed-session-v1';
        result.body = JSON.stringify(data);
      }
    } catch { /* return the original response */ }
  }
  return result;
});

ipcMain.handle('mw:disconnect', async () => {
  // Clear the embedded MakerWorld session so the next connect requires a fresh login.
  await mwSession().clearStorageData({ storages: ['cookies'] });
  await clearEncryptedSession();
  return { ok: true };
});

ipcMain.handle('printables:status', async () => {
  const context = await readPrintablesContext({ force: true });
  const identity = context?.identity;
  return {
    connected: !!identity,
    user: identity ? {
      id: identity.id,
      handle: identity.handle,
      publicUsername: identity.publicUsername,
    } : null,
  };
});

ipcMain.handle('printables:connect', async (event) => {
  const existing = await readPrintablesContext({ force: true });
  if (existing) {
    await storeEncryptedPrintablesSession(existing.cookie);
    return { ok: true, user: existing.identity };
  }
  const parent = BrowserWindow.fromWebContents(event.sender);
  try {
    const { cookie, identity } = await openPrintablesLoginAndCapture(parent);
    await storeEncryptedPrintablesSession(cookie);
    await printablesAuthCache.validate(cookie, async () => identity, { force: true });
    return { ok: true, user: identity };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('printables:request', async (_event, request = {}) => {
  const cookie = await readPrintablesCookie();
  if (!cookie) {
    return {
      status: 401,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'missing_printables_session' }),
    };
  }
  const url = validateWorkerUrl(request.url, WORKER_URL, 'printables');
  const result = await handlePrintablesRequest({ ...request, url }, cookie);
  if (result.status === 401 || /user_is_not_authenticated|token_is_expired|session is no longer authorized/i.test(result.body)) {
    printablesAuthCache.clear();
  }
  return result;
});

ipcMain.handle('printables:disconnect', async () => {
  await printablesSession().clearStorageData();
  await clearEncryptedPrintablesSession();
  printablesAuthCache.clear();
  return { ok: true };
});

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
