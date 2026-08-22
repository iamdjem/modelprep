'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readBackgroundPrefs, shouldStartHidden, keepAliveSchedule, keepAliveSummary, trayMenuModel, launchAgentPlist, LAUNCH_AGENT_LABEL } = require('./background-mode');

test('background mode is on unless the user turned it off', () => {
  assert.deepEqual(readBackgroundPrefs(null), { enabled: true });
  assert.deepEqual(readBackgroundPrefs('{not json'), { enabled: true });
  assert.deepEqual(readBackgroundPrefs('{"enabled":false}'), { enabled: false });
  assert.deepEqual(readBackgroundPrefs({ enabled: true }), { enabled: true });
});

test('a hidden start needs background mode and a hidden launch', () => {
  assert.equal(shouldStartHidden({ argv: ['--hidden'], enabled: true }), true);
  assert.equal(shouldStartHidden({ loginItem: { wasOpenedAsHidden: true }, enabled: true }), true);
  assert.equal(shouldStartHidden({ loginItem: { wasOpenedAsHidden: true }, enabled: false }), false);
  assert.equal(shouldStartHidden({ argv: [], loginItem: {}, enabled: true }), false);
});

test('the background cadence is tighter and starts sooner when hidden', () => {
  assert.deepEqual(keepAliveSchedule({ enabled: false }), { intervalMs: 6 * 3600000, initialDelayMs: 600000 });
  assert.deepEqual(keepAliveSchedule({ enabled: true, hidden: false }), { intervalMs: 4 * 3600000, initialDelayMs: 600000 });
  assert.deepEqual(keepAliveSchedule({ enabled: true, hidden: true }), { intervalMs: 4 * 3600000, initialDelayMs: 60000 });
});

test('the menu bar line says when and how many', () => {
  const now = 10 * 3600000;
  assert.equal(keepAliveSummary(new Map(), now), 'Sessions not refreshed yet');
  const results = new Map([['mmf', { at: now - 2 * 3600000, ok: true }], ['makeroad', { at: now - 3 * 3600000, ok: false }]]);
  assert.equal(keepAliveSummary(results, now), 'Sessions refreshed 2 h ago · 1 of 2 ok');
});

test('the tray menu reflects state', () => {
  const items = trayMenuModel({ results: new Map(), enabled: false, running: true });
  assert.equal(items.find((i) => i.id === 'status').label, 'Refreshing sessions…');
  assert.equal(items.find((i) => i.id === 'refresh').enabled, false);
  assert.equal(items.find((i) => i.id === 'toggle').checked, false);
  assert.equal(items.at(-1).id, 'quit');
});

test('the launch agent opens the app hidden at login and nothing else', () => {
  const plist = launchAgentPlist({ execPath: '/Applications/Model & Prep.app/Contents/MacOS/ModelPrep' });
  assert.match(plist, new RegExp(`<key>Label</key><string>${LAUNCH_AGENT_LABEL}</string>`));
  assert.match(plist, /<string>\/Applications\/Model &amp; Prep\.app\/Contents\/MacOS\/ModelPrep<\/string>\s*<string>--hidden<\/string>/);
  assert.match(plist, /<key>RunAtLoad<\/key><true\/>/);
  assert.match(plist, /<key>KeepAlive<\/key><false\/>/);
  assert.throws(() => launchAgentPlist({}), /execPath/);
});
