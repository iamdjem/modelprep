// Bridges the ModelPrep web app (renderer) to the desktop sign-in. Exposes a tiny, safe
// API on window.modelprepDesktop — the React app feature-detects it to show a one-click
// "Sign in to MakerWorld" button instead of the cookie-paste box.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('modelprepDesktop', {
  isDesktop: true,
  // Opens MakerWorld login (or reuses an existing session) → { ok, cookie } | { ok:false, error }
  connectMakerWorld: () => ipcRenderer.invoke('mw:connect'),
  // { connected: boolean }
  makerWorldStatus: () => ipcRenderer.invoke('mw:status'),
  // Clears the embedded MakerWorld session.
  disconnectMakerWorld: () => ipcRenderer.invoke('mw:disconnect'),
});
