// MakerWorld BOM catalog refresh — the RELIABLE path (scheduled or manual).
//
// IMPORTANT: the catalog lives only in the edit page's SSR data (_next/data → pageProps),
// and Cloudflare returns 403 "Just a moment" for SERVER-SIDE fetches of MakerWorld HTML/
// _next/data (only /api/v1/* passes server-side). So the catalog can ONLY be harvested by
// a REAL BROWSER holding a valid session — this script drives Playwright to do that
// in-page (where Cloudflare is satisfied), then writes the bundled seed at
// deploy/src/data/makerworld-bom-catalog.json and the current submit-blocking
// deploy/src/data/makerworld-forbidden-words.json policy seed.
//
// Requires: `npm i -D playwright` (+ a Chrome) and a MakerWorld session cookie:
//   MW_COOKIE='token=…; cf_clearance=…; refreshToken=…' node backend/scripts/harvest-bom-catalog.mjs
// (cf_clearance is required — it's what lets the browser past Cloudflare.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const COOKIE = process.env.MW_COOKIE;
if (!COOKIE || !/token=/.test(COOKIE) || !/cf_clearance=/.test(COOKIE)) { console.error('Set MW_COOKIE="token=…; cf_clearance=…" (cf_clearance required)'); process.exit(1); }
const CHROME = process.env.MW_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const cookies = COOKIE.split(';').map((p) => p.trim()).filter(Boolean).map((p) => { const i = p.indexOf('='); return { name: p.slice(0, i), value: p.slice(i + 1), domain: '.makerworld.com', path: '/' }; });
const trim = (n) => { const o = { value: n.value, label: n.label, sku: n.sku, title: n.title, image: n.image }; if (n.pieces != null) o.pieces = n.pieces; if (n.handle) o.handle = n.handle; if (n.filamentCodes) o.filamentCodes = n.filamentCodes; if (Array.isArray(n.parentIds)) o.parentIds = n.parentIds; if (Array.isArray(n.children) && n.children.length) o.children = n.children.map(trim); return o; };
const count = (a) => a.reduce((n, it) => n + 1 + (it.children ? count(it.children) : 0), 0);

const ctx = await chromium.launchPersistentContext(path.join(path.dirname(fileURLToPath(import.meta.url)), '.harvest-profile'), {
  executablePath: CHROME, headless: false, viewport: null, userAgent: UA,
  ignoreDefaultArgs: ['--enable-automation', '--use-mock-keychain', '--password-store=basic'],
  args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--no-default-browser-check', '--restore-last-session=false'],
});
await ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch {} });
await ctx.addCookies(cookies);
const page = ctx.pages()[0] || (await ctx.newPage());
try {
  // create a draft (catalog is on the edit page), read its SSR data in-page, then delete.
  await page.goto('https://makerworld.com/en', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
  const cat = await page.evaluate(async () => {
    const H = { 'X-BBL-Client-Type': 'web', 'X-BBL-Client-Version': '00.00.00.01', 'X-BBL-App-Source': 'makerworld', 'X-BBL-Client-Name': 'MakerWorld', 'Content-Type': 'application/json', Accept: 'application/json' };
    const bid = window.__NEXT_DATA__?.buildId;
    const cr = await fetch('/api/v1/design-service/my/draft', { method: 'POST', headers: H, credentials: 'include', body: JSON.stringify({ title: 'modelprep-catalog-refresh', summary: '', categoryId: 0, tags: [], cover: '', license: 'Standard Digital File License', modelSource: 'original', modelFiles: [], clickWhich: 'next' }) });
    const { id } = await cr.json();
    try {
      const ej = await (await fetch(`/_next/data/${bid}/en/my/models/drafts/${id}/edit.json`, { headers: { 'x-nextjs-data': '1' }, credentials: 'include' })).json();
      return { pp: ej.pageProps };
    } finally { await fetch(`/api/v1/design-service/my/draft/${id}`, { method: 'DELETE', headers: H, credentials: 'include' }).catch(() => {}); }
  });
  const pp = cat.pp || {};
  const out = { kits: (pp.boms ?? []).map(trim), filaments: (pp.filamentBoms ?? []).map(trim), materials: (pp.materials ?? []).map(trim), fetchedAt: new Date().toISOString() };
  if (!out.kits.length) throw new Error('catalog empty — session may be invalid');
  const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'deploy', 'src', 'data', 'makerworld-bom-catalog.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out));
  const forbiddenDest = path.join(path.dirname(dest), 'makerworld-forbidden-words.json');
  fs.writeFileSync(forbiddenDest, JSON.stringify(Array.isArray(pp.forbiddenWords) ? pp.forbiddenWords : []));
  console.log(`wrote ${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)}KB) — kits=${count(out.kits)} filaments=${count(out.filaments)} materials=${count(out.materials)} nodes`);
  console.log(`wrote ${forbiddenDest} (${Array.isArray(pp.forbiddenWords) ? pp.forbiddenWords.length : 0} blocked terms)`);
} finally { await ctx.close(); }
