// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { DESKTOP_THINGIVERSE_SECRET, thingiverseFetch } from './thingiverse-auth.js';
afterEach(() => { delete window.modelprepDesktop; vi.restoreAllMocks(); });
it('routes only Thingiverse worker-shaped requests through desktop', async () => {
  const requestThingiverse = vi.fn().mockResolvedValue({ status: 451, headers: {}, body: '{"error":"legal_gate"}' }); window.modelprepDesktop = { isDesktop: true, requestThingiverse };
  const response = await thingiverseFetch('https://worker.test/api/v1/thingiverse/web/gate', {}, DESKTOP_THINGIVERSE_SECRET);
  expect(response.status).toBe(451); expect(requestThingiverse).toHaveBeenCalledOnce();
});
