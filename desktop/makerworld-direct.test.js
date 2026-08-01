const assert = require('node:assert/strict');
const test = require('node:test');
const {
  handleMakerWorldRequest,
  makerWorldLoginDirect,
} = require('./makerworld-direct.cjs');

const VIRTUAL_WORKER = 'https://modelprep-backend.iamdjem.workers.dev/api/v1/makerworld/web';
const COOKIE = 'token=desktop-token; refreshToken=desktop-refresh';

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

async function withFetch(mock, run) {
  const original = global.fetch;
  global.fetch = mock;
  try {
    return await run();
  } finally {
    global.fetch = original;
  }
}

test('desktop MakerWorld check calls MakerWorld directly and never the Worker', async () => {
  const calls = [];
  await withFetch(async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return jsonResponse({ count: 0 });
  }, async () => {
    const result = await handleMakerWorldRequest({ url: `${VIRTUAL_WORKER}/check` }, COOKIE);
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.body), { ok: true });
  });

  assert.deepEqual(calls.map((call) => call.url), [
    'https://makerworld.com/api/v1/user-service/my/message/count',
  ]);
  assert.match(calls[0].options.headers.Cookie, /token=desktop-token/);
  assert.ok(calls.every((call) => !call.url.includes('modelprep-backend')));
});

test('desktop MakerWorld fallback upload presigns and uploads on-device', async () => {
  const calls = [];
  await withFetch(async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/api/v1/design-user-service/my/upload')) {
      return jsonResponse({
        cdnPrefix: 'https://cdn.makerworld.example',
        urls: ['https://makerworld-storage.example/makerworld/model/dragon.stl?signature=x'],
      });
    }
    if (String(url).startsWith('https://makerworld-storage.example/')) {
      return new Response('', { status: 200 });
    }
    throw new Error(`Unexpected request: ${url}`);
  }, async () => {
    const result = await handleMakerWorldRequest({
      url: `${VIRTUAL_WORKER}/upload`,
      method: 'POST',
      bodyType: 'form-data',
      body: [
        { name: 'fileName', kind: 'text', value: 'dragon.stl' },
        {
          name: 'file',
          kind: 'file',
          fileName: 'dragon.stl',
          mimeType: 'model/stl',
          bytes: new Uint8Array([1, 2, 3, 4]),
        },
      ],
    }, COOKIE);
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.body), {
      ok: true,
      name: 'dragon.stl',
      size: 4,
      key: 'makerworld/model/dragon.stl',
      cdnPrefix: 'https://cdn.makerworld.example',
      url: 'https://cdn.makerworld.example/makerworld/model/dragon.stl',
    });
  });

  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => !call.url.includes('modelprep-backend')));
  assert.equal(calls[1].options.method, 'PUT');
});

test('desktop MakerWorld regular publish creates, updates, and submits directly', async () => {
  const calls = [];
  await withFetch(async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/api/v1/design-service/my/draft') && options.method === 'POST') {
      return jsonResponse({ id: 1234 });
    }
    if (String(url).endsWith('/api/v1/design-service/my/draft/1234') && options.method === 'PUT') {
      return jsonResponse({});
    }
    if (String(url).endsWith('/api/v1/design-service/my/draft/1234/submit')) {
      return jsonResponse({});
    }
    throw new Error(`Unexpected request: ${url}`);
  }, async () => {
    const input = {
      title: 'Direct dragon',
      description: '<p>A direct desktop test.</p>',
      categoryId: 23,
      license: 'CC BY',
      visibility: 'private',
      coverUrl: 'https://cdn.example/cover-4x3.webp',
      coverPortraitUrl: 'https://cdn.example/cover-3x4.webp',
      modelFiles: [{
        modelName: 'dragon.stl',
        modelSize: 4,
        modelType: 'stl',
        modelUrl: 'https://cdn.example/dragon.stl',
      }],
    };
    const result = await handleMakerWorldRequest({
      url: `${VIRTUAL_WORKER}/publish`,
      method: 'POST',
      bodyType: 'text',
      body: JSON.stringify(input),
    }, COOKIE);
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.body), {
      ok: true,
      id: 1234,
      status: 'verifying',
      url: 'https://makerworld.com/en/my/models/drafts/1234/edit',
    });
  });

  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.url.startsWith('https://makerworld.com/')));
  assert.ok(calls.every((call) => !call.url.includes('modelprep-backend')));
});

test('desktop MakerWorld Laser & Cut publish stays direct', async () => {
  const calls = [];
  await withFetch(async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/api/v1/design-service/my/draft2d') && options.method === 'POST') {
      return jsonResponse({ id: 9876 });
    }
    if (String(url).endsWith('/api/v1/design-service/my/draft2d/9876') && options.method === 'PUT') {
      return jsonResponse({});
    }
    if (String(url).endsWith('/api/v1/design-service/my/draft2d/9876/submit')) {
      return jsonResponse({});
    }
    throw new Error(`Unexpected request: ${url}`);
  }, async () => {
    const input = {
      title: 'Direct laser dragon',
      pictures: ['https://cdn.example/laser-cover.webp'],
      visibility: 'private',
      modelFiles: [{
        modelName: 'dragon.svg',
        modelSize: 4,
        modelType: 'svg',
        modelUrl: 'https://cdn.example/dragon.svg',
      }],
    };
    const result = await handleMakerWorldRequest({
      url: `${VIRTUAL_WORKER}/laser-cut/publish`,
      method: 'POST',
      bodyType: 'text',
      body: JSON.stringify(input),
    }, COOKIE);
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.body), {
      ok: true,
      id: 9876,
      status: 'verifying',
      kind: 'laser-cut',
    });
  });

  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.url.startsWith('https://makerworld.com/')));
  assert.ok(calls.every((call) => !call.url.includes('modelprep-backend')));
});

test('direct email-code login preserves tfaKey and stores only the returned session', async () => {
  let request;
  await withFetch(async (url, options = {}) => {
    request = { url: String(url), options };
    return jsonResponse({
      token: 'access-token',
      refreshToken: 'refresh-token',
      userId: 'user-1',
      expireIn: 123,
    });
  }, async () => {
    const result = await makerWorldLoginDirect({
      account: 'test@example.com',
      code: '123456',
      tfaKey: 'challenge-key',
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, {
      ok: true,
      cookie: 'token=access-token; refreshToken=refresh-token',
      userId: 'user-1',
      expireIn: 123,
    });
  });

  assert.equal(request.url, 'https://makerworld.com/api/v1/user-service/user/login');
  assert.deepEqual(JSON.parse(request.options.body), {
    account: 'test@example.com',
    code: '123456',
    tfaKey: 'challenge-key',
  });
  assert.ok(!request.url.includes('modelprep-backend'));
});
