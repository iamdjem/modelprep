const assert = require('node:assert/strict');
const test = require('node:test');
const { createCultsDirectClient } = require('./cults-direct');

function htmlWithCsrf(token) {
  return `<html><head><meta name="csrf-token" content="${token}"></head></html>`;
}

function response(body = '', init = {}) {
  return new Response(body, init);
}

function successfulEditHtml({ omitLastIllustration = false } = {}) {
  const blueprintNames = ['dragon-1.stl', 'dragon-2.stl', 'dragon-3.stl'];
  const illustrationNames = [
    ...Array.from({ length: 15 }, (_, index) => `dragon-${index + 1}.webp`),
    'turntable.mp4',
  ];
  const illustrationIds = Array.from({ length: omitLastIllustration ? 15 : 16 }, (_, index) => 103 + index);
  return `<form id="edit_creation_1">
    <input name="creation[name]" value="Demo dragon">
    ${[100, 101, 102].map((id) => `<input type="hidden" name="creation[blueprint_ids][]" value="${id}">`).join('')}
    ${illustrationIds.map((id) => `<input type="hidden" name="creation[illustration_ids][]" value="${id}">`).join('')}
    ${blueprintNames.map((name) => `<a href="https://download.cults3d.com/uploaders/1/blueprint-file/id/${name}?signed=1">${name}</a>`).join('')}
    ${illustrationNames.map((name) => `<a href="https://files.cults3d.com/uploaders/1/illustration-file/id/${name}">${name}</a>`).join('')}
  </form>`;
}

function successfulListHtml() {
  return `<div id="creations-my-creations-1"><table><tbody><tr>
    <td><a title="Demo dragon" href="/en/creations/demo-dragon">Demo dragon</a></td>
    <td><span class="text-marker">Secret</span></td>
    <td class="price-cell">Free</td>
  </tr></tbody></table></div>`;
}

function buildSuccessfulFetch({ omitLastIllustration = false } = {}) {
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
    if (url === 'https://cults3d.com/en/creations/demo-dragon/edit' && method === 'GET') {
      return response(successfulEditHtml({ omitLastIllustration }), { status: 200 });
    }
    if (url === 'https://cults3d.com/en/creations/mine' && method === 'GET') {
      return response(successfulListHtml(), { status: 200 });
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

const explicitFreeCultsFields = [
  { name: 'categoryId', kind: 'text', value: '23' },
  { name: 'licenseType', kind: 'text', value: 'cc_by' },
  { name: 'free', kind: 'text', value: 'true' },
  { name: 'price', kind: 'text', value: '0' },
];

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
    { name: 'details', kind: 'text', value: 'Print in place; no supports.' },
    { name: 'metaTags', kind: 'text', value: '["articulated","print_in_place","no_support"]' },
    { name: 'madeWithAi', kind: 'text', value: 'true' },
    { name: 'showComments', kind: 'text', value: 'false' },
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
  assert.deepEqual(payload.readback.blueprints.ids, [100, 101, 102]);
  assert.equal(payload.readback.illustrations.filenames.at(-1), 'turntable.mp4');
  assert.deepEqual(payload.readbackIssues, []);
  assert.equal(requests.length, 64);
  assert.ok(requests.length > 50, 'proof that the formerly failing request volume completed locally');
  assert.equal(
    requests.filter(({ url }) => url.includes('modelprep-backend')).length,
    0,
    'desktop transport must not call the Cloudflare Worker',
  );
  const creation = requests.find(({ url, options }) => url === 'https://cults3d.com/en/creations' && options.method === 'POST');
  assert.match(creation.options.body, /creation%5Bdetails%5D=Print\+in\+place%3B\+no\+supports/);
  assert.match(creation.options.body, /creation%5Bmeta_tags%5D%5B%5D=articulated/);
  assert.match(creation.options.body, /creation%5Bmade_with_ai%5D=1/);
  assert.doesNotMatch(creation.options.body, /creation%5Bshow_comments%5D%5B%5D=1/);
});

test('desktop Cults sends open pricing and offline visibility without treating the listing as free', async () => {
  const { fetchImpl, requests } = buildSuccessfulFetch();
  const client = createCultsDirectClient({ fetchImpl });
  const credentials = { email: 'test@example.com', password: 'correct horse battery staple' };
  await client.connect(credentials, 'account-1');
  const result = await client.handleRequest({
    url: 'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish',
    method: 'POST',
    bodyType: 'form-data',
    body: [
      { name: 'name', kind: 'text', value: 'Open dragon' },
      { name: 'categoryId', kind: 'text', value: '23' },
      { name: 'licenseType', kind: 'text', value: 'cults_cu' },
      { name: 'pricing', kind: 'text', value: 'open_priced' },
      { name: 'free', kind: 'text', value: 'false' },
      { name: 'price', kind: 'text', value: '0' },
      { name: 'downloadOpenPrice', kind: 'text', value: '2.5' },
      { name: 'visibility', kind: 'text', value: 'offline' },
      fileEntry('cover.webp'),
      fileEntry('dragon.stl', 'model'),
    ],
  }, credentials, 'account-1');
  assert.equal(result.status, 200);
  const priceRequest = requests.find(({ url }) => url.endsWith('/en/creations/demo-dragon/price'));
  assert.match(priceRequest.options.body, /creation%5Bpricing%5D=open_priced/);
  assert.match(priceRequest.options.body, /creation%5Bdownload_open_price%5D=2.5/);
  assert.match(priceRequest.options.body, /creation%5Blicense_type%5D=cults_cu/);
  assert.match(priceRequest.options.body, /creation%5Bvisibility%5D=offline/);
});

test('desktop Cults publish rejects an unknown current-form meta tag before authentication', async () => {
  const client = createCultsDirectClient({ fetchImpl: async () => { throw new Error('must not authenticate'); } });
  const result = await client.handleRequest({
    url: 'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish', method: 'POST', bodyType: 'form-data',
    body: [
      ...explicitFreeCultsFields,
      { name: 'metaTags', kind: 'text', value: '["invented_tag"]' },
      fileEntry('cover.webp'), fileEntry('dragon.stl', 'model'),
    ],
  }, { email: 'test@example.com', password: 'secret' }, 'account-1');
  assert.equal(result.status, 400);
  assert.match(result.body, /unknown meta tag/i);
});

test('desktop Cults publish retains the receipt but fails certification when edit readback omits the video ID', async () => {
  const { fetchImpl } = buildSuccessfulFetch({ omitLastIllustration: true });
  const client = createCultsDirectClient({ fetchImpl });
  const credentials = { email: 'test@example.com', password: 'correct horse battery staple' };
  await client.connect(credentials, 'account-1');
  const result = await client.handleRequest({
    url: 'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish',
    method: 'POST',
    bodyType: 'form-data',
    body: [
      ...explicitFreeCultsFields,
      { name: 'name', kind: 'text', value: 'Demo dragon' },
      { name: 'visibility', kind: 'text', value: 'secret' },
      fileEntry('cover.webp'),
      fileEntry('turntable.mp4', 'illustration', 'video/mp4'),
      fileEntry('dragon.stl', 'model'),
    ],
  }, credentials, 'account-1');
  const payload = JSON.parse(result.body);
  assert.equal(result.status, 200);
  assert.equal(payload.designUrl, 'https://cults3d.com/en/3d-model/art/demo-dragon');
  assert.match(payload.readbackIssues.join(' '), /illustration IDs/i);
});

test('desktop Cults publish rejects missing or incompatible mappings before authentication', async () => {
  let authenticationAttempts = 0;
  const client = createCultsDirectClient({ fetchImpl: async () => {
    authenticationAttempts += 1;
    throw new Error('must not authenticate');
  } });
  const request = (fields) => client.handleRequest({
    url: 'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish',
    method: 'POST',
    bodyType: 'form-data',
    body: [...fields, fileEntry('cover.webp'), fileEntry('dragon.stl', 'model')],
  }, { email: 'test@example.com', password: 'secret' }, 'account-1');

  const missingCategory = await request([
    { name: 'licenseType', kind: 'text', value: 'cc_by' },
    { name: 'free', kind: 'text', value: 'true' },
  ]);
  assert.equal(missingCategory.status, 400);
  assert.equal(JSON.parse(missingCategory.body).error, 'invalid_category');

  const incompatibleLicense = await request([
    { name: 'categoryId', kind: 'text', value: '23' },
    { name: 'licenseType', kind: 'text', value: 'cc_by' },
    { name: 'price', kind: 'text', value: '5' },
  ]);
  assert.equal(incompatibleLicense.status, 400);
  assert.equal(JSON.parse(incompatibleLicense.body).error, 'invalid_license');
  assert.equal(authenticationAttempts, 0);
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

test('managed Cults sessions validate the authenticated create page per account without credentials', async () => {
  const calls = [];
  const client = createCultsDirectClient({
    managedSession: true,
    fetchImplForAccount: (accountId) => async (url, options = {}) => {
      calls.push({ accountId, url: String(url), options });
      return response(htmlWithCsrf(`csrf-${accountId}`), { status: 200 });
    },
  });

  await client.connect(null, 'account-one');
  await client.connect(null, 'account-two');

  assert.deepEqual(calls.map(({ accountId }) => accountId), ['account-one', 'account-two']);
  assert.ok(calls.every(({ url }) => url === 'https://cults3d.com/en/creations/new'));
  assert.ok(calls.every(({ options }) => options.redirect === 'manual'));
});

test('managed Cults sessions classify Cloudflare browser challenges as reconnectable auth failures', async () => {
  const client = createCultsDirectClient({
    managedSession: true,
    fetchImplForAccount: () => async () => response('<title>Just a moment...</title>', {
      status: 403,
      headers: { 'cf-mitigated': 'challenge', 'content-type': 'text/html' },
    }),
  });

  await assert.rejects(
    () => client.connect(null, 'account-one'),
    (error) => error?.code === 'CULTS_CHALLENGE_REQUIRED' && /browser security check/i.test(error.message),
  );
});

test('managed Cults requests fail closed when the browser session is redirected back to sign-in', async () => {
  let requestCount = 0;
  const client = createCultsDirectClient({
    managedSession: true,
    fetchImplForAccount: () => async () => {
      requestCount += 1;
      if (requestCount === 1) return response(htmlWithCsrf('csrf-account'), { status: 200 });
      const signedOut = response('<form>Sign in</form>', { status: 200 });
      Object.defineProperty(signedOut, 'url', { value: 'https://cults3d.com/en/users/sign-in' });
      return signedOut;
    },
  });
  await client.connect(null, 'account-one');

  const result = await client.handleRequest({
    url: 'https://worker.example/api/v1/cults3d/web/my-creations',
    method: 'GET',
  }, null, 'account-one');

  assert.equal(result.status, 401);
  assert.equal(JSON.parse(result.body).error, 'missing_cults_session');
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
  assert.match(JSON.parse(result.body).hint, /JPEG, PNG, WebP, GIF, MP4, or WebM/);
});

test('typed Cults media accepts a GIF cover before authentication', async () => {
  const client = createCultsDirectClient({ fetchImpl: async () => { throw new Error('must not authenticate'); } });
  const result = await client.handleRequest({
    url: 'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish',
    method: 'POST',
    bodyType: 'form-data',
    body: [...explicitFreeCultsFields, fileEntry('dragon.stl', 'model'), fileEntry('animated-cover.gif', 'illustration', 'image/gif')],
  }, { email: 'test@example.com', password: 'secret' }, 'account-1');
  assert.equal(result.status, 502);
  assert.match(JSON.parse(result.body).message, /must not authenticate/);
});

test('typed Cults media rejects an oversized video before authentication', async () => {
  const client = createCultsDirectClient({ fetchImpl: async () => { throw new Error('must not authenticate'); } });
  const result = await client.handleRequest({
    url: 'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish',
    method: 'POST',
    bodyType: 'form-data',
    body: [
      fileEntry('dragon.stl', 'model'),
      fileEntry('cover.webp'),
      { name: 'illustration', kind: 'file', fileName: 'oversized.mp4', mimeType: 'video/mp4', bytes: new Uint8Array((10 * 1024 * 1024) + 1).buffer },
    ],
  }, { email: 'test@example.com', password: 'secret' }, 'account-1');
  assert.equal(result.status, 400);
  assert.match(JSON.parse(result.body).hint, /media must not exceed 10 MiB/i);
});

test('Cults publish rejects a forbidden file-name character before authentication', async () => {
  for (const [fileName, role] of [
    ['dragon&wing.stl', 'model'],
    ['cover<1>.webp', 'illustration'],
  ]) {
    const client = createCultsDirectClient({ fetchImpl: async () => { throw new Error('must not authenticate'); } });
    const body = role === 'model'
      ? [fileEntry(fileName, 'model'), fileEntry('cover.webp')]
      : [fileEntry('dragon.stl', 'model'), fileEntry(fileName)];
    const result = await client.handleRequest({
      url: 'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish',
      method: 'POST',
      bodyType: 'form-data',
      body,
    }, { email: 'test@example.com', password: 'secret' }, 'account-1');
    assert.equal(result.status, 400);
    const { error, hint } = JSON.parse(result.body);
    assert.equal(error, 'invalid_filename');
    assert.match(hint, /rejects the character/i);
    assert.match(hint, new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Cults publish accepts an ordinary file name through the same guard', async () => {
  const client = createCultsDirectClient({ fetchImpl: async () => { throw new Error('must not authenticate'); } });
  const result = await client.handleRequest({
    url: 'https://modelprep-backend.iamdjem.workers.dev/api/v1/cults3d/web/publish',
    method: 'POST',
    bodyType: 'form-data',
    body: [...explicitFreeCultsFields, fileEntry('dragon-wing.stl', 'model'), fileEntry('cover.webp')],
  }, { email: 'test@example.com', password: 'secret' }, 'account-1');
  assert.equal(result.status, 502);
  assert.match(JSON.parse(result.body).message, /must not authenticate/);
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
