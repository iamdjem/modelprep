import { nexprintFetch } from './nexprint-auth.js';

export function nexprintResponseError(data, status, fallback = 'Nexprint request failed') {
  const detail = data?.message || data?.msg || data?.error;
  return detail ? `${fallback}: ${detail}` : `${fallback} (HTTP ${status})`;
}

// Nexprint truncates an upload's base name to 80 characters
// (`trimUploadName` in desktop/nexprint-direct.js), so the name it retains is
// the record's name, not necessarily the raw source name. Mirrored here so the
// source-versus-record check below cannot false-fail on a long filename.
export function nexprintUploadName(name) {
  const source = String(name || 'upload.bin');
  const dot = source.lastIndexOf('.');
  if (dot < 0) return source.slice(0, 80);
  return `${source.slice(0, dot).slice(0, 80)}${source.slice(dot)}`;
}

// Expected model records, positional. Identity (`fileId`) and the name/size
// Nexprint will retain come from the upload records ModelPrep received for the
// exact bytes it sent; the source files are still asserted against those
// records, so a wrong or mis-sized file caught in the upload path fails here
// rather than silently becoming the new expectation.
export function nexprintExpectedFiles(files = [], records = []) {
  return files
    .filter((file) => String(file?.name || ''))
    .map((file, index) => {
      const record = records?.[index] || null;
      const sourceName = String(file.name);
      const sourceSize = Number.isFinite(Number(file?.size)) && Number(file.size) > 0 ? Number(file.size) : null;
      const sourceExt = sourceName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
      const retainedName = record ? String(record.fileName ?? '') : nexprintUploadName(sourceName);
      const retainedSize = record ? Number(record.fileSize) : sourceSize;
      return {
        fileId: record ? String(record.fileId ?? '') : '',
        fileName: retainedName,
        fileSize: Number.isFinite(retainedSize) && retainedSize > 0 ? retainedSize : null,
        fileExt: (record ? String(record.fileExt ?? '') : sourceExt).toLowerCase() || sourceExt,
        // Source truth, kept so the record itself can be challenged.
        name: sourceName,
        size: sourceSize,
        ext: sourceExt,
        record,
      };
    });
}

// A record that does not faithfully represent its source file means the wrong
// bytes were uploaded, which no amount of retained-state agreement can detect.
function sourceRecordIssues(wanted) {
  const issues = [];
  for (const file of wanted) {
    if (!file.record) continue;
    const expectedName = nexprintUploadName(file.name);
    if (String(file.record.fileName ?? '') !== expectedName) {
      issues.push(`${file.name}: upload record names it ${JSON.stringify(String(file.record.fileName ?? ''))}, expected ${JSON.stringify(expectedName)}`);
    }
    if (file.size != null && Number(file.record.fileSize) !== file.size) {
      issues.push(`${file.name}: upload record reports ${file.record.fileSize} bytes, expected ${file.size}`);
    }
    if (!String(file.record.fileId ?? '')) {
      issues.push(`${file.name}: upload record has no fileId`);
    }
    // The extension is what distinguishes a Bambu .3mf from an .stl in every
    // downstream comparison, so a record that reports the wrong one would make
    // the retained check agree with itself about the wrong file.
    const recordExt = String(file.record.fileExt ?? '').trim().toLowerCase();
    if (!recordExt) {
      issues.push(`${file.name}: upload record has no fileExt`);
    } else if (file.ext && recordExt !== file.ext) {
      issues.push(`${file.name}: upload record reports extension ${recordExt}, expected ${file.ext}`);
    }
  }
  return issues;
}

// Compare one ordered list of uploaded records against one retained list, by
// identity rather than count. `modelPicList`, `modelAttachList` and
// `modelFileList` all share the same record shape (`fileId`, `fileName`,
// `fileSize`, `fileExt`), verified on retained draft 2086143258366976000.
function compareOrderedRecords(label, wanted, retained, issues) {
  if (retained.length !== wanted.length) {
    issues.push(`${label}: expected ${wanted.length}, received ${retained.length}`);
  }
  for (let index = 0; index < wanted.length; index += 1) {
    const want = wanted[index];
    const got = retained[index];
    const at = `${label}[${index}]`;
    if (!got) {
      issues.push(`${at}: expected ${want.fileName || want.fileId}, received nothing`);
      continue;
    }
    // Order matters: Nexprint renders the gallery in list order, so a
    // reordered list is a real defect even when every id is present.
    if (String(got.fileId ?? '') !== String(want.fileId ?? '')) {
      issues.push(`${at}.fileId: expected ${want.fileId}, received ${got.fileId ?? ''}`);
    }
    if (String(got.fileName ?? '') !== String(want.fileName ?? '')) {
      issues.push(`${at}.fileName: expected ${JSON.stringify(want.fileName ?? '')}, received ${JSON.stringify(String(got.fileName ?? ''))}`);
    }
    const gotExt = String(got.fileExt ?? '').toLowerCase();
    const wantExt = String(want.fileExt ?? '').toLowerCase();
    if (wantExt && gotExt !== wantExt) {
      issues.push(`${at}.fileExt: expected ${wantExt}, received ${gotExt}`);
    }
    const gotSize = Number(got.fileSize);
    if (!Number.isFinite(gotSize) || gotSize <= 0) {
      issues.push(`${at}: Nexprint reported no retained file size`);
    } else if (Number(want.fileSize) > 0 && gotSize !== Number(want.fileSize)) {
      issues.push(`${at}: expected ${want.fileSize} retained bytes, received ${gotSize}`);
    }
  }
}

// Nexprint's readback (`model-base-info/getEditInfo`) authoritatively echoes
// `fileId`, `fileName`, `fileSize` and `fileExt` per model file. Verified
// read-only against retained drafts 2086068343743848448 and
// 2086143258366976000 on 2026-08-08, where every file returned its exact
// source byte count.
//
// Deliberately NOT asserted: the `fileExtension: { is3MF: true }` marker the
// submit sends for a .3mf. The readback's corresponding `extra` field was null
// even for a genuinely retained 3MF, so there is no evidence the marker round
// trips and a check on it would fail closed on an unproven contract.
// Nexprint's real print-profile block is `settingList` on submit and
// `settingInfoList` on readback; ModelPrep always sends it empty, so a retained
// 3MF is an ordinary model file that shows "Print Profile (0)". Do not borrow
// Printables' semantics here: Printables has no profile concept at all,
// whereas Nexprint has one that ModelPrep leaves unpopulated.
export function nexprintReadbackIssues(expected, model) {
  const issues = [];
  const wanted = expected?.files || [];
  issues.push(...sourceRecordIssues(wanted));
  // Model files are compared by upload identity and position, exactly like the
  // gallery and attachments: matching by name alone accepted a reordered list
  // and a list whose ids belong to somebody else's upload.
  compareOrderedRecords('model files', wanted, model?.modelFileList || [], issues);
  // Attachments and gallery photos are compared by identity and order, not by
  // count: an equal count with swapped or renamed files is still wrong.
  compareOrderedRecords('attachments', expected?.attachments || [], model?.modelAttachList || [], issues);
  // Nexprint splits the gallery into one cover id plus ordered photos.
  const expectedCover = expected?.cover ? String(expected.cover.fileId ?? '') : '';
  const retainedCover = String(model?.coverImgFileId ?? '');
  if (expectedCover && retainedCover !== expectedCover) {
    issues.push(`cover: expected fileId ${expectedCover}, received ${retainedCover || 'none'}`);
  }
  compareOrderedRecords('gallery photos', expected?.photos || [], model?.modelPicList || [], issues);
  // The print-profile block must be present and empty while ModelPrep sends
  // `settingList: []`. A missing array is not the same as an empty one: it
  // means the readback no longer reports the field we rely on.
  if (!Array.isArray(model?.settingInfoList)) {
    issues.push('print profiles: expected settingInfoList to be present, received none');
  } else if (model.settingInfoList.length !== 0) {
    issues.push(`print profiles: expected settingInfoList to be empty, received ${model.settingInfoList.length}`);
  }
  // status 0 = draft, 1 = published. Both fields must be present: an absent
  // publication state cannot certify that nothing was published, which is the
  // whole point of a draft-only run.
  const status = model?.status;
  const isPublished = model?.isPublished;
  if (expected?.draft != null) {
    if (status == null) issues.push('state: expected a retained status, received none');
    if (isPublished == null) issues.push('state: expected a retained isPublished, received none');
  }
  if (status != null && isPublished != null) {
    const draft = Number(status) === 0;
    if (draft && isPublished === true) {
      issues.push('state: status 0 (draft) contradicts isPublished true');
    }
    if (!draft && isPublished === false) {
      issues.push(`state: status ${status} contradicts isPublished false`);
    }
  }
  if (expected?.draft != null && status != null && (Number(status) === 0) !== !!expected.draft) {
    issues.push(`state: expected ${expected.draft ? 'a draft' : 'a published model'}, received status ${status}`);
  }
  return issues;
}

export async function uploadNexprintFile({
  workerUrl,
  secret,
  file,
  role,
}) {
  if (!(file instanceof Blob)) throw new Error('Nexprint upload requires a file.');
  const form = new FormData();
  form.append('role', role);
  form.append('file', file, file.name || 'upload.bin');
  const response = await nexprintFetch(
    `${workerUrl}/api/v1/nexprint/web/upload`,
    { method: 'POST', body: form },
    secret,
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(nexprintResponseError(data, response.status, 'Nexprint upload failed'));
  }
  // Every downstream readback expectation is built from this record, so an
  // incomplete one would quietly become a weaker expectation instead of an
  // error. Confirmed against desktop/nexprint-direct.js before enforcing:
  // `validateUpload` rejects an absent or unknown extension before any upload
  // happens (so `fileExt` is always present and already lower-cased) and
  // `trimUploadName` always yields a name. It checks only an upper size bound,
  // however, so a zero-byte upload would otherwise pass - that is the one field
  // this boundary genuinely tightens.
  const file_ = data.file || {};
  const missing = ['fileId', 'fileUrl', 'fileName', 'fileExt']
    .filter((key) => !String(file_[key] ?? '').trim());
  if (!(Number(file_.fileSize) > 0)) missing.push('fileSize');
  if (missing.length) {
    throw new Error(`Nexprint upload returned an incomplete file record (missing ${missing.join(', ')}).`);
  }
  return data.file;
}
