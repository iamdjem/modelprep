const assert = require('node:assert/strict'); const test = require('node:test'); const { buildThingPayload, createThingiverseDirectClient, isCloudflareChallenge, validateUpload } = require('./thingiverse-direct');
const input = { name: 'Dragon', summary: 'A dragon', categoryId: '12', license: 'cc-nc', files: [{ id: 'p1', role: 'model' }], publish: false };
test('Thingiverse validates media and builds the browser-captured editor payload', () => { assert.doesNotThrow(() => validateUpload('model', { name: 'part.stl', bytes: Buffer.alloc(1) })); assert.throws(() => validateUpload('image', { name: 'hero.jpg', bytes: Buffer.alloc(5 * 1024 * 1024 + 1) }), /5 MB/); const payload = buildThingPayload({ ...input, nsfw: true }); assert.equal(payload.license, 'cc-nc'); assert.equal(payload.category, 12); assert.deepEqual(payload.files, [{ id: 'p1', type: 'pending' }]); assert.deepEqual(payload.tags, ['NSFW']); assert.deepEqual(payload.details_parts, [{ type: 'summary', data: [{ content: 'A dragon' }] }]); assert.deepEqual(payload.included_apps, []); assert.deepEqual(payload.edu_details_parts.map((part) => part.type), ['skills', 'duration', 'overview', 'plan', 'materials', 'prep', 'assessment', 'references', 'grades', 'subjects', 'standards']); });
test('Thingiverse carries the full description in the Thing body, not a custom section', () => { const payload = buildThingPayload({ ...input, description: '# Dragon\n\nFull Markdown description.', sections: [{ title: 'Assembly', content: 'Snap the tail into place.' }] }); const body = 'A dragon\n\n# Dragon\n\nFull Markdown description.'; assert.deepEqual(payload.details_parts, [{ type: 'summary', data: [{ content: body }] }, { type: 'custom', name: 'Assembly', data: [{ title: '', content: 'Snap the tail into place.' }] }]); assert.equal(payload.description, body); });
test('Thingiverse sends a settings part only when print settings exist, and no bare filler parts', () => { const payload = buildThingPayload({ ...input, printSettings: { supports: 'None', infill: '15%' } }); assert.deepEqual(payload.details_parts, [{ type: 'summary', data: [{ content: 'A dragon' }] }, { type: 'settings', data: [{ supports: 'None', infill: '15%' }] }]); assert.equal(payload.details_parts.some((part) => ['tips', 'design'].includes(part.type) || (part.type === 'custom' && !part.data)), false); });
test('Thingiverse Customizer fails closed unless a SCAD model file was uploaded', () => { assert.throws(() => buildThingPayload({ ...input, customizable: true }), /Customizer requires at least one \.SCAD/); assert.doesNotThrow(() => buildThingPayload({ ...input, customizable: true, files: [{ id: 'p1', role: 'model', name: 'customizer.scad' }] })); });
test('Thingiverse retains an explicit emergency mutation override', async () => { const client = createThingiverseDirectClient({ legalApproved: false }); await assert.rejects(() => client.save({ apiToken: 'token', cookie: 'x' }, input), /written API-license approval/); });
test('Thingiverse cleared default flow uploads, creates, finalizes and reads every editor surface back', async () => { const calls = []; const fetchImpl = async (url, init = {}) => { calls.push([new URL(url).pathname, init.method || 'GET', init.headers]); if (String(url).endsWith('/uploadFile')) return new Response(JSON.stringify({ id: 41 }), { status: 200 }); if (String(url).endsWith('/api/things')) return new Response(JSON.stringify({ id: 55 }), { status: 200 }); return new Response(JSON.stringify({ id: 55, name: 'Dragon' }), { status: 200 }); }; const client = createThingiverseDirectClient({ fetchImpl }); const context = { apiToken: 'ajax-api-token', accessToken: 'jwt-access-token', cookie: 'x' }; const file = await client.upload(context, 'model', { name: 'part.stl', bytes: Buffer.from('x') }); assert.equal(file.id, 41); const saved = await client.save(context, { ...input, files: [file] }); await client.status(context, saved.id); assert.deepEqual(calls.map((v) => v[0]), ['/api/files/0/uploadFile', '/api/things', '/api/files/0/FinalizeFiles', '/api/things/55/edit', '/api/things/55/files', '/api/things/55/images']); assert.equal(calls.every((call) => call[2].Authorization === 'Bearer ajax-api-token'), true); });
test('Thingiverse verifies identity with the browser-proven JWT request', async () => { let call; const client = createThingiverseDirectClient({ fetchImpl: async (url, init) => { call = [String(url), init]; return new Response(JSON.stringify({ id: 42, name: 'iamdjem' }), { status: 200 }); } }); assert.equal((await client.whoami({ accessToken: 'jwt-access', cookie: 'x' })).nickname, 'iamdjem'); assert.equal(call[0], 'https://www.thingiverse.com/api/v2/users/me'); assert.equal(call[1].headers.Authorization, 'Bearer jwt-access'); assert.equal(call[1].headers.Cookie, undefined); assert.equal(call[1].credentials, 'include'); });
test('Thingiverse rejects cookie and JWT-only sessions for uploads', async () => { const client = createThingiverseDirectClient({ fetchImpl: async () => new Response('{}', { status: 200 }) }); await assert.rejects(() => client.upload({ cookie: 'x', accessToken: 'jwt-only' }, 'model', { name: 'part.stl', bytes: Buffer.from('x') }), /API token is missing/i); });

// Cloudflare's interstitial is a 403 HTML page. It means the request never
// reached Thingiverse, so it is not a verdict on the session, and it must not be
// reported as one (or pasted into the UI as a page of HTML).
test('a Cloudflare check is reported as a check, not as a dead session', async () => {
  const challenge = '<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">';
  const client = createThingiverseDirectClient({ fetchImpl: async () => new Response(challenge, { status: 403 }) });
  await assert.rejects(
    () => client.whoami({ accessToken: 'jwt-access' }),
    (error) => {
      assert.equal(error.code, 'cloudflare_challenge');
      assert.match(error.message, /Cloudflare check/);
      assert.doesNotMatch(error.message, /not authenticated/);
      assert.doesNotMatch(error.message, /DOCTYPE/);
      return true;
    },
  );
});

test('a real rejection from Thingiverse still reads as a real rejection', async () => {
  const client = createThingiverseDirectClient({
    fetchImpl: async () => new Response(JSON.stringify({ error: 'Access Denied. The user is not appropriately authenticated.', code: 401 }), { status: 401 }),
  });
  await assert.rejects(
    () => client.whoami({ accessToken: 'stale' }),
    (error) => {
      assert.equal(error.code, undefined);
      assert.match(error.message, /not authenticated \(HTTP 401/);
      return true;
    },
  );
});

test('the challenge test knows a challenge from ordinary HTML', () => {
  assert.equal(isCloudflareChallenge('<title>Just a moment...</title>'), true);
  assert.equal(isCloudflareChallenge('{"error":"Access Denied","code":401}'), false);
  assert.equal(isCloudflareChallenge(''), false);
});
