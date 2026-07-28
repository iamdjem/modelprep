import { fileExt } from './format.js';

export function isHeicFile(name) {
  return ['heic', 'heif'].includes(fileExt(name || ''));
}

export function jpegNameForHeic(name) {
  const value = String(name || 'image.heic');
  return `${value.replace(/\.(?:heic|heif)$/i, '') || 'image'}.jpg`;
}

export async function convertHeicFileToJpeg(file) {
  if (!isHeicFile(file?.name)) return file;

  const module = await import('heic2any');
  const convert = module.default || module;
  const result = await convert({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92,
  });
  const jpeg = Array.isArray(result) ? result[0] : result;
  if (!(jpeg instanceof Blob)) {
    throw new Error('HEIC conversion did not return a JPEG image.');
  }
  return new File([jpeg], jpegNameForHeic(file.name), {
    type: 'image/jpeg',
    lastModified: file.lastModified || Date.now(),
  });
}
