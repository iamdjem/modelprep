'use strict';

// Privacy-safe local diagnostics log. Beta builds need to know what breaks on
// other people's machines, but ModelPrep never ships raw platform data off the
// device. So crashes and errors are captured LOCALLY, sanitized (secrets,
// signed URLs, and long token-shaped blobs redacted), capped, and only leave
// the machine when the user explicitly exports or reports them.

const MAX_ENTRIES = 200;
const SOURCES = new Set(['main', 'renderer']);
const KINDS = new Set(['uncaughtException', 'unhandledRejection', 'rendererError', 'report']);

// Redact anything that looks like a credential, a signed URL query string, or a
// long token/key blob, before it is ever written to disk.
function redact(input) {
  let text = typeof input === 'string' ? input : String(input == null ? '' : input);
  // key: value / key=value secrets
  text = text.replace(/\b(token|cookie|authorization|bearer|password|passwd|secret|cf_clearance|refresh[_-]?token|api[_-]?key|access[_-]?token|client[_-]?secret|x-mw-cookie)\b\s*[:=]\s*[^\s;,)'"]+/gi, '$1=[redacted]');
  // signed-URL query strings (presigned S3 etc.)
  text = text.replace(/(https?:\/\/[^\s?'"]+)\?[^\s'")]+/gi, '$1?[redacted]');
  // bare long token/base64/hex blobs
  text = text.replace(/\b[A-Za-z0-9_\-]{40,}\b/g, '[redacted]');
  return text;
}

function safeSource(value) { return SOURCES.has(String(value)) ? String(value) : 'renderer'; }
function safeKind(value) { return KINDS.has(String(value)) ? String(value) : 'rendererError'; }

// Turn a raw report into a bounded, sanitized entry. `at` (ISO timestamp) is
// injected by the caller so this stays pure and testable.
function sanitizeEntry(entry = {}, at = '') {
  return {
    at: String(at || entry.at || '').slice(0, 40),
    source: safeSource(entry.source),
    kind: safeKind(entry.kind),
    message: redact(entry.message).slice(0, 1000),
    stack: redact(entry.stack).slice(0, 4000),
    context: redact(entry.context).slice(0, 500),
    build: String(entry.build || '').replace(/[^\w.\- ]/g, '').slice(0, 80),
  };
}

function appendEntry(list, entry, max = MAX_ENTRIES) {
  const next = Array.isArray(list) ? [...list, entry] : [entry];
  return next.slice(-max);
}

function parseLog(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// A short, human-readable summary for a "report a problem" prefill.
function summarize(list, limit = 5) {
  const entries = Array.isArray(list) ? list.slice(-limit) : [];
  if (!entries.length) return 'No recent errors recorded.';
  return entries
    .map((e) => `- [${e.at}] ${e.source}/${e.kind}: ${String(e.message || '').split('\n')[0].slice(0, 160)}`)
    .join('\n');
}

module.exports = { redact, sanitizeEntry, appendEntry, parseLog, summarize, MAX_ENTRIES };
