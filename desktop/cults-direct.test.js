const assert = require('node:assert/strict');
const test = require('node:test');
const { createCultsDirectClient } = require('./cults-direct');

function htmlWithCsrf(token) {
  return `<html><head><meta name="csrf-token" content="${token}"></head></html>`;
}

function response(body = '', init = {}) {
  return new Response(body, init);
}

function buildSuccessfulFetch() {
  let nextUploadId = 100;
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    const method = options.method || 'GET';
    if (url === 'https://cults3d.com/en/users/sign-in' && method === 'GET') {
      return response(htmlWithCsrf('login-csrf'), {
        status: 200,
        headers: { 'set-cookie': '_cults_session=seed; Path=/; HttpOnly' },
      });
    }
    if (url === 'https://cults3d.com/en/users/sign-in' && method === 'POST') {
      return response('', {
        status: 303,
        headers: {
          location: '/en',
          'set-cookie': '_cults_session=authenticated; Path=/; HttpOnly',
        },
      });
    }
    if (url === 'https://cults3d.com/en/creations/new') {
      return response(htmlWithCsrf('publish-csrf'), { status: 200 });
    }
    if (String(url).startsWith('https://cults3d.com/en/file_uploaders/new?')) {
      return response(JSON.stringify({
        key: 'uploads/${filename}',
        policy: 'signed-policy',
        'x-amz-signature': 'signed',
        'x-amz-algorithm': 'AWS4-HMAC-SHA256',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url === 'https://s3.eu-west-3.amazonaws.com/files.cults3d.com') {
      return response(null, { status: 204 });
    }
    if (url === 'https://cults3d.com/en/blueprints' || url === 'https://cults3d.com/en/illustrations') {
      return response(JSON.stringify({ id: nextUploadId++ }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === 'https://cults3d.com/en/creations' && method === 'POST') {
      return response('', {
        status: 302,
        headers: { location: '/en/creations/demo-dragon/price/edit' },
      });
    }
    if (url === 'https://cults3d.com/en/creations/demo-dragon/price' && method === 'POST') {
      return response('', {
        status: 303,
        headers: { location: 'https://cults3d.com/en/3d-model/art/demo-dragon' },
      });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
  return { fetchImpl, requests };
}

function fileEntry(name, field = 'illustration', mimeType = field === 'model' ? 'model/stl' : 'image/webp') {
  return {
    name: field,
    kind: 'file',
    fileName: name,
    mimeType,
    bytes: new TextEncoder().encode(name).buffer,
  };
}

test('desktop direct Cults publish completes a 19-file demo without a Worker subrequest ceiling', async () => {
  const { fetchImpl, requests } = buildSuccessfulFetch();
  const client = createCultsDirectClient({ fetchImpl });
  const credentials = { email: 'test@example.com', password: 'correct horse battery staple' };
  await client.connect(credentials, 'account-1');

  const body = [
    { name: 'name', kind: 'text', value: 'Demo dragon' },
    { name: 'description', kind: 'text', value: 'Direct desktop transport' },
    { name: 'category', kind: 'text', value: 'Art & Decor' },
    { name: 'license', kind: 'text', value: 'ccby' },
    { name: 'free', kind: 'text', value: 'true' },
    { name: 'price', kind: 'text', value: '0' },
    { name: 'visibility', kind: 'text', value: 'secret' },
    { name: 'tags', kind: 'text', value: '["dragon","articulated"]' },
    ...Array.from({ length: 15 }, (_, index) => fileEntry(`dragon-${index + 1}.webp`)),
    fileEntry('turntable.mp4', 'illustration', 'video/mp4'),
    ...Array.from({ length: 3 }, (_, index) => fileEntry(`dragon-${index + 1}.stl`, 'model')),
  ];
  const result = await client.handleRequest({
    url: 'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish',
    method: 'POST',
    bodyType: 'form-data',
    body,
  }, credentials, 'account-1');
  const payload = JSON.parse(result.body);

  assert.equal(result.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.slug, 'demo-dragon');
  assert.equal(payload.designUrl, 'https://cults3d.com/en/3d-model/art/demo-dragon');
  assert.equal(payload.blueprintIds.length, 3);
  assert.equal(payload.illustrationIds.length, 16);
  assert.equal(requests.length, 62);
  assert.ok(requests.length > 50, 'proof that the formerly failing request volume completed locally');
  assert.equal(
    requests.filter(({ url }) => url.includes('modelprep-backend')).length,
    0,
    'desktop transport must not call the Cloudflare Worker',
  );
});

test('connect rejects credentials when Cults returns the sign-in form', async () => {
  let count = 0;
  const client = createCultsDirectClient({
    fetchImpl: async (_url, options = {}) => {
      count += 1;
      if ((options.method || 'GET') === 'GET') {
        return response(htmlWithCsrf('login-csrf'), { status: 200 });
      }
      return response('<div class="alert">Invalid login</div>', { status: 200 });
    },
  });
  await assert.rejects(
    () => client.connect({ email: 'wrong@example.com', password: 'wrong' }, 'account-1'),
    /rejected the email or password/i,
  );
  assert.equal(count, 2);
});

test('typed Cults media rejects an unsupported illustration before authentication', async () => {
  const client = createCultsDirectClient({ fetchImpl: async () => { throw new Error('must not authenticate'); } });
  const result = await client.handleRequest({
    url: 'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish',
    method: 'POST',
    bodyType: 'form-data',
    body: [fileEntry('dragon.stl', 'model'), fileEntry('notes.pdf', 'illustration', 'application/pdf')],
  }, { email: 'test@example.com', password: 'secret' }, 'account-1');
  assert.equal(result.status, 400);
  assert.match(JSON.parse(result.body).hint, /JPEG, PNG, WebP, MP4, or WebM/);
});

test('typed Cults media requires an image before video media', async () => {
  const client = createCultsDirectClient({ fetchImpl: async () => { throw new Error('must not authenticate'); } });
  const result = await client.handleRequest({
    url: 'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish',
    method: 'POST',
    bodyType: 'form-data',
    body: [fileEntry('dragon.stl', 'model'), fileEntry('turntable.webm', 'illustration', 'video/webm')],
  }, { email: 'test@example.com', password: 'secret' }, 'account-1');
  assert.equal(result.status, 400);
  assert.match(JSON.parse(result.body).hint, /first.*cover image.*not a video/i);
});
