// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App, { BatchPublishPanel } from './App.jsx';
import { CONNECTABLE, addAccount, getAccounts, removeAccount } from './lib/accounts.js';
import { RESOURCE_REPORT_STORAGE_KEY } from './lib/batch-publish.js';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  for (const platform of CONNECTABLE) {
    for (const account of getAccounts(platform)) removeAccount(platform, account.id);
  }
  delete window.modelprepDesktop;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    set fillStyle(_value) {},
    set font(_value) {},
    set textAlign(_value) {},
    set textBaseline(_value) {},
  }));
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ZGVtbw==');
  // The demo has deterministic generated fallbacks when bundled assets are unavailable.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline test'))));
});

describe('one-click multi-platform publishing', () => {
  it('offers a failed-only retry without rerunning successful destinations', async () => {
    const user = userEvent.setup();
    const onRetryFailed = vi.fn();
    const targets = [
      { id: 'makerworld', name: 'MakerWorld', mode: 'real', visibility: 'private', accountLabel: 'MakerWorld test', accountStatus: 'connected', issues: { errors: [] } },
      { id: 'mmf', name: 'MyMiniFactory', mode: 'real', visibility: 'private', accountLabel: 'iamdjem', accountStatus: 'connected', issues: { errors: [] } },
    ];
    const batch = {
      runId: 'failed-run',
      status: 'done',
      targetIds: ['makerworld', 'mmf'],
      concurrency: 2,
      activeIds: [],
      results: {
        makerworld: { id: 'makerworld', name: 'MakerWorld', state: 'done', publicationState: 'private', detail: 'Private saved', url: 'https://example.test/1' },
        mmf: { id: 'mmf', name: 'MyMiniFactory', state: 'error', publicationState: 'private', detail: 'HTTP 500' },
      },
    };

    render(<BatchPublishPanel targets={targets} batch={batch} onPublish={vi.fn()} onRetryFailed={onRetryFailed} onOpenConnections={vi.fn()} />);
    const retry = screen.getByRole('button', { name: /retry 1 failed only/i });
    await user.click(retry);
    expect(onRetryFailed).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('1 succeeded');
    expect(screen.getByRole('status')).toHaveTextContent('1 failed');
  });

  it('shows privacy-safe aggregate resource telemetry for a batch', () => {
    const targets = [
      { id: 'makerworld', name: 'MakerWorld', mode: 'simulation', visibility: 'draft', safeDemo: true, accountLabel: 'Demo simulation', accountStatus: 'connected', issues: { errors: [] } },
    ];
    const resourceTelemetry = {
      schemaVersion: 1,
      publishers: { active: 0, queued: 1, completed: 0, failed: 0, total: 1 },
      memory: { mainPrivateMb: 48, appWorkingSetMb: 175, appPeakWorkingSetMb: 190 },
      cpu: { appPercent: 3.5 },
      processes: { total: 4, renderers: 1, utilities: 1, gpu: 1 },
    };
    render(<BatchPublishPanel targets={targets} batch={null} resourceTelemetry={resourceTelemetry} onPublish={vi.fn()} onRetryFailed={vi.fn()} onOpenConnections={vi.fn()} />);
    expect(screen.getByTestId('batch-resource-telemetry')).toHaveTextContent('0 active');
    expect(screen.getByTestId('batch-resource-telemetry')).toHaveTextContent('175 MB app working set');
    expect(screen.getByTestId('batch-resource-telemetry')).toHaveTextContent('4 processes');
  });

  it('offers the retained privacy-safe resource report after a completed batch', async () => {
    const user = userEvent.setup();
    const onDownloadResourceReport = vi.fn();
    const targets = [
      { id: 'makerworld', name: 'MakerWorld', mode: 'real', visibility: 'private', accountLabel: 'MakerWorld test', accountStatus: 'connected', issues: { errors: [] } },
    ];
    const batch = {
      status: 'done',
      targetIds: ['makerworld'],
      activeIds: [],
      results: { makerworld: { id: 'makerworld', state: 'done', publicationState: 'private', detail: 'Private saved' } },
      telemetry: { samples: [] },
    };
    const resourceReport = {
      schemaVersion: 1,
      completedAt: '2026-08-02T00:00:00.000Z',
      samples: [{ schemaVersion: 1 }],
    };

    render(<BatchPublishPanel
      targets={targets}
      batch={batch}
      resourceReport={resourceReport}
      resourceReportStatus="saved"
      onPublish={vi.fn()}
      onRetryFailed={vi.fn()}
      onDownloadResourceReport={onDownloadResourceReport}
      onOpenConnections={vi.fn()}
    />);

    expect(screen.getByText(/resource report retained locally/i)).toHaveTextContent('1 sample');
    await user.click(screen.getByRole('button', { name: /download resource report/i }));
    expect(onDownloadResourceReport).toHaveBeenCalledOnce();
  });

  it('captures a desktop resource baseline without starting an upload', async () => {
    const user = userEvent.setup();
    const captureResourceTelemetry = vi.fn().mockResolvedValue({
      schemaVersion: 1,
      publishers: { active: 0, queued: 0, completed: 0, failed: 0, total: 0 },
      memory: { mainPrivateMb: 52, appWorkingSetMb: 190, appPeakWorkingSetMb: 205 },
      cpu: { appPercent: 2.5 },
      processes: { total: 4, renderers: 1, utilities: 1, gpu: 1 },
    });
    window.modelprepDesktop = { isDesktop: true, captureResourceTelemetry };
    render(<App />);

    await user.click(screen.getByRole('button', { name: /real upload test/i }));
    await user.click(screen.getByRole('button', { name: /step 6: publish/i }));

    await waitFor(() => expect(captureResourceTelemetry).toHaveBeenCalled());
    expect(captureResourceTelemetry.mock.calls[0][0]).toEqual({
      phase: 'ready', active: 0, queued: 0, completed: 0, failed: 0, total: 0,
    });
    expect(await screen.findByTestId('batch-resource-telemetry')).toHaveTextContent('190 MB app working set');
    expect(fetch.mock.calls.some(([, init]) => String(init?.method || 'GET').toUpperCase() !== 'GET')).toBe(false);
  });

  it('restores the latest retained aggregate report through the full app', async () => {
    const user = userEvent.setup();
    localStorage.setItem(RESOURCE_REPORT_STORAGE_KEY, JSON.stringify([{
      schemaVersion: 1,
      completedAt: '2026-08-02T00:00:00.000Z',
      batch: { status: 'complete', total: 10, succeeded: 10, failed: 0, concurrency: 4 },
      peaks: { activePublishers: 4, appWorkingSetMb: 620, appCpuPercent: 35 },
      samples: [{
        schemaVersion: 1,
        timestamp: '2026-08-02T00:00:00.000Z',
        phase: 'complete',
        publishers: { active: 0, queued: 0, completed: 10, failed: 0, total: 10 },
        memory: { mainPrivateMb: 60, appWorkingSetMb: 590, appPeakWorkingSetMb: 620 },
        cpu: { appPercent: 6 },
        processes: { total: 4, renderers: 1, utilities: 1, gpu: 1 },
      }],
      account: 'must-be-removed',
    }]));

    render(<App />);
    await user.click(screen.getByRole('button', { name: /real upload test/i }));
    await user.click(screen.getByRole('button', { name: /step 6: publish/i }));

    expect(await screen.findByText(/latest retained resource report/i)).toHaveTextContent('1 sample');
    expect(screen.getByRole('button', { name: /download resource report/i })).toBeEnabled();
    expect(document.body).not.toHaveTextContent('must-be-removed');
    expect(fetch.mock.calls.some(([, init]) => String(init?.method || 'GET').toUpperCase() !== 'GET')).toBe(false);
  });

  it('loads a real private/draft-first test project for every direct platform', async () => {
    const user = userEvent.setup();
    for (const platform of CONNECTABLE) addAccount(platform, { label: `${platform} test`, secret: `test-${platform}`, status: 'connected' });
    render(<App />);

    await user.click(screen.getByRole('button', { name: /real upload test/i }));
    const publishNav = screen.getByRole('button', { name: /step 6: publish/i });
    await user.click(publishNav);

    const publishAll = await screen.findByRole('button', {
      name: /upload real test to 10 ready platforms/i,
    });
    expect(publishAll).toBeEnabled();
    expect(screen.getAllByText('real')).toHaveLength(10);
    expect(screen.getByText(/pressing the button sends the bundled sample files/i)).toBeInTheDocument();
    expect(screen.getByText(/runs up to four platforms at once/i)).toBeInTheDocument();
    expect(screen.getByText(/No public listings:/i)).toHaveTextContent('Thangs private');
    expect(screen.getByText(/No public listings:/i)).toHaveTextContent('MakerRoad draft');
    expect(screen.getByText(/No public listings:/i)).toHaveTextContent('Thingiverse draft');
    expect(screen.queryByText(/Skipped until its requirements are fixed:/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /expand every platform package/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /project review/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /publishing destinations/i })).toBeInTheDocument();
  }, 15000);

  it('does not upload on load and skips disconnected destinations without blocking ready ones', async () => {
    const user = userEvent.setup();
    addAccount('makerworld', { label: 'MakerWorld test', secret: 'test-makerworld', status: 'connected' });
    render(<App />);

    await user.click(screen.getByRole('button', { name: /real upload test/i }));
    await user.click(screen.getByRole('button', { name: /step 6: publish/i }));
    expect(await screen.findByRole('button', { name: /upload real test to 1 ready platform/i })).toBeEnabled();
    expect(screen.getByText(/Skipped until connected:/i)).toHaveTextContent('Printables');
    expect(fetch.mock.calls.some(([, init]) => String(init?.method || 'GET').toUpperCase() !== 'GET')).toBe(false);
  });

  it('opens the reconnect popup directly from an expired Publish destination', async () => {
    const user = userEvent.setup();
    addAccount('makerworld', { label: 'MakerWorld test', secret: 'test-makerworld', status: 'connected' });
    addAccount('printables', { label: 'Printables test', secret: 'desktop-managed-printables-session-v1', status: 'reconnect' });
    window.modelprepDesktop = { isDesktop: true };
    render(<App />);

    await user.click(screen.getByRole('button', { name: /real upload test/i }));
    await user.click(screen.getByRole('button', { name: /step 6: publish/i }));
    await user.click(await screen.findByRole('button', { name: /reconnect printables/i }));

    expect(screen.getAllByText('Settings').length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: /^reconnect$/i })).toBeInTheDocument();
  });
});
