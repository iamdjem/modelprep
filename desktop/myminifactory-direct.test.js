const assert = require('node:assert/strict');
const test = require('node:test');
const { createMyMiniFactoryDirectClient, parseUploadPage, validateFile, validateSubmit } = require('./myminifactory-direct');

const context = { cookie: 'session=test' };
const uploadHtml = `
  <img alt="User avatar" title="iamdjem">
  <input name="uniqFolderName" value="folder-1">
  <input name="threedobject_temp_type[_token]" value="csrf-1">
`;

test('MyMiniFactory upload page parser keeps identity and CSRF context in main', () => {
  assert.deepEqual(parseUploadPage(uploadHtml), { folder: 'folder-1', csrfToken: 'csrf-1', username: 'iamdjem' });
});

test('MyMiniFactory validation enforces captured file families, category, and legal declaration', () => {
  assert.throws(() => validateFile({ name: 'cover.webp', bytes: Buffer.alloc(1) }, 'image'), /does not accept/i);
  assert.throws(() => validateFile({ name: 'part.exe', bytes: Buffer.alloc(1) }, 'file'), /does not accept/i);
  const issues = validateSubmit({ publication: 'private', title: 'Test', images: [{}], files: [{ uuid: '1' }], licenseId: 5, tags: [] }).join(' ');
  assert.match(issues, /category/i);
  assert.match(issues, /original\/no-generative-AI/i);
});

test('MyMiniFactory prepare, uploads, private submit, and read-back use the captured contract', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/upload/object') && (!options.method || options.method === 'GET')) return new Response(uploadHtml, { status: 200 });
    if (String(url).endsWith('/upload/files-upload')) return new Response(JSON.stringify([{ name: 'cover.jpg', url: 'https://cdn/cover.jpg', token: 'i1', size: 10, deleteUrls: [] }]), { status: 200 });
    if (String(url).endsWith('/upload/presigned-url')) return new Response(JSON.stringify({ presignedUrl: 'https://storage/file', uploadedFileUuid: 'pending-1' }), { status: 200 });
    if (String(url) === 'https://storage/file') return new Response('', { status: 200 });
    if (String(url).endsWith('/upload/presigned-url/complete')) return new Response(JSON.stringify({ uuid: 'file-1', filename: 'part.stl' }), { status: 200 });
    if (String(url).endsWith('/upload/object') && options.method === 'POST') return new Response('', { status: 302, headers: { location: '/object/3d-print-private-test-12345' } });
    if (String(url).includes('/object/3d-print-private-test-12345')) return new Response('<meta property="og:title" content="Private test">private object', { status: 200 });
    if (String(url).endsWith('/object/edit/12345')) return new Response(`
      <input value="Private test" name="threedobject_type[name]">
      <select name="threedobject_type[visibility]"><option value="0" selected>Private</option><option value="2">Public</option></select>
      <input name="categories" value="[60,462]">
      <input name="threedobject_type[images][0][fileName]" value="cover.jpg">
      <a href="/download/12345?downloadfile=part.stl">part.stl</a>
    `, { status: 200 });
    throw new Error(`Unexpected request ${url}`);
  };
  const client = createMyMiniFactoryDirectClient({ fetchImpl, uuid: () => 'upload-session' });
  const prepared = await client.prepare(context);
  const image = await client.uploadImage(context, prepared.uploadSessionId, { name: 'cover.jpg', mimeType: 'image/jpeg', bytes: Buffer.from('image') });
  const file = await client.uploadFile(context, prepared.uploadSessionId, { name: 'part.stl', mimeType: 'model/stl', bytes: Buffer.from('solid test') });
  const saved = await client.submit(context, {
    uploadSessionId: prepared.uploadSessionId, publication: 'private', title: 'Private test', description: '<p>Test</p>',
    images: [image], files: [file], tags: ['test'], categoryIds: [60, 462], licenseId: 5, confirmOriginalNoAi: true,
  });
  const readback = await client.status(context, saved.url);
  assert.equal(saved.url, 'https://www.myminifactory.com/object/3d-print-private-test-12345');
  assert.equal(readback.title, 'Private test');
  assert.equal(saved.id, '12345');
  assert.equal(readback.visibility, 'private');
  assert.equal(readback.private, true);
  assert.deepEqual(readback.categoryIds, [60, 462]);
  assert.deepEqual(readback.imageNames, ['cover.jpg']);
  assert.deepEqual(readback.fileNames, ['part.stl']);
  const submit = calls.find((call) => call.url.endsWith('/upload/object') && call.options.method === 'POST');
  assert.match(submit.options.body, /threedobject_temp_type%5Bvisibility%5D=0/);
  assert.match(submit.options.body, /threedobject_temp_type%5B_token%5D=csrf-1/);
  assert.match(submit.options.body, /primary_image=cover.jpg/);
  assert.match(submit.options.body, /categories=%5B60%2C462%5D/);
});

test('MyMiniFactory read-back recovers categories from the React payload before hydration', async () => {
  const editHtml = `
    <input name="threedobject_type[name]" value="Private test">
    <select name="threedobject_type[visibility]"><option value="0" selected>Private</option></select>
    <script type="application/json" class="js-react-on-rails-component" data-component-name="UploadCategories">{"selectedCategories":[{"id":60,"name":"Toys"},{"id":462,"name":"Articulated"}]}</script>
    <input name="threedobject_type[images][0][fileName]" value="cover.jpg">
    <a href="/download/123?downloadfile=part.stl">part.stl</a>
  `;
  const client = createMyMiniFactoryDirectClient({
    fetchImpl: async (url) => new Response(String(url).includes('/object/edit/123') ? editHtml : '<title>Private test</title>', { status: 200 }),
  });

  const readback = await client.status({ cookie: 'session=ok' }, 'https://www.myminifactory.com/object/3d-print-private-test-123');
  assert.deepEqual(readback.categoryIds, [60, 462]);
});

test('MyMiniFactory read-back recovers files from the UploadFilesWrapper payload before hydration', async () => {
  const editHtml = `
    <input name="threedobject_type[name]" value="Private test">
    <select name="threedobject_type[visibility]"><option value="0" selected>Private</option></select>
    <input name="categories" value="[60,462]">
    <input name="threedobject_type[images][0][fileName]" value="cover.jpg">
    <script type="application/json" class="js-react-on-rails-component" data-component-name="UploadFilesWrapper">{"objectId":123,"archiveFiles":[],"files":[{"id":3,"filename":"profile.3mf","download_url":"https:\/\/www.myminifactory.com\/download\/123?downloadfile=profile.3mf"},{"id":2,"filename":"part-M.stl"},{"id":1,"filename":"part-S.stl"}]}</script>
  `;
  const client = createMyMiniFactoryDirectClient({
    fetchImpl: async (url) => new Response(String(url).includes('/object/edit/123') ? editHtml : '<title>Private test</title>', { status: 200 }),
  });

  const readback = await client.status({ cookie: 'session=ok' }, 'https://www.myminifactory.com/object/3d-print-private-test-123');
  assert.deepEqual(readback.fileNames, ['profile.3mf', 'part-M.stl', 'part-S.stl']);
});

test('MyMiniFactory loads the current category taxonomy from the authenticated endpoint', async () => {
  const client = createMyMiniFactoryDirectClient({
    fetchImpl: async (url) => {
      assert.equal(String(url), 'https://www.myminifactory.com/api/store/categories');
      return new Response(JSON.stringify([{ id: 60, name: 'Toys', children: [{ id: 462, name: 'Articulated', children: [] }] }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.deepEqual(await client.categories(context), [{ id: 60, name: 'Toys', children: [{ id: 462, name: 'Articulated', children: [] }] }]);
});

test('MyMiniFactory can reuse Electron Chromium networking for passwordless sessions', async () => {
  const calls = [];
  const client = createMyMiniFactoryDirectClient({
    managedSession: true,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(uploadHtml, { status: 200 });
    },
  });
  const identity = await client.whoami({ cookie: 'session=passwordless', userAgent: 'Electron-authenticated-UA' });
  assert.equal(identity.username, 'iamdjem');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.headers.Cookie, 'session=passwordless');
  assert.equal(calls[0].options.headers['User-Agent'], 'Electron-authenticated-UA');
});

test('managed MyMiniFactory submit follows Chromium redirect and reads the final object URL', async () => {
  const calls = [];
  const client = createMyMiniFactoryDirectClient({
    managedSession: true,
    uuid: () => 'managed-upload-session',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith('/upload/object') && (!options.method || options.method === 'GET')) {
        return new Response(uploadHtml, { status: 200 });
      }
      if (String(url).endsWith('/upload/object') && options.method === 'POST') {
        assert.equal(options.redirect, 'follow');
        const followed = new Response('<meta property="og:title" content="Managed private test">private object', { status: 200 });
        Object.defineProperties(followed, {
          redirected: { value: true },
          url: { value: 'https://www.myminifactory.com/object/3d-print-managed-private-test-67890' },
        });
        return followed;
      }
      throw new Error(`Unexpected request ${url}`);
    },
  });
  const prepared = await client.prepare(context);
  const saved = await client.submit(context, {
    uploadSessionId: prepared.uploadSessionId,
    publication: 'private',
    title: 'Managed private test',
    images: [{ name: 'cover.jpg' }],
    files: [{ uuid: 'file-1' }],
    tags: [],
    categoryIds: [60, 462],
    licenseId: 5,
    confirmOriginalNoAi: true,
  });

  assert.equal(saved.url, 'https://www.myminifactory.com/object/3d-print-managed-private-test-67890');
  assert.equal(calls.at(-1).options.redirect, 'follow');
});

test('MyMiniFactory submit surfaces safe HTTP failure diagnostics without request secrets', async () => {
  const client = createMyMiniFactoryDirectClient({
    managedSession: true,
    uuid: () => 'diagnostic-upload-session',
    fetchImpl: async (url, options = {}) => {
      if (String(url).endsWith('/upload/object') && (!options.method || options.method === 'GET')) {
        return new Response(uploadHtml, { status: 200 });
      }
      if (String(url).endsWith('/upload/object') && options.method === 'POST') {
        return new Response('<html><title>Internal Server Error</title><div class="alert-danger">Uploaded files are still processing.</div><input value="csrf-should-not-leak"></html>', {
          status: 500,
          headers: { 'content-type': 'text/html; charset=utf-8', 'x-request-id': 'request-123' },
        });
      }
      throw new Error(`Unexpected request ${url}`);
    },
  });
  const prepared = await client.prepare({ cookie: 'session=secret-cookie' });
  await assert.rejects(
    () => client.submit({ cookie: 'session=secret-cookie' }, {
      uploadSessionId: prepared.uploadSessionId,
      publication: 'private',
      title: 'Diagnostic private test',
      images: [{ name: 'cover.jpg' }],
      files: [{ uuid: 'file-secret-uuid' }],
      tags: [],
      categoryIds: [60, 462],
      licenseId: 5,
      confirmOriginalNoAi: true,
    }),
    (error) => {
      assert.match(error.message, /HTTP 500/);
      assert.match(error.message, /\/upload\/object/);
      assert.match(error.message, /text\/html/);
      assert.match(error.message, /1 images, 1 files, 2 categories/);
      assert.match(error.message, /Uploaded files are still processing/);
      assert.match(error.message, /request-123/);
      assert.doesNotMatch(error.message, /secret-cookie|csrf-should-not-leak|file-secret-uuid/);
      return true;
    },
  );
});
