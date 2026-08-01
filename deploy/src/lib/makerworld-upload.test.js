import { describe, expect, it, vi } from 'vitest';
import { makerWorldResponseError, uploadMakerWorldFile, WORKER_PROXY_LIMIT_BYTES } from './makerworld-upload';
import { DESKTOP_MAKERWORLD_SECRET } from './makerworld-auth.js';

const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});

describe('MakerWorld upload transport', () => {
  it('presigns and uploads directly to MakerWorld storage', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, signedUrl: 'https://s3/upload', url: 'https://cdn/file.stl', key: 'file.stl', cdnPrefix: 'https://cdn' }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    const result = await uploadMakerWorldFile({
      workerUrl: 'https://worker', cookie: 'token=x', file: new Blob(['mesh']), name: 'file.stl', fetchImpl,
    });
    expect(result).toMatchObject({ direct: true, url: 'https://cdn/file.stl', key: 'file.stl', size: 4 });
    expect(fetchImpl.mock.calls[1][0]).toBe('https://s3/upload');
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ method: 'PUT' });
  });

  it('falls back to the Worker proxy for a small file when direct S3 upload fails', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, signedUrl: 'https://s3/upload', url: 'https://cdn/file.stl', key: 'file.stl', cdnPrefix: 'https://cdn' }))
      .mockRejectedValueOnce(new TypeError('CORS blocked'))
      .mockResolvedValueOnce(jsonResponse({ ok: true, url: 'https://cdn/proxied.stl', key: 'proxied.stl', size: 4, cdnPrefix: 'https://cdn' }));
    const result = await uploadMakerWorldFile({
      workerUrl: 'https://worker', cookie: 'token=x', file: new Blob(['mesh']), name: 'file.stl', fetchImpl,
    });
    expect(result).toMatchObject({ direct: false, url: 'https://cdn/proxied.stl' });
    expect(fetchImpl.mock.calls[2][0]).toBe('https://worker/api/v1/makerworld/web/upload');
  });

  it('reports the bridged fallback as direct for a desktop-managed session', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, signedUrl: 'https://s3/upload', url: 'https://cdn/file.stl', key: 'file.stl', cdnPrefix: 'https://cdn' }))
      .mockRejectedValueOnce(new TypeError('CORS blocked'))
      .mockResolvedValueOnce(jsonResponse({ ok: true, url: 'https://cdn/desktop.stl', key: 'desktop.stl', size: 4, cdnPrefix: 'https://cdn' }));
    const result = await uploadMakerWorldFile({
      workerUrl: 'https://worker',
      cookie: DESKTOP_MAKERWORLD_SECRET,
      file: new Blob(['mesh']),
      name: 'file.stl',
      fetchImpl,
    });
    expect(result).toMatchObject({ direct: true, url: 'https://cdn/desktop.stl' });
    expect(fetchImpl.mock.calls[2][0]).toBe('https://worker/api/v1/makerworld/web/upload');
  });

  it('falls back to the Worker proxy for a small file when presign is unavailable', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'not_found' }, 404))
      .mockResolvedValueOnce(jsonResponse({ ok: true, url: 'https://cdn/proxied.stl', key: 'proxied.stl', size: 4, cdnPrefix: 'https://cdn' }));
    const result = await uploadMakerWorldFile({
      workerUrl: 'https://worker', cookie: 'token=x', file: new Blob(['mesh']), name: 'file.stl', fetchImpl,
    });
    expect(result).toMatchObject({ direct: false, url: 'https://cdn/proxied.stl' });
    expect(fetchImpl.mock.calls[1][0]).toBe('https://worker/api/v1/makerworld/web/upload');
  });

  it('does not silently proxy a file above the Worker request limit', async () => {
    const largeFile = { size: WORKER_PROXY_LIMIT_BYTES + 1 };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, signedUrl: 'https://s3/upload', url: 'https://cdn/large.step', key: 'large.step', cdnPrefix: 'https://cdn' }))
      .mockRejectedValueOnce(new TypeError('CORS blocked'));
    await expect(uploadMakerWorldFile({
      workerUrl: 'https://worker', cookie: 'token=x', file: largeFile, name: 'large.step', fetchImpl,
    })).rejects.toThrow('Files above 95MB cannot use the Worker fallback');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('surfaces structured Worker validation issues', () => {
    expect(makerWorldResponseError({ error: 'invalid_publish', issues: ['title is required', 'cover is required'] }, 400))
      .toBe('title is required cover is required');
  });
});
