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
  it('keeps answers and drops anything bound to this project', () => {
    const opts = {
      enabled: true, license: 'ccby', visibility: 'private', printMethod: 'fdm', confirmOriginalNoAi: true,
      fileRoles: { a: 'model' }, excludedFileIds: ['b'], coverImageId: 'img1', imageIds: ['x'], primaryProfileFileId: 'p',
      remixUrl: 'https://x', relatedModel: { id: 1 }, remixParentIds: [3], verifyObjectId: '9', contestEntry: 'fund',
      categoryAuto: true, licenseAutoExact: false, price: 4,
    };
    expect(rememberableOptions(opts)).toEqual({ license: 'ccby', visibility: 'private', printMethod: 'fdm', confirmOriginalNoAi: true });
    for (const key of ['fileRoles', 'coverImageId', 'remixUrl', 'enabled', 'categoryAuto', 'price']) expect(isProjectBound(key)).toBe(true);
    for (const key of ['license', 'categoryId', 'visibility', 'metaTags']) expect(isProjectBound(key)).toBe(false);
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
