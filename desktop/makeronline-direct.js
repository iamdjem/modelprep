const MAKERONLINE_ORIGIN = 'https://www.makeronline.com';
const UPLOAD_URL = `${MAKERONLINE_ORIGIN}/en/upload`;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

const IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']);
const MODEL_FORMATS = new Set([
  'stl', 'obj', '3mf', '3ds', 'amf', 'blend', 'dwg', 'dxf', 'f3d', 'f3z',
  'factory', 'fcstd', 'iges', 'ipt', 'ply', 'py', 'rsdoc', 'scad', 'shape',
  'shapr', 'skp', 'sldasm', 'sldprt', 'slvs', 'step', 'stp', 'studio3',
  '123dx', 'thing',
]);
const DOCUMENT_FORMATS = new Set([
  'pdf', 'txt', 'xls', 'xlsx', 'doc', 'ppt', 'pptx', 'png', 'jpg', 'gif', 'svg',
]);
const SCENE_BY_ROLE = Object.freeze({
  cover: 2,
  photo: 2,
  'description-image': 2,
  model: 1,
  profile: 5,
  'profile-photo': 6,
  documentation: 8,
});
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_DESCRIPTION_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 500 * 1024 * 1024;
const MAX_IMAGES = 20;
const MAX_FILES = 100;
const MAX_DOCUMENTS = 50;
const MAX_TAGS = 20;
const MAX_TAG_CHARS = 20;
const MAX_TITLE_CHARS = 100;
const MAX_DESCRIPTION_CHARS = 9_000;

function jsonResponse(body, status = 200) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function errorResponse(error) {
  const message = error instanceof Error ? error.message : String(error);
  return jsonResponse({ error: 'makeronline_failed', message }, 502);
}

function extension(name) {
  const match = /\.([^.]+)$/.exec(String(name || ''));
  return match ? match[1].toLowerCase() : '';
}

function mimeFor(fileName, supplied) {
  if (supplied && supplied !== 'application/octet-stream') return supplied;
  const known = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf', txt: 'text/plain',
    svg: 'image/svg+xml', stl: 'model/stl', obj: 'model/obj', '3mf': 'model/3mf',
  };
  return known[extension(fileName)] || 'application/octet-stream';
}

function assertEnvelope(envelope, label) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error(`MakerOnline ${label} returned an invalid response.`);
  }
  if (Number(envelope.code) !== 0) {
    throw new Error(`MakerOnline ${label} failed: ${envelope.msg || envelope.message || `code ${envelope.code}`}.`);
  }
  return envelope.data;
}

function parseJsonBody(request) {
  if (request.bodyType === 'none' || request.body == null) return {};
  if (request.bodyType !== 'text') throw new Error('MakerOnline desktop action requires a JSON body.');
  return JSON.parse(String(request.body));
}

function parseUploadBody(request) {
  if (request.bodyType !== 'form-data' || !Array.isArray(request.body)) {
    throw new Error('MakerOnline desktop upload requires multipart form data.');
  }
  let role = '';
  let file = null;
  for (const entry of request.body) {
    if (entry?.name === 'role' && entry.kind === 'text') role = String(entry.value || '');
    if (entry?.name === 'file' && entry.kind === 'file') {
      file = {
        name: String(entry.fileName || 'upload.bin'),
        mimeType: String(entry.mimeType || 'application/octet-stream'),
        bytes: Buffer.from(entry.bytes),
      };
    }
  }
  if (!file) throw new Error('MakerOnline upload is missing the file.');
  return { role, file };
}

function validateUpload(role, file) {
  if (!Object.hasOwn(SCENE_BY_ROLE, role)) {
    throw new Error('MakerOnline upload role is not supported.');
  }
  const ext = extension(file.name);
  if (['cover', 'photo', 'profile-photo', 'description-image'].includes(role) && !IMAGE_FORMATS.has(ext)) {
    throw new Error(`MakerOnline does not accept .${ext || 'unknown'} as an image.`);
  }
  if (role === 'model' && !MODEL_FORMATS.has(ext)) {
    throw new Error(`MakerOnline does not accept .${ext || 'unknown'} as a raw model file.`);
  }
  if (role === 'profile' && ext !== '3mf') {
    throw new Error('MakerOnline print profiles must be .3mf files.');
  }
  if (role === 'documentation' && !DOCUMENT_FORMATS.has(ext)) {
    throw new Error(`MakerOnline does not accept .${ext || 'unknown'} as documentation.`);
  }
  const max = role === 'description-image'
    ? MAX_DESCRIPTION_IMAGE_BYTES
    : ['cover', 'photo', 'profile-photo'].includes(role)
      ? MAX_IMAGE_BYTES
      : MAX_FILE_BYTES;
  if (file.bytes.byteLength > max) {
    throw new Error(`${file.name} exceeds MakerOnline's ${Math.round(max / 1024 / 1024)} MB limit for this field.`);
  }
}

function normalizeTags(tags) {
  const values = [...new Set((Array.isArray(tags) ? tags : [])
    .map((value) => String(value?.name ?? value ?? '').trim())
    .filter(Boolean))];
  if (values.length > MAX_TAGS) throw new Error(`MakerOnline accepts at most ${MAX_TAGS} tags.`);
  if (values.some((value) => [...value].length > MAX_TAG_CHARS)) {
    throw new Error(`MakerOnline tags may not exceed ${MAX_TAG_CHARS} characters.`);
  }
  return values;
}

function normalizeUploadedFile(value, role, source) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const item = candidate?.file || candidate?.file_info || candidate?.info || candidate;
  const url = item?.url ?? item?.file_url ?? item?.fileUrl ?? item?.path;
  if (!url) throw new Error('MakerOnline accepted the bytes but returned no file URL.');
  return {
    ...item,
    role,
    name: String(item?.file_name ?? item?.fileName ?? source.name),
    size: Number(item?.file_size ?? item?.fileSize ?? source.bytes.byteLength),
    url: String(url),
    thumbnailUrl: String(item?.thumbnail_url ?? item?.thumbnailUrl ?? item?.thumb_url ?? url),
    key: String(item?.key ?? item?.file_key ?? ''),
    id: String(item?.doc_id ?? item?.file_id ?? item?.id ?? ''),
  };
}

function normalizeImage(value, isMain = false) {
  if (!value?.url) throw new Error('MakerOnline submit is missing an uploaded image.');
  return {
    url: String(value.url),
    thumbnail_url: String(value.thumbnail_url ?? value.thumbnailUrl ?? value.url),
    is_main: isMain ? 1 : 0,
  };
}

function normalizeDocument(value) {
  if (!value?.url) throw new Error('MakerOnline submit is missing an uploaded documentation file.');
  return {
    doc_id: String(value.doc_id ?? value.id ?? ''),
    file_name: String(value.file_name ?? value.name ?? ''),
    file_size: Number(value.file_size ?? value.size ?? 0),
    key: String(value.key ?? ''),
    url: String(value.url),
  };
}

function normalizeModel(value) {
  if (!value?.url) throw new Error('MakerOnline submit is missing an uploaded model file.');
  return {
    file_name: String(value.file_name ?? value.name ?? ''),
    file_size: Number(value.file_size ?? value.size ?? 0),
    url: String(value.url),
  };
}

function normalizeProfile(value) {
  if (!value?.url) throw new Error('MakerOnline submit is missing an uploaded print profile.');
  const parsed = value.parsed && typeof value.parsed === 'object' ? value.parsed : {};
  return {
    file_name: String(value.file_name ?? value.name ?? ''),
    file_size: Number(value.file_size ?? value.size ?? 0),
    url: String(value.url),
    simple_url: String(value.simple_url ?? value.simpleUrl ?? parsed.simple_url ?? ''),
    thumbnail: String(value.thumbnail ?? parsed.thumbnail ?? ''),
    self_model: value.self_model ?? value.selfModel ?? parsed.self_model ?? 0,
    printers: value.printers ?? parsed.printers ?? [],
    nozzle: value.nozzle ?? parsed.nozzle ?? '',
    layer: value.layer ?? parsed.layer ?? '',
    plates: value.plates ?? parsed.plates ?? [],
    parse_type: Number(value.parse_type ?? value.parseType ?? parsed.parse_type ?? 1),
  };
}

function validateSubmit(input) {
  const issues = [];
  const title = String(input.title || '').trim();
  const description = String(input.description || '');
  const source = Number(input.source || 1);
  const license = Number(input.license || 3);
  const permission = Number(input.permission || 2);
  const printMethod = Number(input.printMethod || 3);
  if (!title) issues.push('title is required');
  if ([...title].length > MAX_TITLE_CHARS) issues.push(`title exceeds ${MAX_TITLE_CHARS} characters`);
  if ([...description.replace(/<[^>]+>/g, '')].length > MAX_DESCRIPTION_CHARS) {
    issues.push(`description exceeds ${MAX_DESCRIPTION_CHARS} characters`);
  }
  if (!/^[1-9]\d*$/.test(String(input.categoryId || ''))) issues.push('a MakerOnline leaf category is required');
  if (![1, 2].includes(source)) issues.push('source must be Original or Remix');
  if (source === 2 && !String(input.originalUrl || '').trim()) issues.push('remixes require the original-work URL');
  if (source === 2 && [5, 6].includes(license)) issues.push('remixes cannot use a NoDerivatives license');
  if (![1, 2, 3, 4, 5, 6, 7, 8].includes(license)) issues.push('license is not supported');
  if (![1, 2].includes(permission)) issues.push('permission must be Public or Private');
  if (input.publication === 'public' && permission !== 1) issues.push('public publishing requires Public model permission');
  if (![1, 2, 3].includes(printMethod)) issues.push('printing method must be FDM, Resin, or Both');
  if (!Array.isArray(input.images) || !input.images.length) issues.push('at least one model image is required');
  if ((input.images || []).length > MAX_IMAGES) issues.push(`no more than ${MAX_IMAGES} model images are allowed`);
  if (!Array.isArray(input.models) || !input.models.length) issues.push('at least one raw model file is required');
  if ((input.models || []).length > MAX_FILES) issues.push(`no more than ${MAX_FILES} raw model files are allowed`);
  if ((input.documents || []).length > MAX_DOCUMENTS) issues.push(`no more than ${MAX_DOCUMENTS} documentation files are allowed`);
  if (input.relatedKits && !(input.storeKitIds || []).length) issues.push('select at least one Creative Kit');
  if (input.syncChina && (permission !== 1 || input.nsfw)) issues.push('China sync requires a public, non-NSFW model');
  if (input.exclusive) {
    if (source !== 1 || permission !== 1 || license !== 8) issues.push('exclusive models must be Original, Public, and use the Standard Digital File License');
    if (!(input.printProfiles || []).length) issues.push('exclusive models require a print profile');
  }
  normalizeTags(input.tags);
  return issues;
}

function buildSubmitPayload(input) {
  const issues = validateSubmit(input);
  if (issues.length) throw new Error(`MakerOnline upload validation failed: ${issues.join('; ')}.`);
  const printMethod = Number(input.printMethod || 3);
  const hasProfiles = printMethod !== 2 && !!input.includePrintProfile && (input.printProfiles || []).length > 0;
  const payload = {
    source: Number(input.source || 1),
    license: Number(input.license || 3),
    original_link: Number(input.source || 1) === 2 ? String(input.originalUrl || '').trim() : '',
    images: input.images.map((value, index) => normalizeImage(value, index === 0)),
    title: String(input.title).trim(),
    category_id: Number(input.categoryId),
    tags: normalizeTags(input.tags),
    permissions: Number(input.permission || 2),
    print_types: printMethod === 3 ? [1, 2] : [printMethod],
    desc: String(input.description || ''),
    docs: (input.documents || []).map(normalizeDocument),
    is_adult_nsfw: input.nsfw ? 1 : 0,
    ai_help: input.aiHelp ? 1 : 0,
    is_sync: input.syncChina ? 1 : 0,
    is_related_kits: input.relatedKits ? 1 : 0,
    store_kit_ids: input.relatedKits ? (input.storeKitIds || []).map(Number) : [],
    print_file_type: hasProfiles ? 1 : 0,
    parse_type: hasProfiles ? 1 : 0,
    files: input.models.map(normalizeModel),
    exclusive_type: input.exclusive ? 1 : 0,
    is_free: 1,
    price: 0,
  };
  if (hasProfiles) {
    payload.print_files = input.printProfiles.map(normalizeProfile);
    payload.print_title = String(input.printTitle || input.title).trim().slice(0, MAX_TITLE_CHARS);
    payload.print_images = (input.printImages?.length ? input.printImages : input.images)
      .map((value, index) => normalizeImage(value, index === 0));
    payload.print_desc = String(input.printDescription || '');
  }
  return payload;
}

function createMakerOnlineDirectClient({ fetchImpl = fetch, uuid = () => require('node:crypto').randomUUID() } = {}) {
  async function api(context, path, { method = 'GET', body, form, label = path } = {}) {
    if (!context?.token) throw new Error('MakerOnline session is missing.');
    const headers = {
      Accept: 'application/json, text/plain, */*',
      Authorization: String(context.token),
      Cookie: String(context.cookie || ''),
      Origin: MAKERONLINE_ORIGIN,
      Referer: UPLOAD_URL,
      'User-Agent': USER_AGENT,
      language: 'en',
    };
    let requestBody;
    if (form) {
      requestBody = form;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }
    const response = await fetchImpl(`${MAKERONLINE_ORIGIN}${path}`, {
      method,
      headers,
      body: requestBody,
      redirect: 'manual',
    });
    const envelope = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`MakerOnline ${label} failed (HTTP ${response.status})${envelope?.message ? `: ${envelope.message}` : ''}.`);
    }
    return assertEnvelope(envelope, label);
  }

  async function whoami(context) {
    const data = await api(context, '/api/user/personal/info?noredirect', { label: 'account check' });
    const user = data?.user || data?.info || data || {};
    return {
      id: String(user.id ?? user.user_id ?? user.userId ?? ''),
      nickname: String(user.display_name ?? user.nickname ?? user.user_name ?? ''),
      avatar: String(user.avatar ?? user.avatar_url ?? ''),
    };
  }

  async function metadata(context) {
    const [categories, kits] = await Promise.all([
      api(context, '/api/category/options', { label: 'category options' }),
      api(context, '/api/mold/store-options', { label: 'Creative Kit options' }),
    ]);
    return { categories: categories || [], kits: kits || [] };
  }

  async function eligibility(context) {
    const result = { exclusive: { eligible: false, message: '' }, chinaSync: { eligible: false } };
    try {
      await api(context, '/api/moldExclusive/getExclusiveMoldPermission', { label: 'exclusive eligibility' });
      result.exclusive.eligible = true;
    } catch (error) {
      result.exclusive.message = error instanceof Error ? error.message : String(error);
    }
    try {
      const user = await whoami(context);
      if (user.id) {
        const auth = await api(context, `/api/sync-auth/getAuth?user_id=${encodeURIComponent(user.id)}`, { label: 'China sync eligibility' });
        result.chinaSync.eligible = Array.isArray(auth) ? auth.length > 0 : !!auth;
      }
    } catch { /* unavailable means not eligible */ }
    return result;
  }

  async function upload(context, role, file) {
    validateUpload(role, file);
    const form = new FormData();
    form.append('file', new Blob([file.bytes], { type: mimeFor(file.name, file.mimeType) }), file.name);
    form.append('scene_type', String(SCENE_BY_ROLE[role]));
    form.append('file_uid', uuid());
    const data = await api(context, '/api/file/upload', {
      method: 'POST', form, label: `${role} upload`,
    });
    return normalizeUploadedFile(data, role, file);
  }

  async function parseProfile(context, file) {
    const key = String(file?.key || file?.file_key || '');
    if (!key) throw new Error('MakerOnline print-profile parsing requires the uploaded file key.');
    const parsed = await api(context, '/api/file/parse-info', {
      // The production parser accepts a batch of uploaded keys even when only
      // one profile is being parsed. Sending a scalar is rejected with
      // "The file key must be an array."
      method: 'POST', body: { file_type: 1, file_key: [key] }, label: 'print-profile parsing',
    });
    if (Array.isArray(parsed)) return parsed[0] || {};
    if (Array.isArray(parsed?.list)) return parsed.list[0] || {};
    return parsed || {};
  }

  async function save(context, input) {
    const payload = buildSubmitPayload(input);
    const draft = input.publication !== 'public';
    const data = await api(context, draft ? '/api/mold/save-draft' : '/api/mold/create', {
      method: 'POST', body: payload, label: draft ? 'draft save' : 'public publish',
    });
    const id = typeof data === 'string' || typeof data === 'number'
      ? data
      : data?.id ?? data?.mold_id ?? data?.moldId ?? data?.model_id ?? data?.modelId;
    if (!id) throw new Error('MakerOnline accepted the model but did not return an id for read-back verification.');
    return {
      id: String(id),
      state: draft ? 'draft' : 'public',
      url: draft
        ? `${UPLOAD_URL}?id=${encodeURIComponent(id)}`
        : String(data?.url || data?.detail_url || `${MAKERONLINE_ORIGIN}/en/model/${encodeURIComponent(id)}`),
    };
  }

  async function status(context, id) {
    if (!id) throw new Error('MakerOnline read-back requires a model id.');
    return api(context, `/api/mold/edit-info?id=${encodeURIComponent(id)}`, { label: 'saved-model read-back' });
  }

  async function handleRequest(request, context) {
    try {
      const url = new URL(request.url);
      const route = url.pathname.split('/api/v1/makeronline/web/')[1] || '';
      if (route === 'whoami') return jsonResponse({ ok: true, user: await whoami(context) });
      if (route === 'meta') return jsonResponse({ ok: true, ...(await metadata(context)) });
      if (route === 'eligibility') return jsonResponse({ ok: true, ...(await eligibility(context)) });
      if (route === 'upload' && request.method === 'POST') {
        const { role, file } = parseUploadBody(request);
        return jsonResponse({ ok: true, file: await upload(context, role, file) });
      }
      if (route === 'parse-profile' && request.method === 'POST') {
        return jsonResponse({ ok: true, parsed: await parseProfile(context, parseJsonBody(request)) });
      }
      if (route === 'submit' && request.method === 'POST') {
        return jsonResponse({ ok: true, ...(await save(context, parseJsonBody(request))) });
      }
      if (route === 'status') {
        return jsonResponse({ ok: true, model: await status(context, url.searchParams.get('id')) });
      }
      return jsonResponse({ error: 'not_found', message: 'Unsupported MakerOnline desktop route.' }, 404);
    } catch (error) {
      return errorResponse(error);
    }
  }

  return { api, eligibility, handleRequest, metadata, parseProfile, save, status, upload, whoami };
}

module.exports = {
  DOCUMENT_FORMATS,
  IMAGE_FORMATS,
  MAKERONLINE_ORIGIN,
  MODEL_FORMATS,
  SCENE_BY_ROLE,
  UPLOAD_URL,
  buildSubmitPayload,
  createMakerOnlineDirectClient,
  validateSubmit,
  validateUpload,
};
