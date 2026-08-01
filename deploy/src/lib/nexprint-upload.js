import { nexprintFetch } from './nexprint-auth.js';

export function nexprintResponseError(data, status, fallback = 'Nexprint request failed') {
  const detail = data?.message || data?.msg || data?.error;
  return detail ? `${fallback}: ${detail}` : `${fallback} (HTTP ${status})`;
}

export async function uploadNexprintFile({
  workerUrl,
  secret,
  file,
  role,
}) {
  if (!(file instanceof Blob)) throw new Error('Nexprint upload requires a file.');
  const form = new FormData();
  form.append('role', role);
  form.append('file', file, file.name || 'upload.bin');
  const response = await nexprintFetch(
    `${workerUrl}/api/v1/nexprint/web/upload`,
    { method: 'POST', body: form },
    secret,
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.file?.fileId || !data.file?.fileUrl) {
    throw new Error(nexprintResponseError(data, response.status, 'Nexprint upload failed'));
  }
  return data.file;
}
