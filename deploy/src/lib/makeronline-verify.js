// MakerOnline retained-model verification.
//
// Contract established read-only against retained draft 317477 on 2026-08-08.
// `GET /api/mold/edit-info?id=` returns, per raw file: `file_name` (WITH its
// extension, verbatim), `file_size`, `key` (the 32-hex storage identity the
// upload itself returned, so it round-trips), `file_id`, `model_size` (parsed
// geometry as {width,height,length}), `thumbnail`, `simple_url`, `parse_type`
// and `plate_count`. Images expose `key`, `url`, `thumbnail_url` and `is_main`.
//
// Every expectation here is built from the UPLOAD RECORDS MakerOnline returned
// for the exact bytes sent, never from a payload derived from the readback:
// a check whose expectation comes from the same response it is checking agrees
// with itself and proves nothing.
//
// Unlike Creality, MakerOnline was NOT observed to mask, translate or truncate
// anything - filenames came back verbatim with their extension and tags kept
// their hyphens. That is an observation about STL and metadata only: no `.3mf`
// has ever reached MakerOnline, so whether a competitor brand name in a
// filename would be masked is UNKNOWN and is deliberately not assumed either
// way. If a masked name appears, this verifier will fail closed and report it
// rather than silently tolerating it.

function geometryOf(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return null; }
}

// The desktop adapter falls back to the local file for `name`/`size`, so only
// the explicitly native fields prove what MakerOnline actually returned.
const REQUIRED_UPLOAD_FIELDS = ['key', 'nativeFileName', 'nativeFileSize', 'url'];

// Deterministic structural comparison. Joining with String() collapsed
// different plate objects into identical "[object Object]" values, so two
// genuinely different parser results compared equal.
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

// An expectation is only authoritative if MakerOnline actually returned the
// field. Falling back to the source value would quietly invent an expectation
// the platform never confirmed.
function uploadRecordIssues(label, entries) {
  const issues = [];
  (entries || []).forEach((entry, index) => {
    const record = entry?.record;
    if (!record) {
      issues.push(`${label}[${index}]: no backing upload record, so nothing about it can be verified`);
      return;
    }
    const missing = REQUIRED_UPLOAD_FIELDS.filter((field) => {
      const value = record?.[field];
      if (field === 'nativeFileSize') return !(Number(value) > 0);
      return !String(value ?? '').trim();
    });
    if (missing.length) {
      issues.push(`${label}[${index}]: MakerOnline upload response omitted ${missing.map((f) => f.replace('native', '').toLowerCase() || f).join(', ')}, so it cannot be verified`);
    }
  });
  return issues;
}

export function makerOnlineExpectedFiles(records = []) {
  return (records || []).map((record) => ({
    key: String(record?.key ?? ''),
    fileName: String(record?.nativeFileName ?? ''),
    fileSize: Number(record?.nativeFileSize ?? 0),
    // Source values are kept separately and never masquerade as native ones.
    sourceFileName: record?.sourceFileName ?? null,
    sourceFileSize: record?.sourceFileSize ?? null,
    ext: String(record?.nativeFileName ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '',
    // Only authoritative if MakerOnline's own upload response supplied it.
    // Source geometry is never invented here.
    modelSize: geometryOf(record?.model_size),
    record,
  }));
}

// `print_types` is built by the desktop adapter as
// `printMethod === 3 ? [1, 2] : [printMethod]` (FDM 1, Resin 2, Both 3).
// Mirrored here so an expectation can never disagree with the payload that was
// actually sent; `makeronline-verify.test.js` pins the mapping.
export function makerOnlinePrintTypes(printMethod) {
  const method = Number(printMethod);
  return method === 3 ? [1, 2] : [method];
}

export function makerOnlineExpectedImages(records = []) {
  return (records || []).map((record) => ({ key: String(record?.key ?? ''), record }));
}

// A profile expectation additionally carries what the server-side parser
// returned for that 3MF. ModelPrep forwards those values rather than
// synthesizing them, so they are the platform's own answer echoed back.
export function makerOnlineExpectedProfiles(records = []) {
  return (records || []).map((record) => {
    const parsed = record?.parsed && typeof record.parsed === 'object' ? record.parsed : {};
    return {
      key: String(record?.key ?? ''),
      fileName: String(record?.nativeFileName ?? ''),
      fileSize: Number(record?.nativeFileSize ?? 0),
      printers: record?.printers ?? parsed.printers ?? null,
      nozzle: record?.nozzle ?? parsed.nozzle ?? null,
      layer: record?.layer ?? parsed.layer ?? null,
      plates: record?.plates ?? parsed.plates ?? null,
      parseType: record?.parse_type ?? parsed.parse_type ?? null,
      record,
    };
  });
}

function compareRawFiles(wanted, retained, issues) {
  if (!Array.isArray(retained)) {
    issues.push('raw files: expected a retained list, received none');
    return;
  }
  if (retained.length !== wanted.length) {
    issues.push(`raw files: expected ${wanted.length}, received ${retained.length}`);
  }
  wanted.forEach((want, index) => {
    const got = retained[index];
    const at = `raw files[${index}]`;
    if (!got) {
      issues.push(`${at}: expected ${want.fileName}, received nothing`);
      return;
    }
    // Order matters: MakerOnline lists files in payload order.
    if (String(got.key ?? '') !== want.key) {
      issues.push(`${at}.key: expected ${want.key}, received ${String(got.key ?? '') || 'none'}`);
    }
    if (String(got.file_name ?? '') !== want.fileName) {
      issues.push(`${at}.file_name: expected ${JSON.stringify(want.fileName)}, received ${JSON.stringify(String(got.file_name ?? ''))}`);
    }
    const gotExt = String(got.file_name ?? '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
    if (want.ext && gotExt !== want.ext) {
      issues.push(`${at}: expected extension ${want.ext}, received ${gotExt || 'none'}`);
    }
    const gotSize = Number(got.file_size);
    if (!Number.isFinite(gotSize) || gotSize <= 0) {
      issues.push(`${at}: MakerOnline reported no retained file size`);
    } else if (want.fileSize > 0 && gotSize !== want.fileSize) {
      issues.push(`${at}: expected ${want.fileSize} retained bytes, received ${gotSize}`);
    }
    // MakerOnline parses a bounding box for every raw model it ingests, so a
    // missing one means the file is unusable or still processing.
    const size = geometryOf(got.model_size);
    const dims = [size?.width, size?.height, size?.length].map(Number);
    if (!size || dims.some((value) => !Number.isFinite(value) || value <= 0)) {
      issues.push(`${at}: MakerOnline reported no parsed geometry (model_size), so usable geometry is unproven`);
    } else if (want.modelSize) {
      // Exact only when the upload response itself supplied model_size.
      // Otherwise this check proves positive parsed geometry, nothing more.
      for (const axis of ['width', 'height', 'length']) {
        const wanted = Number(want.modelSize[axis]);
        if (!Number.isFinite(wanted)) continue;
        if (Number(size[axis]) !== wanted) {
          issues.push(`${at}: expected ${axis} ${wanted}, received ${size[axis]}`);
        }
      }
    }
  });
}

function compareImages(wanted, retained, issues) {
  if (!Array.isArray(retained)) {
    issues.push('images: expected a retained list, received none');
    return;
  }
  if (retained.length !== wanted.length) {
    issues.push(`images: expected ${wanted.length}, received ${retained.length}`);
  }
  wanted.forEach((want, index) => {
    const got = retained[index];
    if (!got) {
      issues.push(`images[${index}]: expected ${want.key}, received nothing`);
      return;
    }
    if (String(got.key ?? '') !== want.key) {
      issues.push(`images[${index}].key: expected ${want.key}, received ${String(got.key ?? '') || 'none'}`);
    }
  });
  // Exactly one cover, and it must be the first uploaded image.
  const mains = (retained || []).filter((image) => Number(image?.is_main) === 1);
  if (mains.length !== 1) {
    issues.push(`images: expected exactly one is_main cover, received ${mains.length}`);
  } else if (wanted.length && String(mains[0]?.key ?? '') !== wanted[0].key) {
    issues.push(`images: expected the cover to be ${wanted[0].key}, received ${String(mains[0]?.key ?? '') || 'none'}`);
  }
}

function compareProfiles(expected, model, issues) {
  const wanted = expected?.profiles || [];
  const retained = model?.print_files;
  const wantsProfiles = wanted.length > 0;
  // Absent, empty and populated are three different states and must not be
  // conflated: an absent array means the field this check depends on is gone.
  if (retained == null) {
    issues.push('print profiles: expected print_files to be present, received none');
  } else if (!Array.isArray(retained)) {
    issues.push('print profiles: expected print_files to be a list');
  }
  const expectedType = wantsProfiles ? 1 : 0;
  if (Number(model?.print_file_type) !== expectedType) {
    issues.push(`print_file_type: expected ${expectedType}, received ${model?.print_file_type ?? 'none'}`);
  }
  if (!Array.isArray(retained)) return;
  if (retained.length !== wanted.length) {
    issues.push(`print profiles: expected ${wanted.length}, received ${retained.length}`);
  }
  if (!wantsProfiles) {
    if (String(model?.print_title ?? '')) issues.push(`print_title: expected empty, received ${JSON.stringify(String(model.print_title))}`);
    if (String(model?.print_desc ?? '')) issues.push('print_desc: expected empty on a model with no print profile');
    const images = model?.print_images;
    if (images == null) issues.push('print images: expected print_images to be present, received none');
    else if (!Array.isArray(images)) issues.push('print images: expected print_images to be a list');
    else if (images.length) issues.push(`print images: expected 0, received ${images.length}`);
    return;
  }
  wanted.forEach((want, index) => {
    const got = retained[index];
    const at = `print profiles[${index}]`;
    if (!got) {
      issues.push(`${at}: expected ${want.fileName}, received nothing`);
      return;
    }
    // Identity first: a matching name and size on somebody else's upload is
    // still the wrong file.
    if (want.key && String(got.key ?? '') !== want.key) {
      issues.push(`${at}.key: expected ${want.key}, received ${String(got.key ?? '') || 'none'}`);
    }
    if (String(got.file_name ?? '') !== want.fileName) {
      issues.push(`${at}.file_name: expected ${JSON.stringify(want.fileName)}, received ${JSON.stringify(String(got.file_name ?? ''))}`);
    }
    const gotSize = Number(got.file_size);
    if (!Number.isFinite(gotSize) || gotSize <= 0) {
      issues.push(`${at}: MakerOnline reported no retained profile size`);
    } else if (want.fileSize > 0 && gotSize !== want.fileSize) {
      issues.push(`${at}: expected ${want.fileSize} retained bytes, received ${gotSize}`);
    }
    // Parser output is the entire point of the profile branch. Compare against
    // what `/api/file/parse-info` actually returned for this 3MF, not merely
    // that something is present: a retained profile describing a different
    // printer or layer height is wrong even though it is populated.
    const parserFields = [
      ['printers', want.printers, got.printers],
      ['nozzle', want.nozzle, got.nozzle],
      ['layer', want.layer, got.layer],
      ['plates', want.plates, got.plates],
      ['parse_type', want.parseType, got.parse_type],
    ];
    for (const [field, wantValue, gotValue] of parserFields) {
      const gotEmpty = gotValue == null || (Array.isArray(gotValue) ? gotValue.length === 0 : String(gotValue).trim() === '');
      if (gotEmpty) {
        issues.push(`${at}: MakerOnline returned no parsed ${field}, so the print profile is unparsed`);
        continue;
      }
      const a = canonical(wantValue);
      const b = canonical(gotValue);
      if (a !== b) {
        issues.push(`${at}.${field}: expected ${a}, received ${b}`);
      }
    }
  });
  // With profiles populated, `print_images` must be present even when none was
  // sent, and must not contain anything unexpected.
  const retainedProfileImages = model?.print_images;
  if (retainedProfileImages == null) {
    issues.push('print images: expected print_images to be present, received none');
  } else if (!Array.isArray(retainedProfileImages)) {
    issues.push('print images: expected print_images to be a list');
  } else if (!(expected?.printImages || []).length && retainedProfileImages.length) {
    issues.push(`print images: expected 0, received ${retainedProfileImages.length}`);
  }
  const title = String(expected?.printTitle ?? '');
  if (title && String(model?.print_title ?? '') !== title) {
    issues.push(`print_title: expected ${JSON.stringify(title)}, received ${JSON.stringify(String(model?.print_title ?? ''))}`);
  }
  const desc = String(expected?.printDescription ?? '');
  if (desc && String(model?.print_desc ?? '') !== desc) {
    issues.push('print_desc: retained profile description does not match what was sent');
  }
  const wantedImages = expected?.printImages || [];
  const retainedImages = model?.print_images;
  if (wantedImages.length) {
    if (Array.isArray(retainedImages)) {
      if (retainedImages.length !== wantedImages.length) {
        issues.push(`print images: expected ${wantedImages.length}, received ${retainedImages.length}`);
      }
      wantedImages.forEach((want, index) => {
        const got = retainedImages[index];
        if (!got) {
          issues.push(`print images[${index}]: expected ${want.key}, received nothing`);
          return;
        }
        if (String(got.key ?? '') !== want.key) {
          issues.push(`print images[${index}].key: expected ${want.key}, received ${String(got.key ?? '') || 'none'}`);
        }
      });
    }
  }
}

export function makerOnlineReadbackIssues(expected, model) {
  const issues = [];
  // Reject unusable expectations before comparing anything: an expectation
  // built from a transport field MakerOnline never returned is not a fact.
  issues.push(...uploadRecordIssues('raw files', expected?.files));
  issues.push(...uploadRecordIssues('images', expected?.images));
  issues.push(...uploadRecordIssues('print profiles', expected?.profiles));
  issues.push(...uploadRecordIssues('print images', expected?.printImages));

  compareRawFiles(expected?.files || [], model?.files, issues);
  compareImages(expected?.images || [], model?.images, issues);
  compareProfiles(expected, model, issues);

  const compare = (label, actual, wanted) => {
    if (wanted == null) return;
    if (String(actual ?? '') !== String(wanted)) {
      issues.push(`${label}: expected ${JSON.stringify(String(wanted))}, received ${JSON.stringify(String(actual ?? ''))}`);
    }
  };
  compare('title', model?.title, expected?.title);
  compare('description', model?.desc, expected?.description);
  compare('category', model?.category_id, expected?.categoryId);
  compare('license', model?.license, expected?.license);
  compare('permissions', model?.permissions, expected?.permissions);
  compare('source', model?.source, expected?.source);

  if (expected?.printTypes) {
    const actual = (model?.print_types || []).map(Number).join(',');
    const wanted = expected.printTypes.map(Number).join(',');
    if (actual !== wanted) issues.push(`print_types: expected ${wanted}, received ${actual || 'none'}`);
  }
  if (expected?.tags) {
    const actual = (model?.tags || []).map(String);
    const wanted = expected.tags.map(String);
    if (actual.join('|') !== wanted.join('|')) {
      issues.push(`tags: expected ${wanted.join(', ')}, received ${actual.join(', ')}`);
    }
  }
  for (const [label, key] of [['AI flag', 'ai_help'], ['NSFW flag', 'is_adult_nsfw']]) {
    if (expected?.[key] == null) continue;
    if (Number(model?.[key]) !== Number(expected[key])) {
      issues.push(`${label}: expected ${expected[key]}, received ${model?.[key] ?? 'none'}`);
    }
  }
  const docs = model?.docs;
  const expectedDocs = expected?.docs ?? 0;
  if (docs == null) issues.push('documentation: expected a retained docs list, received none');
  else if ((docs || []).length !== expectedDocs) {
    issues.push(`documentation: expected ${expectedDocs}, received ${(docs || []).length}`);
  }
  // Publication state must be present, not merely non-contradictory.
  if (model?.status == null) issues.push('state: expected a retained status, received none');
  else if (expected?.status != null && Number(model.status) !== Number(expected.status)) {
    issues.push(`state: expected status ${expected.status}, received ${model.status}`);
  }
  if (expected?.isOffline != null) {
    if (model?.is_offline == null) issues.push('state: expected a retained is_offline, received none');
    else if (Number(model.is_offline) !== Number(expected.isOffline)) {
      issues.push(`state: expected is_offline ${expected.isOffline}, received ${model.is_offline}`);
    }
  }
  return issues;
}

// MakerOnline parses geometry and profiles server-side, so the same
// asynchronous settling seen on Creality is plausible here and is handled the
// same way: poll the SAME saved id, never resubmit.
export const MAKERONLINE_PROCESSING_INTERVAL_MS = 3_000;
export const MAKERONLINE_PROCESSING_TIMEOUT_MS = 120_000;

const MAKERONLINE_PENDING_PATTERNS = [
  /reported no parsed geometry/,
  /returned no parsed (printers|nozzle|layer)/,
  /^raw files: expected/,
  /^print profiles: expected \d+, received/,
  /^images: expected \d+, received/,
  /reported no retained (file|profile) size/,
  /received nothing$/,
];

export function makerOnlinePendingIssues(issues = []) {
  return issues.filter((issue) => MAKERONLINE_PENDING_PATTERNS.some((rx) => rx.test(String(issue))));
}

export function makerOnlineHardIssues(issues = []) {
  return issues.filter((issue) => !MAKERONLINE_PENDING_PATTERNS.some((rx) => rx.test(String(issue))));
}

export async function certifyMakerOnlineModel({
  request,
  id,
  expected,
  intervalMs = MAKERONLINE_PROCESSING_INTERVAL_MS,
  timeoutMs = MAKERONLINE_PROCESSING_TIMEOUT_MS,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  onProgress = () => {},
}) {
  const started = now();
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const readback = await request(`status?id=${encodeURIComponent(id)}`, null, 'GET');
    const model = readback?.model || {};
    const issues = makerOnlineReadbackIssues(expected, model);
    if (!issues.length) return { certified: true, timedOut: false, issues: [], model, attempts };
    const hard = makerOnlineHardIssues(issues);
    if (hard.length) return { certified: false, timedOut: false, issues: hard, model, attempts };
    if (now() - started >= timeoutMs) {
      return { certified: false, timedOut: true, issues: makerOnlinePendingIssues(issues), model, attempts };
    }
    onProgress({ attempts, pending: issues });
    await delay(intervalMs);
  }
}

// Save once, then certify by polling. The retained id/state/url is captured the
// moment the save returns, so a later parser, polling or verification failure
// can never orphan the object the way the 2026-08-08 Creality run did.
// Every parser field must be PRESENT in the expectation before anything is
// saved. A null expectation would let the comparison skip the field entirely,
// so an unparsed profile could be certified. This runs before `save-draft`,
// so the flow stops without creating an object at all.
export const MAKERONLINE_REQUIRED_PARSER_FIELDS = ['printers', 'nozzle', 'layer', 'plates', 'parseType'];

export function makerOnlineExpectationIssues(expected) {
  const issues = [];
  (expected?.profiles || []).forEach((profile, index) => {
    const missing = MAKERONLINE_REQUIRED_PARSER_FIELDS.filter((field) => {
      const value = profile?.[field];
      if (value == null) return true;
      if (Array.isArray(value)) return value.length === 0;
      return String(value).trim() === '';
    });
    if (missing.length) {
      issues.push(`print profiles[${index}]: MakerOnline's parse-info response omitted ${missing.join(', ')}, so the profile cannot be certified`);
    }
    if (!String(profile?.key ?? '').trim()) {
      issues.push(`print profiles[${index}]: no upload key, so the retained profile cannot be identified`);
    }
  });
  return issues;
}

export async function runMakerOnlineUpload({
  request,
  payload,
  expected,
  certify = certifyMakerOnlineModel,
  onRetained = () => {},
  ...pollOptions
}) {
  // Refuse to create anything we could not then certify.
  const expectationIssues = makerOnlineExpectationIssues(expected);
  if (expectationIssues.length) {
    throw new Error(`MakerOnline cannot certify this upload, so nothing was saved: ${expectationIssues.join('; ')}`);
  }
  const saved = await request('submit', payload);
  const retained = {
    id: String(saved?.id ?? '').trim(),
    state: String(saved?.state ?? '').trim(),
    url: String(saved?.url ?? '').trim(),
  };
  const missing = ['id', 'state', 'url'].filter((key) => !retained[key]);
  if (missing.length) {
    throw new Error(`MakerOnline returned an incomplete save receipt (missing ${missing.join(', ')}). The model may exist on the account; check the MakerOnline model list before retrying.`);
  }
  onRetained(retained);
  let certification;
  try {
    certification = await certify({ request, id: retained.id, expected, ...pollOptions });
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
    ? `MakerOnline retained the model, but it did not finish processing in time. Unresolved: ${certification.issues.join('; ')}`
    : `MakerOnline saved the model, but verification found: ${certification.issues.join('; ')}`;
  return {
    ...retained,
    verified: false,
    uncertified: true,
    timedOut: !!certification.timedOut,
    issues: certification.issues,
    detail: `${reason} The model was created and is retained at ${retained.url} (${retained.id}); it was not published, retried or deleted.`,
  };
}

// The App-facing mapping. Composed in one place so a failure detail that
// already names the retained object is never decorated with it twice.
export function makerOnlineUploadReport(outcome) {
  const base = { id: outcome?.id, state: outcome?.state, url: outcome?.url };
  if (outcome?.verified) {
    return {
      ok: true,
      message: `${outcome.state} MakerOnline model saved and read back`,
      result: { ...base, verified: true },
      metadata: { publicationState: outcome.state, url: outcome.url },
    };
  }
  return {
    ok: false,
    message: outcome?.detail || 'MakerOnline did not certify the saved model.',
    result: {
      ...base, verified: false, uncertified: true, timedOut: !!outcome?.timedOut, issues: outcome?.issues || [],
    },
    metadata: {
      publicationState: outcome?.state,
      url: outcome?.url,
      uncertified: true,
      timedOut: !!outcome?.timedOut,
      issues: outcome?.issues || [],
    },
  };
}

// Live-confirmed on retained draft 317477 (2026-08-08): an unpublished
// MakerOnline draft reports `status: 3`. The published value has not been
// observed, so a public save must remain separately uncertified rather than
// asserting a guessed number.
export const MAKERONLINE_DRAFT_STATUS = 3;

// Build the certification expectation from the payload that was actually sent
// plus the upload records MakerOnline returned. Extracted from the renderer so
// the production wiring itself is testable: an expectation assembled inline
// silently drifted from the payload (`print_types`) and omitted draft status.
export function buildMakerOnlineExpectation({
  payload,
  modelRecords = [],
  imageRecords = [],
  profileRecords = [],
  profileImageRecords = [],
  documentCount = 0,
  tags = [],
}) {
  const draft = String(payload?.publication ?? 'draft') !== 'public';
  return {
    files: makerOnlineExpectedFiles(modelRecords),
    images: makerOnlineExpectedImages(imageRecords),
    profiles: makerOnlineExpectedProfiles(profileRecords),
    printImages: makerOnlineExpectedImages(profileImageRecords),
    printTitle: payload?.printTitle,
    printDescription: payload?.printDescription,
    title: payload?.title,
    description: payload?.description,
    categoryId: payload?.categoryId,
    license: payload?.license,
    permissions: payload?.permission,
    source: payload?.source,
    // Mirrors the adapter exactly; `[printMethod]` was wrong for Both.
    printTypes: makerOnlinePrintTypes(payload?.printMethod),
    tags,
    ai_help: payload?.aiHelp ? 1 : 0,
    is_adult_nsfw: payload?.nsfw ? 1 : 0,
    docs: documentCount,
    // Only the draft value is live-confirmed; a public save asserts presence
    // and consistency but not a specific number.
    status: draft ? MAKERONLINE_DRAFT_STATUS : null,
    isOffline: 0,
  };
}
