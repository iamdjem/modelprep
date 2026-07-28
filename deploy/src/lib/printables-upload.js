import { printablesFetch } from './printables-auth.js';

export function printablesResponseError(data, status, fallback) {
  const issues = Array.isArray(data?.issues)
    ? data.issues.flatMap((issue) => issue?.messages || issue).filter(Boolean)
    : [];
  return issues.join('; ') || data?.message || data?.error || `${fallback} (HTTP ${status})`;
}
let crcTable;
function crc32cTable() {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let crc = index;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0x82F63B78 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[index] = crc >>> 0;
  }
  crcTable = table;
  return table;
}

export async function crc32cBase64(blob) {
  let crc = 0xFFFFFFFF;
  const table = crc32cTable();
  const reader = blob.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (let index = 0; index < value.length; index += 1) {
      crc = (table[(crc ^ value[index]) & 0xFF] ^ (crc >>> 8)) >>> 0;
    }
  }
  crc = (crc ^ 0xFFFFFFFF) >>> 0;
  const bytes = Uint8Array.of(
    (crc >>> 24) & 0xFF,
    (crc >>> 16) & 0xFF,
    (crc >>> 8) & 0xFF,
    crc & 0xFF,
  );
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function workerJson(workerUrl, route, secret, body) {
  const response = await printablesFetch(
    `${workerUrl}/api/v1/printables/web/${route}`,
    {
      method: body == null ? 'GET' : 'POST',
      headers: body == null ? {} : { 'Content-Type': 'application/json' },
      body: body == null ? undefined : JSON.stringify(body),
    },
    secret,
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(printablesResponseError(data, response.status, `Printables ${route} failed`));
  }
  return data;
}

export async function uploadPrintablesFile({
  workerUrl,
  secret,
  file,
  folder = '',
  unzip = !file.name.toLowerCase().endsWith('.zip'),
  imageWidth,
  imageHeight,
  storageFetch = fetch,
}) {
  const presigned = await workerJson(workerUrl, 'upload/presign', secret, {
    fileName: file.name,
    size: file.size,
    folder,
    unzip,
    imageWidth: imageWidth ?? null,
    imageHeight: imageHeight ?? null,
  });
  const form = new FormData();
  for (const [key, value] of Object.entries(presigned.uploadData.fields || {})) {
    form.set(key, String(value));
  }
  form.append('file', file);
  const uploaded = await storageFetch(presigned.uploadData.url, {
    method: 'POST',
    body: form,
  });
  if (!uploaded.ok) {
    throw new Error(`Printables storage upload failed (HTTP ${uploaded.status}).`);
  }
  const crc32c = await crc32cBase64(file);
  await workerJson(workerUrl, 'upload/finish', secret, {
    fileUploadId: presigned.fileUpload.id,
    crc32c,
  });
  return { id: presigned.fileUpload.id };
}

export async function waitForPrintablesUploads({
  workerUrl,
  secret,
  ids,
  timeoutMs = 5 * 60 * 1000,
  intervalMs = 1000,
}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = await workerJson(workerUrl, 'upload/status', secret, { ids });
    const uploads = data.fileUploads || [];
    const inspectionErrors = uploads.flatMap((upload) => upload.notInspectedFiles || []);
    if (inspectionErrors.length) {
      throw new Error(`Printables could not inspect: ${inspectionErrors.join(', ')}`);
    }
    if (uploads.length === ids.length && uploads.every((upload) => upload.isProcessed)) {
      return uploads;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Printables file processing timed out. The draft may still finish processing on Printables.');
}
