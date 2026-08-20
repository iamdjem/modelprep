import { describe, expect, it } from 'vitest';
import {
  buildMakerOnlineExpectation,
  certifyMakerOnlineModel,
  makerOnlineExpectationIssues,
  makerOnlinePrintTypes,
  MAKERONLINE_DRAFT_STATUS,
  makerOnlineExpectedFiles,
  makerOnlineExpectedImages,
  makerOnlineExpectedProfiles,
  makerOnlineHardIssues,
  makerOnlinePendingIssues,
  makerOnlineReadbackIssues,
  makerOnlineUploadReport,
  MAKERONLINE_PROCESSING_INTERVAL_MS,
  MAKERONLINE_PROCESSING_TIMEOUT_MS,
  runMakerOnlineUpload,
} from './makeronline-verify.js';

// Shapes verified read-only against retained draft 317477 on 2026-08-08:
// files carry key/file_name/file_size/model_size, images carry key/is_main,
// and the profile branch is print_file_type/print_files/print_title/
// print_desc/print_images.
const up = (key, name, size, extra = {}) => ({
  key, name, size, url: `https://cdn.example/${key}`,
  // What MakerOnline itself returned, distinct from the local source values.
  nativeFileName: name, nativeFileSize: size, sourceFileName: name, sourceFileSize: size,
  ...extra,
});

const S = up('k-s', 'modelprep-calibration-puck-S.stl', 36084);
const M = up('k-m', 'modelprep-calibration-puck-M.stl', 54084);
const MF = up('k-3mf', 'modelprep-calibration-puck-bambu.3mf', 30787);
const PROFILE = up('k-3mf', 'modelprep-calibration-puck-bambu.3mf', 30787, {
  printers: ['Kobra 3'], nozzle: '0.4', layer: '0.2', plates: 1, parse_type: 1,
});
const IMG = (n) => up(`img-${n}`, `gallery-${n}.webp`, 100 + n);

const retainedFile = (key, name, size, dims) => ({
  key, file_name: name, file_size: size,
  model_size: JSON.stringify({ width: dims[0], height: dims[1], length: dims[2] }),
});
const retainedProfile = (name, size, over = {}) => ({
  key: 'k-3mf', file_name: name, file_size: size,
  printers: ['Kobra 3'], nozzle: '0.4', layer: '0.2', plates: 1, parse_type: 1,
  ...over,
});

const expected = {
  files: makerOnlineExpectedFiles([S, M, MF]),
  images: makerOnlineExpectedImages([IMG(1), IMG(2)]),
  profiles: makerOnlineExpectedProfiles([PROFILE]),
  printImages: makerOnlineExpectedImages([IMG(1)]),
  printTitle: 'Calibration Puck: Bambu A1 Mini',
  printDescription: '<p>34 mm puck</p>',
  title: 'ModelPrep Calibration Puck — Upload Test Fixture',
  description: '<h1>Puck</h1>',
  categoryId: '36', license: 3, permissions: 2, source: 1,
  printTypes: [1], tags: ['calibration', 'test-model'],
  ai_help: 0, is_adult_nsfw: 0, docs: 0, status: 3, isOffline: 0,
};

const retained = (over = {}) => ({
  files: [
    retainedFile('k-s', 'modelprep-calibration-puck-S.stl', 36084, [22, 3.2, 22]),
    retainedFile('k-m', 'modelprep-calibration-puck-M.stl', 54084, [34, 4.4, 34]),
    retainedFile('k-3mf', 'modelprep-calibration-puck-bambu.3mf', 30787, [34, 4.4, 34]),
  ],
  images: [{ key: 'img-1', is_main: 1 }, { key: 'img-2', is_main: 0 }],
  print_file_type: 1,
  print_files: [retainedProfile('modelprep-calibration-puck-bambu.3mf', 30787)],
  print_title: 'Calibration Puck: Bambu A1 Mini',
  print_desc: '<p>34 mm puck</p>',
  print_images: [{ key: 'img-1' }],
  title: 'ModelPrep Calibration Puck — Upload Test Fixture',
  desc: '<h1>Puck</h1>',
  category_id: 36, license: 3, permissions: 2, source: 1,
  print_types: [1], tags: ['calibration', 'test-model'],
  ai_help: 0, is_adult_nsfw: 0, docs: [], status: 3, is_offline: 0,
  ...over,
});

describe('MakerOnline retained-model verification', () => {
  it('passes on a fully correct dual-role retained model', () => {
    expect(makerOnlineReadbackIssues(expected, retained())).toEqual([]);
  });

  it('refuses an expectation built from a transport field MakerOnline omitted', () => {
    // Falling back to the source value would invent an expectation the
    // platform never confirmed.
    const noKey = { ...expected, files: makerOnlineExpectedFiles([{ ...S, key: '' }, M, MF]) };
    expect(makerOnlineReadbackIssues(noKey, retained()).join(' ')).toMatch(/upload response omitted key/);
    // A source fallback must never satisfy a native-field requirement.
    const noNativeSize = { ...expected, images: makerOnlineExpectedImages([{ ...IMG(1), nativeFileSize: null }, IMG(2)]) };
    expect(makerOnlineReadbackIssues(noNativeSize, retained()).join(' ')).toMatch(/upload response omitted filesize/);
    const noNativeName = { ...expected, files: makerOnlineExpectedFiles([{ ...S, nativeFileName: null }, M, MF]) };
    expect(makerOnlineReadbackIssues(noNativeName, retained()).join(' ')).toMatch(/upload response omitted filename/);
  });

  it('rejects swapped raw files even though every key is present', () => {
    const swapped = retained({
      files: [
        retainedFile('k-m', 'modelprep-calibration-puck-M.stl', 54084, [34, 4.4, 34]),
        retainedFile('k-s', 'modelprep-calibration-puck-S.stl', 36084, [22, 3.2, 22]),
        retainedFile('k-3mf', 'modelprep-calibration-puck-bambu.3mf', 30787, [34, 4.4, 34]),
      ],
    });
    const issues = makerOnlineReadbackIssues(expected, swapped);
    expect(issues.join(' ')).toMatch(/raw files\[0\]\.key: expected k-s, received k-m/);
    expect(issues.join(' ')).toMatch(/raw files\[1\]\.key: expected k-m, received k-s/);
  });

  it('rejects a foreign key and a matching name with wrong bytes', () => {
    expect(makerOnlineReadbackIssues(expected, retained({
      files: [
        { ...retainedFile('someone-else', 'modelprep-calibration-puck-S.stl', 36084, [22, 3.2, 22]) },
        retainedFile('k-m', 'modelprep-calibration-puck-M.stl', 54084, [34, 4.4, 34]),
        retainedFile('k-3mf', 'modelprep-calibration-puck-bambu.3mf', 30787, [34, 4.4, 34]),
      ],
    })).join(' ')).toMatch(/raw files\[0\]\.key: expected k-s, received someone-else/);

    expect(makerOnlineReadbackIssues(expected, retained({
      files: [
        retainedFile('k-s', 'modelprep-calibration-puck-S.stl', 999, [22, 3.2, 22]),
        retainedFile('k-m', 'modelprep-calibration-puck-M.stl', 54084, [34, 4.4, 34]),
        retainedFile('k-3mf', 'modelprep-calibration-puck-bambu.3mf', 30787, [34, 4.4, 34]),
      ],
    }))).toEqual(['raw files[0]: expected 36084 retained bytes, received 999']);
  });

  it('rejects a raw file with no parsed geometry', () => {
    for (const bad of [undefined, '{}', JSON.stringify({ width: 0, height: 1, length: 1 })]) {
      expect(makerOnlineReadbackIssues(expected, retained({
        files: [
          { ...retainedFile('k-s', 'modelprep-calibration-puck-S.stl', 36084, [22, 3.2, 22]), model_size: bad },
          retainedFile('k-m', 'modelprep-calibration-puck-M.stl', 54084, [34, 4.4, 34]),
          retainedFile('k-3mf', 'modelprep-calibration-puck-bambu.3mf', 30787, [34, 4.4, 34]),
        ],
      })).join(' ')).toMatch(/raw files\[0\]: MakerOnline reported no parsed geometry/);
    }
  });

  it('rejects swapped or wrong listing images and an incorrect main image', () => {
    expect(makerOnlineReadbackIssues(expected, retained({
      images: [{ key: 'img-2', is_main: 1 }, { key: 'img-1', is_main: 0 }],
    })).join(' ')).toMatch(/images\[0\]\.key: expected img-1, received img-2/);
    // Cover must be the first uploaded image, and there must be exactly one.
    expect(makerOnlineReadbackIssues(expected, retained({
      images: [{ key: 'img-1', is_main: 0 }, { key: 'img-2', is_main: 1 }],
    }))).toEqual(['images: expected the cover to be img-1, received img-2']);
    expect(makerOnlineReadbackIssues(expected, retained({
      images: [{ key: 'img-1', is_main: 1 }, { key: 'img-2', is_main: 1 }],
    }))).toEqual(['images: expected exactly one is_main cover, received 2']);
    expect(makerOnlineReadbackIssues(expected, retained({
      images: [{ key: 'img-1', is_main: 0 }, { key: 'img-2', is_main: 0 }],
    }))).toEqual(['images: expected exactly one is_main cover, received 0']);
  });

  it('rejects a profile that MakerOnline did not actually parse', () => {
    for (const field of ['printers', 'nozzle', 'layer']) {
      const broken = retainedProfile('modelprep-calibration-puck-bambu.3mf', 30787);
      broken[field] = field === 'printers' ? [] : '';
      expect(makerOnlineReadbackIssues(expected, retained({ print_files: [broken] })).join(' '))
        .toMatch(new RegExp(`returned no parsed ${field}`));
    }
  });

  it('distinguishes absent, empty and populated profile branches', () => {
    // Absent: the field this check depends on is gone.
    expect(makerOnlineReadbackIssues(expected, retained({ print_files: undefined })).join(' '))
      .toMatch(/expected print_files to be present, received none/);
    // Empty while a profile was sent: a real contradiction.
    expect(makerOnlineReadbackIssues(expected, retained({ print_files: [], print_file_type: 0 })).join(' '))
      .toMatch(/print_file_type: expected 1, received 0/);
    // Populated while none was sent: equally contradictory.
    const noProfiles = { ...expected, profiles: [], printImages: [], printTitle: '', printDescription: '' };
    expect(makerOnlineReadbackIssues(noProfiles, retained({
      print_file_type: 1, print_files: [retainedProfile('x.3mf', 1)], print_images: [],
    })).join(' ')).toMatch(/print_file_type: expected 0, received 1/);
    // The correct no-profile state passes, including empty title and images.
    expect(makerOnlineReadbackIssues(noProfiles, retained({
      print_file_type: 0, print_files: [], print_title: '', print_desc: '', print_images: [],
    }))).toEqual([]);
    // A stray title on a no-profile model is reported.
    expect(makerOnlineReadbackIssues(noProfiles, retained({
      print_file_type: 0, print_files: [], print_title: 'leftover', print_desc: '', print_images: [],
    }))).toEqual(['print_title: expected empty, received "leftover"']);
    // No-profile state also requires an empty description and a present,
    // empty print_images list.
    expect(makerOnlineReadbackIssues(noProfiles, retained({
      print_file_type: 0, print_files: [], print_title: '', print_desc: '<p>x</p>', print_images: [],
    }))).toEqual(['print_desc: expected empty on a model with no print profile']);
    expect(makerOnlineReadbackIssues(noProfiles, retained({
      print_file_type: 0, print_files: [], print_title: '', print_desc: '', print_images: undefined,
    }))).toEqual(['print images: expected print_images to be present, received none']);
  });

  it('checks profile title, description and ordered profile images', () => {
    expect(makerOnlineReadbackIssues(expected, retained({ print_title: 'other' })).join(' '))
      .toMatch(/print_title: expected/);
    expect(makerOnlineReadbackIssues(expected, retained({ print_desc: '<p>different</p>' })))
      .toEqual(['print_desc: retained profile description does not match what was sent']);
    expect(makerOnlineReadbackIssues(expected, retained({ print_images: [{ key: 'img-9' }] })))
      .toEqual(['print images[0].key: expected img-1, received img-9']);
    expect(makerOnlineReadbackIssues(expected, retained({ print_images: [] })).join(' '))
      .toMatch(/print images: expected 1, received 0/);
  });

  it('requires title, description, taxonomy, licence, permission, source, flags and docs', () => {
    const cases = [
      [{ title: 'Other' }, /^title:/],
      [{ desc: '<h1>Other</h1>' }, /^description:/],
      [{ category_id: 99 }, /^category:/],
      [{ license: 7 }, /^license:/],
      [{ permissions: 1 }, /^permissions:/],
      [{ source: 2 }, /^source:/],
      [{ print_types: [2] }, /^print_types:/],
      [{ tags: ['calibration'] }, /^tags:/],
      [{ ai_help: 1 }, /^AI flag:/],
      [{ is_adult_nsfw: 1 }, /^NSFW flag:/],
      [{ docs: [{ id: 1 }] }, /^documentation: expected 0, received 1/],
      [{ docs: undefined }, /expected a retained docs list/],
    ];
    for (const [over, rx] of cases) {
      expect(makerOnlineReadbackIssues(expected, retained(over)).find((i) => rx.test(i))).toBeTruthy();
    }
  });

  it('requires the publication fields to be present, not merely consistent', () => {
    expect(makerOnlineReadbackIssues(expected, retained({ status: undefined })).join(' '))
      .toMatch(/expected a retained status, received none/);
    expect(makerOnlineReadbackIssues(expected, retained({ status: 1 })).join(' '))
      .toMatch(/expected status 3, received 1/);
    expect(makerOnlineReadbackIssues(expected, retained({ is_offline: undefined })).join(' '))
      .toMatch(/expected a retained is_offline, received none/);
  });
});

describe('MakerOnline bounded processing certification', () => {
  const unprocessed = () => retained({ files: [], print_files: [] });

  const poller = (pages) => {
    const calls = [];
    const request = async (route) => {
      calls.push(route);
      const statusCalls = calls.filter((c) => c.startsWith('status?')).length;
      return { model: pages[Math.min(statusCalls - 1, pages.length - 1)]() };
    };
    return { request, calls };
  };

  it('separates settling issues from contradictions', () => {
    expect(makerOnlinePendingIssues([
      'raw files[0]: MakerOnline reported no parsed geometry (model_size), so usable geometry is unproven',
      'print profiles[0]: MakerOnline returned no parsed printers, so the print profile is unparsed',
      'raw files: expected 3, received 0',
    ])).toHaveLength(3);
    expect(makerOnlineHardIssues([
      'title: expected "a", received "b"',
      'images: expected exactly one is_main cover, received 2',
      'raw files[0].key: expected k-s, received someone-else',
      'print_file_type: expected 1, received 0',
    ])).toHaveLength(4);
  });

  it('polls the same id and certifies once processing settles', async () => {
    const { request, calls } = poller([unprocessed, () => retained()]);
    const result = await certifyMakerOnlineModel({
      request, id: 'mo-1', expected, delay: async () => {}, now: () => 0,
    });
    expect(result.certified).toBe(true);
    expect(result.attempts).toBe(2);
    expect(new Set(calls).size).toBe(1);
    expect(calls[0]).toBe('status?id=mo-1');
  });

  it('fails immediately on a hard contradiction', async () => {
    const { request, calls } = poller([() => retained({ license: 7 })]);
    const result = await certifyMakerOnlineModel({
      request, id: 'mo-2', expected,
      delay: async () => { throw new Error('must not wait on a contradiction'); }, now: () => 0,
    });
    expect(result.certified).toBe(false);
    expect(result.timedOut).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('times out with only the unresolved settling fields', async () => {
    let clock = 0;
    const { request, calls } = poller([unprocessed]);
    const result = await certifyMakerOnlineModel({
      request, id: 'mo-3', expected, intervalMs: 1000, timeoutMs: 5000,
      delay: async () => { clock += 1000; }, now: () => clock,
    });
    expect(result.timedOut).toBe(true);
    expect(makerOnlineHardIssues(result.issues)).toEqual([]);
    expect(calls.length).toBeGreaterThan(1);
  });

  it('documents a bounded interval and timeout', () => {
    expect(MAKERONLINE_PROCESSING_INTERVAL_MS).toBe(3_000);
    expect(MAKERONLINE_PROCESSING_TIMEOUT_MS).toBe(120_000);
  });
});

describe('MakerOnline retained receipt and single-save behaviour', () => {
  const saved = { id: 'mo-42', state: 'draft', url: 'https://www.makeronline.com/model/mo-42' };
  const SENTENCE = /The model was created and is retained at/g;

  it('preserves the receipt immediately after save-draft, before readback', async () => {
    const announced = [];
    await runMakerOnlineUpload({
      request: async (route) => (route === 'submit' ? saved : { model: retained() }),
      payload: {}, expected,
      certify: async () => { throw new Error('readback exploded'); },
      onRetained: (v) => announced.push(v),
    });
    // Announced before certification ran at all.
    expect(announced).toEqual([saved]);
  });

  it('survives parser, polling and verification failure with id, url and state', async () => {
    const calls = [];
    const request = async (route) => {
      calls.push(route);
      if (route === 'submit') return saved;
      return { model: retained({ print_files: [] , print_file_type: 0 }) };
    };
    let clock = 0;
    const outcome = await runMakerOnlineUpload({
      request, payload: {}, expected,
      intervalMs: 1000, timeoutMs: 4000, delay: async () => { clock += 1000; }, now: () => clock,
    });
    const report = makerOnlineUploadReport(outcome);
    expect(report.ok).toBe(false);
    expect(report.result).toMatchObject({ id: 'mo-42', state: 'draft', url: saved.url, uncertified: true });
    expect(report.metadata).toMatchObject({ publicationState: 'draft', url: saved.url, uncertified: true });
    expect(report.message.match(SENTENCE) || []).toHaveLength(1);
    // A failed readback must never trigger another save.
    expect(calls.filter((c) => c === 'submit')).toHaveLength(1);
  });

  it('saves exactly once across delayed settling', async () => {
    const calls = [];
    const request = async (route) => {
      calls.push(route);
      if (route === 'submit') return saved;
      return { model: calls.filter((c) => c.startsWith('status?')).length > 2 ? retained() : retained({ files: [] }) };
    };
    let clock = 0;
    const outcome = await runMakerOnlineUpload({
      request, payload: {}, expected,
      intervalMs: 1000, timeoutMs: 60_000, delay: async () => { clock += 1000; }, now: () => clock,
    });
    expect(outcome.verified).toBe(true);
    expect(calls.filter((c) => c === 'submit')).toHaveLength(1);
    expect(makerOnlineUploadReport(outcome).message).not.toMatch(SENTENCE);
  });

  it('fails loudly on an incomplete save receipt and announces nothing', async () => {
    for (const bad of [{ state: 'draft', url: 'u' }, { id: 'x', url: 'u' }, { id: 'x', state: 'draft' }, {}]) {
      const announced = [];
      await expect(runMakerOnlineUpload({
        request: async (route) => (route === 'submit' ? bad : { model: retained() }),
        payload: {}, expected, onRetained: (v) => announced.push(v),
      })).rejects.toThrow(/incomplete save receipt/i);
      expect(announced).toEqual([]);
    }
  });
});

describe('MakerOnline profile identity and parser-value comparison', () => {
  it('rejects a profile carrying a foreign upload key', () => {
    // Same name, same bytes, fully parsed — but somebody else's file.
    expect(makerOnlineReadbackIssues(expected, retained({
      print_files: [retainedProfile('modelprep-calibration-puck-bambu.3mf', 30787, { key: 'someone-else' })],
    }))).toEqual(['print profiles[0].key: expected k-3mf, received someone-else']);
  });

  it('compares every parser value against the parse-info response', () => {
    const wrong = [
      [{ printers: ['Kobra 2'] }, /printers: expected \["Kobra 3"\], received \["Kobra 2"\]/],
      [{ nozzle: '0.6' }, /nozzle: expected "0\.4", received "0\.6"/],
      [{ layer: '0.28' }, /layer: expected "0\.2", received "0\.28"/],
      [{ plates: 4 }, /plates: expected 1, received 4/],
      [{ parse_type: 2 }, /parse_type: expected 1, received 2/],
    ];
    for (const [over, rx] of wrong) {
      const issues = makerOnlineReadbackIssues(expected, retained({
        print_files: [retainedProfile('modelprep-calibration-puck-bambu.3mf', 30787, over)],
      }));
      expect(issues.find((i) => rx.test(i))).toBeTruthy();
    }
  });

  it('reports each missing parser value individually', () => {
    for (const [field, empty] of [['printers', []], ['nozzle', ''], ['layer', ''], ['plates', null], ['parse_type', null]]) {
      const issues = makerOnlineReadbackIssues(expected, retained({
        print_files: [retainedProfile('modelprep-calibration-puck-bambu.3mf', 30787, { [field]: empty })],
      }));
      expect(issues.find((i) => i.includes(`returned no parsed ${field}`))).toBeTruthy();
    }
  });

  it('requires print_images present, and rejects unexpected ones, when profiles exist', () => {
    const noProfileImages = { ...expected, printImages: [] };
    expect(makerOnlineReadbackIssues(noProfileImages, retained({ print_images: undefined })).join(' '))
      .toMatch(/print images: expected print_images to be present, received none/);
    expect(makerOnlineReadbackIssues(noProfileImages, retained({ print_images: [{ key: 'stray' }] })))
      .toEqual(['print images: expected 0, received 1']);
    expect(makerOnlineReadbackIssues(noProfileImages, retained({ print_images: [] }))).toEqual([]);
  });

  it('rejects an expectation entry with no backing upload record', () => {
    expect(makerOnlineReadbackIssues({ ...expected, files: [{ key: 'k-s', fileName: 'a.stl', fileSize: 1 }] }, retained()).join(' '))
      .toMatch(/no backing upload record/);
  });
});

describe('MakerOnline geometry comparison', () => {
  it('compares exact dimensions only when the upload response supplied them', () => {
    // Authoritative: MakerOnline's own upload response carried model_size.
    const authoritative = {
      ...expected,
      files: makerOnlineExpectedFiles([
        { ...S, model_size: JSON.stringify({ width: 22, height: 3.2, length: 22 }) }, M, MF,
      ]),
    };
    expect(makerOnlineReadbackIssues(authoritative, retained())).toEqual([]);
    expect(makerOnlineReadbackIssues(authoritative, retained({
      files: [
        retainedFile('k-s', 'modelprep-calibration-puck-S.stl', 36084, [99, 3.2, 22]),
        retainedFile('k-m', 'modelprep-calibration-puck-M.stl', 54084, [34, 4.4, 34]),
        retainedFile('k-3mf', 'modelprep-calibration-puck-bambu.3mf', 30787, [34, 4.4, 34]),
      ],
    }))).toEqual(['raw files[0]: expected width 22, received 99']);
    // Without an authoritative model_size the check proves positive parsed
    // geometry only; source dimensions are never invented.
    expect(makerOnlineReadbackIssues(expected, retained({
      files: [
        retainedFile('k-s', 'modelprep-calibration-puck-S.stl', 36084, [99, 9, 9]),
        retainedFile('k-m', 'modelprep-calibration-puck-M.stl', 54084, [34, 4.4, 34]),
        retainedFile('k-3mf', 'modelprep-calibration-puck-bambu.3mf', 30787, [34, 4.4, 34]),
      ],
    }))).toEqual([]);
  });
});

describe('MakerOnline production wiring', () => {
  const payload = {
    publication: 'draft', title: 'T', description: '<p>d</p>', categoryId: '36',
    license: 3, permission: 2, source: 1, printMethod: 1, aiHelp: false, nsfw: false,
    printTitle: 'PT', printDescription: '<p>pd</p>',
  };

  it('mirrors the adapter print_types mapping for FDM, Resin and Both', () => {
    // Adapter: printMethod === 3 ? [1, 2] : [printMethod].
    expect(makerOnlinePrintTypes(1)).toEqual([1]);
    expect(makerOnlinePrintTypes(2)).toEqual([2]);
    expect(makerOnlinePrintTypes(3)).toEqual([1, 2]);
    expect(buildMakerOnlineExpectation({ payload: { ...payload, printMethod: 3 } }).printTypes).toEqual([1, 2]);
  });

  it('requires the live-confirmed draft status 3 for a save-draft', () => {
    expect(MAKERONLINE_DRAFT_STATUS).toBe(3);
    expect(buildMakerOnlineExpectation({ payload }).status).toBe(3);
    // Public status has never been observed, so it stays unasserted rather
    // than guessed.
    expect(buildMakerOnlineExpectation({ payload: { ...payload, publication: 'public' } }).status).toBeNull();
  });

  it('carries the payload values into the expectation', () => {
    const built = buildMakerOnlineExpectation({
      payload, modelRecords: [S], imageRecords: [IMG(1)], documentCount: 0, tags: ['a'],
    });
    expect(built).toMatchObject({
      title: 'T', description: '<p>d</p>', categoryId: '36', license: 3,
      permissions: 2, source: 1, ai_help: 0, is_adult_nsfw: 0, docs: 0, isOffline: 0, tags: ['a'],
    });
    expect(built.files[0]).toMatchObject({ key: 'k-s', fileName: 'modelprep-calibration-puck-S.stl' });
  });
});

describe('MakerOnline pre-save expectation gate', () => {
  const okProfile = makerOnlineExpectedProfiles([PROFILE]);

  it('accepts a fully parsed profile expectation', () => {
    expect(makerOnlineExpectationIssues({ profiles: okProfile })).toEqual([]);
    expect(makerOnlineExpectationIssues({ profiles: [] })).toEqual([]);
  });

  it('reports each missing parser field in the expectation itself', () => {
    for (const field of ['printers', 'nozzle', 'layer', 'plates', 'parse_type']) {
      const record = { ...PROFILE };
      delete record[field];
      const issues = makerOnlineExpectationIssues({ profiles: makerOnlineExpectedProfiles([record]) });
      const wanted = field === 'parse_type' ? 'parseType' : field;
      expect(issues.join(' ')).toContain(wanted);
    }
    // An empty array is as unusable as an absent value.
    expect(makerOnlineExpectationIssues({
      profiles: makerOnlineExpectedProfiles([{ ...PROFILE, printers: [] }]),
    }).join(' ')).toMatch(/omitted printers/);
    expect(makerOnlineExpectationIssues({
      profiles: makerOnlineExpectedProfiles([{ ...PROFILE, key: '' }]),
    }).join(' ')).toMatch(/no upload key/);
  });

  it('stops before save-draft when the parser response is incomplete', async () => {
    const calls = [];
    await expect(runMakerOnlineUpload({
      request: async (route) => { calls.push(route); return { id: 'x', state: 'draft', url: 'u' }; },
      payload: {},
      expected: { ...expected, profiles: makerOnlineExpectedProfiles([{ ...PROFILE, nozzle: '' }]) },
    })).rejects.toThrow(/cannot certify this upload, so nothing was saved/);
    // Nothing was created: the gate runs before submit.
    expect(calls).toEqual([]);
  });
});

describe('MakerOnline structural parser comparison', () => {
  it('does not collapse different objects into the same string', () => {
    // "[object Object]" === "[object Object]" made these compare equal before.
    const wantPlates = [{ plate: 1, filament: 'PLA' }];
    const gotPlates = [{ plate: 2, filament: 'PETG' }];
    const exp = {
      ...expected,
      profiles: makerOnlineExpectedProfiles([{ ...PROFILE, plates: wantPlates }]),
    };
    const issues = makerOnlineReadbackIssues(exp, retained({
      print_files: [retainedProfile('modelprep-calibration-puck-bambu.3mf', 30787, { plates: gotPlates })],
    }));
    expect(issues.find((i) => i.includes('.plates:'))).toBeTruthy();
    // Key order must not matter; content must.
    const reordered = [{ filament: 'PLA', plate: 1 }];
    expect(makerOnlineReadbackIssues(exp, retained({
      print_files: [retainedProfile('modelprep-calibration-puck-bambu.3mf', 30787, { plates: reordered })],
    }))).toEqual([]);
  });
});
