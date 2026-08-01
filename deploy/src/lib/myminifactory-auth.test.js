// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_MYMINIFACTORY_SECRET, isDesktopMyMiniFactorySession, myMiniFactoryFetch } from './myminifactory-auth.js';

describe('MyMiniFactory desktop auth bridge', () => {
  beforeEach(() => { delete window.modelprepDesktop; vi.restoreAllMocks(); });
  it('recognizes only the opaque desktop marker', () => {
    expect(isDesktopMyMiniFactorySession(DESKTOP_MYMINIFACTORY_SECRET)).toBe(true);
    expect(isDesktopMyMiniFactorySession('cookie')).toBe(false);
  });
  it('routes allow-listed calls through Electron without exposing cookies', async () => {
    const requestMyMiniFactory = vi.fn().mockResolvedValue({ status: 200, headers: { 'content-type': 'application/json' }, body: '{"ok":true}' });
    window.modelprepDesktop = { isDesktop: true, requestMyMiniFactory };
    const response = await myMiniFactoryFetch('https://worker.test/api/v1/myminifactory/web/whoami', {}, DESKTOP_MYMINIFACTORY_SECRET);
    expect(await response.json()).toEqual({ ok: true });
    expect(requestMyMiniFactory).toHaveBeenCalledWith(expect.objectContaining({ bodyType: 'none' }));
  });
});
