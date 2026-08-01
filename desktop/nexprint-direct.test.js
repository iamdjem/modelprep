const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildSubmitPayload,
  createNexprintDirectClient,
  makeStoragePath,
  trimUploadName,
  validateUpload,
} = require('./nexprint-direct');

const context = { token: 'opaque-test-token', cookie: 'auth_token=opaque-test-token' };

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('Nexprint storage paths match the production SHA-256 shape', () => {
  const path = makeStoragePath(Buffer.from('solid test'), 'part.stl', () => 1234);
  assert.match(path, /^[a-f0-9]{64}-1234-[a-f0-9]{64}\.stl$/);
  assert.equal(trimUploadName(`${'a'.repeat(100)}.stl`), `${'a'.repeat(80)}.stl`);
});

test('Nexprint upload performs presign, direct PUT, then file registration', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/presigned-url?')) {
      return response({ code: 0, data: {
        configId: 'cfg',
        uploadUrl: 'https://storage.example/upload',
        url: 'https://storage.example/public/model.stl',
      } });
    }
    if (String(url) === 'https://storage.example/upload') return new Response('', { status: 200 });
    if (String(url).endsWith('/file/create')) return response({ code: 0, data: 42 });
    throw new Error(`Unexpected request ${url}`);
  };
  const client = createNexprintDirectClient({ fetchImpl, now: () => 1234 });

  const file = await client.upload(context, 'model', {
    name: 'model.stl',
    mimeType: 'model/stl',
    bytes: Buffer.from('solid model'),
  });

  assert.equal(file.fileId, '42');
  assert.equal(file.fileUrl, 'https://storage.example/public/model.stl');
  assert.match(file.msgDigest, /^[a-f0-9]{32}$/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer opaque-test-token');
  assert.equal(calls[1].options.method, 'PUT');
  const createBody = JSON.parse(calls[2].options.body);
  assert.equal(createBody.path, calls[0].url.match(/[?&]path=([^&]+)/)[1] ? decodeURIComponent(calls[0].url.match(/[?&]path=([^&]+)/)[1]) : '');
});

test('Nexprint upload validation keeps roles and limits isolated', () => {
  assert.throws(() => validateUpload('cover', {
    name: 'clip.mp4',
    bytes: Buffer.alloc(1),
  }), /does not accept/i);
  assert.throws(() => validateUpload('attachment', {
    name: 'part.stl',
    bytes: Buffer.alloc(1),
  }), /attachment/i);
  assert.throws(() => validateUpload('mystery', {
    name: 'part.stl',
    bytes: Buffer.alloc(1),
  }), /role/i);
});

test('Nexprint submit payload maps originality, license, BOM, AI disclosure, and draft status', () => {
  const file = {
    fileId: '1',
    fileUrl: 'https://storage.example/file',
    fileName: 'part.stl',
    fileSize: 10,
    fileExt: 'stl',
  };
  const payload = buildSubmitPayload({
    title: 'Adapted part',
    description: '<p>Changed the mount.</p>',
    categoryId: '1422473859022861',
    licenseType: 3,
    originalityType: 2,
    sourceUrl: 'https://example.com/original',
    draftOnly: true,
    cover: { ...file, fileName: 'cover.jpg', fileExt: 'jpg' },
    photos: [],
    models: [file],
    attachments: [],
    tags: ['mount'],
    aiGenerated: true,
    hasBom: true,
    bom: [{ materialName: 'M3 screw', materialNum: 4, materialRemark: '12 mm' }],
  });
  const model = payload.modelInfoList[0];

  assert.equal(model.status, 0);
  assert.equal(model.originalityType, 2);
  assert.equal(model.originUrl, 'https://example.com/original');
  assert.equal(model.licenseType, 3);
  assert.deepEqual(model.modelTagList, ['mount', 'AI-generated']);
  assert.deepEqual(model.modelMaterialInfoVOList, [{
    materialName: 'M3 screw',
    materialNum: 4,
    materialRemark: '12 mm',
  }]);
});

test('Nexprint submit uses the batch endpoint and returns a draft edit URL', async () => {
  const fetchImpl = async (url, options = {}) => {
    assert.match(String(url), /createOrUpdateBatch$/);
    assert.equal(options.method, 'POST');
    return response({ code: 0, data: { modelInfoList: [{ id: '1967' }] } });
  };
  const client = createNexprintDirectClient({ fetchImpl });
  const file = {
    fileId: '1',
    fileUrl: 'https://storage.example/file',
    fileName: 'part.stl',
    fileSize: 10,
    fileExt: 'stl',
  };
  const result = await client.submit(context, {
    title: 'Original part',
    categoryId: '2',
    licenseType: 6,
    originalityType: 1,
    draftOnly: true,
    cover: { ...file, fileName: 'cover.jpg', fileExt: 'jpg' },
    models: [file],
    tags: [],
  });

  assert.equal(result.id, '1967');
  assert.equal(result.url, 'https://www.nexprint.com/en/editUpload/1967');
});
