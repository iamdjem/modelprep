const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createWindowFetch, createCultsFetchRouter, createPacedFetch, buildFetchScript, buildRequestDescriptor, FORBIDDEN_REQUEST_HEADERS, DEFAULT_MAX_BODY_BYTES } = require('./cults-window-fetch');

// Run the generated in-page script inside a sandbox that fakes the page's
// fetch/atob/btoa, so we cover the actual code that runs inside the Cults window.
function runInFakePage(script, fakeFetch) {
  const sandbox = {
    fetch: fakeFetch,
    atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
    btoa: (bin) => Buffer.from(bin, 'binary').toString('base64'),
    Uint8Array,
    String,
    Object,
  };
  return vm.runInNewContext(script, sandbox);
}

test('packaged desktop allowlist includes the in-app window fetch', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(pkg.build.files.includes('cults-window-fetch.js'));
});

test('descriptor strips browser-forbidden headers and base64-encodes the body', async () => {
  const d = await buildRequestDescriptor('https://cults3d.com/x', {
    method: 'post',
    headers: { 'Content-Type': 'application/json', Cookie: 'secret=1', 'User-Agent': 'x', 'X-CSRF-Token': 't' },
    body: Buffer.from('hello'),
  });
  assert.equal(d.method, 'POST');
  assert.equal(d.headers['X-CSRF-Token'], 't');
  assert.equal(d.headers['Content-Type'], 'application/json');
  assert.equal('Cookie' in d.headers, false);
  assert.equal('User-Agent' in d.headers, false);
  assert.equal(Buffer.from(d.bodyBase64, 'base64').toString(), 'hello');
  assert.ok(FORBIDDEN_REQUEST_HEADERS.has('cookie'));
});

test('in-page script performs the fetch and returns an encoded envelope', async () => {
  const script = buildFetchScript(await buildRequestDescriptor('https://cults3d.com/en/creations/new', { headers: { Accept: 'text/html' } }));
  const fakeFetch = async (url, init) => {
    assert.equal(url, 'https://cults3d.com/en/creations/new');
    assert.equal(init.credentials, 'include');
    return {
      status: 200, statusText: 'OK', redirected: false, url,
      headers: new Map([['content-type', 'text/html']]),
      arrayBuffer: async () => new TextEncoder().encode('<form>csrf</form>').buffer,
    };
  };
  const env = await runInFakePage(script, fakeFetch);
  assert.equal(env.status, 200);
  assert.equal(env.headers['content-type'], 'text/html');
  assert.match(Buffer.from(env.bodyBase64, 'base64').toString(), /csrf/);
});

test('manual-redirect requests re-synthesize a 302 with the final URL', async () => {
  const script = buildFetchScript(await buildRequestDescriptor('https://cults3d.com/en/creations/new', { redirect: 'manual' }));
  const fakeFetch = async () => ({
    status: 200, statusText: 'OK', redirected: true, url: 'https://cults3d.com/en/users/sign-in',
    headers: new Map(), arrayBuffer: async () => new ArrayBuffer(0),
  });
  const env = await runInFakePage(script, fakeFetch);
  assert.equal(env.status, 302);
  assert.equal(env.headers.location, 'https://cults3d.com/en/users/sign-in');
});

test('createWindowFetch turns the envelope into a real Response', async () => {
  const executeInPage = async (code) => runInFakePage(code, async (url) => ({
    status: 200, statusText: 'OK', redirected: false, url,
    headers: new Map([['content-type', 'application/json']]),
    arrayBuffer: async () => new TextEncoder().encode('{"ok":true}').buffer,
  }));
  const fetchImpl = createWindowFetch({ executeInPage });
  const res = await fetchImpl('https://cults3d.com/api', { headers: { Accept: 'application/json' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.deepEqual(await res.json(), { ok: true });
});

test('an in-page error surfaces as a rejected fetch', async () => {
  const executeInPage = async () => ({ error: 'Cloudflare challenge in page' });
  const fetchImpl = createWindowFetch({ executeInPage });
  await assert.rejects(() => fetchImpl('https://cults3d.com/x'), /Cloudflare challenge in page/);
});

test('a dead window surfaces a clear unavailable error', async () => {
  const executeInPage = async () => { throw new Error('Object has been destroyed'); };
  const fetchImpl = createWindowFetch({ executeInPage });
  await assert.rejects(() => fetchImpl('https://cults3d.com/x'), /in-app window is unavailable/);
});

// A bare "Failed to fetch" from the page is the least useful thing this
// transport can say: it carries the entire upload as one base64 blob inside a
// script, so large publishes fail here and nowhere else, and the size is the
// single most diagnostic fact.
test('a page-fetch failure reports the method, body size and endpoint', async () => {
  const windowFetch = createWindowFetch({
    executeInPage: async () => ({ error: 'Failed to fetch' }),
    Response: global.Response,
  });
  await assert.rejects(
    () => windowFetch('https://cults3d.com/api/upload?sig=SECRET', { method: 'POST', body: Buffer.alloc(3 * 1024 * 1024) }),
    (error) => {
      assert.match(error.message, /Failed to fetch/);
      assert.match(error.message, /POST/);
      assert.match(error.message, /3,145,728 bytes/, 'the size is what identifies an oversized publish');
      assert.match(error.message, /cults3d\.com\/api\/upload/);
      assert.ok(!error.message.includes('SECRET'), 'signed-URL query strings stay out of the message');
      return true;
    },
  );
});

test('a bodyless failure still names the request', async () => {
  const windowFetch = createWindowFetch({
    executeInPage: async () => ({ error: 'NetworkError' }),
    Response: global.Response,
  });
  await assert.rejects(
    () => windowFetch('https://cults3d.com/en/my/creations', {}),
    /NetworkError \(GET\) while calling https:\/\/cults3d\.com\/en\/my\/creations/,
  );
});

// The bug that broke every real Cults3D upload: FormData has no meaningful
// toString(), so it used to encode as the 17-byte string "[object FormData]".
// S3 rejected the malformed POST and, with no CORS headers on the error, the
// page reported only "Failed to fetch".
test('a FormData body is encoded as real multipart, not "[object FormData]"', async () => {
  const form = new FormData();
  form.set('key', 'uploads/Ram.stl');
  form.set('file', new Blob([Buffer.alloc(2048, 7)], { type: 'model/stl' }), 'Ram.stl');

  const d = await buildRequestDescriptor('https://s3.example/files', { method: 'POST', body: form });
  const body = Buffer.from(d.bodyBase64, 'base64');

  assert.ok(body.byteLength > 2048, `multipart body should carry the file, got ${body.byteLength} bytes`);
  assert.equal(body.includes('[object FormData]'), false);
  assert.match(body.toString('latin1'), /name="key"/);
  assert.match(body.toString('latin1'), /filename="Ram\.stl"/);
});

test('multipart requests carry the Content-Type whose boundary is actually in the body', async () => {
  const form = new FormData();
  form.set('key', 'uploads/x');
  // A caller-set Content-Type must lose: its boundary is not the one used.
  const d = await buildRequestDescriptor('https://s3.example/files', {
    method: 'POST', body: form, headers: { 'Content-Type': 'multipart/form-data' },
  });
  const contentType = d.headers['Content-Type'];
  assert.match(contentType, /^multipart\/form-data; boundary=/);
  const boundary = contentType.split('boundary=')[1];
  assert.ok(Buffer.from(d.bodyBase64, 'base64').toString('latin1').includes(boundary));
});

test('the size guard clears real mesh files but still refuses a runaway', async () => {
  // 87MB STLs are ordinary on Cults3D; the old 64MB ceiling rejected them.
  assert.ok(DEFAULT_MAX_BODY_BYTES >= 128 * 1024 * 1024);
  await assert.rejects(
    buildRequestDescriptor('https://s3.example/files', { method: 'POST', body: Buffer.alloc(2048) }, 1024),
    /exceeds the 1024-byte limit/,
  );
});

test('signed Cults storage posts bypass page CORS while Cults requests stay in-page', async () => {
  const calls = [];
  const routed = createCultsFetchRouter({
    pageFetch: async (url) => { calls.push(['page', String(url)]); return 'page'; },
    storageFetch: async (url) => { calls.push(['storage', String(url)]); return 'storage'; },
  });

  assert.equal(await routed('https://cults3d.com/en/file_uploaders/new?blueprint=true'), 'page');
  assert.equal(await routed('https://s3.eu-west-3.amazonaws.com/files.cults3d.com', { method: 'POST' }), 'storage');
  assert.equal(await routed('https://files.cults3d.com/example.webp'), 'page');
  assert.deepEqual(calls.map(([transport]) => transport), ['page', 'storage', 'page']);
});

test('Cults first-party requests are serialized instead of bursting into Cloudflare', async () => {
  let active = 0;
  let peak = 0;
  const starts = [];
  const paced = createPacedFetch(async (value) => {
    starts.push(Date.now());
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 4));
    active -= 1;
    return value;
  }, 8);
  assert.deepEqual(await Promise.all([paced('one'), paced('two'), paced('three')]), ['one', 'two', 'three']);
  assert.equal(peak, 1);
  assert.ok(starts[1] - starts[0] >= 6);
  assert.ok(starts[2] - starts[1] >= 6);
});
