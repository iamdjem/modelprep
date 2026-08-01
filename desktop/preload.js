// Bridges the ModelPrep web app (renderer) to the desktop sign-in. Exposes a tiny, safe
// API on window.modelprepDesktop — the React app feature-detects it to show a one-click
// "Sign in to MakerWorld" button instead of the cookie-paste box.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('modelprepDesktop', {
  isDesktop: true,
  bridgeVersion: 3,
  // Rebuilds renderer-only account markers from encrypted main-process
  // sessions. The response contains identities/opaque ids only, never secrets.
  discoverAccounts: () => ipcRenderer.invoke('accounts:discover'),
  // Attempts a no-window recovery first: validate encrypted state, let the
  // platform rotate sliding cookies in its isolated partition, then validate
  // again. `needsInteractive` tells the renderer to offer the normal sign-in.
  recoverAccount: (platform, accountId) => ipcRenderer.invoke('accounts:recover', platform, accountId),
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
  // Cults credentials are validated directly against Cults3D, encrypted by
  // safeStorage, and referenced in the renderer only by an opaque account id.
  connectCults: (credentials) => ipcRenderer.invoke('cults:connect', credentials),
  requestCults: (request) => ipcRenderer.invoke('cults:request', request),
  cultsStatus: (accountId) => ipcRenderer.invoke('cults:status', accountId),
  disconnectCults: (accountId) => ipcRenderer.invoke('cults:disconnect', accountId),
  // Nexprint's real sign-in page writes an auth token into a dedicated session.
  // The token and cookies remain in the main process for direct upload requests.
  connectNexprint: () => ipcRenderer.invoke('nexprint:connect'),
  requestNexprint: (request) => ipcRenderer.invoke('nexprint:request', request),
  nexprintStatus: () => ipcRenderer.invoke('nexprint:status'),
  disconnectNexprint: () => ipcRenderer.invoke('nexprint:disconnect'),
  // Creality Cloud uses the same isolated-window pattern. The page's model_token,
  // user id and short-lived upload credentials never enter renderer storage.
  connectCreality: () => ipcRenderer.invoke('creality:connect'),
  requestCreality: (request) => ipcRenderer.invoke('creality:request', request),
  crealityStatus: () => ipcRenderer.invoke('creality:status'),
  disconnectCreality: () => ipcRenderer.invoke('creality:disconnect'),
  // MakerOnline's mo_access_token and cookies stay in an isolated session and
  // are used only by the allow-listed first-party upload adapter.
  connectMakerOnline: () => ipcRenderer.invoke('makeronline:connect'),
  requestMakerOnline: (request) => ipcRenderer.invoke('makeronline:request', request),
  makerOnlineStatus: () => ipcRenderer.invoke('makeronline:status'),
  disconnectMakerOnline: () => ipcRenderer.invoke('makeronline:disconnect'),
  // MyMiniFactory cookies and per-upload CSRF tokens stay inside its isolated
  // desktop partition/main-process adapter.
  connectMyMiniFactory: () => ipcRenderer.invoke('myminifactory:connect'),
  requestMyMiniFactory: (request) => ipcRenderer.invoke('myminifactory:request', request),
  myMiniFactoryStatus: () => ipcRenderer.invoke('myminifactory:status'),
  disconnectMyMiniFactory: () => ipcRenderer.invoke('myminifactory:disconnect'),
  connectMakerRoad: () => ipcRenderer.invoke('makeroad:connect'),
  requestMakerRoad: (request) => ipcRenderer.invoke('makeroad:request', request),
  makerRoadStatus: () => ipcRenderer.invoke('makeroad:status'),
  disconnectMakerRoad: () => ipcRenderer.invoke('makeroad:disconnect'),
  connectThangs: () => ipcRenderer.invoke('thangs:connect'),
  requestThangs: (request) => ipcRenderer.invoke('thangs:request', request),
  thangsStatus: () => ipcRenderer.invoke('thangs:status'),
  disconnectThangs: () => ipcRenderer.invoke('thangs:disconnect'),
  connectThingiverse: () => ipcRenderer.invoke('thingiverse:connect'),
  requestThingiverse: (request) => ipcRenderer.invoke('thingiverse:request', request),
  thingiverseStatus: () => ipcRenderer.invoke('thingiverse:status'),
  disconnectThingiverse: () => ipcRenderer.invoke('thingiverse:disconnect'),
});
