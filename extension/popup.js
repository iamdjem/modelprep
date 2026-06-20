// One-click "Connect MakerWorld" for ModelPrep.
//
// Why this exists: MakerWorld sits behind Bambu SSO + Cloudflare, so ModelPrep can't
// log in server-side, and a web page is forbidden from reading the MakerWorld session
// cookie (it's HttpOnly). A browser extension IS allowed to read it. This popup reads
// the user's live MakerWorld session and drops it into ModelPrep's localStorage, so the
// app connects exactly as if the cookie had been pasted — but with a single click.

const MODELPREP_URLS = [
  'https://iamdjem.github.io/modelprep',
  'http://localhost:5173',
  'http://localhost:4173',
];
const COOKIE_NAMES = ['token', 'cf_clearance', 'refreshToken']; // token + cf_clearance required; refreshToken optional (longevity)
const MW_KEY = 'modelprep:makerworld-cookie'; // must match MW_COOKIE_KEY in deploy/src/App.jsx

const $ = (id) => document.getElementById(id);
function setStatus(msg, kind) { const el = $('status'); el.textContent = msg; el.className = kind || 'info'; }

// Assemble the MakerWorld cookie string, or null if not logged in.
async function getMwCookie() {
  const cks = await chrome.cookies.getAll({ domain: 'makerworld.com' });
  const map = {};
  for (const c of cks) { if (COOKIE_NAMES.includes(c.name) && c.value) map[c.name] = c.value; }
  if (!map.token || !map.cf_clearance) return null;
  return COOKIE_NAMES.filter((n) => map[n]).map((n) => `${n}=${map[n]}`).join('; ');
}

async function findModelprepTab() {
  const tabs = await chrome.tabs.query({});
  return tabs.find((t) => t.url && MODELPREP_URLS.some((u) => t.url.startsWith(u)));
}

function waitForComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') { chrome.tabs.onUpdated.removeListener(listener); resolve(); } };
    chrome.tabs.onUpdated.addListener(listener);
    // safety timeout
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 8000);
  });
}

// Runs IN the ModelPrep page: store the cookie the way the app expects, then reload so
// the React app picks it up on mount and shows "connected".
function injectCookie(cookie, key) {
  try { localStorage.setItem(key, cookie); location.reload(); return true; } catch (e) { return false; }
}

async function refreshLoginState() {
  const cookie = await getMwCookie();
  const ok = !!cookie;
  $('mwDot').className = 'dot ' + (ok ? 'on' : 'off');
  $('mwState').textContent = ok ? 'Logged into MakerWorld' : 'Not logged into MakerWorld';
  $('connect').disabled = !ok;
  return ok;
}

async function connect() {
  setStatus('Connecting…', 'info');
  const cookie = await getMwCookie();
  if (!cookie) { setStatus('Not logged into MakerWorld. Open it, log in, then try again.', 'err'); return; }
  try {
    let tab = await findModelprepTab();
    if (!tab) { tab = await chrome.tabs.create({ url: MODELPREP_URLS[0] + '/' }); await waitForComplete(tab.id); }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectCookie, args: [cookie, MW_KEY] });
    await chrome.tabs.update(tab.id, { active: true });
    setStatus('Connected. ModelPrep is now signed into MakerWorld.', 'ok');
  } catch (e) {
    setStatus('Could not reach the ModelPrep tab: ' + (e && e.message ? e.message : e), 'err');
  }
}

$('connect').addEventListener('click', connect);
$('openMw').addEventListener('click', async () => {
  await chrome.tabs.create({ url: 'https://makerworld.com/en/login' });
  setStatus('Log into MakerWorld in the new tab, then reopen this and click Connect.', 'info');
});

refreshLoginState();
