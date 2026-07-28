// Bridges the ModelPrep web app (renderer) to the desktop sign-in. Exposes a tiny, safe
// API on window.modelprepDesktop — the React app feature-detects it to show a one-click
// "Sign in to MakerWorld" button instead of the cookie-paste box.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('modelprepDesktop', {
  isDesktop: true,
  // Opens MakerWorld login (or reuses an existing session). The raw session never enters
  // the renderer; successful accounts use an opaque desktop-managed marker instead.
  connectMakerWorld: () => ipcRenderer.invoke('mw:connect'),
  loginMakerWorld: (payload) => ipcRenderer.invoke('mw:login', payload),
  storeMakerWorldSession: (cookie) => ipcRenderer.invoke('mw:store-session', cookie),
  requestMakerWorld: (request) => ipcRenderer.invoke('mw:request', request),
  // { connected: boolean }
  makerWorldStatus: () => ipcRenderer.invoke('mw:status'),
  // Clears the embedded MakerWorld session.
  disconnectMakerWorld: () => ipcRenderer.invoke('mw:disconnect'),
  // Printables uses its real Prusa Account OAuth window. As with MakerWorld,
  // the raw session remains in the Electron main process.
  connectPrintables: () => ipcRenderer.invoke('printables:connect'),
  requestPrintables: (request) => ipcRenderer.invoke('printables:request', request),
  printablesStatus: () => ipcRenderer.invoke('printables:status'),
  disconnectPrintables: () => ipcRenderer.invoke('printables:disconnect'),
});
