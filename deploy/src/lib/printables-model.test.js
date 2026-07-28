import { describe, expect, it } from 'vitest';
import {
  applyPrintablesFileSettings,
  buildPrintablesSummary,
  normalizePrintablesTags,
  parsePrintablesRemixSource,
  publishVerifiedPrintablesModel,
  printablesPublishStrategy,
  printablesReadbackMismatches,
  validatePrintablesModel,
  waitForPrintablesPublication,
} from './printables-model.js';

describe('Printables model contract helpers', () => {
  it('canonicalizes tags exactly as the live API expects', () => {
    expect(normalizePrintablesTags(['Print in place', 'no-supports', 'NO supports', '🔥 Dragon']))
      .toEqual(['printinplace', 'nosupports', 'dragon']);
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
});
