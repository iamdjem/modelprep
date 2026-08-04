import test from 'node:test';
import assert from 'node:assert/strict';
import { cultsWebIllustrationValidationIssue } from './adapters/cults3d-web.ts';

test('Cults Worker shared preflight rejects unsupported, video-first, and oversized illustrations', () => {
  for (const illustrations of [
    [{ type: 'application/pdf', size: 1 }],
    [{ type: 'video/webm', size: 1 }],
    [
      { type: 'image/webp', size: 1 },
      { type: 'video/mp4', size: (10 * 1024 * 1024) + 1 },
    ],
  ]) {
    assert.ok(cultsWebIllustrationValidationIssue(illustrations));
  }
});
