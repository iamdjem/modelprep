const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  computeSchedulerActions, hasPendingUnattended, createReleaseScheduler, mergeSyncedPlans, markPlan,
} = require('./release-scheduler');

const NOW = Date.parse('2026-08-04T12:00:00Z');
const plan = (over = {}) => ({
  id: 'p1', projectTitle: 'Desk Dragon', platformId: 'cults', platformName: 'Cults3D',
  mode: 'remind', dueAt: '2026-08-04T11:00:00Z', status: 'pending', ...over,
});

test('packaged desktop allowlist includes the release scheduler', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(pkg.build.files.includes('release-scheduler.js'));
});

test('separates due reminders from due unattended publishes', () => {
  const plans = [
    plan({ id: 'r', mode: 'remind' }),
    plan({ id: 's', mode: 'scheduled', unattended: true }),
    plan({ id: 'future', mode: 'scheduled', unattended: true, dueAt: '2026-09-01T00:00:00Z' }),
    plan({ id: 'sched-attended', mode: 'scheduled' }), // not unattended → just a reminder
    plan({ id: 'done', status: 'done' }),
  ];
  const { reminders, unattended } = computeSchedulerActions(plans, NOW);
  assert.deepEqual(reminders.map((p) => p.id).sort(), ['r', 'sched-attended']);
  assert.deepEqual(unattended.map((p) => p.id), ['s']);
});

test('never re-notifies or re-fires a plan main already handled', () => {
  const plans = [
    plan({ id: 'r', notifiedByMain: NOW - 1000 }),
    plan({ id: 's', mode: 'scheduled', unattended: true, firedByMain: NOW - 1000 }),
  ];
  const { reminders, unattended } = computeSchedulerActions(plans, NOW);
  assert.equal(reminders.length, 0);
  assert.equal(unattended.length, 0);
});

test('hasPendingUnattended keeps the app alive only while work remains', () => {
  assert.equal(hasPendingUnattended([plan({ mode: 'scheduled', unattended: true })], NOW), true);
  assert.equal(hasPendingUnattended([plan({ mode: 'scheduled', unattended: true, firedByMain: NOW })], NOW), false);
  assert.equal(hasPendingUnattended([plan({ mode: 'remind' })], NOW), false);
  assert.equal(hasPendingUnattended([], NOW), false);
});

test('tick notifies, opens a window for unattended, and persists marks', () => {
  const notified = [];
  const opened = [];
  let stored = [
    plan({ id: 'r', mode: 'remind' }),
    plan({ id: 's', mode: 'scheduled', unattended: true }),
  ];
  const scheduler = createReleaseScheduler({
    getPlans: () => stored,
    savePlans: (next) => { stored = next; },
    notify: (p) => notified.push(p.id),
    openWindowForPublish: (p) => opened.push(p.id),
    now: () => NOW,
  });
  const result = scheduler.tick();
  assert.deepEqual(result, { reminders: 1, unattended: 1 });
  assert.deepEqual(notified.sort(), ['r', 's']);
  assert.deepEqual(opened, ['s']);
  // second tick is a no-op: marks were persisted
  assert.deepEqual(scheduler.tick(), { reminders: 0, unattended: 0 });
  assert.ok(stored.find((p) => p.id === 's').firedByMain);
  assert.ok(stored.find((p) => p.id === 'r').notifiedByMain);
});

test('mergeSyncedPlans preserves main marks across a renderer sync', () => {
  const previous = [plan({ id: 'p1', notifiedByMain: 111, firedByMain: 222 })];
  const incoming = [plan({ id: 'p1', note: 'edited' }), plan({ id: 'p2' })];
  const merged = mergeSyncedPlans(previous, incoming);
  assert.equal(merged[0].note, 'edited');
  assert.equal(merged[0].notifiedByMain, 111);
  assert.equal(merged[0].firedByMain, 222);
  assert.equal(merged[1].notifiedByMain, undefined);
});

test('markPlan updates only the target', () => {
  const plans = [plan({ id: 'a' }), plan({ id: 'b' })];
  const next = markPlan(plans, 'b', { firedByMain: 5 });
  assert.equal(next.find((p) => p.id === 'a').firedByMain, undefined);
  assert.equal(next.find((p) => p.id === 'b').firedByMain, 5);
});
