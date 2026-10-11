import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import makerWorldCategoryTree from '../data/makerworld-categories.json';
import {
  MAKERWORLD_LASER_FORMATS,
  MAKERWORLD_REGULAR_FORMATS,
  compatibilityFromProducts,
  flattenMakerWorldCategories,
  isMakerWorldLaserFile,
  isMakerWorldRegularFile,
  lacMetadataFromValue,
  makerWorldLicenseAllowsRemix,
  makerWorldPublishIssues,
  readLacMetadata,
} from './makerworld';

const completeProject = () => ({
  title: 'Desk organizer',
  description: 'A useful organizer.',
  coverImageId: 'image-1',
  images: [{ id: 'image-1' }, { id: 'image-2' }],
  files: [{ id: 'profile-file', name: 'organizer.3mf' }],
  profiles: [{
    fileId: 'profile-file', name: '0.2mm standard', useMainCover: true,
    photoIds: ['image-2'], realPhotoConfirmed: true, guidelinesAccepted: true,
  }],
});

describe('MakerWorld upload contracts', () => {
  it('recognizes every live regular and Laser & Cut extension', () => {
    expect(MAKERWORLD_REGULAR_FORMATS).toHaveLength(26);
    for (const extension of MAKERWORLD_REGULAR_FORMATS) expect(isMakerWorldRegularFile(`model.${extension}`)).toBe(true);
    for (const extension of MAKERWORLD_LASER_FORMATS) expect(isMakerWorldLaserFile(`design.${extension}`)).toBe(true);
    expect(isMakerWorldRegularFile('package.zip')).toBe(true);
    expect(isMakerWorldLaserFile('project.lac')).toBe(true);
  });

  it('loads the complete selectable category tree instead of a hard-coded subset', () => {
    const categories = flattenMakerWorldCategories(makerWorldCategoryTree);
    expect(categories.filter((category) => category.isLeaf).length).toBe(70);
    expect(categories.some((category) => String(category.id) === '303')).toBe(true);
  });

  it('maps optional printer overrides to MakerWorld compatibility fields', () => {
    expect(compatibilityFromProducts(['P1S', 'A1'])).toEqual([
      { dev_setting_name: '', dev_model_name: 'C12', dev_product_name: 'P1S', nozzle_diameter: 0.4 },
      { dev_setting_name: '', dev_model_name: 'N2S', dev_product_name: 'A1', nozzle_diameter: 0.4 },
    ]);
  });

  it('blocks incomplete print profiles and Exclusive terms before upload', () => {
    const project = completeProject();
    project.profiles[0].name = 'x'.repeat(61);
    project.profiles[0].realPhotoConfirmed = false;
    const issues = makerWorldPublishIssues(project, {
      productMode: '3d', categoryId: 401, primaryProfileFileId: 'profile-file',
      exclusive: true, exclusiveTermsAccepted: false,
    });
    expect(issues.errors).toEqual(expect.arrayContaining([
      'MakerWorld print-profile names are limited to 60 characters.',
      'Confirm that a selected profile photo shows the real printed model.',
      'Accept the MakerWorld Exclusive terms for this model.',
    ]));
  });

  it('blocks images over the live 30 MB per-image limit', () => {
    const project = completeProject();
    project.images[1] = { ...project.images[1], name: 'oversized.png', size: 30 * 1024 * 1024 + 1 };
    expect(makerWorldPublishIssues(project, { productMode: '3d', categoryId: 401 }).errors)
      .toContain("oversized.png exceeds MakerWorld's 30MB per-image limit.");
  });

  it('validates remix attribution and derivative licenses', () => {
    expect(makerWorldLicenseAllowsRemix('BY')).toBe(true);
    expect(makerWorldLicenseAllowsRemix('BY-ND')).toBe(false);
    const issues = makerWorldPublishIssues(completeProject(), {
      productMode: '3d', categoryId: 401, primaryProfileFileId: 'profile-file',
      modelSource: 'remix', remixUrl: 'not a url', remixLicense: 'BY-ND', remixDescription: '',
    });
    expect(issues.errors).toEqual(expect.arrayContaining([
      'Enter a valid URL for the original source.',
      'Explain what you changed in the remix.',
      'The selected original license does not allow derivatives.',
    ]));
  });

  it('supports Share with source attribution and keeps Exclusive original-only', () => {
    const valid = makerWorldPublishIssues(completeProject(), {
      productMode: '3d', categoryId: 401, primaryProfileFileId: 'profile-file',
      modelSource: 'share', remixUrl: 'https://example.com/source', remixLicense: 'BY-ND',
    });
    expect(valid.errors.join(' ')).not.toMatch(/changed|derivatives|original model used/i);

    const invalid = makerWorldPublishIssues(completeProject(), {
      productMode: '3d', categoryId: 401, primaryProfileFileId: 'profile-file',
      modelSource: 'share', exclusive: true,
    });
    expect(invalid.errors).toEqual(expect.arrayContaining([
      'Paste or select the original model used for this shared design.',
      'Select the original model license.',
      'Remixes and shared designs are not eligible for MakerWorld Exclusive.',
    ]));
  });

  it('keeps raw Laser & Cut and .lac package requirements separate', () => {
    const raw = completeProject();
    raw.files = [{ id: 'svg', name: 'panel.svg' }]; raw.profiles = [];
    expect(makerWorldPublishIssues(raw, { productMode: 'laser-cut', laserMode: 'raw' }).errors).toEqual([]);

    const lac = completeProject();
    lac.files = [{ id: 'lac', name: 'panel.lac' }]; lac.profiles = [];
    const autoReadIssues = makerWorldPublishIssues(lac, { productMode: 'laser-cut', laserMode: 'lac' });
    expect(autoReadIssues.errors).toContain('Add a Laser & Cut profile name for the .lac package.');
    expect(autoReadIssues.warnings).toContain('Machine/process metadata will be read from the .lac file; enter overrides if the package does not contain it.');
    expect(makerWorldPublishIssues(lac, {
      productMode: 'laser-cut', laserMode: 'lac', laserInfo: { machineName: 'H2D', processTypes: 'cut' },
      laserProfile: { title: '3mm plywood', useMainCover: true, photoIds: [] },
    }).errors).toEqual([]);

    const rawLac = completeProject();
    rawLac.files = [{ id: 'raw-lac', name: 'source-package.lac' }]; rawLac.profiles = [];
    expect(makerWorldPublishIssues(rawLac, { productMode: 'laser-cut', laserMode: 'raw' }).errors).toEqual([]);
  });

  it('normalizes nested Bambu Suite .lac metadata variants', () => {
    expect(lacMetadataFromValue({ project: {
      lac_info: { plate_list: [{ id: 1 }], process_types: ['cut'], machine_name: 'H2D', material_ids: ['wood'] },
      lacCustomInfo: { other_tools: 'clamps', compatible_devices_selected: ['H2D'] },
      model_2d_info: { width: 100 },
    } })).toEqual({
      lacInfo: { plates: [{ id: 1 }], processTypes: ['cut'], machineName: 'H2D', materialIds: ['wood'] },
      lacCustomInfo: { otherTools: 'clamps', compatibleDevicesSelected: ['H2D'] },
      model2DInfo: { width: 100 },
    });
  });

  it('reads metadata from a generated ZIP-based .lac fixture', async () => {
    const zip = new JSZip();
    zip.file('project/config.json', JSON.stringify({ project: {
      lacInfo: { plates: [{ id: 7 }], processTypes: ['engrave'], machineName: 'H2D', materialIds: ['birch'] },
      lacCustomInfo: { compatibleDevicesSelected: ['H2D'] },
      model2DInfo: { width: 220 },
    } }));
    const fixture = await zip.generateAsync({ type: 'blob' });
    const parsed = await readLacMetadata(fixture, async () => JSZip);
    expect(parsed.lacInfo).toEqual({ plates: [{ id: 7 }], processTypes: ['engrave'], machineName: 'H2D', materialIds: ['birch'] });
    expect(parsed.model2DInfo).toEqual({ width: 220 });
  });

  it('blocks currently forbidden MakerWorld terms before upload', () => {
    const project = completeProject(); project.title = 'Lego organizer';
    const issues = makerWorldPublishIssues(project, { productMode: '3d', categoryId: 401 }, { forbiddenWords: ['Lego'] });
    expect(issues.errors).toContain('MakerWorld currently blocks: Lego.');
  });

  it('only allows CyberBrick on 3MF or .lac paths', () => {
    const raw3d = completeProject(); raw3d.files = [{ id: 'stl', name: 'part.stl' }]; raw3d.profiles = [];
    expect(makerWorldPublishIssues(raw3d, { productMode: '3d', categoryId: 401, cyberBrick: true }, { cyberControlCount: 1 }).errors)
      .toContain('CyberBrick is only available for the Bambu Studio 3MF path.');
    const rawLaser = completeProject(); rawLaser.files = [{ id: 'svg', name: 'part.svg' }]; rawLaser.profiles = [];
    expect(makerWorldPublishIssues(rawLaser, { productMode: 'laser-cut', laserMode: 'raw', cyberBrick: true }, { cyberControlCount: 1 }).errors)
      .toContain('CyberBrick is only available for Bambu Suite .lac Laser & Cut uploads.');
  });

  it('blocks CyberBrick and publishing when the connected account is ineligible', () => {
    const cyberIssues = makerWorldPublishIssues(completeProject(), {
      productMode: '3d', categoryId: 401, primaryProfileFileId: 'profile-file', cyberBrick: true,
    }, { cyberControlCount: 1, rcUpload: false });
    expect(cyberIssues.errors).toContain('CyberBrick upload is not enabled for this MakerWorld account.');
    const bannedIssues = makerWorldPublishIssues(completeProject(), {
      productMode: '3d', categoryId: 401, primaryProfileFileId: 'profile-file',
    }, { uploadAllowed: false });
    expect(bannedIssues.errors).toContain('MakerWorld upload is disabled for this account.');
  });

  it('fails closed when the primary print profile was sliced outside Bambu Studio', () => {
    const project = completeProject();
    project.files[0].threemf = { slicer: 'elegoo', sliced: true };
    const issues = makerWorldPublishIssues(project, {
      productMode: '3d', categoryId: 401, primaryProfileFileId: 'profile-file',
    });
    expect(issues.errors.join(' ')).toMatch(/sliced in Elegoo Slicer.*only accepts Bambu Studio/);
    // A user override back to Bambu clears the block (detection is advisory).
    project.files[0].slicerOverride = 'bambu';
    expect(makerWorldPublishIssues(project, {
      productMode: '3d', categoryId: 401, primaryProfileFileId: 'profile-file',
    }).errors.join(' ')).not.toMatch(/only accepts Bambu Studio/);
  });

  it('prefers a detected Bambu 3MF as the default primary profile', () => {
    const project = completeProject();
    project.files = [
      { id: 'elegoo-file', name: 'organizer-E.3mf', threemf: { slicer: 'elegoo' } },
      { id: 'bambu-file', name: 'organizer.3mf', threemf: { slicer: 'bambu' } },
    ];
    project.profiles = [
      { fileId: 'elegoo-file', name: 'E', useMainCover: true, photoIds: ['image-2'], realPhotoConfirmed: true, guidelinesAccepted: true },
      { fileId: 'bambu-file', name: '0.2mm standard', useMainCover: true, photoIds: ['image-2'], realPhotoConfirmed: true, guidelinesAccepted: true },
    ];
    const issues = makerWorldPublishIssues(project, { productMode: '3d', categoryId: 401 });
    expect(issues.errors.join(' ')).not.toMatch(/only accepts Bambu Studio/);
  });

  it('drops files excluded for MakerWorld from its upload set', () => {
    const project = completeProject();
    project.files = [
      { id: 'keep', name: 'organizer.stl' },
      { id: 'drop', name: 'organizer-E.3mf', threemf: { slicer: 'elegoo' } },
    ];
    project.profiles = [];
    const issues = makerWorldPublishIssues(project, {
      productMode: '3d', categoryId: 401, excludedFileIds: ['drop'],
    });
    expect(issues.files.map((file) => file.id)).toEqual(['keep']);
    expect(issues.errors.join(' ')).not.toMatch(/only accepts Bambu Studio/);
  });
});

describe('unsliced Bambu projects are publishable', () => {
  // MakerWorld's .3mf path takes a Bambu Studio project and slices it
  // server-side; its publish requirements are a profile name, one photo and the
  // guidelines tick (makerworld-web-flow.md). Requiring plates in the file made
  // the blocker unclearable, because the Profiles step created nothing.
  const bambuProject = {
    id: 'f1',
    name: 'latch.3mf',
    isModel: true,
    isProfile: true,
    size: 48 * 1024,
    threemf: { scanned: true, slicer: 'bambu', sliced: false },
  };

  it('asks only for what MakerWorld asks for, once the profile exists', () => {
    const project = {
      title: 'Latch', description: 'x', tags: [], images: [{ id: 'i1', dataUrl: 'data:,', size: 10 }],
      files: [bambuProject],
      profiles: [{
        id: 'p1', fileId: 'f1', name: '0.2mm layer, 9 walls, 15% infill',
        photoIds: ['i1'], useMainCover: true, realPhotoConfirmed: true, guidelinesAccepted: true,
      }],
    };
    const { errors } = makerWorldPublishIssues(project, { enabled: true, categoryId: 1, visibility: 'private' }, {});
    expect(errors.filter((error) => /print profile/i.test(error))).toEqual([]);
  });

  it('names the file when the profile is missing, instead of a step with nothing in it', () => {
    const project = {
      title: 'Latch', description: 'x', tags: [], images: [{ id: 'i1', dataUrl: 'data:,', size: 10 }],
      files: [bambuProject],
      profiles: [],
    };
    const { errors } = makerWorldPublishIssues(project, { enabled: true, categoryId: 1, visibility: 'private' }, {});
    expect(errors.some((error) => error.startsWith('latch.3mf has no print profile yet'))).toBe(true);
  });
});
