import { describe, expect, it } from 'vitest';
import {
  ASSET_ENTITY_TYPES, AssetFile, assignFilesToAsset, buildAssetCollections, canonicalAssetStem,
  geometrySimilarityFingerprint, groupProjectAssets, matchesAssetQuery, replaceAssetFileRevision,
  suggestAssetTags,
} from './assets.js';

describe('asset entities', () => {
  it('normalizes variants and slicer profiles to a logical asset stem', () => {
    expect(canonicalAssetStem('Desk Dragon - Small.stl')).toBe('Desk Dragon');
    expect(canonicalAssetStem('Desk_Dragon_Bambu_Profile.3mf')).toBe('Desk Dragon');
  });

  it('groups model variants, profiles and documents without dropping their file identity', () => {
    const files = [
      { id: 'a', name: 'calibration-puck-s.stl', size: 10, isModel: true },
      { id: 'b', name: 'calibration-puck-bambu-profile.3mf', size: 20, isModel: true, isProfile: true, threemf: { slicer: 'bambu', plates: 2, thumbnail: 'data:image/png;base64,x' } },
      { id: 'c', name: 'calibration-puck.md', size: 5, roleOverride: 'document' },
    ];
    const [asset] = groupProjectAssets(files);
    expect(asset.entityType).toBe(ASSET_ENTITY_TYPES.asset);
    expect(asset.files.map((file) => file.entityType)).toEqual(Array(3).fill(ASSET_ENTITY_TYPES.file));
    expect(asset.files).toHaveLength(3);
    expect(asset.relations.map((relation) => relation.type)).toEqual(expect.arrayContaining(['print-profile', 'documentation']));
    expect(asset.previews[0]).toMatchObject({ entityType: ASSET_ENTITY_TYPES.preview, plate: 1 });
    expect(asset.metadata).toMatchObject({ plateCount: 2, profileCount: 1, documentCount: 1 });
  });

  it('allows manual regrouping to override automatic names', () => {
    const files = assignFilesToAsset([{ id: '1', name: 'left.stl' }, { id: '2', name: 'right.stl' }], ['1', '2'], 'asset-pair');
    expect(groupProjectAssets(files)).toHaveLength(1);
  });

  it('supports structured search and lightweight semantic tag suggestions', () => {
    const [asset] = groupProjectAssets([{ id: '1', name: 'gear-mount-bambu.3mf', isModel: true, threemf: { slicer: 'bambu', printer: 'A1 mini' } }]);
    expect(matchesAssetQuery(asset, 'type:3mf slicer:bambu printer:a1')).toBe(true);
    expect(suggestAssetTags(asset)).toContain('functional');
  });

  it('replaces a binary as a new revision while retaining the prior receipt', () => {
    const file = { id: '1', name: 'part.stl', size: 10, revision: 1, contentHash: 'old', blob: {} };
    const replacement = new File(['replacement'], 'part-v2.stl', { type: 'model/stl' });
    const next = replaceAssetFileRevision(file, replacement, 123);
    expect(next).toMatchObject({ id: '1', name: 'part-v2.stl', revision: 2, contentHash: null });
    expect(next.assetVersions[0]).toMatchObject({ revision: 1, contentHash: 'old', replacedAt: 123 });
  });

  it('creates stable geometry fingerprints and collection counts', () => {
    expect(geometrySimilarityFingerprint({ dimensions: { x: 22.04, y: 22.02, z: 3.2 }, triangles: 10049, shells: 1 })).toBe('22:22:3:10000:1');
    const assets = groupProjectAssets([{ id: '1', name: 'part.stl', isModel: true }, { id: '2', name: 'plate.3mf', isModel: true, threemf: { plates: 3 } }]);
    expect(Object.fromEntries(buildAssetCollections(assets).map((item) => [item.id, item.count]))).toMatchObject({ all: 2, models: 2, 'multi-plate': 1 });
  });

  it('maps source fields into an AssetFile entity', () => {
    expect(AssetFile({ id: 'x', name: 'notes.pdf', size: 4 })).toMatchObject({ role: 'documentation', extension: 'pdf', size: 4 });
  });
});
