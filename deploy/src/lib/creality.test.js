import { describe, expect, it } from 'vitest';
import {
  certifyCrealityModel,
  CREALITY_PROCESSING_INTERVAL_MS,
  CREALITY_PROCESSING_TIMEOUT_MS,
  crealityHardIssues,
  crealityNameMatches,
  crealityPendingIssues,
  runCrealityUpload,
  crealityUploadReport,
  crealityExpectedFiles,
  crealityExpectedImages,
  crealityObjectKeyId,
  crealityRawModelFiles,
  crealityReadbackIssues,
  crealityUsesRenderedModelCover,
} from './creality.js';

describe('Creality model preview payload', () => {
  it('omits rendered covers for the formats skipped by Creality Cloud', () => {
    expect(crealityUsesRenderedModelCover('part.stl')).toBe(true);
    expect(crealityUsesRenderedModelCover('part.obj')).toBe(true);
    expect(crealityUsesRenderedModelCover('profile.3mf')).toBe(false);
    expect(crealityUsesRenderedModelCover('assembly.step')).toBe(false);
    expect(crealityUsesRenderedModelCover('assembly.STP')).toBe(false);
  });

  it('keeps every 3MF as a raw model file, including ones ModelPrep tracks as print profiles', () => {
    // Excluding profile-linked 3MFs silently dropped EVERY .3mf (a profile
    // entry is auto-created for each one), live-confirmed on Creality Cloud.
    const files = [
      { id: 'stl', name: 'part.stl', blob: {} },
      { id: 'ordinary', name: 'mesh.3mf', blob: {} },
      { id: 'profile', name: 'bambu-profile.3mf', blob: {} },
    ];
    expect(crealityRawModelFiles(files).map((file) => file.id))
      .toEqual(['stl', 'ordinary', 'profile']);
  });
});

// Retained shapes verified read-only against private model
// 6a77222f75286de2e7e68468 on 2026-08-08: modelList entries split `fileName`
// (no extension) from `fileFormat` (".stl"), carry `fileMd5` and parsed
// x/y/z/volume, and covers are { url, type, width, height } whose URL basename
// is `<md5>.<ext>` — the same md5 the upload record's fileKey carries.
const upload = (name, size, md5) => ({ name, size, fileKey: `model/${md5}.${name.split('.').pop()}` });
const image = (name, md5) => ({ name, fileKey: `crealityCloud/upload/${md5}.jpg` });
const MD5_S = 'a'.repeat(32);
const MD5_3MF = 'b'.repeat(32);
const MD5_PC = 'c'.repeat(32);
const MD5_APP = 'd'.repeat(32);
const MD5_G1 = 'e'.repeat(32);
const MD5_G2 = 'f'.repeat(32);

const cover = (md5, w, h, type) => ({ url: `https://pic2-cdn.creality.com/crealityCloud/upload/${md5}.jpg`, type, width: w, height: h });

const retainedFile = (base, format, size, md5) => ({
  fileName: base, fileFormat: format, fileSize: size, fileMd5: md5,
  isBroken: false, makeThumbnailErr: 0, x: 34, y: 34, z: 4.4, volume: 3960,
});

const retainedCreality = (over = {}, groupOver = {}) => ({
  modelList: over.modelList || [
    retainedFile('puck-S', '.stl', 36084, MD5_S),
    retainedFile('puck-bambu', '.3mf', 30787, MD5_3MF),
  ],
  groupItem: {
    groupName: 'Calibration puck',
    categoryId: '1645',
    license: 'CC BY-NC',
    isShared: false,
    modelCount: 2,
    totalFileSize: 66871,
    covers: [cover(MD5_G1, 1600, 1200, 2), cover(MD5_G2, 1600, 1200, 2)],
    pcCovers: [cover(MD5_PC, 1600, 1200, 0)],
    appCovers: [cover(MD5_APP, 1200, 1600, 0)],
    model3mfList: [],
    model3mfCount: 0,
    include3mf: false,
    otherFileCount: 0,
    totalOtherFileSize: 0,
    ...groupOver,
  },
});

const expectedCreality = {
  files: crealityExpectedFiles([upload('puck-S.stl', 36084, MD5_S), upload('puck-bambu.3mf', 30787, MD5_3MF)]),
  categoryId: '1645',
  license: 'CC BY-NC',
  name: 'Calibration puck',
  covers: crealityExpectedImages([image('g1.jpg', MD5_G1), image('g2.jpg', MD5_G2)]),
  pcCovers: crealityExpectedImages([image('pc.jpg', MD5_PC)]),
  appCovers: crealityExpectedImages([image('app.jpg', MD5_APP)]),
  instructions: [],
  private: true,
};

describe('Creality retained-model verification', () => {
  it('splits the source filename the way Creality stores it and keeps the key md5', () => {
    expect(crealityExpectedFiles([upload('puck-bambu.3mf', 30787, MD5_3MF)]))
      .toEqual([{ name: 'puck-bambu.3mf', base: 'puck-bambu', format: '.3mf', size: 30787, md5: MD5_3MF }]);
    expect(crealityObjectKeyId('https://cdn.example/crealityCloud/upload/abc.jpg?x=1')).toBe('abc.jpg');
  });

  it('passes on a fully correct retained model', () => {
    expect(crealityReadbackIssues(expectedCreality, retainedCreality())).toEqual([]);
  });

  it('fails when fileFormat is missing or wrong', () => {
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({
      modelList: [retainedFile('puck-S', '.stl', 36084, MD5_S), { ...retainedFile('puck-bambu', '.3mf', 30787, MD5_3MF), fileFormat: undefined }],
    }))).toEqual(['puck-bambu.3mf: Creality reported no retained fileFormat']);
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({
      modelList: [retainedFile('puck-S', '.stl', 36084, MD5_S), retainedFile('puck-bambu', '.stl', 30787, MD5_3MF)],
    }))).toEqual(['puck-bambu.3mf: expected Creality to retain format .3mf, received .stl']);
  });

  it('fails when totalFileSize is missing, zero or wrong', () => {
    for (const value of [undefined, null, 0]) {
      expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { totalFileSize: value })).join(' '))
        .toMatch(/total model bytes: expected 66871/);
    }
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { totalFileSize: 5 })))
      .toEqual(['total model bytes: expected 66871, received 5']);
  });

  it('requires isShared to be explicitly false for a private upload', () => {
    for (const value of [undefined, null, true]) {
      expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { isShared: value })).join(' '))
        .toMatch(/visibility: expected isShared false/);
    }
  });

  it('verifies modelCount exactly', () => {
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { modelCount: 3 })))
      .toEqual(['modelCount: expected 2, received 3']);
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { modelCount: undefined })))
      .toEqual(['modelCount: expected 2, received none']);
  });

  it('compares gallery identity and order, and pc/app covers independently', () => {
    // Same count, swapped order: a length check passes this.
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, {
      covers: [cover(MD5_G2, 1600, 1200, 2), cover(MD5_G1, 1600, 1200, 2)],
    }))).toEqual([
      `gallery covers[0]: expected ${MD5_G1}.jpg, received ${MD5_G2}.jpg`,
      `gallery covers[1]: expected ${MD5_G2}.jpg, received ${MD5_G1}.jpg`,
    ]);
    // The pc and app crops are distinct images and must not be interchangeable.
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, {
      pcCovers: [cover(MD5_APP, 1200, 1600, 0)],
    }))).toEqual([`pc cover[0]: expected ${MD5_PC}.jpg, received ${MD5_APP}.jpg`]);
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { appCovers: [] })))
      .toEqual(['app cover: expected 1, received 0', `app cover[0]: expected ${MD5_APP}.jpg, received nothing`]);
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { covers: undefined })))
      .toEqual(['gallery covers: expected a retained list, received none']);
  });

  it('fails on contradictory Print Configuration state', () => {
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { model3mfList: undefined })))
      .toEqual(['print configuration: expected model3mfList to be present, received none']);
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { model3mfList: [{ id: 'x' }] })))
      .toEqual(['print configuration: expected model3mfList to be empty, received 1']);
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { model3mfCount: 1 })))
      .toEqual(['print configuration: expected model3mfCount 0, received 1']);
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { include3mf: true })))
      .toEqual(['print configuration: expected include3mf false, received true']);
  });

  it('verifies instruction files exactly, including the zero-instruction state', () => {
    // Creality retains no instruction list, only a count and total bytes.
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { otherFileCount: 1, totalOtherFileSize: 12 })))
      .toEqual(['instruction files: expected 0, received 1', 'instruction bytes: expected 0, received 12']);
    const withDocs = { ...expectedCreality, instructions: [{ name: 'guide.pdf', size: 500 }] };
    expect(crealityReadbackIssues(withDocs, retainedCreality({}, { otherFileCount: 1, totalOtherFileSize: 500 })))
      .toEqual([]);
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, { otherFileCount: undefined })))
      .toEqual(['instruction files: expected 0, received none']);
  });

  it('requires md5, non-broken status and parsed geometry rather than name and size alone', () => {
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({
      modelList: [retainedFile('puck-S', '.stl', 36084, MD5_S), retainedFile('puck-bambu', '.3mf', 30787, 'deadbeef')],
    }))).toEqual([`puck-bambu.3mf: expected md5 ${MD5_3MF}, received deadbeef`]);
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({
      modelList: [retainedFile('puck-S', '.stl', 36084, MD5_S), { ...retainedFile('puck-bambu', '.3mf', 30787, MD5_3MF), isBroken: true }],
    }))).toEqual(['puck-bambu.3mf: Creality flagged the retained file as broken']);
    // Right name and byte count, but nothing parsed: usable geometry is not
    // proven and must not be claimed.
    for (const missing of [{ x: 0 }, { volume: 0 }, { z: null }, { y: undefined }]) {
      expect(crealityReadbackIssues(expectedCreality, retainedCreality({
        modelList: [retainedFile('puck-S', '.stl', 36084, MD5_S), { ...retainedFile('puck-bambu', '.3mf', 30787, MD5_3MF), ...missing }],
      }))).toEqual(['puck-bambu.3mf: Creality reported no parsed geometry (x/y/z/volume), so usable geometry is unproven']);
    }
  });

  it('does not assert the fields Creality rewrites server-side', () => {
    // Live retained tags came back translated ("3D打印机", "校准", "测试模型")
    // and categoryName localized, so equality checks there would fail a
    // correct upload. isOriginal read false on a modelSource-1 model.
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({}, {
      tags: [{ id: '', name: '校准' }, { id: '', name: '测试模型' }],
      categoryName: '测试模型',
      isOriginal: false,
    }))).toEqual([]);
  });
});

describe('Creality asynchronous processing certification', () => {
  // A model that is still indexing looks exactly like a broken one on the
  // first readback, which is what made the 2026-08-08 authorized create report
  // "no parsed geometry" and "3MF absent" on an object Creality had accepted.
  const unprocessed = () => retainedCreality({ modelList: [] }, {
    modelCount: 0, totalFileSize: 0, covers: [cover(MD5_G1, 1600, 1200, 2), cover(MD5_G2, 1600, 1200, 2)],
  });
  const halfProcessed = () => retainedCreality({
    modelList: [retainedFile('puck-S', '.stl', 36084, MD5_S)],
  }, { modelCount: 1, totalFileSize: 36084 });

  const poller = (pages) => {
    const seen = [];
    const request = async (route) => {
      seen.push(route);
      return { model: pages[Math.min(seen.length - 1, pages.length - 1)]() };
    };
    return { request, seen };
  };

  it('separates issues that can still settle from contradictions that cannot', () => {
    expect(crealityPendingIssues([
      'a.stl: Creality reported no parsed geometry (x/y/z/volume), so usable geometry is unproven',
      'b.3mf: selected for Creality Cloud but absent from the saved model list',
      'model files: expected 3, received 1',
      'modelCount: expected 3, received 1',
      'total model bytes: expected 5, received 1',
    ])).toHaveLength(5);
    expect(crealityHardIssues([
      'license: expected CC BY-NC, received CXY-SL',
      'visibility: expected isShared false, received true',
      'a.stl: Creality flagged the retained file as broken',
      'a.stl: expected md5 aaa, received bbb',
      'a.stl: Creality reported thumbnail error 2',
      'print configuration: expected include3mf false, received true',
    ])).toHaveLength(6);
  });

  it('keeps polling the same id and certifies once processing settles', async () => {
    const { request, seen } = poller([unprocessed, halfProcessed, () => retainedCreality()]);
    const result = await certifyCrealityModel({
      request, id: 'obj-1', state: 'private', expected: expectedCreality,
      delay: async () => {}, now: () => 0,
    });
    expect(result.certified).toBe(true);
    expect(result.attempts).toBe(3);
    // Every poll is the same read of the same object; nothing is resubmitted.
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toBe('status?id=obj-1&state=private');
  });

  it('fails immediately on a hard contradiction instead of waiting it out', async () => {
    const { request, seen } = poller([() => retainedCreality({}, { license: 'CXY-SL' })]);
    const result = await certifyCrealityModel({
      request, id: 'obj-2', state: 'private', expected: expectedCreality,
      delay: async () => { throw new Error('must not wait on a contradiction'); }, now: () => 0,
    });
    expect(result.certified).toBe(false);
    expect(result.timedOut).toBe(false);
    expect(result.issues).toContain('license: expected CC BY-NC, received CXY-SL');
    expect(seen).toHaveLength(1);
  });

  it('times out with the exact unresolved fields rather than passing or hanging', async () => {
    let clock = 0;
    const { request, seen } = poller([unprocessed]);
    const result = await certifyCrealityModel({
      request, id: 'obj-3', state: 'private', expected: expectedCreality,
      intervalMs: 1000, timeoutMs: 5000,
      delay: async () => { clock += 1000; }, now: () => clock,
    });
    expect(result.certified).toBe(false);
    expect(result.timedOut).toBe(true);
    // Only the still-settling fields are reported, so the caller can classify
    // the object as retained-but-uncertified with precise unresolved detail.
    expect(result.issues.join(' ')).toMatch(/absent from the saved model list/);
    expect(crealityHardIssues(result.issues)).toEqual([]);
    expect(seen.length).toBeGreaterThan(1);
  });

  it('documents a bounded interval and timeout', () => {
    expect(CREALITY_PROCESSING_INTERVAL_MS).toBe(3_000);
    expect(CREALITY_PROCESSING_TIMEOUT_MS).toBe(120_000);
  });
});

describe('Creality retained receipt on a failed certification', () => {
  const payload = { title: 'Calibration puck' };
  const saved = { id: 'obj-9', state: 'private', url: 'https://www.crealitycloud.com/model-detail/obj-9' };

  const tracked = (certify) => {
    const calls = [];
    const request = async (route, body) => {
      calls.push(route);
      if (route === 'submit') return saved;
      throw new Error(`unexpected route ${route}`);
    };
    return { request, calls, certify };
  };

  it('returns the retained id, state and url as soon as submit succeeds', async () => {
    const seen = [];
    const { request } = tracked();
    const outcome = await runCrealityUpload({
      request, payload, expected: expectedCreality,
      certify: async () => ({ certified: true, issues: [] }),
      onRetained: (v) => seen.push(v),
    });
    expect(seen).toEqual([saved]);
    expect(outcome).toMatchObject({ ...saved, verified: true, uncertified: false });
  });

  it('keeps the receipt when the later readback throws, flagged uncertified', async () => {
    const { request, calls } = tracked();
    const outcome = await runCrealityUpload({
      request, payload, expected: expectedCreality,
      certify: async () => { throw new Error('Creality read-back failed (HTTP 500)'); },
    });
    expect(outcome).toMatchObject({
      id: 'obj-9', state: 'private', url: saved.url, verified: false, uncertified: true,
    });
    // The exact failure that orphaned the 2026-08-08 object: the detail must
    // carry the id and URL so the object is findable.
    expect(outcome.detail).toContain('obj-9');
    expect(outcome.detail).toContain(saved.url);
    expect(outcome.detail).toMatch(/not published, retried or deleted/);
    // Exactly one submit, no resubmit on failure.
    expect(calls.filter((c) => c === 'submit')).toHaveLength(1);
  });

  it('keeps the receipt on a verification failure and on a timeout', async () => {
    const { request } = tracked();
    const failed = await runCrealityUpload({
      request, payload, expected: expectedCreality,
      certify: async () => ({ certified: false, timedOut: false, issues: ['license: expected CC BY-NC, received CXY-SL'] }),
    });
    expect(failed).toMatchObject({ verified: false, uncertified: true, timedOut: false });
    expect(failed.detail).toContain('verification found');
    expect(failed.detail).toContain('obj-9');

    const timedOut = await runCrealityUpload({
      request, payload, expected: expectedCreality,
      certify: async () => ({ certified: false, timedOut: true, issues: ['b.3mf: selected for Creality Cloud but absent from the saved model list'] }),
    });
    expect(timedOut).toMatchObject({ verified: false, uncertified: true, timedOut: true });
    expect(timedOut.detail).toMatch(/did not finish processing in time/);
    expect(timedOut.detail).toContain(saved.url);
    expect(timedOut.issues).toEqual(['b.3mf: selected for Creality Cloud but absent from the saved model list']);
  });

  it('submits exactly once even when certification polls many times', async () => {
    const calls = [];
    const request = async (route) => {
      calls.push(route);
      if (route === 'submit') return saved;
      return { model: retainedCreality({ modelList: [] }, { modelCount: 0, totalFileSize: 0 }) };
    };
    let clock = 0;
    await runCrealityUpload({
      request, payload, expected: expectedCreality,
      intervalMs: 1000, timeoutMs: 4000,
      delay: async () => { clock += 1000; }, now: () => clock,
    });
    expect(calls.filter((c) => c === 'submit')).toHaveLength(1);
    expect(calls.filter((c) => c.startsWith('status?')).length).toBeGreaterThan(1);
  });
});

describe('App-facing Creality upload handling (composed path)', () => {
  // Drives the same composition App.jsx runs: runCrealityUpload -> outcome ->
  // crealityUploadReport -> setResult/setError/reportBatch. The App calls
  // exactly this pair, so a regression in either half is caught here.
  const saved = { id: 'obj-42', state: 'private', url: 'https://www.crealitycloud.com/model-detail/obj-42' };
  const SENTENCE = /The model was created and is retained at/g;

  const drive = async ({ pages, certify, intervalMs = 1000, timeoutMs = 4000 }) => {
    const calls = [];
    let clock = 0;
    const request = async (route) => {
      calls.push(route);
      if (route === 'submit') return saved;
      return { model: pages[Math.min(calls.filter((c) => c.startsWith('status?')).length - 1, pages.length - 1)]() };
    };
    const outcome = await runCrealityUpload({
      request, payload: { title: 'Calibration puck' }, expected: expectedCreality,
      ...(certify ? { certify } : {}),
      intervalMs, timeoutMs, delay: async () => { clock += intervalMs; }, now: () => clock,
    });
    // The App applies the outcome through this single mapping.
    const report = crealityUploadReport(outcome, { skippedProfiles: [], skippedNote: '' });
    return { calls, outcome, report };
  };

  it('shows the retained sentence exactly once on a timeout', async () => {
    const unprocessed = () => retainedCreality({ modelList: [] }, { modelCount: 0, totalFileSize: 0 });
    const { calls, report } = await drive({ pages: [unprocessed] });
    expect(report.ok).toBe(false);
    // The defect this test exists for: the catch used to append the sentence
    // a second time on top of the detail that already contained it.
    expect(report.message.match(SENTENCE) || []).toHaveLength(1);
    expect(report.message).toMatch(/did not finish processing in time/);
    // Timeout and issue detail survive into both the UI result and the batch.
    expect(report.result).toMatchObject({
      id: 'obj-42', state: 'private', url: saved.url, verified: false, uncertified: true, timedOut: true,
    });
    expect(report.result.issues.join(' ')).toMatch(/absent from the saved model list/);
    expect(report.metadata).toMatchObject({
      publicationState: 'private', url: saved.url, uncertified: true, timedOut: true,
    });
    expect(report.metadata.issues.length).toBeGreaterThan(0);
    expect(calls.filter((c) => c === 'submit')).toHaveLength(1);
  });

  it('shows the retained sentence once on a hard verification failure', async () => {
    const wrongLicence = () => retainedCreality({}, { license: 'CXY-SL' });
    const { calls, report } = await drive({ pages: [wrongLicence] });
    expect(report.ok).toBe(false);
    expect(report.message.match(SENTENCE) || []).toHaveLength(1);
    expect(report.message).toMatch(/verification found/);
    expect(report.result).toMatchObject({ uncertified: true, timedOut: false, id: 'obj-42', url: saved.url });
    expect(report.result.issues).toContain('license: expected CC BY-NC, received CXY-SL');
    expect(report.metadata.issues).toContain('license: expected CC BY-NC, received CXY-SL');
    expect(calls.filter((c) => c === 'submit')).toHaveLength(1);
  });

  it('keeps the id and url visible when the readback itself throws', async () => {
    const { calls, report } = await drive({
      pages: [() => retainedCreality()],
      certify: async () => { throw new Error('Creality read-back failed (HTTP 500)'); },
    });
    expect(report.message.match(SENTENCE) || []).toHaveLength(1);
    expect(report.message).toContain('obj-42');
    expect(report.message).toContain(saved.url);
    expect(report.result).toMatchObject({ id: 'obj-42', url: saved.url, uncertified: true, verified: false });
    expect(calls.filter((c) => c === 'submit')).toHaveLength(1);
  });

  it('reports a certified upload without any retained-failure decoration', async () => {
    const { calls, report } = await drive({ pages: [() => retainedCreality()] });
    expect(report.ok).toBe(true);
    expect(report.message).not.toMatch(SENTENCE);
    expect(report.result).toMatchObject({ id: 'obj-42', state: 'private', url: saved.url, verified: true });
    expect(report.result.uncertified).toBeUndefined();
    expect(report.metadata).toMatchObject({ publicationState: 'private', url: saved.url });
    expect(calls.filter((c) => c === 'submit')).toHaveLength(1);
  });

  it('fails loudly if the adapter ever returns an incomplete create receipt', async () => {
    for (const bad of [{ state: 'private', url: 'u' }, { id: 'x', url: 'u' }, { id: 'x', state: 'private' }, {}]) {
      const announced = [];
      await expect(runCrealityUpload({
        request: async (route) => (route === 'submit' ? bad : { model: retainedCreality() }),
        payload: {}, expected: expectedCreality,
        onRetained: (v) => announced.push(v),
      })).rejects.toThrow(/incomplete create receipt/i);
      // Nothing is announced from a receipt that cannot be acted on.
      expect(announced).toEqual([]);
    }
  });
});

describe('Creality filename masking', () => {
  it('accepts character-for-character masking but not a rename', () => {
    // Live-proven 2026-08-08: Creality returned
    // `modelprep-calibration-puck-*****` for a file uploaded as
    // `modelprep-calibration-puck-bambu` — the competitor brand name replaced
    // by exactly five asterisks.
    expect(crealityNameMatches('modelprep-calibration-puck-bambu', 'modelprep-calibration-puck-*****')).toBe(true);
    expect(crealityNameMatches('puck-bambu', 'PUCK-BAMBU')).toBe(true);
    expect(crealityNameMatches('modelprep-calibration-puck-bambu', 'modelprep-calibration-puck-other')).toBe(false);
    expect(crealityNameMatches('abc', 'ab')).toBe(false);
    expect(crealityNameMatches('abc', '***')).toBe(true);
  });

  it('matches retained files by md5 so a masked name still certifies', () => {
    const maskedFile = { ...retainedFile('puck-*****', '.3mf', 30787, MD5_3MF) };
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({
      modelList: [retainedFile('puck-S', '.stl', 36084, MD5_S), maskedFile],
    }))).toEqual([]);
  });

  it('still rejects a genuinely different retained file', () => {
    // Same shape, wrong bytes: md5 identity is what makes masking safe to allow.
    expect(crealityReadbackIssues(expectedCreality, retainedCreality({
      modelList: [
        retainedFile('puck-S', '.stl', 36084, MD5_S),
        retainedFile('puck-other', '.3mf', 30787, 'c'.repeat(32)),
      ],
    })).join(' ')).toMatch(/absent from the saved model list/);
  });
});
