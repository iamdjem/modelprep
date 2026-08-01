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

test('desktop auth broker isolates Cults3D requests to its route prefix', () => {
  assert.equal(
    validateWorkerUrl(`${WORKER}/api/v1/cults3d/web/publish`, WORKER, 'cults3d'),
    `${WORKER}/api/v1/cults3d/web/publish`,
  );
  assert.throws(
    () => validateWorkerUrl(`${WORKER}/api/v1/printables/web/check`, WORKER, 'cults3d'),
    /untrusted desktop cults3d/i,
  );
  assert.throws(
    () => validateWorkerUrl('https://cults3d.com/en/creations', WORKER, 'cults3d'),
    /untrusted desktop cults3d/i,
  );
});

test('desktop auth broker isolates Nexprint requests to its route prefix', () => {
  assert.equal(
    validateWorkerUrl(`${WORKER}/api/v1/nexprint/web/whoami`, WORKER, 'nexprint'),
    `${WORKER}/api/v1/nexprint/web/whoami`,
  );
  assert.throws(
    () => validateWorkerUrl(`${WORKER}/api/v1/makerworld/web/check`, WORKER, 'nexprint'),
    /untrusted desktop nexprint/i,
  );
  assert.throws(
    () => validateWorkerUrl('https://www.nexprint.com/gateway/api/v1/model-user-server/member/user_data', WORKER, 'nexprint'),
    /untrusted desktop nexprint/i,
  );
});

test('desktop auth broker isolates Creality requests to its route prefix', () => {
  assert.equal(
    validateWorkerUrl(`${WORKER}/api/v1/creality/web/whoami`, WORKER, 'creality'),
    `${WORKER}/api/v1/creality/web/whoami`,
  );
  assert.throws(
    () => validateWorkerUrl(`${WORKER}/api/v1/nexprint/web/whoami`, WORKER, 'creality'),
    /untrusted desktop creality/i,
  );
  assert.throws(
    () => validateWorkerUrl('https://www.crealitycloud.com/api/cxy/v3/user/getInfo', WORKER, 'creality'),
    /untrusted desktop creality/i,
  );
});

test('desktop auth broker isolates MakerOnline requests to its route prefix', () => {
  assert.equal(
    validateWorkerUrl(`${WORKER}/api/v1/makeronline/web/whoami`, WORKER, 'makeronline'),
    `${WORKER}/api/v1/makeronline/web/whoami`,
  );
  assert.throws(
    () => validateWorkerUrl(`${WORKER}/api/v1/creality/web/whoami`, WORKER, 'makeronline'),
    /untrusted desktop makeronline/i,
  );
  assert.throws(
    () => validateWorkerUrl('https://www.makeronline.com/api/mold/create', WORKER, 'makeronline'),
    /untrusted desktop makeronline/i,
  );
});

test('desktop auth broker isolates MyMiniFactory requests to its route prefix', () => {
  assert.equal(
    validateWorkerUrl(`${WORKER}/api/v1/myminifactory/web/whoami`, WORKER, 'myminifactory'),
    `${WORKER}/api/v1/myminifactory/web/whoami`,
  );
  assert.throws(
    () => validateWorkerUrl(`${WORKER}/api/v1/makeronline/web/whoami`, WORKER, 'myminifactory'),
    /untrusted desktop myminifactory/i,
  );
  assert.throws(
    () => validateWorkerUrl('https://www.myminifactory.com/upload/object', WORKER, 'myminifactory'),
    /untrusted desktop myminifactory/i,
  );
});

for (const platform of ['makeroad', 'thangs', 'thingiverse']) {
  test(`desktop auth broker isolates ${platform} requests to its route prefix`, () => {
    const worker = 'https://worker.example';
    assert.equal(validateWorkerUrl(`${worker}/api/v1/${platform}/web/upload`, worker, platform), `${worker}/api/v1/${platform}/web/upload`);
    assert.throws(() => validateWorkerUrl(`${worker}/api/v1/makerworld/web/upload`, worker, platform), /untrusted/);
  });
}
