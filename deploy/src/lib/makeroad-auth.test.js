// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_MAKEROAD_SECRET, makerRoadFetch } from './makeroad-auth.js';

describe('MakerRoad desktop transport', () => {
  beforeEach(() => { delete window.modelprepDesktop; vi.restoreAllMocks(); });
  it('serializes multipart bytes only for allow-listed MakerRoad routes', async () => {
    const requestMakerRoad = vi.fn().mockResolvedValue({ status: 200, headers: { 'content-type': 'application/json' }, body: '{"ok":true}' });
    window.modelprepDesktop = { isDesktop: true, requestMakerRoad };
    const form = new FormData(); form.append('role', 'model'); form.append('file', new File(['solid'], 'part.stl'));
    const response = await makerRoadFetch('https://worker.test/api/v1/makeroad/web/upload', { method: 'POST', body: form }, DESKTOP_MAKEROAD_SECRET);
    expect(response.ok).toBe(true);
    expect(requestMakerRoad.mock.calls[0][0].body).toHaveLength(2);
  });
});
