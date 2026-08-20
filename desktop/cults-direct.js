const CULTS_BASE = 'https://cults3d.com';
const CULTS_S3_URL = 'https://s3.eu-west-3.amazonaws.com/files.cults3d.com';
const USER_AGENT = 'Mozilla/5.0 (compatible; ModelPrep/0.2; +https://github.com/iamdjem/modelprep)';
const CULTS_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const CULTS_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const CULTS_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
// The current first-party uploader rejects these characters in any file name
// before requesting an S3 policy (`Invalid character “X”`). Verified in both
// the documented upload bundle and the newer one the deployed manifest points
// at, so ModelPrep fails closed here instead of at the platform.
const CULTS_FORBIDDEN_FILENAME_CHARS = ['&', '>', '<'];
const CULTS_META_TAGS = new Set([
  'articulated', 'customizable', 'functional_part', 'hollow_model', 'multicolor', 'multi_material',
  'no_support', 'print_in_place', 'remix', 'resin_print', 'scale_model', 'scan',
]);

const CATEGORY_IDS = {
  'Home & Living': 30,
  Tools: 27,
  'Toys & Games': 31,
  'Hobby & DIY': 29,
  'Art & Decor': 23,
  'Fashion & Jewelry': 24,
  'Electronics & Tech': 25,
  'Outdoor & Garden': 29,
  Educational: 29,
  'Miniatures & Tabletop': 31,
  'Cosplay & Props': 24,
  'Holiday & Seasonal': 29,
  Other: 29,
};

const LICENSES = {
  cc0: 'cc_pddc',
  ccby: 'cc_by',
  ccbysa: 'cc_by_sa',
  ccbync: 'cc_by_nc',
  ccbyncsa: 'cc_by_nc_sa',
  ccbynd: 'cc_by_nd',
  standard: 'cults_cu',
};

const LICENSE_RULES = {
  cults_pu: { free: true, paid: true },
  cults_cu: { free: false, paid: true },
  cults_cu_nd: { free: false, paid: true },
  cc_by: { free: true, paid: false },
  cc_by_sa: { free: true, paid: false },
  cc_by_nd: { free: true, paid: false },
  cc_by_nc: { free: true, paid: false },
  cc_by_nc_sa: { free: true, paid: false },
  cc_by_nc_nd: { free: true, paid: false },
  cc_pddc: { free: true, paid: false },
  cern_ohl: { free: true, paid: false },
  gpl: { free: true, paid: false },
  lgpl: { free: true, paid: false },
  mit: { free: true, paid: false },
};

function jsonResponse(body, status = 200) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function errorResponse(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (error?.code === 'CULTS_CHALLENGE_REQUIRED') {
    return jsonResponse({ error: 'cults_challenge_required', message }, 401);
  }
  if (error?.code === 'CULTS_SESSION_REQUIRED') {
    return jsonResponse({ error: 'missing_cults_session', message }, 401);
  }
  return jsonResponse({ error: 'web_flow_failed', message }, 502);
}

class CultsSessionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CultsSessionError';
    this.code = code;
  }
}

function isCultsChallengeResponse(response, html = '') {
  if (response?.status !== 403) return false;
  const mitigated = response.headers?.get?.('cf-mitigated');
  return mitigated === 'challenge' || /just a moment|challenge-platform|cf-chl-/i.test(String(html));
}

async function assertNotCultsChallenge(response) {
  if (response?.status !== 403) return response;
  let html = '';
  try { html = await response.clone().text(); } catch { /* header detection is still useful */ }
  if (isCultsChallengeResponse(response, html)) {
    throw new CultsSessionError(
      'Cults3D requires a browser security check. Reconnect this account and complete the Cults3D window.',
      'CULTS_CHALLENGE_REQUIRED',
    );
  }
  return response;
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const combined = headers.get('set-cookie');
  if (!combined) return [];
  return combined.split(/,(?=\s*[^;,=\s]+=[^;,]*)/);
}

function mergeCookies(existing, response) {
  const jar = new Map();
  for (const part of String(existing || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) jar.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  for (const setCookie of getSetCookies(response.headers)) {
    const pair = setCookie.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

function extractCsrfToken(html) {
  return (
    html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']csrf-token["']/i)
  )?.[1] || null;
}

function resolveCategory(value) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && Object.values(CATEGORY_IDS).includes(numeric)) {
    return { categoryId: numeric, substituted: false };
  }
  if (CATEGORY_IDS[value]) return { categoryId: CATEGORY_IDS[value], substituted: false };
  return null;
}

function resolveLicense(value, isPaid) {
  const requested = LICENSE_RULES[value] ? value : LICENSES[value];
  if (!requested || !LICENSE_RULES[requested]?.[isPaid ? 'paid' : 'free']) return null;
  return { licenseType: requested, substituted: false };
}

async function login(credentials, fetchImpl) {
  const signInUrl = `${CULTS_BASE}/en/users/sign-in`;
  const page = await fetchImpl(signInUrl, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'manual',
  });
  await assertNotCultsChallenge(page);
  if (!page.ok) throw new Error(`Cults sign-in page returned HTTP ${page.status}.`);
  let cookies = mergeCookies('', page);
  const initialCsrf = extractCsrfToken(await page.text());
  if (!initialCsrf) throw new Error('Cults sign-in page no longer exposes its expected security token.');

  const form = new URLSearchParams();
  form.set('authenticity_token', initialCsrf);
  form.set('user[email]', credentials.email);
  form.set('user[password]', credentials.password);
  form.set('user[time_zone]', '');
  form.set('commit', 'Log in');
  const signedIn = await fetchImpl(signInUrl, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookies,
      Origin: CULTS_BASE,
      Referer: signInUrl,
    },
    body: form.toString(),
    redirect: 'manual',
  });
  cookies = mergeCookies(cookies, signedIn);
  const location = signedIn.headers.get('location') || '';
  if (![302, 303].includes(signedIn.status) || /\/users\/sign-in/.test(location)) {
    throw new Error('Cults3D rejected the email or password.');
  }

  const creationPage = await fetchImpl(`${CULTS_BASE}/en/creations/new`, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', Cookie: cookies },
    redirect: 'manual',
  });
  cookies = mergeCookies(cookies, creationPage);
  if ([302, 303].includes(creationPage.status)) {
    const destination = creationPage.headers.get('location') || '';
    if (/\/users\/confirmation/i.test(destination)) {
      throw new Error('Confirm this Cults3D account by email, then try again.');
    }
    if (/\/users\/sign-in/i.test(destination)) {
      throw new Error('Cults3D did not keep the authenticated session.');
    }
    throw new Error(`Cults3D requires another account step: ${destination || 'unknown redirect'}.`);
  }
  if (!creationPage.ok) throw new Error(`Cults3D account check returned HTTP ${creationPage.status}.`);
  const csrfToken = extractCsrfToken(await creationPage.text());
  if (!csrfToken) throw new Error('Cults3D upload page no longer exposes its expected security token.');
  return { cookies, csrfToken };
}

async function verifyManagedSession(fetchImpl) {
  const creationPage = await fetchImpl(`${CULTS_BASE}/en/creations/new`, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'manual',
  });
  await assertNotCultsChallenge(creationPage);
  if ([301, 302, 303, 307, 308].includes(creationPage.status)) {
    const destination = creationPage.headers.get('location') || '';
    if (/\/users\/confirmation/i.test(destination)) {
      throw new CultsSessionError('Confirm this Cults3D account by email, then reconnect.', 'CULTS_SESSION_REQUIRED');
    }
    throw new CultsSessionError('Sign in to Cults3D in the browser window to continue.', 'CULTS_SESSION_REQUIRED');
  }
  if (!creationPage.ok) throw new Error(`Cults3D account check returned HTTP ${creationPage.status}.`);
  const csrfToken = extractCsrfToken(await creationPage.text());
  if (!csrfToken) {
    throw new CultsSessionError('Cults3D did not expose an authenticated upload page. Reconnect this account.', 'CULTS_SESSION_REQUIRED');
  }
  return { cookies: '', csrfToken, managed: true };
}

function parseMultipartEntries(request) {
  if (request.bodyType !== 'form-data' || !Array.isArray(request.body)) {
    throw new Error('Cults desktop publish requires multipart form data.');
  }
  const fields = new Map();
  const files = new Map();
  for (const entry of request.body) {
    if (!entry?.name) continue;
    if (entry.kind === 'text') {
      if (!fields.has(entry.name)) fields.set(entry.name, []);
      fields.get(entry.name).push(String(entry.value ?? ''));
    } else if (entry.kind === 'file') {
      if (!files.has(entry.name)) files.set(entry.name, []);
      files.get(entry.name).push({
        blob: new Blob([entry.bytes], { type: entry.mimeType || 'application/octet-stream' }),
        filename: entry.fileName || 'upload.bin',
      });
    }
  }
  return {
    text: (name) => fields.get(name)?.[0] || '',
    texts: (name) => fields.get(name) || [],
    files: (name) => files.get(name) || [],
  };
}

function parseJsonBody(request) {
  if (request.bodyType === 'none' || request.body == null) return {};
  if (request.bodyType !== 'text') throw new Error('Cults desktop action requires a JSON body.');
  return JSON.parse(String(request.body));
}

function cultsIllustrationKind(file) {
  const mime = String(file?.blob?.type || '').toLowerCase();
  if (CULTS_IMAGE_TYPES.has(mime)) return 'image';
  if (CULTS_VIDEO_TYPES.has(mime)) return 'video';
  return null;
}

async function uploadFile(session, file, kind, fetchImpl) {
  const policyResponse = await fetchImpl(`${CULTS_BASE}/en/file_uploaders/new?${kind}=true`, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookies,
      Referer: `${CULTS_BASE}/en/creations/new`,
    },
  });
  if (!policyResponse.ok) {
    throw new Error(`Cults upload authorization for ${file.filename} returned HTTP ${policyResponse.status}.`);
  }
  const policy = await policyResponse.json();
  if (!policy?.key || !policy?.policy || !policy?.['x-amz-signature']) {
    throw new Error('Cults returned an incomplete S3 upload authorization.');
  }

  const s3Form = new FormData();
  for (const [name, value] of Object.entries(policy)) s3Form.set(name, value);
  s3Form.set('Content-Type', file.blob.type || 'application/octet-stream');
  s3Form.set('file', file.blob, file.filename);
  const uploaded = await fetchImpl(CULTS_S3_URL, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml', Referer: `${CULTS_BASE}/` },
    body: s3Form,
  });
  if (![201, 204].includes(uploaded.status)) {
    throw new Error(`Cults storage upload for ${file.filename} returned HTTP ${uploaded.status}: ${(await uploaded.text()).slice(0, 240)}`);
  }

  const key = String(policy.key).replace('${filename}', file.filename);
  const endpoint = kind === 'blueprint' ? 'blueprints' : 'illustrations';
  const registered = await fetchImpl(`${CULTS_BASE}/en/${endpoint}`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookies,
      Referer: `${CULTS_BASE}/en/creations/new`,
    },
    body: JSON.stringify({ key }),
  });
  if (!registered.ok) {
    throw new Error(`Cults registration for ${file.filename} returned HTTP ${registered.status}.`);
  }
  const data = await registered.json();
  const id = data.id ?? data.blueprint?.id ?? data.illustration?.id;
  if (typeof id !== 'number') throw new Error(`Cults did not return an upload ID for ${file.filename}.`);
  return id;
}

async function createCreation(session, payload, fetchImpl) {
  const form = new URLSearchParams();
  form.set('authenticity_token', session.csrfToken);
  form.set('creation[locale]', 'en');
  form.set('creation[name]', payload.name);
  form.set('creation[description]', payload.description);
  form.set('creation[details]', payload.details || '');
  form.append('creation[usages][]', '');
  form.append('creation[usages][]', '3dp');
  form.set('creation[category_id]', String(payload.categoryId));
  form.append('creation[sub_category_ids][]', '');
  form.append('creation[meta_tags][]', '');
  for (const tag of payload.metaTags) form.append('creation[meta_tags][]', tag);
  form.set('creation[flat_keywords]', payload.flatKeywords);
  for (const id of payload.blueprintIds) form.append('creation[blueprint_ids][]', String(id));
  for (const id of payload.illustrationIds) form.append('creation[illustration_ids][]', String(id));
  form.set('creation[made_with_ai]', payload.madeWithAi ? '1' : '0');
  form.append('creation[show_comments]', '0');
  if (payload.showComments) form.append('creation[show_comments]', '1');
  form.set('button', '');
  const response = await fetchImpl(`${CULTS_BASE}/en/creations`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: session.cookies,
      Origin: CULTS_BASE,
      Referer: `${CULTS_BASE}/en/creations/new`,
      'Upgrade-Insecure-Requests': '1',
    },
    body: form.toString(),
    redirect: 'manual',
  });
  if (response.status === 422) {
    const html = await response.text();
    const message = html.match(/<div[^>]*class="[^"]*alert[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
    throw new Error(`Cults rejected the model details: ${message?.replace(/<[^>]+>/g, ' ').trim() || 'validation failed'}.`);
  }
  if (response.status !== 302) throw new Error(`Cults model creation returned HTTP ${response.status}.`);
  const location = response.headers.get('location') || '';
  const slug = location.match(/\/en\/creations\/([^/]+)\/price\/edit/)?.[1];
  if (!slug) throw new Error(`Cults returned an unexpected model creation URL: ${location || '(empty)'}.`);
  return slug;
}

async function publishPrice(session, slug, payload, fetchImpl) {
  const form = new URLSearchParams();
  form.set('_method', 'patch');
  form.set('authenticity_token', session.csrfToken);
  form.set('creation[in_store]', 'true');
  form.set('creation[currency]', payload.currency);
  form.set('creation[pricing]', payload.pricing);
  form.set('creation[download_price]', String(payload.downloadPrice));
  form.set('creation[download_open_price]', String(payload.downloadOpenPrice));
  form.set('creation[license_type]', payload.licenseType);
  form.set('creation[visibility]', payload.visibility);
  form.set('commit', 'Publish');
  const response = await fetchImpl(`${CULTS_BASE}/en/creations/${encodeURIComponent(slug)}/price`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: session.cookies,
      Origin: CULTS_BASE,
      Referer: `${CULTS_BASE}/en/creations/${encodeURIComponent(slug)}/price/edit`,
      'Upgrade-Insecure-Requests': '1',
    },
    body: form.toString(),
    redirect: 'manual',
  });
  if (![302, 303].includes(response.status)) {
    const html = await response.text();
    const message = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
    throw new Error(`Cults publish returned HTTP ${response.status}${message ? `: ${message}` : ''}.`);
  }
  const designUrl = response.headers.get('location') || '';
  if (!/^https?:\/\/cults3d\.com\/en\/3d-model\//.test(designUrl)) {
    throw new Error(`Cults returned an unexpected published-model URL: ${designUrl || '(empty)'}.`);
  }
  return designUrl;
}

async function unpublish(session, slug, fetchImpl) {
  const form = new URLSearchParams();
  form.set('authenticity_token', session.csrfToken);
  const response = await fetchImpl(`${CULTS_BASE}/en/creations/${encodeURIComponent(slug)}/unpublish`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/vnd.turbo-stream.html, text/html, application/xhtml+xml',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookies,
      Referer: `${CULTS_BASE}/en/creations/mine`,
    },
    body: form.toString(),
    redirect: 'manual',
  });
  if (![200, 302].includes(response.status)) {
    throw new Error(`Cults deactivate returned HTTP ${response.status}.`);
  }
  return response.headers.get('location') || '';
}

async function deleteCreation(session, slug, fetchImpl) {
  const response = await fetchImpl(`${CULTS_BASE}/en/creations/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html, application/xhtml+xml, text/vnd.turbo-stream.html',
      'X-CSRF-Token': session.csrfToken,
      Cookie: session.cookies,
      Referer: `${CULTS_BASE}/en/creations/mine`,
    },
    redirect: 'manual',
  });
  if (![200, 302, 303].includes(response.status)) {
    throw new Error(`Cults delete returned HTTP ${response.status}.`);
  }
  return response.headers.get('location') || '';
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function htmlAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`\\b${escaped}=(['"])([\\s\\S]*?)\\1`, 'i'))?.[2] || '';
}

function cultsAssetReadback(html, kind) {
  const fieldName = `creation[${kind}_ids][]`;
  const ids = [...html.matchAll(/<input\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => decodeHtml(htmlAttribute(tag, 'name')) === fieldName)
    .map((tag) => Number(htmlAttribute(tag, 'value')))
    .filter((value) => Number.isInteger(value) && value > 0);
  const pathMarker = `/${kind}-file/`;
  const filenames = [...html.matchAll(/<a\b[^>]*>/gi)]
    .map((match) => htmlAttribute(match[0], 'href'))
    .filter((href) => href.includes(pathMarker))
    .map((href) => {
      try {
        return decodeURIComponent(new URL(href, CULTS_BASE).pathname.split('/').pop() || '');
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  return { ids, filenames };
}

async function readCreation(session, slug, fetchImpl, { attempts = 10, delayMs = 1000 } = {}) {
  let response;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    response = await fetchImpl(`${CULTS_BASE}/en/creations/${encodeURIComponent(slug)}/edit`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', Cookie: session.cookies },
      redirect: 'manual',
    });
    if (response.ok || response.status !== 404 || attempt === attempts) break;
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  if (!response?.ok) throw new Error(`Cults edit readback returned HTTP ${response?.status || 0}.`);
  const html = await response.text();
  const nameInput = [...html.matchAll(/<input\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => decodeHtml(htmlAttribute(tag, 'name')) === 'creation[name]');
  const listing = (await listCreations(session, fetchImpl)).find((item) => item.slug === slug) || null;
  return {
    slug,
    title: nameInput ? decodeHtml(htmlAttribute(nameInput, 'value')) : '',
    status: listing?.status || 'missing',
    blueprints: cultsAssetReadback(html, 'blueprint'),
    illustrations: cultsAssetReadback(html, 'illustration'),
  };
}

function cultsReadbackIssues(expected, actual) {
  const issues = [];
  const compare = (label, expectedValues, actualValues) => {
    if (expectedValues.length !== actualValues.length) {
      issues.push(`Cults readback returned ${actualValues.length} ${label}; expected ${expectedValues.length}.`);
      return;
    }
    expectedValues.forEach((value, index) => {
      if (String(value) !== String(actualValues[index])) issues.push(`Cults readback changed ordered ${label} item ${index + 1}.`);
    });
  };
  if (actual.title !== expected.title) issues.push('Cults readback changed the listing title.');
  if (actual.status !== expected.visibility) issues.push(`Cults readback returned ${actual.status} visibility; expected ${expected.visibility}.`);
  compare('blueprint IDs', expected.blueprintIds, actual.blueprints.ids);
  compare('blueprint filenames', expected.blueprintFilenames, actual.blueprints.filenames);
  compare('illustration IDs', expected.illustrationIds, actual.illustrations.ids);
  compare('illustration filenames', expected.illustrationFilenames, actual.illustrations.filenames);
  return issues;
}

async function listCreations(session, fetchImpl) {
  const response = await fetchImpl(`${CULTS_BASE}/en/creations/mine`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', Cookie: session.cookies },
  });
  if (!response.ok) throw new Error(`Cults model list returned HTTP ${response.status}.`);
  const html = await response.text();
  const table = html.match(/<div[^>]*id="creations-my-creations-\d+"[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  const body = table?.match(/<tbody[^>]*>([\s\S]*)$/i)?.[1];
  if (!body) return [];
  const creations = [];
  const rows = body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const match of rows) {
    const row = match[1];
    const titleFirst = row.match(/<a[^>]*\btitle="([^"]+)"[^>]*\bhref="\/en\/creations\/([a-z0-9_-]+)"/i);
    const hrefFirst = row.match(/<a[^>]*\bhref="\/en\/creations\/([a-z0-9_-]+)"[^>]*\btitle="([^"]+)"/i);
    const slug = titleFirst?.[2] || hrefFirst?.[1];
    const title = titleFirst?.[1] || hrefFirst?.[2];
    if (!slug || !title) continue;
    const badge = row.match(/<span[^>]*class="[^"]*text-marker[^"]*"[^>]*>\s*([^<]+)<\/span>/i)?.[1]?.trim().toLowerCase() || '';
    const priceCell = row.match(/<td[^>]*class="[^"]*price-cell[^"]*"[^>]*>([\s\S]*?)<\/td>/i)?.[1] || '';
    creations.push({
      slug,
      title: decodeHtml(title),
      url: `${CULTS_BASE}/en/creations/${slug}`,
      editUrl: `${CULTS_BASE}/en/creations/${slug}/edit`,
      thumbnailUrl: row.match(/<img[^>]*\bsrc="([^"]+)"/i)?.[1] || null,
      status: badge.startsWith('offline') ? 'offline' : badge.startsWith('secret') ? 'secret' : 'public',
      priceLabel: priceCell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
  }
  return creations;
}

function createCultsDirectClient({
  fetchImpl = fetch,
  fetchImplForAccount = null,
  managedSession = false,
  sessionMaxAgeMs = 30 * 60 * 1000,
} = {}) {
  const sessions = new Map();

  function accountFetch(accountId) {
    const rawFetch = fetchImplForAccount ? fetchImplForAccount(accountId) : fetchImpl;
    return async (...args) => {
      const response = await assertNotCultsChallenge(await rawFetch(...args));
      if (managedSession) {
        let requested = null;
        let finalUrl = null;
        try { requested = new URL(String(args[0])); } catch { /* malformed URLs fail elsewhere */ }
        try { finalUrl = response.url ? new URL(response.url) : null; } catch { /* */ }
        const cultsRequest = requested?.hostname === 'cults3d.com' || requested?.hostname?.endsWith('.cults3d.com');
        const fellBackToLogin = finalUrl && /\/(?:users\/sign-in|log-in-choice)(?:\/|$)/i.test(finalUrl.pathname);
        if (cultsRequest && fellBackToLogin && !/\/users\/sign-in(?:\/|$)/i.test(requested.pathname)) {
          throw new CultsSessionError('The Cults3D session expired. Reconnect this account.', 'CULTS_SESSION_REQUIRED');
        }
      }
      return response;
    };
  }

  async function getSession(credentials, accountId, force = false) {
    const cached = sessions.get(accountId);
    if (!force && cached && Date.now() - cached.createdAt < sessionMaxAgeMs) return cached.session;
    const request = accountFetch(accountId);
    const authenticated = managedSession
      ? await verifyManagedSession(request)
      : await login(credentials, request);
    sessions.set(accountId, { session: authenticated, createdAt: Date.now() });
    return authenticated;
  }

  async function connect(credentials, accountId = 'default') {
    if (!managedSession && (!credentials?.email || !credentials?.password)) throw new Error('Cults3D email and password are required.');
    await getSession(credentials, accountId, true);
    return { ok: true, ...(credentials?.email ? { email: credentials.email } : {}) };
  }

  async function publish(request, credentials, accountId) {
    const form = parseMultipartEntries(request);
    const models = form.files('model');
    const illustrations = form.files('illustration');
    if (!models.length) return jsonResponse({ error: 'missing_files', hint: 'At least one model file is required.' }, 400);
    if (!illustrations.length) return jsonResponse({ error: 'missing_files', hint: 'At least one cover image is required.' }, 400);
    const illustrationKinds = illustrations.map(cultsIllustrationKind);
    if (illustrationKinds.some((kind) => !kind)) {
      return jsonResponse({ error: 'unsupported_media', hint: 'Cults3D illustrations must be JPEG, PNG, WebP, GIF, MP4, or WebM.' }, 400);
    }
    if (illustrationKinds[0] !== 'image') {
      return jsonResponse({ error: 'invalid_cover', hint: 'The first Cults3D illustration must be a cover image, not a video.' }, 400);
    }
    if (illustrations.some((file) => file.blob.size > CULTS_MEDIA_MAX_BYTES)) {
      return jsonResponse({ error: 'media_too_large', hint: 'Cults3D media must not exceed 10 MiB each.' }, 400);
    }
    for (const file of [...models, ...illustrations]) {
      const bad = CULTS_FORBIDDEN_FILENAME_CHARS.find((char) => String(file.filename || '').includes(char));
      if (bad) {
        return jsonResponse({
          error: 'invalid_filename',
          hint: `Cults3D rejects the character “${bad}” in file names. Rename “${file.filename}” before publishing.`,
        }, 400);
      }
    }

    const explicitFree = form.text('free') === 'true' || form.text('pricing') === 'free' || form.text('price') === '0';
    const price = Number(form.text('downloadPrice') || form.text('price'));
    const paid = !explicitFree && Number.isFinite(price) && price > 0;
    const rawPricing = form.text('pricing');
    const pricing = rawPricing === 'paid' ? 'priced'
      : rawPricing === 'open' ? 'open_priced'
        : rawPricing || (paid ? 'priced' : 'free');
    const category = resolveCategory(form.text('categoryId') || form.text('category'));
    if (!category) {
      return jsonResponse({ error: 'invalid_category', hint: 'Choose an explicit supported Cults3D category before uploading files.' }, 400);
    }
    const license = resolveLicense(form.text('licenseType') || form.text('license'), paid);
    if (!license) {
      return jsonResponse({ error: 'invalid_license', hint: `Choose a Cults3D license that is valid for a ${paid ? 'paid' : 'free'} listing before uploading files.` }, 400);
    }
    let tags = form.text('flatKeywords');
    if (!tags) {
      const values = form.texts('tags');
      if (values.length === 1) {
        try {
          const parsed = JSON.parse(values[0]);
          tags = Array.isArray(parsed) ? parsed.filter(Boolean).join(' ') : String(parsed);
        } catch { tags = values[0]; }
      } else tags = values.filter(Boolean).join(' ');
    }
    let metaTags = [];
    const metaTagsRaw = form.text('metaTags');
    if (metaTagsRaw) {
      try { metaTags = JSON.parse(metaTagsRaw); } catch { return jsonResponse({ error: 'invalid_meta_tags', hint: 'Cults3D meta tags must be a JSON array.' }, 400); }
    } else metaTags = form.texts('metaTag');
    if (!Array.isArray(metaTags) || metaTags.some((tag) => !CULTS_META_TAGS.has(String(tag)))) {
      return jsonResponse({ error: 'invalid_meta_tags', hint: 'Cults3D received an unknown meta tag.' }, 400);
    }
    const substituted = [];

    const requestFetch = accountFetch(accountId);
    const session = await getSession(credentials, accountId);
    const blueprintIds = [];
    for (const model of models) blueprintIds.push(await uploadFile(session, model, 'blueprint', requestFetch));
    const illustrationIds = [];
    for (const illustration of illustrations) illustrationIds.push(await uploadFile(session, illustration, 'illustration', requestFetch));
    const slug = await createCreation(session, {
      name: form.text('name').trim() || 'ModelPrep web-flow publish',
      description: form.text('description').trim() || 'Sent from ModelPrep.',
      details: form.text('details'),
      categoryId: category.categoryId,
      flatKeywords: tags,
      metaTags,
      blueprintIds,
      illustrationIds,
      madeWithAi: form.text('madeWithAi') === 'true',
      showComments: form.text('showComments') !== 'false',
    }, requestFetch);
    let designUrl;
    try {
      designUrl = await publishPrice(session, slug, {
        currency: form.text('currency') || 'USD',
        pricing,
        downloadPrice: paid ? price : 0,
        downloadOpenPrice: Number(form.text('downloadOpenPrice')) || 0,
        licenseType: license.licenseType,
        visibility: form.text('visibility') || 'secret',
      }, requestFetch);
    } catch (error) {
      let deactivated = false;
      try { await unpublish(session, slug, requestFetch); deactivated = true; } catch { /* preserve primary error */ }
      const cleanup = deactivated
        ? 'the draft was automatically deactivated'
        : 'automatic draft deactivation could not be verified';
      const wrapped = new Error(`${error instanceof Error ? error.message : String(error)} [${cleanup}]`);
      if (error?.code) wrapped.code = error.code;
      throw wrapped;
    }
    let readback = null;
    let readbackIssues = [];
    try {
      readback = await readCreation(session, slug, requestFetch);
      readbackIssues = cultsReadbackIssues({
        title: form.text('name').trim() || 'ModelPrep web-flow publish',
        visibility: form.text('visibility') || 'secret',
        blueprintIds,
        blueprintFilenames: models.map((file) => file.filename),
        illustrationIds,
        illustrationFilenames: illustrations.map((file) => file.filename),
      }, readback);
    } catch (error) {
      readbackIssues = [`Cults persisted readback failed: ${error instanceof Error ? error.message : String(error)}`];
    }
    return jsonResponse({
      ok: true,
      slug,
      designUrl,
      blueprintIds,
      illustrationIds,
      readback,
      readbackIssues,
      substituted,
      payload: {
        name: form.text('name'),
        description: form.text('description'),
        categoryId: category.categoryId,
        currency: form.text('currency') || 'USD',
        pricing,
        downloadPrice: paid ? price : 0,
        licenseType: license.licenseType,
        visibility: form.text('visibility') || 'secret',
        flatKeywords: tags,
        metaTags,
        madeWithAi: form.text('madeWithAi') === 'true',
        showComments: form.text('showComments') !== 'false',
      },
    });
  }

  async function handleRequest(request, credentials, accountId = 'default') {
    try {
      const url = new URL(request.url);
      const route = url.pathname.replace('/api/v1/cults3d/web/', '');
      if (route === 'publish' && (request.method || 'GET') === 'POST') {
        return await publish(request, credentials, accountId);
      }
      const session = await getSession(credentials, accountId);
      const requestFetch = accountFetch(accountId);
      if (route === 'my-creations' && (request.method || 'GET') === 'GET') {
        return jsonResponse({ ok: true, creations: await listCreations(session, requestFetch) });
      }
      if (['unpublish', 'delete'].includes(route) && (request.method || 'GET') === 'POST') {
        const { slug } = parseJsonBody(request);
        if (!slug) return jsonResponse({ error: 'missing_slug' }, 400);
        const redirectedTo = route === 'delete'
          ? await deleteCreation(session, slug, requestFetch)
          : await unpublish(session, slug, requestFetch);
        return jsonResponse({ ok: true, slug, redirectedTo });
      }
      return jsonResponse({ error: 'unsupported_cults_desktop_route' }, 404);
    } catch (error) {
      sessions.delete(accountId);
      return errorResponse(error);
    }
  }

  return {
    connect,
    handleRequest,
    clear(accountId) { sessions.delete(accountId); },
  };
}

module.exports = {
  CATEGORY_IDS,
  CULTS_BASE,
  CULTS_S3_URL,
  CultsSessionError,
  createCultsDirectClient,
  isCultsChallengeResponse,
  resolveCategory,
  resolveLicense,
};
