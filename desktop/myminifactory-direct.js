const { randomUUID } = require('node:crypto');

const MMF_ORIGIN = 'https://www.myminifactory.com';
const UPLOAD_URL = `${MMF_ORIGIN}/upload/object`;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
const IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'gif']);
const MODEL_FORMATS = new Set([
  'x3g', 'gcode', 'stl', 'scad', 'fbx', '3dc', '3ds', 'ac', 'asc', 'bvh',
  'blend', 'geo', 'dae', 'dwf', 'dw', 'x', 'gra', 'mu', 'kmz', 'lwo', 'lwz',
  'flt', 'iv', 'osg', 'osgt', 'osgb', 'ive', 'ply', 'shp', 'vpk', 'wrl',
  'wrz', 'dxf', 'pdf', 'obj', 'sdf', 'mtl', '3mf', 'jpeg', 'step', 'skp',
  'thing', 'zup', 'amf', 'fcstd', 'f3d', 'bmp', 'glb', 'gltf', 'jpg', 'png',
  'chitubox', 'lyt', 'lys',
]);
const LICENSE_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 500;
const MAX_TAGS = 20;
const MAX_DIMENSIONS_CHARS = 100;
const MAX_FILAMENT_QUANTITY_CHARS = 45;
const DIMENSIONS_UNITS = new Set([0, 1, 2]);
const TECHNOLOGIES = new Set(['', 'FDM', 'DLP/SLA', 'SLS']);

function jsonResponse(body, status = 200) {
  return { status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

function extension(name) {
  const match = /\.([^.]+)$/.exec(String(name || ''));
  return match ? match[1].toLowerCase() : '';
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function plainText(value) {
  return decodeHtml(String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function safeSubmitResponseDiagnostic(response, html, input) {
  const title = plainText(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ''))?.[1] || '');
  const visibleError = plainText(
    /<(?:div|p|li)\b[^>]*class=["'][^"']*(?:alert-danger|flash-error|form-error|error-message|is-invalid)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|li)>/i.exec(String(html || ''))?.[1] || '',
  );
  let pathname = '';
  try {
    pathname = response?.url
      ? new URL(String(response.url), MMF_ORIGIN).pathname
      : '/upload/object';
  } catch { /* leave blank */ }
  const traceId = response?.headers?.get?.('x-request-id') || response?.headers?.get?.('cf-ray') || '';
  return {
    status: Number(response?.status || 0),
    pathname: pathname || '/upload/object',
    contentType: String(response?.headers?.get?.('content-type') || '').split(';')[0],
    bodyBytes: Buffer.byteLength(String(html || ''), 'utf8'),
    title: title.slice(0, 120),
    visibleError: visibleError.slice(0, 240),
    traceId: String(traceId).slice(0, 120),
    publication: input?.publication === 'public' ? 'public' : 'private',
    imageCount: Array.isArray(input?.images) ? input.images.length : 0,
    fileCount: Array.isArray(input?.files) ? input.files.length : 0,
    categoryCount: Array.isArray(input?.categoryIds) ? input.categoryIds.length : 0,
  };
}

function formatSubmitFailure(diagnostic) {
  const detail = diagnostic.visibleError || diagnostic.title;
  const responseShape = [
    diagnostic.contentType || 'unknown content type',
    `${diagnostic.bodyBytes} bytes`,
  ].join(', ');
  const trace = diagnostic.traceId ? `; trace ${diagnostic.traceId}` : '';
  const serverDetail = detail ? `; server page: ${detail}` : '';
  return `MyMiniFactory submit failed (HTTP ${diagnostic.status}; ${diagnostic.pathname}; ${responseShape}; ${diagnostic.imageCount} images, ${diagnostic.fileCount} files, ${diagnostic.categoryCount} categories${trace}${serverDetail}).`;
}

function tagAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(String(tag || ''));
  return decodeHtml(match?.[2] || '');
}

function matchValue(html, name) {
  for (const match of String(html || '').matchAll(/<input\b[^>]*>/gi)) {
    if (tagAttribute(match[0], 'name') === name) return tagAttribute(match[0], 'value');
  }
  return '';
}

// An HTML boolean attribute is true whenever it is present, whatever its
// value. The current editor proves why this must be handled generically: one
// page emits `selected=""` for the license, `selected="selected"` for
// visibility/technology/dimension units, and a bare `checked` for the remix
// control. Requiring a preceding space keeps `data-selected`/`unselected` out.
function hasBooleanAttribute(tag, name) {
  return new RegExp(`\\s${name}(?=[\\s=/>])`, 'i').test(String(tag || ''));
}

function matchSelectValue(html, name) {
  for (const match of String(html || '').matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)) {
    const openingTag = /^<select\b[^>]*>/i.exec(match[0])?.[0] || '';
    if (tagAttribute(openingTag, 'name') !== name) continue;
    for (const option of match[0].matchAll(/<option\b[^>]*>/gi)) {
      if (hasBooleanAttribute(option[0], 'selected')) return tagAttribute(option[0], 'value');
    }
    return '';
  }
  return '';
}

function matchTextareaValue(html, name) {
  for (const match of String(html || '').matchAll(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi)) {
    const openingTag = /^<textarea\b[^>]*>/i.exec(match[0])?.[0] || '';
    if (tagAttribute(openingTag, 'name') === name) {
      return decodeHtml(match[0].replace(/^<textarea\b[^>]*>/i, '').replace(/<\/textarea>$/i, ''));
    }
  }
  return '';
}

function inputChecked(html, name) {
  for (const match of String(html || '').matchAll(/<input\b[^>]*>/gi)) {
    if (tagAttribute(match[0], 'name') === name && hasBooleanAttribute(match[0], 'checked')) return true;
  }
  return false;
}

function objectIdFromUrl(value) {
  try {
    const pathname = new URL(String(value || ''), MMF_ORIGIN).pathname;
    // Submit returns the canonical slug URL; a re-read of an existing object
    // is addressed by bare numeric id, which redirects to that slug.
    return /^\/object\/3d-print-(?:.*-)?(\d+)\/?$/i.exec(pathname)?.[1]
      || /^\/object\/(\d+)\/?$/.exec(pathname)?.[1]
      || '';
  } catch {
    return '';
  }
}

function reactComponentPayloads(html, componentName) {
  const payloads = [];
  for (const script of String(html || '').matchAll(/<script\b[^>]*class=(['"])[^'"]*\bjs-react-on-rails-component\b[^'"]*\1[^>]*>[\s\S]*?<\/script>/gi)) {
    const openingTag = /^<script\b[^>]*>/i.exec(script[0])?.[0] || '';
    if (tagAttribute(openingTag, 'data-component-name') !== componentName) continue;
    const payloadText = script[0].replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
    payloads.push(JSON.parse(decodeHtml(payloadText)));
  }
  return payloads;
}

function parseEditPage(html, objectId) {
  const rawCategories = matchValue(html, 'categories');
  let categoryIds;
  try {
    const parsed = JSON.parse(rawCategories || '[]');
    categoryIds = Array.isArray(parsed)
      ? parsed.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];

    // The edit page no longer server-renders the React-owned hidden
    // `categories` input. Its authoritative initial value now lives in the
    // UploadCategories react-on-rails payload; client JavaScript creates the
    // hidden input later. Main-process read-back intentionally parses the raw
    // response, so recover the selected path from that payload when needed.
    if (!categoryIds.length) {
      for (const payload of reactComponentPayloads(html, 'UploadCategories')) {
        categoryIds = Array.isArray(payload?.selectedCategories)
          ? payload.selectedCategories.map((category) => Number(category?.id)).filter((id) => Number.isInteger(id) && id > 0)
          : [];
        break;
      }
    }
  } catch {
    throw new Error('MyMiniFactory category read-back returned invalid data.');
  }

  // Each gallery row renders fileName, uploadedBy and an explicit position.
  // The array index and the position agree today, but `position` is the value
  // MyMiniFactory actually persists for ordering, so prefer it and keep the
  // array index only as a fallback when any row omits it.
  const imageRows = new Map();
  let primaryImage = '';
  for (const match of String(html || '').matchAll(/<input\b[^>]*>/gi)) {
    const name = tagAttribute(match[0], 'name');
    const value = tagAttribute(match[0], 'value');
    if (name === 'primary_image' && hasBooleanAttribute(match[0], 'checked') && value) primaryImage = value;
    const field = /^threedobject_type\[images\]\[(\d+)\]\[(fileName|position)\]$/.exec(name);
    if (!field) continue;
    const index = Number(field[1]);
    const row = imageRows.get(index) || { index, fileName: '', position: null };
    if (field[2] === 'fileName') row.fileName = value;
    else if (value !== '' && Number.isFinite(Number(value))) row.position = Number(value);
    imageRows.set(index, row);
  }
  const images = [...imageRows.values()].filter((row) => row.fileName);
  const orderedByPosition = images.length > 0 && images.every((row) => row.position != null);
  images.sort((a, b) => (orderedByPosition ? a.position - b.position : a.index - b.index));

  const fileNames = [];
  for (const match of String(html || '').matchAll(/<a\b[^>]*>/gi)) {
    const href = tagAttribute(match[0], 'href');
    if (!href) continue;
    try {
      const download = new URL(href, MMF_ORIGIN);
      if (download.pathname !== `/download/${objectId}`) continue;
      const fileName = download.searchParams.get('downloadfile');
      if (fileName && !fileNames.includes(fileName)) fileNames.push(fileName);
    } catch { /* ignore malformed unrelated links */ }
  }

  // The current edit response keeps object files in the React-on-Rails
  // UploadFilesWrapper payload. Download links only exist after hydration, so
  // main-process read-back must consume the raw JSON rather than waiting for
  // server-rendered anchors that will never appear in session.fetch HTML.
  if (!fileNames.length) {
    try {
      for (const payload of reactComponentPayloads(html, 'UploadFilesWrapper')) {
        for (const file of Array.isArray(payload?.files) ? payload.files : []) {
          const fileName = String(file?.filename || '').trim();
          if (fileName && !fileNames.includes(fileName)) fileNames.push(fileName);
        }
        break;
      }
    } catch {
      throw new Error('MyMiniFactory object-file read-back returned invalid data.');
    }
  }

  const visibilityValue = matchSelectValue(html, 'threedobject_type[visibility]');
  return {
    title: matchValue(html, 'threedobject_type[name]'),
    visibility: visibilityValue === '0' ? 'private' : visibilityValue === '2' ? 'public' : 'unknown',
    categoryIds,
    imageNames: images.map((image) => image.fileName),
    // Submitted as `primary_image` but never previously read back. Exposed so a
    // re-read can prove the cover survived; the certified upload path keeps its
    // existing checks unchanged.
    primaryImage,
    imageOrderSource: orderedByPosition ? 'position' : 'index',
    fileNames,
    licenseId: Number(matchSelectValue(html, 'license_id')) || null,
    printingTips: matchTextareaValue(html, 'threedobject_type[howto]'),
    timeFrom: Number(matchValue(html, 'threedobject_type[time_to_do_from]') || 0),
    timeTo: Number(matchValue(html, 'threedobject_type[time_to_do_to]') || 0),
    dimensions: matchValue(html, 'threedobject_type[dimensions]'),
    dimensionsUnit: Number(matchSelectValue(html, 'threedobject_type[dimensionsUnit]') || 0),
    technology: matchSelectValue(html, 'threedobject_type[technology]'),
    materialQuantity: matchValue(html, 'threedobject_type[filament_quantity]'),
    supportFree: matchValue(html, 'threedobject_type[support_free]') === '1',
    // The current hydrated editor uses `remix-checkbox`, while older server
    // responses used the submitted `threedobject_type[remix]` name. Keep both
    // forms fail-closed: a remix must be explicitly checked in read-back.
    remix: inputChecked(html, 'threedobject_type[remix]') || inputChecked(html, 'remix-checkbox'),
    remixParentIds: (matchValue(html, 'threedobject_type[remix_parents]') || matchValue(html, 'threedObjectRemixParents')).split(',').map((id) => id.trim()).filter(Boolean),
  };
}

function parseUploadPage(html) {
  const folder = matchValue(html, 'uniqFolderName');
  const csrfToken = matchValue(html, 'threedobject_temp_type[_token]');
  const username = decodeHtml(/<img[^>]+alt=["']User avatar["'][^>]+title=["']([^"']+)["']/i.exec(html)?.[1] || '');
  if (!folder || !csrfToken) throw new Error('MyMiniFactory upload page did not expose a valid upload form. Reconnect the account.');
  return { folder, csrfToken, username };
}

function parseFileBody(request) {
  if (request.bodyType !== 'form-data' || !Array.isArray(request.body)) {
    throw new Error('MyMiniFactory desktop upload requires multipart form data.');
  }
  let uploadSessionId = '';
  let file = null;
  for (const entry of request.body) {
    if (entry?.name === 'uploadSessionId' && entry.kind === 'text') uploadSessionId = String(entry.value || '');
    if (entry?.name === 'file' && entry.kind === 'file') {
      file = {
        name: String(entry.fileName || 'upload.bin'),
        mimeType: String(entry.mimeType || 'application/octet-stream'),
        bytes: Buffer.from(entry.bytes),
      };
    }
  }
  if (!uploadSessionId || !file) throw new Error('MyMiniFactory upload is missing its session or file.');
  return { uploadSessionId, file };
}

function parseJsonBody(request) {
  if (request.bodyType !== 'text') throw new Error('MyMiniFactory desktop action requires a JSON body.');
  return JSON.parse(String(request.body || '{}'));
}

function validateFile(file, role) {
  const ext = extension(file.name);
  if (role === 'image') {
    if (!IMAGE_FORMATS.has(ext)) throw new Error(`MyMiniFactory does not accept .${ext || 'unknown'} as an object image.`);
    if (file.bytes.byteLength > MAX_IMAGE_BYTES) throw new Error(`${file.name} exceeds MyMiniFactory's 5 MB image limit.`);
    return;
  }
  if (!MODEL_FORMATS.has(ext)) throw new Error(`MyMiniFactory does not accept .${ext || 'unknown'} as an object file.`);
  if (file.bytes.byteLength > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds MyMiniFactory's 100 MB file limit.`);
}

function normalizeTags(tags) {
  const values = [...new Set((Array.isArray(tags) ? tags : []).map((tag) => String(tag).trim().replace(/^#/, '')).filter(Boolean))];
  if (values.length > MAX_TAGS) throw new Error(`MyMiniFactory accepts at most ${MAX_TAGS} tags.`);
  return values;
}

function validateSubmit(input) {
  const issues = [];
  if (!String(input.title || '').trim()) issues.push('title is required');
  if (!Array.isArray(input.images) || !input.images.length) issues.push('at least one object image is required');
  if (!Array.isArray(input.files) || !input.files.length) issues.push('at least one object file is required');
  if ((input.files || []).length > MAX_FILES) issues.push(`no more than ${MAX_FILES} files are allowed`);
  if (!LICENSE_IDS.has(Number(input.licenseId || 5))) issues.push('license is not supported');
  if (!Array.isArray(input.categoryIds) || !input.categoryIds.length) issues.push('at least one category is required');
  if ((input.categoryIds || []).some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0)) issues.push('category IDs must be positive integers');
  if (!['private', 'public'].includes(input.publication)) issues.push('visibility must be private or public');
  if (!input.confirmOriginalNoAi) issues.push('the creator must confirm the original/no-generative-AI declaration');
  if (input.remix && !(input.remixParentIds || []).length) issues.push('remixes require at least one MyMiniFactory parent object');
  if (String(input.dimensions || '').length > MAX_DIMENSIONS_CHARS) issues.push(`dimensions must be at most ${MAX_DIMENSIONS_CHARS} characters`);
  if (String(input.materialQuantity || '').length > MAX_FILAMENT_QUANTITY_CHARS) issues.push(`material quantity must be at most ${MAX_FILAMENT_QUANTITY_CHARS} characters`);
  if (!DIMENSIONS_UNITS.has(Number(input.dimensionsUnit || 0))) issues.push('dimensions unit is not supported');
  if (!TECHNOLOGIES.has(String(input.technology || ''))) issues.push('technology is not supported');
  normalizeTags(input.tags);
  return issues;
}

function licenseFlags(id) {
  const noDerivatives = [6, 7, 10, 11, 15, 16].includes(id);
  const nonCommercial = [4, 5, 7, 9, 11, 14, 16].includes(id);
  const exclusive = [8, 9, 10, 11].includes(id);
  return { noDerivatives, nonCommercial, exclusive };
}

function createMyMiniFactoryDirectClient({ fetchImpl = fetch, uuid = randomUUID, managedSession = false } = {}) {
  const uploads = new Map();

  async function request(context, path, options = {}) {
    if (!context?.cookie) throw new Error('MyMiniFactory session is missing.');
    const headers = {
      Accept: options.accept || 'application/json, text/plain, */*',
      Cookie: String(context.cookie), Origin: MMF_ORIGIN, Referer: UPLOAD_URL,
      'User-Agent': String(context.userAgent || USER_AGENT),
    };
    if (options.contentType) headers['Content-Type'] = options.contentType;
    return fetchImpl(path.startsWith('http') ? path : `${MMF_ORIGIN}${path}`, {
      method: options.method || 'GET', headers, body: options.body,
      redirect: options.redirect || 'manual',
      ...(managedSession ? { credentials: 'include' } : {}),
    });
  }

  async function getUploadPage(context) {
    const response = await request(context, '/upload/object', { accept: 'text/html' });
    const html = await response.text();
    if (!response.ok) throw new Error(`MyMiniFactory account check failed (HTTP ${response.status}).`);
    return { html, ...parseUploadPage(html) };
  }

  async function whoami(context) {
    const page = await getUploadPage(context);
    if (!page.username) throw new Error('MyMiniFactory is not signed in.');
    return { id: page.username, username: page.username };
  }

  async function prepare(context) {
    const page = await getUploadPage(context);
    const id = uuid();
    uploads.set(id, { folder: page.folder, csrfToken: page.csrfToken, createdAt: Date.now() });
    return {
      uploadSessionId: id,
      limits: { imageBytes: MAX_IMAGE_BYTES, fileBytes: MAX_FILE_BYTES, files: MAX_FILES, tags: MAX_TAGS },
    };
  }

  async function categories(context) {
    const response = await request(context, '/api/store/categories');
    const data = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(data)) {
      throw new Error(`MyMiniFactory category taxonomy failed (HTTP ${response.status}).`);
    }
    return data;
  }

  function uploadSession(id) {
    const value = uploads.get(String(id || ''));
    if (!value || Date.now() - value.createdAt > 30 * 60 * 1000) throw new Error('MyMiniFactory upload session expired. Start the upload again.');
    return value;
  }

  async function uploadImage(context, uploadSessionId, file) {
    validateFile(file, 'image');
    const state = uploadSession(uploadSessionId);
    const form = new FormData();
    form.append('uniqFolderName', state.folder);
    form.append('fileType', '1');
    form.append('fileToUpload', new Blob([file.bytes], { type: file.mimeType || 'application/octet-stream' }), file.name);
    const response = await request(context, '/upload/files-upload', { method: 'POST', body: form });
    const data = await response.json().catch(() => null);
    const image = Array.isArray(data) ? data[0] : null;
    if (!response.ok || !image?.name || !image?.url) throw new Error(`MyMiniFactory image upload failed (HTTP ${response.status}).`);
    return image;
  }

  async function uploadFile(context, uploadSessionId, file) {
    validateFile(file, 'file');
    const state = uploadSession(uploadSessionId);
    const presignResponse = await request(context, '/upload/presigned-url', {
      method: 'POST', contentType: 'application/json', body: JSON.stringify({ fileName: file.name, size: file.bytes.byteLength, storageFolderName: state.folder }),
    });
    const presign = await presignResponse.json().catch(() => null);
    if (!presignResponse.ok || !presign?.presignedUrl || !presign?.uploadedFileUuid) throw new Error('MyMiniFactory file presign failed.');
    const put = await fetchImpl(presign.presignedUrl, { method: 'PUT', body: file.bytes });
    if (!put.ok) throw new Error(`MyMiniFactory file storage upload failed (HTTP ${put.status}).`);
    const completeResponse = await request(context, '/upload/presigned-url/complete', {
      method: 'POST', contentType: 'application/json', body: JSON.stringify({ uploadedFileUuid: presign.uploadedFileUuid, objectId: null }),
    });
    const completed = await completeResponse.json().catch(() => null);
    if (!completeResponse.ok || !completed?.uuid) throw new Error('MyMiniFactory file completion failed.');
    return completed;
  }

  async function submit(context, input) {
    const issues = validateSubmit(input);
    if (issues.length) throw new Error(`MyMiniFactory upload validation failed: ${issues.join('; ')}.`);
    const state = uploadSession(input.uploadSessionId);
    const licenseId = Number(input.licenseId || 5);
    const flags = licenseFlags(licenseId);
    const params = new URLSearchParams();
    const add = (name, value) => params.append(name, String(value ?? ''));
    add('uniqFolderName', state.folder);
    add('fileMode', '0');
    add('watermarkPdfs', 'false');
    add('uploadedImagesPersistJson', JSON.stringify(input.images));
    add('threedobject_temp_type[name]', String(input.title).trim());
    add('threedobject_temp_type[tags]', normalizeTags(input.tags).join(','));
    add('threedobject_temp_type[description]', String(input.description || ''));
    add('threedobject_temp_type[visibility]', input.publication === 'public' ? '2' : '0');
    add('categories', JSON.stringify(input.categoryIds.map(Number)));
    add('threedUploadedFileUuids', JSON.stringify(input.files.map((file) => file.uuid)));
    add('threedobject_temp_type[howto]', String(input.printingTips || ''));
    // Print time is a MINUTES range and the native form leaves it empty when the
    // creator does not set one. Substituting a default here published a
    // fabricated "0 - 50 minutes" on every object that never touched the field,
    // and it read back unchanged so no check caught it. Empty stays empty.
    const optionalNumber = (value) => (value === '' || value == null ? '' : Number(value));
    add('threedobject_temp_type[time_to_do_from]', optionalNumber(input.timeFrom));
    add('threedobject_temp_type[time_to_do_to]', optionalNumber(input.timeTo));
    add('threedobject_temp_type[dimensions]', String(input.dimensions || ''));
    add('threedobject_temp_type[dimensionsUnit]', Number(input.dimensionsUnit || 0));
    add('threedobject_temp_type[technology]', String(input.technology || ''));
    add('threedobject_temp_type[filament_quantity]', String(input.materialQuantity || ''));
    if (input.supportFree) add('threedobject_temp_type[support_free]', '1');
    if (input.remix) {
      add('threedobject_temp_type[remix]', '1');
      add('threedobject_temp_type[remix_parents]', input.remixParentIds.join(','));
    }
    add('no_derivatives', flags.noDerivatives ? '1' : '0');
    add('non_commercial', flags.nonCommercial ? '1' : '0');
    add('exclusive', flags.exclusive ? '1' : '0');
    add('license_id', licenseId);
    add('threedobject_temp_type[not_ai]', '1');
    input.images.forEach((image) => add('imgnames[]', image.name));
    add('primary_image', input.images[0].name);
    add('threedobject_temp_type[_token]', state.csrfToken);
    console.info('[myminifactory-upload]', JSON.stringify({
      stage: 'submit-start',
      publication: input.publication,
      imageCount: input.images.length,
      fileCount: input.files.length,
      categoryCount: input.categoryIds.length,
    }));
    const response = await request(context, '/upload/object', {
      method: 'POST', contentType: 'application/x-www-form-urlencoded;charset=UTF-8', body: params.toString(),
      // Electron's authenticated session.fetch cancels a manual redirect with
      // ERR_ABORTED before headers are exposed. Follow it in the managed
      // Chromium session and recover the canonical object URL from response.url.
      redirect: managedSession ? 'follow' : 'manual', accept: 'text/html',
    });
    const location = response.headers.get('location') || '';
    const html = response.status >= 300 && response.status < 400 ? '' : await response.text();
    const diagnostic = safeSubmitResponseDiagnostic(response, html, input);
    console.info('[myminifactory-upload]', JSON.stringify({
      stage: 'submit-response',
      ...diagnostic,
      redirected: !!response.redirected,
      hasLocation: !!location,
    }));
    if (!(response.status >= 300 && response.status < 400) && !response.ok) {
      throw new Error(formatSubmitFailure(diagnostic));
    }
    if (!location && /flash-error|form-error|is-invalid/i.test(html)) throw new Error('MyMiniFactory rejected the submitted object metadata.');
    const followedUrl = response.url && !/\/upload\/object(?:$|[?#])/.test(response.url)
      ? response.url
      : '';
    const canonical = location || followedUrl || /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(html)?.[1] || '';
    if (!canonical || !/^https?:\/\/www\.myminifactory\.com\/object\/|^\/object\//.test(canonical)) {
      throw new Error('MyMiniFactory accepted the form but returned no object URL for read-back.');
    }
    uploads.delete(input.uploadSessionId);
    const url = new URL(canonical, MMF_ORIGIN).toString();
    return { state: input.publication, url, id: objectIdFromUrl(url) || url };
  }

  async function status(context, url) {
    if (!String(url || '').startsWith(`${MMF_ORIGIN}/object/`)) throw new Error('MyMiniFactory read-back requires an object URL.');
    // A submit returns the canonical slug URL, but a re-read of an existing
    // object is addressed as /object/<id>, which MyMiniFactory redirects to
    // that slug. Electron's session.fetch cancels a manual redirect with
    // ERR_ABORTED, so follow it in the managed Chromium session exactly as
    // submit does. This stays read-only: it is still a GET.
    const response = await request(context, url, { accept: 'text/html', redirect: managedSession ? 'follow' : 'manual' });
    const html = await response.text();
    if (!response.ok) throw new Error(`MyMiniFactory read-back failed (HTTP ${response.status}).`);
    const objectId = objectIdFromUrl(response.url || url) || objectIdFromUrl(url);
    if (!objectId) throw new Error('MyMiniFactory read-back returned no object id.');
    const editResponse = await request(context, `/object/edit/${objectId}`, { accept: 'text/html' });
    const editHtml = await editResponse.text();
    if (!editResponse.ok) throw new Error(`MyMiniFactory edit-form read-back failed (HTTP ${editResponse.status}).`);
    const edit = parseEditPage(editHtml, objectId);
    return {
      url: response.url && response.url.startsWith(`${MMF_ORIGIN}/object/`) ? response.url : url,
      title: edit.title || decodeHtml(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] || /<title>([^<]+)<\/title>/i.exec(html)?.[1] || ''),
      visibility: edit.visibility,
      private: edit.visibility === 'private',
      categoryIds: edit.categoryIds,
      imageNames: edit.imageNames,
      primaryImage: edit.primaryImage,
      imageOrderSource: edit.imageOrderSource,
      fileNames: edit.fileNames,
      licenseId: edit.licenseId,
      printingTips: edit.printingTips,
      timeFrom: edit.timeFrom,
      timeTo: edit.timeTo,
      dimensions: edit.dimensions,
      dimensionsUnit: edit.dimensionsUnit,
      technology: edit.technology,
      materialQuantity: edit.materialQuantity,
      supportFree: edit.supportFree,
      remix: edit.remix,
      remixParentIds: edit.remixParentIds,
    };
  }

  async function handleRequest(request, context) {
    try {
      const url = new URL(request.url);
      const route = url.pathname.split('/api/v1/myminifactory/web/')[1] || '';
      if (route === 'whoami') return jsonResponse({ ok: true, user: await whoami(context) });
      if (route === 'categories') return jsonResponse({ ok: true, categories: await categories(context) });
      if (route === 'prepare' && request.method === 'POST') return jsonResponse({ ok: true, ...(await prepare(context)) });
      if ((route === 'upload-image' || route === 'upload-file') && request.method === 'POST') {
        const { uploadSessionId, file } = parseFileBody(request);
        const uploaded = route === 'upload-image' ? await uploadImage(context, uploadSessionId, file) : await uploadFile(context, uploadSessionId, file);
        return jsonResponse({ ok: true, file: uploaded });
      }
      if (route === 'submit' && request.method === 'POST') return jsonResponse({ ok: true, ...(await submit(context, parseJsonBody(request))) });
      if (route === 'status') return jsonResponse({ ok: true, object: await status(context, url.searchParams.get('url')) });
      return jsonResponse({ error: 'not_found', message: 'Unsupported MyMiniFactory desktop route.' }, 404);
    } catch (error) {
      return jsonResponse({ error: 'myminifactory_failed', message: error instanceof Error ? error.message : String(error) }, 502);
    }
  }

  return { categories, handleRequest, prepare, status, submit, uploadFile, uploadImage, whoami };
}

module.exports = {
  DIMENSIONS_UNITS, IMAGE_FORMATS, LICENSE_IDS, MAX_DIMENSIONS_CHARS, MAX_FILE_BYTES, MAX_FILES, MAX_FILAMENT_QUANTITY_CHARS, MAX_IMAGE_BYTES, MMF_ORIGIN,
  MODEL_FORMATS, UPLOAD_URL, createMyMiniFactoryDirectClient, parseUploadPage, validateFile, validateSubmit,
};
