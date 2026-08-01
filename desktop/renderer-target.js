const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEFAULT_REMOTE_URL = 'https://iamdjem.github.io/modelprep/';

function resolveRendererTarget({
  overrideUrl = '',
  isPackaged = false,
  resourcesPath = '',
  remoteUrl = DEFAULT_REMOTE_URL,
} = {}) {
  if (String(overrideUrl || '').trim()) {
    return { kind: 'url', value: String(overrideUrl).trim() };
  }
  if (isPackaged) {
    if (!resourcesPath) throw new Error('Packaged renderer resources path is missing.');
    return { kind: 'file', value: path.join(resourcesPath, 'renderer', 'index.html') };
  }
  return { kind: 'url', value: remoteUrl };
}

function isRendererNavigation(url, target) {
  if (!url || !target?.value) return false;
  if (target.kind === 'file') return url.startsWith(pathToFileURL(target.value).href);
  return url.startsWith(target.value) || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
}

module.exports = {
  DEFAULT_REMOTE_URL,
  resolveRendererTarget,
  isRendererNavigation,
};
