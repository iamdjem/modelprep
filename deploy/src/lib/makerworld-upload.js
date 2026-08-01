import { isDesktopMakerWorldSession } from './makerworld-auth.js';

const WORKER_PROXY_LIMIT_BYTES = 95 * 1024 * 1024;

function errorDetail(data, status, fallback) {
  if (Array.isArray(data?.issues) && data.issues.length) return data.issues.join(' ');
  return data?.message || data?.error || fallback || `Request failed (HTTP ${status})`;
}

async function proxyUpload({ workerUrl, cookie, file, name, fetchImpl }) {
  const form = new FormData();
  form.append('file', file, name);
  form.append('fileName', name);
  const response = await fetchImpl(`${workerUrl}/api/v1/makerworld/web/upload`, {
    method: 'POST', headers: { 'X-MW-Cookie': cookie }, body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(errorDetail(data, response.status, `Upload of ${name} failed`));
  return data;
}

/** Upload directly to MakerWorld's presigned S3 URL. When the renderer cannot
 * perform the PUT, the virtual upload route stays on-device in Electron. Only
 * the web build falls back to the Worker proxy. */
export async function uploadMakerWorldFile({ workerUrl, cookie, file, name, fetchImpl = fetch }) {
  const desktopDirect = isDesktopMakerWorldSession(cookie);
  const size = Number(file?.size ?? 0);
  const presignResponse = await fetchImpl(`${workerUrl}/api/v1/makerworld/web/upload/presign`, {
    method: 'POST',
    headers: { 'X-MW-Cookie': cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: name, size }),
  });
  const presigned = await presignResponse.json().catch(() => ({}));
  if (!presignResponse.ok || !presigned.signedUrl || !presigned.url) {
    if (size <= WORKER_PROXY_LIMIT_BYTES) {
      const proxied = await proxyUpload({ workerUrl, cookie, file, name, fetchImpl });
      return { ...proxied, direct: desktopDirect };
    }
    throw new Error(errorDetail(presigned, presignResponse.status, `Could not prepare upload of ${name}`));
  }

  try {
    const put = await fetchImpl(presigned.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    if (!put.ok) throw new Error(`MakerWorld storage returned HTTP ${put.status}`);
    return {
      ok: true,
      name,
      size,
      url: presigned.url,
      key: presigned.key,
      cdnPrefix: presigned.cdnPrefix,
      direct: true,
    };
  } catch (error) {
    if (size <= WORKER_PROXY_LIMIT_BYTES) {
      const proxied = await proxyUpload({ workerUrl, cookie, file, name, fetchImpl });
      return { ...proxied, direct: desktopDirect };
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Direct MakerWorld upload of ${name} failed (${reason}). Files above 95MB cannot use the Worker fallback; retry from a browser/network that allows MakerWorld's S3 upload.`);
  }
}

export function makerWorldResponseError(data, status, fallback) {
  return errorDetail(data, status, fallback);
}

export { WORKER_PROXY_LIMIT_BYTES };
