// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_NEXPRINT_SECRET,
  isDesktopNexprintSession,
  nexprintFetch,
} from './nexprint-auth.js';

afterEach(() => {
  delete window.modelprepDesktop;
  vi.restoreAllMocks();
});

describe('Nexprint desktop auth bridge', () => {
  it('recognizes only the opaque desktop session marker', () => {
    expect(isDesktopNexprintSession(DESKTOP_NEXPRINT_SECRET)).toBe(true);
    expect(isDesktopNexprintSession('auth_token=secret')).toBe(false);
  });

  it('serializes multipart uploads without exposing the account token', async () => {
    const requestNexprint = vi.fn(async (request) => ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, bodyType: request.bodyType }),
    }));
    window.modelprepDesktop = { isDesktop: true, requestNexprint };
    const form = new FormData();
    form.append('role', 'model');
    form.append('file', new File(['solid'], 'part.stl', { type: 'model/stl' }));

    const response = await nexprintFetch(
      'https://modelprep-backend.iamdjem.workers.dev/api/v1/nexprint/web/upload',
      { method: 'POST', body: form },
      DESKTOP_NEXPRINT_SECRET,
    );

    expect(await response.json()).toEqual({ ok: true, bodyType: 'form-data' });
    const request = requestNexprint.mock.calls[0][0];
    expect(request.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'role', kind: 'text', value: 'model' }),
      expect.objectContaining({ name: 'file', kind: 'file', fileName: 'part.stl' }),
    ]));
    expect(JSON.stringify(request)).not.toContain('auth_token');
  });

  it('does not bridge untrusted route prefixes', async () => {
    const requestNexprint = vi.fn();
    window.modelprepDesktop = { isDesktop: true, requestNexprint };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    await nexprintFetch(
      'https://modelprep-backend.iamdjem.workers.dev/api/v1/makerworld/web/check',
      {},
      DESKTOP_NEXPRINT_SECRET,
    );

    expect(requestNexprint).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
