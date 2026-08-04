// Local AI servers (Ollama, LM Studio) seen from the desktop app.
//
// Two jobs, both of which only the main process can do:
//   1. Detection. The renderer is a remotely loaded page, so a request to http://localhost is
//      a cross-origin call that the server must opt into (Ollama's OLLAMA_ORIGINS). Asking a
//      maker to set an environment variable before they can use a free local model is a bad
//      first run. From here it is an ordinary HTTP call and simply works.
//   2. Which models can see. A listing starts from photos, so a text-only model is not a
//      candidate — Ollama reports `capabilities`, LM Studio reports `vision`.
//
// Requests are pinned to loopback. A base URL that resolves anywhere else is refused, so this
// bridge can never be pointed at a remote host by whatever ends up in renderer settings.

const OLLAMA_BASE = 'http://localhost:11434';
const LMSTUDIO_BASE = 'http://localhost:1234';
const PROBE_TIMEOUT_MS = 2_500;      // a local server answers instantly or is not there
const CHAT_TIMEOUT_MS = 180_000;
const MAX_MODELS_INSPECTED = 24;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/** Loopback-only guard for every URL this module will fetch. */
function assertLoopback(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl)); } catch { throw new Error(`invalid local URL: ${rawUrl}`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`unsupported protocol: ${url.protocol}`);
  if (!LOOPBACK_HOSTS.has(url.hostname)) throw new Error(`only local servers are allowed, got ${url.hostname}`);
  return url;
}

async function getJson(url, { fetchImpl = fetch, timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  assertLoopback(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function postJson(url, body, { fetchImpl = fetch, timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  assertLoopback(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

/** Ollama: /api/tags lists what is pulled, /api/show says whether a model can see. */
async function probeOllama({ fetchImpl, base = OLLAMA_BASE } = {}) {
  let tags;
  try { tags = await getJson(`${base}/api/tags`, { fetchImpl }); }
  catch (error) { return { available: false, models: [], error: notRunning(error, 'Ollama') }; }

  const names = (Array.isArray(tags?.models) ? tags.models : [])
    .map((m) => String(m?.name || m?.model || '')).filter(Boolean).slice(0, MAX_MODELS_INSPECTED);
  const vision = await Promise.all(names.map(async (name) => {
    try {
      const info = await postJson(`${base}/api/show`, { model: name }, { fetchImpl });
      return (info?.capabilities || []).includes('vision') ? name : null;
    } catch { return null; }
  }));
  const models = vision.filter(Boolean).map((slug) => ({ slug, label: slug }));
  return {
    available: true,
    models,
    // Pulled models but none that can see: the maker needs a different pull, not a reinstall.
    error: names.length && !models.length
      ? { code: 'model', message: 'No vision model is installed. Run `ollama pull llama3.2-vision`.' }
      : (!names.length ? { code: 'model', message: 'No models installed yet. Run `ollama pull llama3.2-vision`.' } : null),
  };
}

/** LM Studio: /api/v0/models carries a `vision` flag; the OpenAI-shaped route does not. */
async function probeLmStudio({ fetchImpl, base = LMSTUDIO_BASE } = {}) {
  let listing;
  try { listing = await getJson(`${base}/api/v0/models`, { fetchImpl }); }
  catch {
    try { listing = await getJson(`${base}/v1/models`, { fetchImpl }); }
    catch (error) { return { available: false, models: [], error: notRunning(error, 'LM Studio') }; }
  }
  const entries = Array.isArray(listing?.data) ? listing.data : [];
  const loaded = entries.filter((m) => m?.state !== 'not-loaded');
  // Only filter when the payload actually tells us about vision; the OpenAI-shaped fallback
  // has no such field and guessing would hide working models.
  const knowsVision = entries.some((m) => typeof m?.vision === 'boolean');
  const usable = (knowsVision ? loaded.filter((m) => m.vision) : loaded)
    .map((m) => String(m?.id || '')).filter(Boolean).slice(0, MAX_MODELS_INSPECTED);
  return {
    available: true,
    models: usable.map((slug) => ({ slug, label: slug })),
    error: usable.length ? null : { code: 'model', message: 'No vision model is loaded. Load one in LM Studio, then check again.' },
  };
}

function notRunning(error, name) {
  const detail = String(error?.message || error || '');
  return {
    code: 'offline',
    message: /abort/i.test(detail) ? `${name} did not respond.` : `${name} is not running on this computer.`,
  };
}

/** Everything the AI settings panel needs about local servers, in one round trip. */
async function detectLocalAi({ fetchImpl = fetch, ollamaBase, lmStudioBase } = {}) {
  const [ollama, lmstudio] = await Promise.all([
    probeOllama({ fetchImpl, base: ollamaBase }).catch((error) => ({ available: false, models: [], error: notRunning(error, 'Ollama') })),
    probeLmStudio({ fetchImpl, base: lmStudioBase }).catch((error) => ({ available: false, models: [], error: notRunning(error, 'LM Studio') })),
  ]);
  return { ollama, lmstudio };
}

/** Proxy one OpenAI-compatible chat call to a local server, so the renderer never has to make
 *  a cross-origin request the maker would have to configure the server to accept. */
async function localChat({ baseUrl, model, messages, fetchImpl = fetch, timeoutMs = CHAT_TIMEOUT_MS }) {
  const url = `${String(baseUrl || '').replace(/\/$/, '')}/chat/completions`;
  assertLoopback(url);
  if (!model) throw new Error('no model chosen');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
    const data = JSON.parse(text);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('empty model response');
    return { text: String(content) };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('local model timed out');
    throw error;
  } finally { clearTimeout(timer); }
}

module.exports = {
  LMSTUDIO_BASE,
  OLLAMA_BASE,
  assertLoopback,
  detectLocalAi,
  localChat,
  probeLmStudio,
  probeOllama,
};
