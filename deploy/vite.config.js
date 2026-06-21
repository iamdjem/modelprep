import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Stamp the build with the git commit + time so the running app can show exactly
// which version it is (makes it obvious you're testing the latest changes).
const commit = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; }
})();
const buildTime = new Date().toISOString();

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    // Emit dist/version.json so the running app can detect when a newer build is live.
    { name: 'emit-version', closeBundle() { writeFileSync(resolve(__dirname, 'dist/version.json'), JSON.stringify({ commit, time: buildTime })); } },
  ],
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
