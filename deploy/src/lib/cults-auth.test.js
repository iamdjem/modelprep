// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cultsFetch,
  desktopCultsAccountId,
  desktopCultsSecret,
  isDesktopCultsSession,
} from './cults-auth.js';

afterEach(() => {
  delete window.modelprepDesktop;
  vi.unstubAllGlobals();
});

describe('desktop-managed Cults3D authentication', () => {
  it('routes multipart Worker-shaped requests through Electron without credentials', async () => {
    const requestCults = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    });
    window.modelprepDesktop = { isDesktop: true, requestCults };
    const rawFetch = vi.fn();
    vi.stubGlobal('fetch', rawFetch);
    const secret = desktopCultsSecret('account-123');
    const form = new FormData();
    form.append('name', 'Dragon');
    form.append('model', new File(['mesh'], 'dragon.stl', { type: 'model/stl' }));

    const response = await cultsFetch(
      'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish',
      {
        method: 'POST',
        headers: {
          'X-Cults-Email': 'must-not-cross-the-bridge@example.com',
          'X-Cults-Password': 'must-not-cross-the-bridge',
        },
        body: form,
      },
      secret,
    );

    expect(isDesktopCultsSession(secret)).toBe(true);
    expect(desktopCultsAccountId(secret)).toBe('account-123');
    expect(await response.json()).toEqual({ ok: true });
    expect(rawFetch).not.toHaveBeenCalled();
    expect(requestCults).toHaveBeenCalledOnce();
    const request = requestCults.mock.calls[0][0];
    expect(request.accountId).toBe('account-123');
    expect(request.headers).not.toHaveProperty('X-Cults-Email');
    expect(request.headers).not.toHaveProperty('X-Cults-Password');
    expect(request.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'name', kind: 'text', value: 'Dragon' }),
      expect.objectContaining({ name: 'model', kind: 'file', fileName: 'dragon.stl' }),
    ]));
  });

  it('fails closed in web builds without forwarding legacy credentials', async () => {
    const rawFetch = vi.fn();
    vi.stubGlobal('fetch', rawFetch);
    const response = await cultsFetch(
      'https://worker.example/api/v1/cults3d/web/my-creations',
      {},
      { email: 'web@example.com', password: 'secret' },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(expect.objectContaining({ error: 'desktop_required' }));
    expect(rawFetch).not.toHaveBeenCalled();
  });
});
