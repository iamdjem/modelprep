const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertLoopback, detectLocalAi, localChat, probeLmStudio, probeOllama } = require('./local-ai');

const json = (body, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) });

test('packaged desktop allowlist includes the local AI module', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(packageJson.build.files.includes('local-ai.js'));
  assert.match(packageJson.scripts.test, /local-ai\.test\.js/);
});

test('only loopback addresses are reachable through this bridge', () => {
  for (const url of ['http://localhost:11434/api/tags', 'http://127.0.0.1:1234/v1/models']) {
    assert.ok(assertLoopback(url));
  }
  // Renderer-supplied settings must never be able to point this at somebody else's server.
  for (const url of ['http://evil.example.com/v1/chat/completions', 'https://api.openai.com/v1', 'file:///etc/passwd', 'nonsense']) {
    assert.throws(() => assertLoopback(url), /only local servers|unsupported protocol|invalid local URL/);
  }
});

test('Ollama detection keeps only models that can read photos', async () => {
  const fetchImpl = async (url, init) => {
    if (String(url).endsWith('/api/tags')) {
      return json({ models: [{ name: 'llama3.2-vision' }, { name: 'qwen2.5-coder' }] });
    }
    const body = JSON.parse(init.body);
    return json({ capabilities: body.model === 'llama3.2-vision' ? ['completion', 'vision'] : ['completion'] });
  };
  const probe = await probeOllama({ fetchImpl });
  assert.equal(probe.available, true);
  assert.deepEqual(probe.models, [{ slug: 'llama3.2-vision', label: 'llama3.2-vision' }]);
  assert.equal(probe.error, null);
});

test('a running Ollama with no vision model explains the exact pull to run', async () => {
  const fetchImpl = async (url, init) => {
    if (String(url).endsWith('/api/tags')) return json({ models: [{ name: 'qwen2.5-coder' }] });
    void init;
    return json({ capabilities: ['completion'] });
  };
  const probe = await probeOllama({ fetchImpl });
  assert.equal(probe.available, true);
  assert.deepEqual(probe.models, []);
  assert.match(probe.error.message, /ollama pull llama3\.2-vision/);
});

test('a stopped Ollama reads as not running rather than as an error', async () => {
  const probe = await probeOllama({ fetchImpl: async () => { throw new Error('connect ECONNREFUSED'); } });
  assert.deepEqual(probe, { available: false, models: [], error: { code: 'offline', message: 'Ollama is not running on this computer.' } });
});

test('LM Studio detection prefers the catalog that reports vision support', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(String(url));
    if (String(url).endsWith('/api/v0/models')) {
      return json({ data: [
        { id: 'llava-v1.6', state: 'loaded', vision: true },
        { id: 'qwen-coder', state: 'loaded', vision: false },
        { id: 'unloaded-vision', state: 'not-loaded', vision: true },
      ] });
    }
    return json({ data: [] });
  };
  const probe = await probeLmStudio({ fetchImpl });
  assert.deepEqual(probe.models, [{ slug: 'llava-v1.6', label: 'llava-v1.6' }]);
  assert.equal(seen.length, 1); // no need for the OpenAI-shaped fallback when v0 answered
});

test('LM Studio falls back to the OpenAI-shaped list and then keeps every model', async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/api/v0/models')) throw new Error('404');
    return json({ data: [{ id: 'some-model' }] });
  };
  const probe = await probeLmStudio({ fetchImpl });
  // That route says nothing about vision, so guessing would hide a working model.
  assert.deepEqual(probe.models, [{ slug: 'some-model', label: 'some-model' }]);
});

test('detection reports both servers together and never rejects', async () => {
  const detected = await detectLocalAi({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  assert.deepEqual(Object.keys(detected).sort(), ['lmstudio', 'ollama']);
  assert.equal(detected.ollama.available, false);
  assert.equal(detected.lmstudio.available, false);
});

test('the chat proxy posts to the local server and returns the message text', async () => {
  const seen = {};
  const fetchImpl = async (url, init) => {
    seen.url = String(url);
    seen.body = JSON.parse(init.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: '{"title":"x"}' } }] }) };
  };
  const result = await localChat({ baseUrl: 'http://localhost:11434/v1', model: 'llama3.2-vision', messages: [{ role: 'user', content: 'hi' }], fetchImpl });
  assert.equal(seen.url, 'http://localhost:11434/v1/chat/completions');
  assert.equal(seen.body.model, 'llama3.2-vision');
  assert.equal(result.text, '{"title":"x"}');
});

test('the chat proxy refuses a remote base URL, a missing model and an error response', async () => {
  await assert.rejects(
    localChat({ baseUrl: 'https://api.openai.com/v1', model: 'gpt', messages: [], fetchImpl: async () => json({}) }),
    /only local servers/,
  );
  await assert.rejects(
    localChat({ baseUrl: 'http://localhost:11434/v1', model: '', messages: [], fetchImpl: async () => json({}) }),
    /no model chosen/,
  );
  await assert.rejects(
    localChat({ baseUrl: 'http://localhost:11434/v1', model: 'm', messages: [], fetchImpl: async () => ({ ok: false, status: 500, text: async () => 'boom' }) }),
    /500/,
  );
});
