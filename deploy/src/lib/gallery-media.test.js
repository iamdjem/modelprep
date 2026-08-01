import { describe, expect, it } from 'vitest';
import {
  cultsGalleryVideos,
  isGalleryVideoFile,
  makerWorldVideo,
  makerWorldVideoIssues,
} from './gallery-media.js';

describe('typed gallery media', () => {
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
});
