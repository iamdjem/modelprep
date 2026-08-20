// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_NEXPRINT_SECRET } from './nexprint-auth.js';
import {
  nexprintExpectedFiles,
  nexprintReadbackIssues,
  nexprintResponseError,
  uploadNexprintFile,
} from './nexprint-upload.js';

afterEach(() => {
  delete window.modelprepDesktop;
});

describe('Nexprint upload helper', () => {
  it('returns the normalized first-party file record', async () => {
    window.modelprepDesktop = {
      isDesktop: true,
      requestNexprint: vi.fn(async () => ({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ok: true,
          file: {
            fileId: '42',
            fileUrl: 'https://storage.example/model.stl',
            fileName: 'model.stl',
            fileSize: 5,
            fileExt: 'stl',
          },
        }),
      })),
    };

    const uploaded = await uploadNexprintFile({
      workerUrl: 'https://modelprep-backend.iamdjem.workers.dev',
      secret: DESKTOP_NEXPRINT_SECRET,
      file: new File(['solid'], 'model.stl', { type: 'model/stl' }),
      role: 'model',
    });

    expect(uploaded.fileId).toBe('42');
  });

  it('rejects a 200 response whose file record is incomplete', async () => {
    // Nexprint answering OK without a usable record is a transport failure, not
    // a success: every downstream expectation is built from this record, so an
    // incomplete one would become a weaker expectation instead of an error.
    const complete = {
      fileId: '42', fileUrl: 'https://storage.example/m.stl',
      fileName: 'm.stl', fileSize: 5, fileExt: 'stl',
    };
    const incomplete = [
      { ...complete, fileId: '' },
      { ...complete, fileUrl: '' },
      { ...complete, fileName: '' },
      { ...complete, fileExt: '' },
      // validateUpload only bounds size from above, so a zero-byte upload is
      // the one case the adapter itself would let through.
      { ...complete, fileSize: 0 },
      {},
    ];
    for (const file of incomplete) {
      window.modelprepDesktop = {
        isDesktop: true,
        requestNexprint: vi.fn(async () => ({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ok: true, file }),
        })),
      };
      await expect(uploadNexprintFile({
        workerUrl: 'https://modelprep-backend.iamdjem.workers.dev',
        secret: DESKTOP_NEXPRINT_SECRET,
        file: new File(['solid'], 'model.stl', { type: 'model/stl' }),
        role: 'model',
      })).rejects.toThrow(/incomplete file record/i);
    }
  });

  it('rejects a non-ok upload response and surfaces its detail', async () => {
    window.modelprepDesktop = {
      isDesktop: true,
      requestNexprint: vi.fn(async () => ({
        status: 413,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ msg: 'file too large' }),
      })),
    };
    await expect(uploadNexprintFile({
      workerUrl: 'https://modelprep-backend.iamdjem.workers.dev',
      secret: DESKTOP_NEXPRINT_SECRET,
      file: new File(['solid'], 'model.stl', { type: 'model/stl' }),
      role: 'model',
    })).rejects.toThrow(/file too large/i);
  });

  it('keeps upstream error details', () => {
    expect(nexprintResponseError({ msg: 'category missing' }, 400, 'Submit failed'))
      .toBe('Submit failed: category missing');
  });
});

// Retained shapes verified read-only against draft 2086143258366976000 on
// 2026-08-08: modelFileList, modelPicList and modelAttachList all share the
// record shape { fileId, fileName, fileSize, fileExt }, the cover is a single
// `coverImgFileId`, and settingInfoList is a real array.
const rec = (fileId, fileName, fileSize, fileExt) => ({ fileId, fileName, fileSize, fileExt });

const sourceFiles = [{ name: 'puck-S.stl', size: 36084 }, { name: 'puck-bambu.3mf', size: 30787 }];
const modelRecords = [
  rec('m1', 'puck-S.stl', 36084, 'stl'),
  rec('m2', 'puck-bambu.3mf', 30787, '3mf'),
];
const modelFiles = modelRecords.map((record) => ({ ...record, isBroken: false }));

const photos = [rec('p1', 'gallery-01.webp', 111, 'webp'), rec('p2', 'gallery-02.webp', 222, 'webp')];

const retained = (over = {}) => ({
  coverImgFileId: 'c1',
  modelPicList: photos.map((photo) => ({ ...photo })),
  modelAttachList: [],
  settingInfoList: [],
  status: 0,
  isPublished: false,
  modelFileList: modelFiles.map((file) => ({ ...file })),
  ...over,
});

const expected = {
  files: nexprintExpectedFiles(sourceFiles, modelRecords),
  attachments: [],
  cover: rec('c1', 'cover.webp', 900, 'webp'),
  photos,
  draft: true,
};

describe('Nexprint retained-model verification', () => {
  it('takes identity from the upload record and truth from the source file', () => {
    expect(nexprintExpectedFiles(sourceFiles, modelRecords)[1]).toMatchObject({
      fileId: 'm2', fileName: 'puck-bambu.3mf', fileSize: 30787, fileExt: '3mf',
      name: 'puck-bambu.3mf', size: 30787, ext: '3mf',
    });
    // An unknown source size must not become a phantom expectation of 0 bytes.
    expect(nexprintExpectedFiles([{ name: 'a.stl' }])[0])
      .toMatchObject({ name: 'a.stl', size: null, ext: 'stl', fileId: '' });
  });

  it('expects the name Nexprint will actually retain for a long filename', () => {
    // Nexprint truncates the base name to 80 characters, so expecting the raw
    // source name would fail a correct upload.
    const long = `${'x'.repeat(90)}.stl`;
    const trimmed = `${'x'.repeat(80)}.stl`;
    expect(nexprintExpectedFiles([{ name: long, size: 5 }])[0].fileName).toBe(trimmed);
    expect(nexprintReadbackIssues(
      { files: nexprintExpectedFiles([{ name: long, size: 5 }], [rec('m9', trimmed, 5, 'stl')]) },
      { modelFileList: [rec('m9', trimmed, 5, 'stl')], settingInfoList: [] },
    )).toEqual([]);
  });

  it('passes when every selected file is retained with its exact bytes', () => {
    expect(nexprintReadbackIssues(expected, retained())).toEqual([]);
  });

  it('fails closed when the 3MF is missing, short, or misfiled', () => {
    // The exact defect the previous status-only receipt could not see.
    expect(nexprintReadbackIssues(expected, retained({ modelFileList: [modelFiles[0]] })))
      .toEqual(expect.arrayContaining([
        'model files: expected 2, received 1',
        'model files[1]: expected puck-bambu.3mf, received nothing',
      ]));
    expect(nexprintReadbackIssues(expected, retained({
      modelFileList: [modelFiles[0], { ...modelFiles[1], fileSize: 11 }],
    }))).toEqual(['model files[1]: expected 30787 retained bytes, received 11']);
    expect(nexprintReadbackIssues(expected, retained({
      modelFileList: [modelFiles[0], { ...modelFiles[1], fileExt: 'stl' }],
    }))).toEqual(['model files[1].fileExt: expected 3mf, received stl']);
    expect(nexprintReadbackIssues(expected, retained({
      modelFileList: [modelFiles[0], { ...modelFiles[1], fileSize: 0 }],
    }))).toEqual(['model files[1]: Nexprint reported no retained file size']);
  });

  it('rejects the same model files returned in reversed order', () => {
    // Every id, name and byte count is present; only the order is wrong.
    expect(nexprintReadbackIssues(expected, retained({
      modelFileList: [modelFiles[1], modelFiles[0]],
    }))).toEqual([
      'model files[0].fileId: expected m1, received m2',
      'model files[0].fileName: expected "puck-S.stl", received "puck-bambu.3mf"',
      'model files[0].fileExt: expected stl, received 3mf',
      'model files[0]: expected 36084 retained bytes, received 30787',
      'model files[1].fileId: expected m2, received m1',
      'model files[1].fileName: expected "puck-bambu.3mf", received "puck-S.stl"',
      'model files[1].fileExt: expected 3mf, received stl',
      'model files[1]: expected 30787 retained bytes, received 36084',
    ]);
  });

  it('rejects a retained fileId that is not the one this run uploaded', () => {
    // Name, extension, bytes and count all match: only the identity differs,
    // which is how somebody else's file would slip in.
    expect(nexprintReadbackIssues(expected, retained({
      modelFileList: [modelFiles[0], { ...modelFiles[1], fileId: 'someone-else' }],
    }))).toEqual(['model files[1].fileId: expected m2, received someone-else']);
  });

  it('rejects an upload record whose extension contradicts its source', () => {
    // A Bambu .3mf registered as an .stl would make every retained comparison
    // agree with itself about the wrong file.
    const wrongExt = nexprintExpectedFiles(sourceFiles, [modelRecords[0], { ...modelRecords[1], fileExt: 'stl' }]);
    expect(nexprintReadbackIssues({ ...expected, files: wrongExt }, retained({
      modelFileList: [modelFiles[0], { ...modelFiles[1], fileExt: 'stl' }],
    }))).toEqual(['puck-bambu.3mf: upload record reports extension stl, expected 3mf']);
    // A missing extension fails on its own rather than being skipped.
    const noExt = nexprintExpectedFiles(sourceFiles, [modelRecords[0], { ...modelRecords[1], fileExt: '' }]);
    expect(nexprintReadbackIssues({ ...expected, files: noExt }, retained()).join(' '))
      .toMatch(/upload record has no fileExt/);
    // Case must not matter: .3MF and 3mf are the same extension.
    const upper = nexprintExpectedFiles(
      [{ name: 'puck-S.stl', size: 36084 }, { name: 'puck-bambu.3MF', size: 30787 }],
      [modelRecords[0], { ...modelRecords[1], fileName: 'puck-bambu.3MF', fileExt: '3MF' }],
    );
    expect(nexprintReadbackIssues({ ...expected, files: upper }, retained({
      modelFileList: [modelFiles[0], { ...modelFiles[1], fileName: 'puck-bambu.3MF', fileExt: '3MF' }],
    }))).toEqual([]);
  });

  it('challenges the upload record against its source file', () => {
    // A record that misrepresents its source means the wrong bytes were sent,
    // which no amount of retained-state agreement can detect.
    const wrongSize = nexprintExpectedFiles(sourceFiles, [modelRecords[0], { ...modelRecords[1], fileSize: 99 }]);
    expect(nexprintReadbackIssues({ ...expected, files: wrongSize }, retained({
      modelFileList: [modelFiles[0], { ...modelFiles[1], fileSize: 99 }],
    }))).toEqual(['puck-bambu.3mf: upload record reports 99 bytes, expected 30787']);
    const noId = nexprintExpectedFiles(sourceFiles, [modelRecords[0], { ...modelRecords[1], fileId: '' }]);
    expect(nexprintReadbackIssues({ ...expected, files: noId }, retained()).join(' '))
      .toMatch(/upload record has no fileId/);
  });

  it('does not assert the is3MF marker, which the readback does not echo', () => {
    // Submit sends `fileExtension: { is3MF: true }`; the retained draft's
    // corresponding `extra` field was null even for a real 3MF, so asserting
    // it would fail closed on an unproven contract.
    expect(nexprintReadbackIssues(expected, retained({
      modelFileList: modelFiles.map((file) => ({ ...file, extra: null })),
    }))).toEqual([]);
  });

  it('compares cover and gallery by identity and order, not count', () => {
    expect(nexprintReadbackIssues(expected, retained({ coverImgFileId: 'other' })))
      .toEqual(['cover: expected fileId c1, received other']);
    expect(nexprintReadbackIssues(expected, retained({ coverImgFileId: null })))
      .toEqual(['cover: expected fileId c1, received none']);
    // Same count, swapped order: a count check passes this, identity does not.
    expect(nexprintReadbackIssues(expected, retained({
      modelPicList: [photos[1], photos[0]],
    }))).toEqual([
      'gallery photos[0].fileId: expected p1, received p2',
      'gallery photos[0].fileName: expected "gallery-01.webp", received "gallery-02.webp"',
      'gallery photos[0]: expected 111 retained bytes, received 222',
      'gallery photos[1].fileId: expected p2, received p1',
      'gallery photos[1].fileName: expected "gallery-02.webp", received "gallery-01.webp"',
      'gallery photos[1]: expected 222 retained bytes, received 111',
    ]);
    expect(nexprintReadbackIssues(expected, retained({
      modelPicList: [photos[0], { ...photos[1], fileSize: 0 }],
    }))).toEqual(['gallery photos[1]: Nexprint reported no retained file size']);
    expect(nexprintReadbackIssues(expected, retained({ modelPicList: [photos[0]] })))
      .toEqual([
        'gallery photos: expected 2, received 1',
        'gallery photos[1]: expected gallery-02.webp, received nothing',
      ]);
  });

  it('compares attachments by identity, order, extension and bytes', () => {
    const attachment = rec('a1', 'notes.pdf', 500, 'pdf');
    const withAttach = { ...expected, attachments: [attachment] };
    expect(nexprintReadbackIssues(withAttach, retained({ modelAttachList: [{ ...attachment }] })))
      .toEqual([]);
    expect(nexprintReadbackIssues(withAttach, retained({ modelAttachList: [{ ...attachment, fileExt: 'txt' }] })))
      .toEqual(['attachments[0].fileExt: expected pdf, received txt']);
    expect(nexprintReadbackIssues(withAttach, retained({ modelAttachList: [rec('a9', 'other.pdf', 500, 'pdf')] })))
      .toEqual([
        'attachments[0].fileId: expected a1, received a9',
        'attachments[0].fileName: expected "notes.pdf", received "other.pdf"',
      ]);
    // The zero-attachment fixture state must be asserted, not assumed.
    expect(nexprintReadbackIssues(expected, retained({ modelAttachList: [attachment] })))
      .toEqual(['attachments: expected 0, received 1']);
  });

  it('requires settingInfoList to be present and empty for this fixture', () => {
    // A missing array is not an empty one: it means the field this check
    // depends on is gone from the readback.
    expect(nexprintReadbackIssues(expected, retained({ settingInfoList: undefined })))
      .toEqual(['print profiles: expected settingInfoList to be present, received none']);
    expect(nexprintReadbackIssues(expected, retained({ settingInfoList: null })))
      .toEqual(['print profiles: expected settingInfoList to be present, received none']);
    expect(nexprintReadbackIssues(expected, retained({ settingInfoList: [{ id: 'x' }] })))
      .toEqual(['print profiles: expected settingInfoList to be empty, received 1']);
  });

  it('requires the publication fields to be present at all', () => {
    // An absent publication state cannot certify that nothing was published.
    expect(nexprintReadbackIssues(expected, retained({ status: undefined })).join(' '))
      .toMatch(/expected a retained status, received none/);
    expect(nexprintReadbackIssues(expected, retained({ status: null })).join(' '))
      .toMatch(/expected a retained status, received none/);
    expect(nexprintReadbackIssues(expected, retained({ isPublished: undefined })))
      .toEqual(['state: expected a retained isPublished, received none']);
    expect(nexprintReadbackIssues(expected, retained({ isPublished: null })))
      .toEqual(['state: expected a retained isPublished, received none']);
  });

  it('fails on contradictory status and isPublished state', () => {
    expect(nexprintReadbackIssues(expected, retained({ status: 0, isPublished: true })))
      .toEqual(['state: status 0 (draft) contradicts isPublished true']);
    expect(nexprintReadbackIssues(expected, retained({ status: 1, isPublished: false })))
      .toEqual(expect.arrayContaining(['state: status 1 contradicts isPublished false']));
    // A draft-requested run that comes back published must fail too.
    expect(nexprintReadbackIssues(expected, retained({ status: 1, isPublished: true })))
      .toEqual(['state: expected a draft, received status 1']);
  });
});
