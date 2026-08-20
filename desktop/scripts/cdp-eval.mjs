#!/usr/bin/env node

const expression = process.argv.slice(2).join(' ');
if (!expression) throw new Error('Usage: node scripts/cdp-eval.mjs <JavaScript expression>');

const targets = await fetch('http://127.0.0.1:9222/json').then((response) => response.json());
const requestedTargetId = process.env.MODELPREP_CDP_TARGET_ID;
const target = (requestedTargetId ? targets.find((entry) => entry.id === requestedTargetId) : null)
  || targets.find((entry) => entry.type === 'page' && /ModelPrep/i.test(entry.title || ''))
  || targets.find((entry) => entry.type === 'page');
if (!target?.webSocketDebuggerUrl) throw new Error('No ModelPrep CDP page target found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

const id = 1;
socket.send(JSON.stringify({
  id,
  method: 'Runtime.evaluate',
  params: { expression, awaitPromise: true, returnByValue: true },
}));

const message = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('CDP evaluation timed out.')), 15_000);
  socket.addEventListener('message', (event) => {
    const value = JSON.parse(String(event.data));
    if (value.id !== id) return;
    clearTimeout(timer);
    resolve(value);
  });
});
socket.close();
if (message.error) throw new Error(message.error.message || JSON.stringify(message.error));
if (message.result?.exceptionDetails) {
  throw new Error(message.result.exceptionDetails.exception?.description || message.result.exceptionDetails.text);
}
process.stdout.write(`${JSON.stringify(message.result?.result?.value ?? null, null, 2)}\n`);
