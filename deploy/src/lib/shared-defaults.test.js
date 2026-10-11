import { describe, expect, it } from 'vitest';
import {
  CULTS_LICENSE_MAP,
  MAKEROAD_LICENSE_MAP,
  MMF_LICENSE_MAP,
  SHARED_CATEGORY_DEFAULTS,
  THANGS_LICENSE_MAP,
  THINGIVERSE_LICENSE_MAP,
  deriveSharedDefaultPatches,
  matchPrintablesCategory,
} from './shared-defaults.js';
import { THINGIVERSE_CATEGORIES } from './thingiverse.js';
import { THANGS_CATEGORIES } from './thangs.js';
import { CREALITY_CATEGORIES, CREALITY_LICENSE_MAP } from './creality.js';
import { MAKEROAD_LICENSES } from './makeroad.js';
import { MAKERONLINE_LICENSE_MAP } from './makeronline.js';
import { MYMINIFACTORY_CATEGORY_TREE, flattenMyMiniFactoryCategories } from './myminifactory.js';
import { flattenMakerWorldCategories } from './makerworld.js';
import makerWorldCategoryTree from '../data/makerworld-categories.json';

const SHARED_CATEGORIES = [
  'Home & Living', 'Tools', 'Toys & Games', 'Hobby & DIY', 'Art & Decor',
  'Fashion & Jewelry', 'Electronics & Tech', 'Outdoor & Garden', 'Educational',
  'Miniatures & Tabletop', 'Cosplay & Props', 'Holiday & Seasonal', 'Other',
];
const SHARED_LICENSES = ['cc0', 'ccby', 'ccbysa', 'ccbync', 'ccbyncsa', 'ccbynd', 'ccbyncnd', 'standard'];

function baseProject(overrides = {}) {
  return {
    category: '',
    license: '',
    platforms: {
      makerworld: { enabled: true, categoryId: '' },
      printables: { enabled: true, categoryId: '' },
      cults: { enabled: true, categoryId: '', licenseType: '' },
      mmf: { enabled: true, categoryIds: [], licenseId: '' },
      thingiverse: { enabled: true, categoryId: '', license: '' },
      thangs: { enabled: true, category: '', license: '' },
      nexprint: { enabled: true, categoryId: '' },
      creality: { enabled: true, categoryId: '' },
      makeronline: { enabled: true, categoryId: '' },
      makeroad: { enabled: true, categoryIds: [], categoryPaths: [] },
    },
    ...overrides,
  };
}

describe('SHARED_CATEGORY_DEFAULTS integrity', () => {
  it('covers every shared category label', () => {
    for (const shared of SHARED_CATEGORIES) {
      expect(SHARED_CATEGORY_DEFAULTS[shared], shared).toBeTruthy();
    }
  });

  it('maps only to real MakerWorld leaf ids', () => {
    const leaves = new Set(
      flattenMakerWorldCategories(makerWorldCategoryTree)
        .filter((category) => category.isLeaf)
        .map((category) => Number(category.id)),
    );
    for (const [shared, row] of Object.entries(SHARED_CATEGORY_DEFAULTS)) {
      if (!row.makerworld) continue;
      expect(leaves.has(Number(row.makerworld.value)), `${shared} -> ${row.makerworld.value}`).toBe(true);
    }
  });

  it('maps only to real Thingiverse category ids', () => {
    const ids = new Set(THINGIVERSE_CATEGORIES.map((category) => String(category.id)));
    for (const [shared, row] of Object.entries(SHARED_CATEGORY_DEFAULTS)) {
      if (!row.thingiverse) continue;
      expect(ids.has(String(row.thingiverse.value)), `${shared}`).toBe(true);
    }
  });

  it('maps only to real Thangs category values', () => {
    const values = new Set(THANGS_CATEGORIES.map((category) => category.value));
    for (const [shared, row] of Object.entries(SHARED_CATEGORY_DEFAULTS)) {
      if (!row.thangs) continue;
      expect(values.has(row.thangs.value), `${shared} -> ${row.thangs.value}`).toBe(true);
    }
  });

  it('maps only to real Creality category ids', () => {
    const ids = new Set();
    for (const category of CREALITY_CATEGORIES) {
      ids.add(String(category.id));
      for (const [childId] of category.children || []) ids.add(String(childId));
    }
    for (const [shared, row] of Object.entries(SHARED_CATEGORY_DEFAULTS)) {
      if (!row.creality) continue;
      expect(ids.has(String(row.creality.value)), `${shared}`).toBe(true);
    }
  });

  it('maps only to real MyMiniFactory category paths', () => {
    const flat = flattenMyMiniFactoryCategories(MYMINIFACTORY_CATEGORY_TREE);
    const chains = new Set(flat.map((entry) => (entry.pathIds || []).join('/')));
    for (const [shared, row] of Object.entries(SHARED_CATEGORY_DEFAULTS)) {
      if (!row.mmf) continue;
      expect(chains.has(row.mmf.value.join('/')), `${shared} -> ${row.mmf.value.join('/')}`).toBe(true);
    }
  });
});

describe('license maps', () => {
  it('cover every shared license id explicitly', () => {
    for (const map of [MMF_LICENSE_MAP, THINGIVERSE_LICENSE_MAP, THANGS_LICENSE_MAP, MAKEROAD_LICENSE_MAP]) {
      for (const id of SHARED_LICENSES) {
        expect(Object.prototype.hasOwnProperty.call(map, id), id).toBe(true);
      }
    }
  });

  it('MakerRoad indexes point at the intended CC labels', () => {
    expect(MAKEROAD_LICENSES[MAKEROAD_LICENSE_MAP.ccbyncnd].label).toBe('CC BY-NC-ND');
    expect(MAKEROAD_LICENSES[MAKEROAD_LICENSE_MAP.cc0].label).toBe('CC0 / Public Domain');
  });

  it('Cults maps the CC family only; Standard stays an explicit choice', () => {
    expect(CULTS_LICENSE_MAP.ccbyncnd).toBe('cc_by_nc_nd');
    expect(CULTS_LICENSE_MAP.standard).toBeUndefined();
  });

  it('the pre-existing platform maps gained CC BY-NC-ND', () => {
    expect(CREALITY_LICENSE_MAP.ccbyncnd).toBe('CC BY-NC-ND');
    expect(MAKERONLINE_LICENSE_MAP.ccbyncnd).toBe(6);
  });
});

describe('deriveSharedDefaultPatches', () => {
  it('returns null when there is nothing to fill', () => {
    expect(deriveSharedDefaultPatches(baseProject())).toBeNull();
  });

  it('fills every mapped platform for a shared category', () => {
    const project = baseProject({ category: 'Tools' });
    const patches = deriveSharedDefaultPatches(project);
    expect(patches.makerworld).toEqual({ categoryId: 706, categoryAuto: true });
    expect(patches.cults).toEqual({ categoryId: '27', categoryAuto: true });
    expect(patches.mmf).toEqual({ categoryIds: [57, 252], categoryAuto: true });
    expect(patches.thingiverse).toEqual({ categoryId: '71', categoryAuto: true });
    expect(patches.thangs).toEqual({ category: 'Tools & Organizers', categoryAuto: true });
    expect(patches.creality).toEqual({ categoryId: '1671', categoryAuto: true });
    expect(patches.nexprint).toEqual({ categoryId: '1422473859022860', categoryAuto: true });
    expect(patches.makeronline).toEqual({ categoryId: '57', categoryAuto: true });
    expect(patches.makeroad).toEqual({ categoryPaths: ['Tools › Household Tools'], categoryAuto: true });
    expect(patches.printables).toBeUndefined();
  });

  it('never overwrites a manual choice', () => {
    const project = baseProject({ category: 'Tools' });
    project.platforms.thingiverse = { enabled: true, categoryId: '129', categoryAuto: false, license: '' };
    project.platforms.creality = { enabled: true, categoryId: '1645', categoryAuto: false };
    const patches = deriveSharedDefaultPatches(project);
    expect(patches.thingiverse).toBeUndefined();
    expect(patches.creality).toBeUndefined();
  });

  it('re-derives when the shared category changes and the value is still auto', () => {
    const project = baseProject({ category: 'Educational' });
    project.platforms.thingiverse = { enabled: true, categoryId: '71', categoryAuto: true, license: '' };
    const patches = deriveSharedDefaultPatches(project);
    expect(patches.thingiverse).toEqual({ categoryId: '69', categoryAuto: true });
  });

  it('clears an auto value when the new shared category has no match', () => {
    const project = baseProject({ category: 'Other' });
    project.platforms.creality = { enabled: true, categoryId: '1671', categoryAuto: true };
    project.platforms.mmf = { enabled: true, categoryIds: [57, 252], categoryAuto: true, licenseId: '' };
    const patches = deriveSharedDefaultPatches(project);
    expect(patches.creality).toEqual({ categoryId: '' });
    expect(patches.mmf).toEqual({ categoryIds: [] });
    expect(patches.thingiverse).toEqual({ categoryId: '0', categoryAuto: true });
  });

  it('treats legacy non-empty values without a flag as manual', () => {
    const project = baseProject({ category: 'Tools' });
    project.platforms.makerworld = { enabled: true, categoryId: 401 };
    const patches = deriveSharedDefaultPatches(project);
    expect(patches.makerworld).toBeUndefined();
  });

  it('maps the shared license exactly where an equivalent exists', () => {
    const project = baseProject({ license: 'ccbyncnd' });
    const patches = deriveSharedDefaultPatches(project);
    expect(patches.mmf).toEqual({ licenseId: 7, licenseAuto: true, licenseAutoExact: true });
    expect(patches.thingiverse).toEqual({ license: 'cc-nc-nd', licenseAuto: true, licenseAutoExact: true });
    expect(patches.thangs).toEqual({ license: 'CC BY-NC-ND', licenseAuto: true, licenseAutoExact: true });
    expect(patches.makeroad).toEqual({ licenseIndex: 4, licenseAuto: true, licenseAutoExact: true });
    expect(patches.cults).toEqual({ licenseType: 'cc_by_nc_nd', licenseAuto: true, licenseAutoExact: true });
  });

  it('falls back to the closest legacy value when there is no equivalent', () => {
    const project = baseProject({ license: 'standard' });
    const patches = deriveSharedDefaultPatches(project);
    expect(patches.mmf).toEqual({ licenseId: 5, licenseAuto: true, licenseAutoExact: false });
    expect(patches.thingiverse).toEqual({ license: 'cc-nc', licenseAuto: true, licenseAutoExact: false });
    expect(patches.thangs).toEqual({ license: 'CC BY-NC', licenseAuto: true, licenseAutoExact: false });
    expect(patches.makeroad).toEqual({ licenseIndex: 2, licenseAuto: true, licenseAutoExact: false });
    expect(patches.cults).toBeUndefined();
  });

  it('respects a manual license override', () => {
    const project = baseProject({ license: 'ccby' });
    project.platforms.mmf = { enabled: true, categoryIds: [], licenseId: 11, licenseAuto: false };
    const patches = deriveSharedDefaultPatches(project);
    expect(patches.mmf).toBeUndefined();
  });
});

describe('matchPrintablesCategory', () => {
  const live = [
    { id: 3, level: 0, name: 'Household', path: [{ name: 'Household' }] },
    { id: 44, level: 1, name: 'Home Decor', path: [{ name: 'Household' }, { name: 'Home Decor' }] },
    { id: 69, level: 1, name: 'Autumn & Halloween', path: [{ name: 'Seasonal designs' }, { name: 'Autumn & Halloween' }] },
    { id: 49, level: 1, name: 'Tools', path: [{ name: 'Hobby & Makers' }, { name: 'Tools' }] },
  ];

  it('matches an exact subcategory path and never a top level', () => {
    expect(matchPrintablesCategory(live, 'Home & Living')).toEqual({ id: '44', label: 'Household > Home Decor' });
    expect(matchPrintablesCategory(live, 'Tools')).toEqual({ id: '49', label: 'Hobby & Makers > Tools' });
  });

  it('supports prefix candidates for seasonal groups', () => {
    expect(matchPrintablesCategory(live, 'Holiday & Seasonal')).toEqual({ id: '69', label: 'Seasonal designs > Autumn & Halloween' });
  });

  it('returns null with no live data or no match', () => {
    expect(matchPrintablesCategory(null, 'Tools')).toBeNull();
    expect(matchPrintablesCategory(live, 'Other')).toBeNull();
  });

  it('feeds deriveSharedDefaultPatches when live data is supplied', () => {
    const project = baseProject({ category: 'Home & Living' });
    const patches = deriveSharedDefaultPatches(project, { printablesCategories: live });
    expect(patches.printables).toEqual({ categoryId: '44', categoryAuto: true });
  });
});

describe('shared disclosures', () => {
  const platformsWithDisclosures = () => ({
    makerworld: { aiGenerated: false, nsfw: false, modelSource: 'original', remixUrl: '', remixDescription: '' },
    printables: { aiGenerated: null, nsfw: false, authorship: 'author', remixDescription: '' },
    cults: { madeWithAi: false },
    mmf: { remix: false },
    thingiverse: { aiGenerated: false, nsfw: false, remix: false },
    thangs: { aiGenerated: false },
    nexprint: { aiGenerated: false, nsfw: false, originalityType: 1, sourceUrl: '' },
    creality: { nsfw: false, modelSource: 1, sourceUrl: '' },
    makeronline: { aiHelp: false, nsfw: false, source: 1, originalUrl: '' },
    makeroad: { aiGenerated: false, nsfw: false, uploadType: 1, referUrl: '' },
  });

  it('answers the AI question for every platform that has one', () => {
    const patches = deriveSharedDefaultPatches({
      category: '', license: '', aiGenerated: true, platforms: platformsWithDisclosures(),
    });
    expect(patches.makerworld.aiGenerated).toBe(true);
    expect(patches.printables.aiGenerated).toBe(true);
    expect(patches.cults.madeWithAi).toBe(true);
    expect(patches.thingiverse.aiGenerated).toBe(true);
    expect(patches.thangs.aiGenerated).toBe(true);
    expect(patches.nexprint.aiGenerated).toBe(true);
    expect(patches.makeronline.aiHelp).toBe(true);
    expect(patches.makeroad.aiGenerated).toBe(true);
  });

  it('resolves the Printables null that used to block every project', () => {
    const patches = deriveSharedDefaultPatches({
      category: '', license: '', aiGenerated: false, platforms: platformsWithDisclosures(),
    });
    expect(patches.printables.aiGenerated).toBe(false);
  });

  it('sets NSFW only where the platform has the field', () => {
    const patches = deriveSharedDefaultPatches({
      category: '', license: '', nsfw: true, platforms: platformsWithDisclosures(),
    });
    expect(patches.makerworld.nsfw).toBe(true);
    expect(patches.creality.nsfw).toBe(true);
    expect(patches.cults?.nsfw).toBeUndefined();
    expect(patches.thangs?.nsfw).toBeUndefined();
  });

  it('writes one remix answer into every platform-native origin field', () => {
    const patches = deriveSharedDefaultPatches({
      category: '',
      license: '',
      provenance: { origin: 'remix', sourceUrl: 'https://example.com/original', changes: 'Scaled to 120%' },
      platforms: platformsWithDisclosures(),
    });
    expect(patches.makerworld).toMatchObject({ modelSource: 'remix', remixUrl: 'https://example.com/original', remixDescription: 'Scaled to 120%' });
    expect(patches.printables).toMatchObject({ authorship: 'remix', remixDescription: 'Scaled to 120%' });
    expect(patches.nexprint).toMatchObject({ originalityType: 2, sourceUrl: 'https://example.com/original' });
    expect(patches.creality).toMatchObject({ modelSource: 3, sourceUrl: 'https://example.com/original' });
    expect(patches.makeronline).toMatchObject({ source: 2, originalUrl: 'https://example.com/original' });
    expect(patches.makeroad).toMatchObject({ uploadType: 2, referUrl: 'https://example.com/original' });
    expect(patches.thingiverse).toMatchObject({ remix: true });
    expect(patches.mmf).toMatchObject({ remix: true });
  });

  it('leaves a Printables reupload alone', () => {
    const platforms = platformsWithDisclosures();
    platforms.printables.authorship = 'reupload';
    const patches = deriveSharedDefaultPatches({
      category: '', license: '', provenance: { origin: 'original' }, platforms,
    });
    expect(patches?.printables?.authorship).toBeUndefined();
  });

  it('keeps a manual MakerWorld Share override instead of resetting it from Details', () => {
    const platforms = platformsWithDisclosures();
    platforms.makerworld = {
      ...platforms.makerworld,
      modelSource: 'share',
      modelSourceAuto: false,
      remixUrl: 'https://example.com/source',
    };
    const patches = deriveSharedDefaultPatches({
      category: '', license: '', provenance: { origin: 'original' }, platforms,
    });
    expect(patches?.makerworld?.modelSource).toBeUndefined();
    expect(patches?.makerworld?.remixUrl).toBeUndefined();
  });
});

describe('package-derived defaults', () => {
  const sliced = {
    sliced: true, printer: 'Bambu P1S', material: 'PLA', layerHeight: '0.2mm',
    infill: '15%', filamentGrams: 42, units: 'inch',
  };

  it('fills the Thingiverse print settings from the sliced profile', () => {
    const patches = deriveSharedDefaultPatches({
      category: '', license: '',
      files: [{ id: 'f1', name: 'part.3mf', threemf: sliced }],
      platforms: { thingiverse: { printSettings: {} } },
    });
    expect(patches.thingiverse.printSettings).toEqual({
      printer: 'Bambu P1S', material: 'PLA', resolution: '0.2mm', infill: '15%',
    });
  });

  it('never overwrites a print setting the creator typed', () => {
    const patches = deriveSharedDefaultPatches({
      category: '', license: '',
      files: [{ id: 'f1', name: 'part.3mf', threemf: sliced }],
      platforms: { thingiverse: { printSettings: { printer: 'Prusa MK4', material: 'PETG', resolution: '0.15mm', infill: '25%' } } },
    });
    expect(patches?.thingiverse).toBeUndefined();
  });

  it('reads the MyMiniFactory material quantity off the slicer', () => {
    const patches = deriveSharedDefaultPatches({
      category: '', license: '',
      files: [{ id: 'f1', name: 'part.3mf', threemf: sliced }],
      platforms: { mmf: { technology: '', materialQuantity: '' } },
    });
    expect(patches.mmf).toMatchObject({ technology: 'FDM', materialQuantity: '42 g' });
  });

  it('takes the Thangs unit from the 3MF model unit', () => {
    const patches = deriveSharedDefaultPatches({
      category: '', license: '',
      files: [{ id: 'f1', name: 'part.3mf', threemf: sliced }],
      platforms: { thangs: { units: 'mm' } },
    });
    expect(patches.thangs.units).toBe('in');
  });

  it('ignores an unsliced 3MF', () => {
    const patches = deriveSharedDefaultPatches({
      category: '', license: '',
      files: [{ id: 'f1', name: 'part.3mf', threemf: { sliced: false, printer: 'Bambu P1S' } }],
      platforms: { thingiverse: { printSettings: {} } },
    });
    expect(patches).toBeNull();
  });

  it('stores the primary Thangs part the panel already displayed', () => {
    const patches = deriveSharedDefaultPatches(
      { category: '', license: '', platforms: { thangs: { primaryFileId: '' } } },
      { thangsModelFiles: [{ id: 'f1' }, { id: 'f2' }] },
    );
    expect(patches.thangs.primaryFileId).toBe('f1');
  });

  it('repairs a primary part that points at a removed file', () => {
    const patches = deriveSharedDefaultPatches(
      { category: '', license: '', platforms: { thangs: { primaryFileId: 'gone' } } },
      { thangsModelFiles: [{ id: 'f1' }] },
    );
    expect(patches.thangs.primaryFileId).toBe('f1');
  });
});
