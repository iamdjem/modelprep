import { describe, expect, it } from 'vitest';
import { convertHeicFileToJpeg, isHeicFile, jpegNameForHeic } from './heic.js';

describe('Printables HEIC handling', () => {
  it('recognizes HEIC and HEIF names case-insensitively', () => {
    expect(isHeicFile('photo.HEIC')).toBe(true);
    expect(isHeicFile('photo.heif')).toBe(true);
    expect(isHeicFile('photo.jpg')).toBe(false);
  });

  it('renames converted files without damaging dotted base names', () => {
    expect(jpegNameForHeic('dragon.hero.HEIC')).toBe('dragon.hero.jpg');
    expect(jpegNameForHeic('image.heif')).toBe('image.jpg');
  });

  it('leaves non-HEIC files untouched without loading the converter', async () => {
    const file = new File(['jpeg'], 'cover.jpg', { type: 'image/jpeg' });
    await expect(convertHeicFileToJpeg(file)).resolves.toBe(file);
  });
});
