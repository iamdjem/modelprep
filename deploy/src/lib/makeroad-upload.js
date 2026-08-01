import { makerRoadFetch } from './makeroad-auth.js';

export function makerRoadResponseError(data, status, fallback = 'MakerRoad request failed') {
  const detail = data?.message || data?.msg || data?.error;
  return detail ? `${fallback}: ${detail}` : `${fallback} (HTTP ${status})`;
}

export async function uploadMakerRoadFile({ workerUrl, secret, file, role }) {
  if (!(file instanceof Blob)) throw new Error('MakerRoad upload requires a file.');
  const form = new FormData();
  form.append('role', role);
  form.append('file', file, file.name || 'upload.bin');
  const response = await makerRoadFetch(`${workerUrl}/api/v1/makeroad/web/upload`, { method: 'POST', body: form }, secret);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.file?.id) throw new Error(makerRoadResponseError(data, response.status, 'MakerRoad upload failed'));
  return data.file;
}
