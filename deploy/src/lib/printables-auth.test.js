import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_PRINTABLES_SECRET,
  isDesktopPrintablesSession,
  printablesFetch,
} from './printables-auth.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Printables desktop auth broker', () => {
  it('recognizes only the opaque desktop marker', () => {
    expect(isDesktopPrintablesSession(DESKTOP_PRINTABLES_SECRET)).toBe(true);
    expect(isDesktopPrintablesSession('sessionid=raw-secret')).toBe(false);
  });

  it('sends Printables Worker requests through Electron without exposing a cookie', async () => {
    const requestPrintables = vi.fn(async (request) => ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, request }),
    }));
    vi.stubGlobal('window', {
      modelprepDesktop: { isDesktop: true, requestPrintables },
    });
    const response = await printablesFetch(
      'https://worker.example/api/v1/printables/web/check',
      { headers: { 'X-Test': 'yes' } },
      DESKTOP_PRINTABLES_SECRET,
    );
    expect(response.ok).toBe(true);
    expect(requestPrintables).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://worker.example/api/v1/printables/web/check',
      method: 'GET',
      bodyType: 'none',
    }));
    expect(JSON.stringify(requestPrintables.mock.calls)).not.toContain('Cookie');
  });

  it('never brokers a non-Printables destination', async () => {
    const requestPrintables = vi.fn();
    const normalFetch = vi.fn(async () => new Response('normal', { status: 200 }));
    vi.stubGlobal('window', {
      modelprepDesktop: { isDesktop: true, requestPrintables },
    });
    vi.stubGlobal('fetch', normalFetch);
    await printablesFetch(
      'https://api.printables.com/graphql/',
      {},
      DESKTOP_PRINTABLES_SECRET,
    );
    expect(normalFetch).toHaveBeenCalledOnce();
    expect(requestPrintables).not.toHaveBeenCalled();
  });
});
