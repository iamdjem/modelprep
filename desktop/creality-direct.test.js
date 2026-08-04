const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createCrealityDirectClient,
  validateSubmit,
  validateUpload,
} = require('./creality-direct');

const context = {
  token: 'secret-token',
  uid: '8155669516',
  cookie: 'model_token=secret-token; model_user_id=8155669516',
  deviceId: 'device-id',
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('Creality validation rejects unsupported upload types and non-original direct submits', () => {
  assert.throws(
    () => validateUpload('model', { name: 'model.zip', bytes: Buffer.from('x') }),
    /does not accept \.zip/i,
  );
  const issues = validateSubmit({
    title: 'Remix',
    categoryId: '1575',
    license: 'CC BY-NC',
    modelSource: 3,
    publication: 'draft',
    pcCover: { url: 'https://pic/pc.webp' },
    appCover: { url: 'https://pic/app.webp' },
    models: [{ fileKey: 'model/a.stl', name: 'a.stl' }],
  });
  assert.match(issues.join(' '), /source objects\/proof images/i);
  const staleCategoryIssues = validateSubmit({
    title: 'Stale category',
    categoryId: '12',
    license: 'CC BY-NC',
    modelSource: 1,
    publication: 'draft',
    pcCover: { url: 'https://pic/pc.webp' },
    appCover: { url: 'https://pic/app.webp' },
    models: [{ fileKey: 'model/a.stl', name: 'a.stl' }],
  });
  assert.match(staleCategoryIssues.join(' '), /current model taxonomy/i);
  assert.throws(
    () => validateSubmit({
      title: 'Long tag',
      categoryId: '1575',
      license: 'CC BY-NC',
      modelSource: 1,
      publication: 'private',
      pcCover: { url: 'https://pic/pc.webp' },
      appCover: { url: 'https://pic/app.webp' },
      models: [{ fileKey: 'model/a.stl', name: 'a.stl' }],
      tags: ['this-tag-is-thirty-one-chars-xx'],
    }),
    /tags may not exceed 30 characters/i,
  );
});

test('Creality upload mirrors the production multipart transport and mapped CDN', async () => {
  const requests = [];
  const puts = [];
  const client = createCrealityDirectClient({
    uuid: () => 'request-id',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/getOssInfo')) {
        return response({
          code: 0,
          result: {
            info: {
              endpoint: 'oss-accelerate.aliyuncs.com',
              image: { bucket: 'pic2-creality', cdnHost: 'https://pic2-cdn.creality.com/' },
              file: { bucket: 'file2-creality', cdnHost: 'https://file2-cdn.creality.com/' },
              internal: { bucket: 'internal-creality-usa', cdnHost: '' },
            },
          },
        });
      }
      return response({
        code: 0,
        result: {
          aliyunInfo: {
            accessKeyId: 'id', secretAccessKey: 'secret', sessionToken: 'sts',
          },
        },
      });
    },
    createOssClient: (options) => ({
      multipartUpload: async (key, bytes, putOptions) => {
        puts.push({ options, key, bytes, putOptions });
        return { res: { status: 200 } };
      },
    }),
  });
  const result = await client.upload(context, 'cover', {
    name: 'cover.webp', mimeType: 'image/webp', bytes: Buffer.from('image'),
  });
  const modelResult = await client.upload(context, 'model', {
    name: 'part.stl', mimeType: 'model/stl', bytes: Buffer.from('solid part'),
  });

  assert.equal(requests.length, 4);
  assert.equal(requests[0].options.headers.__CXY_TOKEN_, 'secret-token');
  assert.equal(requests[0].options.headers.__CXY_UID_, '8155669516');
  assert.equal(requests[0].options.headers.Referer, 'https://www.crealitycloud.com/flowprint/create-model?iframe=1');
  assert.equal(puts[0].options.bucket, 'pic2-creality');
  assert.match(puts[0].key, /^crealityCloud\/upload\/[a-f0-9]{32}\.webp$/);
  assert.equal(puts[0].putOptions.partSize, 1024 * 1024);
  assert.equal(puts[0].putOptions.parallel, 4);
  assert.equal(puts[0].putOptions.headers['Content-Type'], 'image/webp');
  assert.equal('mime' in puts[0].putOptions, false);
  assert.equal(result.url, `https://pic2-cdn.creality.com/${puts[0].key}`);
  assert.equal(puts[1].options.bucket, 'internal-creality-usa');
  assert.match(puts[1].key, /^model\/[a-f0-9]{32}\.stl$/);
  assert.equal(puts[1].putOptions.mime, 'application/x-www-form-urlencoded');
  assert.equal(modelResult.url, '');
});

test('Creality draft submit saves and reads back through the draft endpoints', async () => {
  const calls = [];
  const client = createCrealityDirectClient({
    uuid: () => 'request-id',
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      if (url.endsWith('/modelDraft/edit')) return response({ code: 0, result: { id: 412 } });
      if (url.endsWith('/modelDraft/detail')) {
        return response({ code: 0, result: { modelInfo: { id: 412, groupName: 'Safe draft' } } });
      }
      throw new Error(`Unexpected URL ${url}`);
    },
  });
  const saved = await client.save(context, {
    title: 'Safe draft',
    description: '<p>Draft</p>',
    categoryId: '1575',
    license: 'CC BY-NC',
    modelSource: 1,
    publication: 'draft',
    draftId: '412',
    pcCover: { url: 'https://pic/pc.webp', width: 1600, height: 1200 },
    appCover: { url: 'https://pic/app.webp', width: 1200, height: 1600 },
    gallery: [],
    models: [{
      fileKey: 'model/a.stl', name: 'a.stl', size: 42,
      cover: { url: 'https://pic/model-preview.webp', type: 2 },
    }],
    instructions: [],
    tags: ['test'],
  });
  const readback = await client.status(context, saved.id, saved.state);

  assert.equal(saved.id, '412');
  assert.equal(saved.state, 'draft');
  assert.equal(readback.modelInfo.groupName, 'Safe draft');
  assert.equal(calls[0].body.modelInfo.isShared, false);
  assert.equal(calls[0].body.id, '412');
  assert.equal(calls[0].body.modelInfo.pricingMethod, 0);
  assert.equal('type' in calls[0].body.modelInfo.pcCovers[0], false);
  assert.equal('type' in calls[0].body.modelInfo.appCovers[0], false);
  assert.equal(calls[0].body.modelFiles[0].fileKey, 'model/a.stl');
  assert.equal(calls[0].body.modelFiles[0].fileName, 'a');
  assert.equal(calls[0].body.modelFiles[0].folderName, 'default');
  assert.equal(calls[0].body.modelFiles[0].folderSort, 1);
  assert.deepEqual(calls[0].body.modelFiles[0].cover, {
    url: 'https://pic/model-preview.webp', type: 2,
  });
  assert.equal('fileFormat' in calls[0].body.modelFiles[0], false);
  assert.equal('covers' in calls[0].body.modelInfo, false);
});

test('Creality rejects unsupported new-draft creation before calling the API', async () => {
  let called = false;
  const client = createCrealityDirectClient({
    fetchImpl: async () => { called = true; return response({ code: 0, result: {} }); },
  });
  await assert.rejects(() => client.save(context, {
    title: 'New draft',
    categoryId: '1575',
    license: 'CXY-SL',
    modelSource: 1,
    publication: 'draft',
    pcCover: { url: 'https://pic/pc.webp', width: 1600, height: 1200 },
    appCover: { url: 'https://pic/app.webp', width: 1200, height: 1600 },
    gallery: [],
    models: [{ fileKey: 'model/a.stl', name: 'a.stl', size: 42 }],
    instructions: [],
    tags: [],
  }), /does not create new drafts/);
  assert.equal(called, false);
});

test('Creality preserves an explicit native folder without inventing folder metadata', async () => {
  let sent;
  const client = createCrealityDirectClient({
    uuid: () => 'request-id',
    fetchImpl: async (url, options) => {
      sent = { url, body: JSON.parse(options.body) };
      return response({ code: 0, result: { groupItem: { id: 914 } } });
    },
  });
  await client.save(context, {
    title: 'Folder model',
    categoryId: '1575',
    license: 'CXY-SL',
    modelSource: 1,
    publication: 'private',
    pcCover: { url: 'https://pic/pc.webp' },
    appCover: { url: 'https://pic/app.webp' },
    gallery: [],
    models: [{
      fileKey: 'model/a.stl', name: 'a.stl', size: 42,
      folderName: 'Parts', folderSort: 3,
    }],
    tags: [],
  });

  assert.equal(sent.body.modelList[0].folderName, 'Parts');
  assert.equal(sent.body.modelList[0].folderSort, 3);
});

test('Creality private submit uses modelGroupCreate and remains unshared', async () => {
  let sent;
  const client = createCrealityDirectClient({
    uuid: () => 'request-id',
    fetchImpl: async (url, options) => {
      sent = { url, body: JSON.parse(options.body) };
      return response({ code: 0, result: { groupItem: { id: 913 } } });
    },
  });
  const saved = await client.save(context, {
    title: 'Private model',
    categoryId: '1575',
    license: 'CXY-SL',
    modelSource: 1,
    publication: 'private',
    pcCover: { url: 'https://pic/pc.webp' },
    appCover: { url: 'https://pic/app.webp' },
    gallery: [],
    models: [{ fileKey: 'model/a.stl', name: 'a.stl', size: 42 }],
    tags: [],
  });

  assert.match(sent.url, /modelGroupCreate$/);
  assert.equal(sent.body.groupItem.isShared, false);
  assert.equal(saved.state, 'private');
  assert.equal(saved.url, 'https://www.crealitycloud.com/model-detail/913');
});
