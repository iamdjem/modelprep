// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { DESKTOP_MAKEROAD_SECRET } from './makeroad-auth.js';
import { uploadMakerRoadFile } from './makeroad-upload.js';

beforeEach(() => { delete window.modelprepDesktop; });
it('returns the normalized MakerRoad upload receipt', async () => {
  window.modelprepDesktop = { isDesktop: true, requestMakerRoad: vi.fn().mockResolvedValue({ status: 200, headers: {}, body: '{"ok":true,"file":{"id":"f1"}}' }) };
  await expect(uploadMakerRoadFile({ workerUrl: 'https://worker.test', secret: DESKTOP_MAKEROAD_SECRET, role: 'model', file: new File(['x'], 'part.stl') })).resolves.toMatchObject({ id: 'f1' });
});
