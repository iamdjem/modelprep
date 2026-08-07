const assert = require('node:assert/strict'); const test = require('node:test');
const { buildModelPayload, createThangsDirectClient, extractCreatedModelId, findLicenseReadback, validateUpload } = require('./thangs-direct');
const input = { name: 'Dragon', structure: 'single', units: 'mm', parts: [{ name: 'dragon.stl', uploadedName: 'u/dragon.stl', size: 5, primary: true }], images: [], references: [], isPublic: false };
test('Thangs validates filenames, formats and hard size thresholds', () => { assert.throws(() => validateUpload('model', { name: 'bad#name.stl', bytes: Buffer.alloc(1) }), /characters/); assert.throws(() => validateUpload('model', { name: 'x.zip', bytes: Buffer.alloc(1) }), /does not accept/); });
test('Thangs payload preserves private default and uses the live part field names', () => { const [payload] = buildModelPayload(input); assert.equal(payload.isPublic, false); assert.equal(payload.modelType, 'single'); assert.deepEqual(payload.parts[0], { originalFileName: 'dragon.stl', originalPartName: 'dragon.stl', filename: 'u/dragon.stl', size: 5, isPrimary: true }); });
test('Thangs details use attachment objects and omit absent folder identifiers', () => {
  const [payload] = buildModelPayload({
    ...input,
    images: [{ name: 'hero.jpg', uploadedName: 'u/hero.jpg', size: 11 }],
    references: [{ name: 'notes.txt', uploadedName: 'u/notes.txt', size: 12 }],
  });
  assert.deepEqual(payload.attachments, [{ name: 'hero.jpg', filename: 'u/hero.jpg', size: 11 }]);
  assert.deepEqual(payload.referenceFiles, [{ name: 'notes.txt', filename: 'u/notes.txt', size: 12 }]);
  assert.equal(Object.hasOwn(payload, 'folderId'), false);
  assert.equal(Object.hasOwn(payload, 'workspaceId'), false);
});
test('Thangs upload uses presign, raw PUT and validation before create/readback', async () => {
  const calls = []; const response = (body) => new Response(JSON.stringify(body), { status: 200 });
  const fetchImpl = async (url, init = {}) => { calls.push([String(url), init.method || 'GET', init.body, init]); if (String(url) === 'https://storage.test/u') return new Response('', { status: 200 }); if (String(url).includes('upload-urls')) return response([{ signedUrl: 'https://storage.test/u', newFileName: 'u/dragon.stl' }]); if (String(url).endsWith('/v4/models')) return response(8); if (String(url).endsWith('/models/8/details') && (init.method || 'GET') === 'GET') return response({ draftModel: { license_path: 'CC BY-NC' } }); return response({ ok: true }); };
  const client = createThangsDirectClient({ fetchImpl, apiOrigin: 'https://api.test', now: () => new Date('2026-08-01T12:00:00.000Z') }); const context = { cookie: 'session=x', accessToken: 'access-token' };
  const part = await client.upload(context, 'model', { name: 'dragon.stl', bytes: Buffer.from('x') }); const saved = await client.save(context, { ...input, parts: [{ ...part, primary: true }] }); await client.status(context, saved.id);
  assert.equal(saved.id, '8'); assert.deepEqual(calls.slice(0, 3).map((v) => [new URL(v[0]).pathname, v[1]]), [['/models/upload-urls', 'POST'], ['/u', 'PUT'], ['/models/validatefiles', 'POST']]);
  assert.equal(calls[1][3]?.headers?.['Content-Length'], undefined);
  assert.equal(calls[1][3]?.headers?.['Content-Type'], 'application/octet-stream');
  assert.equal(calls[0][3]?.headers?.Authorization, 'Bearer access-token');
  assert.equal(calls[0][3]?.headers?.Referer, undefined);
  assert.deepEqual(JSON.parse(calls[0][2]), { fileNames: ['dragon.stl'], directory: calls[0][2].match(/modelprep-\d+/)[0], sendContentLengthRangeHeader: false });
  const draft = calls.find(([url]) => url.endsWith('/v4/models'));
  assert.deepEqual(JSON.parse(draft[2]), { name: 'dragon.stl', termsAcceptedAt: '2026-08-01T12:00:00.000Z' });
  const details = calls.find(([url]) => url.endsWith('/v4/models/8/details'));
  assert.equal(details[1], 'PUT');
  assert.deepEqual(JSON.parse(details[2]).parts[0], { originalFileName: 'dragon.stl', originalPartName: 'dragon.stl', filename: 'u/dragon.stl', size: 1, isPrimary: true });
  assert.equal(calls.some(([url]) => url.includes('/v2/models/8/license')), false);
});
test('Thangs accepts current primitive create ids plus older envelopes', () => {
  assert.equal(extractCreatedModelId('model-8'), 'model-8');
  assert.equal(extractCreatedModelId([8]), 8);
  assert.equal(extractCreatedModelId({ id: 9 }), 9);
  assert.equal(extractCreatedModelId({ ids: [{ id: 10 }] }), 10);
  assert.equal(extractCreatedModelId({}), null);
});
test('Thangs finds the persisted license in current and nested editor readbacks', () => {
  assert.equal(findLicenseReadback({ license: 'CC BY' }), 'CC BY');
  assert.equal(findLicenseReadback({ draftModel: { license_path: 'CC BY-NC' } }), 'CC BY-NC');
  assert.equal(findLicenseReadback({ draftModel: {} }), null);
});
test('Thangs resumes an existing private draft without creating a duplicate', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => { calls.push([String(url), init.method || 'GET', init.body]); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
  const client = createThangsDirectClient({ fetchImpl, apiOrigin: 'https://api.test' });
  const saved = await client.save({ accessToken: 'access-token' }, { ...input, existingId: '1583177' });
  assert.equal(saved.id, '1583177');
  assert.equal(calls.some(([url, method]) => url.endsWith('/v4/models') && method === 'POST'), false);
  assert.equal(calls[0][0], 'https://api.test/v4/models/1583177/details');
});
test('Thangs falls back to the owner model projection for license readback', async () => {
  const fetchImpl = async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === '/models/12/details') return new Response(JSON.stringify({ name: 'Dragon' }), { status: 200 });
    if (path === '/models/12/attachments') return new Response(JSON.stringify([{ filename: 'hero.jpg' }]), { status: 200 });
    if (path === '/models/12') return new Response(JSON.stringify({ license_path: 'CC BY-NC' }), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  const client = createThangsDirectClient({ fetchImpl, apiOrigin: 'https://api.test' });
  const readback = await client.status({ accessToken: 'access-token' }, '12');
  assert.equal(readback.license, 'CC BY-NC');
});
test('Thangs rejects single-part-only formats inside multipart structures', () => {
  assert.throws(() => buildModelPayload({ ...input, structure: 'multipart', parts: [{ ...input.parts[0], name: 'dragon.3mf' }] }), /single-part models/);
});
test('Thangs standalone files use the dedicated presign contract', async () => {
  const calls = []; const fetchImpl = async (url, init = {}) => { calls.push([String(url), init.method || 'GET', init.body]); if (String(url) === 'https://storage.test/s') return new Response('', { status: 200 }); return new Response(JSON.stringify([{ signedUrl: 'https://storage.test/s', newFileName: 's/readme.pdf' }]), { status: 200 }); };
  const client = createThangsDirectClient({ fetchImpl, apiOrigin: 'https://api.test' });
  await client.upload({ cookie: 'session=x', accessToken: 'access-token' }, 'standalone', { name: 'readme.pdf', bytes: Buffer.from('x') });
  assert.equal(new URL(calls[0][0]).pathname, '/standalone-files/upload-urls');
  assert.deepEqual(JSON.parse(calls[0][2]), [{ fileName: 'readme.pdf' }]);
  assert.equal(calls.some(([url]) => url.includes('validatefiles')), false);
});
test('Thangs metadata route returns the live category tree', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ categories: [{ name: 'Art & Decor', subcategories: ['All', 'Vases & Planters'] }] }), { status: 200 });
  const client = createThangsDirectClient({ fetchImpl, apiOrigin: 'https://api.test' });
  const response = await client.handleRequest({ url: 'https://worker.test/api/v1/thangs/web/meta', method: 'GET' }, { cookie: 'session=x', accessToken: 'access-token' });
  assert.deepEqual(JSON.parse(response.body).meta.categories[0].subcategories, ['All', 'Vases & Planters']);
});
test('Thangs verifies the current user through the authenticated production API contract', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push([String(url), init]);
    return new Response(JSON.stringify({ id: 5717618, username: 'iamdjem' }), { status: 200 });
  };
  const client = createThangsDirectClient({ fetchImpl, apiOrigin: 'https://api.test' });
  const identity = await client.whoami({ accessToken: 'access-token', cookie: 'refresh=x' });
  assert.deepEqual(identity, { id: '5717618', nickname: 'iamdjem', username: 'iamdjem' });
  assert.equal(calls[0][0], 'https://api.test/users/current?likes=false');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer access-token');
});
test('Thangs rejects cookie-only sessions instead of falsely reporting connected', async () => {
  const client = createThangsDirectClient({ fetchImpl: async () => new Response('{}', { status: 200 }), apiOrigin: 'https://api.test' });
  await assert.rejects(() => client.whoami({ cookie: 'refresh=x' }), /access token is missing/i);
});

// Which presign route a file takes is what decides how Thangs classifies it.
// Photos sent down the model route were stored as model files, so Thangs filed
// them as generic resources: they appeared in the editor's Attachments list and
// never in the image gallery. Its own uploader routes non-model files to
// `attachments/upload-urls`, which is what earns them attachmentType "image".
test('Thangs photos and reference files use the attachment presign route', async () => {
  for (const role of ['image', 'reference']) {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      calls.push([String(url), init.method || 'GET', init.body]);
      if (String(url) === 'https://storage.test/a') return new Response('', { status: 200 });
      return new Response(JSON.stringify([{ signedUrl: 'https://storage.test/a', newFileName: 'uploads/attachments/uuid/hero.jpg' }]), { status: 200 });
    };
    const client = createThangsDirectClient({ fetchImpl, apiOrigin: 'https://api.test' });
    const name = role === 'image' ? 'hero.jpg' : 'notes.pdf';
    const receipt = await client.upload({ cookie: 'session=x', accessToken: 'access-token' }, role, { name, bytes: Buffer.from('x') });

    assert.equal(new URL(calls[0][0]).pathname, '/attachments/upload-urls', `${role} must presign as an attachment`);
    assert.deepEqual(JSON.parse(calls[0][2]).fileNames, [name]);
    // Not model files, so the part-tree validator does not apply to them.
    assert.equal(calls.some(([url]) => url.includes('validatefiles')), false);
    assert.equal(receipt.uploadedName, 'uploads/attachments/uuid/hero.jpg');
  }
});

test('Thangs model parts and licenses stay on the model presign route', async () => {
  for (const role of ['model', 'license']) {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      calls.push([String(url), init.method || 'GET']);
      if (String(url) === 'https://storage.test/m') return new Response('', { status: 200 });
      return new Response(JSON.stringify([{ signedUrl: 'https://storage.test/m', newFileName: 'm/dragon.stl' }]), { status: 200 });
    };
    const client = createThangsDirectClient({ fetchImpl, apiOrigin: 'https://api.test' });
    const name = role === 'model' ? 'dragon.stl' : 'license.pdf';
    await client.upload({ cookie: 'session=x', accessToken: 'access-token' }, role, { name, bytes: Buffer.from('x') });
    assert.equal(new URL(calls[0][0]).pathname, '/models/upload-urls', `${role} must presign as a model file`);
  }
});

// Thangs names this field `isAiGenerated`. `aiGenerated` appears nowhere in its
// client, so the flag ModelPrep used to send was silently dropped and the model
// kept whatever the server defaulted to.
test('Thangs AI flag uses the field name Thangs actually reads', () => {
  const on = buildModelPayload({ ...input, aiGenerated: true });
  assert.equal(on[0].isAiGenerated, true);
  assert.equal('aiGenerated' in on[0], false, 'the ignored key must not be sent');

  const off = buildModelPayload({ ...input, aiGenerated: false });
  assert.equal(off[0].isAiGenerated, false);
});

// allowRemix is spelled correctly and must keep working; it is a separate flag
// from isRemix, which marks the model as a derivative.
test('Thangs remix permission stays on allowRemix', () => {
  assert.equal(buildModelPayload({ ...input, allowRemix: true })[0].allowRemix, true);
  assert.equal(buildModelPayload({ ...input, allowRemix: false })[0].allowRemix, false);
});

// Thangs stores descriptions as Markdown ("**bold**\n_italic_"), so an HTML
// conversion round-trips as literal tags in both the editor and the preview.
test('Thangs descriptions pass through as Markdown, not HTML', () => {
  const payload = buildModelPayload({ ...input, description: '**Desk Dragon**\n\nPrints in place.' });
  assert.equal(payload[0].description, '**Desk Dragon**\n\nPrints in place.');
  assert.equal(/<[a-z]+>/.test(payload[0].description), false);
});
