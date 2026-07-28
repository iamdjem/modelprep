// MakerWorld (Bambu Lab) "web flow" adapter — drives the same internal
// makerworld.com/api/v1/* endpoints the web upload wizard uses. Reverse-engineered
// from a Playwright capture; full request shapes + field map are documented in
// /Users/alex/makerworld-capture/MAKERWORLD-FLOW.md.
//
// AUTH MODEL (differs from Cults): the Worker can exchange email/password (plus
// an emailed verification code when requested) for MakerWorld's token and
// refreshToken, then replay the internal JSON API. Browser-session/cookie paste
// remains a fallback and may include cf_clearance. Writes retain MakerWorld's
// X-BBL-* headers and a browser UA for parity with the web app.
//
// Brittleness: undocumented internal endpoints. When one breaks, re-capture with
// the kit in /Users/alex/makerworld-capture and update the matching function.

const MW_BASE = 'https://makerworld.com';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const BBL_HEADERS: Record<string, string> = {
  'X-BBL-Client-Type': 'web',
  'X-BBL-Client-Version': '00.00.00.01',
  'X-BBL-App-Source': 'makerworld',
  'X-BBL-Client-Name': 'MakerWorld',
};

// -------------------- Session --------------------------------------------

/** A MakerWorld session represented as a Cookie header value. `token=…` is the
 * minimum; refreshToken is recommended and browser fallbacks may add cf_clearance. */
export interface MakerWorldSession {
  cookie: string;
}

function mwHeaders(session: MakerWorldSession, extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...BBL_HEADERS,
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    Origin: MW_BASE,
    Referer: `${MW_BASE}/`,
    Cookie: session.cookie,
    ...extra,
  };
}

/** Pull MakerWorld's `{code, error|message}` out of a response body for clear errors. */
function mwErrDetail(text: string, status: number): string {
  try { const e = JSON.parse(text); if (e && (e.error || e.message)) return `[${e.code ?? status}] ${e.error ?? e.message}`; } catch { /* */ }
  return `HTTP ${status} ${text.slice(0, 200)}`;
}

async function mwJson<T>(res: Response, what: string): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    // A Cloudflare challenge ("Just a moment") means the cf_clearance cookie is
    // missing/expired or the UA didn't match — surface that distinctly.
    if (/just a moment|cf-chl|attention required/i.test(text)) {
      throw new Error(`MakerWorld ${what}: Cloudflare challenge (HTTP ${res.status}) — the session or browser fallback cookie is no longer accepted; reconnect MakerWorld.`);
    }
    throw new Error(`MakerWorld ${what}: ${mwErrDetail(text, res.status)}`);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error(`MakerWorld ${what}: non-JSON response ${text.slice(0, 200)}`); }
  // Some MakerWorld endpoints return HTTP 200 with an error code in the body.
  const p = parsed as { code?: number; error?: string; message?: string };
  if (p && typeof p.code === 'number' && p.code >= 400) {
    throw new Error(`MakerWorld ${what}: [${p.code}] ${p.error ?? p.message ?? 'error'}`);
  }
  return parsed as T;
}

/** Email/password sign-in (server-side, browser-agent verified 2026-06-23).
 *  `POST /user-service/user/login {account,password}` returns the auth JWT in the BODY
 *  ({userId, token, expireIn}) — a 180-day token. cf_clearance is NOT required for the
 *  API, so this token alone authorizes all subsequent calls. The Worker (not a browser)
 *  calls this, so CORS doesn't apply. `refreshToken` comes back as a Set-Cookie we capture.
 *  Risk: a GeeTest captcha MAY trigger on suspicious/repeat attempts (not solvable here) —
 *  callers should surface the error and offer the cookie-paste / desktop fallback. */
// Login outcome: either a token, or "we need the email verification code first". MakerWorld
// requires an emailed code when the login comes from an unrecognised IP (always true for the
// Worker), responding `{loginType:"verifyCode", accessToken:""}` and emailing a code.
export type MwLoginOutcome =
  | { ok: true; token: string; userId: string; expireIn: number; refreshToken?: string }
  | { ok: false; needCode: true; tfaKey?: string };

function interpretLogin(data: Record<string, unknown>, text: string, res: Response): MwLoginOutcome {
  if (/geetest|captcha/i.test(`${data.error ?? ''} ${data.message ?? ''} ${text}`)) {
    throw new Error('MakerWorld requires a CAPTCHA for this sign-in. Use the MakerWorld window instead; server-side CAPTCHA completion is not supported.');
  }
  const token = (data.accessToken as string) || (data.token as string) || '';
  if (token) {
    let refreshToken = (data.refreshToken as string) || undefined;
    if (!refreshToken) { const m = /(?:^|[;,\s])refreshToken=([^;,\s]+)/.exec(res.headers.get('set-cookie') || ''); if (m) refreshToken = m[1]; }
    return { ok: true, token, userId: (data.userId as string) ?? '', expireIn: (data.expiresIn as number) ?? (data.expireIn as number) ?? 0, refreshToken };
  }
  if (data.loginType === 'verifyCode' || data.tfaKey) return { ok: false, needCode: true, tfaKey: (data.tfaKey as string) || undefined };
  throw new Error(`MakerWorld login [code ${(data.code as number) ?? '?'}, http ${res.status}]: ${(data.error as string) || text.slice(0, 400) || 'no token in response'}`);
}

async function mwPostLogin(body: Record<string, string>): Promise<MwLoginOutcome> {
  const res = await fetch(`${MW_BASE}/api/v1/user-service/user/login`, {
    method: 'POST',
    headers: {
      ...BBL_HEADERS, 'User-Agent': USER_AGENT, 'Content-Type': 'application/json',
      Accept: 'application/json', Origin: MW_BASE, Referer: `${MW_BASE}/sign-in/password-sign-in`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch { throw new Error(`MakerWorld login: non-JSON response (HTTP ${res.status}). Try the cookie-paste or desktop sign-in.`); }
  return interpretLogin(data, text, res);
}

/** Step 1: email + password. Returns a token, or {needCode} when MakerWorld emails an OTP. */
export function mwLogin(account: string, password: string): Promise<MwLoginOutcome> {
  return mwPostLogin({ account, password });
}
/** Step 2: complete the sign-in with the emailed verification code. */
export function mwLoginWithCode(account: string, code: string, tfaKey?: string): Promise<MwLoginOutcome> {
  return mwPostLogin({ account, code, ...(tfaKey ? { tfaKey } : {}) });
}

/** Quick liveness/auth check: GET my message count. 200 = session valid. */
export async function mwCheckSession(session: MakerWorldSession): Promise<boolean> {
  const res = await fetch(`${MW_BASE}/api/v1/user-service/my/message/count`, { headers: mwHeaders(session) });
  return res.status === 200;
}

/** The signed-in user's own profile — handle/name/uid/avatar — for labelling the account. */
export async function mwWhoami(session: MakerWorldSession): Promise<{ handle?: string; name?: string; uid?: number; avatar?: string } | null> {
  const res = await fetch(`${MW_BASE}/api/v1/design-user-service/my/profile`, { headers: mwHeaders(session) });
  if (!res.ok) return null;
  const d = await res.json() as { handle?: string; name?: string; uid?: number; avatar?: string };
  return { handle: d.handle, name: d.name, uid: d.uid, avatar: d.avatar };
}

export interface MakerWorldUploadCapabilities {
  /** MakerWorld only renders CyberBrick upload fields for accounts with this flag. */
  rcUpload: boolean;
  uploadAllowed: boolean;
  defaultLicense?: string;
}

/** Extract the small, non-sensitive upload-capability subset from MakerWorld's
 * server-rendered publish page. The capability is not exposed by the public
 * profile endpoint; it lives in pageProps.userInfo/session.user. */
export function parseMakerWorldUploadCapabilities(html: string): MakerWorldUploadCapabilities {
  const match = /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match) throw new Error('MakerWorld upload capabilities: __NEXT_DATA__ was not present');
  let data: {
    props?: { pageProps?: {
      userInfo?: { rcUpload?: boolean; defaultLicense?: string; bannedPermission?: { upload?: boolean } };
      session?: { user?: { rcUpload?: boolean; defaultLicense?: string; bannedPermission?: { upload?: boolean } } };
    } };
  };
  try { data = JSON.parse(match[1]); }
  catch { throw new Error('MakerWorld upload capabilities: invalid __NEXT_DATA__ JSON'); }
  const user = data.props?.pageProps?.userInfo ?? data.props?.pageProps?.session?.user;
  if (!user || typeof user.rcUpload !== 'boolean') {
    throw new Error('MakerWorld upload capabilities: rcUpload was not present');
  }
  return {
    rcUpload: user.rcUpload,
    uploadAllowed: user.bannedPermission?.upload !== true,
    ...(user.defaultLicense ? { defaultLicense: user.defaultLicense } : {}),
  };
}

/** Read account-specific upload eligibility without creating or changing a draft. */
export async function mwUploadCapabilities(session: MakerWorldSession): Promise<MakerWorldUploadCapabilities> {
  // Prefer the JSON profile service because it works with the token-only session
  // issued by the Worker login flow. Some MakerWorld deployments return the full
  // user record here, including rcUpload and bannedPermission.
  for (const endpoint of ['profile', 'preference']) {
    const profileRes = await fetch(`${MW_BASE}/api/v1/design-user-service/my/${endpoint}`, { headers: mwHeaders(session) });
    if (!profileRes.ok) continue;
    try {
      const profileBody = await profileRes.json() as {
        rcUpload?: boolean; defaultLicense?: string; bannedPermission?: { upload?: boolean };
        userInfo?: { rcUpload?: boolean; defaultLicense?: string; bannedPermission?: { upload?: boolean } };
      };
      const profile = profileBody.userInfo ?? profileBody;
      if (typeof profile.rcUpload === 'boolean') {
        return {
          rcUpload: profile.rcUpload,
          uploadAllowed: profile.bannedPermission?.upload !== true,
          ...(profile.defaultLicense ? { defaultLicense: profile.defaultLicense } : {}),
        };
      }
    } catch { /* fall through to SSR pageProps */ }
  }
  // Browser-cookie fallback: SSR pageProps always contains the capability, but
  // token-only sessions may be Cloudflare-blocked from HTML pages.
  const res = await fetch(`${MW_BASE}/en/my/models/publish?type=original`, {
    headers: mwHeaders(session, { Accept: 'text/html,application/xhtml+xml' }),
  });
  if (!res.ok) throw new Error(`MakerWorld upload capabilities: ${mwErrDetail(await res.text(), res.status)}`);
  return parseMakerWorldUploadCapabilities(await res.text());
}

/** Post-submit status of a draft. `GET /design-service/my/draft/<id>` carries the slicing
 *  result (verified live 2026-06-22): `resultType != 0` ⇒ FAILED, with `resultDesc` the
 *  human reason (e.g. "The 3mf was not generated by Bambu Studio"); `resultType == 0` ⇒
 *  still verifying or already published. Cookie-only auth. */
export interface DraftStatus {
  outcome: 'failed' | 'pending' | 'live';
  code: number;          // resultType (0 = ok/pending, non-zero = failure code)
  reason: string;        // resultDesc (failure text, '' when not failed)
  plate?: number;
  title?: string;
  profileTitle?: string;
  status?: number;       // 1 = published/live
  designId?: number;     // published design id (different from the draft id)
  profileId?: number;    // published print-profile id, when present
}
export async function mwDraftStatus(session: MakerWorldSession, id: number | string): Promise<DraftStatus | null> {
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/draft/${id}`, { headers: mwHeaders(session) });
  if (!res.ok) return null;
  const d = await res.json() as {
    resultType?: number; resultDesc?: string; resultPlate?: number;
    title?: string; profileTitle?: string; status?: number; designId?: number; profileId?: number;
  };
  const code = d.resultType ?? 0;
  return {
    outcome: code !== 0 ? 'failed' : (d.status === 1 && !!d.designId ? 'live' : 'pending'),
    code,
    reason: d.resultDesc ?? '',
    plate: d.resultPlate,
    title: d.title,
    profileTitle: d.profileTitle,
    status: d.status,
    designId: d.designId,
    profileId: d.profileId,
  };
}

// -------------------- File upload (presign → S3 PUT) ---------------------

export interface UploadedFile {
  name: string;
  size: number;
  /** Public CDN url (cdnPrefix + key) to reference in the draft. */
  url: string;
  /** Object key (the S3 path), e.g. makerworld/model/2026…/uid/hash.stl */
  key: string;
  cdnPrefix: string;
}

/** A short-lived MakerWorld S3 upload grant. The Worker may return this to the
 * browser so large files go directly to MakerWorld's bucket instead of crossing
 * Cloudflare's 100 MB Worker request-body boundary. */
export interface PresignedUpload {
  signedUrl: string;
  key: string;
  cdnPrefix: string;
  url: string;
}

/** Ask MakerWorld for a one-file presigned S3 PUT. This is deliberately separate
 * from mwUploadFile so browser clients can perform the byte upload directly. */
export async function mwPresignUpload(
  session: MakerWorldSession,
  fileName: string,
  useType = 'makerworld/model',
): Promise<PresignedUpload> {
  const presignRes = await fetch(`${MW_BASE}/api/v1/design-user-service/my/upload`, {
    method: 'POST',
    headers: mwHeaders(session, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ useType, fileNames: [fileName] }),
  });
  const data = await mwJson<{ cdnPrefix: string; urls: string[] }>(presignRes, 'presign');
  const signedUrl = data.urls?.[0];
  if (!signedUrl) throw new Error('MakerWorld presign: no signed url returned');
  const key = new URL(signedUrl).pathname.replace(/^\//, '');
  return { signedUrl, key, cdnPrefix: data.cdnPrefix, url: `${data.cdnPrefix}/${key}` };
}

/** Upload one file: POST /my/upload to get a presigned AWS S3 PUT url, then PUT the
 *  bytes (no auth header on the PUT — the signature is in the querystring).
 *  `useType` is "makerworld/model" for everything observed (models, images, 3mf). */
export async function mwUploadFile(
  session: MakerWorldSession,
  fileName: string,
  bytes: ArrayBuffer | Uint8Array,
  useType = 'makerworld/model',
): Promise<UploadedFile> {
  const presigned = await mwPresignUpload(session, fileName, useType);

  const put = await fetch(presigned.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes as BodyInit,
  });
  if (!put.ok) throw new Error(`MakerWorld S3 PUT failed: HTTP ${put.status}`);

  const size = bytes instanceof Uint8Array ? bytes.byteLength : (bytes as ArrayBuffer).byteLength;
  return { name: fileName, size, key: presigned.key, cdnPrefix: presigned.cdnPrefix, url: presigned.url };
}

/** The .3mf path: uploading the Bambu Studio file lets MakerWorld read the
 *  embedded slice to compute printer compatibility for step 3. */
export interface SlicerCompatibility {
  compatibility: { dev_setting_name: string; dev_model_name: string; dev_product_name: string; nozzle_diameter: number };
  other_compatibility: Array<{ dev_setting_name: string; dev_model_name: string; dev_product_name: string; nozzle_diameter: number }>;
}
// The old standalone GET /iot-service/api/slicer/device/compatibility now returns 400.
// Do not call it: MakerWorld derives native compatibility while processing the uploaded
// Bambu Studio 3MF. SlicerCompatibility remains as the shape for explicit overrides.

// -------------------- Draft create / update / publish / delete -----------

export type ModelSource = 'original' | 'remix' | 'share';

/** A model file already uploaded via mwUploadFile, plus its rendered thumbnail. */
export interface DraftModelFile {
  modelName: string;
  modelSize: number;
  modelType: string; // 'stl' | '3mf' | 'step' | …
  modelUrl: string;
  /** Optional raw-file metadata exposed by MakerWorld's file editor. */
  note?: string;
  protected?: boolean;
  relativePath?: string;
  cdnPrefix?: string;
  uploadKey?: string;
  thumbnailName?: string;
  thumbnailSize?: number;
  thumbnailUrl?: string;
}

/** Print profile (REQUIRED for the .3mf path / step 3). */
export interface PrintProfile {
  title: string; // e.g. "0.2mm layer, 2 walls, 15% infill"
  description?: string; // profileSummary (HTML)
  pictureUrls: string[]; // ≥1 required
  isPrinterTested: boolean; // the "I've read Print Profile Guidelines" checkbox
  realPhotoConfirmed?: boolean;
  visibility?: 'public' | 'private';
  compatibility?: SlicerCompatibility['compatibility'];
  otherCompatibility?: SlicerCompatibility['other_compatibility'];
}

/** A Bill-of-Materials catalog item (kit/part, filament, or material) — the full
 *  object MakerWorld stores, resolved from Maker's Supply via the picker or Product ID. */
export interface BomCatalogItem {
  value: string;            // internal UNI id, e.g. "UNI00004"
  sku: string;              // e.g. "B-ZH113"
  title: string;
  label?: string;
  image?: string;
  pieces?: number;          // pack size (e.g. 4pcs)
  handle?: string;
  parentIds?: string[];
  filamentCodes?: string[] | null;
  quantity: number;         // user-chosen quantity
}
/** A free-text "other part" BOM row. */
export interface BomOtherPart { name: string; quantity: number; note?: string }

/** A file already uploaded via mwUploadFile, referenced in a draft. */
export interface MwFileRef { uniKey?: string; name: string; size: number; url: string }
/** A linked design (related Laser&Cut model, or remix original). designType 0=3D, 1=Laser&Cut. */
export interface RelatedModelRef { id: number; designType: 0 | 1; title?: string; cover?: string; status?: number }
/** A resolved remix/share original entry (the shape MakerWorld stores in `original[]`).
 *  `link` (the source URL) + `designId` are REQUIRED — a missing/empty link makes submit
 *  fail with "originals url is empty" / a third-party-fetch error. For a MakerWorld-internal
 *  source, designId = the model id and link = its model URL; for an external source
 *  (Printables/Thingiverse), designId = 0 and link = the external URL. */
export interface OriginalRef {
  link: string; designId: number; designType?: 0 | 1;
  title?: string; author?: string; homepage?: string; cover?: string; license?: string;
}
/** CyberBrick (RC) config — only available when the account has userInfo.rcUpload. */
export interface CyberBrickInput {
  controlConfig: MwFileRef[];           // ≥1 .json required when CyberBrick
  motionConfig?: MwFileRef[];
  mainControlConfig?: MwFileRef;
  isOfficialController?: boolean;        // false → custom controller (needs controllerCover image)
  controllerCover?: { name: string; url: string };
  switchCovers?: Array<{ name: string; url: string }>;
  cyberBrickFramework?: string;
  firmwareVersion?: string;
  originMicroPython?: MwFileRef[];
  creationProtection?: string;
}

/** Platform-neutral-ish publish input for MakerWorld. Covers BOTH paths and the
 *  optional sections; everything beyond the core is optional. */
export interface MakerWorldPublishInput {
  title: string;
  description: string; // summary, HTML, REQUIRED to publish
  categoryId: number; // REQUIRED to publish
  tags?: string[]; // free strings (max 50)
  license?: string; // e.g. "Standard Digital File License" (default)
  visibility?: 'public' | 'private';
  nsfw?: boolean;
  modelSource?: ModelSource;

  // media (urls from mwUploadFile)
  coverUrl: string; // 4:3, REQUIRED
  coverPortraitUrl?: string; // 3:4
  galleryUrls?: string[]; // model pictures

  // files
  modelFiles?: DraftModelFile[]; // STL/CAD path (raw model files)
  model3mf?: { name: string; size: number; url: string }; // .3mf path

  // .3mf path only
  printProfile?: PrintProfile;

  // optional sections (passthrough — see MAKERWORLD-FLOW.md field map)
  remixOriginalIds?: number[]; // when modelSource = 'remix'/'share' → original[] (3D, designType 0)
  remixOriginalDesignType?: 0 | 1;
  resolvedOriginals?: OriginalRef[]; // pre-resolved remix originals (link+designId+meta); takes precedence over remixOriginalIds
  remixSourceUrl?: string;
  remixSourceLicense?: string;
  remixDescription?: string;
  relatedModel?: RelatedModelRef; // "Laser & Cut model = Yes" → relateDesignInfo (link a LC model)
  cyberBrick?: CyberBrickInput; // CyberBrick (RC) models — needs account userInfo.rcUpload
  exclusive?: number; // Exclusive Model Program (0 = off)
  exclusiveTermsAccepted?: boolean;
  // Bill of Materials: catalog items (kits/filaments/materials) + free-text other parts.
  boms?: { kits?: BomCatalogItem[]; filaments?: BomCatalogItem[]; materials?: BomCatalogItem[]; otherParts?: BomOtherPart[]; links?: unknown[] };
  designGuide?: Array<{ name: string; url: string; size: number }>; // Assembly Guide
  designOther?: Array<{ name: string; url: string; size: number }>; // Other Files
  communityPost?: { content: string }; // posts to community on publish — opt-in only
  paidSetting?: { isPaid: boolean; crowdfunding: number };
}

/** Build the full draft JSON the wizard PUT/POSTs. Most of this is fixed
 *  defaults captured from the real form; the input fields are mapped in. */
type CompatibilityInput = Partial<SlicerCompatibility['compatibility']> & {
  devModelName?: string; devProductName?: string; nozzleDiameter?: number;
};

function normalizeCompatibility(value?: CompatibilityInput): { devModelName: string; devProductName: string; nozzleDiameter: number } {
  return {
    devModelName: value?.dev_model_name ?? value?.devModelName ?? '',
    devProductName: value?.dev_product_name ?? value?.devProductName ?? '',
    nozzleDiameter: value?.nozzle_diameter ?? value?.nozzleDiameter ?? 0,
  };
}

function buildCyberBrickPayload(input?: CyberBrickInput): Record<string, unknown> {
  if (!input) return { cyberBrickNeeded: false, controlConfig: [], motionConfig: [], isOfficialController: true };
  return {
    cyberBrickNeeded: true,
    controlConfig: input.controlConfig ?? [],
    motionConfig: input.motionConfig ?? [],
    mainControlConfig: input.mainControlConfig ?? { uniKey: '', name: '', size: 0, url: '' },
    isOfficialController: input.isOfficialController ?? true,
    controllerCover: input.controllerCover ?? { name: 'official controller', url: 'https://makerworld.bblmw.com/makerworld/cyberbrick/official_controller.png' },
    switchCovers: input.switchCovers ?? [],
    cyberBrickFramework: input.cyberBrickFramework ?? '',
    originMicroPython: input.originMicroPython ?? [],
    firmwareVersion: input.firmwareVersion ?? '',
    creationProtection: input.creationProtection ?? '',
  };
}

function buildOriginals(input: { resolvedOriginals?: OriginalRef[]; remixOriginalIds?: number[]; remixOriginalDesignType?: 0 | 1 }): Record<string, unknown>[] {
  return (input.resolvedOriginals
    ?? (input.remixOriginalIds ?? []).map((id): OriginalRef => ({ link: `${MW_BASE}/models/${id}`, designId: id, designType: input.remixOriginalDesignType ?? 0 })))
    .map((o) => ({
      link: o.link, author: o.author ?? '', homepage: o.homepage ?? '',
      designId: o.designId, designType: o.designType ?? 0,
      title: o.title ?? '', cover: o.cover ?? '', license: o.license ?? '',
      insideOriginalInfo: null, relatedUid: 0, relatedUser: null,
    }));
}

export function buildDraftPayload(input: MakerWorldPublishInput, clickWhich: 'next' | 'save' | 'publish', id?: number): Record<string, unknown> {
  const is3mf = !!input.model3mf;
  const modelFiles = (input.modelFiles ?? []).map((f) => ({
    isAutoGenerated: false,
    isDir: false,
    modelName: f.modelName,
    modelSize: f.modelSize,
    modelType: f.modelType,
    modelUrl: f.modelUrl,
    modelUpdateTime: new Date().toISOString(),
    file: { path: f.relativePath || f.modelName },
    note: f.note ?? '',
    protected: f.protected ?? false,
    cdnPrefix: f.cdnPrefix ?? '',
    uploadKey: f.uploadKey ?? '',
    thumbnailName: f.thumbnailName ?? '',
    thumbnailSize: f.thumbnailSize ?? 0,
    thumbnailUrl: f.thumbnailUrl ?? '',
    unikey: crypto.randomUUID(),
  }));

  const printer = input.printProfile?.compatibility
    ? {
        model: input.printProfile.compatibility.dev_product_name,
        settingsId: '',
        variant: 0,
      }
    : { model: '', settingsId: '', variant: 0 };

  return {
    // --- core ---
    title: input.title,
    profileTitle: input.printProfile?.title ?? '',
    summary: input.description ?? '',
    profileSummary: input.printProfile?.description ?? '',
    categoryId: input.categoryId ?? 0,
    tags: input.tags ?? [],
    cover: input.coverUrl ?? '',
    // Print-profile cover = the first profile photo (mirrors how `cover` is the first
    // model photo). Empty profileCover + no profilePictures is why the published print
    // profile showed "Print Profile Pictures (0/37)".
    profileCover: input.printProfile?.pictureUrls?.[0] ?? '',
    coverPortrait: input.coverPortraitUrl ?? '',
    coverLandscape: '',
    nsfw: input.nsfw ?? false,
    license: input.license ?? 'Standard Digital File License',
    region: '',
    modelSource: input.modelSource ?? 'original',
    modelId: '',
    profileId: 0,

    // --- files ---
    modelFiles,
    model3Mf: input.model3mf ?? { name: '', size: 0, url: '' },
    designPictures: (input.galleryUrls ?? []).map((url) => ({ url })),

    // --- documentation ---
    designGuide: input.designGuide ?? [],
    designOther: input.designOther ?? [],
    auxiliaryGuide: [],
    auxiliaryOther: [],
    // "Print Profile Pictures" (.3mf path). Confirmed live (PUT my/draft + GET design
    // round-trip, 2026-06-22): the field is `auxiliaryPictures` (NOT `profilePictures`,
    // which is only a client-side state var). Items are {isRealLifePhoto, name, url};
    // `name` = the photo's filename; isRealLifePhoto defaults to 0 for uploads.
    auxiliaryPictures: (input.printProfile?.pictureUrls ?? []).map((url) => ({
      isRealLifePhoto: input.printProfile?.realPhotoConfirmed ? 1 : 0,
      name: url.split('/').pop() ?? '',
      url,
    })),
    auxiliaryBom: [],
    designBom: [],

    // --- remix/share (original[]) vs. linked Laser&Cut model (relateDesignInfo) ---
    // Each original needs `link` (the source URL) + `designId` — captured from a real remix
    // (2026-06-20). A missing link ⇒ "originals url is empty"; a bare {id} ⇒ a third-party
    // fetch error. Prefer resolvedOriginals (full meta); fall back to building a minimal
    // MakerWorld-internal entry from the id if only remixOriginalIds was supplied.
    original: buildOriginals(input),
    relateDesignInfo: input.relatedModel
      ? { needRelate: true, id: input.relatedModel.id, designType: input.relatedModel.designType, title: input.relatedModel.title ?? '', cover: input.relatedModel.cover ?? '', status: input.relatedModel.status ?? 1 }
      : { needRelate: false, id: 0, designType: 1, title: '', cover: '', status: 0 },

    // --- visibility + action ---
    designSetting: { submitAsPrivate: (input.visibility ?? 'private') === 'private', makerLab: '', makerLabVersion: '' },
    instanceSetting: {
      submitAsPrivate: (input.printProfile?.visibility ?? input.visibility ?? 'private') === 'private',
      isPrinterPresetChanged: false,
      isPrinterTested: input.printProfile?.isPrinterTested ?? false,
      isDonateToAuthor: false,
      makerLab: '',
      makerLabVersion: '',
    },
    draftSetting: { createStep: '', createWith3mf: is3mf, customGCode: false },
    clickWhich,
    mode: id ? 'editModelDraft' : 'uploadFile',

    // --- compatibility (.3mf path) ---
    compatibility: input.printProfile?.compatibility
      ? normalizeCompatibility(input.printProfile.compatibility)
      : { devModelName: '', devProductName: '', nozzleDiameter: 0 },
    otherCompatibility: (input.printProfile?.otherCompatibility ?? []).map(normalizeCompatibility),
    unsupportedDevModels: [],
    printer,

    // --- BOM --- (boms/filaments/materials = catalog items; otherParts = free text)
    bomsNeeded: !!input.boms && [
      input.boms.kits, input.boms.filaments, input.boms.materials,
      input.boms.otherParts?.filter((part) => part.name.trim()), input.boms.links,
    ].some((items) => (items?.length ?? 0) > 0),
    boms: input.boms?.kits ?? [],
    bomsOfFilaments: input.boms?.filaments ?? [],
    bomsOfMaterials: input.boms?.materials ?? [],
    bomsOfOtherPartList: input.boms?.otherParts?.filter((part) => part.name.trim()) ?? [],
    bomsLinks: input.boms?.links ?? [],

    // --- community post (opt-in) ---
    postNeeded: !!input.communityPost,
    postContent: input.communityPost?.content ?? '',

    // --- monetization / misc ---
    paidSetting: input.paidSetting ?? { isPaid: false, crowdfunding: 0 },
    exclusive: input.exclusive ?? 0,
    isAIGC: false,
    syncToMWGlobal: true,
    cyberBrick: buildCyberBrickPayload(input.cyberBrick),
    details: [],
    tempDetails: [],
  };
}

/** Create a draft. Returns the new draft id. */
export async function mwCreateDraft(session: MakerWorldSession, input: MakerWorldPublishInput): Promise<number> {
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/draft`, {
    method: 'POST',
    headers: mwHeaders(session, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(buildDraftPayload(input, 'next')),
  });
  const data = await mwJson<{ id: number }>(res, 'create draft');
  if (!data.id) throw new Error('MakerWorld create draft: no id returned');
  return data.id;
}

/** Save/update a draft (clickWhich "save"). */
export async function mwUpdateDraft(session: MakerWorldSession, id: number, input: MakerWorldPublishInput, clickWhich: 'save' | 'publish' = 'save'): Promise<void> {
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/draft/${id}`, {
    method: 'PUT',
    headers: mwHeaders(session, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(buildDraftPayload(input, clickWhich, id)),
  });
  await mwJson(res, 'update draft').catch((e) => {
    // PUT returns 200 with empty body in capture — tolerate empty.
    if (!String(e.message).includes('non-JSON')) throw e;
  });
}

/** Publish a draft: save with clickWhich:"publish", then POST …/submit. Model
 *  then enters MakerWorld review ("verifying"). Requires (both paths): title,
 *  4:3+3:4 covers, categoryId, description, license; (.3mf path) a print profile. */
export async function mwPublish(session: MakerWorldSession, id: number, input: MakerWorldPublishInput): Promise<void> {
  if (input.model3mf && !input.printProfile) {
    throw new Error('MakerWorld publish: .3mf models require a print profile (title + ≥1 picture + isPrinterTested).');
  }
  await mwUpdateDraft(session, id, input, 'publish');
  // The /submit step is where MakerWorld validates: an incomplete draft returns
  // 400 {code,error}. Surface a clear, actionable message.
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/draft/${id}/submit`, {
    method: 'POST',
    headers: mwHeaders(session, { 'Content-Type': 'application/json' }),
    body: '{}',
  });
  if (!res.ok) {
    const detail = mwErrDetail(await res.text(), res.status);
    const reqs = input.model3mf
      ? 'title, 4:3 + 3:4 covers, category, description, license, and a valid print profile (.3mf path)'
      : 'title, 4:3 + 3:4 covers, category, description, license';
    throw new Error(`MakerWorld publish rejected: ${detail}. Required: ${reqs}. (Also: a bad .3mf, forbidden words, or an empty/ON Bill-of-Materials can block it.)`);
  }
}

/** Delete a draft / model (works for drafts and verifying/published records). */
export async function mwDelete(session: MakerWorldSession, id: number): Promise<void> {
  // Drafts + "verifying" delete via /my/draft/<draftId>. But a fully-published design
  // (a PRIVATE model publishes instantly, skipping review) is its own id space and the
  // draft endpoint 403s — it needs DELETE /design-service/design/<designId>. We don't
  // always know which id/state we hold, so try the draft endpoint first and fall back.
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/draft/${id}`, { method: 'DELETE', headers: mwHeaders(session) });
  if (res.ok) return;
  const draftStatus = res.status;
  const res2 = await fetch(`${MW_BASE}/api/v1/design-service/design/${id}`, { method: 'DELETE', headers: mwHeaders(session) });
  if (!res2.ok) throw new Error(`MakerWorld delete: HTTP ${draftStatus} (draft) / ${res2.status} (published design)`);
}

// -------------------- Vocab + listing ------------------------------------

/** Tag autocomplete suggestions. */
export async function mwSuggestTags(session: MakerWorldSession, keyword: string): Promise<Array<{ text: string; count: number }>> {
  const res = await fetch(`${MW_BASE}/api/v1/search-service/suggest?keyword=${encodeURIComponent(keyword)}&type=design_tag`, { headers: mwHeaders(session) });
  const data = await mwJson<{ suggestions: Array<{ text: string; count: number }> }>(res, 'suggest tags');
  return data.suggestions ?? [];
}

/** List the signed-in user's published designs. */
/** One of the user's LIVE (published) designs + its status fields.
 *  status: 1 = live/public. opStatus / offlineInstCnt hint at takedowns/offline profiles.
 *  NOTE: this list contains only LIVE models — "verifying" (in review) and "failed"
 *  (rejected) models are NOT here (those tabs are SSR-only, blocked server-side). So a
 *  just-submitted model appearing here = confirmed live; absence = still in review OR
 *  rejected (we can't yet distinguish those two server-side). */
export interface MyDesignStatus {
  id: number; title: string; status: number;
  opStatus?: number; offlineInstCnt?: number; coverUrl?: string; url: string; createTime?: string;
}
export async function mwListMyDesigns(session: MakerWorldSession): Promise<MyDesignStatus[]> {
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/design/published?limit=100&offset=0`, { headers: mwHeaders(session) });
  const d = await mwJson<{ hits?: Array<Record<string, unknown>> }>(res, 'list my designs');
  return (d.hits ?? []).map((h) => ({
    id: h.id as number,
    title: (h.title as string) ?? '',
    status: h.status as number,
    opStatus: h.opStatus as number | undefined,
    offlineInstCnt: h.offlineInstCnt as number | undefined,
    coverUrl: h.coverUrl as string | undefined,
    url: `${MW_BASE}/en/models/${h.id}`,
    createTime: h.createTime as string | undefined,
  }));
}

// -------------------- BOM catalog (Maker's Supply: kits/filaments/materials) ----
// There's no public catalog API — the catalog ships in the edit page's SSR data
// (`_next/data/<buildId>/.../edit.json` → pageProps.boms / filamentBoms / materials).
// We refresh it off real user sessions (the picker calls the Worker, which fetches +
// caches). A category→product→variant tree; leaves carry the sku/value used in a BOM.

/** A catalog tree node (picker option). Leaves are added to a BOM as BomCatalogItem. */
export interface BomCatalogNode {
  value: string; sku?: string; title?: string; label?: string; image?: string;
  pieces?: number; handle?: string; filamentCodes?: string[] | null; parentIds?: string[];
  children?: BomCatalogNode[];
}
export interface BomCatalog { kits: BomCatalogNode[]; filaments: BomCatalogNode[]; materials: BomCatalogNode[]; fetchedAt: string }

function trimCatalogNode(n: Record<string, unknown>): BomCatalogNode {
  const o: BomCatalogNode = { value: n.value as string, sku: n.sku as string, title: n.title as string, label: n.label as string, image: n.image as string };
  if (n.pieces != null) o.pieces = n.pieces as number;
  if (n.handle) o.handle = n.handle as string;
  if (n.filamentCodes) o.filamentCodes = n.filamentCodes as string[];
  if (Array.isArray(n.parentIds)) o.parentIds = n.parentIds as string[];
  if (Array.isArray(n.children) && n.children.length) o.children = (n.children as Record<string, unknown>[]).map(trimCatalogNode);
  return o;
}

/** Current Next.js buildId (changes per MakerWorld deploy) — needed for _next/data URLs. */
async function mwBuildId(session: MakerWorldSession): Promise<string> {
  const res = await fetch(`${MW_BASE}/en/my/models/publish?type=original`, { headers: mwHeaders(session, { Accept: 'text/html' }) });
  const html = await res.text();
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error('MakerWorld: could not read buildId from publish page');
  return m[1];
}

function catalogFromPageProps(pp: { boms?: unknown[]; filamentBoms?: unknown[]; materials?: unknown[] }): BomCatalog {
  return {
    kits: (pp.boms ?? []).map((n) => trimCatalogNode(n as Record<string, unknown>)),
    filaments: (pp.filamentBoms ?? []).map((n) => trimCatalogNode(n as Record<string, unknown>)),
    materials: (pp.materials ?? []).map((n) => trimCatalogNode(n as Record<string, unknown>)),
    fetchedAt: new Date().toISOString(),
  };
}

/** Fetch the BOM catalog from a specific draft's edit-page SSR data. */
export async function mwFetchCatalog(session: MakerWorldSession, draftId: number, buildId?: string): Promise<BomCatalog> {
  const bid = buildId ?? (await mwBuildId(session));
  const res = await fetch(`${MW_BASE}/_next/data/${bid}/en/my/models/drafts/${draftId}/edit.json`, { headers: mwHeaders(session, { 'x-nextjs-data': '1' }) });
  const j = await mwJson<{ pageProps?: { boms?: unknown[]; filamentBoms?: unknown[]; materials?: unknown[] } }>(res, 'fetch BOM catalog');
  return catalogFromPageProps(j.pageProps ?? {});
}

/** Fetch the catalog without a known draft: try the publish page SSR first (no draft),
 *  else create a throwaway draft, read its catalog, and delete it. */
export async function mwFetchCatalogStandalone(session: MakerWorldSession): Promise<BomCatalog> {
  const buildId = await mwBuildId(session);
  // try publish page pageProps (no draft needed)
  try {
    const r = await fetch(`${MW_BASE}/_next/data/${buildId}/en/my/models/publish.json?type=original`, { headers: mwHeaders(session, { 'x-nextjs-data': '1' }) });
    if (r.ok) {
      const j = (await r.json()) as { pageProps?: { boms?: unknown[]; filamentBoms?: unknown[]; materials?: unknown[] } };
      const pp = j.pageProps ?? {};
      if ((pp.boms?.length || pp.filamentBoms?.length || pp.materials?.length)) return catalogFromPageProps(pp);
    }
  } catch { /* fall through */ }
  // fallback: throwaway draft (the catalog always lives on the edit page)
  const id = await mwCreateDraft(session, { title: 'modelprep-catalog-refresh', description: '', categoryId: 0, coverUrl: '' });
  try { return await mwFetchCatalog(session, id, buildId); }
  finally { try { await mwDelete(session, id); } catch { /* best effort */ } }
}

// -------------------- Related-model search + session refresh -------------

/** Search the user's OWN published designs to link as a related/remix model.
 *  relateDesignType: 0 = 3D models, 1 = Laser & Cut models. */
export async function mwSearchRelatedDesigns(session: MakerWorldSession, relateDesignType: 0 | 1, keyword: string): Promise<RelatedModelRef[]> {
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/design/relate?relateDesignType=${relateDesignType}&keyword=${encodeURIComponent(keyword)}`, { headers: mwHeaders(session) });
  const d = await mwJson<{ canUseDesign?: Array<{ id: number; title: string; cover: string; status: number; designType: 0 | 1 }> }>(res, 'search related designs');
  return (d.canUseDesign ?? []).map((x) => ({ id: x.id, designType: x.designType, title: x.title, cover: x.cover, status: x.status }));
}

/** Resolve a remix original (a MakerWorld-internal model id) into the full `original[]`
 *  entry MakerWorld needs (link + designId + title/author/homepage/cover/license). */
export async function mwFetchOriginalRef(session: MakerWorldSession, id: number, designType: 0 | 1 = 0): Promise<OriginalRef> {
  const res = await fetch(`${MW_BASE}/api/v1/design-service/design/${id}`, { headers: mwHeaders(session) });
  const d = await mwJson<{ title?: string; coverUrl?: string; license?: string; designCreator?: { name?: string; handle?: string } }>(res, 'fetch remix original');
  const handle = d.designCreator?.handle;
  return {
    link: `${MW_BASE}/models/${id}`,
    designId: id,
    designType,
    title: d.title ?? '',
    author: d.designCreator?.name ?? '',
    homepage: handle ? `${MW_BASE}/@${handle}` : '',
    cover: d.coverUrl ?? '',
    license: d.license ?? '',
  };
}

/** Refresh the access token using the refreshToken carried in the session cookie.
 *  Current endpoint (the apps' /v1/... one 404s): POST /api/v1/user-service/user/refreshtoken
 *  with {refreshToken}. Returns the new token bundle (the real refreshToken value lives in an
 *  HttpOnly cookie, so this only works if the user supplied refreshToken in X-MW-Cookie). */
export interface MwRefreshOutcome {
  token: string;
  refreshToken?: string;
  expiresIn?: number;
}

export async function mwRefreshToken(session: MakerWorldSession): Promise<MwRefreshOutcome | null> {
  const m = session.cookie.match(/(?:^|;\s*)refreshToken=([^;]+)/);
  if (!m) return null; // refreshToken not in the supplied cookie
  const res = await fetch(`${MW_BASE}/api/v1/user-service/user/refreshtoken`, {
    method: 'POST',
    headers: mwHeaders(session, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ refreshToken: decodeURIComponent(m[1]) }),
  });
  const data = await mwJson<{ token?: string; accessToken?: string; refreshToken?: string; expiresIn?: number; expireIn?: number }>(res, 'refresh token');
  const token = data.accessToken || data.token || '';
  if (!token) throw new Error('MakerWorld refresh token: response did not include a new access token');
  let refreshToken = data.refreshToken;
  if (!refreshToken) {
    const setCookie = res.headers.get('set-cookie') || '';
    const match = /(?:^|[;,\s])refreshToken=([^;,\s]+)/.exec(setCookie);
    if (match) refreshToken = match[1];
  }
  return { token, refreshToken, expiresIn: data.expiresIn ?? data.expireIn };
}

// -------------------- Laser & Cut models (separate product, draft2d) -----
// Separate flow at /en/my/laser-and-cut-models/publish. Files = .lac (Bambu Suite) or
// SVG/DXF/AI/images. DIFFERENT endpoints (draft2d) and a DIFFERENT body shape
// ({draft:{design:{…}}} with pictures/docBom/docGuide/docOther/steps, no summary/3mf/
// compatibility). Files upload via the SAME /my/upload (useType "makerworld/model").
// NOTE: create body + endpoints are confirmed; the update/submit body placement of
// clickWhich/designSetting is inferred — verify on the first real LC publish.

export interface LaserCutPublishInput {
  title: string;
  license?: string;
  modelSource?: ModelSource;
  visibility?: 'public' | 'private';
  nsfw?: boolean;
  tags?: string[];
  modelFiles?: DraftModelFile[];         // raw .lac/.svg/.dxf/.ai/image source files
  lacFile?: MwFileRef;                   // Bambu Suite package (separate from raw files)
  lacInfo?: { plates: unknown[]; processTypes: string[]; machineName: string; materialIds: string[] };
  lacCustomInfo?: { otherTools: string; compatibleDevicesSelected: string[] };
  profilePictures?: string[];
  profileTitle?: string;
  profileDescription?: string;
  profileVisibility?: 'public' | 'private';
  pictures?: string[];                   // cover + gallery image urls (LC uses `pictures`)
  remixOriginalIds?: number[];
  remixOriginalDesignType?: 0 | 1;
  resolvedOriginals?: OriginalRef[];
  remixSourceUrl?: string;
  remixSourceLicense?: string;
  remixDescription?: string;
  relatedModel?: RelatedModelRef;        // link a 3D model (designType 0)
  cyberBrick?: CyberBrickInput;
  docBom?: MwFileRef[]; docGuide?: MwFileRef[]; docOther?: MwFileRef[];
  paidSetting?: { isPaid: boolean; crowdfunding: number };
  model2DInfo?: Record<string, unknown>;
}

/** Post-submit status for a Laser & Cut draft. MakerWorld exposes the same
 * resultType/resultDesc contract on draft2d as it does for regular drafts. */
export async function mwLaserCutDraftStatus(session: MakerWorldSession, id: number | string): Promise<DraftStatus | null> {
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/draft2d/${id}`, { headers: mwHeaders(session) });
  if (!res.ok) return null;
  const d = await res.json() as {
    resultType?: number; resultDesc?: string; resultPlate?: number;
    title?: string; profileTitle?: string; status?: number; designId?: number; profileId?: number;
  };
  const code = d.resultType ?? 0;
  return {
    outcome: code !== 0 ? 'failed' : (d.status === 1 && !!d.designId ? 'live' : 'pending'),
    code,
    reason: d.resultDesc ?? '',
    plate: d.resultPlate,
    title: d.title,
    profileTitle: d.profileTitle,
    status: d.status,
    designId: d.designId,
    profileId: d.profileId,
  };
}

export function buildLaserCutPayload(input: LaserCutPublishInput, clickWhich: 'next' | 'save' | 'publish'): Record<string, unknown> {
  const priv = (input.visibility ?? 'private') === 'private';
  const design = {
    title: input.title,
    modelSource: input.modelSource ?? 'original',
    remixDescription: input.remixDescription ?? '',
    modelFiles: (input.modelFiles ?? []).map((f) => ({
      file: { path: f.relativePath || f.modelName }, thumbnailName: f.thumbnailName ?? '', thumbnailSize: f.thumbnailSize ?? 0, thumbnailUrl: f.thumbnailUrl ?? '',
      modelName: f.modelName, modelSize: f.modelSize, modelUrl: f.modelUrl, modelType: f.modelType,
      isAutoGenerated: false, unikey: crypto.randomUUID(), note: f.note ?? '', protected: f.protected ?? false,
      modelUpdateTime: new Date().toISOString(), cdnPrefix: f.cdnPrefix ?? 'https://makerworld.bblmw.com',
      uploadKey: f.uploadKey ?? '', uploadStatus: null,
    })),
    pictures: (input.pictures ?? []).map((url) => ({ url })),
    original: buildOriginals(input), tags: input.tags ?? [],
    docBom: input.docBom ?? [], docGuide: input.docGuide ?? [], docOther: input.docOther ?? [],
    nsfw: input.nsfw ?? false,
    boms: { needed: false, makersSupplies: [], filaments: [], otherParts: [], materials: [] },
    steps: { needed: false, steps: [] },
    isAIGC: false,
    cyberBrick: buildCyberBrickPayload(input.cyberBrick),
    relateDesignInfo: input.relatedModel
      ? { needRelate: true, id: input.relatedModel.id, designType: input.relatedModel.designType, title: input.relatedModel.title ?? '', cover: input.relatedModel.cover ?? '', status: input.relatedModel.status ?? 1 }
      : { needRelate: false, id: 0, designType: 0, title: '', cover: '', status: 0 },
    paidSetting: input.paidSetting ?? { isPaid: false, crowdfunding: 0 },
    license: input.license ?? 'Standard Digital File License',
  };
  return {
    draft: {
      design,
      designSetting: { submitAsPrivate: priv, syncToMWGlobal: true, postNeeded: false, postContent: '' },
      instance: {
        title: input.profileTitle ?? '',
        summary: input.profileDescription ?? '',
        submitAsPrivate: (input.profileVisibility ?? input.visibility ?? 'private') === 'private',
        pictures: (input.profilePictures ?? []).map((url) => ({ url })),
        lacFile: input.lacFile
          ? { name: input.lacFile.name, size: input.lacFile.size, url: input.lacFile.url }
          : { name: '', size: 0, url: '' },
        lacInfo: input.lacInfo ?? { plates: [], processTypes: [], machineName: '', materialIds: [] },
        lacCustomInfo: input.lacCustomInfo ?? { otherTools: '', compatibleDevicesSelected: [] },
      },
      extra: { draftSetting: { createWithLac: !!input.lacFile } },
      tempDetails: [], mode: 'uploadFile',
      uploading: { lac: '', raw: false, plates: false, cover: false, appCover: false, designPictures: false, acccessories: false, profilePictures: false, rcMpy: false, rcControlConfig: false, rcMotionFile: false, rcMainControlConfig: '', rcControllerCover: false, rcSwitchesCover: false },
      clickWhich,
      model2DInfo: input.model2DInfo ?? {},
    },
  };
}

export async function mwCreateLaserCutDraft(session: MakerWorldSession, input: LaserCutPublishInput): Promise<number> {
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/draft2d`, { method: 'POST', headers: mwHeaders(session, { 'Content-Type': 'application/json' }), body: JSON.stringify(buildLaserCutPayload(input, 'next')) });
  const data = await mwJson<{ id: number }>(res, 'create laser-cut draft');
  if (!data.id) throw new Error('MakerWorld create laser-cut draft: no id returned');
  return data.id;
}
export async function mwUpdateLaserCutDraft(session: MakerWorldSession, id: number, input: LaserCutPublishInput, clickWhich: 'save' | 'publish' = 'save'): Promise<void> {
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/draft2d/${id}`, { method: 'PUT', headers: mwHeaders(session, { 'Content-Type': 'application/json' }), body: JSON.stringify(buildLaserCutPayload(input, clickWhich)) });
  await mwJson(res, 'update laser-cut draft').catch((e) => { if (!String(e.message).includes('non-JSON')) throw e; });
}
export async function mwPublishLaserCut(session: MakerWorldSession, id: number, input: LaserCutPublishInput): Promise<void> {
  await mwUpdateLaserCutDraft(session, id, input, 'publish');
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/draft2d/${id}/submit`, { method: 'POST', headers: mwHeaders(session, { 'Content-Type': 'application/json' }), body: '{}' });
  if (!res.ok) throw new Error(`MakerWorld laser-cut publish rejected: ${mwErrDetail(await res.text(), res.status)}`);
}
export async function mwDeleteLaserCut(session: MakerWorldSession, id: number): Promise<void> {
  const res = await fetch(`${MW_BASE}/api/v1/design-service/my/draft2d/${id}`, { method: 'DELETE', headers: mwHeaders(session) });
  if (res.ok) return;
  // A private Laser & Cut design may already be a published design by the time
  // the user presses delete. Match the regular flow's published-design fallback.
  const published = await fetch(`${MW_BASE}/api/v1/design-service/design/${id}`, { method: 'DELETE', headers: mwHeaders(session) });
  if (!published.ok) throw new Error(`MakerWorld delete laser-cut: HTTP ${res.status} (draft2d) / ${published.status} (published design)`);
}
