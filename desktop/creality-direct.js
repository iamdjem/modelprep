const { createHash, randomUUID } = require('node:crypto');

const CREALITY_ORIGIN = 'https://www.crealitycloud.com';
const CREATE_URL = `${CREALITY_ORIGIN}/create-model-new?editType=editModel`;
const API_REFERER = `${CREALITY_ORIGIN}/flowprint/create-model?iframe=1`;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

const MODEL_FORMATS = new Set(['stl', 'obj', 'ply', 'off', '3mf', '3ds', 'wrl', 'dae', 'step', 'stp']);
const IMAGE_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif']);
const INSTRUCTION_FORMATS = new Set([
  'txt', 'pdf', 'doc', 'xls', 'html', 'rtf', 'gif', 'bmp', 'docx', 'xlsx',
  'pptx', 'wps', 'png', 'ppt', 'jpg', 'jpeg',
]);
const LICENSES = new Set([
  'CC BY', 'CC0', 'CC BY-SA', 'CC BY-ND', 'CC BY-NC', 'CC BY-NC-SA',
  'CC BY-NC-ND', 'CXY-SL',
]);
// categoryList { type: 7 }, captured 2026-07-31. Rejecting unknown ids here
// prevents picker positions (for example `12`) from silently becoming
// categoryId `0` in the saved model.
const CATEGORY_IDS = new Set([
  '1731', '1316', '1904', '1645', '6006',
  '1670', '1662', '1584', '1341', '1997', '6005',
  '1809', '1575', '1141', '1793', '6007',
  '1519', '1741', '1648', '1194', '1420', '1246', '6004',
  '1010', '1150', '1096', '1775', '1671', '1151', '6000',
  '1175', '1966', '1693', '1598', '1647', '6002',
  '1501', '1974', '1343', '6003',
  '1952', '1025', '1888', '1846', '1982', '6008',
  '1160', '1192', '1765', '6001',
  '6012', '6014', '6010', '6013', '6011',
]);
const MAX_TITLE_CHARS = 60;
const MAX_TAGS = 20;
const MAX_TAG_CHARS = 30;
const MAX_GALLERY_IMAGES = 9;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function jsonResponse(body, status = 200) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function errorResponse(error) {
  const message = error instanceof Error ? error.message : String(error);
  return jsonResponse({ error: 'creality_failed', message }, 502);
}

function extension(name) {
  const match = /\.([^.]+)$/.exec(String(name || ''));
  return match ? match[1].toLowerCase() : '';
}

function mimeFor(fileName, supplied) {
  if (supplied && supplied !== 'application/octet-stream') return supplied;
  const types = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    pdf: 'application/pdf', txt: 'text/plain', html: 'text/html', stl: 'model/stl',
    obj: 'model/obj', '3mf': 'model/3mf',
  };
  return types[extension(fileName)] || 'application/octet-stream';
}

function normalizeCdnUrl(host, key) {
  if (!host) return '';
  return `${String(host).replace(/\/+$/, '')}/${String(key).replace(/^\/+/, '')}`;
}

function assertApi(envelope, label) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error(`Creality ${label} returned an invalid response.`);
  }
  if (Number(envelope.code) !== 0) {
    throw new Error(`Creality ${label} failed: ${envelope.msg || envelope.message || `code ${envelope.code}`}.`);
  }
  return envelope.result;
}

function parseJsonBody(request) {
  if (request.bodyType === 'none' || request.body == null) return {};
  if (request.bodyType !== 'text') throw new Error('Creality desktop action requires a JSON body.');
  return JSON.parse(String(request.body));
}

function parseUploadBody(request) {
  if (request.bodyType !== 'form-data' || !Array.isArray(request.body)) {
    throw new Error('Creality desktop upload requires multipart form data.');
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
  if (!file) throw new Error('Creality upload is missing the file.');
  return { role, file };
}

function validateUpload(role, file) {
  const ext = extension(file.name);
  if (!['model', 'instruction', 'cover', 'photo', 'profile'].includes(role)) {
    throw new Error('Creality upload role must be model, instruction, cover, photo, or profile.');
  }
  if (role === 'model' && !MODEL_FORMATS.has(ext)) {
    throw new Error(`Creality does not accept .${ext || 'unknown'} as a model file.`);
  }
  if (role === 'instruction' && !INSTRUCTION_FORMATS.has(ext)) {
    throw new Error(`Creality does not accept .${ext || 'unknown'} as an instruction file.`);
  }
  if ((role === 'cover' || role === 'photo') && !IMAGE_FORMATS.has(ext)) {
    throw new Error(`Creality does not accept .${ext || 'unknown'} as an image.`);
  }
  if (role === 'profile' && ext !== '3mf') {
    throw new Error('Creality print-setting uploads must be .3mf files.');
  }
  if ((role === 'cover' || role === 'photo') && file.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`${file.name} exceeds Creality's 20 MB image limit.`);
  }
}

function normalizeTags(tags) {
  const values = [...new Set((Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag?.name ?? tag ?? '').trim())
    .filter(Boolean))];
  if (values.length > MAX_TAGS) throw new Error(`Creality allows at most ${MAX_TAGS} tags.`);
  const long = values.find((tag) => [...tag].length > MAX_TAG_CHARS);
  if (long) throw new Error(`Creality tags may not exceed ${MAX_TAG_CHARS} characters: “${long}”.`);
  return values;
}

function normalizedPicture(value, fallbackWidth, fallbackHeight, { gallery = false } = {}) {
  if (!value?.url) throw new Error('Creality submit is missing an uploaded cover or picture URL.');
  return {
    ...(gallery ? { type: 2 } : {}),
    width: Number(value.width || fallbackWidth || 0),
    height: Number(value.height || fallbackHeight || 0),
    url: String(value.url),
  };
}

function normalizedFile(value, { model = false } = {}) {
  if (!value?.fileKey || !value?.name) throw new Error('Creality submit is missing an uploaded file record.');
  const ext = extension(value.name);
  const fileName = model && ext
    ? String(value.name).slice(0, -(ext.length + 1))
    : String(value.name);
  const record = {
    fileKey: String(value.fileKey),
    fileName,
    fileSize: Number(value.size || 0),
  };
  if (model) {
    // Creality's uploader flattens its root folder as `default` at sort 1.
    record.folderName = String(value.folderName || 'default');
    record.folderSort = Number(value.folderSort || 1);
    if (value.cover?.url) {
      record.cover = {
        url: String(value.cover.url),
        type: Number(value.cover.type || 2),
      };
    }
  }
  return record;
}

function validateSubmit(input) {
  const issues = [];
  const title = String(input.title || '').trim();
  if (!title) issues.push('title is required');
  if ([...title].length > MAX_TITLE_CHARS) issues.push(`title exceeds ${MAX_TITLE_CHARS} characters`);
  if (!CATEGORY_IDS.has(String(input.categoryId || ''))) {
    issues.push('categoryId is not in Creality Cloud\'s current model taxonomy');
  }
  if (!LICENSES.has(String(input.license || ''))) issues.push('license is not supported');
  if (![1, 2, 3].includes(Number(input.modelSource || 1))) issues.push('modelSource must be Original, Non-original, or Remix');
  if (Number(input.modelSource || 1) !== 1) {
    issues.push('Remix and Non-original uploads require Creality source objects/proof images; finish those in Creality Cloud');
  }
  if (!['draft', 'private', 'public'].includes(String(input.publication || 'draft'))) {
    issues.push('publication must be draft, private, or public');
  }
  if (!input.pcCover?.url || !input.appCover?.url) issues.push('web and app covers are required');
  if (!Array.isArray(input.models) || !input.models.length) issues.push('at least one model file is required');
  if ((input.gallery || []).length > MAX_GALLERY_IMAGES) issues.push(`no more than ${MAX_GALLERY_IMAGES} gallery images are allowed`);
  normalizeTags(input.tags);
  return issues;
}

function buildBaseModelInfo(input) {
  const issues = validateSubmit(input);
  if (issues.length) throw new Error(`Creality publish validation failed: ${issues.join('; ')}.`);
  const publication = String(input.publication || 'draft');
  const gallery = (input.gallery || []).map((picture) => normalizedPicture(picture, 0, 0, { gallery: true }));
  return {
    pcCovers: [normalizedPicture(input.pcCover, 1600, 1200)],
    appCovers: [normalizedPicture(input.appCover, 1200, 1600)],
    categoryId: String(input.categoryId),
    groupName: String(input.title).trim(),
    groupDesc: String(input.description || '') || undefined,
    isShared: publication === 'public',
    ...(gallery.length ? { covers: gallery } : {}),
    modelSource: Number(input.modelSource || 1),
    pricingMethod: 0,
    isPay: false,
    license: String(input.license || 'CXY-SL'),
    maturityRating: input.nsfw ? 'restricted' : 'general',
    include3mf: !!input.model3mf,
    printType: [1],
    tags: normalizeTags(input.tags),
    displayVersion: 'cxy-gen2',
    colorFilament: [],
    type: 1,
  };
}

function createCrealityDirectClient({
  fetchImpl = fetch,
  createOssClient,
  uuid = randomUUID,
} = {}) {
  const ossFactory = createOssClient || ((options) => {
    // Lazy require keeps tests and non-Creality desktop paths independent of the SDK.
    // eslint-disable-next-line global-require
    const OSS = require('ali-oss');
    return new OSS(options);
  });

  async function api(context, path, { body = {}, label = path } = {}) {
    if (!context?.token || !context?.uid) throw new Error('Creality session is missing.');
    const response = await fetchImpl(`${CREALITY_ORIGIN}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Cookie: String(context.cookie || ''),
        Origin: CREALITY_ORIGIN,
        // The first-party request originates inside the FlowPrint iframe, not
        // from its outer create-model-new shell. Draft writes validate this
        // request context more strictly than identity/storage calls.
        Referer: API_REFERER,
        'User-Agent': USER_AGENT,
        __CXY_APP_CH_: 'nuxt_proxy_pc',
        __CXY_APP_ID_: 'cxy-gen2',
        __CXY_APP_VER_: '7.3.12',
        __CXY_BRAND_: 'creality',
        __CXY_DUID_: String(context.deviceId || uuid()),
        __CXY_OS_LANG_: '1',
        __CXY_OS_VER_: 'not set',
        __CXY_PLATFORM_: '2',
        __CXY_REQUESTID_: uuid(),
        __CXY_TIMEZONE_: String(-new Date().getTimezoneOffset() * 60),
        __CXY_TOKEN_: String(context.token),
        __CXY_UID_: String(context.uid),
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let envelope;
    try { envelope = JSON.parse(text); } catch {
      throw new Error(`Creality ${label} returned HTTP ${response.status} with a non-JSON response.`);
    }
    if (!response.ok) {
      throw new Error(`Creality ${label} returned HTTP ${response.status}: ${envelope.msg || envelope.message || 'request failed'}.`);
    }
    return assertApi(envelope, label);
  }

  async function whoami(context) {
    const result = await api(context, '/api/cxy/v3/user/getInfo', { label: 'account check' });
    const user = result?.userInfo || result?.info || result || {};
    return {
      id: String(user.userId ?? user.id ?? context.uid ?? ''),
      nickname: String(user.nickName ?? user.nickname ?? user.userName ?? ''),
      avatar: String(user.avatar ?? user.avatarUrl ?? ''),
    };
  }

  async function upload(context, role, file) {
    validateUpload(role, file);
    const [ossResult, credentialResult] = await Promise.all([
      api(context, '/api/cxy/v2/common/getOssInfo', { label: 'storage information' }),
      api(context, '/api/cxy/account/v2/getAliyunInfo', { label: 'upload authorization' }),
    ]);
    const info = ossResult?.info || ossResult || {};
    const aliyun = credentialResult?.aliyunInfo || credentialResult || {};
    if (!aliyun.accessKeyId || !aliyun.secretAccessKey || !aliyun.sessionToken) {
      throw new Error('Creality returned an incomplete upload authorization.');
    }
    const kind = role === 'cover' || role === 'photo'
      ? 'pic'
      : role === 'profile'
        ? 'file3mf'
        : role === 'instruction'
          ? 'doc'
          : 'model';
    const storage = kind === 'pic'
      ? info.image
      : kind === 'model' || kind === 'file3mf'
        ? info.internal
        : info.file;
    if (!info.endpoint || !storage?.bucket) throw new Error('Creality returned incomplete storage information.');
    const hash = createHash('md5').update(file.bytes).digest('hex');
    const ext = extension(file.name);
    // Creality's image cropper uses a distinct, server-validated object-key
    // namespace. Raw files use their role (`model/`, `doc/`, `file3mf/`), but
    // covers and gallery images must be under `crealityCloud/upload/`.
    const fileKey = kind === 'pic'
      ? `crealityCloud/upload/${hash}${ext ? `.${ext}` : ''}`
      : `${kind}/${hash}${ext ? `.${ext}` : ''}`;
    const client = ossFactory({
      endpoint: info.endpoint,
      accessKeyId: aliyun.accessKeyId,
      accessKeySecret: aliyun.secretAccessKey,
      stsToken: aliyun.sessionToken,
      bucket: storage.bucket,
      secure: true,
    });
    let partSize = 1 * 1024 * 1024;
    if (file.bytes.byteLength > 50 * 1024 * 1024) partSize = 2 * 1024 * 1024;
    if (file.bytes.byteLength > 100 * 1024 * 1024) partSize = 5 * 1024 * 1024;
    // Creality's production uploader always completes a multipart upload, even
    // for small files. The create endpoint verifies that storage shape before
    // accepting modelList entries, so a plain OSS PUT is not interchangeable.
    const multipartOptions = kind === 'pic'
      ? {
        headers: { 'Content-Type': mimeFor(file.name, file.mimeType) },
        partSize,
        parallel: 4,
        timeout: 180_000,
      }
      : {
        headers: {
          'Content-Disposition': `attachment;filename="${encodeURI(file.name)}"`,
        },
        partSize,
        parallel: 4,
        mime: 'application/x-www-form-urlencoded',
        timeout: 180_000,
      };
    const result = await client.multipartUpload(fileKey, file.bytes, multipartOptions);
    const status = Number(result?.res?.status || result?.status || 0);
    if (status && status !== 200) throw new Error(`Creality storage upload returned HTTP ${status}.`);
    return {
      role,
      fileKey,
      name: file.name,
      size: file.bytes.byteLength,
      mimeType: mimeFor(file.name, file.mimeType),
      url: normalizeCdnUrl(storage.cdnHost, fileKey),
    };
  }

  async function save(context, input) {
    const modelInfo = buildBaseModelInfo(input);
    const modelFiles = input.models.map((value) => normalizedFile(value, { model: true }));
    const otherFiles = (input.instructions || []).map(normalizedFile);
    if (input.publication === 'draft') {
      if (!input.draftId) {
        throw new Error(
          'Creality Cloud can edit an existing draft, but its new-model uploader does not create new drafts. Use a private model for an unpublished upload.',
        );
      }
      const result = await api(context, '/api/cxy/v3/modelDraft/edit', {
        label: 'draft save',
        body: {
          modelInfo,
          id: String(input.draftId),
          modelFiles,
          ...(otherFiles.length ? { otherFiles } : {}),
          ...(input.model3mf ? { model3mf: input.model3mf } : {}),
        },
      });
      let id = result?.id ?? result?.modelDraftId ?? result?.draftId;
      if (!id) {
        const list = await api(context, '/api/cxy/v3/modelDraft/list', {
          label: 'draft list', body: { page: 1, pageSize: 50 },
        });
        const drafts = list?.list || list?.models || list?.records || [];
        const match = drafts.find((draft) =>
          String(draft.groupName ?? draft.modelInfo?.groupName ?? '') === String(input.title).trim());
        id = match?.id ?? match?.modelDraftId;
      }
      if (!id) throw new Error('Creality saved the draft but did not return an id for read-back verification.');
      return {
        id: String(id),
        state: 'draft',
        url: `${CREALITY_ORIGIN}/create-model-new?editType=editModel&modelDraftId=${encodeURIComponent(id)}`,
      };
    }
    const result = await api(context, '/api/cxy/v3/model/modelGroupCreate', {
      label: input.publication === 'public' ? 'public publish' : 'private publish',
      body: {
        groupItem: modelInfo,
        modelList: modelFiles,
        ...(otherFiles.length ? { otherFiles } : {}),
        ...(input.model3mf ? { model3mf: input.model3mf } : {}),
      },
    });
    const id = result?.groupItem?.id ?? result?.id ?? result?.modelGroupId;
    if (!id) throw new Error('Creality accepted the upload but did not return a model id.');
    return {
      id: String(id),
      state: input.publication === 'public' ? 'public' : 'private',
      url: `${CREALITY_ORIGIN}/model-detail/${encodeURIComponent(id)}`,
    };
  }

  async function status(context, id, state) {
    const draft = state === 'draft';
    const result = await api(
      context,
      draft ? '/api/cxy/v3/modelDraft/detail' : '/api/cxy/v3/model/modelGroupDetail',
      { label: 'saved-model read-back', body: { id: String(id) } },
    );
    return result;
  }

  async function listDrafts(context) {
    const result = await api(context, '/api/cxy/v3/modelDraft/list', {
      label: 'draft list', body: { page: 1, pageSize: 50 },
    });
    return result?.list || result?.models || result?.records || [];
  }

  async function handleRequest(request, context) {
    try {
      const url = new URL(request.url);
      const route = url.pathname.split('/api/v1/creality/web/')[1] || '';
      if (route === 'whoami') return jsonResponse({ ok: true, user: await whoami(context) });
      if (route === 'upload' && request.method === 'POST') {
        const { role, file } = parseUploadBody(request);
        return jsonResponse({ ok: true, file: await upload(context, role, file) });
      }
      if (route === 'submit' && request.method === 'POST') {
        return jsonResponse({ ok: true, ...(await save(context, parseJsonBody(request))) });
      }
      if (route === 'status') {
        return jsonResponse({ ok: true, model: await status(context, url.searchParams.get('id'), url.searchParams.get('state')) });
      }
      if (route === 'drafts') return jsonResponse({ ok: true, drafts: await listDrafts(context) });
      return jsonResponse({ error: 'not_found', message: 'Unsupported Creality desktop route.' }, 404);
    } catch (error) {
      return errorResponse(error);
    }
  }

  return { api, handleRequest, listDrafts, save, status, upload, whoami };
}

module.exports = {
  CATEGORY_IDS,
  CREATE_URL,
  INSTRUCTION_FORMATS,
  LICENSES,
  MODEL_FORMATS,
  createCrealityDirectClient,
  validateSubmit,
  validateUpload,
};
