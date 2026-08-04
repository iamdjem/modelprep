const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);

// Keep the native picker permissive. Chromium's macOS open panel disables
// HEIC—and, with some filter combinations, every image—when `accept` is set.
// `handleImageFiles` performs the real MIME/extension validation after choice.
export const GALLERY_IMAGE_ACCEPT = '';

export function mediaFileExtension(name = '') {
  return String(name).split('.').pop()?.toLowerCase() || '';
}

export function isGalleryVideoFile(file) {
  const type = String(file?.type || '').toLowerCase();
  return type.startsWith('video/') || VIDEO_EXTENSIONS.has(mediaFileExtension(file?.name));
}

export function makerWorldVideo(media = []) {
  return media.find((item) => item?.kind === 'video' && ['mp4', 'mov'].includes(mediaFileExtension(item.name))) || null;
}

export function cultsGalleryVideos(media = []) {
  return media.filter((item) => item?.kind === 'video' && ['mp4', 'webm'].includes(mediaFileExtension(item.name)));
}

export function makerWorldVideoIssues(media = []) {
  const compatible = media.filter((item) => item?.kind === 'video' && ['mp4', 'mov'].includes(mediaFileExtension(item.name)));
  const issues = [];
  if (compatible.length > 1) issues.push('MakerWorld accepts only one model video. Remove the extras before publishing.');
  for (const item of compatible) {
    if (!Number.isFinite(item.duration) || item.duration <= 0) issues.push(`${item.name} has no readable video duration.`);
    else if (item.duration > 30) issues.push(`${item.name} is ${item.duration.toFixed(1)} seconds; MakerWorld allows at most 30 seconds.`);
    if (!item.blob) issues.push(`${item.name} must be re-added before upload.`);
  }
  return issues;
}

function normalizedMediaPath(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    return new URL(text, 'https://modelprep.invalid').pathname;
  } catch {
    return text.split(/[?#]/, 1)[0];
  }
}

export function makerWorldVideoReadbackIssues(expected = [], persisted = []) {
  const wanted = Array.isArray(expected) ? expected : [];
  if (!wanted.length) return [];
  const actual = Array.isArray(persisted) ? persisted : [];
  const issues = [];
  if (actual.length !== wanted.length) {
    issues.push(`MakerWorld readback returned ${actual.length} model video${actual.length === 1 ? '' : 's'}; expected ${wanted.length}.`);
  }
  wanted.forEach((video, index) => {
    const returned = actual[index];
    if (!returned) return;
    if (String(returned.name || '') !== String(video.name || '')) {
      issues.push(`MakerWorld readback changed model video ${index + 1}'s filename.`);
    }
    if (!String(returned.url || '').trim()) {
      issues.push(`MakerWorld readback omitted model video ${index + 1}'s URL.`);
    } else if (normalizedMediaPath(returned.url) !== normalizedMediaPath(video.url)) {
      issues.push(`MakerWorld readback changed model video ${index + 1}'s storage path.`);
    }
  });
  return issues;
}

export function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const cleanup = () => URL.revokeObjectURL(url);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      cleanup();
      if (Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error('Video duration is unavailable.'));
    };
    video.onerror = () => { cleanup(); reject(new Error('Video metadata could not be read.')); };
    video.src = url;
  });
}
