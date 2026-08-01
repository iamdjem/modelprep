// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_MAKERONLINE_SECRET } from './makeronline-auth.js';
import { makerOnlineResponseError, uploadMakerOnlineFile } from './makeronline-upload.js';

afterEach(() => {
  delete window.modelprepDesktop;
});

describe('MakerOnline upload helper', () => {
  it('returns the normalized first-party file record', async () => {
    window.modelprepDesktop = {
      isDesktop: true,
      requestMakerOnline: vi.fn(async () => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true, file: {
          url: 'https://cdn.example/model.stl', name: 'model.stl', key: 'models/model.stl',
        } }),
      })),
    };
    const uploaded = await uploadMakerOnlineFile({
      workerUrl: 'https://modelprep-backend.iamdjem.workers.dev',
      secret: DESKTOP_MAKERONLINE_SECRET,
      file: new File(['solid'], 'model.stl', { type: 'model/stl' }),
      role: 'model',
    });
    expect(uploaded.url).toBe('https://cdn.example/model.stl');
  });

  it('keeps upstream error details', () => {
    expect(makerOnlineResponseError({ message: 'category missing' }, 400, 'Submit failed'))
      .toBe('Submit failed: category missing');
  });
});
