import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const deployDir = fileURLToPath(new URL('../', import.meta.url));
const markerPath = fileURLToPath(new URL('../dist/version.json', import.meta.url));
const vitestPath = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));

function readMarker() {
  try {
    return readFileSync(markerPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

const before = readMarker();
const result = spawnSync(process.execPath, [vitestPath, 'run', ...process.argv.slice(2)], {
  cwd: deployDir,
  stdio: 'inherit',
});
const after = readMarker();
const markerChanged = before === null
  ? after !== null
  : after === null || !before.equals(after);

if (markerChanged) {
  if (before === null) rmSync(markerPath, { force: true });
  else writeFileSync(markerPath, before);
  console.error('Frontend tests mutated dist/version.json; restored the original marker.');
}

if (result.error) throw result.error;
process.exitCode = markerChanged ? 1 : (result.status ?? 1);
