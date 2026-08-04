import { describe, expect, it } from 'vitest';
import {
  advancePublishBatch,
  appendPublishBatchResourceSample,
  batchPublishIntent,
  concisePublishDetail,
  createPublishBatchResourceReport,
  createPublishBatch,
  DESKTOP_PUBLISH_CONCURRENCY,
  LIVE_PUBLISH_PLATFORM_IDS,
  loadRetainedPublishBatchResourceReports,
  orderedPlatformImages,
  publishBatchResourceRequest,
  publishBatchResourceSummary,
  publishBatchSummary,
  publishReceiptLabel,
  publishVisibility,
  RESOURCE_REPORT_STORAGE_KEY,
  retainPublishBatchResourceReport,
  retryFailedPublishBatch,
} from './batch-publish.js';

describe('multi-platform publish batches', () => {
  const targets = [
    { id: 'makerworld', name: 'MakerWorld', mode: 'real' },
    { id: 'printables', name: 'Printables', mode: 'real' },
    { id: 'cults', name: 'Cults3D', mode: 'simulation' },
  ];

  it('contains exactly the platforms with implemented live upload flows', () => {
    expect(LIVE_PUBLISH_PLATFORM_IDS).toEqual(['makerworld', 'printables', 'cults', 'nexprint', 'creality', 'makeronline', 'mmf', 'makeroad', 'thangs', 'thingiverse']);
  });

  it('keeps Nexprint batch publishing draft-first unless explicitly changed', () => {
    expect(batchPublishIntent('nexprint', {
      platforms: { nexprint: { publication: 'draft' } },
    })).toEqual({ action: 'draft', visibility: 'draft' });
    expect(batchPublishIntent('nexprint', {
      platforms: { nexprint: { publication: 'publish' } },
    })).toEqual({ action: 'publish', visibility: 'public' });
    expect(batchPublishIntent('nexprint', {
      __demo: true,
      platforms: { nexprint: { publication: 'publish' } },
    })).toEqual({ action: 'draft', visibility: 'draft' });
  });

  it('keeps Printables batch publishing draft-first unless explicitly changed', () => {
    expect(batchPublishIntent('printables', {
      platforms: { printables: { publication: 'draft' } },
    })).toEqual({ action: 'draft', visibility: 'draft' });
    expect(batchPublishIntent('printables', {
      platforms: { printables: { publication: 'publish' } },
    })).toEqual({ action: 'publish', visibility: 'public' });
  });

  it('uses Creality private-first because new uploads cannot create drafts', () => {
    expect(batchPublishIntent('creality', {
      platforms: { creality: { publication: 'draft' } },
    })).toEqual({ action: 'private', visibility: 'private' });
    expect(batchPublishIntent('creality', {
      platforms: { creality: { publication: 'private' } },
    })).toEqual({ action: 'private', visibility: 'private' });
    expect(batchPublishIntent('creality', {
      platforms: { creality: { publication: 'public' } },
    })).toEqual({ action: 'publish', visibility: 'public' });
    expect(batchPublishIntent('creality', {
      __demo: true,
      platforms: { creality: { publication: 'public' } },
    })).toEqual({ action: 'private', visibility: 'private' });
  });

  it('keeps MakerOnline draft-first unless public publishing is explicit', () => {
    expect(batchPublishIntent('makeronline', {
      platforms: { makeronline: { publication: 'draft' } },
    })).toEqual({ action: 'draft', visibility: 'draft' });
    expect(batchPublishIntent('makeronline', {
      platforms: { makeronline: { publication: 'public' } },
    })).toEqual({ action: 'publish', visibility: 'public' });
    expect(batchPublishIntent('makeronline', {
      __demo: true,
      platforms: { makeronline: { publication: 'public' } },
    })).toEqual({ action: 'draft', visibility: 'draft' });
  });

  it('keeps MyMiniFactory private-first unless public publishing is explicit', () => {
    expect(batchPublishIntent('mmf', { platforms: { mmf: { publication: 'private' } } })).toEqual({ action: 'private', visibility: 'private' });
    expect(batchPublishIntent('mmf', { platforms: { mmf: { publication: 'public' } } })).toEqual({ action: 'publish', visibility: 'public' });
    expect(batchPublishIntent('mmf', { __demo: true, platforms: { mmf: { publication: 'public' } } })).toEqual({ action: 'private', visibility: 'private' });
  });

  it('honors an explicit concurrency of two and continues after one platform fails', () => {
    let batch = createPublishBatch(targets, 'run-1', 2);
    expect(batch.currentId).toBe('makerworld');
    expect(batch.results.makerworld.state).toBe('publishing');
    expect(batch.results.printables.state).toBe('publishing');
    expect(batch.activeIds).toEqual(['makerworld', 'printables']);

    batch = advancePublishBatch(batch, {
      runId: 'run-1',
      platformId: 'makerworld',
      state: 'success',
      detail: 'Submitted',
    });
    expect(batch.currentId).toBe('printables');
    expect(batch.results.makerworld.state).toBe('done');
    expect(batch.results.cults.state).toBe('publishing');
    expect(batch.activeIds).toEqual(['printables', 'cults']);

    batch = advancePublishBatch(batch, {
      runId: 'run-1',
      platformId: 'printables',
      state: 'error',
      detail: 'Approval failed',
    });
    expect(batch.currentId).toBe('cults');
    expect(batch.results.printables.state).toBe('error');

    batch = advancePublishBatch(batch, {
      runId: 'run-1',
      platformId: 'cults',
      state: 'success',
      detail: 'Simulation complete',
    });
    expect(batch.status).toBe('done');
    expect(batch.currentId).toBeNull();
    expect(batch.results.cults.state).toBe('done');
  });

  it('retries only failed destinations while preserving successful receipts', () => {
    let batch = createPublishBatch(targets, 'run-1', 2);
    batch = advancePublishBatch(batch, { runId: 'run-1', platformId: 'makerworld', state: 'success', detail: 'Private saved', url: 'https://example.test/1' });
    batch = advancePublishBatch(batch, { runId: 'run-1', platformId: 'printables', state: 'error', detail: 'Temporary HTTP 500' });
    batch = advancePublishBatch(batch, { runId: 'run-1', platformId: 'cults', state: 'success', detail: 'Secret saved', url: 'https://example.test/3' });

    const retried = retryFailedPublishBatch(batch, 'retry-1');
    expect(retried.runId).toBe('retry-1');
    expect(retried.status).toBe('running');
    expect(retried.activeIds).toEqual(['printables']);
    expect(retried.results.printables.state).toBe('publishing');
    expect(retried.results.makerworld).toMatchObject({ state: 'done', url: 'https://example.test/1' });
    expect(retried.results.cults).toMatchObject({ state: 'done', url: 'https://example.test/3' });
    expect(publishBatchSummary(retried)).toEqual({ total: 3, succeeded: 2, failed: 0, running: 1 });
  });

  it('defaults desktop batches to four active platforms and fills the next open slot', () => {
    const desktopTargets = [
      { id: 'makerworld', name: 'MakerWorld', mode: 'real' },
      { id: 'printables', name: 'Printables', mode: 'real' },
      { id: 'cults', name: 'Cults3D', mode: 'real' },
      { id: 'nexprint', name: 'Nexprint', mode: 'real' },
      { id: 'creality', name: 'Creality Cloud', mode: 'real' },
    ];
    let batch = createPublishBatch(desktopTargets, 'desktop-default');
    expect(DESKTOP_PUBLISH_CONCURRENCY).toBe(4);
    expect(batch.concurrency).toBe(4);
    expect(batch.activeIds).toEqual(['makerworld', 'printables', 'cults', 'nexprint']);
    expect(batch.results.creality.state).toBe('pending');

    batch = advancePublishBatch(batch, {
      runId: 'desktop-default',
      platformId: 'cults',
      state: 'success',
      detail: 'Submitted',
    });
    expect(batch.activeIds).toEqual(['makerworld', 'printables', 'nexprint', 'creality']);
    expect(batch.results.creality.state).toBe('publishing');
  });

  it('records bounded aggregate resource samples without changing scheduler state', () => {
    const batch = createPublishBatch(targets, 'resource-run', 2);
    expect(publishBatchResourceRequest(batch)).toEqual({
      phase: 'start', active: 2, queued: 1, completed: 0, failed: 0, total: 3,
    });
    const sample = {
      schemaVersion: 1,
      timestamp: '2026-08-01T20:00:00.000Z',
      phase: 'start',
      publishers: { active: 2, queued: 1, completed: 0, failed: 0, total: 3 },
      memory: { mainPrivateMb: 50, appWorkingSetMb: 180, appPeakWorkingSetMb: 200 },
      cpu: { appPercent: 12.5 },
      processes: { total: 4, renderers: 1, utilities: 1, gpu: 1 },
    };
    const measured = appendPublishBatchResourceSample(batch, sample);
    expect(measured.activeIds).toEqual(batch.activeIds);
    expect(measured.results).toEqual(batch.results);
    expect(publishBatchResourceRequest(measured).phase).toBe('progress');
    expect(publishBatchResourceSummary(measured)).toEqual({
      sampleCount: 1,
      latest: sample,
      peakActivePublishers: 2,
      peakAppWorkingSetMb: 180,
      peakAppCpuPercent: 12.5,
    });
  });

  it('ignores stale or out-of-order flow completions', () => {
    const batch = createPublishBatch(targets, 'run-current', 1);
    expect(advancePublishBatch(batch, {
      runId: 'run-old',
      platformId: 'makerworld',
      state: 'success',
    })).toBe(batch);
    expect(advancePublishBatch(batch, {
      runId: 'run-current',
      platformId: 'printables',
      state: 'success',
    })).toBe(batch);
  });

  it('keeps Worker fallback publishing sequential with concurrency one', () => {
    let batch = createPublishBatch(targets, 'worker-run', 1);
    expect(batch.activeIds).toEqual(['makerworld']);
    expect(batch.results.printables.state).toBe('pending');
    batch = advancePublishBatch(batch, {
      runId: 'worker-run',
      platformId: 'makerworld',
      state: 'success',
    });
    expect(batch.activeIds).toEqual(['printables']);
    expect(batch.results.cults.state).toBe('pending');
  });

  it('uses each platform-specific publish visibility', () => {
    const project = {
      platforms: {
        makerworld: { visibility: 'private' },
        printables: { publication: 'draft' },
        cults: { visibility: 'secret' },
      },
    };
    expect(publishVisibility('makerworld', project)).toBe('private');
    expect(publishVisibility('printables', project)).toBe('draft');
    expect(publishVisibility('cults', project)).toBe('secret');
  });

  it('uses drafts where possible and secret visibility for the demo project', () => {
    const project = {
      __demo: true,
      platforms: {
        makerworld: { visibility: 'public' },
        printables: {},
        cults: { visibility: 'public' },
      },
    };
    expect(batchPublishIntent('makerworld', project)).toEqual({ action: 'draft', visibility: 'draft' });
    expect(batchPublishIntent('printables', project)).toEqual({ action: 'draft', visibility: 'draft' });
    expect(batchPublishIntent('cults', project)).toEqual({ action: 'publish', visibility: 'secret' });
  });

  it('produces concise, user-facing result labels and a mixed-outcome summary', () => {
    let batch = createPublishBatch([
      { id: 'makerworld', name: 'MakerWorld', mode: 'real', action: 'draft', visibility: 'draft' },
      { id: 'printables', name: 'Printables', mode: 'real', action: 'draft', visibility: 'draft' },
    ], 'receipt-run', 1);
    batch = advancePublishBatch(batch, {
      runId: 'receipt-run',
      platformId: 'makerworld',
      state: 'success',
      publicationState: 'draft',
      detail: 'Unpublished draft saved',
    });
    batch = advancePublishBatch(batch, {
      runId: 'receipt-run',
      platformId: 'printables',
      state: 'error',
      detail: 'The server returned a long authentication failure that should remain readable without taking over the whole results card.',
    });

    expect(publishReceiptLabel(batch.results.makerworld)).toBe('Not published · Draft');
    expect(publishReceiptLabel(batch.results.printables)).toBe('Failed');
    expect(publishBatchSummary(batch)).toEqual({ total: 2, succeeded: 1, failed: 1, running: 0 });
    expect(concisePublishDetail('one   two\nthree', 20)).toBe('one two three');
    expect(concisePublishDetail('x'.repeat(200), 20)).toHaveLength(20);
    expect(concisePublishDetail('x'.repeat(200), 20).endsWith('…')).toBe(true);
  });

  it('puts the selected cover first and enforces each platform image cap', () => {
    const images = Array.from({ length: 24 }, (_, index) => ({ id: `image-${index}` }));
    const selected = orderedPlatformImages(
      { maxImages: 20 },
      { images, coverImageId: 'image-7' },
    );
    expect(selected).toHaveLength(20);
    expect(selected[0].id).toBe('image-7');
    expect(selected.filter((image) => image.id === 'image-7')).toHaveLength(1);
  });

  it('creates a privacy-safe resource report without batch, platform, account, file, URL, or token identifiers', () => {
    let batch = createPublishBatch(targets, 'secret-run-id', 3);
    batch = appendPublishBatchResourceSample(batch, {
      schemaVersion: 1,
      timestamp: '2026-08-02T00:00:00.000Z',
      phase: 'start',
      publishers: { active: 3, queued: 0, completed: 0, failed: 0, total: 3 },
      memory: { mainPrivateMb: 40, appWorkingSetMb: 180, appPeakWorkingSetMb: 200 },
      cpu: { appPercent: 12.4 },
      processes: { total: 4, renderers: 1, utilities: 1, gpu: 1 },
      platformIds: ['makerworld'],
      token: 'must-not-retain',
    });
    for (const id of batch.targetIds) {
      batch = advancePublishBatch(batch, {
        runId: 'secret-run-id', platformId: id, state: 'success', url: `https://example.test/${id}`,
      });
    }

    const report = createPublishBatchResourceReport(batch);
    expect(report).toMatchObject({
      schemaVersion: 1,
      completedAt: '2026-08-02T00:00:00.000Z',
      batch: { status: 'complete', total: 3, succeeded: 3, failed: 0, concurrency: 3 },
      peaks: { activePublishers: 3, appWorkingSetMb: 180, appCpuPercent: 12.4 },
    });
    const serialized = JSON.stringify(report);
    for (const forbidden of ['secret-run-id', 'makerworld', 'printables', 'cults', 'example.test', 'must-not-retain']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('deduplicates and bounds retained resource reports while sanitizing stored input', () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    };
    const report = {
      schemaVersion: 1,
      completedAt: '2026-08-02T00:00:00.000Z',
      batch: { status: 'complete', total: 1, succeeded: 1, failed: 0, concurrency: 1, account: 'remove-me' },
      peaks: { activePublishers: 1, appWorkingSetMb: 100, appCpuPercent: 2 },
      samples: [{
        schemaVersion: 1,
        timestamp: '2026-08-02T00:00:00.000Z',
        phase: 'complete',
        publishers: { active: 0, queued: 0, completed: 1, failed: 0, total: 1 },
        memory: { mainPrivateMb: 40, appWorkingSetMb: 100, appPeakWorkingSetMb: 110 },
        cpu: { appPercent: 2 },
        processes: { total: 4, renderers: 1, utilities: 1, gpu: 1 },
        url: 'https://remove.example',
      }],
    };

    retainPublishBatchResourceReport(storage, report, 2);
    retainPublishBatchResourceReport(storage, report, 2);

    const retained = JSON.parse(values.get(RESOURCE_REPORT_STORAGE_KEY));
    expect(retained).toHaveLength(1);
    expect(JSON.stringify(retained)).not.toContain('remove-me');
    expect(JSON.stringify(retained)).not.toContain('remove.example');
    expect(loadRetainedPublishBatchResourceReports(storage)).toEqual(retained);
  });
});
