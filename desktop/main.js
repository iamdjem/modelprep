// ModelPrep desktop (Electron) main process.
//
// Why this app exists: a website cannot read another site's login session (browser
// same-origin policy + HttpOnly cookies). A desktop app CAN open each platform's real
// login in an isolated embedded session and call its upload API from the user's device.
// Raw cookies remain in the main process and an encrypted safeStorage fallback; the
// renderer sees only opaque account markers.

const { app, BrowserWindow, ipcMain, session, shell, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { validateWorkerUrl } = require('./auth-bridge');
const { resolveRendererTarget, isRendererNavigation } = require('./renderer-target');
const { handlePrintablesRequest, printablesWhoamiDirect } = require('./printables-direct');
const { createPrintablesSessionCache } = require('./printables-session-cache');
const { createCultsDirectClient } = require('./cults-direct');
const { handleMakerWorldRequest, makerWorldLoginDirect } = require('./makerworld-direct.cjs');
const { createNexprintDirectClient } = require('./nexprint-direct');
const { CREATE_URL: CREALITY_LOGIN_URL, createCrealityDirectClient } = require('./creality-direct');
const { UPLOAD_URL: MAKERONLINE_LOGIN_URL, createMakerOnlineDirectClient } = require('./makeronline-direct');
const { UPLOAD_URL: MYMINIFACTORY_LOGIN_URL, createMyMiniFactoryDirectClient } = require('./myminifactory-direct');
const { UPLOAD_URL: MAKEROAD_LOGIN_URL, createMakerRoadDirectClient } = require('./makeroad-direct');
const { UPLOAD_URL: THANGS_LOGIN_URL, createThangsDirectClient } = require('./thangs-direct');
const { UPLOAD_URL: THINGIVERSE_LOGIN_URL, createThingiverseDirectClient } = require('./thingiverse-direct');
const { normalizeThingiverseExchange, normalizeThingiversePageCapture, resolveThingiverseSessionCandidates } = require('./thingiverse-session-capture');

// Local integration testing can intentionally reuse the installed app's
// encrypted sessions and renderer storage. This is opt-in so ordinary `npm
// start` keeps Electron's isolated development profile.
if (process.env.MODELPREP_USER_DATA_DIR) {
  app.setPath('userData', path.resolve(process.env.MODELPREP_USER_DATA_DIR));
}

// The app renders multiple <canvas> cover previews; GPU-accelerated canvas can crash the
// renderer with EXC_BAD_ACCESS/SIGBUS on some Macs. Software rendering is plenty fast here
// and avoids the crash.
app.disableHardwareAcceleration();

// Must match the User-Agent used by the shared MakerWorld adapter so any
// cf_clearance earned in the embedded login remains valid for direct requests.
const WORKER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
// Packaged builds ship the matching renderer so a newer hosted UI can never run
// against an older preload/IPC bridge. MODELPREP_URL remains an explicit local-QA
// override; unpackaged `npm start` retains the hosted development fallback.
const RENDERER_TARGET = resolveRendererTarget({
  overrideUrl: process.env.MODELPREP_URL,
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
});
// Load the MakerWorld homepage and let the user click its own "Sign In" — the same
// approach the MakerStats iOS app uses. (There is no /en/login page; it 404s.)
const MW_LOGIN_URL = 'https://makerworld.com/';
const PRINTABLES_LOGIN_URL = 'https://www.printables.com/model/create';
const NEXPRINT_LOGIN_URL = 'https://www.nexprint.com/en/upload';
const WORKER_URL = process.env.MODELPREP_WORKER_URL || 'https://modelprep-backend.iamdjem.workers.dev';
const MW_PARTITION = 'persist:makerworld'; // persistent session so cf_clearance survives
const PRINTABLES_PARTITION = 'persist:printables';
const NEXPRINT_PARTITION = 'persist:nexprint';
const CREALITY_PARTITION = 'persist:creality';
const MAKERONLINE_PARTITION = 'persist:makeronline';
const MYMINIFACTORY_PARTITION = 'persist:myminifactory';
const MAKEROAD_PARTITION = 'persist:makeroad';
const THANGS_PARTITION = 'persist:thangs';
const THINGIVERSE_PARTITION = 'persist:thingiverse';
const WANT = ['token', 'cf_clearance', 'refreshToken'];
const printablesAuthCache = createPrintablesSessionCache();
const cultsDirectClient = createCultsDirectClient();
const nexprintDirectClient = createNexprintDirectClient();
const crealityDirectClient = createCrealityDirectClient();
const makerOnlineDirectClient = createMakerOnlineDirectClient();
// MyMiniFactory's Cloudflare edge rejects Node's standalone TLS/HTTP stack even
// after the passwordless browser flow succeeds. Route its first-party requests
// through the same persistent Chromium session that performed authentication.
const myMiniFactoryDirectClient = createMyMiniFactoryDirectClient({
  fetchImpl: (...args) => myMiniFactorySession().fetch(...args),
  managedSession: true,
});
const makerRoadDirectClient = createMakerRoadDirectClient({ fetchImpl: (...args) => makerRoadSession().fetch(...args) });
const thangsDirectClient = createThangsDirectClient({ fetchImpl: (...args) => thangsSession().fetch(...args) });
const thingiverseDirectClient = createThingiverseDirectClient({ fetchImpl: (...args) => thingiverseSession().fetch(...args) });
let nexprintContextCache = null;
let crealityContextCache = null;
let makerOnlineContextCache = null;
let myMiniFactoryContextCache = null;
let makerRoadContextCache = null;
let thangsContextCache = null;
let thingiverseContextCache = null;

function mwSession() { return session.fromPartition(MW_PARTITION); }
function printablesSession() { return session.fromPartition(PRINTABLES_PARTITION); }
function nexprintSession() { return session.fromPartition(NEXPRINT_PARTITION); }
function crealitySession() { return session.fromPartition(CREALITY_PARTITION); }
function makerOnlineSession() { return session.fromPartition(MAKERONLINE_PARTITION); }
function myMiniFactorySession() { return session.fromPartition(MYMINIFACTORY_PARTITION); }
function makerRoadSession() { return session.fromPartition(MAKEROAD_PARTITION); }
function thangsSession() { return session.fromPartition(THANGS_PARTITION); }
function thingiverseSession() { return session.fromPartition(THINGIVERSE_PARTITION); }
function encryptedSessionPath() { return path.join(app.getPath('userData'), 'makerworld-session.bin'); }
function encryptedPrintablesSessionPath() { return path.join(app.getPath('userData'), 'printables-session.bin'); }
function encryptedCultsAccountsPath() { return path.join(app.getPath('userData'), 'cults-accounts.bin'); }
function encryptedNexprintSessionPath() { return path.join(app.getPath('userData'), 'nexprint-session.bin'); }
function encryptedCrealitySessionPath() { return path.join(app.getPath('userData'), 'creality-session.bin'); }
function encryptedMakerOnlineSessionPath() { return path.join(app.getPath('userData'), 'makeronline-session.bin'); }
function encryptedMyMiniFactorySessionPath() { return path.join(app.getPath('userData'), 'myminifactory-session.bin'); }
function encryptedMakerRoadSessionPath() { return path.join(app.getPath('userData'), 'makeroad-session.bin'); }
function encryptedThangsSessionPath() { return path.join(app.getPath('userData'), 'thangs-session.bin'); }
function encryptedThingiverseSessionPath() { return path.join(app.getPath('userData'), 'thingiverse-session.bin'); }

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

async function readEncryptedNexprintSession() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = await fs.readFile(encryptedNexprintSessionPath());
    const parsed = JSON.parse(safeStorage.decryptString(encrypted));
    return parsed?.token && typeof parsed.token === 'string'
      ? { token: parsed.token, cookie: typeof parsed.cookie === 'string' ? parsed.cookie : '' }
      : null;
  } catch { return null; }
}

async function storeEncryptedNexprintSession(context) {
  if (!context?.token || typeof context.token !== 'string') {
    throw new Error('A Nexprint session is required.');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable on this device.');
  }
  const target = encryptedNexprintSessionPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const encrypted = safeStorage.encryptString(JSON.stringify({
    version: 1,
    token: context.token,
    cookie: String(context.cookie || ''),
  }));
  await fs.writeFile(target, encrypted, { mode: 0o600 });
}

async function clearEncryptedNexprintSession() {
  try { await fs.unlink(encryptedNexprintSessionPath()); } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
  }
}

async function readEncryptedCrealitySession() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = await fs.readFile(encryptedCrealitySessionPath());
    const parsed = JSON.parse(safeStorage.decryptString(encrypted));
    return parsed?.token && parsed?.uid
      ? {
        token: String(parsed.token),
        uid: String(parsed.uid),
        cookie: String(parsed.cookie || ''),
        deviceId: String(parsed.deviceId || randomUUID()),
      }
      : null;
  } catch { return null; }
}

async function storeEncryptedCrealitySession(context) {
  if (!context?.token || !context?.uid) throw new Error('A Creality Cloud session is required.');
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable on this device.');
  }
  const target = encryptedCrealitySessionPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const encrypted = safeStorage.encryptString(JSON.stringify({
    version: 1,
    token: String(context.token),
    uid: String(context.uid),
    cookie: String(context.cookie || ''),
    deviceId: String(context.deviceId || randomUUID()),
  }));
  await fs.writeFile(target, encrypted, { mode: 0o600 });
}

async function clearEncryptedCrealitySession() {
  try { await fs.unlink(encryptedCrealitySessionPath()); } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
  }
}

async function readEncryptedMakerOnlineSession() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = await fs.readFile(encryptedMakerOnlineSessionPath());
    const parsed = JSON.parse(safeStorage.decryptString(encrypted));
    return parsed?.token
      ? { token: String(parsed.token), cookie: String(parsed.cookie || '') }
      : null;
  } catch { return null; }
}

async function storeEncryptedMakerOnlineSession(context) {
  if (!context?.token) throw new Error('A MakerOnline session is required.');
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable on this device.');
  }
  const target = encryptedMakerOnlineSessionPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const encrypted = safeStorage.encryptString(JSON.stringify({
    version: 1,
    token: String(context.token),
    cookie: String(context.cookie || ''),
  }));
  await fs.writeFile(target, encrypted, { mode: 0o600 });
}

async function clearEncryptedMakerOnlineSession() {
  try { await fs.unlink(encryptedMakerOnlineSessionPath()); } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
  }
}

async function readEncryptedMyMiniFactorySession() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = await fs.readFile(encryptedMyMiniFactorySessionPath());
    const parsed = JSON.parse(safeStorage.decryptString(encrypted));
    return parsed?.cookie ? {
      cookie: String(parsed.cookie),
      userAgent: parsed.userAgent ? String(parsed.userAgent) : '',
    } : null;
  } catch { return null; }
}

async function storeEncryptedMyMiniFactorySession(context) {
  if (!context?.cookie) throw new Error('A MyMiniFactory session is required.');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this device.');
  const target = encryptedMyMiniFactorySessionPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, safeStorage.encryptString(JSON.stringify({
    version: 2,
    cookie: String(context.cookie),
    userAgent: String(context.userAgent || myMiniFactorySession().getUserAgent()),
  })), { mode: 0o600 });
}

async function clearEncryptedMyMiniFactorySession() {
  try { await fs.unlink(encryptedMyMiniFactorySessionPath()); } catch (err) {
    if (!err || err.code !== 'ENOENT') throw err;
  }
}

async function readEncryptedMakerRoadSession() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = await fs.readFile(encryptedMakerRoadSessionPath());
    const parsed = JSON.parse(safeStorage.decryptString(encrypted));
    return parsed?.cookie ? { cookie: String(parsed.cookie) } : null;
  } catch { return null; }
}

async function storeEncryptedMakerRoadSession(context) {
  if (!context?.cookie) throw new Error('A MakerRoad session is required.');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this device.');
  const target = encryptedMakerRoadSessionPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, safeStorage.encryptString(JSON.stringify({ version: 1, cookie: String(context.cookie) })), { mode: 0o600 });
}

async function clearEncryptedMakerRoadSession() {
  try { await fs.unlink(encryptedMakerRoadSessionPath()); } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
}

async function readEncryptedThangsSession() {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const parsed = JSON.parse(safeStorage.decryptString(await fs.readFile(encryptedThangsSessionPath())));
    if (!parsed?.accessToken) return parsed?.cookie ? { cookie: String(parsed.cookie) } : null;
    return {
      accessToken: String(parsed.accessToken),
      ...(parsed.cookie ? { cookie: String(parsed.cookie) } : {}),
    };
  } catch { return null; }
}
async function storeEncryptedThangsSession(context) {
  if (!context?.accessToken || !safeStorage.isEncryptionAvailable()) throw new Error('A secure Thangs session is required.');
  const target = encryptedThangsSessionPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, safeStorage.encryptString(JSON.stringify({ version: 2, accessToken: context.accessToken, cookie: context.cookie || '' })), { mode: 0o600 });
}
async function clearEncryptedThangsSession() { try { await fs.unlink(encryptedThangsSessionPath()); } catch (error) { if (!error || error.code !== 'ENOENT') throw error; } }
async function readEncryptedThingiverseSession() { if (!safeStorage.isEncryptionAvailable()) return null; try { const parsed = JSON.parse(safeStorage.decryptString(await fs.readFile(encryptedThingiverseSessionPath()))); if (!parsed?.apiToken || !parsed?.accessToken) return null; return { apiToken: String(parsed.apiToken), accessToken: String(parsed.accessToken), ...(parsed.cookie ? { cookie: String(parsed.cookie) } : {}) }; } catch { return null; } }
async function storeEncryptedThingiverseSession(context) { if (!context?.apiToken || !context?.accessToken || !safeStorage.isEncryptionAvailable()) throw new Error('A secure Thingiverse session is required.'); const target = encryptedThingiverseSessionPath(); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, safeStorage.encryptString(JSON.stringify({ version: 3, apiToken: context.apiToken, accessToken: context.accessToken, cookie: context.cookie || '' })), { mode: 0o600 }); }
async function clearEncryptedThingiverseSession() { try { await fs.unlink(encryptedThingiverseSessionPath()); } catch (error) { if (!error || error.code !== 'ENOENT') throw error; } }

async function readEncryptedCultsAccounts() {
  if (!safeStorage.isEncryptionAvailable()) return {};
  try {
    const encrypted = await fs.readFile(encryptedCultsAccountsPath());
    const parsed = JSON.parse(safeStorage.decryptString(encrypted));
    return parsed && typeof parsed === 'object' && parsed.accounts && typeof parsed.accounts === 'object'
      ? parsed.accounts
      : {};
  } catch { return {}; }
}

async function storeEncryptedCultsAccounts(accounts) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is unavailable on this device.');
  }
  const target = encryptedCultsAccountsPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const encrypted = safeStorage.encryptString(JSON.stringify({ version: 1, accounts }));
  await fs.writeFile(target, encrypted, { mode: 0o600 });
}

async function readCultsCredentials(accountId) {
  if (!accountId || typeof accountId !== 'string') return null;
  const accounts = await readEncryptedCultsAccounts();
  const credentials = accounts[accountId];
  return credentials?.email && credentials?.password ? credentials : null;
}

// Read MakerWorld cookies from the embedded session; return the assembled string or null.
// Signed in == `token` OR `refreshToken` present (matches MakerStats iOS's auth check).
// cf_clearance is bundled when present for direct HTML fallbacks, but it does not gate
// login detection.
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
    if (identity) {
      // The persistent Chromium partition is the freshest source when the site
      // rotates a sliding session. Mirror every validated value so a later app
      // launch can recover even if the partition is unavailable.
      try { await storeEncryptedPrintablesSession(cookie); } catch { /* validation still succeeded */ }
      return { cookie, identity };
    }
  }
  return null;
}

async function readPrintablesCookie(options) {
  return (await readPrintablesContext(options))?.cookie ?? null;
}

function decodeCookieValue(value) {
  try { return decodeURIComponent(String(value || '')); } catch { return String(value || ''); }
}

async function readNexprintBrowserContext() {
  const cookies = await nexprintSession().cookies.get({});
  const relevant = cookies.filter((cookie) => {
    const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase();
    return domain === 'nexprint.com' || domain.endsWith('.nexprint.com');
  });
  const auth = relevant.find((cookie) => cookie.name === 'auth_token' && cookie.value);
  if (!auth) return null;
  return {
    token: decodeCookieValue(auth.value),
    cookie: relevant.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
  };
}

async function validateNexprintContext(context) {
  if (!context?.token) return null;
  try {
    const identity = await nexprintDirectClient.whoami(context);
    return identity?.id || identity?.handle || identity?.nickname ? identity : null;
  } catch (error) {
    console.error(
      '[nexprint-auth] direct whoami failed:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function readNexprintContext({ force = false } = {}) {
  if (!force && nexprintContextCache?.expiresAt > Date.now()) return nexprintContextCache.value;
  const browser = await readNexprintBrowserContext();
  const stored = await readEncryptedNexprintSession();
  for (const context of [browser, stored]) {
    if (!context) continue;
    const identity = await validateNexprintContext(context);
    if (identity) {
      const value = { ...context, identity };
      try { await storeEncryptedNexprintSession(context); } catch { /* validation still succeeded */ }
      nexprintContextCache = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
      return value;
    }
  }
  nexprintContextCache = null;
  return null;
}

async function readCrealityBrowserContext() {
  const cookies = await crealitySession().cookies.get({});
  const relevant = cookies.filter((cookie) => {
    const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase();
    return domain === 'crealitycloud.com' || domain.endsWith('.crealitycloud.com');
  });
  const token = relevant.find((cookie) => cookie.name === 'model_token' && cookie.value)?.value;
  const uid = relevant.find((cookie) => cookie.name === 'model_user_id' && cookie.value)?.value;
  const deviceId = relevant.find((cookie) => cookie.name === '__CXY_DUID_' && cookie.value)?.value
    || relevant.find((cookie) => cookie.name === 'model_device_id' && cookie.value)?.value;
  if (!token || !uid) return null;
  return {
    token: decodeCookieValue(token),
    uid: decodeCookieValue(uid),
    cookie: relevant.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
    // Match Creality's first-party client by reusing its persisted device id.
    // The UUID fallback is only for older sessions that predate those cookies.
    deviceId: deviceId ? decodeCookieValue(deviceId) : randomUUID(),
  };
}

async function validateCrealityContext(context) {
  if (!context?.token || !context?.uid) return null;
  try {
    const identity = await crealityDirectClient.whoami(context);
    return identity?.id ? identity : null;
  } catch (error) {
    console.error(
      '[creality-auth] direct whoami failed:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function readCrealityContext({ force = false } = {}) {
  if (!force && crealityContextCache?.expiresAt > Date.now()) return crealityContextCache.value;
  const browser = await readCrealityBrowserContext();
  const stored = await readEncryptedCrealitySession();
  for (const context of [browser, stored]) {
    if (!context) continue;
    const identity = await validateCrealityContext(context);
    if (identity) {
      const value = { ...context, identity };
      try { await storeEncryptedCrealitySession(context); } catch { /* validation still succeeded */ }
      crealityContextCache = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
      return value;
    }
  }
  crealityContextCache = null;
  return null;
}

async function readMakerOnlineBrowserContext() {
  const cookies = await makerOnlineSession().cookies.get({});
  const relevant = cookies.filter((cookie) => {
    const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase();
    return domain === 'makeronline.com' || domain.endsWith('.makeronline.com');
  });
  const auth = relevant.find((cookie) => cookie.name === 'mo_access_token' && cookie.value);
  if (!auth) return null;
  return {
    token: decodeCookieValue(auth.value),
    cookie: relevant.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
  };
}

async function validateMakerOnlineContext(context) {
  if (!context?.token) return null;
  try {
    const identity = await makerOnlineDirectClient.whoami(context);
    return identity?.id ? identity : null;
  } catch (error) {
    console.error(
      '[makeronline-auth] direct whoami failed:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function readMakerOnlineContext({ force = false } = {}) {
  if (!force && makerOnlineContextCache?.expiresAt > Date.now()) return makerOnlineContextCache.value;
  const browser = await readMakerOnlineBrowserContext();
  const stored = await readEncryptedMakerOnlineSession();
  for (const context of [browser, stored]) {
    if (!context) continue;
    const identity = await validateMakerOnlineContext(context);
    if (identity) {
      const value = { ...context, identity };
      try { await storeEncryptedMakerOnlineSession(context); } catch { /* validation still succeeded */ }
      makerOnlineContextCache = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
      return value;
    }
  }
  makerOnlineContextCache = null;
  return null;
}

async function readMyMiniFactoryBrowserContext() {
  const cookies = await myMiniFactorySession().cookies.get({});
  const relevant = cookies.filter((cookie) => {
    const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase();
    return domain === 'myminifactory.com' || domain.endsWith('.myminifactory.com');
  });
  return relevant.length ? {
    cookie: relevant.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
    userAgent: myMiniFactorySession().getUserAgent(),
  } : null;
}

async function validateMyMiniFactoryContext(context) {
  if (!context?.cookie) return null;
  try {
    const identity = await myMiniFactoryDirectClient.whoami(context);
    return identity?.username ? identity : null;
  } catch (error) {
    console.error('[myminifactory-auth] direct whoami failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function readMyMiniFactoryContext({ force = false } = {}) {
  if (!force && myMiniFactoryContextCache?.expiresAt > Date.now()) return myMiniFactoryContextCache.value;
  const browser = await readMyMiniFactoryBrowserContext();
  const stored = await readEncryptedMyMiniFactorySession();
  for (const context of [browser, stored]) {
    if (!context) continue;
    const identity = await validateMyMiniFactoryContext(context);
    if (identity) {
      const value = { ...context, identity };
      // A passwordless login may finish between renderer runs or immediately
      // before the login window closes. Once the persistent browser partition
      // proves valid, always mirror it into safeStorage so account discovery is
      // also resilient to partition-cookie loss.
      if (context === browser) {
        try { await storeEncryptedMyMiniFactorySession(context); }
        catch (error) {
          console.error('[myminifactory-auth] secure session mirror failed:', error instanceof Error ? error.message : String(error));
        }
      }
      myMiniFactoryContextCache = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
      return value;
    }
  }
  myMiniFactoryContextCache = null;
  return null;
}

async function readMakerRoadBrowserContext() {
  const cookies = await makerRoadSession().cookies.get({});
  const relevant = cookies.filter((cookie) => {
    const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase();
    return domain === 'makeroad.com' || domain.endsWith('.makeroad.com');
  });
  return relevant.length ? { cookie: relevant.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ') } : null;
}

async function validateMakerRoadContext(context) {
  if (!context?.cookie) return null;
  try { return await makerRoadDirectClient.whoami(context); }
  catch (error) {
    console.error('[makeroad-auth] session check failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function readMakerRoadContext({ force = false } = {}) {
  if (!force && makerRoadContextCache?.expiresAt > Date.now()) return makerRoadContextCache.value;
  const browser = await readMakerRoadBrowserContext();
  const stored = await readEncryptedMakerRoadSession();
  for (const context of [browser, stored]) {
    if (!context) continue;
    const identity = await validateMakerRoadContext(context);
    if (identity) {
      const value = { ...context, identity };
      try { await storeEncryptedMakerRoadSession(context); } catch { /* validation still succeeded */ }
      makerRoadContextCache = { value, expiresAt: Date.now() + 5 * 60 * 1000 };
      return value;
    }
  }
  makerRoadContextCache = null;
  return null;
}

async function readThangsBrowserCookies() {
  const cookies = await thangsSession().cookies.get({});
  const relevant = cookies.filter((cookie) => { const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase(); return domain === 'thangs.com' || domain.endsWith('.thangs.com'); });
  return relevant.length ? relevant.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ') : '';
}
async function readThangsStorageContext(webContents) {
  if (!webContents || webContents.isDestroyed()) return null;
  const storage = await webContents.executeJavaScript(`(() => {
    try {
      const current = JSON.parse(localStorage.getItem('currentUser') || 'null');
      const accessToken = localStorage.getItem('accessToken') || current?.accessToken || '';
      return accessToken ? { accessToken } : null;
    } catch { return null; }
  })()`, true);
  if (!storage?.accessToken) return null;
  const cookie = await readThangsBrowserCookies();
  return { accessToken: String(storage.accessToken), ...(cookie ? { cookie } : {}) };
}
async function readThangsPersistentStorageContext() {
  const probe = new BrowserWindow({ show: false, webPreferences: { partition: THANGS_PARTITION, contextIsolation: true, nodeIntegration: false } });
  try {
    await probe.loadURL(THANGS_LOGIN_URL);
    return await readThangsStorageContext(probe.webContents);
  } catch {
    // A navigation error can still leave the original Thangs origin available.
    try { return await readThangsStorageContext(probe.webContents); } catch { return null; }
  } finally {
    if (!probe.isDestroyed()) probe.destroy();
  }
}
async function validateThangsContext(context) { if (!context?.accessToken) return null; try { return await thangsDirectClient.whoami(context); } catch { return null; } }
async function readThangsContext({ force = false } = {}) {
  if (!force && thangsContextCache?.expiresAt > Date.now()) return thangsContextCache.value;
  const stored = await readEncryptedThangsSession();
  if (stored?.accessToken) {
    const identity = await validateThangsContext(stored);
    if (identity) {
      const value = { ...stored, identity };
      thangsContextCache = { value, expiresAt: Date.now() + 300000 };
      return value;
    }
  }
  const browser = await readThangsPersistentStorageContext();
  if (browser) {
    const identity = await validateThangsContext(browser);
    if (identity) {
      const value = { ...browser, identity };
      try { await storeEncryptedThangsSession(browser); } catch {}
      thangsContextCache = { value, expiresAt: Date.now() + 300000 };
      return value;
    }
  }
  thangsContextCache = null; return null;
}
async function readThingiverseBrowserCookies() { const cookies = await thingiverseSession().cookies.get({}); const relevant = cookies.filter((cookie) => { const domain = String(cookie.domain || '').replace(/^\./, '').toLowerCase(); return domain === 'thingiverse.com' || domain.endsWith('.thingiverse.com'); }); return relevant.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '); }
async function exchangeThingiverseSessionForTokens() {
  try {
    const cookie = await readThingiverseBrowserCookies();
    if (!cookie) return null;
    const response = await thingiverseSession().fetch('https://www.thingiverse.com/ajax/user/exchange_session_for_token', {
      headers: { Accept: 'application/json', Referer: THINGIVERSE_LOGIN_URL },
      credentials: 'include',
      redirect: 'manual',
    });
    if (!response.ok) return null;
    const data = await response.json();
    return normalizeThingiverseExchange(data, cookie);
  } catch { return null; }
}
async function exchangeThingiversePageSessionForTokens(webContents) {
  if (!webContents || webContents.isDestroyed()) return null;
  try {
    const data = await webContents.executeJavaScript(`fetch('/ajax/user/exchange_session_for_token', {
      headers: { Accept: 'application/json' }, credentials: 'include'
    }).then(async (response) => response.ok ? response.json() : null).catch(() => null)`, true);
    const cookie = await readThingiverseBrowserCookies();
    return normalizeThingiverseExchange(data, cookie);
  } catch { return null; }
}
async function captureThingiversePageSession(webContents) {
  if (!webContents || webContents.isDestroyed()) return null;
  try {
    const data = await webContents.executeJavaScript(`(async () => {
      const exchangeResponse = await fetch('/ajax/user/exchange_session_for_token', {
        headers: { Accept: 'application/json' }, credentials: 'include'
      });
      if (!exchangeResponse.ok) return null;
      const exchange = await exchangeResponse.json();
      const accessToken = exchange?.jwt?.access || '';
      if (!exchange?.token || !accessToken) return null;
      const identityResponse = await fetch('/api/v2/users/me', {
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + accessToken },
        credentials: 'include'
      });
      if (!identityResponse.ok) return null;
      return { exchange, identity: await identityResponse.json() };
    })().catch(() => null)`, true);
    const cookie = await readThingiverseBrowserCookies();
    return normalizeThingiversePageCapture(data, cookie);
  } catch { return null; }
}
async function readThingiverseStorageContext(webContents) {
  if (!webContents || webContents.isDestroyed()) return null;
  const storage = await webContents.executeJavaScript(`(() => {
    try {
      const apiToken = localStorage.getItem('tv_ajax_token') || '';
      const accessToken = localStorage.getItem('tv_access_token') || '';
      return apiToken ? { apiToken, accessToken } : null;
    } catch { return null; }
  })()`, true);
  if (!storage?.apiToken) return null;
  const cookie = await readThingiverseBrowserCookies();
  return { apiToken: String(storage.apiToken), ...(storage.accessToken ? { accessToken: String(storage.accessToken) } : {}), ...(cookie ? { cookie } : {}) };
}
async function readThingiversePersistentSessionCapture() {
  const probe = new BrowserWindow({ show: false, webPreferences: { partition: THINGIVERSE_PARTITION, contextIsolation: true, nodeIntegration: false } });
  try {
    let timeout;
    await Promise.race([
      probe.loadURL(THINGIVERSE_LOGIN_URL),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Thingiverse storage probe timed out.')), 8000); }),
    ]).finally(() => clearTimeout(timeout));
    return await captureThingiversePageSession(probe.webContents)
      || await exchangeThingiversePageSessionForTokens(probe.webContents)
      || await readThingiverseStorageContext(probe.webContents);
  } catch {
    try { return await captureThingiversePageSession(probe.webContents) || await readThingiverseStorageContext(probe.webContents); } catch { return null; }
  } finally {
    if (!probe.isDestroyed()) probe.destroy();
  }
}
async function validateThingiverseContext(context) { if (!context?.apiToken || !context?.accessToken) return null; try { return await thingiverseDirectClient.whoami(context); } catch { return null; } }
async function readThingiverseContext({ force = false } = {}) {
  if (!force && thingiverseContextCache?.expiresAt > Date.now()) return thingiverseContextCache.value;
  const resolved = await resolveThingiverseSessionCandidates([
    () => exchangeThingiverseSessionForTokens(),
    () => readEncryptedThingiverseSession(),
    () => readThingiversePersistentSessionCapture(),
  ], validateThingiverseContext);
  if (resolved) {
    const value = { ...resolved.context, identity: resolved.identity };
    try { await storeEncryptedThingiverseSession(resolved.context); } catch {}
    thingiverseContextCache = { value, expiresAt: Date.now() + 300000 };
    return value;
  }
  thingiverseContextCache = null; return null;
}

async function validateMakerWorldCookie(cookie) {
  if (!cookie) return null;
  try {
    const response = await handleMakerWorldRequest({
      url: `${WORKER_URL}/api/v1/makerworld/web/whoami`, method: 'GET',
    }, cookie);
    const data = JSON.parse(response.body || '{}');
    return response.status >= 200 && response.status < 300 && data.ok ? data : null;
  } catch { return null; }
}

async function warmPersistentSession(browserSession, url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    // A normal first-party GET lets sites apply sliding-cookie/session rotation
    // inside their own persistent Electron partition. No renderer sees the
    // response or credentials, and no upload/mutation endpoint is touched.
    await browserSession.fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
  } catch { /* an interactive sign-in may still be required */ }
  finally { clearTimeout(timer); }
}

async function recoverMakerWorldSession() {
  let cookie = await readMwCookie();
  let identity = await validateMakerWorldCookie(cookie);
  if (identity) { try { await storeEncryptedSession(cookie); } catch {} return identity; }

  if (cookie && /(?:^|;\s*)refreshToken=/.test(cookie)) {
    try {
      const refreshed = await handleMakerWorldRequest({
        url: `${WORKER_URL}/api/v1/makerworld/web/refresh`, method: 'POST',
      }, cookie);
      const data = JSON.parse(refreshed.body || '{}');
      if (refreshed.status >= 200 && refreshed.status < 300 && data.cookie) {
        cookie = data.cookie;
        await storeEncryptedSession(cookie);
        identity = await validateMakerWorldCookie(cookie);
        if (identity) return identity;
      }
    } catch { /* fall through to a harmless first-party page warm-up */ }
  }

  await warmPersistentSession(mwSession(), MW_LOGIN_URL);
  cookie = await readMwCookie();
  identity = await validateMakerWorldCookie(cookie);
  if (identity) { try { await storeEncryptedSession(cookie); } catch {} }
  return identity;
}

const RECOVERY_TARGETS = Object.freeze({
  printables: { browserSession: printablesSession, url: PRINTABLES_LOGIN_URL, read: readPrintablesContext },
  nexprint: { browserSession: nexprintSession, url: NEXPRINT_LOGIN_URL, read: readNexprintContext },
  creality: { browserSession: crealitySession, url: CREALITY_LOGIN_URL, read: readCrealityContext },
  makeronline: { browserSession: makerOnlineSession, url: MAKERONLINE_LOGIN_URL, read: readMakerOnlineContext },
  mmf: { browserSession: myMiniFactorySession, url: MYMINIFACTORY_LOGIN_URL, read: readMyMiniFactoryContext },
  makeroad: { browserSession: makerRoadSession, url: MAKEROAD_LOGIN_URL, read: readMakerRoadContext },
  thangs: { browserSession: thangsSession, url: THANGS_LOGIN_URL, read: readThangsContext },
  thingiverse: { browserSession: thingiverseSession, url: THINGIVERSE_LOGIN_URL, read: readThingiverseContext },
});

async function recoverDesktopAccount(platform, accountId = '') {
  if (platform === 'makerworld') {
    const identity = await recoverMakerWorldSession();
    return identity ? { ok: true, user: identity, recovered: true } : { ok: false, needsInteractive: true };
  }
  if (platform === 'cults') {
    const accounts = await readEncryptedCultsAccounts();
    const credentials = accounts[String(accountId || '')];
    if (!credentials?.email || !credentials?.password) return { ok: false, needsInteractive: true };
    try {
      const identity = await cultsDirectClient.connect(credentials, String(accountId));
      return { ok: true, user: identity, recovered: true };
    } catch { return { ok: false, needsInteractive: true }; }
  }
  const target = RECOVERY_TARGETS[platform];
  if (!target) return { ok: false, needsInteractive: true, error: 'Unsupported platform.' };
  let context = await target.read({ force: true }).catch(() => null);
  if (!context) {
    await warmPersistentSession(target.browserSession(), target.url);
    context = await target.read({ force: true }).catch(() => null);
  }
  return context
    ? { ok: true, user: context.identity || null, recovered: true }
    : { ok: false, needsInteractive: true };
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 880, backgroundColor: '#f4f3ee',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  if (RENDERER_TARGET.kind === 'file') win.loadFile(RENDERER_TARGET.value);
  else win.loadURL(RENDERER_TARGET.value);

  const isApp = (url) => isRendererNavigation(url, RENDERER_TARGET);
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

function openNexprintLoginAndCapture(parent) {
  return new Promise((resolve, reject) => {
    const login = new BrowserWindow({
      width: 920, height: 860, parent, modal: false, title: 'Sign in to Nexprint',
      webPreferences: {
        partition: NEXPRINT_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    login.loadURL(NEXPRINT_LOGIN_URL);
    login.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        parent: login, width: 560, height: 760,
        webPreferences: {
          partition: NEXPRINT_PARTITION,
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
        const context = await readNexprintBrowserContext();
        const identity = await validateNexprintContext(context);
        if (context && identity) finish(resolve, { context, identity });
      } catch { /* keep polling while sign-in completes */ }
    }, 1500);
    const timer = setTimeout(
      () => finish(reject, new Error('Nexprint sign-in timed out — please try again.')),
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

function openCrealityLoginAndCapture(parent) {
  return new Promise((resolve, reject) => {
    const login = new BrowserWindow({
      width: 1040, height: 900, parent, modal: false, title: 'Sign in to Creality Cloud',
      webPreferences: {
        partition: CREALITY_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    login.loadURL(CREALITY_LOGIN_URL);
    login.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        parent: login, width: 620, height: 780,
        webPreferences: {
          partition: CREALITY_PARTITION,
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
        const context = await readCrealityBrowserContext();
        const identity = await validateCrealityContext(context);
        if (context && identity) finish(resolve, { context, identity });
      } catch { /* keep polling while sign-in completes */ }
    }, 1500);
    const timer = setTimeout(
      () => finish(reject, new Error('Creality Cloud sign-in timed out — please try again.')),
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

function openMakerOnlineLoginAndCapture(parent) {
  return new Promise((resolve, reject) => {
    const login = new BrowserWindow({
      width: 1120, height: 900, parent, modal: false, title: 'Sign in to MakerOnline',
      webPreferences: {
        partition: MAKERONLINE_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    login.loadURL(MAKERONLINE_LOGIN_URL);
    login.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        parent: login, width: 620, height: 780,
        webPreferences: {
          partition: MAKERONLINE_PARTITION,
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
        const context = await readMakerOnlineBrowserContext();
        const identity = await validateMakerOnlineContext(context);
        if (context && identity) finish(resolve, { context, identity });
      } catch { /* keep polling while sign-in completes */ }
    }, 1500);
    const timer = setTimeout(
      () => finish(reject, new Error('MakerOnline sign-in timed out — please try again.')),
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

function openMyMiniFactoryLoginAndCapture(parent) {
  return new Promise((resolve, reject) => {
    const login = new BrowserWindow({
      width: 1120, height: 900, parent, modal: false, title: 'Sign in to MyMiniFactory',
      webPreferences: { partition: MYMINIFACTORY_PARTITION, contextIsolation: true, nodeIntegration: false },
    });
    login.loadURL(MYMINIFACTORY_LOGIN_URL);
    login.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        parent: login, width: 620, height: 780,
        webPreferences: { partition: MYMINIFACTORY_PARTITION, contextIsolation: true, nodeIntegration: false },
      },
    }));
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true; clearInterval(poll); clearTimeout(timer);
      if (!login.isDestroyed()) login.close();
      fn(value);
    };
    const capture = async () => {
      const context = await readMyMiniFactoryBrowserContext();
      const identity = await validateMyMiniFactoryContext(context);
      return context && identity ? { context, identity } : null;
    };
    const attemptCapture = async () => {
      if (done) return;
      try {
        const captured = await capture();
        if (captured) finish(resolve, captured);
      } catch { /* keep polling while sign-in completes */ }
    };
    const poll = setInterval(attemptCapture, 1000);
    login.webContents.on('did-finish-load', attemptCapture);
    login.webContents.on('did-navigate', attemptCapture);
    login.webContents.on('did-navigate-in-page', attemptCapture);
    const timer = setTimeout(() => finish(reject, new Error('MyMiniFactory sign-in timed out — please try again.')), 10 * 60 * 1000);
    login.on('closed', async () => {
      if (done) return;
      clearInterval(poll); clearTimeout(timer);
      try {
        const captured = await capture();
        if (captured) { done = true; resolve(captured); return; }
      } catch { /* report the normal close result below */ }
      if (!done) { done = true; reject(new Error('Sign-in window was closed before ModelPrep could verify the MyMiniFactory session.')); }
    });
  });
}

function openMakerRoadLoginAndCapture(parent) {
  return new Promise((resolve, reject) => {
    const login = new BrowserWindow({
      width: 1120, height: 900, parent, modal: false, title: 'Sign in to MakerRoad',
      webPreferences: { partition: MAKEROAD_PARTITION, contextIsolation: true, nodeIntegration: false },
    });
    login.loadURL(MAKEROAD_LOGIN_URL);
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true; clearInterval(poll); clearTimeout(timer);
      if (!login.isDestroyed()) login.close();
      fn(value);
    };
    const attempt = async () => {
      try {
        const context = await readMakerRoadBrowserContext();
        const identity = await validateMakerRoadContext(context);
        if (context && identity) finish(resolve, { context, identity });
      } catch { /* keep polling during sign-in */ }
    };
    const poll = setInterval(attempt, 1200);
    login.webContents.on('did-finish-load', attempt);
    const timer = setTimeout(() => finish(reject, new Error('MakerRoad sign-in timed out — please try again.')), 10 * 60 * 1000);
    login.on('closed', () => { if (!done) { done = true; clearInterval(poll); clearTimeout(timer); reject(new Error('Sign-in window was closed.')); } });
  });
}

function openThangsLoginAndCapture(parent) {
  return new Promise((resolve, reject) => {
    const login = new BrowserWindow({ width: 1120, height: 900, parent, modal: false, title: 'Sign in to Thangs', webPreferences: { partition: THANGS_PARTITION, contextIsolation: true, nodeIntegration: false } });
    login.loadURL(THANGS_LOGIN_URL);
    let done = false;
    const finish = (fn, value) => { if (done) return; done = true; clearInterval(poll); clearTimeout(timer); if (!login.isDestroyed()) login.close(); fn(value); };
    const attempt = async () => { try { const context = await readThangsStorageContext(login.webContents); const identity = await validateThangsContext(context); if (context && identity) finish(resolve, { context, identity }); } catch {} };
    const poll = setInterval(attempt, 1200); login.webContents.on('did-finish-load', attempt);
    const timer = setTimeout(() => finish(reject, new Error('Thangs sign-in timed out — please try again.')), 600000);
    login.on('closed', () => { if (!done) { done = true; clearInterval(poll); clearTimeout(timer); reject(new Error('Sign-in window was closed.')); } });
  });
}
function openThingiverseLoginAndCapture(parent) {
  return new Promise((resolve, reject) => {
    const login = new BrowserWindow({ width: 1120, height: 900, parent, modal: false, title: 'Sign in to Thingiverse', webPreferences: { partition: THINGIVERSE_PARTITION, contextIsolation: true, nodeIntegration: false } }); login.loadURL(THINGIVERSE_LOGIN_URL); let done = false;
    const finish = (fn, value) => { if (done) return; done = true; clearInterval(poll); clearTimeout(timer); if (!login.isDestroyed()) login.close(); fn(value); };
    let capturing = false;
    const attempt = async () => {
      if (done || capturing) return;
      capturing = true;
      try {
        const captured = await resolveThingiverseSessionCandidates([
          () => captureThingiversePageSession(login.webContents),
          () => exchangeThingiversePageSessionForTokens(login.webContents),
          () => exchangeThingiverseSessionForTokens(),
          () => readThingiverseStorageContext(login.webContents),
        ], validateThingiverseContext);
        if (captured) finish(resolve, captured);
      } finally { capturing = false; }
    };
    const poll = setInterval(attempt, 1200);
    login.webContents.on('did-finish-load', attempt);
    login.webContents.on('did-navigate', attempt);
    login.webContents.on('did-navigate-in-page', attempt);
    const timer = setTimeout(() => finish(reject, new Error('Thingiverse sign-in timed out — please try again.')), 600000);
    login.on('closed', async () => {
      if (done) return;
      clearInterval(poll); clearTimeout(timer);
      const captured = await resolveThingiverseSessionCandidates([
        () => exchangeThingiverseSessionForTokens(),
      ], validateThingiverseContext);
      if (done) return;
      done = true;
      if (captured) resolve(captured);
      else reject(new Error('Sign-in window was closed before ModelPrep could verify the Thingiverse session.'));
    });
  });
}

ipcMain.handle('mw:status', async () => {
  const identity = await recoverMakerWorldSession();
  return { connected: !!identity, user: identity || null };
});

ipcMain.handle('mw:connect', async (evt) => {
  // Reuse and, when possible, refresh a valid saved session before displaying
  // any window. Only genuine server validation counts as connected.
  const existing = await recoverMakerWorldSession();
  if (existing) return { ok: true, user: existing };
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
  const result = await makerWorldLoginDirect(payload);
  const data = result.data || {};
  if (result.status >= 200 && result.status < 300 && data.ok && data.cookie) {
    await storeEncryptedSession(data.cookie);
    delete data.cookie;
  }
  return { status: result.status, data };
});

ipcMain.handle('mw:request', async (_evt, request = {}) => {
  const cookie = await readMwCookie();
  if (!cookie) return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'missing_makerworld_session' }) };
  const url = validateWorkerUrl(request.url, WORKER_URL);
  const result = await handleMakerWorldRequest({ ...request, url }, cookie);
  if (result.status >= 200 && result.status < 300 && new URL(url).pathname.endsWith('/refresh')) {
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

ipcMain.handle('cults:connect', async (_event, payload = {}) => {
  const email = String(payload.email || '').trim();
  const password = String(payload.password || '');
  if (!email || !password) return { ok: false, error: 'Cults3D email and password are required.' };
  const accounts = await readEncryptedCultsAccounts();
  const existingId = Object.entries(accounts).find(([, value]) => value?.email === email)?.[0];
  const accountId = existingId || randomUUID();
  try {
    await cultsDirectClient.connect({ email, password }, accountId);
    accounts[accountId] = { email, password };
    await storeEncryptedCultsAccounts(accounts);
    return { ok: true, accountId, email };
  } catch (error) {
    cultsDirectClient.clear(accountId);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('cults:status', async (_event, accountId) => {
  const credentials = await readCultsCredentials(accountId);
  return { connected: !!credentials, email: credentials?.email || null };
});

ipcMain.handle('cults:request', async (_event, request = {}) => {
  const accountId = String(request.accountId || '');
  const credentials = await readCultsCredentials(accountId);
  if (!credentials) {
    return {
      status: 401,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'missing_cults_session', message: 'Reconnect this Cults3D account.' }),
    };
  }
  const url = validateWorkerUrl(request.url, WORKER_URL, 'cults3d');
  return cultsDirectClient.handleRequest({ ...request, url }, credentials, accountId);
});

ipcMain.handle('cults:disconnect', async (_event, accountId) => {
  const id = String(accountId || '');
  const accounts = await readEncryptedCultsAccounts();
  if (id && accounts[id]) {
    delete accounts[id];
    await storeEncryptedCultsAccounts(accounts);
  }
  cultsDirectClient.clear(id);
  return { ok: true };
});

ipcMain.handle('nexprint:status', async () => {
  const context = await readNexprintContext({ force: true });
  return {
    connected: !!context,
    user: context ? context.identity : null,
  };
});

ipcMain.handle('creality:status', async () => {
  const context = await readCrealityContext({ force: true });
  return { connected: !!context, user: context ? context.identity : null };
});

ipcMain.handle('makeronline:status', async () => {
  const context = await readMakerOnlineContext({ force: true });
  return { connected: !!context, user: context ? context.identity : null };
});

ipcMain.handle('myminifactory:status', async () => {
  const context = await readMyMiniFactoryContext({ force: true });
  return { connected: !!context, user: context ? context.identity : null };
});

ipcMain.handle('makeroad:status', async () => {
  const context = await readMakerRoadContext({ force: true });
  return { connected: !!context, user: context ? context.identity : null };
});
ipcMain.handle('thangs:status', async () => { const context = await readThangsContext({ force: true }); return { connected: !!context, user: context?.identity || null }; });
ipcMain.handle('thingiverse:status', async () => { const context = await readThingiverseContext({ force: true }); return { connected: !!context, user: context?.identity || null, legalApproved: !!context?.identity?.legalApproved }; });

ipcMain.handle('accounts:recover', async (_event, platform, accountId) => {
  try { return await recoverDesktopAccount(String(platform || ''), String(accountId || '')); }
  catch (error) {
    return { ok: false, needsInteractive: true, error: error instanceof Error ? error.message : String(error) };
  }
});

// Renderer storage is origin-scoped, while the encrypted desktop sessions are
// deliberately stored in Electron's main process. Rehydrate harmless account
// markers when the app is opened from a different origin (for example a local
// live-test build) without ever exposing cookies, tokens, or passwords.
ipcMain.handle('accounts:discover', async () => {
  const [makerWorldIdentity, printablesContext, cultsAccounts, nexprintContext, crealityContext, makerOnlineContext, myMiniFactoryContext, makerRoadContext, thangsContext, thingiverseContext] = await Promise.all([
    (async () => {
      const cookie = await readMwCookie();
      if (!cookie) return null;
      try {
        const response = await handleMakerWorldRequest({
          url: `${WORKER_URL}/api/v1/makerworld/web/whoami`,
          method: 'GET',
        }, cookie);
        const data = JSON.parse(response.body || '{}');
        return response.status >= 200 && response.status < 300 && data.ok ? data : null;
      } catch { return null; }
    })(),
    readPrintablesContext({ force: true }).catch(() => null),
    readEncryptedCultsAccounts(),
    readNexprintContext({ force: true }).catch(() => null),
    readCrealityContext({ force: true }).catch(() => null),
    readMakerOnlineContext({ force: true }).catch(() => null),
    readMyMiniFactoryContext({ force: true }).catch(() => null),
    readMakerRoadContext({ force: true }).catch(() => null),
    readThangsContext({ force: true }).catch(() => null),
    readThingiverseContext({ force: true }).catch(() => null),
  ]);

  const accounts = [];
  if (makerWorldIdentity) {
    const { handle, name } = makerWorldIdentity;
    accounts.push({
      platform: 'makerworld',
      label: handle ? (name ? `${name} (@${handle})` : `@${handle}`) : 'MakerWorld',
    });
  }
  if (printablesContext?.identity) {
    const { handle, publicUsername } = printablesContext.identity;
    accounts.push({
      platform: 'printables',
      label: handle ? (publicUsername ? `${publicUsername} (@${handle})` : `@${handle}`) : 'Printables',
    });
  }
  await Promise.all(Object.entries(cultsAccounts).map(async ([accountId, credentials]) => {
    if (!credentials?.email || !credentials?.password) return;
    try {
      await cultsDirectClient.connect(credentials, accountId);
      accounts.push({ platform: 'cults', accountId, label: credentials.email });
    } catch { /* stale credentials stay encrypted but are marked reconnect below */ }
  }));
  if (nexprintContext?.identity) {
    const identity = nexprintContext.identity;
    accounts.push({
      platform: 'nexprint',
      label: String(identity.nickname || identity.handle || identity.id || 'Nexprint'),
    });
  }
  if (crealityContext?.identity) {
    const identity = crealityContext.identity;
    accounts.push({
      platform: 'creality',
      label: String(identity.nickname || identity.id || 'Creality Cloud'),
    });
  }
  if (makerOnlineContext?.identity) {
    const identity = makerOnlineContext.identity;
    accounts.push({
      platform: 'makeronline',
      label: String(identity.nickname || identity.id || 'MakerOnline'),
    });
  }
  if (myMiniFactoryContext?.identity) {
    accounts.push({
      platform: 'mmf',
      label: String(myMiniFactoryContext.identity.username || 'MyMiniFactory'),
    });
  }
  if (makerRoadContext?.identity) {
    accounts.push({ platform: 'makeroad', label: String(makerRoadContext.identity.nickname || 'MakerRoad') });
  }
  if (thangsContext?.identity) accounts.push({ platform: 'thangs', label: String(thangsContext.identity.nickname || 'Thangs') });
  if (thingiverseContext?.identity) accounts.push({ platform: 'thingiverse', label: String(thingiverseContext.identity.nickname || 'Thingiverse'), legalApproved: !!thingiverseContext.identity.legalApproved });
  return { ok: true, accounts };
});

ipcMain.handle('nexprint:connect', async (event) => {
  const existing = await readNexprintContext({ force: true });
  if (existing) {
    await storeEncryptedNexprintSession(existing);
    return { ok: true, user: existing.identity };
  }
  const parent = BrowserWindow.fromWebContents(event.sender);
  try {
    const { context, identity } = await openNexprintLoginAndCapture(parent);
    await storeEncryptedNexprintSession(context);
    nexprintContextCache = {
      value: { ...context, identity },
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    return { ok: true, user: identity };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('nexprint:request', async (_event, request = {}) => {
  const context = await readNexprintContext();
  if (!context) {
    return {
      status: 401,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: 'missing_nexprint_session',
        message: 'Reconnect the Nexprint account in ModelPrep Desktop.',
      }),
    };
  }
  const url = validateWorkerUrl(request.url, WORKER_URL, 'nexprint');
  return nexprintDirectClient.handleRequest({ ...request, url }, context);
});

ipcMain.handle('nexprint:disconnect', async () => {
  await nexprintSession().clearStorageData();
  await clearEncryptedNexprintSession();
  nexprintContextCache = null;
  return { ok: true };
});

ipcMain.handle('creality:connect', async (event) => {
  const existing = await readCrealityContext({ force: true });
  if (existing) {
    await storeEncryptedCrealitySession(existing);
    return { ok: true, user: existing.identity };
  }
  const parent = BrowserWindow.fromWebContents(event.sender);
  try {
    const { context, identity } = await openCrealityLoginAndCapture(parent);
    await storeEncryptedCrealitySession(context);
    crealityContextCache = {
      value: { ...context, identity },
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    return { ok: true, user: identity };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('creality:request', async (_event, request = {}) => {
  const context = await readCrealityContext();
  if (!context) {
    return {
      status: 401,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: 'missing_creality_session',
        message: 'Reconnect the Creality Cloud account in ModelPrep Desktop.',
      }),
    };
  }
  const url = validateWorkerUrl(request.url, WORKER_URL, 'creality');
  return crealityDirectClient.handleRequest({ ...request, url }, context);
});

ipcMain.handle('creality:disconnect', async () => {
  await crealitySession().clearStorageData();
  await clearEncryptedCrealitySession();
  crealityContextCache = null;
  return { ok: true };
});

ipcMain.handle('makeronline:connect', async (event) => {
  const existing = await readMakerOnlineContext({ force: true });
  if (existing) {
    await storeEncryptedMakerOnlineSession(existing);
    return { ok: true, user: existing.identity };
  }
  const parent = BrowserWindow.fromWebContents(event.sender);
  try {
    const { context, identity } = await openMakerOnlineLoginAndCapture(parent);
    await storeEncryptedMakerOnlineSession(context);
    makerOnlineContextCache = {
      value: { ...context, identity },
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    return { ok: true, user: identity };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('makeronline:request', async (_event, request = {}) => {
  const context = await readMakerOnlineContext();
  if (!context) {
    return {
      status: 401,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: 'missing_makeronline_session',
        message: 'Reconnect the MakerOnline account in ModelPrep Desktop.',
      }),
    };
  }
  const url = validateWorkerUrl(request.url, WORKER_URL, 'makeronline');
  return makerOnlineDirectClient.handleRequest({ ...request, url }, context);
});

ipcMain.handle('makeronline:disconnect', async () => {
  await makerOnlineSession().clearStorageData();
  await clearEncryptedMakerOnlineSession();
  makerOnlineContextCache = null;
  return { ok: true };
});

ipcMain.handle('myminifactory:connect', async (event) => {
  const existing = await readMyMiniFactoryContext({ force: true });
  if (existing) {
    await storeEncryptedMyMiniFactorySession(existing);
    return { ok: true, user: existing.identity };
  }
  const parent = BrowserWindow.fromWebContents(event.sender);
  try {
    const { context, identity } = await openMyMiniFactoryLoginAndCapture(parent);
    await storeEncryptedMyMiniFactorySession(context);
    myMiniFactoryContextCache = { value: { ...context, identity }, expiresAt: Date.now() + 5 * 60 * 1000 };
    return { ok: true, user: identity };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('myminifactory:request', async (_event, request = {}) => {
  const context = await readMyMiniFactoryContext();
  if (!context) {
    return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'missing_myminifactory_session', message: 'Reconnect the MyMiniFactory account in ModelPrep Desktop.' }) };
  }
  const url = validateWorkerUrl(request.url, WORKER_URL, 'myminifactory');
  return myMiniFactoryDirectClient.handleRequest({ ...request, url }, context);
});

ipcMain.handle('myminifactory:disconnect', async () => {
  await myMiniFactorySession().clearStorageData();
  await clearEncryptedMyMiniFactorySession();
  myMiniFactoryContextCache = null;
  return { ok: true };
});

ipcMain.handle('makeroad:connect', async (event) => {
  const existing = await readMakerRoadContext({ force: true });
  if (existing) { await storeEncryptedMakerRoadSession(existing); return { ok: true, user: existing.identity }; }
  try {
    const captured = await openMakerRoadLoginAndCapture(BrowserWindow.fromWebContents(event.sender));
    await storeEncryptedMakerRoadSession(captured.context);
    makerRoadContextCache = { value: { ...captured.context, identity: captured.identity }, expiresAt: Date.now() + 5 * 60 * 1000 };
    return { ok: true, user: captured.identity };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
});

ipcMain.handle('makeroad:request', async (_event, request = {}) => {
  const context = await readMakerRoadContext();
  if (!context) return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'missing_makeroad_session', message: 'Reconnect MakerRoad in ModelPrep Desktop.' }) };
  const url = validateWorkerUrl(request.url, WORKER_URL, 'makeroad');
  return makerRoadDirectClient.handleRequest({ ...request, url }, context);
});

ipcMain.handle('makeroad:disconnect', async () => {
  await makerRoadSession().clearStorageData();
  await clearEncryptedMakerRoadSession();
  makerRoadContextCache = null;
  return { ok: true };
});

ipcMain.handle('thangs:connect', async (event) => {
  const existing = await readThangsContext({ force: true }); if (existing) { await storeEncryptedThangsSession(existing); return { ok: true, user: existing.identity }; }
  try { const captured = await openThangsLoginAndCapture(BrowserWindow.fromWebContents(event.sender)); await storeEncryptedThangsSession(captured.context); thangsContextCache = { value: { ...captured.context, identity: captured.identity }, expiresAt: Date.now() + 300000 }; return { ok: true, user: captured.identity }; } catch (error) { return { ok: false, error: error.message }; }
});
ipcMain.handle('thangs:request', async (_event, request = {}) => { const context = await readThangsContext(); if (!context) return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'missing_thangs_session', message: 'Reconnect Thangs.' }) }; const url = validateWorkerUrl(request.url, WORKER_URL, 'thangs'); return thangsDirectClient.handleRequest({ ...request, url }, context); });
ipcMain.handle('thangs:disconnect', async () => { await thangsSession().clearStorageData(); await clearEncryptedThangsSession(); thangsContextCache = null; return { ok: true }; });
ipcMain.handle('thingiverse:connect', async (event) => { const existing = await readThingiverseContext({ force: true }); if (existing) { await storeEncryptedThingiverseSession(existing); return { ok: true, user: existing.identity, legalApproved: !!existing.identity.legalApproved }; } try { const captured = await openThingiverseLoginAndCapture(BrowserWindow.fromWebContents(event.sender)); await storeEncryptedThingiverseSession(captured.context); thingiverseContextCache = { value: { ...captured.context, identity: captured.identity }, expiresAt: Date.now() + 300000 }; return { ok: true, user: captured.identity, legalApproved: !!captured.identity.legalApproved }; } catch (error) { return { ok: false, error: error.message }; } });
ipcMain.handle('thingiverse:request', async (_event, request = {}) => { const context = await readThingiverseContext(); if (!context) return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'missing_thingiverse_session', message: 'Reconnect Thingiverse.' }) }; const url = validateWorkerUrl(request.url, WORKER_URL, 'thingiverse'); return thingiverseDirectClient.handleRequest({ ...request, url }, context); });
ipcMain.handle('thingiverse:disconnect', async () => { await thingiverseSession().clearStorageData(); await clearEncryptedThingiverseSession(); thingiverseContextCache = null; return { ok: true }; });

let mainWindow = null;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  mainWindow = createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
  });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
