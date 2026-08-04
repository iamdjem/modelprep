const assert = require('node:assert/strict');
const test = require('node:test');
const { cultsChromiumUserAgent, isCultsChallengePage } = require('./cults-browser-profile');

test('Cults browser UA matches the exact Chromium engine instead of a hard-coded future Chrome', () => {
  const ua = cultsChromiumUserAgent('150.0.7871.129');
  assert.match(ua, /Chrome\/150\.0\.7871\.129/);
  assert.doesNotMatch(ua, /Electron|Chrome\/149\.0\.0\.0/);
});

test('Cults challenge pages are recognized before background session validation', () => {
  assert.equal(isCultsChallengePage({ title: 'Just a moment...' }), true);
  assert.equal(isCultsChallengePage({ title: 'Cults - Sign in', url: 'https://cults3d.com/en/users/sign-in' }), false);
  assert.equal(isCultsChallengePage({ url: 'https://cults3d.com/cdn-cgi/challenge-platform/h/g/orchestrate' }), true);
});
