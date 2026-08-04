const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { createWindowFetch, buildFetchScript, buildRequestDescriptor, FORBIDDEN_REQUEST_HEADERS } = require('./cults-window-fetch');

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

test('descriptor strips browser-forbidden headers and base64-encodes the body', () => {
  const d = buildRequestDescriptor('https://cults3d.com/x', {
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
  const script = buildFetchScript(buildRequestDescriptor('https://cults3d.com/en/creations/new', { headers: { Accept: 'text/html' } }));
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
  const script = buildFetchScript(buildRequestDescriptor('https://cults3d.com/en/creations/new', { redirect: 'manual' }));
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
