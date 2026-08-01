// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { DESKTOP_THANGS_SECRET, thangsFetch } from './thangs-auth.js';
afterEach(() => { delete window.modelprepDesktop; vi.restoreAllMocks(); });
it('keeps Thangs bytes inside the allow-listed desktop bridge', async () => {
  const requestThangs = vi.fn().mockResolvedValue({ status: 200, headers: {}, body: '{"ok":true}' }); window.modelprepDesktop = { isDesktop: true, requestThangs };
  const form = new FormData(); form.append('role', 'model'); form.append('file', new File(['x'], 'part.stl'));
  expect((await thangsFetch('https://worker.test/api/v1/thangs/web/upload', { method: 'POST', body: form }, DESKTOP_THANGS_SECRET)).ok).toBe(true);
  expect(requestThangs.mock.calls[0][0].body).toHaveLength(2);
});
