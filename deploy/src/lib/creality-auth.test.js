// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_CREALITY_SECRET,
  crealityFetch,
  isDesktopCrealitySession,
} from './creality-auth.js';

afterEach(() => {
  delete window.modelprepDesktop;
  vi.unstubAllGlobals();
});

describe('Creality desktop auth bridge', () => {
  it('recognizes only its opaque desktop marker', () => {
    expect(isDesktopCrealitySession(DESKTOP_CREALITY_SECRET)).toBe(true);
    expect(isDesktopCrealitySession('model_token=secret')).toBe(false);
  });

  it('serializes Creality uploads without exposing a token', async () => {
    const requestCreality = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    });
    window.modelprepDesktop = { isDesktop: true, requestCreality };
    const form = new FormData();
    form.append('role', 'model');
    form.append('file', new File(['solid'], 'part.stl', { type: 'model/stl' }));

    const response = await crealityFetch(
      'https://modelprep-backend.iamdjem.workers.dev/api/v1/creality/web/upload',
      { method: 'POST', body: form },
      DESKTOP_CREALITY_SECRET,
    );

    expect(response.ok).toBe(true);
    expect(requestCreality).toHaveBeenCalledOnce();
    expect(requestCreality.mock.calls[0][0].body).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'file', kind: 'file', fileName: 'part.stl' }),
    ]));
    expect(JSON.stringify(requestCreality.mock.calls[0][0])).not.toContain('model_token');
  });
});
