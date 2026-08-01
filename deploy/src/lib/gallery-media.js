const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);

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
