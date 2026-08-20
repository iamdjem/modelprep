import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildDemoProject, DEMO_IMAGE_ASSETS } from './App.jsx';

const forbiddenClaims = /\bdragon\b|\barticulat\w*\b|\bprint-in-place\b|\bwing\b|\btail\b|\bjoint\b/i;
const seedImages = Array.from({ length: 4 }, (_, index) => ({ id: `demoimg_${index}` }));

describe('live certification demo fixture', () => {
  it('uses truthful metadata and all known test-model categories', () => {
    const fixture = buildDemoProject(seedImages);
    expect(`${fixture.title}\n${fixture.description}\n${fixture.tags.join(' ')}`).not.toMatch(forbiddenClaims);
    expect(fixture.title).toContain('Calibration Puck');
    expect(fixture.files.map((file) => file.name)).toEqual([
      'modelprep-calibration-puck-S.stl',
      'modelprep-calibration-puck-M.stl',
      'modelprep-calibration-puck-bambu.3mf',
    ]);
    expect(fixture.profiles).toHaveLength(1);
    expect(fixture.profiles[0].realPhotoConfirmed).toBe(false);
    expect(fixture.platforms.nexprint.categoryId).toBe('1422473859022859');
    expect(fixture.platforms.creality.categoryId).toBe('1645');
    expect(fixture.platforms.makeronline.categoryId).toBe('36');
    // Live Printables taxonomy: 12 = 3D Printers > Test Models. 36 there is
    // Toys & Games > Action Figures & Statues, which is what retained draft
    // 1803506 displayed for this calibration puck.
    expect(fixture.platforms.printables.categoryId).toBe('12');
    expect(fixture.platforms.makeroad.categoryPaths).toEqual(['Professional Fields › Test Models']);
    expect(fixture.platforms.thangs.category).toBe('3D Printer Parts & Accessories/Test Prints & Calibration');
    expect(fixture.platforms.thingiverse.categoryId).toBe('129');
    expect(fixture.platforms.thingiverse.printSettings).toMatchObject({
      printerBrand: 'Bambu Lab', printer: 'A1 Mini', supports: 'No',
      resolution: '0.2 mm', infill: '15% gyroid', material: 'PLA',
    });
    expect(fixture.platforms.cults.metaTags).toEqual(['functional_part', 'no_support']);
    expect(fixture.platforms.makeronline).toMatchObject({ printMethod: 1, includePrintProfile: false });
    expect(fixture.platforms.nexprint).toMatchObject({ hasBom: true, worldFirstRelease: false });
    expect(fixture.platforms.mmf).toMatchObject({ supportFree: true, technology: 'FDM', materialQuantity: '4 g' });
  });

  it('declares pairwise retained-result coverage for every live destination', () => {
    const fixture = buildDemoProject(seedImages);
    expect(Object.keys(fixture.__certificationCoverage).sort()).toEqual([
      'creality', 'cults', 'makeroad', 'makeronline', 'makerworld',
      'mmf', 'nexprint', 'printables', 'thangs', 'thingiverse',
    ]);
    for (const fields of Object.values(fixture.__certificationCoverage)) {
      expect(fields.length).toBeGreaterThanOrEqual(8);
    }
    expect(fixture.__certificationCoverage.thingiverse).toContain('structured-print-settings');
    // The `ordinary-3mf` claim only holds because the fixture opts the
    // Bambu profile in explicitly: Printables' automatic file selection
    // unticks profiles from other vendors' slicers.
    expect(fixture.__certificationCoverage.printables).toContain('ordinary-3mf');
    expect(fixture.platforms.printables).toMatchObject({ fileSelection: 'manual', excludedFileIds: [] });
    // Nexprint's native slicer is Elegoo, so the same opt-in is required there.
    // Its .3mf is an ordinary modelFileList entry whose print-profile block
    // stays empty, which the coverage claim now states rather than implying a
    // populated profile.
    expect(fixture.__certificationCoverage.nexprint).toContain('ordinary-3mf');
    expect(fixture.__certificationCoverage.nexprint).toContain('empty-print-profile-block');
    expect(fixture.platforms.nexprint).toMatchObject({ fileSelection: 'manual', excludedFileIds: [] });
    // Creality's native slicer is Creality Print, so it needs the same opt-in.
    // Its .3mf is an ordinary modelList entry; the parsed Print Configuration
    // surface stays empty, which the coverage claim now states.
    expect(fixture.__certificationCoverage.creality).toContain('ordinary-3mf');
    expect(fixture.__certificationCoverage.creality).toContain('empty-print-configuration');
    expect(fixture.platforms.creality).toMatchObject({ fileSelection: 'manual', excludedFileIds: [] });
    expect(fixture.__certificationCoverage.makeronline).toContain('ordinary-3mf');
    expect(fixture.__certificationCoverage.makeronline).toContain('print-profile-fail-closed');
    expect(fixture.platforms.makeronline).toMatchObject({ fileSelection: 'manual', excludedFileIds: [] });
    expect(fixture.__certificationCoverage.nexprint).toContain('bom');
    expect(fixture.__certificationCoverage.makerworld).toContain('real-photo-fail-closed');
  });

  it('provides ten model-derived images with no physical-photo claim', () => {
    expect(DEMO_IMAGE_ASSETS).toHaveLength(10);
    expect(DEMO_IMAGE_ASSETS.map((asset) => asset.file)).toEqual(expect.arrayContaining([
      'calibration-puck-hero.webp',
      'calibration-puck-dimensions.webp',
      'calibration-puck-profile.webp',
      'calibration-puck-certification.webp',
    ]));
    expect(DEMO_IMAGE_ASSETS.map((asset) => asset.alt).join(' ')).not.toMatch(forbiddenClaims);
  });

  it('bundles a Bambu Studio 3MF containing the same calibration-puck model', async () => {
    const bytes = readFileSync(new URL('../public/demo/modelprep-calibration-puck-bambu.3mf', import.meta.url));
    const archive = await JSZip.loadAsync(bytes);
    expect(archive.file('Metadata/project_settings.config')).toBeTruthy();
    expect(archive.file('Metadata/plate_1.png')).toBeTruthy();
    const objectXml = await archive.file('3D/Objects/object_1.model').async('string');
    const settingsXml = await archive.file('Metadata/model_settings.config').async('string');
    expect(settingsXml).toContain('modelprep-calibration-puck-M.stl');
    expect(`${objectXml}\n${settingsXml}`).not.toMatch(/dragon|pcb|enclosure/i);
    expect(settingsXml).toContain('face_count="1080"');
    const projectSettings = JSON.parse(await archive.file('Metadata/project_settings.config').async('string'));
    const sliceInfo = await archive.file('Metadata/slice_info.config').async('string');
    expect(projectSettings.printer_model).toBe('');
    expect(sliceInfo).not.toContain('<plate>');
  });
});
