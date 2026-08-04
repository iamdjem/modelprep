// Headless probe: does an in-page fetch from a real Chromium window on the
// cults3d.com origin get past Cloudflare's edge? Signed-out we expect a
// redirect to the login page (synthesized 302 + Location), NOT a 403 challenge.
// Run: node_modules/.bin/electron scripts/cults-transport-probe.js
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const os = require('node:os');
const { buildFetchScript, buildRequestDescriptor } = require('../cults-window-fetch');

const CULTS_BASE = 'https://cults3d.com';
app.setPath('userData', path.join(os.tmpdir(), 'cults-probe-userdata'));

async function main() {
  const partition = 'persist:cults-probe';
  const win = new BrowserWindow({ show: false, width: 980, height: 900, webPreferences: { partition, contextIsolation: true, nodeIntegration: false } });
  const out = (obj) => process.stdout.write('PROBE ' + JSON.stringify(obj) + '\n');

  await new Promise((resolve) => {
    win.webContents.once('did-finish-load', resolve);
    win.webContents.once('did-fail-load', (_e, code, desc) => { out({ load: 'fail', code, desc }); resolve(); });
    win.loadURL(`${CULTS_BASE}/en/creations/new`);
  });
  out({ pageUrl: win.webContents.getURL(), pageTitle: win.webContents.getTitle() });

  // Give Cloudflare's managed challenge time to auto-solve in a legit browser.
  for (let i = 0; i < 20; i += 1) {
    const title = win.webContents.getTitle();
    if (!/just a moment|attention required|verif/i.test(title)) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  out({ afterWaitUrl: win.webContents.getURL(), afterWaitTitle: win.webContents.getTitle() });

  const script = buildFetchScript(buildRequestDescriptor(`${CULTS_BASE}/en/creations/new`, { headers: { Accept: 'text/html' }, redirect: 'manual' }));
  try {
    const env = await win.webContents.executeJavaScript(script, true);
    const body = env.bodyBase64 ? Buffer.from(env.bodyBase64, 'base64').toString('utf8') : '';
    out({
      status: env.status,
      location: env.headers && env.headers.location,
      finalUrl: env.finalUrl,
      cfMitigated: env.headers && env.headers['cf-mitigated'],
      challenge: /just a moment|challenge-platform|cf-chl-/i.test(body),
      looksLikeLogin: /sign[-_ ]?in|log[-_ ]?in|users\/sign_in|password/i.test(body),
      bodyBytes: body.length,
    });
  } catch (e) {
    out({ error: e && e.message ? e.message : String(e) });
  }
  app.quit();
}

app.whenReady().then(main).catch((e) => { process.stdout.write('PROBE ' + JSON.stringify({ fatal: String(e) }) + '\n'); app.quit(); });
