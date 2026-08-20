'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createSessionKeepAlive } = require('./session-keepalive.js');

test('refreshes only platforms with stored session material', async () => {
  const refreshed = [];
  const keepAlive = createSessionKeepAlive({
    platforms: ['printables', 'mmf', 'makeroad', 'thangs'],
    hasSession: async (platform) => platform !== 'thangs',
    refresh: async (platform) => { refreshed.push(platform); return true; },
    now: () => 1000,
  });
  const results = await keepAlive.tick();
  assert.deepStrictEqual(refreshed, ['printables', 'mmf', 'makeroad']);
  assert.strictEqual(results.get('printables').ok, true);
  assert.strictEqual(results.has('thangs'), false);
});

test('a failed or throwing refresh is recorded and never propagates', async () => {
  const keepAlive = createSessionKeepAlive({
    platforms: ['printables', 'mmf'],
    hasSession: async () => true,
    refresh: async (platform) => {
      if (platform === 'printables') throw new Error('network down');
      return false;
    },
    now: () => 42,
  });
  const results = await keepAlive.tick();
  assert.deepStrictEqual(results.get('printables'), { at: 42, ok: false });
  assert.deepStrictEqual(results.get('mmf'), { at: 42, ok: false });
});

test('a throwing hasSession check skips the platform silently', async () => {
  let refreshCalls = 0;
  const keepAlive = createSessionKeepAlive({
    platforms: ['makeroad'],
    hasSession: async () => { throw new Error('storage unavailable'); },
    refresh: async () => { refreshCalls += 1; return true; },
  });
  const results = await keepAlive.tick();
  assert.strictEqual(refreshCalls, 0);
  assert.strictEqual(results.size, 0);
});

test('platforms refresh sequentially, never in parallel', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const keepAlive = createSessionKeepAlive({
    platforms: ['a', 'b', 'c'],
    hasSession: async () => true,
    refresh: async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return true;
    },
  });
  await keepAlive.tick();
  assert.strictEqual(maxInFlight, 1);
});

test('an overlapping tick is a no-op while the previous pass runs', async () => {
  let refreshCalls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const keepAlive = createSessionKeepAlive({
    platforms: ['a'],
    hasSession: async () => true,
    refresh: async () => { refreshCalls += 1; await gate; return true; },
  });
  const first = keepAlive.tick();
  const second = keepAlive.tick(); // must not start a second pass
  release();
  await Promise.all([first, second]);
  assert.strictEqual(refreshCalls, 1);
});

test('start is idempotent and stop clears both timers', () => {
  const keepAlive = createSessionKeepAlive({
    platforms: [],
    hasSession: async () => false,
    refresh: async () => true,
    initialDelayMs: 60_000,
    intervalMs: 120_000,
  });
  keepAlive.start();
  keepAlive.start();
  keepAlive.stop();
  keepAlive.stop();
});

test('requires the effect functions', () => {
  assert.throws(() => createSessionKeepAlive({ platforms: [] }), /hasSession and refresh/);
});

test('packaged desktop allowlist includes the session keep-alive module', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(packageJson.build.files.includes('session-keepalive.js'));
});
