import { describe, expect, it } from 'vitest';
import {
  applyPrintablesFileSettings,
  buildPrintablesSummary,
  normalizePrintablesTags,
  parsePrintablesRemixSource,
  PRINTABLES_FILE_NOTE_MAX,
  PRINTABLES_FOLDER_NAME_MAX,
  PRINTABLES_RICH_IMAGE_MAX_BYTES,
  PRINTABLES_PRICE_MIN,
  PRINTABLES_PRICE_MAX,
  printablesExpectedFiles,
  printablesFileSettingIssues,
  printablesPaidIssues,
  publishVerifiedPrintablesModel,
  printablesPublishStrategy,
  printablesReadbackMismatches,
  printablesSourceFileMismatches,
  validatePrintablesModel,
  waitForPrintablesPublication,
} from './printables-model.js';

describe('Printables model contract helpers', () => {
  it('canonicalizes tags exactly as the live API expects', () => {
    expect(normalizePrintablesTags(['Print in place', 'no-supports', 'NO supports', '🔥 Dragon']))
      .toEqual(['print', 'in', 'place', 'nosupports', 'no', 'supports', 'dragon']);
  });

  it('uses an explicit summary and enforces the 120 character limit', () => {
    expect(buildPrintablesSummary('  A short summary  ', 'ignored')).toBe('A short summary');
    expect(buildPrintablesSummary('', `# ${'dragon '.repeat(30)}`)).toHaveLength(120);
  });

  it.each([
    ['192914', { id: '192914', type: 'printables' }],
    ['https://www.printables.com/model/192914-example', { id: '192914', type: 'printables' }],
    ['https://www.printables.com/education/192914/example', { id: '192914', type: 'printables' }],
    ['https://example.com/original', { id: 'https://example.com/original', type: 'external' }],
    ['not a source', null],
  ])('parses remix source %s', (source, expected) => {
    expect(parsePrintablesRemixSource(source)).toEqual(expected);
  });

  it('uses the website publish branch for direct and approval-gated accounts', () => {
    expect(printablesPublishStrategy({ publishApprovalRequired: false })).toBe('direct-update');
    expect(printablesPublishStrategy({ publishApprovalRequired: true })).toBe('approval-request');
  });

  it('publishes a verified normal-account draft with an update of the existing ID', async () => {
    const request = async (route, body) => {
      expect(route).toBe('model');
      expect(body).toMatchObject({ id: '1794000', draft: false, name: 'Dragon' });
      return { output: { id: '1794000' } };
    };
    await expect(publishVerifiedPrintablesModel({
      request,
      id: '1794000',
      modelPayload: { name: 'Dragon', draft: true },
      readbackModel: { publishApprovalRequired: false },
    })).resolves.toEqual({ strategy: 'direct-update', publishRequest: null });
  });

  it('requests approval without changing the verified draft for gated accounts', async () => {
    const request = async (route, body) => {
      expect(route).toBe('publish');
      expect(body).toEqual({ id: '1794001' });
      return { output: { id: 'request-1', status: 'PENDING' } };
    };
    await expect(publishVerifiedPrintablesModel({
      request,
      id: '1794001',
      modelPayload: { name: 'Dragon', draft: true },
      readbackModel: { publishApprovalRequired: true },
    })).resolves.toEqual({
      strategy: 'approval-request',
      publishRequest: { output: { id: 'request-1', status: 'PENDING' } },
    });
  });

  it('polls until direct publication is independently confirmed', async () => {
    const states = ['draft', 'draft', 'live'];
    const delay = async () => {};
    const request = async () => ({ state: states.shift(), model: { id: '1794002' } });
    await expect(waitForPrintablesPublication({
      request,
      id: '1794002',
      strategy: 'direct-update',
      attempts: 3,
      delay,
    })).resolves.toMatchObject({ state: 'live' });
  });

  it('accepts pending only for approval-gated publishing', async () => {
    const request = async () => ({ state: 'pending' });
    await expect(waitForPrintablesPublication({
      request,
      id: '1794003',
      strategy: 'approval-request',
      attempts: 1,
    })).resolves.toEqual({ state: 'pending' });
    await expect(waitForPrintablesPublication({
      request,
      id: '1794003',
      strategy: 'direct-update',
      attempts: 1,
    })).rejects.toThrow(/did not confirm a live model/);
  });

  it('overlays per-file folder, note, and order on inspected files', () => {
    expect(applyPrintablesFileSettings(
      { id: 42, name: 'dragon.stl', folder: 'upstream', note: 'upstream' },
      { printables: { folder: '/parts/large/', note: 'Print twice' } },
      3,
    )).toEqual({
      id: '42',
      folder: 'parts/large',
      name: 'dragon.stl',
      note: 'Print twice',
    });
  });

  it('matches the live Printables file-note and folder-name limits', () => {
    expect(PRINTABLES_FILE_NOTE_MAX).toBe(95);
    expect(PRINTABLES_FOLDER_NAME_MAX).toBe(60);
    expect(applyPrintablesFileSettings(
      { id: 42, name: 'dragon.stl', note: '' },
      { printables: { note: 'n'.repeat(100) } },
    ).note).toHaveLength(95);
    expect(printablesFileSettingIssues([{
      name: 'dragon.stl',
      printables: { note: 'n'.repeat(96), folder: `parts/${'x'.repeat(61)}` },
    }])).toEqual([
      'dragon.stl: Printables file notes must be at most 95 characters.',
      'dragon.stl: each Printables folder name must be at most 60 characters.',
    ]);
    expect(printablesFileSettingIssues([{
      name: 'dragon.gcode',
      printables: { layerHeight: '0', nozzleDiameter: 'bad', printDuration: '1000', weight: '12.5' },
    }])).toEqual([
      'dragon.gcode: Printables layer height override must be a positive number.',
      'dragon.gcode: Printables nozzle diameter override must be a positive number.',
      'dragon.gcode: Printables printed weight override must be a whole number of grams.',
      'dragon.gcode: Printables print duration override must be at most 999 hours.',
    ]);
  });

  it('enforces the live rich-image and account-gated Store/Club contract', () => {
    expect(PRINTABLES_RICH_IMAGE_MAX_BYTES).toBe(8 * 1024 * 1024);
    // Price bounds are server-provided (unlocated by live probe), so the
    // client only requires a positive whole-dollar amount.
    expect(printablesPaidIssues({ store: true, price: '4', authorship: 'author' }, {
      designerStatus: 'APPROVED', storeActive: true, storeModelsCount: 0, maxStoreModels: 10, tiers: [],
    })).toEqual([]);
    expect(printablesPaidIssues({ store: true, price: '4.50', authorship: 'author' }, {
      designerStatus: 'APPROVED', storeActive: true, storeModelsCount: 0, maxStoreModels: 10, tiers: [],
    })).toEqual(['Printables Store price must be a positive whole dollar amount.']);
    expect(printablesPaidIssues({ club: true, authorship: 'reupload' }, {
      designerStatus: 'APPROVED', storeActive: false, tiers: [{ id: '1' }],
    })).toEqual(['Printables does not allow paid or Club reuploads.']);
    expect(printablesPaidIssues({ club: true, store: true, price: '25', authorship: 'author' }, {
      designerStatus: 'APPROVED', storeActive: true, storeModelsCount: 1, maxStoreModels: 10, tiers: [{ id: '1' }],
    })).toEqual([]);
  });

  it('validates author, remix, and reupload combinations', () => {
    const base = {
      title: 'Dragon',
      summary: 'A dragon',
      description: 'Description',
      images: [{}],
      files: [{}],
      options: { categoryId: '36', aiGenerated: false, authorship: 'author' },
    };
    expect(validatePrintablesModel(base)).toEqual([]);
    expect(validatePrintablesModel({
      ...base,
      options: { ...base.options, authorship: 'remix', remixParents: ['192914'], remixDescription: 'New wings' },
    })).toEqual([]);
    expect(validatePrintablesModel({
      ...base,
      options: { ...base.options, authorship: 'reupload', remixParents: ['https://example.com/original'] },
    })).toEqual([]);
    expect(validatePrintablesModel({
      ...base,
      options: { ...base.options, authorship: 'remix', remixParents: ['bad'], remixDescription: '' },
    })).toEqual([
      'Add a valid Printables model ID or http(s) source URL in Platforms.',
      'Describe what changed in this remix.',
    ]);
  });

  it('reports exact metadata and asset readback mismatches', () => {
    const expected = {
      name: 'Dragon', summary: 'Summary', description: '<p>Description</p>', authorship: 'author',
      aiGenerated: false, nsfw: false, politicalContent: false,
      category: '36', license: '3', tags: ['print-in-place'],
      mainImage: '1', remixParents: [],
      images: [{ id: '1' }], stls: [{ id: '2' }], slas: [], gcodes: [], otherFiles: [],
    };
    const model = {
      name: 'Dragon', summary: 'Summary', description: '<p>Description</p>', authorship: 'author',
      aiGenerated: false, nsfw: false, politicalContent: false,
      category: { id: '36' }, license: { id: '3' },
      image: { id: '1' }, tags: [{ name: 'printinplace' }], images: [{ id: '1' }],
      remixParents: [],
      stls: [{ id: '2' }], slas: [], gcodes: [], otherFiles: [],
    };
    expect(printablesReadbackMismatches(expected, model)).toEqual([]);
    expect(printablesReadbackMismatches(expected, { ...model, nsfw: true, images: [] }))
      .toEqual([
        'NSFW flag: expected false, received true',
        'images: expected 1, received 0',
      ]);
  });
  it('lists the source files that must come back verbatim, with their bytes', () => {
    const files = [
      { name: 'puck-S.stl', size: 36084 },
      { name: 'puck-bambu.3mf', size: 30787 },
      { name: 'extras.zip', size: 900 },
    ];
    // An unpacked ZIP becomes many differently named files of different sizes,
    // so it is excluded from both the name and the byte comparison.
    expect(printablesExpectedFiles(files, { zipMode: 'unzip' }))
      .toEqual([{ name: 'puck-S.stl', size: 36084 }, { name: 'puck-bambu.3mf', size: 30787 }]);
    expect(printablesExpectedFiles(files, { zipMode: 'archive' })).toHaveLength(3);
    // An unknown source size must not become a phantom expectation of 0 bytes.
    expect(printablesExpectedFiles([{ name: 'a.stl' }], {})).toEqual([{ name: 'a.stl', size: null }]);
  });

  it('fails closed when a selected file is missing from the saved model', () => {
    // Live evidence (public model 1472993): Printables files a .3mf under
    // `stls`, so the profile is an ordinary model file with no separate role.
    const model = {
      stls: [
        { id: '1', name: 'puck-S.stl', fileSize: 36084 },
        { id: '2', name: 'puck-bambu.3mf', fileSize: 30787 },
      ],
      slas: [], gcodes: [], otherFiles: [{ id: '3', name: 'notes.txt', fileSize: 12 }],
    };
    expect(printablesSourceFileMismatches([
      { name: 'puck-S.stl', size: 36084 },
      { name: 'puck-bambu.3mf', size: 30787 },
      { name: 'notes.txt', size: 12 },
    ], model)).toEqual([]);
    // The defect this exists to catch: the payload we send is derived from
    // Printables' own processing response, so a dropped file agrees with
    // itself on both sides of printablesReadbackMismatches and passes.
    expect(printablesSourceFileMismatches([
      { name: 'puck-S.stl', size: 36084 }, { name: 'puck-bambu.3mf', size: 30787 },
    ], { stls: [{ id: '1', name: 'puck-S.stl', fileSize: 36084 }], slas: [], gcodes: [], otherFiles: [] }))
      .toEqual(['puck-bambu.3mf: selected for Printables but absent from the saved model files']);
  });

  it('fails closed on a retained record with no bytes behind it', () => {
    // Live-proven on draft 1803724: Printables stores model files verbatim, so
    // retained fileSize equals the source size exactly.
    const call = (retained) => printablesSourceFileMismatches(
      [{ name: 'puck-S.stl', size: 36084 }],
      { stls: [{ id: '1', name: 'puck-S.stl', ...retained }], slas: [], gcodes: [], otherFiles: [] },
    );
    expect(call({ fileSize: 36084 })).toEqual([]);
    expect(call({ fileSize: 0 })).toEqual(['puck-S.stl: Printables reported no retained file size']);
    // A status query that does not select fileSize cannot certify retention.
    expect(call({})).toEqual(['puck-S.stl: Printables reported no retained file size']);
    expect(call({ fileSize: null })).toEqual(['puck-S.stl: Printables reported no retained file size']);
    expect(call({ fileSize: 12 })).toEqual(['puck-S.stl: expected 36084 retained bytes, received 12']);
    // An unknown source size still requires a positive retained size.
    expect(printablesSourceFileMismatches([{ name: 'puck-S.stl', size: null }], {
      stls: [{ id: '1', name: 'puck-S.stl', fileSize: 999 }], slas: [], gcodes: [], otherFiles: [],
    })).toEqual([]);
  });

  it('checks the bucket only for the two extensions with live evidence', () => {
    expect(printablesSourceFileMismatches([{ name: 'puck-bambu.3mf', size: 30787 }], {
      stls: [], slas: [], gcodes: [], otherFiles: [{ id: '9', name: 'puck-bambu.3mf', fileSize: 30787 }],
    })).toEqual([
      'puck-bambu.3mf: expected Printables to file this under stls, received otherFiles',
    ]);
    // .step has no live bucket evidence, so it is name-checked only rather
    // than failing a build on a guessed contract.
    expect(printablesSourceFileMismatches([{ name: 'part.step', size: 5 }], {
      stls: [], slas: [], gcodes: [], otherFiles: [{ id: '9', name: 'part.step', fileSize: 5 }],
    })).toEqual([]);
  });

  it('matches file names case-insensitively and one-for-one', () => {
    expect(printablesSourceFileMismatches([{ name: 'Puck-S.STL', size: 7 }], {
      stls: [{ id: '1', name: 'puck-s.stl', fileSize: 7 }], slas: [], gcodes: [], otherFiles: [],
    })).toEqual([]);
    // Two selected files of the same name need two retained files.
    expect(printablesSourceFileMismatches([{ name: 'a.stl', size: 7 }, { name: 'a.stl', size: 7 }], {
      stls: [{ id: '1', name: 'a.stl', fileSize: 7 }], slas: [], gcodes: [], otherFiles: [],
    })).toEqual(['a.stl: selected for Printables but absent from the saved model files']);
  });
});
