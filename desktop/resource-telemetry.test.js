const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  TELEMETRY_SCHEMA_VERSION,
  captureResourceTelemetry,
  resourceTelemetryLogLine,
} = require('./resource-telemetry');

test('packaged desktop allowlist includes the resource telemetry module', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(packageJson.build.files.includes('resource-telemetry.js'));
});

test('resource telemetry returns bounded aggregate metrics without renderer payload data', async () => {
  const sample = await captureResourceTelemetry({
    electronApp: {
      getAppMetrics: () => [
        { type: 'Browser', memory: { workingSetSize: 102400, peakWorkingSetSize: 122880 }, cpu: { percentCPUUsage: 4.24 } },
        { type: 'Tab', memory: { workingSetSize: 51200, peakWorkingSetSize: 61440 }, cpu: { percentCPUUsage: 8.89 } },
        { type: 'GPU', memory: { workingSetSize: 25600, peakWorkingSetSize: 30720 }, cpu: { percentCPUUsage: 1 } },
      ],
    },
    electronProcess: {
      getProcessMemoryInfo: async () => ({ private: 40960, shared: 1024, residentSet: 0 }),
    },
    state: {
      phase: 'start', active: 4, queued: 6, completed: 0, failed: 0, total: 10,
      token: 'must-not-cross-telemetry-boundary',
      platformIds: ['makerworld'],
    },
    now: () => new Date('2026-08-01T20:00:00.000Z'),
  });

  assert.deepEqual(sample, {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    timestamp: '2026-08-01T20:00:00.000Z',
    phase: 'start',
    publishers: { active: 4, queued: 6, completed: 0, failed: 0, total: 10 },
    memory: { mainPrivateMb: 40, appWorkingSetMb: 175, appPeakWorkingSetMb: 210 },
    cpu: { appPercent: 14.1 },
    processes: { total: 3, renderers: 1, utilities: 0, gpu: 1 },
  });
  assert.equal(JSON.stringify(sample).includes('must-not-cross'), false);
  assert.equal(JSON.stringify(sample).includes('makerworld'), false);
  assert.match(resourceTelemetryLogLine(sample), /^\[modelprep-resource\] \{"schemaVersion":1,/);
});

test('resource telemetry fails closed when process metrics are unavailable', async () => {
  const sample = await captureResourceTelemetry({
    electronApp: { getAppMetrics: () => { throw new Error('metrics unavailable'); } },
    electronProcess: { getProcessMemoryInfo: async () => { throw new Error('memory unavailable'); } },
    state: { phase: 'unexpected', active: -5, queued: 999, total: 'invalid' },
    now: () => new Date('2026-08-01T20:00:00.000Z'),
  });

  assert.equal(sample.phase, 'progress');
  assert.deepEqual(sample.publishers, { active: 0, queued: 100, completed: 0, failed: 0, total: 0 });
  assert.deepEqual(sample.memory, { mainPrivateMb: null, appWorkingSetMb: 0, appPeakWorkingSetMb: 0 });
  assert.deepEqual(sample.processes, { total: 0, renderers: 0, utilities: 0, gpu: 0 });
});
