const PRINTABLES_MODEL_URL = /^https:\/\/(?:www\.)?printables\.com\/(?:model|education)\/(\d+)(?:[/?#-]|$)/i;
const EXTERNAL_URL = /^https?:\/\/\S+$/i;

export function normalizePrintablesTag(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25);
}

export function normalizePrintablesTags(tags = []) {
  return [...new Set(tags.map(normalizePrintablesTag).filter(Boolean))];
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
    note: String(settings.note ?? file.note ?? '').slice(0, 500),
  };
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
