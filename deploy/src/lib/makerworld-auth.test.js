// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_MAKERWORLD_SECRET,
  isDesktopMakerWorldSession,
  makerWorldFetch,
} from './makerworld-auth.js';

afterEach(() => {
  delete window.modelprepDesktop;
  vi.unstubAllGlobals();
});

describe('desktop-managed MakerWorld authentication', () => {
  it('keeps the opaque desktop marker out of the normal fetch path', async () => {
    const requestMakerWorld = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    });
    window.modelprepDesktop = { isDesktop: true, requestMakerWorld };
    const rawFetch = vi.fn();
    vi.stubGlobal('fetch', rawFetch);

    const response = await makerWorldFetch(
      'https://modelprep-backend.iamdjem.workers.dev/api/v1/makerworld/web/check',
      { headers: { 'X-MW-Cookie': DESKTOP_MAKERWORLD_SECRET } },
      DESKTOP_MAKERWORLD_SECRET,
    );

    expect(isDesktopMakerWorldSession(DESKTOP_MAKERWORLD_SECRET)).toBe(true);
    expect(await response.json()).toEqual({ ok: true });
    expect(requestMakerWorld).toHaveBeenCalledOnce();
    expect(rawFetch).not.toHaveBeenCalled();
  });

  it('uses normal fetch for web-managed sessions', async () => {
    const rawFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', rawFetch);
    await makerWorldFetch('https://worker/check', {}, 'token=web');
    expect(rawFetch).toHaveBeenCalledOnce();
  });

  it('keeps direct presigned storage uploads in the renderer', async () => {
    const requestMakerWorld = vi.fn();
    window.modelprepDesktop = { isDesktop: true, requestMakerWorld };
    const rawFetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', rawFetch);

    await makerWorldFetch(
      'https://storage.example/upload?signature=x',
      { method: 'PUT', body: new Blob(['mesh']) },
      DESKTOP_MAKERWORLD_SECRET,
    );

    expect(rawFetch).toHaveBeenCalledOnce();
    expect(requestMakerWorld).not.toHaveBeenCalled();
  });
});
