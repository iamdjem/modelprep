const TELEMETRY_SCHEMA_VERSION = 1;
const ALLOWED_PHASES = new Set(['ready', 'start', 'progress', 'retry', 'complete']);

function boundedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(number)));
}

function megabytesFromKilobytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round((number / 1024) * 10) / 10;
}

function roundedPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 10) / 10;
}

function safePhase(value) {
  const phase = String(value || '').toLowerCase();
  return ALLOWED_PHASES.has(phase) ? phase : 'progress';
}

function aggregateAppMetrics(metrics = []) {
  const valid = Array.isArray(metrics) ? metrics : [];
  const totals = valid.reduce((result, metric) => {
    const workingSet = Number(metric?.memory?.workingSetSize);
    const peakWorkingSet = Number(metric?.memory?.peakWorkingSetSize);
    const cpu = Number(metric?.cpu?.percentCPUUsage);
    if (Number.isFinite(workingSet) && workingSet >= 0) result.workingSetKb += workingSet;
    if (Number.isFinite(peakWorkingSet) && peakWorkingSet >= 0) result.peakWorkingSetKb += peakWorkingSet;
    if (Number.isFinite(cpu) && cpu >= 0) result.cpuPercent += cpu;
    if (metric?.type === 'Tab') result.renderers += 1;
    if (metric?.type === 'Utility') result.utilities += 1;
    if (metric?.type === 'GPU') result.gpu += 1;
    return result;
  }, { workingSetKb: 0, peakWorkingSetKb: 0, cpuPercent: 0, renderers: 0, utilities: 0, gpu: 0 });

  return {
    memory: {
      appWorkingSetMb: megabytesFromKilobytes(totals.workingSetKb),
      appPeakWorkingSetMb: megabytesFromKilobytes(totals.peakWorkingSetKb),
    },
    cpu: { appPercent: roundedPercent(totals.cpuPercent) },
    processes: {
      total: valid.length,
      renderers: totals.renderers,
      utilities: totals.utilities,
      gpu: totals.gpu,
    },
  };
}

async function captureResourceTelemetry({ electronApp, electronProcess, state = {}, now = () => new Date() }) {
  let mainMemory = null;
  try {
    mainMemory = await electronProcess?.getProcessMemoryInfo?.();
  } catch {
    mainMemory = null;
  }

  let appMetrics = [];
  try {
    appMetrics = electronApp?.getAppMetrics?.() || [];
  } catch {
    appMetrics = [];
  }

  const aggregate = aggregateAppMetrics(appMetrics);
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    timestamp: now().toISOString(),
    phase: safePhase(state.phase),
    publishers: {
      active: boundedCount(state.active),
      queued: boundedCount(state.queued),
      completed: boundedCount(state.completed),
      failed: boundedCount(state.failed),
      total: boundedCount(state.total),
    },
    memory: {
      mainPrivateMb: megabytesFromKilobytes(mainMemory?.private),
      ...aggregate.memory,
    },
    cpu: aggregate.cpu,
    processes: aggregate.processes,
  };
}

function resourceTelemetryLogLine(sample) {
  return `[modelprep-resource] ${JSON.stringify(sample)}`;
}

module.exports = {
  TELEMETRY_SCHEMA_VERSION,
  aggregateAppMetrics,
  captureResourceTelemetry,
  resourceTelemetryLogLine,
};
