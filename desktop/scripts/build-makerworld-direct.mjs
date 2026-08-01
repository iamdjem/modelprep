import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [path.join(desktopDir, 'makerworld-direct-entry.ts')],
  outfile: path.join(desktopDir, 'makerworld-direct.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: false,
  logLevel: 'info',
});
