import { makerOnlineFetch } from './makeronline-auth.js';

export function makerOnlineResponseError(data, status, fallback = 'MakerOnline request failed') {
  const detail = data?.message || data?.msg || data?.error;
  return detail ? `${fallback}: ${detail}` : `${fallback} (HTTP ${status})`;
}

export async function uploadMakerOnlineFile({ workerUrl, secret, file, role }) {
  if (!(file instanceof Blob)) throw new Error('MakerOnline upload requires a file.');
  const form = new FormData();
  form.append('role', role);
  form.append('file', file, file.name || 'upload.bin');
  const response = await makerOnlineFetch(
    `${workerUrl}/api/v1/makeronline/web/upload`,
    { method: 'POST', body: form },
    secret,
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.file?.url) {
    throw new Error(makerOnlineResponseError(data, response.status, 'MakerOnline upload failed'));
  }
  return data.file;
}
