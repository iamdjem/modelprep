const MAKEROAD_ORIGIN = 'https://www.makeroad.com';
const UPLOAD_URL = `${MAKEROAD_ORIGIN}/printable_3D_model/upload`;

const MODEL_FORMATS = new Set(['3mf', 'stl', 'obj']);
const PROFILE_FORMATS = new Set(['3mf']);
const IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']);
const DOCUMENT_FORMATS = new Set(['pdf', 'txt', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']);
const LIMITS = Object.freeze({
  models: 80, profiles: 10, imagesMin: 3, imagesMax: 10, documents: 5,
  modelTotalBytes: 500 * 1024 * 1024,
  imageBytes: 10 * 1024 * 1024,
  documentTotalBytes: 50 * 1024 * 1024,
  titleChars: 60,
});

function extension(name) {
  return String(name || '').split('.').pop().toLowerCase();
}

function jsonResponse(body, status = 200) {
  return { status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

function errorResponse(error) {
  return jsonResponse({ error: 'makeroad_failed', message: error instanceof Error ? error.message : String(error) }, 502);
}

function parseJsonBody(request) {
  if (request.bodyType === 'none' || request.body == null) return {};
  if (request.bodyType !== 'text') throw new Error('MakerRoad action requires a JSON body.');
  return JSON.parse(String(request.body));
}

function parseUploadBody(request) {
  if (request.bodyType !== 'form-data' || !Array.isArray(request.body)) {
    throw new Error('MakerRoad upload requires multipart form data.');
  }
  let role = '';
  let file;
  for (const entry of request.body) {
    if (entry?.name === 'role' && entry.kind === 'text') role = String(entry.value || '');
    if (entry?.name === 'file' && entry.kind === 'file') {
      file = { name: String(entry.fileName || 'upload.bin'), mimeType: String(entry.mimeType || ''), bytes: Buffer.from(entry.bytes) };
    }
  }
  if (!file) throw new Error('MakerRoad upload is missing its file.');
  return { role, file };
}

function validateUpload(role, file) {
  const formats = { model: MODEL_FORMATS, profile: PROFILE_FORMATS, image: IMAGE_FORMATS, document: DOCUMENT_FORMATS }[role];
  if (!formats) throw new Error('MakerRoad upload role must be model, profile, image, or document.');
  const ext = extension(file.name);
  if (!formats.has(ext)) throw new Error(`MakerRoad does not accept .${ext || 'unknown'} for ${role}.`);
  if (role === 'image' && file.bytes.byteLength > LIMITS.imageBytes) throw new Error(`${file.name} exceeds MakerRoad's 10 MB image limit.`);
}

function normalizeIds(items) {
  return (items || []).map((item) => String(item?.id ?? item?.fileId ?? item?.file_id ?? item)).filter(Boolean);
}

function pipe(values) {
  return (values || []).map((value) => String(value).trim()).filter(Boolean).join('|');
}

function customTag(value) {
  const tag = String(value || '').trim();
  return tag ? `#{${tag}}` : '';
}

function cookieValue(cookieHeader, name) {
  const target = String(name || '').toLowerCase();
  for (const part of String(cookieHeader || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim().toLowerCase() === target) {
      return part.slice(separator + 1).trim();
    }
  }
  return '';
}

const PRICE_TYPES = Object.freeze({ free: 1, points: 2, cash: 3 });

function validateSubmit(input) {
  const issues = [];
  const models = input.models || [];
  const profiles = input.profiles || [];
  const images = input.images || [];
  const documents = input.documents || [];
  if (!String(input.title || '').trim()) issues.push('title is required');
  if ([...String(input.title || '')].length > LIMITS.titleChars) issues.push('title exceeds 60 characters');
  if (!String(input.description || '').trim()) issues.push('description is required');
  if (!models.length) issues.push('at least one model file is required');
  if (models.length > LIMITS.models) issues.push('no more than 80 model files are allowed');
  if (profiles.length > LIMITS.profiles) issues.push('no more than 10 print configurations are allowed');
  if (images.length < LIMITS.imagesMin || images.length > LIMITS.imagesMax) issues.push('MakerRoad requires 3 to 10 images');
  if (documents.length > LIMITS.documents) issues.push('no more than 5 instruction documents are allowed');
  if ((input.categoryIds || []).length < 1 || (input.categoryIds || []).length > 3) issues.push('choose 1 to 3 categories');
  if (![1, 2].includes(Number(input.uploadType || 1))) issues.push('upload type must be Original or Remix');
  if (Number(input.uploadType || 1) === 2 && !String(input.referUrl || '').trim()) issues.push('remixes require a source URL');
  if (!(input.printMethods || []).length) issues.push('choose at least one print method');
  if (!['public', 'private'].includes(input.visibility)) issues.push('visibility must be public or private');
  if (!['free', 'points', 'cash'].includes(input.payType)) issues.push('price type must be free, points, or cash');
  if (input.payType !== 'free' && !(Number(input.payValue) > 0)) issues.push('paid downloads require a positive value');
  const total = (values) => values.reduce((sum, value) => sum + Number(value?.size || 0), 0);
  if (total(models) > LIMITS.modelTotalBytes) issues.push('model files exceed the 500 MB total limit');
  if (total(documents) > LIMITS.documentTotalBytes) issues.push('documents exceed the 50 MB total limit');
  return issues;
}

function buildSubmitPayload(input) {
  const issues = validateSubmit(input);
  if (issues.length) throw new Error(`MakerRoad upload validation failed: ${issues.join('; ')}.`);
  const action = input.action === 'publish' ? 'publish' : input.action === 'preview' ? 'preview' : 'save';
  return {
    ...(input.id ? { id: String(input.id) } : {}),
    action,
    uploadType: Number(input.uploadType || 1),
    // Current native enums captured from the production upload bundle:
    // original 2 / remix 1, public 1 / private 2, scheduled 2 / immediate 1.
    original: Number(input.uploadType || 1) === 1 ? 2 : 1,
    fileModel: normalizeIds(input.models).join('|'),
    filePrintconf: normalizeIds(input.profiles).join('|'),
    fileDoc: normalizeIds(input.documents).join('|'),
    pics: normalizeIds(input.images).join('|'),
    name: String(input.title).trim(),
    descBody: String(input.description),
    descColumn: (input.categoryIds || []).map(String),
    // ModelPrep tags are free-entry values, so the first-party form encodes
    // each as a custom tag before joining the API field with pipes.
    descTag: pipe((input.tags || []).map(customTag)),
    printType: pipe(input.printMethods),
    printer: (input.printerIds || []).map(String),
    material: (input.materialIds || []).map(String),
    color: pipe(input.colorIds),
    ai: input.aiGenerated ? 1 : 0,
    nsfw: input.nsfw ? 1 : 0,
    shareNosign: Number(input.shareNosign || 0),
    shareEdit: Number(input.shareEdit || 0),
    shareBusiness: Number(input.shareBusiness || 0),
    referUrl: Number(input.uploadType || 1) === 2 ? String(input.referUrl || '').trim() : '',
    visible: input.visibility === 'public' ? 1 : 2,
    plan: input.scheduled ? 2 : 1,
    planTime: input.scheduled ? String(input.planTime || '') : '',
    payType: PRICE_TYPES[input.payType],
    payValue: input.payType === 'free' ? '' : Number(input.payValue),
    timezoom: String(input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
  };
}

function unwrap(envelope, label) {
  if (!envelope || typeof envelope !== 'object') throw new Error(`MakerRoad ${label} returned invalid data.`);
  if (envelope.code != null && ![0, 200].includes(Number(envelope.code))) throw new Error(`MakerRoad ${label} failed: ${envelope.message || envelope.msg || envelope.code}.`);
  if (envelope.success === false) throw new Error(`MakerRoad ${label} failed: ${envelope.message || envelope.msg || 'request rejected'}.`);
  return envelope.data ?? envelope.result ?? envelope;
}

function createMakerRoadDirectClient({ fetchImpl = fetch } = {}) {
  async function api(context, path, { method = 'GET', body, form, label = path } = {}) {
    if (!context?.cookie) throw new Error('MakerRoad session is missing.');
    // MakerRoad stores the login credential in its `X-Token` cookie, but its
    // first-party Nuxt request wrapper also mirrors it into the `X-Token`
    // header. Cookies alone can reach public settings and upload bytes while
    // the authenticated `/models/info` mutation still rejects the request.
    const token = cookieValue(context.cookie, 'X-Token');
    const headers = {
      Accept: 'application/json', Cookie: context.cookie, Origin: MAKEROAD_ORIGIN, Referer: UPLOAD_URL,
      ...(token ? { 'X-Token': token } : {}),
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetchImpl(`${MAKEROAD_ORIGIN}/api${path}`, { method, headers, body: form || (body === undefined ? undefined : JSON.stringify(body)), redirect: 'manual' });
    const envelope = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`MakerRoad ${label} failed (HTTP ${response.status}).`);
    return unwrap(envelope, label);
  }

  async function whoami(context) {
    if (!cookieValue(context?.cookie, 'X-Token')) throw new Error('MakerRoad login token is missing.');
    const user = await api(context, '/user', { label: 'session check' });
    const identity = user && typeof user === 'object' ? user : {};
    const id = identity.id ?? identity.uid ?? identity.userId ?? identity.user_id;
    if (!id && !identity.nickname && !identity.username) throw new Error('MakerRoad session check returned no authenticated user.');
    return { ...identity, id: String(id || identity.nickname || identity.username), nickname: String(identity.nickname || identity.username || 'MakerRoad') };
  }

  async function metadata(context) {
    // Category resolution is required for a valid submission. The remaining
    // settings only enrich optional pickers and MakerRoad occasionally returns
    // 500 for one of them (notably `tag`) while the upload form itself works.
    // Keep categories fail-closed, but isolate optional endpoint failures so a
    // custom-tag private draft is not blocked by recommendation metadata.
    const modelsClassify = await api(context, '/settings/modelsClassify', { label: 'modelsClassify settings' });
    const optionalPaths = ['printer', 'printerType', 'material', 'tag', 'color'];
    const optional = await Promise.allSettled(optionalPaths.map((name) => api(context, `/settings/${name}`, { label: `${name} settings` })));
    return {
      modelsClassify,
      ...Object.fromEntries(optionalPaths.map((name, index) => [name, optional[index].status === 'fulfilled' ? optional[index].value : []])),
    };
  }

  async function upload(context, role, file) {
    validateUpload(role, file);
    const form = new FormData();
    form.append('file', new Blob([file.bytes], { type: file.mimeType || 'application/octet-stream' }), file.name);
    const data = await api(context, '/upload/webuploader', { method: 'POST', form, label: `${role} upload` });
    const item = Array.isArray(data) ? data[0] : data;
    const id = item?.id ?? item?.fileId ?? item?.file_id ?? item;
    if (!id) throw new Error('MakerRoad uploaded the bytes but returned no file id.');
    return { ...((item && typeof item === 'object') ? item : {}), id: String(id), name: file.name, size: file.bytes.byteLength, role };
  }

  async function save(context, input) {
    const payload = buildSubmitPayload(input);
    const data = await api(context, '/models/info', { method: input.id ? 'PUT' : 'POST', body: payload, label: payload.action });
    const id = data?.id ?? data?.modelId ?? data?.model_id ?? data;
    if (!id) throw new Error('MakerRoad accepted the model but returned no id.');
    return { id: String(id), state: payload.action === 'publish' ? 'pending' : 'draft', url: `${UPLOAD_URL}?id=${encodeURIComponent(id)}` };
  }

  async function status(context, id) {
    if (!id) throw new Error('MakerRoad read-back requires a model id.');
    return api(context, `/models/getEdit?id=${encodeURIComponent(id)}&uploadType=1`, { label: 'edit read-back' });
  }

  async function handleRequest(request, context) {
    try {
      const url = new URL(request.url);
      const route = url.pathname.split('/api/v1/makeroad/web/')[1] || '';
      if (route === 'whoami') return jsonResponse({ ok: true, user: await whoami(context) });
      if (route === 'meta') return jsonResponse({ ok: true, meta: await metadata(context) });
      if (route === 'upload' && request.method === 'POST') {
        const { role, file } = parseUploadBody(request);
        return jsonResponse({ ok: true, file: await upload(context, role, file) });
      }
      if (route === 'submit' && request.method === 'POST') return jsonResponse({ ok: true, ...(await save(context, parseJsonBody(request))) });
      if (route === 'status') return jsonResponse({ ok: true, model: await status(context, url.searchParams.get('id')) });
      return jsonResponse({ error: 'not_found', message: 'Unsupported MakerRoad desktop route.' }, 404);
    } catch (error) { return errorResponse(error); }
  }

  return { api, handleRequest, metadata, save, status, upload, whoami };
}

module.exports = { DOCUMENT_FORMATS, IMAGE_FORMATS, LIMITS, MAKEROAD_ORIGIN, MODEL_FORMATS, PRICE_TYPES, PROFILE_FORMATS, UPLOAD_URL, buildSubmitPayload, cookieValue, createMakerRoadDirectClient, validateSubmit, validateUpload };
