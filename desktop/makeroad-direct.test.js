const assert = require('node:assert/strict');
const test = require('node:test');
const { buildSubmitPayload, cookieValue, createMakerRoadDirectClient, validateSubmit, validateUpload } = require('./makeroad-direct');

const base = {
  action: 'save', uploadType: 1, models: [{ id: 'm1', size: 10 }], profiles: [],
  images: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }], documents: [],
  title: 'Desk dragon', description: '<p>Printable dragon</p>', categoryIds: ['7'], tags: ['dragon'],
  printMethods: ['FDM'], printerIds: [], materialIds: [], colorIds: [], visibility: 'private', payType: 'free',
};

test('MakerRoad cookie parser finds the login token without using unrelated cookies', () => {
  assert.equal(cookieValue('a=1; X-Token=secure-token; b=2', 'X-Token'), 'secure-token');
  assert.equal(cookieValue('a=1', 'X-Token'), '');
});

test('MakerRoad validates exact file roles and limits', () => {
  assert.doesNotThrow(() => validateUpload('model', { name: 'part.3mf', bytes: Buffer.alloc(1) }));
  assert.throws(() => validateUpload('model', { name: 'part.step', bytes: Buffer.alloc(1) }), /does not accept/i);
  assert.throws(() => validateUpload('image', { name: 'hero.jpg', bytes: Buffer.alloc(10 * 1024 * 1024 + 1) }), /10 MB/i);
  assert.match(validateSubmit({ ...base, images: [{ id: 'one' }] }).join(' '), /3 to 10 images/i);
});

test('MakerRoad builds the captured pipe-delimited create payload', () => {
  const payload = buildSubmitPayload({ ...base, models: [{ id: 'm1' }, { fileId: 'm2' }], uploadType: 2, referUrl: 'https://example.com/original', shareEdit: 2 });
  assert.equal(payload.fileModel, 'm1|m2');
  assert.equal(payload.pics, 'i1|i2|i3');
  assert.equal(payload.original, 1);
  assert.equal(payload.referUrl, 'https://example.com/original');
  assert.equal(payload.visible, 2);
  assert.equal(payload.plan, 1);
  assert.equal(payload.payType, 1);
  assert.equal(payload.payValue, '');
  assert.equal(payload.printType, 'FDM');
  assert.equal(payload.descTag, '#{dragon}');
  assert.equal(payload.action, 'save');
});

test('MakerRoad payload uses the current native visibility, schedule, price and license enums', () => {
  const payload = buildSubmitPayload({
    ...base,
    visibility: 'public', scheduled: true, planTime: '2026-08-03T10:30',
    payType: 'points', payValue: 25, shareNosign: 1, shareEdit: 3, shareBusiness: 1,
  });
  assert.equal(payload.original, 2);
  assert.equal(payload.visible, 1);
  assert.equal(payload.plan, 2);
  assert.equal(payload.planTime, '2026-08-03T10:30');
  assert.equal(payload.payType, 2);
  assert.equal(payload.payValue, 25);
  assert.equal(payload.shareNosign, 1);
  assert.equal(payload.shareEdit, 3);
  assert.equal(payload.shareBusiness, 1);
});

test('MakerRoad direct client uploads, saves, and reads back through allow-listed routes', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push([String(url), init.method || 'GET']);
    if (String(url).includes('/upload/webuploader')) return new Response(JSON.stringify({ code: 0, data: { id: 91 } }), { status: 200 });
    if (String(url).includes('/models/info')) return new Response(JSON.stringify({ code: 0, data: { id: 42 } }), { status: 200 });
    if (String(url).includes('/models/getEdit')) return new Response(JSON.stringify({ code: 0, data: { id: 42, visible: 2 } }), { status: 200 });
    return new Response(JSON.stringify({ code: 0, data: [{ id: 7 }] }), { status: 200 });
  };
  const client = createMakerRoadDirectClient({ fetchImpl });
  const context = { cookie: 'session=opaque' };
  const uploaded = await client.upload(context, 'model', { name: 'part.stl', mimeType: 'model/stl', bytes: Buffer.from('solid') });
  const saved = await client.save(context, { ...base, models: [uploaded] });
  const readback = await client.status(context, saved.id);
  assert.equal(uploaded.id, '91');
  assert.equal(saved.id, '42');
  assert.equal(readback.visible, 2);
  assert.deepEqual(calls.map(([url, method]) => [new URL(url).pathname, method]), [
    ['/api/upload/webuploader', 'POST'], ['/api/models/info', 'POST'], ['/api/models/getEdit', 'GET'],
  ]);
  assert.equal(new URL(calls.at(-1)[0]).search, '?id=42&uploadType=1');
});

test('MakerRoad metadata keeps categories when an optional settings endpoint fails', async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/api/settings/tag')) return new Response(JSON.stringify({ message: 'temporary failure' }), { status: 500 });
    const name = String(url).split('/').pop();
    return new Response(JSON.stringify({ code: 0, data: name === 'modelsClassify' ? [{ id: 7, name: 'Toys' }] : [{ id: name }] }), { status: 200 });
  };
  const client = createMakerRoadDirectClient({ fetchImpl });
  const metadata = await client.metadata({ cookie: 'session=opaque' });
  assert.deepEqual(metadata.modelsClassify, [{ id: 7, name: 'Toys' }]);
  assert.deepEqual(metadata.tag, []);
  assert.deepEqual(metadata.material, [{ id: 'material' }]);
});

test('MakerRoad mirrors X-Token and validates the authenticated user endpoint', async () => {
  const calls = [];
  const client = createMakerRoadDirectClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ code: 200, data: { id: 42, nickname: 'maker' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  const identity = await client.whoami({ cookie: 'session=present; X-Token=secure-token' });
  assert.equal(identity.id, '42');
  assert.equal(identity.nickname, 'maker');
  assert.equal(calls[0].url, 'https://www.makeroad.com/api/user');
  assert.equal(calls[0].options.headers['X-Token'], 'secure-token');
});

test('MakerRoad rejects cookie-only false positive sessions', async () => {
  const client = createMakerRoadDirectClient({ fetchImpl: async () => { throw new Error('must not fetch'); } });
  await assert.rejects(() => client.whoami({ cookie: 'public-cookie=present' }), /login token is missing/i);
});
