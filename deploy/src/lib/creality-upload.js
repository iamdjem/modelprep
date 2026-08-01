import { crealityFetch } from './creality-auth.js';

export function crealityResponseError(data, status, fallback = 'Creality request failed') {
  const detail = data?.message || data?.msg || data?.error;
  return detail ? `${fallback}: ${detail}` : `${fallback} (HTTP ${status})`;
}

export async function uploadCrealityFile({ workerUrl, secret, file, role }) {
  if (!(file instanceof Blob)) throw new Error('Creality upload requires a file.');
  const form = new FormData();
  form.append('role', role);
  form.append('file', file, file.name || 'upload.bin');
  const response = await crealityFetch(
    `${workerUrl}/api/v1/creality/web/upload`,
    { method: 'POST', body: form },
    secret,
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.file?.fileKey) {
    throw new Error(crealityResponseError(data, response.status, 'Creality upload failed'));
  }
  return data.file;
}
