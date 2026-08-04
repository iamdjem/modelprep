import { describe, expect, it } from 'vitest';
import {
  cultsGalleryVideos,
  GALLERY_IMAGE_ACCEPT,
  isGalleryVideoFile,
  makerWorldVideo,
  makerWorldVideoIssues,
  makerWorldVideoReadbackIssues,
} from './gallery-media.js';

describe('typed gallery media', () => {
  it('keeps the macOS picker permissive so HEIC remains selectable', () => {
    expect(GALLERY_IMAGE_ACCEPT).toBe('');
  });

  it('recognizes supported video files by MIME or extension', () => {
    expect(isGalleryVideoFile({ name: 'demo.MOV', type: '' })).toBe(true);
    expect(isGalleryVideoFile({ name: 'demo.bin', type: 'video/webm' })).toBe(true);
    expect(isGalleryVideoFile({ name: 'photo.jpg', type: 'image/jpeg' })).toBe(false);
  });

  it('routes only compatible video formats to each platform', () => {
    const media = [
      { kind: 'video', name: 'first.webm' },
      { kind: 'video', name: 'second.mov' },
      { kind: 'video', name: 'third.mp4' },
    ];
    expect(makerWorldVideo(media).name).toBe('second.mov');
    expect(cultsGalleryVideos(media).map((item) => item.name)).toEqual(['first.webm', 'third.mp4']);
  });

  it('enforces MakerWorld count, duration, and runtime-file gates', () => {
    expect(makerWorldVideoIssues([
      { kind: 'video', name: 'one.mp4', duration: 31, blob: {} },
      { kind: 'video', name: 'two.mov', duration: 10 },
    ])).toEqual([
      'MakerWorld accepts only one model video. Remove the extras before publishing.',
      'one.mp4 is 31.0 seconds; MakerWorld allows at most 30 seconds.',
      'two.mov must be re-added before upload.',
    ]);
  });

  it('accepts MakerWorld video readback with the same persisted name and storage path', () => {
    expect(makerWorldVideoReadbackIssues(
      [{ name: 'turntable.mov', url: 'https://makerworld.bblmw.com/makerworld/model/video.mov?upload=1' }],
      [{ name: 'turntable.mov', url: 'https://makerworld.bblmw.com/makerworld/model/video.mov?readback=1' }],
    )).toEqual([]);
  });

  it('fails closed when MakerWorld omits or changes persisted video metadata', () => {
    expect(makerWorldVideoReadbackIssues(
      [{ name: 'turntable.mov', url: 'https://makerworld.bblmw.com/makerworld/model/video.mov' }],
      [],
    )).toEqual(['MakerWorld readback returned 0 model videos; expected 1.']);
    expect(makerWorldVideoReadbackIssues(
      [{ name: 'turntable.mov', url: 'https://makerworld.bblmw.com/makerworld/model/video.mov' }],
      [{ name: 'renamed.mov', url: 'https://makerworld.bblmw.com/makerworld/model/other.mov' }],
    )).toEqual([
      "MakerWorld readback changed model video 1's filename.",
      "MakerWorld readback changed model video 1's storage path.",
    ]);
  });
});
