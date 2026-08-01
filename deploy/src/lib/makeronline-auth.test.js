// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_MAKERONLINE_SECRET,
  makerOnlineFetch,
} from './makeronline-auth.js';

afterEach(() => {
  delete window.modelprepDesktop;
  vi.restoreAllMocks();
});

describe('MakerOnline desktop auth bridge', () => {
  it('serializes multipart bytes without exposing the session', async () => {
    window.modelprepDesktop = {
      isDesktop: true,
      requestMakerOnline: vi.fn(async (request) => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true, route: new URL(request.url).pathname }),
      })),
    };
    const form = new FormData();
    form.append('role', 'model');
    form.append('file', new File(['solid'], 'part.stl', { type: 'model/stl' }));
    const response = await makerOnlineFetch(
      'https://worker.example/api/v1/makeronline/web/upload',
      { method: 'POST', body: form },
      DESKTOP_MAKERONLINE_SECRET,
    );
    expect((await response.json()).ok).toBe(true);
    const request = window.modelprepDesktop.requestMakerOnline.mock.calls[0][0];
    expect(request.bodyType).toBe('form-data');
    expect(request.body.find((entry) => entry.name === 'file').fileName).toBe('part.stl');
    expect(JSON.stringify(request)).not.toContain('mo_access_token');
  });

  it('does not broker a non-MakerOnline route', async () => {
    window.modelprepDesktop = { isDesktop: true, requestMakerOnline: vi.fn() };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    await makerOnlineFetch('https://worker.example/api/v1/creality/web/whoami', {}, DESKTOP_MAKERONLINE_SECRET);
    expect(window.modelprepDesktop.requestMakerOnline).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
});
