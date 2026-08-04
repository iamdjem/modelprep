// Bridges the ModelPrep web app (renderer) to the desktop sign-in. Exposes a tiny, safe
// API on window.modelprepDesktop — the React app feature-detects it to show a one-click
// "Sign in to MakerWorld" button instead of the cookie-paste box.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('modelprepDesktop', {
  isDesktop: true,
  bridgeVersion: 9,
  // Returns aggregate process/resource counts only. No project, platform,
  // account, request, file, URL, cookie, or token data crosses this channel.
  captureResourceTelemetry: (state) => ipcRenderer.invoke('telemetry:resource-snapshot', state),
  pickGalleryImages: () => ipcRenderer.invoke('media:pick-gallery-images'),
  // Local CLI agents (Codex, Claude Code) as AI providers, so a maker can spend a subscription
  // they already have instead of a metered API key. Photos + prompt only; each CLI's sign-in
  // stays where that CLI keeps it and never crosses this bridge.
  cliAiStatus: (options) => ipcRenderer.invoke('ai:cli-status', options),
  generateCliListing: (payload) => ipcRenderer.invoke('ai:cli-generate', payload),
  // Local model servers (Ollama, LM Studio): detection and a loopback-only chat proxy, so a
  // free local model works without the maker configuring cross-origin access by hand.
  detectLocalAi: () => ipcRenderer.invoke('ai:local-detect'),
  localAiChat: (payload) => ipcRenderer.invoke('ai:local-chat', payload),
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
  // Cults opens its real sign-in/security-check page in a per-account Chromium
  // partition. Cookies stay in Electron; the renderer sees only an opaque id.
  connectCults: (options) => ipcRenderer.invoke('cults:connect', options),
  requestCults: (request) => ipcRenderer.invoke('cults:request', request),
  cultsStatus: (accountId) => ipcRenderer.invoke('cults:status', accountId),
  disconnectCults: (accountId) => ipcRenderer.invoke('cults:disconnect', accountId),
  // Release scheduler: renderer syncs its plans so main can fire reminders and
  // unattended publishes even after the window closes; main calls back to run a
  // due plan or open the queue.
  syncReleasePlans: (plans) => ipcRenderer.invoke('release-plans:sync', plans),
  getReleasePlans: () => ipcRenderer.invoke('release-plans:get'),
  onRunScheduledRelease: (cb) => { const h = (_e, id) => cb(id); ipcRenderer.on('release:run-scheduled', h); return () => ipcRenderer.removeListener('release:run-scheduled', h); },
  onOpenReleaseQueue: (cb) => { const h = () => cb(); ipcRenderer.on('release:open-queue', h); return () => ipcRenderer.removeListener('release:open-queue', h); },
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
