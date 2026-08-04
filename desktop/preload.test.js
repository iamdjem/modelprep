const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('desktop preload exposes a complete ten-platform connection contract', () => {
  let exposed = null;
  const invoked = [];
  const sandbox = {
    require(id) {
      if (id !== 'electron') throw new Error(`Unexpected preload import: ${id}`);
      return {
        contextBridge: {
          exposeInMainWorld(name, value) {
            assert.equal(name, 'modelprepDesktop');
            exposed = value;
          },
        },
        ipcRenderer: {
          invoke(channel, ...args) {
            invoked.push([channel, ...args]);
            return Promise.resolve({ ok: true });
          },
          on() {},
          removeListener() {},
        },
      };
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8'),
    sandbox,
    { filename: 'preload.js' },
  );

  assert.equal(exposed.isDesktop, true);
  assert.equal(exposed.bridgeVersion, 9);
  assert.equal(typeof exposed.captureResourceTelemetry, 'function');
  assert.equal(typeof exposed.pickGalleryImages, 'function');
  assert.equal(typeof exposed.discoverAccounts, 'function');
  assert.equal(typeof exposed.recoverAccount, 'function');
  const contracts = {
    MakerWorld: ['connectMakerWorld', 'requestMakerWorld', 'makerWorldStatus', 'disconnectMakerWorld'],
    Printables: ['connectPrintables', 'requestPrintables', 'printablesStatus', 'disconnectPrintables'],
    Cults3D: ['connectCults', 'requestCults', 'cultsStatus', 'disconnectCults'],
    Nexprint: ['connectNexprint', 'requestNexprint', 'nexprintStatus', 'disconnectNexprint'],
    'Creality Cloud': ['connectCreality', 'requestCreality', 'crealityStatus', 'disconnectCreality'],
    MakerOnline: ['connectMakerOnline', 'requestMakerOnline', 'makerOnlineStatus', 'disconnectMakerOnline'],
    MyMiniFactory: ['connectMyMiniFactory', 'requestMyMiniFactory', 'myMiniFactoryStatus', 'disconnectMyMiniFactory'],
    MakerRoad: ['connectMakerRoad', 'requestMakerRoad', 'makerRoadStatus', 'disconnectMakerRoad'],
    Thangs: ['connectThangs', 'requestThangs', 'thangsStatus', 'disconnectThangs'],
    Thingiverse: ['connectThingiverse', 'requestThingiverse', 'thingiverseStatus', 'disconnectThingiverse'],
  };
  for (const [platform, methods] of Object.entries(contracts)) {
    for (const method of methods) assert.equal(typeof exposed[method], 'function', `${platform} is missing ${method}`);
  }

  assert.equal(typeof exposed.cliAiStatus, 'function');
  assert.equal(typeof exposed.generateCliListing, 'function');
  assert.equal(typeof exposed.detectLocalAi, 'function');
  assert.equal(typeof exposed.localAiChat, 'function');
  for (const method of ['syncReleasePlans', 'getReleasePlans', 'onRunScheduledRelease', 'onOpenReleaseQueue']) {
    assert.equal(typeof exposed[method], 'function', `release scheduler is missing ${method}`);
  }

  exposed.captureResourceTelemetry({ phase: 'ready', active: 0, total: 10 });
  exposed.pickGalleryImages();
  exposed.cliAiStatus({ agent: 'codex' });
  exposed.generateCliListing({ agent: 'claude', prompt: 'p', images: [] });
  exposed.detectLocalAi();
  exposed.localAiChat({ baseUrl: 'http://localhost:11434/v1', model: 'm', messages: [] });
  exposed.recoverAccount('makeronline', '');
  exposed.connectMakerOnline();
  exposed.requestMakerOnline({ url: 'https://worker/api/v1/makeronline/web/whoami' });
  exposed.makerOnlineStatus();
  exposed.disconnectMakerOnline();
  assert.deepEqual(invoked.map(([channel]) => channel), [
    'telemetry:resource-snapshot',
    'media:pick-gallery-images',
    'ai:cli-status',
    'ai:cli-generate',
    'ai:local-detect',
    'ai:local-chat',
    'accounts:recover',
    'makeronline:connect',
    'makeronline:request',
    'makeronline:status',
    'makeronline:disconnect',
  ]);
});
