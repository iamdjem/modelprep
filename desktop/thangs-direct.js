const THANGS_ORIGIN = 'https://thangs.com';
const THANGS_API_ORIGIN = 'https://production-api.thangs.com';
const UPLOAD_URL = `${THANGS_ORIGIN}/upload`;
const MODEL_FORMATS = new Set(['stl', '3mf', 'step', 'stp', 'obj', 'glb', 'fbx', 'blend', 'usdz', 'gltf']);
const IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic']);
const LICENSE_FORMATS = new Set(['pdf', 'txt', 'md']);
const SINGLE_PART_ONLY_FORMATS = new Set(['3mf', 'fbx', 'glb']);
const MAX_MODEL_BYTES = 250 * 1024 * 1024;
const MAX_REFERENCE_BYTES = 500 * 1024 * 1024;
const INVALID_NAME = /["/\\:$#&@?\n\t*<>%]/;

const jsonResponse = (body, status = 200) => ({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const errorResponse = (error) => jsonResponse({
  error: 'thangs_failed',
  message: error instanceof Error ? error.message : String(error),
  ...(error?.draftId ? { draftId: String(error.draftId) } : {}),
}, 502);
const ext = (name) => String(name || '').split('.').pop().toLowerCase();
function parseJson(request) { if (request.bodyType !== 'text') throw new Error('Thangs action requires JSON.'); return JSON.parse(String(request.body)); }
function parseUpload(request) {
  if (request.bodyType !== 'form-data') throw new Error('Thangs upload requires multipart input.');
  let role = ''; let file;
  for (const item of request.body || []) {
    if (item.name === 'role' && item.kind === 'text') role = String(item.value);
    if (item.name === 'file' && item.kind === 'file') file = { name: String(item.fileName), mimeType: String(item.mimeType || ''), bytes: Buffer.from(item.bytes) };
  }
  if (!file) throw new Error('Thangs upload is missing its file.');
  return { role, file };
}
function validateUpload(role, file) {
  if (!file.bytes.byteLength) throw new Error('Thangs rejects empty files.');
  if (INVALID_NAME.test(file.name)) throw new Error(`${file.name} contains characters Thangs does not accept.`);
  const extension = ext(file.name);
  if (role === 'model' && !MODEL_FORMATS.has(extension)) throw new Error(`Thangs does not accept .${extension} as a model.`);
  if (role === 'image' && !IMAGE_FORMATS.has(extension)) throw new Error(`Thangs does not accept .${extension} as an image.`);
  if (role === 'license' && !LICENSE_FORMATS.has(extension)) throw new Error(`Thangs does not accept .${extension} as a license file.`);
  if (!['model', 'image', 'reference', 'license', 'standalone'].includes(role)) throw new Error('Unsupported Thangs upload role.');
  if (role === 'model' && file.bytes.byteLength > MAX_MODEL_BYTES) throw new Error(`${file.name} exceeds Thangs' 250 MB model limit; upload it as a reference file.`);
  if (role !== 'model' && file.bytes.byteLength > MAX_REFERENCE_BYTES) throw new Error(`${file.name} exceeds Thangs' 500 MB reference limit.`);
}
function validateSubmit(input) {
  const issues = [];
  const parts = input.parts || [];
  if (!String(input.name || '').trim()) issues.push('name is required');
  if (!parts.length) issues.push('at least one model part is required');
  if (parts.length > 1 && !parts.some((part) => part.primary)) issues.push('choose a primary part');
  if (parts.length > 1 && parts.some((part) => SINGLE_PART_ONLY_FORMATS.has(ext(part.name)))) issues.push('3MF, FBX and GLB files can only be uploaded as single-part models');
  if (input.marketplace && !(Number(input.price) > 0)) issues.push('marketplace listings require a positive price');
  return issues;
}
function buildModelPayload(input) {
  const issues = validateSubmit(input); if (issues.length) throw new Error(`Thangs validation failed: ${issues.join('; ')}.`);
  // v4/models/{id}/details contract, read from the live first-party serializer
  // (`updateModelDetailsRequestFromState`, bundle capture 2026-08-07):
  // - photos ride in `images` ({id?, filename, caption?}); putting them in
  //   `attachments` is what filed every photo as a resource with an empty gallery
  // - `attachments` carries only non-image reference files ({id?, name, filename})
  // - audience is the string `visibility` (`private`/`public`/`paid`), not `isPublic`
  // - model parts are NOT in this request: association happens through
  //   POST v4/models/validate-files, and this request only names them via
  //   `partNames` [{partIdentifier, name}] + `primaryPart` (added in save()).
  const payload = {
    name: String(input.name).trim(), description: String(input.description || ''),
    tags: input.tags || [],
    visibility: input.marketplace ? 'paid' : input.isPublic ? 'public' : 'private',
    allowRemix: !!input.allowRemix,
    isAiGenerated: !!input.aiGenerated,
    isInitialUpload: !String(input.existingId || '').trim(),
    images: (input.images || []).map((file) => ({ filename: file.uploadedName, ...(file.caption ? { caption: String(file.caption) } : {}) })),
    attachments: (input.references || []).map((file) => ({ name: file.name, filename: file.uploadedName })),
  };
  // The serializer omits absent optional values entirely; explicit nulls are rejected.
  if (input.category) payload.category = input.category;
  if (input.license) payload.license = input.license;
  if (input.marketplace) payload.marketplacePrice = Number(input.price);
  if (String(input.folderId || '').trim()) payload.folderId = String(input.folderId).trim();
  if (String(input.workspaceId || '').trim()) payload.workspaceId = String(input.workspaceId).trim();
  return [payload];
}

// partRequests entries come back from GET v4/models/{id} after validate-files.
// Their shape is server-defined; match each request to the uploaded part by any
// string field that carries the original or uploaded file name.
function matchPartRequests(partRequests, parts) {
  const requests = Array.isArray(partRequests) ? partRequests.filter((r) => r && r.partIdentifier != null) : [];
  if (!requests.length) return null;
  const nameOf = (part) => String(part.partName || part.name || '');
  const matches = (request, part) => Object.values(request).some((v) => typeof v === 'string' && (v === part.name || v === part.uploadedName || v.endsWith(`/${part.name}`)));
  const partNames = [];
  let primaryPart = null;
  for (const request of requests) {
    const part = parts.find((p) => matches(request, p)) || null;
    partNames.push({ partIdentifier: request.partIdentifier, name: part ? nameOf(part) : String(request.name || request.partIdentifier) });
    if (part && (part.primary || parts.length === 1)) primaryPart = request.partIdentifier;
  }
  return { partNames, primaryPart: primaryPart ?? requests[0].partIdentifier };
}

function extractCreatedModelId(created) {
  const value = Array.isArray(created) ? created[0] : created?.ids?.[0] ?? created?.id ?? created;
  const id = value && typeof value === 'object' ? value.id : value;
  return typeof id === 'string' || typeof id === 'number' ? id : null;
}

function findLicenseReadback(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return null;
  for (const [key, child] of Object.entries(value)) {
    if (/license/i.test(key) && child != null && child !== '') return child;
  }
  for (const child of Object.values(value)) {
    const found = findLicenseReadback(child, depth + 1);
    if (found != null) return found;
  }
  return null;
}

function createThangsDirectClient({ fetchImpl = fetch, apiOrigin = process.env.MODELPREP_THANGS_API_ORIGIN || THANGS_API_ORIGIN, now = () => new Date() } = {}) {
  async function api(context, path, { method = 'GET', body, raw, headers = {}, label = path } = {}) {
    if (!context?.accessToken) throw new Error('Thangs access token is missing.');
    const requestHeaders = {
      Accept: 'application/json',
      Authorization: `Bearer ${context.accessToken}`,
      ...(context.cookie ? { Cookie: context.cookie } : {}),
      Origin: THANGS_ORIGIN,
      ...headers,
    };
    if (body !== undefined && !raw) requestHeaders['Content-Type'] = 'application/json';
    const response = await fetchImpl(`${apiOrigin}/${path.replace(/^\//, '')}`, { method, headers: requestHeaders, body: raw || (body === undefined ? undefined : JSON.stringify(body)), redirect: 'manual' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof data?.message === 'string' ? data.message : typeof data?.error === 'string' ? data.error : data && Object.keys(data).length ? JSON.stringify(data) : '';
      const error = new Error(`Thangs ${label} failed (HTTP ${response.status})${detail ? `: ${detail}` : '.'}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }
  async function whoami(context) {
    const user = await api(context, 'users/current?likes=false', { label: 'session verification' });
    if (!user?.id) throw new Error('Thangs returned no authenticated user.');
    return {
      id: String(user.id),
      nickname: String(user.username || user.displayName || user.name || 'Thangs'),
      username: user.username ? String(user.username) : undefined,
    };
  }
  async function meta(context) {
    const data = await api(context, 'categories/root?includeEmpty=true', { label: 'category taxonomy' });
    return { categories: Array.isArray(data?.categories) ? data.categories : [] };
  }
  async function upload(context, role, file) {
    validateUpload(role, file);
    const directory = `modelprep-${Date.now()}`;
    const standalone = role === 'standalone';
    // Which presign route a file takes is what decides how Thangs classifies it
    // later. Its own uploader picks the route by file kind:
    //
    //   `${standalone ? 'standalone-files' : attachment ? 'attachments' : 'models'}/upload-urls`
    //
    // Only model parts go through `models/upload-urls`. Photos and reference
    // files go through `attachments/upload-urls`, which stores them under
    // `uploads/attachments/<uuid>/` and is what earns them
    // `attachmentType: "image"` on read-back. Sending photos down the model
    // route stored them as model files, so Thangs filed them as generic
    // resources: they showed up in the editor's Attachments list and never in
    // the image gallery. Licenses stay on the model route, matching the
    // first-party UPLOAD_MODEL_LICENSE flow.
    const attachment = role === 'image' || role === 'reference';
    const endpoint = standalone
      ? 'standalone-files/upload-urls?sendContentLengthRangeHeader=false'
      : `${attachment ? 'attachments' : 'models'}/upload-urls`;
    const presigned = await api(context, endpoint, { method: 'POST', body: standalone ? [{ fileName: file.name }] : { fileNames: [file.name], directory, sendContentLengthRangeHeader: false }, label: 'upload authorization' });
    const entry = Array.isArray(presigned) ? presigned[0] : presigned?.urls?.[0] || presigned?.[file.name] || presigned;
    const uploadUrl = entry?.signedUrl || entry?.uploadUrl || entry?.url;
    const uploadedName = entry?.newFileName || entry?.filename || entry?.fileName || entry?.key || `${directory}/${file.name}`;
    if (!uploadUrl) throw new Error('Thangs returned no signed upload URL.');
    // Chromium/Electron computes Content-Length for Buffer bodies. Supplying
    // the forbidden request header ourselves makes session.fetch reject the
    // signed PUT with net::ERR_INVALID_ARGUMENT before it reaches storage.
    // Match Thangs' current first-party storage helper exactly. It deliberately
    // sends every binary payload as application/octet-stream and only assigns a
    // textual content type to TXT, Markdown, and PDF files. Using model/3mf or
    // model/stl changes the signed request and storage rejects it with HTTP 403.
    const uploadContentTypes = { txt: 'text/plain', md: 'text/markdown', pdf: 'application/pdf' };
    const put = await fetchImpl(uploadUrl, { method: 'PUT', headers: { 'Content-Type': uploadContentTypes[ext(file.name)] || 'application/octet-stream' }, body: file.bytes });
    if (!put.ok) throw new Error(`Thangs storage upload failed (HTTP ${put.status}).`);
    // Model-file validation moved into save(): the first-party v4 flow runs
    // POST v4/models/validate-files AFTER the draft exists, and that call is
    // what builds the draft's partRequests. Validating here, before any draft
    // exists, left every part unassociated (empty Model section, preview 404).
    return { role, name: file.name, uploadedName, size: file.bytes.byteLength };
  }
  async function save(context, input) {
    const [details] = buildModelPayload(input);
    // Thangs' current first-party uploader creates a private draft first, then
    // applies the complete metadata with the v4 details route. The former
    // all-in-one v2 create now returns HTTP 500 after otherwise successful
    // signed uploads.
    let id = String(input.existingId || '').trim();
    if (!id) {
      const createBody = {
        name: String(input.parts[0]?.name || input.name).trim(),
        termsAcceptedAt: now().toISOString(),
      };
      // The first-party client serializes absent root folder/workspace values as
      // `undefined`, so JSON omits them. Thangs rejects explicit nulls here.
      if (String(input.folderId || '').trim()) createBody.folderId = String(input.folderId).trim();
      if (String(input.workspaceId || '').trim()) createBody.workspaceId = String(input.workspaceId).trim();
      const created = await api(context, 'v4/models', {
        method: 'POST',
        body: createBody,
        label: 'draft creation',
      });
      // Single-model v4 creates currently return the primitive model id. Bulk
      // and older deployments have also returned arrays or id envelopes.
      id = String(extractCreatedModelId(created) || '');
      if (!id) throw new Error('Thangs created no model id.');
    }
    try {
      // First-party sequence: validate the uploaded model files against the
      // draft (this is what creates the draft's partRequests server-side),
      // read the draft back for the generated partIdentifiers, then apply the
      // full details with the parts named and a primary part chosen.
      const uploadedNames = (input.parts || []).map((part) => part.uploadedName).filter(Boolean);
      if (uploadedNames.length) await api(context, 'v4/models/validate-files', { method: 'POST', body: { files: uploadedNames }, label: 'model file validation' });
      let draft = null;
      try { draft = await api(context, `v4/models/${id}`, { label: 'draft part read-back' }); } catch { draft = null; }
      const partInfo = matchPartRequests(draft?.draftModel?.partRequests ?? draft?.partRequests, input.parts || []);
      if (partInfo) { details.partNames = partInfo.partNames; details.primaryPart = partInfo.primaryPart; }
      await api(context, `v4/models/${id}/details`, { method: 'PUT', body: details, label: `model details for private draft ${id}` });
    } catch (error) {
      error.draftId = id;
      throw error;
    }
    // Thangs listing URLs require the owner's username segment. The former
    // `/designer/model/<id>` receipt looked plausible but always 404ed.
    const owner = await whoami(context);
    return {
      id: String(id),
      state: input.marketplace ? 'paid' : input.isPublic ? 'public' : 'private',
      url: `${THANGS_ORIGIN}/designer/${encodeURIComponent(owner.username || owner.nickname)}/3d-model/${encodeURIComponent(id)}`,
    };
  }
  async function status(context, id) {
    const [details, attachments] = await Promise.all([
      api(context, `models/${id}/details`, { label: 'details read-back' }),
      api(context, `models/${id}/attachments`, { label: 'attachment read-back' }),
    ]);
    // The retired v2 license-only endpoint now returns 404. The current model
    // details response is the canonical editor readback and carries license.
    let license = findLicenseReadback(details);
    if (!license) {
      // The editor details projection can omit license on a newly-created
      // private model. The owner-readable model projection retains it.
      for (const path of [`models/${id}`, `v2/models/${id}`]) {
        try {
          const model = await api(context, path, { label: 'model license read-back' });
          license = findLicenseReadback(model);
          if (license) break;
        } catch (error) {
          if (error?.status !== 404 && error?.status !== 405) throw error;
        }
      }
    }
    if (!license) throw new Error(`Thangs details read-back for ${id} returned no license.`);
    const owner = await whoami(context);
    return {
      details,
      attachments,
      license,
      owner,
      url: `${THANGS_ORIGIN}/designer/${encodeURIComponent(owner.username || owner.nickname)}/3d-model/${encodeURIComponent(id)}`,
    };
  }
  async function handleRequest(request, context) {
    try {
      const url = new URL(request.url); const route = url.pathname.split('/api/v1/thangs/web/')[1] || '';
      if (route === 'whoami') return jsonResponse({ ok: true, user: await whoami(context) });
      if (route === 'meta' && request.method === 'GET') return jsonResponse({ ok: true, meta: await meta(context) });
      if (route === 'upload' && request.method === 'POST') { const { role, file } = parseUpload(request); return jsonResponse({ ok: true, file: await upload(context, role, file) }); }
      if (route === 'submit' && request.method === 'POST') return jsonResponse({ ok: true, ...(await save(context, parseJson(request))) });
      if (route === 'status') return jsonResponse({ ok: true, readback: await status(context, url.searchParams.get('id')) });
      return jsonResponse({ error: 'not_found', message: 'Unsupported Thangs route.' }, 404);
    } catch (error) { return errorResponse(error); }
  }
  return { api, handleRequest, meta, save, status, upload, whoami };
}
module.exports = { IMAGE_FORMATS, LICENSE_FORMATS, MODEL_FORMATS, SINGLE_PART_ONLY_FORMATS, THANGS_API_ORIGIN, THANGS_ORIGIN, UPLOAD_URL, buildModelPayload, createThangsDirectClient, extractCreatedModelId, findLicenseReadback, matchPartRequests, validateSubmit, validateUpload };
