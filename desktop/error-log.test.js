const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { redact, sanitizeEntry, appendEntry, parseLog, summarize } = require('./error-log');

test('packaged desktop allowlist includes the diagnostics log module', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(pkg.build.files.includes('error-log.js'));
});

test('redacts credentials, signed URLs, and token blobs', () => {
  assert.match(redact('token: abc123def'), /token=\[redacted\]/);
  assert.match(redact('Cookie=cf_clearance=xyz'), /\[redacted\]/);
  assert.match(redact('Authorization: Bearer abcdef'), /Authorization=\[redacted\]/i);
  assert.equal(redact('GET https://s3.example.com/file.stl?X-Amz-Signature=deadbeef&k=v'), 'GET https://s3.example.com/file.stl?[redacted]');
  assert.equal(redact('id ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdef'), 'id [redacted]');
  assert.equal(redact('a normal error message'), 'a normal error message');
});

test('sanitizeEntry bounds fields and normalizes source/kind', () => {
  const e = sanitizeEntry({
    source: 'evil', kind: 'nope', message: 'x'.repeat(5000),
    stack: 'token=secret999999\n' + 'y'.repeat(5000), context: 'route /publish', build: 'BUILD abc; rm -rf',
  }, '2026-08-04T12:00:00Z');
  assert.equal(e.source, 'renderer'); // unknown source coerced
  assert.equal(e.kind, 'rendererError');
  assert.equal(e.at, '2026-08-04T12:00:00Z');
  assert.ok(e.message.length <= 1000);
  assert.ok(e.stack.length <= 4000);
  assert.match(e.stack, /token=\[redacted\]/);
  assert.equal(e.context, 'route /publish');
  assert.equal(e.build, 'BUILD abc rm -rf'); // punctuation stripped
});

test('appendEntry caps the log to the most recent entries', () => {
  let log = [];
  for (let i = 0; i < 250; i += 1) log = appendEntry(log, { message: `e${i}` }, 200);
  assert.equal(log.length, 200);
  assert.equal(log[0].message, 'e50');
  assert.equal(log[log.length - 1].message, 'e249');
});

test('parseLog tolerates corrupt input', () => {
  assert.deepEqual(parseLog('[{"message":"ok"}]'), [{ message: 'ok' }]);
  assert.deepEqual(parseLog('{not json'), []);
  assert.deepEqual(parseLog(''), []);
});

test('summarize produces a short readable digest', () => {
  assert.match(summarize([]), /No recent errors/);
  const digest = summarize([
    { at: 't1', source: 'main', kind: 'uncaughtException', message: 'boom\nmore' },
    { at: 't2', source: 'renderer', kind: 'rendererError', message: 'oops' },
  ]);
  assert.match(digest, /main\/uncaughtException: boom/);
  assert.match(digest, /renderer\/rendererError: oops/);
  assert.ok(!digest.includes('more')); // only first line
});
