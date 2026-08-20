const { createHash } = require('node:crypto');

const NEXPRINT_ORIGIN = 'https://www.nexprint.com';
const NEXPRINT_GATEWAY = `${NEXPRINT_ORIGIN}/gateway`;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

const MODEL_FORMATS = new Set([
  '3ds', '3mf', 'amf', 'blend', 'dwg', 'dxf', 'elesat', 'f3d', 'f3z',
  'factory', 'fcstd', 'iges', 'ipt', 'obj', 'ply', 'py', 'rsdoc', 'scad',
  'shape', 'shapr', 'skp', 'sldasm', 'sldprt', 'slvs', 'step', 'stl',
  'stp', 'studio3', 'zpr', 'stpz',
]);
const ATTACHMENT_FORMATS = new Set([
  'ai', 'bgcode', 'cdr', 'csv', 'ctb', 'gcode', 'goo', 'ini', 'ino',
  'lys', 'lyt', 'pdf', 'svg', 'txt', 'zip',
]);
const IMAGE_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif']);
const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_IMAGE_BYTES = 100 * 1024 * 1024;
const MAX_MODEL_FILES = 100;
const MAX_ATTACHMENTS = 100;
const MAX_PHOTOS = 9;
const MAX_TAGS = 20;
const MAX_TAG_CHARS = 50;
const MAX_TITLE_CHARS = 80;
const MAX_DESCRIPTION_CHARS = 10_000;

function jsonResponse(body, status = 200) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function errorResponse(error) {
  const message = error instanceof Error ? error.message : String(error);
  return jsonResponse({ error: 'nexprint_failed', message }, 502);
}

function extension(name) {
  const match = /\.([^.]+)$/.exec(String(name || ''));
  return match ? match[1].toLowerCase() : '';
}

function trimUploadName(name) {
  const source = String(name || 'upload.bin');
  const dot = source.lastIndexOf('.');
  if (dot < 0) return source.slice(0, 80);
  return `${source.slice(0, dot).slice(0, 80)}${source.slice(dot)}`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function makeStoragePath(bytes, fileName, now = Date.now) {
  const source = Buffer.from(bytes);
  const suffix = extension(fileName);
  return `${sha256(source.subarray(0, 9_999))}-${now()}-${sha256(String(fileName))}${suffix ? `.${suffix}` : ''}`;
}

function mimeFor(fileName, supplied) {
  if (supplied && supplied !== 'application/octet-stream') return supplied;
  const ext = extension(fileName);
  const known = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    json: 'application/json',
    pdf: 'application/pdf',
    stl: 'model/stl',
    '3mf': 'model/3mf',
    zip: 'application/zip',
  };
  return known[ext] || 'application/octet-stream';
}

function assertEnvelope(envelope, label) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error(`Nexprint ${label} returned an invalid response.`);
  }
  if (Number(envelope.code) !== 0) {
    throw new Error(`Nexprint ${label} failed: ${envelope.msg || envelope.message || `code ${envelope.code}`}.`);
  }
  return envelope.data;
}

function parseJsonBody(request) {
  if (request.bodyType === 'none' || request.body == null) return {};
  if (request.bodyType !== 'text') throw new Error('Nexprint desktop action requires a JSON body.');
  return JSON.parse(String(request.body));
}

function parseUploadBody(request) {
  if (request.bodyType !== 'form-data' || !Array.isArray(request.body)) {
    throw new Error('Nexprint desktop upload requires multipart form data.');
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
  if (!file) throw new Error('Nexprint upload is missing the file.');
  return { role, file };
}

function validateUpload(role, file) {
  const ext = extension(file.name);
  if (role === 'model' && !MODEL_FORMATS.has(ext)) {
    throw new Error(`Nexprint does not accept .${ext || 'unknown'} as a model file.`);
  }
  if (role === 'attachment' && !ATTACHMENT_FORMATS.has(ext)) {
    throw new Error(`Nexprint does not accept .${ext || 'unknown'} as an attachment.`);
  }
  if ((role === 'cover' || role === 'photo') && !IMAGE_FORMATS.has(ext)) {
    throw new Error(`Nexprint does not accept .${ext || 'unknown'} as an image.`);
  }
  if (!['model', 'attachment', 'cover', 'photo'].includes(role)) {
    throw new Error('Nexprint upload role must be model, attachment, cover, or photo.');
  }
  const max = role === 'cover' || role === 'photo' ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (file.bytes.byteLength > max) {
    throw new Error(`${file.name} exceeds Nexprint's ${max === MAX_IMAGE_BYTES ? '100 MB image' : '2 GiB file'} limit.`);
  }
}

function normalizedFileRecord(value) {
  if (!value?.fileId || !value?.fileUrl) throw new Error('Nexprint submit is missing an uploaded file record.');
  return {
    fileId: String(value.fileId),
    fileName: String(value.fileName || ''),
    fileSize: Number(value.fileSize || 0),
    fileUrl: String(value.fileUrl),
    fileExt: String(value.fileExt || extension(value.fileName)),
    ...(value.fileExtension ? { fileExtension: value.fileExtension } : {}),
    ...(value.thumbnailFileId ? { thumbnailFileId: String(value.thumbnailFileId) } : {}),
    ...(value.thumbnailFileUrl ? { thumbnailFileUrl: String(value.thumbnailFileUrl) } : {}),
    ...(value.msgDigest ? { msgDigest: String(value.msgDigest) } : {}),
    ...(Array.isArray(value.multiViews) ? { multiViews: value.multiViews } : {}),
  };
}

function normalizedTags(tags, aiGenerated) {
  const values = [...new Set((Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag || '').trim())
    .filter(Boolean))];
  if (aiGenerated && !values.some((tag) => /ai[-\s]?generated/i.test(tag))) {
    values.push('AI-generated');
  }
  if (values.length > MAX_TAGS) throw new Error(`Nexprint allows at most ${MAX_TAGS} tags.`);
  const tooLong = values.find((tag) => [...tag].length > MAX_TAG_CHARS);
  if (tooLong) throw new Error(`Nexprint tag "${tooLong}" exceeds ${MAX_TAG_CHARS} characters.`);
  return values;
}

function validateSubmit(input) {
  const issues = [];
  const title = String(input.title || '').trim();
  const description = String(input.description || '');
  const originalityType = Number(input.originalityType || 1);
  if (!title) issues.push('title is required');
  if ([...title].length > MAX_TITLE_CHARS) issues.push(`title exceeds ${MAX_TITLE_CHARS} characters`);
  if (!input.categoryId) issues.push('categoryId is required');
  if (!Number.isInteger(Number(input.licenseType)) || Number(input.licenseType) < 0 || Number(input.licenseType) > 7) {
    issues.push('licenseType must be one of Nexprint licenses 0 through 7');
  }
  if (![1, 2, 3].includes(originalityType)) issues.push('originalityType must be original, adapted, or reprint');
  if (originalityType !== 1 && !String(input.sourceUrl || '').trim() && !String(input.sourceModelId || '').trim()) {
    issues.push('adapted and reprinted models require a source URL or Nexprint model id');
  }
  if ([...description].length > MAX_DESCRIPTION_CHARS) issues.push(`description exceeds ${MAX_DESCRIPTION_CHARS} characters`);
  if (!input.cover?.fileId || !input.cover?.fileUrl) issues.push('cover is required');
  if (!Array.isArray(input.models) || !input.models.length) issues.push('at least one model file is required');
  if ((input.models || []).length > MAX_MODEL_FILES) issues.push(`no more than ${MAX_MODEL_FILES} model files are allowed`);
  if ((input.photos || []).length > MAX_PHOTOS) issues.push(`no more than ${MAX_PHOTOS} gallery photos are allowed`);
  if ((input.attachments || []).length > MAX_ATTACHMENTS) issues.push(`no more than ${MAX_ATTACHMENTS} attachments are allowed`);
  if (input.hasBom && (input.bom || []).some((row) =>
    !String(row.materialName || '').trim() || !(Number(row.materialNum) > 0))) {
    issues.push('every BOM row requires a name and positive quantity');
  }
  normalizedTags(input.tags, input.aiGenerated);
  return issues;
}

function buildSubmitPayload(input) {
  const issues = validateSubmit(input);
  if (issues.length) throw new Error(`Nexprint publish validation failed: ${issues.join('; ')}.`);
  const originalityType = Number(input.originalityType || 1);
  const model = {
    coverImgFileId: String(input.cover.fileId),
    coverImgUrl: String(input.cover.fileUrl),
    modelName: String(input.title).trim(),
    originalityType,
    adaptContent: String(input.adaptContent || ''),
    status: input.draftOnly ? 0 : 1,
    open: true,
    uploadTime: '',
    classificationId: String(input.categoryId),
    licenseType: Number(input.licenseType),
    modelDetail: String(input.description || ''),
    nsfw: !!input.nsfw,
    modelPicList: (input.photos || []).map(normalizedFileRecord),
    modelFileList: input.models.map(normalizedFileRecord),
    modelAttachList: (input.attachments || []).map(normalizedFileRecord),
    modelTagList: normalizedTags(input.tags, input.aiGenerated),
    settingList: Array.isArray(input.settingList) ? input.settingList : [],
    modelMaterialInfoVOList: input.hasBom
      ? (input.bom || []).map((row) => ({
        materialName: String(row.materialName || '').trim().slice(0, 80),
        materialNum: Number(row.materialNum),
        materialRemark: String(row.materialRemark || '').trim().slice(0, 1_000),
      }))
      : [],
    modelCollectionIds: (input.collectionIds || []).map(String),
    joinActivityIds: originalityType === 3 ? [] : (input.activityIds || []).map(String),
    firstCommitPublish: input.firstCommitPublish !== false,
    worldFirstRelease: input.worldFirstRelease ? 1 : 0,
  };
  if (originalityType !== 1) {
    if (input.sourceModelId) model.originModelId = String(input.sourceModelId);
    if (input.sourceUrl) model.originUrl = String(input.sourceUrl).trim();
  }
  if (input.id) model.id = String(input.id);
  return { modelInfoList: [model] };
}

function createNexprintDirectClient({ fetchImpl = fetch, now = Date.now } = {}) {
  async function gateway(context, path, {
    method = 'GET',
    query,
    body,
    label = path,
  } = {}) {
    const url = new URL(`${NEXPRINT_GATEWAY}${path}`);
    for (const [key, value] of Object.entries(query || {})) {
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    }
    const headers = {
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      Authorization: `Bearer ${context.token}`,
      'Client-Id': 'Nexprint',
      'User-Lang': 'en',
      Origin: NEXPRINT_ORIGIN,
      Referer: `${NEXPRINT_ORIGIN}/en/upload`,
      'User-Agent': USER_AGENT,
    };
    if (context.cookie) headers.Cookie = context.cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetchImpl(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let envelope;
    try {
      envelope = JSON.parse(text);
    } catch {
      throw new Error(`Nexprint ${label} returned HTTP ${response.status} with non-JSON data.`);
    }
    if (!response.ok) {
      throw new Error(`Nexprint ${label} returned HTTP ${response.status}: ${envelope.msg || envelope.message || text.slice(0, 200)}`);
    }
    // Expired sessions come back as HTTP 200 with {code:401, msg:"账号未登录"}
    // (live-probed, stays Chinese even with User-Lang: en). Surface a typed
    // reconnect error instead of the raw Chinese envelope string.
    if (Number(envelope?.code) === 401) {
      const error = new Error('Nexprint session expired. Reconnect Nexprint and try again.');
      error.code = 'reconnect_required';
      throw error;
    }
    return assertEnvelope(envelope, label);
  }

  async function whoami(context) {
    const data = await gateway(context, '/api/v1/model-user-server/member/user_data', {
      method: 'POST',
      body: {},
      label: 'account check',
    });
    if (!data || typeof data !== 'object') throw new Error('Nexprint account check returned no user.');
    const user = data.userData || data.userInfo || data.member || data;
    return {
      id: String(user.userId || user.user_id || user.id || user.uid || ''),
      handle: String(user.userName || user.userId || user.user_id || user.id || ''),
      nickname: String(user.nickname || user.userName || user.name || ''),
    };
  }

  async function upload(context, role, file) {
    validateUpload(role, file);
    const storagePath = makeStoragePath(file.bytes, file.name, now);
    const presigned = await gateway(context, '/api/v1/infra-server/file/presigned-url', {
      query: { path: storagePath },
      label: 'upload authorization',
    });
    if (!presigned?.uploadUrl || !presigned?.url || !presigned?.configId) {
      throw new Error('Nexprint returned an incomplete upload authorization.');
    }
    const contentType = mimeFor(file.name, file.mimeType);
    const stored = await fetchImpl(presigned.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file.bytes,
    });
    if (!stored.ok) throw new Error(`Nexprint storage upload returned HTTP ${stored.status}.`);
    const ext = extension(file.name);
    const fileExtension = ext === '3mf' ? { is3MF: true } : undefined;
    const recordInput = {
      configId: presigned.configId,
      url: presigned.url,
      path: storagePath,
      name: trimUploadName(file.name),
      type: contentType,
      size: file.bytes.byteLength,
      ...(fileExtension ? { fileExtension } : {}),
    };
    const fileRecord = await gateway(context, '/api/v1/infra-server/file/create', {
      method: 'POST',
      body: recordInput,
      label: 'file registration',
    });
    const fileId = fileRecord?.fileId ?? fileRecord?.id ?? fileRecord;
    if (fileId == null || fileId === '') {
      throw new Error('Nexprint did not return a registered file id.');
    }
    return {
      fileId: String(fileId),
      fileUrl: String(presigned.url),
      fileName: recordInput.name,
      fileSize: recordInput.size,
      fileExt: ext,
      ...(fileExtension ? { fileExtension } : {}),
      ...(role === 'model' ? { msgDigest: createHash('md5').update(file.bytes).digest('hex') } : {}),
    };
  }

  async function submit(context, input) {
    const payload = buildSubmitPayload(input);
    const data = await gateway(context, '/api/v1/model-library-server/model-base-info/createOrUpdateBatch', {
      method: 'POST',
      body: payload,
      label: input.draftOnly ? 'draft save' : 'publish',
    });
    const result = data?.modelInfoList?.[0];
    const resultId = result?.id ?? result?.modelId;
    if (resultId == null || resultId === '') throw new Error('Nexprint did not return the saved model id.');
    const id = String(resultId);
    return {
      id,
      status: input.draftOnly ? 'draft' : 'published',
      url: input.draftOnly
        ? `${NEXPRINT_ORIGIN}/en/editUpload/${id}`
        : `${NEXPRINT_ORIGIN}/en/models/${result.modelCode || result.modelId || id}`,
      model: result,
    };
  }

  async function handleRequest(request, context) {
    const url = new URL(request.url);
    const route = url.pathname.replace('/api/v1/nexprint/web/', '');
    const method = request.method || 'GET';
    try {
      if (route === 'whoami' && method === 'GET') {
        return jsonResponse({ ok: true, user: await whoami(context) });
      }
      if (route === 'categories' && method === 'GET') {
        const categories = await gateway(context, '/api/v1/model-library-server/model-classification/tree', {
          query: { time: now() },
          label: 'category list',
        });
        return jsonResponse({
          ok: true,
          categories: Array.isArray(categories) ? categories : (categories?.list || categories?.tree || []),
        });
      }
      if (route === 'activities' && method === 'GET') {
        const activities = await gateway(context, '/api/v1/model-library-server/model-activity/can-join-activity', {
          query: url.searchParams.get('modelId') ? { modelId: url.searchParams.get('modelId') } : undefined,
          label: 'eligible activities',
        });
        return jsonResponse({
          ok: true,
          activities: Array.isArray(activities)
            ? activities
            : (activities?.list || activities?.records || activities?.activityList || []),
        });
      }
      if (route === 'collections' && method === 'GET') {
        const page = await gateway(context, '/api/v1/model-library-server/model-collection/collections/page', {
          query: { pageNo: 1, pageSize: 99 },
          label: 'collections',
        });
        return jsonResponse({ ok: true, collections: page?.list || [], total: Number(page?.total || 0) });
      }
      if (route === 'upload' && method === 'POST') {
        const { role, file } = parseUploadBody(request);
        return jsonResponse({ ok: true, file: await upload(context, role, file) });
      }
      if (route === 'submit' && method === 'POST') {
        return jsonResponse({ ok: true, ...(await submit(context, parseJsonBody(request))) });
      }
      if (route === 'status' && method === 'GET') {
        const id = url.searchParams.get('id');
        if (!id) return jsonResponse({ error: 'missing_id' }, 400);
        const model = await gateway(context, '/api/v1/model-library-server/model-base-info/getEditInfo', {
          query: { id },
          label: 'model readback',
        });
        return jsonResponse({ ok: true, model });
      }
      if (route === 'my-models' && method === 'GET') {
        const page = await gateway(context, '/api/v1/model-library-server/model-base-info/list/page', {
          query: {
            pageNo: url.searchParams.get('pageNo') || 1,
            pageSize: url.searchParams.get('pageSize') || 50,
            ...(url.searchParams.get('status') ? { status: url.searchParams.get('status') } : {}),
          },
          label: 'model list',
        });
        return jsonResponse({ ok: true, models: page?.list || [], total: Number(page?.total || 0) });
      }
      if (route === 'delete' && method === 'POST') {
        const id = String(parseJsonBody(request).id || '');
        if (!id) return jsonResponse({ error: 'missing_id' }, 400);
        await gateway(context, `/api/v1/model-library-server/model-base-info/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          label: 'model delete',
        });
        return jsonResponse({ ok: true, id, deleted: true });
      }
      return jsonResponse({ error: 'not_found' }, 404);
    } catch (error) {
      return errorResponse(error);
    }
  }

  return { handleRequest, submit, upload, whoami };
}

module.exports = {
  ATTACHMENT_FORMATS,
  IMAGE_FORMATS,
  MODEL_FORMATS,
  buildSubmitPayload,
  createNexprintDirectClient,
  makeStoragePath,
  trimUploadName,
  validateSubmit,
  validateUpload,
};
