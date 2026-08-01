// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_NEXPRINT_SECRET } from './nexprint-auth.js';
import { nexprintResponseError, uploadNexprintFile } from './nexprint-upload.js';

afterEach(() => {
  delete window.modelprepDesktop;
});

describe('Nexprint upload helper', () => {
  it('returns the normalized first-party file record', async () => {
    window.modelprepDesktop = {
      isDesktop: true,
      requestNexprint: vi.fn(async () => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ok: true,
          file: {
            fileId: '42',
            fileUrl: 'https://storage.example/model.stl',
            fileName: 'model.stl',
          },
        }),
      })),
    };

    const uploaded = await uploadNexprintFile({
      workerUrl: 'https://modelprep-backend.iamdjem.workers.dev',
      secret: DESKTOP_NEXPRINT_SECRET,
      file: new File(['solid'], 'model.stl', { type: 'model/stl' }),
      role: 'model',
    });

    expect(uploaded.fileId).toBe('42');
  });

  it('keeps upstream error details', () => {
    expect(nexprintResponseError({ msg: 'category missing' }, 400, 'Submit failed'))
      .toBe('Submit failed: category missing');
  });
});
