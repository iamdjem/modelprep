'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { createAssetLibrary } = require('./asset-library');

test('stores searchable asset manifests in SQLite FTS', () => {
  const library = createAssetLibrary(':memory:');
  library.upsertAssets([{ id: 'asset-puck', name: 'Calibration puck', tags: ['calibration'], metadata: { plateCount: 2 }, files: [{ id: 'file-stl', name: 'puck.stl', extension: 'stl', role: 'model' }], relations: [], previews: [{ id: 'preview-1', assetFileId: 'file-stl', kind: 'plate', plate: 1, status: 'ready' }] }]);
  assert.equal(library.search('calibration')[0].name, 'Calibration puck');
  assert.equal(library.search('puck')[0].id, 'asset-puck');
  library.close();
});

test('persists watched-folder receipts', () => {
  const library = createAssetLibrary(':memory:');
  library.addWatchedFolder('/tmp/models');
  assert.equal(library.listWatchedFolders()[0].path, '/tmp/models');
  library.close();
});
