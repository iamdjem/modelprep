const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeThingiverseExchange, normalizeThingiversePageCapture, resolveThingiverseSessionCandidates } = require('./thingiverse-session-capture');

test('Thingiverse exchange normalization keeps the two token roles separate', () => {
  assert.deepEqual(normalizeThingiverseExchange({ token: 'api', jwt: { access: 'jwt' } }, 'PHPSESSID=x'), {
    apiToken: 'api', accessToken: 'jwt', cookie: 'PHPSESSID=x',
  });
  assert.equal(normalizeThingiverseExchange({ token: 'api', jwt: {} }), null);
});

test('Thingiverse page capture binds fresh tokens to the browser-proven identity', () => {
  assert.deepEqual(normalizeThingiversePageCapture({
    exchange: { token: 'api', jwt: { access: 'jwt' } },
    identity: { data: { id: 42, name: 'iamdjem' } },
  }, 'PHPSESSID=x'), {
    context: { apiToken: 'api', accessToken: 'jwt', cookie: 'PHPSESSID=x' },
    identity: { id: '42', nickname: 'iamdjem', legalApproved: true },
  });
});

test('Thingiverse recovery is lazy once the fresh cookie exchange validates', async () => {
  let staleStorageReads = 0;
  const resolved = await resolveThingiverseSessionCandidates([
    async () => ({ apiToken: 'fresh-api', accessToken: 'fresh-jwt' }),
    async () => { staleStorageReads += 1; return { apiToken: 'stale-api', accessToken: 'stale-jwt' }; },
  ], async (context) => context.apiToken === 'fresh-api' ? { id: '7', nickname: 'Maker' } : null);
  assert.equal(resolved.context.apiToken, 'fresh-api');
  assert.equal(resolved.identity.id, '7');
  assert.equal(staleStorageReads, 0);
});

test('Thingiverse recovery skips rejected and failed candidates in order', async () => {
  const calls = [];
  const resolved = await resolveThingiverseSessionCandidates([
    async () => { calls.push('exchange'); throw new Error('no cookies'); },
    async () => { calls.push('storage'); return { apiToken: 'stale', accessToken: 'stale' }; },
    async () => { calls.push('encrypted'); return { apiToken: 'valid', accessToken: 'valid' }; },
  ], async (context) => context.apiToken === 'valid' ? { id: '8' } : null);
  assert.deepEqual(calls, ['exchange', 'storage', 'encrypted']);
  assert.equal(resolved.context.apiToken, 'valid');
});

test('Thingiverse recovery accepts a same-page identity proof without a second network stack', async () => {
  let externalValidations = 0;
  const captured = {
    context: { apiToken: 'fresh-api', accessToken: 'fresh-jwt' },
    identity: { id: '42', nickname: 'iamdjem', legalApproved: true },
  };
  const resolved = await resolveThingiverseSessionCandidates([
    async () => captured,
  ], async () => { externalValidations += 1; return null; });
  assert.deepEqual(resolved, captured);
  assert.equal(externalValidations, 0);
});
