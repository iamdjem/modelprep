import { describe, expect, it } from 'vitest';
import {
  applyPlatformDefaults, forgetPlatform, isProjectBound, loadPlatformDefaults, rememberPlatform,
  rememberableOptions, rememberedCount,
} from './platform-defaults.js';

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

describe('what is worth remembering', () => {
  it('uses a per-platform allowlist and drops project-bound data', () => {
    const opts = {
      enabled: true, license: 'ccby', visibility: 'private', printMethod: 'fdm', confirmOriginalNoAi: true,
      fileRoles: { a: 'model' }, excludedFileIds: ['b'], coverImageId: 'img1', imageIds: ['x'], primaryProfileFileId: 'p',
      remixUrl: 'https://x', sourceThingId: '123', summary: 'old project', bom: [{ name: 'old part' }], planTime: 'tomorrow',
      relatedModel: { id: 1 }, remixParentIds: [3], verifyObjectId: '9', contestEntry: 'fund',
      categoryAuto: true, licenseAutoExact: false, price: 4,
    };
    expect(rememberableOptions(opts, 'thingiverse')).toEqual({ license: 'ccby' });
    for (const key of ['fileRoles', 'coverImageId', 'remixUrl', 'sourceThingId', 'summary', 'bom', 'planTime', 'enabled', 'categoryAuto', 'price']) {
      expect(isProjectBound(key, 'thingiverse')).toBe(true);
    }
    for (const key of ['license', 'categoryId', 'publication']) expect(isProjectBound(key, 'thingiverse')).toBe(false);
  });

  it('keeps intended preferences that the old substring filter dropped', () => {
    expect(rememberableOptions({ includePrintProfile: true, relatedKits: true, storeKitIds: ['kit-1'] }, 'makeronline')).toEqual({
      includePrintProfile: true,
      relatedKits: true,
      storeKitIds: ['kit-1'],
    });
  });
});

describe('storage', () => {
  it('remembers, applies to a fresh project and forgets', () => {
    const storage = memoryStorage();
    rememberPlatform(storage, 'cults', { licenseType: 'cc-by', visibility: 'public', fileRoles: { a: 1 } });
    const defaults = loadPlatformDefaults(storage);
    expect(rememberedCount(defaults, 'cults')).toBe(2);
    expect(rememberedCount(defaults, 'thangs')).toBe(0);

    const platforms = { cults: { enabled: false, licenseType: '', visibility: 'secret', fileRoles: {} }, thangs: { enabled: true } };
    const applied = applyPlatformDefaults(platforms, defaults);
    expect(applied.cults).toEqual({ enabled: false, licenseType: 'cc-by', visibility: 'public', fileRoles: {} });
    expect(applied.thangs).toBe(platforms.thangs);

    forgetPlatform(storage, 'cults');
    expect(loadPlatformDefaults(storage)).toEqual({});
    expect(applyPlatformDefaults(platforms, {})).toBe(platforms);
  });

  it('ignores a platform the app no longer has, and garbage', () => {
    const storage = memoryStorage();
    storage.setItem('modelprep:platform-option-defaults:v1', '[1,2]');
    expect(loadPlatformDefaults(storage)).toEqual({});
    expect(applyPlatformDefaults({ cults: {} }, { gone: { a: 1 } })).toEqual({ cults: {} });
  });
});
