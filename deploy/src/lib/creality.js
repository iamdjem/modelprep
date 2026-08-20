export const CREALITY_MODEL_FORMATS = ['stl', 'obj', 'ply', 'off', '3mf', '3ds', 'wrl', 'dae', 'step', 'stp'];
const CREALITY_NON_RENDERED_PREVIEW_FORMATS = new Set(['3mf', 'step', 'stp']);
export const CREALITY_INSTRUCTION_FORMATS = [
  'txt', 'pdf', 'doc', 'xls', 'html', 'rtf', 'gif', 'bmp', 'docx', 'xlsx',
  'pptx', 'wps', 'png', 'ppt', 'jpg', 'jpeg',
];

export const CREALITY_LICENSES = [
  { value: 'CC BY', label: 'CC BY — Attribution' },
  { value: 'CC0', label: 'CC0 — Public Domain' },
  { value: 'CC BY-SA', label: 'CC BY-SA — Attribution, ShareAlike' },
  { value: 'CC BY-ND', label: 'CC BY-ND — Attribution, NoDerivatives' },
  { value: 'CC BY-NC', label: 'CC BY-NC — Attribution, NonCommercial' },
  { value: 'CC BY-NC-SA', label: 'CC BY-NC-SA — NonCommercial, ShareAlike' },
  { value: 'CC BY-NC-ND', label: 'CC BY-NC-ND — NonCommercial, NoDerivatives' },
  { value: 'CXY-SL', label: 'Creality Standard License — personal use only' },
];

export const CREALITY_LICENSE_MAP = {
  cc0: 'CC0',
  ccby: 'CC BY',
  ccbysa: 'CC BY-SA',
  ccbynd: 'CC BY-ND',
  ccbync: 'CC BY-NC',
  ccbyncsa: 'CC BY-NC-SA',
  ccbyncnd: 'CC BY-NC-ND',
  standard: 'CXY-SL',
};

// Signed-in create form plus categoryList { type: 7 }, 2026-07-31. Creality's
// picker permits both top-level and second-level choices; these are the stable
// API categoryId values, not the menu's zero-based positions.
export const CREALITY_CATEGORIES = [
  { id: '1731', label: '3D Printers', children: [
    ['1316', '3D Printer Parts'], ['1904', '3D Printer Accessories'], ['1645', 'Test Models'], ['6006', 'Other'],
  ] },
  { id: '1670', label: 'Art & Design', children: [
    ['1662', 'Digital Art'], ['1584', 'Sculptures & Artworks'], ['1341', 'Badges & Coins'],
    ['1997', 'Industrial Design & Prototypes'], ['6005', 'Other'],
  ] },
  { id: '1809', label: 'Toys & Games', children: [
    ['1575', 'Board Games & Card Games'], ['1141', 'Construction Toys'], ['1793', 'Game Props'], ['6007', 'Other'],
  ] },
  { id: '1519', label: 'Hobbies & DIY', children: [
    ['1741', 'Electronics & RC (Remote Control)'], ['1648', 'Robots & Mechs'], ['1194', 'Drones & Aircraft'],
    ['1420', 'Sound & Audio Equipment'], ['1246', 'Sports & Exercise Equipment'], ['6004', 'Other'],
  ] },
  { id: '1010', label: 'Household', children: [
    ['1150', 'Home Decorations & Ornaments'], ['1096', 'Lighting & Lamps'], ['1775', 'Home Appliance Accessories'],
    ['1671', 'Tools & Spare Parts'], ['1151', 'Pets'], ['6000', 'Other'],
  ] },
  { id: '1175', label: 'Fashion', children: [
    ['1966', 'Cosplay'], ['1693', 'Jewelry & Accessories'], ['1598', 'Apparel, Shoes & Hats'],
    ['1647', 'Personal Accessories'], ['6002', 'Other'],
  ] },
  { id: '1501', label: 'Education', children: [
    ['1974', 'Stationery & Learning Tools'], ['1343', 'Educational Aids'], ['6003', 'Other'],
  ] },
  { id: '1952', label: 'Miniatures', children: [
    ['1025', 'Characters & Creatures'], ['1888', 'Miniature Games & Accessories'], ['1846', 'Props & Terrain'],
    ['1982', 'Vehicles & Machinery'], ['6008', 'Other'],
  ] },
  { id: '1160', label: 'Medical & Health', children: [
    ['1192', 'Medical & Health Equipment'], ['1765', 'Personal Care Devices'], ['6001', 'Other'],
  ] },
  { id: '6012', label: 'MakeNow', children: [
    ['6014', 'MagicRelief'], ['6010', 'CubeMe'], ['6013', 'SnapForm'], ['6011', 'SignForge'],
  ] },
];

export function crealityCategoryLabel(id) {
  const wanted = String(id || '');
  for (const category of CREALITY_CATEGORIES) {
    if (category.id === wanted) return category.label;
    const child = category.children.find(([childId]) => childId === wanted);
    if (child) return `${category.label} › ${child[1]}`;
  }
  return '';
}

// The current first-party model uploader skips browser-rendered cover metadata
// for these formats and sends only the uploaded file record. Creality validates
// that distinction when saving drafts.
export function crealityUsesRenderedModelCover(fileName) {
  const match = /\.([^.]+)$/.exec(String(fileName || ''));
  const ext = match ? match[1].toLowerCase() : '';
  return !!ext && !CREALITY_NON_RENDERED_PREVIEW_FORMATS.has(ext);
}

// Creality stores a model file's base name and its extension in SEPARATE
// fields: `fileName` carries no extension ("modelprep-calibration-puck-S") and
// `fileFormat` carries a dotted extension (".stl"). Verified read-only against
// retained private model 6a77222f75286de2e7e68468 on 2026-08-08. Comparing a
// full filename against `fileName` would therefore fail on every upload.
//
// Every uploaded object key is `<prefix>/<md5>.<ext>`, and the retained
// `fileMd5` equals that md5 (cross-checked against the same file's MD5 digest
// on Nexprint). The upload record's `fileKey` is therefore an authoritative
// identity for both model files and images, and image identity is recoverable
// from the retained cover URL's basename.
export function crealityObjectKeyId(value) {
  const path = String(value || '').split(/[?#]/)[0];
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base ? base.toLowerCase() : '';
}

function crealityKeyDigest(value) {
  const id = crealityObjectKeyId(value);
  const match = /^([0-9a-f]{32})(?:\.|$)/.exec(id);
  return match ? match[1] : '';
}

// `records` are the upload results ModelPrep received for the exact bytes it
// sent: { name, size, fileKey }.
export function crealityExpectedFiles(records = []) {
  return (records || [])
    .filter((record) => String(record?.name || ''))
    .map((record) => {
      const name = String(record.name);
      const match = /^(.*?)\.([^.]+)$/.exec(name);
      return {
        name,
        base: (match ? match[1] : name).toLowerCase(),
        format: match ? `.${match[2].toLowerCase()}` : '',
        size: Number.isFinite(Number(record?.size)) && Number(record.size) > 0 ? Number(record.size) : null,
        md5: crealityKeyDigest(record?.fileKey),
      };
    });
}

export function crealityExpectedImages(records = []) {
  return (records || [])
    .map((record) => ({ id: crealityObjectKeyId(record?.fileKey), name: String(record?.name || '') }))
    .filter((image) => image.id);
}

function compareCoverList(label, wanted, retained, issues) {
  if (!Array.isArray(retained)) {
    issues.push(`${label}: expected a retained list, received none`);
    return;
  }
  if (retained.length !== wanted.length) {
    issues.push(`${label}: expected ${wanted.length}, received ${retained.length}`);
  }
  for (let index = 0; index < wanted.length; index += 1) {
    const want = wanted[index];
    const got = retained[index];
    if (!got) {
      issues.push(`${label}[${index}]: expected ${want.id}, received nothing`);
      continue;
    }
    // Order matters: Creality renders the gallery in list order, so an equal
    // set in the wrong order is still a defect.
    const gotId = crealityObjectKeyId(got?.url);
    if (gotId !== want.id) {
      issues.push(`${label}[${index}]: expected ${want.id}, received ${gotId || 'no url'}`);
    }
  }
}

// True when a retained filename is the source base name, allowing Creality's
// character-for-character masking (`bambu` -> `*****`). Same length, and every
// position either matches or is a masked `*`. This tolerates redaction without
// accepting an arbitrary rename.
export function crealityNameMatches(sourceBase, retainedName) {
  const want = String(sourceBase ?? '').toLowerCase();
  const got = String(retainedName ?? '').toLowerCase();
  if (want === got) return true;
  if (want.length !== got.length) return false;
  return [...got].every((char, index) => char === '*' || char === want[index]);
}

// Fail closed on what Creality's own readback authoritatively exposes.
//
// Deliberately NOT asserted, because Creality rewrites them server-side:
//   - tags: localized/translated on save. The retained model came back with
//     "3D打印机", "校准", "测试模型" for tags submitted in English, so an
//     equality check would fail on a correct upload.
//   - categoryName: translated the same way ("测试模型"). `categoryId` is
//     stable and is checked instead.
//   - isOriginal: read false on a model submitted with modelSource 1
//     (Original). Its meaning is unconfirmed, so it is reported, not asserted.
//
// Instruction files have no retained list at all: the group exposes only
// `otherFileCount` and `totalOtherFileSize`, so they are verified by count and
// total bytes and their individual identities cannot be certified.
export function crealityReadbackIssues(expected, model) {
  const issues = [];
  const group = model?.groupItem || {};
  const retained = model?.modelList || [];
  const wanted = expected?.files || [];
  if (retained.length !== wanted.length) {
    issues.push(`model files: expected ${wanted.length}, received ${retained.length}`);
  }
  if (Number(group.modelCount) !== wanted.length) {
    issues.push(`modelCount: expected ${wanted.length}, received ${group.modelCount ?? 'none'}`);
  }
  // Creality MASKS words it filters out of a retained filename, character for
  // character. Live-proven on 2026-08-08: `modelprep-calibration-puck-bambu`
  // came back as `modelprep-calibration-puck-*****` - a competitor brand name
  // replaced by exactly five asterisks. Exact name equality would therefore
  // reject a perfectly correct upload, in the same way an equality check on
  // tags or categoryName would.
  //
  // `fileMd5` is the authoritative identity instead: it is the md5 of the exact
  // bytes, matches the md5 embedded in the upload key, and is not rewritten.
  // The name is still checked, but mask-tolerantly.
  const remaining = [...retained];
  const takeByMd5 = (md5) => {
    if (!md5) return null;
    const index = remaining.findIndex((file) => String(file?.fileMd5 ?? '').toLowerCase() === md5);
    return index < 0 ? null : remaining.splice(index, 1)[0];
  };
  const takeByName = (base) => {
    const index = remaining.findIndex((file) => crealityNameMatches(base, file?.fileName));
    return index < 0 ? null : remaining.splice(index, 1)[0];
  };
  for (const file of wanted) {
    const hit = takeByMd5(file.md5) || takeByName(file.base);
    if (!hit) {
      issues.push(`${file.name}: selected for Creality Cloud but absent from the saved model list`);
      continue;
    }
    if (!crealityNameMatches(file.base, hit.fileName)) {
      issues.push(`${file.name}: expected Creality to retain the name ${file.base} (masking allowed), received ${JSON.stringify(String(hit.fileName ?? ''))}`);
    }
    // A missing format is a failure, not a skip: it is the only field that
    // distinguishes a retained .3mf from a retained .stl.
    const retainedFormat = String(hit?.fileFormat ?? '').toLowerCase();
    if (!retainedFormat) {
      issues.push(`${file.name}: Creality reported no retained fileFormat`);
    } else if (file.format && retainedFormat !== file.format) {
      issues.push(`${file.name}: expected Creality to retain format ${file.format}, received ${retainedFormat}`);
    }
    const retainedSize = Number(hit?.fileSize);
    if (!Number.isFinite(retainedSize) || retainedSize <= 0) {
      issues.push(`${file.name}: Creality reported no retained file size`);
    } else if (Number.isFinite(Number(file.size)) && Number(file.size) > 0 && retainedSize !== Number(file.size)) {
      issues.push(`${file.name}: expected ${file.size} retained bytes, received ${retainedSize}`);
    }
    if (file.md5) {
      const retainedMd5 = String(hit?.fileMd5 ?? '').toLowerCase();
      if (!retainedMd5) issues.push(`${file.name}: Creality reported no retained fileMd5`);
      else if (retainedMd5 !== file.md5) {
        issues.push(`${file.name}: expected md5 ${file.md5}, received ${retainedMd5}`);
      }
    }
    if (hit?.isBroken) issues.push(`${file.name}: Creality flagged the retained file as broken`);
    if (Number(hit?.makeThumbnailErr) > 0) {
      issues.push(`${file.name}: Creality reported thumbnail error ${hit.makeThumbnailErr}`);
    }
    // Creality parses a bounding box and volume from the geometry it ingests.
    // Requiring it is what makes "Creality accepted this model" mean more than
    // "Creality stored these bytes under this name".
    //
    // This is DELIBERATELY fail-closed for the non-rendered-preview formats
    // (.3mf/.step/.stp): Creality skips their browser-rendered cover, and
    // whether it parses geometry from them at all is unproven. If it does not,
    // Creality will retain a perfectly good object while ModelPrep reports the
    // upload uncertified. That asymmetry is intended - an uncertified report on
    // a retained object is recoverable, a certified claim about geometry that
    // was never parsed is not.
    const dims = ['x', 'y', 'z'].map((axis) => Number(hit?.[axis]));
    const volume = Number(hit?.volume);
    if (dims.some((value) => !Number.isFinite(value) || value <= 0) || !Number.isFinite(volume) || volume <= 0) {
      issues.push(`${file.name}: Creality reported no parsed geometry (x/y/z/volume), so usable geometry is unproven`);
    }
  }
  if (expected?.categoryId && String(group.categoryId || '') !== String(expected.categoryId)) {
    issues.push(`category: expected ${expected.categoryId}, received ${String(group.categoryId || '')}`);
  }
  if (expected?.license && String(group.license || '') !== String(expected.license)) {
    issues.push(`license: expected ${expected.license}, received ${String(group.license || '')}`);
  }
  if (expected?.name && String(group.groupName || '') !== String(expected.name)) {
    issues.push(`title: expected ${JSON.stringify(expected.name)}, received ${JSON.stringify(String(group.groupName || ''))}`);
  }
  compareCoverList('gallery covers', expected?.covers || [], group.covers, issues);
  compareCoverList('pc cover', expected?.pcCovers || [], group.pcCovers, issues);
  compareCoverList('app cover', expected?.appCovers || [], group.appCovers, issues);
  // Visibility must be explicitly false for a private upload: a missing or
  // null flag cannot certify that the model is not shared.
  if (expected?.private) {
    if (group.isShared !== false) {
      issues.push(`visibility: expected isShared false, received ${JSON.stringify(group.isShared ?? null)}`);
    }
  } else if (expected?.private === false && group.isShared !== true) {
    issues.push(`visibility: expected isShared true, received ${JSON.stringify(group.isShared ?? null)}`);
  }
  const totalFileSize = Number(group.totalFileSize);
  const expectedTotal = wanted.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
  if (group.totalFileSize == null || !Number.isFinite(totalFileSize) || totalFileSize <= 0) {
    issues.push(`total model bytes: expected ${expectedTotal}, received ${JSON.stringify(group.totalFileSize ?? null)}`);
  } else if (expectedTotal > 0 && totalFileSize !== expectedTotal) {
    issues.push(`total model bytes: expected ${expectedTotal}, received ${totalFileSize}`);
  }
  // The parsed Print Configuration mode is unimplemented, so its retained
  // state must be present and empty. A populated one would mean ModelPrep sent
  // something it cannot certify; a missing one means the field is gone.
  if (!Array.isArray(group.model3mfList)) {
    issues.push('print configuration: expected model3mfList to be present, received none');
  } else if (group.model3mfList.length !== 0) {
    issues.push(`print configuration: expected model3mfList to be empty, received ${group.model3mfList.length}`);
  }
  if (Number(group.model3mfCount) !== 0) {
    issues.push(`print configuration: expected model3mfCount 0, received ${group.model3mfCount ?? 'none'}`);
  }
  if (group.include3mf !== false) {
    issues.push(`print configuration: expected include3mf false, received ${JSON.stringify(group.include3mf ?? null)}`);
  }
  // Instruction files: identity is not retained, so count and total bytes are
  // the strongest available assertion, including the zero-instruction state.
  const expectedInstructions = expected?.instructions || [];
  const expectedInstructionBytes = expectedInstructions.reduce((sum, file) => sum + (Number(file?.size) || 0), 0);
  if (Number(group.otherFileCount ?? -1) !== expectedInstructions.length) {
    issues.push(`instruction files: expected ${expectedInstructions.length}, received ${group.otherFileCount ?? 'none'}`);
  }
  if (Number(group.totalOtherFileSize ?? -1) !== expectedInstructionBytes) {
    issues.push(`instruction bytes: expected ${expectedInstructionBytes}, received ${group.totalOtherFileSize ?? 'none'}`);
  }
  return issues;
}

// Creality has two mutually exclusive upload modes: a slicer-generated Print
// Configuration File, or raw STL/CAD/ordinary-3MF model files. The Print
// Configuration mode is unimplemented, and ModelPrep auto-creates a profile
// entry for EVERY .3mf, so excluding profile-linked files here silently dropped
// every 3MF from every Creality upload (live-confirmed 2026-08-07: the retained
// private model lists only the STLs while its description promises the Bambu
// profile). Creality accepts an ordinary 3MF as a plain model file, so 3MFs
// stay in the model list until the Print Configuration mode exists.
export function crealityRawModelFiles(files) {
  return (files || []).filter((file) => {
    const match = /\.([^.]+)$/.exec(String(file?.name || ''));
    const ext = match ? match[1].toLowerCase() : '';
    return !!file?.blob && CREALITY_MODEL_FORMATS.includes(ext);
  });
}

// Creality settles a new model asynchronously. The 2026-08-08 authorized
// private create proved it: immediately after `modelGroupCreate` the readback
// reported no parsed geometry on either STL and no `.3mf` in `modelList`, while
// the older retained object 6a77222f75286de2e7e68468 reports parsed geometry on
// every file. Certifying against the first readback therefore judges an
// unprocessed model.
//
// Interval and timeout are deliberate and documented rather than tuned: a 3
// second poll matches the pace of the first-party editor's own polling, and two
// minutes is long enough for a small multi-file model to finish indexing while
// still bounded so a stuck model is reported rather than waited on forever.
export const CREALITY_PROCESSING_INTERVAL_MS = 3_000;
export const CREALITY_PROCESSING_TIMEOUT_MS = 120_000;

// Issues that can legitimately still be settling: files not yet indexed,
// counts still growing, and geometry/checksums not yet parsed. Everything else
// is a contradiction that more waiting cannot fix.
const CREALITY_PENDING_ISSUE_PATTERNS = [
  /reported no parsed geometry/,
  /absent from the saved model list/,
  /^model files: expected/,
  /^modelCount: expected/,
  /^total model bytes: expected/,
  /reported no retained file size/,
  /reported no retained fileFormat/,
  /reported no retained fileMd5/,
];

export function crealityPendingIssues(issues = []) {
  return issues.filter((issue) => CREALITY_PENDING_ISSUE_PATTERNS.some((rx) => rx.test(String(issue))));
}

export function crealityHardIssues(issues = []) {
  return issues.filter((issue) => !CREALITY_PENDING_ISSUE_PATTERNS.some((rx) => rx.test(String(issue))));
}

// Poll the SAME saved object until it settles. This never resubmits: it takes
// an already-created id/state and only reads. A hard contradiction fails
// immediately; a timeout returns the exact unresolved fields so the caller can
// report retained-but-uncertified instead of implying success or failure.
export async function certifyCrealityModel({
  request,
  id,
  state,
  expected,
  intervalMs = CREALITY_PROCESSING_INTERVAL_MS,
  timeoutMs = CREALITY_PROCESSING_TIMEOUT_MS,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  onProgress = () => {},
}) {
  const started = now();
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const readback = await request(
      `status?id=${encodeURIComponent(id)}&state=${encodeURIComponent(state)}`,
      null,
      'GET',
    );
    const model = readback?.model || {};
    const issues = crealityReadbackIssues(expected, model);
    if (!issues.length) return { certified: true, timedOut: false, issues: [], model, attempts };
    const hard = crealityHardIssues(issues);
    if (hard.length) return { certified: false, timedOut: false, issues: hard, model, attempts };
    if (now() - started >= timeoutMs) {
      return { certified: false, timedOut: true, issues: crealityPendingIssues(issues), model, attempts };
    }
    onProgress({ attempts, pending: issues });
    await delay(intervalMs);
  }
}

// Submit once, then certify by polling. Extracted from the renderer so the
// retained-receipt contract is testable: on 2026-08-08 a fail-closed throw
// discarded the id of a model Creality had already created, and no allow-listed
// route can enumerate private models, so the object could not be re-found.
//
// The contract this guarantees:
//   - `submit` is called exactly once, whatever certification decides;
//   - the retained id/state/url is captured the moment it exists;
//   - a certification failure still returns that retained object, flagged
//     uncertified, with the id and URL inside the human-readable detail.
export async function runCrealityUpload({
  request,
  payload,
  expected,
  certify = certifyCrealityModel,
  onRetained = () => {},
  ...pollOptions
}) {
  const saved = await request('submit', payload);
  const retained = {
    id: String(saved?.id ?? '').trim(),
    state: String(saved?.state ?? '').trim(),
    url: String(saved?.url ?? '').trim(),
  };
  // Every later guarantee depends on this receipt being complete: an object
  // announced without an id or url is exactly the orphan this flow exists to
  // prevent, so a violated adapter contract fails loudly here rather than
  // silently producing an unfindable result.
  const missing = ['id', 'state', 'url'].filter((key) => !retained[key]);
  if (missing.length) {
    throw new Error(`Creality returned an incomplete create receipt (missing ${missing.join(', ')}). The model may exist on the account; check the Creality model list before retrying.`);
  }
  onRetained(retained);
  let certification;
  try {
    certification = await certify({
      request, id: retained.id, state: retained.state, expected, ...pollOptions,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return {
      ...retained,
      verified: false,
      uncertified: true,
      issues: [message],
      detail: `${message} The model was created and is retained at ${retained.url} (${retained.id}); it was not published, retried or deleted.`,
    };
  }
  if (certification.certified) {
    return { ...retained, verified: true, uncertified: false, issues: [], detail: '' };
  }
  const reason = certification.timedOut
    ? `Creality Cloud retained the model, but it did not finish processing in time. Unresolved: ${certification.issues.join('; ')}`
    : `Creality Cloud saved the model, but verification found: ${certification.issues.join('; ')}`;
  return {
    ...retained,
    verified: false,
    uncertified: true,
    timedOut: !!certification.timedOut,
    issues: certification.issues,
    detail: `${reason} The model was created and is retained at ${retained.url} (${retained.id}); it was not published, retried or deleted.`,
  };
}

// The App-facing mapping of an upload outcome to what the UI and the batch
// report show. It exists so the retained sentence is composed in exactly one
// place: an earlier integration appended it in the catch as well, duplicating
// it in the UI and discarding `timedOut`/`issues` in the process.
export function crealityUploadReport(outcome, { skippedProfiles = [], skippedNote = '' } = {}) {
  const base = {
    id: outcome?.id, state: outcome?.state, url: outcome?.url, skippedProfiles,
  };
  if (outcome?.verified) {
    return {
      ok: true,
      message: `${outcome.state} Creality model saved and read back${skippedNote}`,
      result: { ...base, verified: true },
      metadata: { publicationState: outcome.state, url: outcome.url, skippedProfiles },
    };
  }
  return {
    ok: false,
    // `detail` already names the retained object; never append it again.
    message: outcome?.detail || 'Creality Cloud did not certify the saved model.',
    result: {
      ...base,
      verified: false,
      uncertified: true,
      timedOut: !!outcome?.timedOut,
      issues: outcome?.issues || [],
    },
    metadata: {
      publicationState: outcome?.state,
      url: outcome?.url,
      uncertified: true,
      timedOut: !!outcome?.timedOut,
      issues: outcome?.issues || [],
      skippedProfiles,
    },
  };
}
