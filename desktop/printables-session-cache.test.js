const test = require('node:test');
const assert = require('node:assert/strict');
const { createPrintablesSessionCache } = require('./printables-session-cache');

test('Printables session validation is reused within the TTL and refreshed afterwards', async () => {
  let current = 1_000;
  let calls = 0;
  const cache = createPrintablesSessionCache({ ttlMs: 100, now: () => current });
  const validator = async () => {
    calls += 1;
    return { id: '3163385', handle: 'iamdjem' };
  };

  assert.equal((await cache.validate('cookie-a', validator)).handle, 'iamdjem');
  assert.equal((await cache.validate('cookie-a', validator)).handle, 'iamdjem');
  assert.equal(calls, 1);

  current += 101;
  await cache.validate('cookie-a', validator);
  assert.equal(calls, 2);
});

test('Printables session cache invalidates explicitly and when validation fails', async () => {
  const cache = createPrintablesSessionCache();
  await cache.validate('cookie-a', async () => ({ id: '1' }));
  assert.deepEqual(cache.identityFor('cookie-a'), { id: '1' });
  cache.clear();
  assert.equal(cache.identityFor('cookie-a'), null);
  assert.equal(await cache.validate('cookie-a', async () => null, { force: true }), null);
  assert.equal(cache.identityFor('cookie-a'), null);
});
