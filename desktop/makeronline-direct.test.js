const assert = require('node:assert/strict');
const test = require('node:test');
const {
  SCENE_BY_ROLE,
  buildSubmitPayload,
  createMakerOnlineDirectClient,
  validateUpload,
} = require('./makeronline-direct');

const context = { token: 'opaque-test-token', cookie: 'mo_access_token=opaque-test-token' };

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('MakerOnline roles map to the captured scene types and enforce file families', () => {
  assert.deepEqual(SCENE_BY_ROLE, {
    cover: 2,
    photo: 2,
    'description-image': 2,
    model: 1,
    profile: 5,
    'profile-photo': 6,
    documentation: 8,
  });
  assert.throws(() => validateUpload('profile', { name: 'part.stl', bytes: Buffer.alloc(1) }), /3mf/i);
  assert.throws(() => validateUpload('model', { name: 'instructions.pdf', bytes: Buffer.alloc(1) }), /raw model/i);
  assert.throws(() => validateUpload('documentation', { name: 'video.mp4', bytes: Buffer.alloc(1) }), /documentation/i);
});

test('MakerOnline upload record separates native response fields from source fallbacks', async () => {
  // `name`/`size` fall back to the local file, so they cannot prove what
  // MakerOnline returned. Only the native fields may be treated as evidence.
  const clientFor = (data) => createMakerOnlineDirectClient({
    fetchImpl: async () => response({ code: 0, data }),
  });
  const source = { name: 'part.stl', mimeType: 'model/stl', bytes: Buffer.from('solid test') };

  const full = await clientFor({
    key: 'models/part.stl', url: 'https://cdn.example/part.stl',
    file_name: 'part.stl', file_size: 10,
  }).upload(context, 'model', source);
  assert.equal(full.nativeFileName, 'part.stl');
  assert.equal(full.nativeFileSize, 10);
  assert.equal(full.sourceFileName, 'part.stl');
  assert.equal(full.sourceFileSize, source.bytes.byteLength);

  // Each native field missing independently must be reported as null, never
  // silently replaced by the source value.
  const noName = await clientFor({
    key: 'models/part.stl', url: 'https://cdn.example/part.stl', file_size: 10,
  }).upload(context, 'model', source);
  assert.equal(noName.nativeFileName, null);
  assert.equal(noName.name, 'part.stl', 'convenience name may still fall back');
  assert.equal(noName.sourceFileName, 'part.stl');

  const noSize = await clientFor({
    key: 'models/part.stl', url: 'https://cdn.example/part.stl', file_name: 'part.stl',
  }).upload(context, 'model', source);
  assert.equal(noSize.nativeFileSize, null);
  assert.equal(noSize.size, source.bytes.byteLength, 'convenience size may still fall back');

  const zeroSize = await clientFor({
    key: 'models/part.stl', url: 'https://cdn.example/part.stl', file_name: 'part.stl', file_size: 0,
  }).upload(context, 'model', source);
  assert.equal(zeroSize.nativeFileSize, null, 'a zero size is not a usable native size');

  const blankName = await clientFor({
    key: 'models/part.stl', url: 'https://cdn.example/part.stl', file_name: '   ', file_size: 10,
  }).upload(context, 'model', source);
  assert.equal(blankName.nativeFileName, null, 'a blank name is not a usable native name');

  const noKey = await clientFor({
    url: 'https://cdn.example/part.stl', file_name: 'part.stl', file_size: 10,
  }).upload(context, 'model', source);
  assert.equal(noKey.key, '', 'a missing key stays empty rather than being invented');

  // A missing URL is fatal at the transport boundary itself.
  await assert.rejects(
    () => clientFor({ key: 'models/part.stl', file_name: 'part.stl', file_size: 10 })
      .upload(context, 'model', source),
    /returned no file URL/i,
  );
});

test('MakerOnline upload sends the raw token, cookies, scene type, and bytes directly', async () => {
  const calls = [];
  const client = createMakerOnlineDirectClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return response({ code: 0, data: {
        key: 'models/part.stl',
        url: 'https://cdn.example/part.stl',
      } });
    },
  });
  const uploaded = await client.upload(context, 'model', {
    name: 'part.stl', mimeType: 'model/stl', bytes: Buffer.from('solid test'),
  });

  assert.equal(uploaded.url, 'https://cdn.example/part.stl');
  assert.equal(calls[0].options.headers.Authorization, 'opaque-test-token');
  assert.equal(calls[0].options.headers.Cookie, context.cookie);
  assert.equal(calls[0].options.method, 'POST');
  const entries = [...calls[0].options.body.entries()];
  assert.equal(entries.find(([name]) => name === 'scene_type')[1], '1');
  assert.equal(entries.find(([name]) => name === 'file')[1].name, 'part.stl');
});

test('MakerOnline payload preserves all mapped upload choices and print-profile metadata', () => {
  const image = { url: 'https://cdn.example/cover.jpg', thumbnailUrl: 'https://cdn.example/thumb.jpg' };
  const model = { name: 'part.stl', size: 10, url: 'https://cdn.example/part.stl' };
  const document = { id: '7', name: 'guide.pdf', size: 20, key: 'guide.pdf', url: 'https://cdn.example/guide.pdf' };
  const profile = {
    name: 'profile.3mf', size: 30, url: 'https://cdn.example/profile.3mf',
    parsed: { printers: ['Kobra 3'], nozzle: '0.4', layer: '0.2', plates: [1], parse_type: 1 },
  };
  const payload = buildSubmitPayload({
    title: 'A remixed model',
    description: '<p>Adapted mounting points.</p>',
    source: 2,
    originalUrl: 'https://example.com/original',
    license: 4,
    categoryId: '35',
    permission: 1,
    printMethod: 3,
    aiHelp: true,
    nsfw: false,
    relatedKits: true,
    storeKitIds: [1, 5],
    includePrintProfile: true,
    images: [image],
    models: [model],
    documents: [document],
    printProfiles: [profile],
    printImages: [image],
    printTitle: 'Kobra 3 profile',
    printDescription: '<p>0.2 mm PLA profile.</p>',
    tags: ['remix', 'mount'],
  });

  assert.equal(payload.source, 2);
  assert.equal(payload.original_link, 'https://example.com/original');
  assert.deepEqual(payload.print_types, [1, 2]);
  assert.equal(payload.images[0].is_main, 1);
  assert.equal(payload.is_related_kits, 1);
  assert.deepEqual(payload.store_kit_ids, [1, 5]);
  assert.equal(payload.print_file_type, 1);
  assert.deepEqual(payload.print_files[0].printers, ['Kobra 3']);
  assert.equal(payload.docs[0].doc_id, '7');
});

test('MakerOnline draft save uses save-draft then reads edit-info', async () => {
  const calls = [];
  const client = createMakerOnlineDirectClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).includes('/api/mold/save-draft')) return response({ code: 0, data: { mold_id: 91 } });
      if (String(url).includes('/api/mold/edit-info')) return response({ code: 0, data: { id: 91, title: 'Private test' } });
      throw new Error(`Unexpected request ${url}`);
    },
  });
  const input = {
    publication: 'draft',
    title: 'Private test', description: '<p>Test</p>', source: 1, license: 3,
    categoryId: '35', permission: 2, printMethod: 1, includePrintProfile: false,
    images: [{ url: 'https://cdn.example/cover.jpg' }],
    models: [{ name: 'part.stl', size: 10, url: 'https://cdn.example/part.stl' }],
    tags: [],
  };
  const saved = await client.save(context, input);
  const model = await client.status(context, saved.id);

  assert.equal(saved.state, 'draft');
  assert.equal(saved.url, 'https://www.makeronline.com/en/upload?id=91');
  assert.equal(model.title, 'Private test');
  assert.match(calls[0].url, /save-draft$/);
  assert.match(calls[1].url, /edit-info\?id=91$/);
});

test('MakerOnline print-profile parser sends file_key as an array and unwraps the result', async () => {
  const calls = [];
  const client = createMakerOnlineDirectClient({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return response({ code: 0, data: [{ printers: ['Kobra 3'], layer: '0.2' }] });
    },
  });
  const parsed = await client.parseProfile(context, { key: 'uploads/profile.3mf' });

  assert.deepEqual(parsed, { printers: ['Kobra 3'], layer: '0.2' });
  assert.match(calls[0].url, /\/api\/file\/parse-info$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    file_type: 1,
    file_key: ['uploads/profile.3mf'],
  });
});
