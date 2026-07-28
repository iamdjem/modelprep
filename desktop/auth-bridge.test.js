const assert = require('node:assert/strict');
const test = require('node:test');
const { validateWorkerUrl } = require('./auth-bridge');

const WORKER = 'https://modelprep-backend.iamdjem.workers.dev';

test('desktop auth broker allows only MakerWorld routes on the configured Worker', () => {
  assert.equal(
    validateWorkerUrl(`${WORKER}/api/v1/makerworld/web/check`, WORKER),
    `${WORKER}/api/v1/makerworld/web/check`,
  );
  assert.throws(
    () => validateWorkerUrl('https://evil.example/api/v1/makerworld/web/check', WORKER),
    /untrusted/i,
  );
  assert.throws(
    () => validateWorkerUrl(`${WORKER}/api/v1/cults3d/web/my-creations`, WORKER),
    /untrusted/i,
  );
});

test('desktop auth broker isolates Printables requests to its route prefix', () => {
  assert.equal(
    validateWorkerUrl(`${WORKER}/api/v1/printables/web/check`, WORKER, 'printables'),
    `${WORKER}/api/v1/printables/web/check`,
  );
  assert.throws(
    () => validateWorkerUrl(`${WORKER}/api/v1/makerworld/web/check`, WORKER, 'printables'),
    /untrusted desktop printables/i,
  );
  assert.throws(
    () => validateWorkerUrl('https://api.printables.com/graphql/', WORKER, 'printables'),
    /untrusted desktop printables/i,
  );
});
