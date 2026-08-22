'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sessionCookieLiveness, isDefiniteSignOut } = require('./session-liveness');

const NOW = Date.parse('2026-08-21T17:00:00Z');
const sec = (iso) => Date.parse(iso) / 1000;

test('a live MyMiniFactory PHPSESSID means signed in, whatever the network said', () => {
  const cookies = [
    { domain: '.myminifactory.com', name: 'PHPSESSID', value: 'abc', expirationDate: sec('2026-08-28T15:09:38Z') },
    { domain: '.myminifactory.com', name: '_ga', value: 'x', expirationDate: sec('2027-09-25T00:00:00Z') },
  ];
  assert.deepEqual(sessionCookieLiveness(cookies, 'mmf', NOW), { alive: true, cookie: 'PHPSESSID', expiresAt: Date.parse('2026-08-28T15:09:38Z') });
});

test('an expired or empty session cookie means signed out', () => {
  assert.equal(sessionCookieLiveness([{ domain: 'www.makeroad.com', name: 'X-Token', value: 't', expirationDate: sec('2026-08-01T00:00:00Z') }], 'makeroad', NOW).alive, false);
  assert.equal(sessionCookieLiveness([{ domain: 'www.makeroad.com', name: 'X-Token', value: '', expirationDate: sec('2026-09-01T00:00:00Z') }], 'makeroad', NOW).alive, false);
  assert.equal(sessionCookieLiveness([], 'cults', NOW).alive, false);
});

test('analytics cookies on the domain do not count, and other domains never do', () => {
  const cookies = [
    { domain: '.cults3d.com', name: '_ga', value: 'x', expirationDate: sec('2027-01-01T00:00:00Z') },
    { domain: '.cults3d.com', name: 'cf_clearance', value: 'x', expirationDate: sec('2027-01-01T00:00:00Z') },
    { domain: 'evil.example', name: '_session_id', value: 'x', expirationDate: sec('2027-01-01T00:00:00Z') },
  ];
  assert.equal(sessionCookieLiveness(cookies, 'cults', NOW).alive, false);
  cookies.push({ domain: 'cults3d.com', name: '_session_id', value: 's', expirationDate: sec('2026-09-11T17:03:54Z') });
  assert.equal(sessionCookieLiveness(cookies, 'cults', NOW).alive, true);
});

test('a session cookie without an expiry lives with the partition', () => {
  assert.equal(sessionCookieLiveness([{ domain: '.makeroad.com', name: 'X-Token', value: 't' }], 'makeroad', NOW).alive, true);
});

test('platforms without a known name accept anything session-like on their domain', () => {
  assert.equal(sessionCookieLiveness([{ domain: '.thingiverse.com', name: 'auth_token', value: 'x' }], 'thingiverse', NOW).alive, true);
  assert.equal(sessionCookieLiveness([{ domain: '.thingiverse.com', name: '_ga', value: 'x' }], 'thingiverse', NOW).alive, false);
  assert.equal(sessionCookieLiveness([{ domain: '.thingiverse.com', name: 'auth_token', value: 'x' }], 'unknown-platform', NOW).alive, false);
});

test('the platform saying "signed out" is told apart from the network saying nothing', () => {
  for (const msg of ['MakerRoad session check failed: Token错误.', 'MakerRoad login token is missing.', 'Unauthorized', 'HTTP 401', 'Please log in to continue', 'session expired']) {
    assert.equal(isDefiniteSignOut(new Error(msg)), true, msg);
  }
  for (const msg of ['Redirect was cancelled', 'ECONNRESET', 'The operation timed out', 'Cloudflare challenge', 'fetch failed']) {
    assert.equal(isDefiniteSignOut(new Error(msg)), false, msg);
  }
  assert.equal(isDefiniteSignOut(Object.assign(new Error('request failed'), { status: 401 })), true);
  assert.equal(isDefiniteSignOut(Object.assign(new Error('request failed'), { status: 500 })), false);
});
