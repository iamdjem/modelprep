const PRINTABLES_MODEL_URL = /^https:\/\/(?:www\.)?printables\.com\/(?:model|education)\/(\d+)(?:[/?#-]|$)/i;
const EXTERNAL_URL = /^https?:\/\/\S+$/i;
export const PRINTABLES_FILE_NOTE_MAX = 95;
export const PRINTABLES_FOLDER_NAME_MAX = 60;
export const PRINTABLES_RICH_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const PRINTABLES_PRICE_MIN = 5;
export const PRINTABLES_PRICE_MAX = 150;
const PRINTABLES_DESIGNER_STATUSES = new Set([
  'PUBLISHED', 'APPROVED', 'REVIEW_REQUESTED', 'REVIEW_REJECTED', 'EDIT_APPROVED',
]);

export function normalizePrintablesTag(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25);
}

export function normalizePrintablesTags(tags = []) {
  return [...new Set(tags
    .flatMap((tag) => String(tag ?? '').trim().split(/\s+/))
    .map(normalizePrintablesTag)
    .filter(Boolean))];
}

export function buildPrintablesSummary(explicitSummary, description) {
  const source = String(explicitSummary || description || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#_*`~>[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return source.slice(0, 120);
}

export function parsePrintablesRemixSource(value) {
  const source = String(value ?? '').trim();
  if (!source) return null;
  if (/^\d+$/.test(source)) return { id: source, type: 'printables' };
  const modelMatch = source.match(PRINTABLES_MODEL_URL);
  if (modelMatch) return { id: modelMatch[1], type: 'printables' };
  if (EXTERNAL_URL.test(source)) return { id: source, type: 'external' };
  return null;
}

export function printablesPublishStrategy(model) {
  return model?.publishApprovalRequired ? 'approval-request' : 'direct-update';
}

export async function publishVerifiedPrintablesModel({
  request,
  id,
  modelPayload,
  readbackModel,
}) {
  const strategy = printablesPublishStrategy(readbackModel);
  if (strategy === 'approval-request') {
    const publishRequest = await request('publish', { id });
    return { strategy, publishRequest };
  }
  const update = await request('model', { ...modelPayload, id, draft: false });
  if (!update.output?.id) throw new Error('Printables did not return the published model.');
  return { strategy, publishRequest: null };
}

export async function waitForPrintablesPublication({
  request,
  id,
  strategy,
  attempts = 10,
  delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  let status;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    status = await request(`status?id=${encodeURIComponent(id)}`, null, 'GET');
    if (status.state === 'live') return status;
    if (strategy === 'approval-request' && status.state === 'pending') return status;
    if (attempt + 1 < attempts) await delay(750);
  }
  const expected = strategy === 'approval-request'
    ? 'a live model or pending approval request'
    : 'a live model';
  throw new Error(`Printables did not confirm ${expected} after publication.`);
}

export function applyPrintablesFileSettings(file, source) {
  const settings = source?.printables || {};
  return {
    id: String(file.id),
    folder: String(settings.folder ?? file.folder ?? '').replace(/^\/+|\/+$/g, ''),
    name: file.name,
    note: String(settings.note ?? file.note ?? '').slice(0, PRINTABLES_FILE_NOTE_MAX),
  };
}

export function printablesFileSettingIssues(files = []) {
  const issues = [];
  for (const file of files) {
    const label = String(file?.name || 'Printables file');
    const note = String(file?.printables?.note || '');
    if (note.length > PRINTABLES_FILE_NOTE_MAX) {
      issues.push(`${label}: Printables file notes must be at most ${PRINTABLES_FILE_NOTE_MAX} characters.`);
    }
    const folder = String(file?.printables?.folder || '').replace(/^\/+|\/+$/g, '');
    if (folder.split('/').filter(Boolean).some((segment) => segment.length > PRINTABLES_FOLDER_NAME_MAX)) {
      issues.push(`${label}: each Printables folder name must be at most ${PRINTABLES_FOLDER_NAME_MAX} characters.`);
    }
    for (const [key, field] of [
      ['layerHeight', 'layer height'],
      ['nozzleDiameter', 'nozzle diameter'],
      ['printDuration', 'print duration'],
      ['weight', 'printed weight'],
    ]) {
      const value = file?.printables?.[key];
      if (value !== '' && value != null && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
        issues.push(`${label}: Printables ${field} override must be a positive number.`);
      }
    }
    const weight = file?.printables?.weight;
    if (weight !== '' && weight != null && !Number.isInteger(Number(weight))) {
      issues.push(`${label}: Printables printed weight override must be a whole number of grams.`);
    }
    const duration = file?.printables?.printDuration;
    if (duration !== '' && duration != null && Number(duration) > 999) {
      issues.push(`${label}: Printables print duration override must be at most 999 hours.`);
    }
  }
  return issues;
}

export function printablesPaidIssues(options = {}, capability = options.capabilities || null) {
  if (!options.club && !options.store) return [];
  const issues = [];
  const eligible = !!capability?.storeActive || PRINTABLES_DESIGNER_STATUSES.has(capability?.designerStatus);
  if (!eligible) issues.push('This Printables account is not eligible for Store or Club models.');
  if (options.authorship === 'reupload') issues.push('Printables does not allow paid or Club reuploads.');
  if (options.store) {
    if (!capability?.storeActive) issues.push('Activate Printables Store before selecting a paid Store model.');
    const price = Number(options.price);
    if (!Number.isInteger(price) || price < PRINTABLES_PRICE_MIN || price > PRINTABLES_PRICE_MAX) {
      issues.push(`Printables Store price must be a whole dollar amount from $${PRINTABLES_PRICE_MIN} to $${PRINTABLES_PRICE_MAX}.`);
    }
    if (capability?.maxStoreModels && capability.storeModelsCount >= capability.maxStoreModels) {
      issues.push(`This account has reached its Printables Store model limit (${capability.maxStoreModels}).`);
    }
  }
  if (options.club && !(capability?.tiers || []).length) {
    issues.push('Create at least one Printables Club tier before selecting a Club model.');
  }
  return issues;
}

export function validatePrintablesModel({
  title,
  summary,
  description,
  images = [],
  files = [],
  options = {},
}) {
  const issues = [];
  if (!String(title || '').trim()) issues.push('Add a model title in Details.');
  if (String(title || '').trim().length > 255) issues.push('Printables titles must be at most 255 characters.');
  if (!buildPrintablesSummary(summary, description)) issues.push('Add a Printables summary or description.');
  if (!String(description || '').trim()) issues.push('Add a description in Details.');
  if (!images.length) issues.push('Choose at least one model image.');
  if (!files.length) issues.push('Add at least one Printables-supported model file.');
  issues.push(...printablesFileSettingIssues(files));
  issues.push(...printablesPaidIssues(options));
  if (!options.categoryId) issues.push('Choose a Printables category in Platforms.');
  if (options.aiGenerated == null) issues.push('Answer whether AI was used in Platforms.');
  if (options.authorship === 'remix' || options.authorship === 'reupload') {
    if (!parsePrintablesRemixSource(options.remixParents?.[0])) {
      issues.push('Add a valid Printables model ID or http(s) source URL in Platforms.');
    }
  }
  if (options.authorship === 'remix' && !String(options.remixDescription || '').trim()) {
    issues.push('Describe what changed in this remix.');
  }
  return issues;
}

export function printablesReadbackMismatches(expected, model) {
  const mismatches = [];
  const compare = (label, actual, wanted) => {
    if (actual !== wanted) mismatches.push(`${label}: expected ${JSON.stringify(wanted)}, received ${JSON.stringify(actual)}`);
  };
  compare('name', model?.name, expected.name);
  compare('summary', model?.summary, expected.summary);
  compare('description', model?.description, expected.description);
  compare('authorship', model?.authorship, expected.authorship);
  compare('AI flag', !!model?.aiGenerated, !!expected.aiGenerated);
  compare('NSFW flag', !!model?.nsfw, !!expected.nsfw);
  compare('political flag', !!model?.politicalContent, !!expected.politicalContent);
  compare('Club flag', !!model?.club, !!expected.club);
  compare('Store price', Number(model?.price || 0), Number(expected.price || 0));
  compare('commercial-use exclusion', !!model?.excludeCommercialUsage, !!expected.excludeCommercialUsage);
  compare('category', String(model?.category?.id || ''), String(expected.category || ''));
  compare('license', String(model?.license?.id || ''), String(expected.license || ''));
  compare('main image', String(model?.image?.id || ''), String(expected.mainImage || ''));
  const actualTags = normalizePrintablesTags((model?.tags || []).map((tag) => tag.name)).sort();
  const expectedTags = normalizePrintablesTags(expected.tags).sort();
  if (actualTags.join('|') !== expectedTags.join('|')) {
    mismatches.push(`tags: expected ${expectedTags.join(', ')}, received ${actualTags.join(', ')}`);
  }
  const expectedImages = expected.images?.length || 0;
  if ((model?.images?.length || 0) !== expectedImages) {
    mismatches.push(`images: expected ${expectedImages}, received ${model?.images?.length || 0}`);
  }
  for (const key of ['stls', 'slas', 'gcodes', 'otherFiles']) {
    const wanted = expected[key] || [];
    const actual = [...(model?.[key] || [])].sort((left, right) => (left.order || 0) - (right.order || 0));
    if (actual.length !== wanted.length) {
      mismatches.push(`${key}: expected ${wanted.length}, received ${actual.length}`);
      continue;
    }
    for (let index = 0; index < wanted.length; index += 1) {
      for (const field of ['id', 'name', 'folder', 'note']) {
        if (String(actual[index]?.[field] ?? '') !== String(wanted[index]?.[field] ?? '')) {
          mismatches.push(`${key}[${index}].${field}: expected ${JSON.stringify(wanted[index]?.[field] ?? '')}, received ${JSON.stringify(actual[index]?.[field] ?? '')}`);
        }
      }
    }
  }
  const expectedParents = expected.remixParents || [];
  const actualParents = (model?.remixParents || []).map((parent) =>
    String(parent.parentPrintId || parent.url || '')).filter(Boolean);
  if (actualParents.join('|') !== expectedParents.map(String).join('|')) {
    mismatches.push(`remix parents: expected ${expectedParents.join(', ')}, received ${actualParents.join(', ')}`);
  }
  return mismatches;
}
