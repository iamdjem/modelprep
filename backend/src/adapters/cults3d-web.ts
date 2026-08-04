// Cults3D "web flow" adapter — drives the same multipart/HTML endpoints
// cults3d.com's own web upload form uses. This is reverse-engineered from a
// HAR capture (see /Users/alex/MakerStats-Android/output/cults-capture for
// the canonical request shapes) and is STRICTLY MORE CAPABLE than the public
// GraphQL `createCreation` mutation:
//
//   - Files upload directly to Cults's S3 bucket via a signed POST policy,
//     so we don't need to host them on a custom-domain CDN to dodge Cults's
//     URL allow-list. cdn.makerstats.io + R2 can be retired once this is
//     proven in production.
//   - `flat_keywords` accepts plain text — real tag syncing works.
//   - `usages[]=3dp` and `meta_tags[]=no_support` exist (impossible to find
//     via the GraphQL schema since introspection is disabled).
//   - `visibility` supports `secret` / `public` (GraphQL only allowed PUBLIC).
//   - There's an `unpublish` endpoint that deactivates a listing — closest
//     thing to delete the API will give us.
//
// Cost: this uses your account email + password (not the revocable API key)
// because it logs in as a browser session. Treat the password like any other
// secret — `wrangler secret put CULTS_PASSWORD` in production.
//
// Brittleness: these are undocumented internal endpoints. Cults can change
// any of them with no notice. When something breaks here, the fix loop is:
// re-capture the failing step with browser DevTools → update the function
// that calls it. ARCHITECTURE.md "non-obvious things" lists known quirks.

const CULTS_BASE = 'https://cults3d.com';
const USER_AGENT = 'Mozilla/5.0 (compatible; ModelPrep/0.2; +https://github.com/iamdjem/modelprep)';
const CULTS_ILLUSTRATION_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const CULTS_ILLUSTRATION_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const CULTS_ILLUSTRATION_MAX_BYTES = 10 * 1024 * 1024;
// The current first-party uploader rejects these characters in any file name
// before it requests an S3 policy: `["&",">","<"]` with the message
// `Invalid character “X”`. Verified in the documented upload bundle
// (upload-dfc75bcc2698cddf6698.js) and in the newer bundle the deployed
// webpacker manifest currently points at (upload-f6d1a2a902153d3b47f2.js).
const CULTS_FORBIDDEN_FILENAME_CHARS = ['&', '>', '<'];

/**
 * Mirror the uploader's file-name rule for every blueprint and illustration.
 * Cults refuses these names client-side, so ModelPrep must fail closed before
 * authenticating rather than let a rejected or half-registered upload happen.
 */
export function cultsWebFilenameValidationIssue(
  files: ReadonlyArray<{ name?: unknown }>,
): string | null {
  for (const file of files) {
    const name = String(file?.name ?? '');
    for (const char of CULTS_FORBIDDEN_FILENAME_CHARS) {
      if (name.includes(char)) {
        return `Cults3D rejects the character “${char}” in file names. Rename “${name}” before publishing.`;
      }
    }
  }
  return null;
}

/**
 * Match the current first-party uploader before requesting an authenticated
 * upload policy. The Worker fallback must not be more permissive than the
 * direct Electron transport: illustrations are ordered media, the first one
 * is an image cover, and Cults caps every image or video at 10 MiB.
 */
export function cultsWebIllustrationValidationIssue(
  illustrations: ReadonlyArray<{ type?: unknown; size?: unknown }>,
): string | null {
  const kinds = illustrations.map((file) => {
    const type = String(file.type || '').toLowerCase();
    if (CULTS_ILLUSTRATION_IMAGE_TYPES.has(type)) return 'image';
    if (CULTS_ILLUSTRATION_VIDEO_TYPES.has(type)) return 'video';
    return null;
  });
  if (kinds.some((kind) => kind == null)) {
    return 'Cults3D illustrations must be JPEG, PNG, WebP, GIF, MP4, or WebM.';
  }
  if (kinds[0] !== 'image') {
    return 'The first Cults3D illustration must be an image cover, not a video.';
  }
  if (illustrations.some((file) => Number(file.size) > CULTS_ILLUSTRATION_MAX_BYTES)) {
    return 'Cults3D media must not exceed 10 MiB each.';
  }
  return null;
}

// -------------------- Session + cookie helpers --------------------------

/** A logged-in Cults web session. Pass this to every other function in this
 *  file. Sessions are short-lived (Devise default is a few hours of inactivity)
 *  so we re-login per publish flow rather than try to cache them. */
export interface CultsWebSession {
  /** Cookie header value, e.g. `_cults_session=abc; cookie_consent=1`. */
  cookies: string;
  /** CSRF token from the most recent HTML page we scraped — used for the
   *  `x-csrf-token` request header and `authenticity_token` form field. */
  csrfToken: string;
}

/** Parse Set-Cookie headers from a Response and fold them into a cookie
 *  string suitable for the next request's `Cookie:` header. Workers'
 *  Headers API gives us each Set-Cookie individually via `getSetCookie()`. */
function mergeCookies(existing: string, res: Response): string {
  const jar = new Map<string, string>();
  // Seed with existing cookies.
  for (const part of existing.split(';')) {
    const [k, v] = part.split('=').map(s => s?.trim());
    if (k && v) jar.set(k, v);
  }
  // Workers exposes getSetCookie() that returns individual header values
  // even when multiple Set-Cookie headers were sent (a single get() would
  // join them with commas which is ambiguous for cookies).
  const setCookies = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const [pair] = sc.split(';');
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const k = pair.slice(0, eq).trim();
    const v = pair.slice(eq + 1).trim();
    if (k) jar.set(k, v);
  }
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

/** Extract a CSRF token from an HTML response body. Cults's Rails layout
 *  embeds `<meta name="csrf-token" content="...">` on every authenticated
 *  page, same convention as every Rails app. */
function extractCsrfToken(html: string): string | null {
  const m = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i)
    ?? html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']csrf-token["']/i);
  return m?.[1] ?? null;
}

// -------------------- Login --------------------------------------------

/** Log in to cults3d.com with email + password. Three requests:
 *    1. GET /en/users/sign-in — fetch the form. Confirmed via inspection:
 *       form id=new-session, action=/en/users/sign-in (POST). Fields:
 *       authenticity_token, user[email], user[password], optional
 *       user[time_zone], commit=Log in. Cults does NOT use a Devise default
 *       URL (which would be /users/sign_in with underscore) — they have
 *       their own with hyphen + /en locale prefix.
 *    2. POST /en/users/sign-in with the credentials. 302 on success.
 *    3. GET /en/creations/new — confirms we're authenticated AND grabs the
 *       fresh CSRF token that subsequent requests need.
 */
export async function cultsWebLogin(email: string, password: string): Promise<CultsWebSession> {
  // Step 1: pull the sign-in page to seed cookies + initial CSRF.
  const signInUrl = `${CULTS_BASE}/en/users/sign-in`;
  const pageRes = await fetch(signInUrl, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' },
    redirect: 'manual',
  });
  if (!pageRes.ok) throw new Error(`cults web login: GET sign-in returned ${pageRes.status}`);
  const pageHtml = await pageRes.text();
  let cookies = mergeCookies('', pageRes);
  const initialCsrf = extractCsrfToken(pageHtml);
  if (!initialCsrf) {
    throw new Error('cults web login: no csrf-token meta tag on sign-in page; layout may have changed');
  }

  // Step 2: submit the credentials. Button label is "Log in" (not "Sign in")
  // per the actual form. We send time_zone empty (the form has a JS controller
  // that fills it in browsers — server accepts blank).
  const body = new URLSearchParams();
  body.set('authenticity_token', initialCsrf);
  body.set('user[email]', email);
  body.set('user[password]', password);
  body.set('user[time_zone]', '');
  body.set('commit', 'Log in');
  const loginRes = await fetch(signInUrl, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
      'Origin': CULTS_BASE,
      'Referer': signInUrl,
    },
    body: body.toString(),
    redirect: 'manual',
  });
  cookies = mergeCookies(cookies, loginRes);
  // Successful login redirects (Cults uses 303 — "See Other" — for POST-success,
  // some Rails versions use 302); failed credentials re-render the form (200).
  // A 302/303 to /en/users/sign-in itself means "creds wrong, try again" —
  // distinguish via Location header.
  if (loginRes.status !== 302 && loginRes.status !== 303) {
    const errHtml = await loginRes.text();
    const errSnippet = errHtml.match(/<div[^>]*class="[^"]*alert[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.trim().slice(0, 200);
    throw new Error(`cults web login: POST sign-in returned ${loginRes.status} (expected 302/303). Hint: ${errSnippet || '(no alert div found — credentials probably rejected)'}`);
  }
  const loginRedirect = loginRes.headers.get('Location') || '';
  if (/\/users\/sign-in/.test(loginRedirect)) {
    throw new Error(`cults web login: server redirected back to sign-in (${loginRedirect}) — credentials rejected`);
  }

  // Step 3: hit an authenticated page to grab the post-login CSRF token.
  // The /en/creations/new page is what the upload flow uses, so it's a
  // perfect smoke test that the session is actually authenticated AND can
  // publish. Multiple redirect destinations are possible:
  //   - /users/confirmation/new  →  account exists but email NOT confirmed yet
  //     (Devise's `confirmable` module redirects pre-confirmation users away
  //     from gated actions). User needs to click the link in Cults's
  //     "Confirmation instructions" email.
  //   - /en/users/sign-in        →  session truly not authenticated (creds
  //     rejected silently, or session cookie didn't stick).
  //   - any other location       →  unexpected new flow Cults added; surface
  //     it so we can investigate.
  // Distinguish via the Location header.
  const newCreationRes = await fetch(`${CULTS_BASE}/en/creations/new`, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html', 'Cookie': cookies },
    redirect: 'manual',
  });
  cookies = mergeCookies(cookies, newCreationRes);
  if (newCreationRes.status === 302 || newCreationRes.status === 303) {
    const dest = newCreationRes.headers.get('Location') || '';
    if (/\/users\/confirmation/i.test(dest)) {
      throw new Error('cults web login: account exists but the email address is not confirmed yet. Open your inbox, click the link in Cults\'s "Confirmation instructions" email, then retry.');
    }
    if (/\/users\/sign-in/i.test(dest)) {
      throw new Error('cults web login: not authenticated after login POST — credentials may be rejected silently, or session cookie didn\'t stick.');
    }
    throw new Error(`cults web login: /en/creations/new redirected to unexpected destination ${dest} — Cults may have added a new onboarding step; investigate.`);
  }
  const newCreationHtml = await newCreationRes.text();
  const csrfToken = extractCsrfToken(newCreationHtml);
  if (!csrfToken) {
    throw new Error('cults web login: no csrf-token on /en/creations/new — authenticated page format may have changed');
  }

  return { cookies, csrfToken };
}

// -------------------- File upload (S3 signed POST + register) -----------

/** What kind of upload — affects both the policy endpoint and the register
 *  endpoint. `blueprint` is for downloadable model files (STL, 3MF, etc.);
 *  `illustration` is for images (cover + gallery). */
type UploadKind = 'blueprint' | 'illustration';

/** Response from `GET /en/file_uploaders/new?<kind>=true`. Confirmed shape:
 *  the body IS the S3 form fields directly (no `{url, fields}` wrapper).
 *  We use a constant S3 URL — Cults's bucket is `files.cults3d.com` in
 *  region `eu-west-3` (the decoded `policy` field confirms both). */
type S3PostPolicy = Record<string, string> & {
  key: string;          // Contains `${filename}` placeholder.
  policy: string;       // Base64-encoded JSON policy.
  'x-amz-credential': string;
  'x-amz-algorithm': string;
  'x-amz-date': string;
  'x-amz-signature': string;
};

/** Hardcoded — the bucket info is baked into the policy.signature so this
 *  must match what Cults signed for. Derived from the `policy` base64 field
 *  (decoded shows bucket=files.cults3d.com, region=eu-west-3). */
const CULTS_S3_URL = 'https://s3.eu-west-3.amazonaws.com/files.cults3d.com';

/** Get a signed S3 POST policy from Cults for one upload slot. */
async function getUploadPolicy(session: CultsWebSession, kind: UploadKind): Promise<S3PostPolicy> {
  const url = `${CULTS_BASE}/en/file_uploaders/new?${kind}=true`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': session.csrfToken,
      'Cookie': session.cookies,
      'Referer': `${CULTS_BASE}/en/creations/new`,
    },
  });
  if (!res.ok) {
    throw new Error(`cults web upload: getUploadPolicy(${kind}) returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const policy = (await res.json()) as S3PostPolicy;
  if (!policy?.key || !policy?.policy || !policy?.['x-amz-signature']) {
    throw new Error(`cults web upload: malformed policy response for ${kind} — missing key/policy/signature. Got: ${JSON.stringify(policy).slice(0, 200)}`);
  }
  return policy;
}

/** Substitute `${filename}` in the policy's `key` field with the actual
 *  filename, so the URL we register with Cults matches what's actually in
 *  S3 after S3 does its own `${filename}` substitution on upload. */
function resolvedKey(policy: S3PostPolicy, filename: string): string {
  return policy.key.replace('${filename}', filename);
}

/** Upload the file bytes to S3 using the signed POST policy. */
async function uploadToS3(policy: S3PostPolicy, blob: Blob, filename: string): Promise<void> {
  // S3 POST policy requires `key` first, then all the AWS-signed fields, then
  // `file` LAST. We also include an explicit `Content-Type` form field since
  // the policy has `starts-with $Content-Type ""` (anything goes, but it
  // must be present so the signature validates).
  const form = new FormData();
  for (const [k, v] of Object.entries(policy)) {
    form.set(k, v);
  }
  form.set('Content-Type', blob.type || 'application/octet-stream');
  // File goes last per S3 convention.
  form.set('file', blob, filename);

  const res = await fetch(CULTS_S3_URL, {
    method: 'POST',
    body: form,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/xml',
      'Referer': `${CULTS_BASE}/`,
    },
  });
  if (res.status !== 201 && res.status !== 204) {
    throw new Error(`cults web upload: S3 POST returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

/** Register an uploaded S3 key with Cults, which returns the integer ID we
 *  later pass as `creation[blueprint_ids][]` or `creation[illustration_ids][]`. */
async function registerUpload(session: CultsWebSession, kind: UploadKind, key: string): Promise<number> {
  const endpoint = kind === 'blueprint' ? '/en/blueprints' : '/en/illustrations';
  const res = await fetch(`${CULTS_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': session.csrfToken,
      'Cookie': session.cookies,
      'Referer': `${CULTS_BASE}/en/creations/new`,
    },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) {
    throw new Error(`cults web upload: register ${kind} returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const reg = (await res.json()) as { id?: number; blueprint?: { id?: number }; illustration?: { id?: number } };
  // Cults could return `{id: N}` OR `{blueprint: {id: N}}` — handle both;
  // we know the registered ID has to come back somewhere.
  const id = reg.id ?? reg.blueprint?.id ?? reg.illustration?.id;
  if (typeof id !== 'number') {
    throw new Error(`cults web upload: register ${kind} returned no usable id. Got: ${JSON.stringify(reg).slice(0, 200)}`);
  }
  return id;
}

/** End-to-end "upload one file" — used for both model files (blueprints) and
 *  images (illustrations). Returns the registered numeric ID. */
export async function cultsWebUploadFile(
  session: CultsWebSession,
  file: { blob: Blob; filename: string },
  kind: UploadKind,
): Promise<number> {
  const policy = await getUploadPolicy(session, kind);
  await uploadToS3(policy, file.blob, file.filename);
  const key = resolvedKey(policy, file.filename);
  return registerUpload(session, kind, key);
}

// -------------------- Create creation -----------------------------------

/** Payload for `cultsWebCreateCreation`. Mirrors the form fields Cults's
 *  /en/creations/new submits — see HAR sanitized/359-create-creation-body.txt
 *  for the canonical shape. Numeric IDs for blueprints/illustrations come
 *  from the earlier `cultsWebUploadFile` calls. */
export interface CultsWebCreatePayload {
  name: string;
  description: string;
  /** Long-form printer/print-settings details (separate field from
   *  description in Cults's form). Optional; we send empty if not provided. */
  details?: string;
  /** Cults category integer ID — same numeric value as the GraphQL Relay ID,
   *  just unwrapped. e.g. 25 = Gadget, 23 = Art. See backend/src/adapters/
   *  cults3d-mappings.ts for the mapping (re-use it; both flows want the
   *  same numbers). */
  categoryId: number;
  subCategoryIds?: number[];
  /** Cults internal "what is this for" enum. Discovered values: `3dp`
   *  (3D printing). Empty array if unknown. */
  usages?: string[];
  /** Cults internal meta-tag dictionary. Discovered values: `no_support`.
   *  Sending an unknown value gives "Unknown meta tag" — but unlike the
   *  GraphQL path we can safely include known ones. */
  metaTags?: string[];
  /** USER tags — plain text, free-form, comma- or space-separated. The
   *  form field is `creation[flat_keywords]`. No vocabulary check. */
  flatKeywords?: string;
  blueprintIds: number[];
  illustrationIds: number[];
  /** Was this design made with AI tools? `false` is the safe default. */
  madeWithAi?: boolean;
  /** Show comments section on the listing. `true` mirrors the form default. */
  showComments?: boolean;
}

/** POST /en/creations — creates the listing in DRAFT/UNPUBLISHED state.
 *  Cults redirects (302) to /en/creations/<slug>/price/edit on success;
 *  we parse the slug out of the Location header. */
export async function cultsWebCreateCreation(
  session: CultsWebSession,
  payload: CultsWebCreatePayload,
): Promise<{ slug: string; editPriceUrl: string }> {
  const body = new URLSearchParams();
  body.set('authenticity_token', session.csrfToken);
  body.set('creation[locale]', 'en');
  body.set('creation[name]', payload.name);
  body.set('creation[description]', payload.description);
  body.set('creation[details]', payload.details ?? '');
  // Rails' strong_parameters expects the array fields to start with an
  // empty entry (the hidden form field) — the HAR shows
  // `creation[usages][]=&creation[usages][]=3dp`. Mirror that.
  body.append('creation[usages][]', '');
  for (const u of payload.usages ?? []) body.append('creation[usages][]', u);
  body.set('creation[category_id]', String(payload.categoryId));
  body.append('creation[sub_category_ids][]', '');
  for (const sid of payload.subCategoryIds ?? []) body.append('creation[sub_category_ids][]', String(sid));
  body.append('creation[meta_tags][]', '');
  for (const mt of payload.metaTags ?? []) body.append('creation[meta_tags][]', mt);
  body.set('creation[flat_keywords]', payload.flatKeywords ?? '');
  for (const id of payload.blueprintIds) body.append('creation[blueprint_ids][]', String(id));
  for (const id of payload.illustrationIds) body.append('creation[illustration_ids][]', String(id));
  body.set('creation[made_with_ai]', payload.madeWithAi ? '1' : '0');
  // Same pattern Rails uses for checkboxes — hidden 0 first, then 1 if checked.
  body.append('creation[show_comments]', '0');
  if (payload.showComments !== false) body.append('creation[show_comments]', '1');
  body.set('button', '');

  const res = await fetch(`${CULTS_BASE}/en/creations`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': session.cookies,
      'Origin': CULTS_BASE,
      'Referer': `${CULTS_BASE}/en/creations/new`,
      'Upgrade-Insecure-Requests': '1',
    },
    body: body.toString(),
    redirect: 'manual',
  });
  if (res.status === 422) {
    // Rails returns 422 with the form re-rendered + error messages. We don't
    // parse them all, but surface the first alert div if present.
    const html = await res.text();
    const alert = html.match(/<div[^>]*class="[^"]*alert[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.trim().slice(0, 300);
    throw new Error(`cults web create: validation failed (422). Hint: ${alert || '(no alert div found; check field names/values)'}`);
  }
  if (res.status !== 302) {
    throw new Error(`cults web create: expected 302, got ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const location = res.headers.get('Location') || '';
  // Location is /en/creations/<slug>/price/edit
  const match = location.match(/\/en\/creations\/([^/]+)\/price\/edit/);
  if (!match) {
    throw new Error(`cults web create: unexpected Location after create: ${location}`);
  }
  return { slug: match[1], editPriceUrl: location };
}

// -------------------- Publish (set price + visibility) ------------------

export interface CultsWebPublishPayload {
  /** USD / EUR / GBP / etc — three-letter ISO 4217 code. Required by Cults
   *  even when pricing is 'free' (their form always submits one). */
  currency: string;
  /** Cults's actual radio values (NOT 'paid'/'open' — those get rejected
   *  with "Pricing isn't included in the list"):
   *    - 'priced'       — fixed price, `downloadPrice` required
   *    - 'open_priced'  — pay-what-you-want, `downloadOpenPrice` is the minimum
   *    - 'free'         — no price */
  pricing: 'free' | 'priced' | 'open_priced';
  /** Required when pricing === 'priced'. Ignored otherwise. */
  downloadPrice?: number;
  /** Suggested minimum when pricing === 'open_priced'. Ignored otherwise. */
  downloadOpenPrice?: number;
  /** Cults license code — e.g. 'cc_pddc' (CC0), 'cc_by', 'cults_pu'.
   *  See cults3d-mappings.ts for the full set. Web flow uses the SAME
   *  codes as the GraphQL flow. */
  licenseType: string;
  /** 'public' = appears on Cults search / your profile.
   *  'secret' = only reachable via the unguessable URL Cults assigns.
   *  Web flow supports both; GraphQL only allowed public. */
  visibility: 'public' | 'secret';
  /** Whether the listing appears in the in-Cults store. Almost always true. */
  inStore?: boolean;
}

/** POST /en/creations/<slug>/price with _method=patch — Cults uses
 *  Rails' method-override pattern instead of a real PATCH. Returns the
 *  final canonical design URL the user can share. */
export async function cultsWebPublishPrice(
  session: CultsWebSession,
  slug: string,
  payload: CultsWebPublishPayload,
): Promise<{ designUrl: string }> {
  const body = new URLSearchParams();
  body.set('_method', 'patch');
  body.set('authenticity_token', session.csrfToken);
  body.set('creation[in_store]', String(payload.inStore ?? true));
  body.set('creation[currency]', payload.currency);
  body.set('creation[pricing]', payload.pricing);
  body.set('creation[download_price]', String(payload.downloadPrice ?? 0));
  body.set('creation[download_open_price]', String(payload.downloadOpenPrice ?? 0));
  body.set('creation[license_type]', payload.licenseType);
  body.set('creation[visibility]', payload.visibility);
  body.set('commit', 'Publish');

  const res = await fetch(`${CULTS_BASE}/en/creations/${encodeURIComponent(slug)}/price`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': session.cookies,
      'Origin': CULTS_BASE,
      'Referer': `${CULTS_BASE}/en/creations/${encodeURIComponent(slug)}/price/edit`,
      'Upgrade-Insecure-Requests': '1',
    },
    body: body.toString(),
    redirect: 'manual',
  });
  // Cults uses 303 See Other for some POST-success redirects (per login),
  // and 302 in the original HAR. Accept both.
  if (res.status !== 302 && res.status !== 303) {
    const errHtml = await res.text();
    // Try to pull out the actual validation errors Cults rendered. Common
    // patterns: <div class="alert ..."> or <ul class="errors"> or inline
    // .field-error spans next to each invalid input.
    const alerts: string[] = [];
    const alertRe = /<(?:div|ul)[^>]*class="[^"]*(?:alert|error|flash|field-error)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|ul)>/gi;
    let m: RegExpExecArray | null;
    while ((m = alertRe.exec(errHtml)) !== null && alerts.length < 5) {
      const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text && text.length > 2) alerts.push(text);
    }
    const hint = alerts.length ? alerts.join(' | ') : '(no inline error markers found — first 400 chars of body: ' + errHtml.replace(/\s+/g, ' ').slice(0, 400) + ')';
    throw new Error(`cults web publish: expected 302/303, got ${res.status}. Hint: ${hint.slice(0, 600)}`);
  }
  const location = res.headers.get('Location') || '';
  if (!/^https?:\/\/cults3d\.com\/en\/3d-model\//.test(location)) {
    throw new Error(`cults web publish: unexpected Location after publish: ${location}`);
  }
  return { designUrl: location };
}

// -------------------- Unpublish (deactivate) ----------------------------

// -------------------- List my creations (scrape) ------------------------

/** One row from /en/creations/mine. `status` mirrors the badge Cults renders
 *  on the row: `public` (no badge = live + public), `secret` (Secret badge),
 *  or `offline` (Offline badge). `priceLabel` is the price as Cults shows it
 *  (e.g. "US$ 4.50", "Kč 0", or "" if free). */
export interface CultsWebMyCreation {
  slug: string;
  title: string;
  url: string;                // canonical /en/3d-model/... URL, derived
  editUrl: string;            // /en/creations/<slug>/edit on cults3d.com
  thumbnailUrl: string | null;
  status: 'public' | 'secret' | 'offline';
  priceLabel: string;
}

/** Decode HTML entities so titles render correctly in the UI (Cults uses
 *  `&amp;`, `&#39;`, etc. liberally in `<a title="...">`). Minimal — just
 *  the entities seen in practice on cults3d.com. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/** Scrape /en/creations/mine for the logged-in user's design list, including
 *  OFFLINE drafts (which the GraphQL `myCreations` query doesn't return).
 *
 *  Brittle to layout changes — when this breaks, fetch the page in DevTools
 *  and compare. Look at the .tabular table inside the "creations-my-creations-*"
 *  container; each <tr> in <tbody> is one listing. */
export async function cultsWebListMyCreations(
  session: CultsWebSession,
): Promise<CultsWebMyCreation[]> {
  const res = await fetch(`${CULTS_BASE}/en/creations/mine`, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html',
      'Cookie': session.cookies,
    },
  });
  if (!res.ok) {
    throw new Error(`cults web list: GET creations/mine returned ${res.status}`);
  }
  const html = await res.text();

  // Narrow to the My Designs table body so we don't pick up "Other designs
  // you may like" sidebar links and similar noise. The table sits inside
  // `<div ... id="creations-my-creations-<userId>"> <table class="tabular...">
  // <tbody> ... </tbody> </table>`.
  const tableMatch = html.match(/<div[^>]*id="creations-my-creations-\d+"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    // No designs at all — return empty.
    return [];
  }
  const tableHtml = tableMatch[1];
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*)$/i);
  if (!tbodyMatch) return [];
  const tbodyHtml = tbodyMatch[1];

  // Each listing is a <tr> at the top level of <tbody>. Use a coarse split
  // (nested <tr> doesn't happen here) rather than a real HTML parser.
  const rows: CultsWebMyCreation[] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tbodyHtml)) !== null) {
    const rowHtml = rowMatch[1];

    // Slug + canonical URL — first `<a ... href="/en/creations/<slug>">`.
    const linkMatch = rowHtml.match(/<a[^>]*\btitle="([^"]+)"[^>]*\bhref="\/en\/creations\/([a-z0-9_-]+)"/i)
      ?? rowHtml.match(/<a[^>]*\bhref="\/en\/creations\/([a-z0-9_-]+)"[^>]*\btitle="([^"]+)"/i);
    if (!linkMatch) continue;
    // Two regex shapes above — pick the one that matched and normalize order.
    const [title, slug] = linkMatch[2].startsWith('/') || /^[a-z0-9_-]+$/i.test(linkMatch[2])
      ? [linkMatch[1], linkMatch[2]]
      : [linkMatch[2], linkMatch[1]];

    // Status badge — the Secret/Offline marker span.
    const badgeMatch = rowHtml.match(/<span[^>]*class="[^"]*text-marker[^"]*"[^>]*>\s*([^\s<][^<]*?)\s*<\/span>/i);
    const badge = badgeMatch?.[1]?.trim().toLowerCase() ?? 'public';
    const status: CultsWebMyCreation['status'] =
      badge.startsWith('offline') ? 'offline' :
      badge.startsWith('secret')  ? 'secret'  :
      'public';

    // Thumbnail — first <img ... src=""> in the row. Cults serves the
    // resized variant from images.cults3d.com.
    const imgMatch = rowHtml.match(/<img[^>]*\bsrc="([^"]+)"/i);
    const thumbnailUrl = imgMatch?.[1] ?? null;

    // Price label — first <td class="price-cell">; trim down to its visible text.
    const priceTd = rowHtml.match(/<td[^>]*class="[^"]*price-cell[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    const priceLabel = priceTd
      ? priceTd[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    rows.push({
      slug,
      title: decodeHtmlEntities(title),
      // Cults's canonical listing URL — we don't have category here, but the
      // /en/creations/<slug> URL also resolves (it's the edit-side route);
      // for sharing we'd want the /en/3d-model/<cat>/<slug> form but that
      // requires the category. Leave the edit-side URL as `url` for now and
      // surface the edit URL too so the UI can link both.
      url: `${CULTS_BASE}/en/creations/${slug}`,
      editUrl: `${CULTS_BASE}/en/creations/${slug}/edit`,
      thumbnailUrl,
      status,
      priceLabel,
    });
  }
  return rows;
}

export interface CultsWebCreationReadback {
  slug: string;
  title: string;
  status: CultsWebMyCreation['status'] | 'missing';
  blueprints: { ids: number[]; filenames: string[] };
  illustrations: { ids: number[]; filenames: string[] };
}

export interface CultsWebReadbackExpected {
  title: string;
  visibility: 'public' | 'secret';
  blueprintIds: number[];
  blueprintFilenames: string[];
  illustrationIds: number[];
  illustrationFilenames: string[];
}

function htmlAttribute(tag: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`\\b${escaped}=(['"])([\\s\\S]*?)\\1`, 'i'))?.[2] ?? '';
}

function cultsAssetReadback(html: string, kind: 'blueprint' | 'illustration') {
  const fieldName = `creation[${kind}_ids][]`;
  const ids = Array.from(html.matchAll(/<input\b[^>]*>/gi), (match) => match[0])
    .filter((tag) => decodeHtmlEntities(htmlAttribute(tag, 'name')) === fieldName)
    .map((tag) => Number(htmlAttribute(tag, 'value')))
    .filter((value) => Number.isInteger(value) && value > 0);
  const pathMarker = `/${kind}-file/`;
  const filenames = Array.from(html.matchAll(/<a\b[^>]*>/gi), (match) => htmlAttribute(match[0], 'href'))
    .filter((href) => href.includes(pathMarker))
    .map((href) => {
      try {
        return decodeURIComponent(new URL(href, CULTS_BASE).pathname.split('/').pop() ?? '');
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  return { ids, filenames };
}

/** Read the canonical edit form after publish. The current form persists
 * ordered numeric upload IDs and ordered asset links for both blueprints and
 * illustrations, so MP4/WebM media can be certified without downloading it. */
export async function cultsWebReadCreation(
  session: CultsWebSession,
  slug: string,
): Promise<CultsWebCreationReadback> {
  const res = await fetch(`${CULTS_BASE}/en/creations/${encodeURIComponent(slug)}/edit`, {
    method: 'GET',
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html', 'Cookie': session.cookies },
    redirect: 'manual',
  });
  if (!res.ok) throw new Error(`cults web readback: GET edit returned ${res.status}`);
  const html = await res.text();
  const nameInput = Array.from(html.matchAll(/<input\b[^>]*>/gi), (match) => match[0])
    .find((tag) => decodeHtmlEntities(htmlAttribute(tag, 'name')) === 'creation[name]');
  const listing = (await cultsWebListMyCreations(session)).find((item) => item.slug === slug) ?? null;
  return {
    slug,
    title: nameInput ? decodeHtmlEntities(htmlAttribute(nameInput, 'value')) : '',
    status: listing?.status ?? 'missing',
    blueprints: cultsAssetReadback(html, 'blueprint'),
    illustrations: cultsAssetReadback(html, 'illustration'),
  };
}

/** Return exact persisted-state mismatches while preserving the creation
 * receipt. Callers treat a non-empty result as an uncertified retained item. */
export function cultsWebReadbackIssues(
  expected: CultsWebReadbackExpected,
  actual: CultsWebCreationReadback,
): string[] {
  const issues: string[] = [];
  const compare = (label: string, expectedValues: Array<string | number>, actualValues: Array<string | number>) => {
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

/** Permanently DELETE a listing. Discovered via probing 2026-05-23 —
 *  `DELETE /en/creations/<slug>` works, returns 302, and the listing
 *  vanishes from My Designs completely (verified: 0 references in the
 *  HTML after the call). This is the real permanent-delete, NOT the
 *  same as unpublish. Rails routing also accepts the method-override
 *  form (`POST /en/creations/<slug>` with `_method=delete`) — we use
 *  the cleaner DELETE method here.
 *
 *  Use with care: there's no undo on Cults's side. For "I want to hide
 *  this but might re-publish later," use cultsWebUnpublish instead. */
export async function cultsWebDelete(
  session: CultsWebSession,
  slug: string,
): Promise<{ redirectedTo: string }> {
  const res = await fetch(`${CULTS_BASE}/en/creations/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html, application/xhtml+xml, text/vnd.turbo-stream.html',
      'X-CSRF-Token': session.csrfToken,
      'Cookie': session.cookies,
      'Referer': `${CULTS_BASE}/en/creations/mine`,
    },
    redirect: 'manual',
  });
  if (res.status !== 302 && res.status !== 303 && res.status !== 200) {
    throw new Error(`cults web delete: expected 302/303/200, got ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return { redirectedTo: res.headers.get('Location') || '' };
}

/** POST /en/creations/<slug>/unpublish — DEACTIVATES the listing (a softer
 *  state than delete). Unpublished listings stay on the owner's My Designs
 *  as "OFFLINE" — re-activatable by re-publishing. Anonymous visitors get
 *  404 on the listing URL.
 *
 *  Compare to {@link cultsWebDelete} which truly removes the listing. */
export async function cultsWebUnpublish(
  session: CultsWebSession,
  slug: string,
): Promise<{ redirectedTo: string }> {
  const body = new URLSearchParams();
  body.set('authenticity_token', session.csrfToken);

  const res = await fetch(`${CULTS_BASE}/en/creations/${encodeURIComponent(slug)}/unpublish`, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      // Turbo-stream is what the author UI uses; HTML works too as a fallback.
      'Accept': 'text/vnd.turbo-stream.html, text/html, application/xhtml+xml',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-CSRF-Token': session.csrfToken,
      'Cookie': session.cookies,
      'Referer': `${CULTS_BASE}/en/creations/mine`,
    },
    body: body.toString(),
    redirect: 'manual',
  });
  if (res.status !== 302 && res.status !== 200) {
    throw new Error(`cults web unpublish: expected 302 or 200, got ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return { redirectedTo: res.headers.get('Location') || '' };
}
