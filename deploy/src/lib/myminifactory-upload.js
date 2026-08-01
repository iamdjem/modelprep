import { myMiniFactoryFetch } from './myminifactory-auth.js';

export function myMiniFactoryResponseError(data, status, fallback = 'MyMiniFactory request failed') {
  const detail = data?.message || data?.error;
  return detail ? `${fallback}: ${detail}` : `${fallback} (HTTP ${status})`;
}

export async function uploadMyMiniFactoryFile({ workerUrl, secret, uploadSessionId, file, role }) {
  if (!(file instanceof Blob)) throw new Error('MyMiniFactory upload requires a file.');
  const form = new FormData();
  form.append('uploadSessionId', uploadSessionId);
  form.append('file', file, file.name || 'upload.bin');
  const response = await myMiniFactoryFetch(`${workerUrl}/api/v1/myminifactory/web/${role === 'image' ? 'upload-image' : 'upload-file'}`, { method: 'POST', body: form }, secret);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || !data.file) throw new Error(myMiniFactoryResponseError(data, response.status, `MyMiniFactory ${role} upload failed`));
  return data.file;
}
