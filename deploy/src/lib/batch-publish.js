export const LIVE_PUBLISH_PLATFORM_IDS = ['makerworld', 'printables', 'cults', 'nexprint', 'creality', 'makeronline', 'mmf', 'makeroad', 'thangs', 'thingiverse'];

export function batchPublishIntent(platformId, project) {
  const safeDemo = !!project.__demo;
  if (platformId === 'makerworld') {
    return safeDemo
      ? { action: 'draft', visibility: 'draft' }
      : { action: 'publish', visibility: project.platforms?.makerworld?.visibility || 'private' };
  }
  if (platformId === 'printables') {
    const publication = project.platforms?.printables?.publication || 'draft';
    return safeDemo
      ? { action: 'draft', visibility: 'draft' }
      : {
        action: publication === 'publish' ? 'publish' : 'draft',
        visibility: publication === 'publish' ? 'public' : 'draft',
      };
  }
  if (platformId === 'cults') {
    return {
      action: 'publish',
      visibility: safeDemo ? 'secret' : (project.platforms?.cults?.visibility || 'secret'),
    };
  }
  if (platformId === 'nexprint') {
    const publication = project.platforms?.nexprint?.publication || 'draft';
    return safeDemo
      ? { action: 'draft', visibility: 'draft' }
      : {
        action: publication === 'publish' ? 'publish' : 'draft',
        visibility: publication === 'publish' ? 'public' : 'draft',
      };
  }
  if (platformId === 'creality') {
    const publication = project.platforms?.creality?.publication === 'public' ? 'public' : 'private';
    return safeDemo
      ? { action: 'private', visibility: 'private' }
      : {
        action: publication === 'public' ? 'publish' : publication,
        visibility: publication,
      };
  }
  if (platformId === 'makeronline') {
    const publication = project.platforms?.makeronline?.publication || 'draft';
    return safeDemo
      ? { action: 'draft', visibility: 'draft' }
      : {
        action: publication === 'public' ? 'publish' : 'draft',
        visibility: publication === 'public' ? 'public' : 'draft',
      };
  }
  if (platformId === 'mmf') {
    const publication = project.platforms?.mmf?.publication === 'public' ? 'public' : 'private';
    return safeDemo
      ? { action: 'private', visibility: 'private' }
      : { action: publication === 'public' ? 'publish' : 'private', visibility: publication };
  }
  if (platformId === 'makeroad') {
    const publication = project.platforms?.makeroad?.publication === 'publish' ? 'publish' : 'draft';
    return safeDemo ? { action: 'draft', visibility: 'draft' } : {
      action: publication, visibility: publication === 'publish' ? 'pending' : 'draft',
    };
  }
  if (platformId === 'thangs') {
    const publication = project.platforms?.thangs?.publication === 'public' ? 'public' : 'private';
    return safeDemo ? { action: 'private', visibility: 'private' } : { action: publication === 'public' ? 'publish' : 'private', visibility: publication };
  }
  if (platformId === 'thingiverse') {
    const publication = project.platforms?.thingiverse?.publication === 'publish' ? 'public' : 'draft';
    return safeDemo ? { action: 'draft', visibility: 'draft' } : { action: publication === 'public' ? 'publish' : 'draft', visibility: publication };
  }
  return { action: 'manual', visibility: 'manual' };
}

export function publishVisibility(platformId, project) {
  return batchPublishIntent(platformId, project).visibility;
}

export function orderedPlatformImages(platform, project) {
  const cover = project.images.find((image) => image.id === project.coverImageId) || project.images[0];
  if (!cover) return [];
  return [
    cover,
    ...project.images.filter((image) => image.id !== cover.id),
  ].slice(0, platform.maxImages || project.images.length);
}

export const DESKTOP_PUBLISH_CONCURRENCY = 4;
const MAX_RESOURCE_TELEMETRY_SAMPLES = 32;
export const RESOURCE_REPORT_STORAGE_KEY = 'modelprep:resource-telemetry-reports:v1';
const RESOURCE_REPORT_LIMIT = 10;
const RESOURCE_PHASES = new Set(['ready', 'start', 'progress', 'retry', 'complete']);

export function createPublishBatch(targets, runId, requestedConcurrency = DESKTOP_PUBLISH_CONCURRENCY) {
  const results = Object.fromEntries(targets.map((target) => [
    target.id,
    {
      id: target.id,
      name: target.name,
      state: 'pending',
      action: target.action,
      visibility: target.visibility,
      publicationState: target.visibility,
      simulated: target.mode === 'simulation',
      detail: target.mode === 'simulation'
        ? `${target.action === 'draft' ? 'Draft save' : `${target.visibility} publish`} simulation queued`
        : `${target.action === 'draft' ? 'Draft save' : `${target.visibility} publish`} queued`,
    },
  ]));
  const concurrency = Math.max(1, Math.min(Number(requestedConcurrency) || 1, targets.length || 1));
  const activeIds = targets.slice(0, concurrency).map((target) => target.id);
  activeIds.forEach((id) => {
    results[id] = { ...results[id], state: 'publishing', detail: 'Starting…' };
  });
  return {
    runId,
    status: activeIds.length ? 'running' : 'idle',
    targetIds: targets.map((target) => target.id),
    concurrency,
    activeIds,
    currentId: activeIds[0] || null,
    results,
    telemetry: { samples: [], peakActivePublishers: activeIds.length },
  };
}

export function advancePublishBatch(batch, outcome) {
  if (!batch || batch.status !== 'running') return batch;
  const activeIds = batch.activeIds || (batch.currentId ? [batch.currentId] : []);
  if (batch.runId !== outcome.runId || !activeIds.includes(outcome.platformId)) return batch;

  const results = {
    ...batch.results,
    [outcome.platformId]: {
      ...batch.results[outcome.platformId],
      state: outcome.state === 'success' ? 'done' : 'error',
      detail: concisePublishDetail(outcome.detail || (outcome.state === 'success' ? 'Complete' : 'Failed')),
      fullDetail: outcome.detail || (outcome.state === 'success' ? 'Complete' : 'Failed'),
      publicationState: outcome.publicationState || batch.results[outcome.platformId].publicationState,
      simulated: outcome.simulated ?? batch.results[outcome.platformId].simulated,
      url: outcome.url || '',
    },
  };
  const remainingActive = activeIds.filter((id) => id !== outcome.platformId);
  const pendingIds = batch.targetIds.filter((id) => results[id]?.state === 'pending');
  const openSlots = Math.max(0, (batch.concurrency || 1) - remainingActive.length);
  const startingIds = pendingIds.slice(0, openSlots);
  startingIds.forEach((id) => {
    results[id] = { ...results[id], state: 'publishing', detail: 'Starting…' };
  });
  const nextActiveIds = [...remainingActive, ...startingIds];
  return {
    ...batch,
    status: nextActiveIds.length ? 'running' : 'done',
    activeIds: nextActiveIds,
    currentId: nextActiveIds[0] || null,
    results,
  };
}

export function retryFailedPublishBatch(batch, runId) {
  if (!batch || batch.status !== 'done') return batch;
  const failedIds = batch.targetIds.filter((id) => batch.results[id]?.state === 'error');
  if (!failedIds.length) return batch;

  const results = { ...batch.results };
  failedIds.forEach((id) => {
    results[id] = { ...results[id], state: 'pending', detail: 'Retry queued', fullDetail: 'Retry queued' };
  });
  const activeIds = failedIds.slice(0, batch.concurrency || 1);
  activeIds.forEach((id) => {
    results[id] = { ...results[id], state: 'publishing', detail: 'Retrying…', fullDetail: 'Retrying…' };
  });

  return {
    ...batch,
    runId,
    status: 'running',
    activeIds,
    currentId: activeIds[0] || null,
    results,
  };
}

export function concisePublishDetail(detail, maxLength = 160) {
  const clean = String(detail || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

export function publishReceiptLabel(result) {
  if (!result) return 'Ready';
  if (result.state === 'publishing') return 'Working';
  if (result.state === 'pending') return 'Queued';
  if (result.state === 'error') return 'Failed';
  if (result.state !== 'done') return 'Ready';

  const publicationState = result.publicationState || result.visibility;
  if (result.simulated) {
    if (publicationState === 'draft') return 'Simulated · Draft';
    const simulatedLabel = publicationState
      ? publicationState.charAt(0).toUpperCase() + publicationState.slice(1)
      : 'Publish';
    return `Simulated · ${simulatedLabel}`;
  }
  if (publicationState === 'draft') return 'Not published · Draft';
  if (publicationState === 'pending') return 'Pending approval';
  if (publicationState === 'private') return 'Published · Private';
  if (publicationState === 'secret') return 'Published · Secret';
  if (publicationState === 'live' || publicationState === 'public') return 'Published';
  if (publicationState === 'submitted') return 'Submitted';
  return 'Complete';
}

export function publishBatchSummary(batch) {
  const results = Object.values(batch?.results || {});
  return {
    total: results.length,
    succeeded: results.filter((result) => result.state === 'done').length,
    failed: results.filter((result) => result.state === 'error').length,
    running: results.filter((result) => result.state === 'publishing').length,
  };
}

export function publishBatchResourceRequest(batch, readyTargetCount = 0) {
  if (!batch) {
    return {
      phase: 'ready',
      active: 0,
      queued: Math.max(0, Number(readyTargetCount) || 0),
      completed: 0,
      failed: 0,
      total: Math.max(0, Number(readyTargetCount) || 0),
    };
  }

  const summary = publishBatchSummary(batch);
  const samples = batch.telemetry?.samples || [];
  const queued = batch.targetIds.filter((id) => batch.results[id]?.state === 'pending').length;
  return {
    phase: batch.status === 'done'
      ? 'complete'
      : samples.length === 0
        ? (String(batch.runId || '').includes('retry') ? 'retry' : 'start')
        : 'progress',
    active: (batch.activeIds || []).length,
    queued,
    completed: summary.succeeded,
    failed: summary.failed,
    total: summary.total,
  };
}

export function appendPublishBatchResourceSample(batch, sample) {
  if (!batch || Number(sample?.schemaVersion) !== 1 || !sample.publishers || !sample.memory || !sample.processes) return batch;
  const existing = batch.telemetry?.samples || [];
  const samples = [...existing, sample].slice(-MAX_RESOURCE_TELEMETRY_SAMPLES);
  return {
    ...batch,
    telemetry: {
      samples,
      peakActivePublishers: Math.max(
        Number(batch.telemetry?.peakActivePublishers) || 0,
        Number(sample.publishers.active) || 0,
      ),
    },
  };
}

export function publishBatchResourceSummary(batch) {
  const samples = batch?.telemetry?.samples || [];
  const maximum = (path) => samples.reduce((peak, sample) => {
    const value = Number(path(sample));
    return Number.isFinite(value) ? Math.max(peak, value) : peak;
  }, 0);
  return {
    sampleCount: samples.length,
    latest: samples.at(-1) || null,
    peakActivePublishers: Number(batch?.telemetry?.peakActivePublishers) || 0,
    peakAppWorkingSetMb: maximum((sample) => sample.memory?.appWorkingSetMb),
    peakAppCpuPercent: maximum((sample) => sample.cpu?.appPercent),
  };
}

function safeMetric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function safeCount(value) {
  return Math.min(100, Math.trunc(safeMetric(value)));
}

export function sanitizePublishBatchResourceSample(sample) {
  if (Number(sample?.schemaVersion) !== 1) return null;
  const phase = RESOURCE_PHASES.has(sample.phase) ? sample.phase : 'progress';
  const timestamp = /^\d{4}-\d{2}-\d{2}T/.test(String(sample.timestamp || ''))
    ? String(sample.timestamp)
    : '';
  return {
    schemaVersion: 1,
    timestamp,
    phase,
    publishers: {
      active: safeCount(sample.publishers?.active),
      queued: safeCount(sample.publishers?.queued),
      completed: safeCount(sample.publishers?.completed),
      failed: safeCount(sample.publishers?.failed),
      total: safeCount(sample.publishers?.total),
    },
    memory: {
      mainPrivateMb: sample.memory?.mainPrivateMb == null ? null : safeMetric(sample.memory.mainPrivateMb),
      appWorkingSetMb: safeMetric(sample.memory?.appWorkingSetMb),
      appPeakWorkingSetMb: safeMetric(sample.memory?.appPeakWorkingSetMb),
    },
    cpu: { appPercent: safeMetric(sample.cpu?.appPercent) },
    processes: {
      total: safeCount(sample.processes?.total),
      renderers: safeCount(sample.processes?.renderers),
      utilities: safeCount(sample.processes?.utilities),
      gpu: safeCount(sample.processes?.gpu),
    },
  };
}

export function createPublishBatchResourceReport(batch, fallbackSample = null) {
  if (batch?.status !== 'done') return null;
  const rawSamples = batch.telemetry?.samples?.length
    ? batch.telemetry.samples
    : fallbackSample ? [fallbackSample] : [];
  const samples = rawSamples.map(sanitizePublishBatchResourceSample).filter(Boolean).slice(-MAX_RESOURCE_TELEMETRY_SAMPLES);
  if (!samples.length) return null;
  const summary = publishBatchSummary(batch);
  const resources = publishBatchResourceSummary({
    ...batch,
    telemetry: { ...batch.telemetry, samples },
  });
  return {
    schemaVersion: 1,
    completedAt: samples.at(-1).timestamp,
    batch: {
      status: 'complete',
      total: summary.total,
      succeeded: summary.succeeded,
      failed: summary.failed,
      concurrency: safeCount(batch.concurrency || 1),
    },
    peaks: {
      activePublishers: safeCount(resources.peakActivePublishers),
      appWorkingSetMb: safeMetric(resources.peakAppWorkingSetMb),
      appCpuPercent: safeMetric(resources.peakAppCpuPercent),
    },
    samples,
  };
}

function sanitizePublishBatchResourceReport(report) {
  if (Number(report?.schemaVersion) !== 1 || report?.batch?.status !== 'complete') return null;
  const samples = (Array.isArray(report.samples) ? report.samples : [])
    .map(sanitizePublishBatchResourceSample)
    .filter(Boolean)
    .slice(-MAX_RESOURCE_TELEMETRY_SAMPLES);
  if (!samples.length) return null;
  const completedAt = /^\d{4}-\d{2}-\d{2}T/.test(String(report.completedAt || ''))
    ? String(report.completedAt)
    : samples.at(-1).timestamp;
  return {
    schemaVersion: 1,
    completedAt,
    batch: {
      status: 'complete',
      total: safeCount(report.batch.total),
      succeeded: safeCount(report.batch.succeeded),
      failed: safeCount(report.batch.failed),
      concurrency: safeCount(report.batch.concurrency || 1),
    },
    peaks: {
      activePublishers: safeCount(report.peaks?.activePublishers),
      appWorkingSetMb: safeMetric(report.peaks?.appWorkingSetMb),
      appCpuPercent: safeMetric(report.peaks?.appCpuPercent),
    },
    samples,
  };
}

export function retainPublishBatchResourceReport(storage, report, limit = RESOURCE_REPORT_LIMIT) {
  const sanitized = sanitizePublishBatchResourceReport(report);
  if (!storage || !sanitized) return [];
  const existing = loadRetainedPublishBatchResourceReports(storage);
  const retained = [sanitized, ...existing.filter((item) => item.completedAt !== sanitized.completedAt)]
    .slice(0, Math.max(1, Math.min(50, safeCount(limit) || RESOURCE_REPORT_LIMIT)));
  storage.setItem(RESOURCE_REPORT_STORAGE_KEY, JSON.stringify(retained));
  return retained;
}

export function loadRetainedPublishBatchResourceReports(storage) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(RESOURCE_REPORT_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(sanitizePublishBatchResourceReport).filter(Boolean) : [];
  } catch {
    return [];
  }
}
