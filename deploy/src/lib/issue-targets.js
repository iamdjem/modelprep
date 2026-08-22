// Where a preflight message points.
//
// Every "Needs attention" line names something the user has to fill in or
// fix. This turns the message into a destination: the step, the platform
// panel to open, and a pattern for the field's label so the UI can scroll
// to it, focus it and flash it. Messages are matched by wording, which is
// the only thing they all have in common; new messages fall back to the
// step they most likely belong to.

const FIELD = (section, field, extra = {}) => ({ section, field, ...extra });

// Order matters: the first rule that matches wins. Account problems come
// first because "MakerWorld upload is disabled for this account" also
// contains "upload", which would otherwise read as a files problem.
const RULES = [
  [/account|not enabled|not eligible|disabled for|sign in|connect/i, { section: 'settings' }],
  // Print profiles live inside the MakerWorld panel (they are its form for a
  // sliced 3MF), so every profile message opens that panel.
  [/guidelines/i, FIELD('platforms', /guidelines/i, { platformPanel: true })],
  [/real printed model|real photo/i, FIELD('platforms', /real printed|real photo/i, { platformPanel: true })],
  [/profile (photo|picture|cover)|print-profile (photo|cover)/i, FIELD('platforms', /photo|picture|cover/i, { platformPanel: true })],
  [/profile name|print-profile name/i, FIELD('platforms', /name/i, { platformPanel: true })],
  [/print-profile|print profile|sliced in|no print profile|laser & cut profile|\.lac/i, FIELD('platforms', /print profile/i, { platformPanel: true })],
  [/cover image|cover picture|crop/i, FIELD('images', /cover/i)],
  [/photos?\b|images?\b|pictures?\b|gallery|video/i, FIELD('images', null)],
  [/\btitle\b/i, FIELD('details', /^title/i)],
  [/what (you|did you) change|what changed/i, FIELD('details', /what did you change|origin/i)],
  [/description/i, FIELD('details', /description/i)],
  [/\btags?\b|keywords?/i, FIELD('details', /tags|keywords/i)],
  [/\bAI\b|generative/i, FIELD('details', /origin and disclosures|generative ai/i)],
  [/in details/i, FIELD('details', /origin and disclosures/i)],
  [/remix|original model|original work|parent object|source attribution|reprint|original url/i, FIELD('platforms', /source|remix|original|parent/i, { platformPanel: true })],
  [/categor/i, FIELD('platforms', /categor/i, { platformPanel: true })],
  [/licen[cs]e/i, FIELD('platforms', /licen[cs]e/i, { platformPanel: true })],
  [/visibility|permission|public or private|private or public/i, FIELD('platforms', /visibility|permission/i, { platformPanel: true })],
  [/print method|fdm, resin/i, FIELD('platforms', /print method|technology/i, { platformPanel: true })],
  [/creative kit/i, FIELD('platforms', /kit/i, { platformPanel: true })],
  [/price|paid|payment/i, FIELD('platforms', /price|paid|pricing/i, { platformPanel: true })],
  [/publication time|scheduled/i, FIELD('platforms', /release plan|publication/i, { platformPanel: true })],
  [/bom\b|material name/i, FIELD('platforms', /bill of materials|bom/i, { platformPanel: true })],
  [/exclusive/i, FIELD('platforms', /exclusive/i, { platformPanel: true })],
  [/cyberbrick/i, FIELD('platforms', /cyberbrick/i, { platformPanel: true })],
  [/primary part/i, FIELD('platforms', /primary part/i, { platformPanel: true })],
  [/file|3mf|stl|\bmb\b|cap\b|formats?|blocks:|words/i, FIELD('files', null)],
];

/**
 * @param {string} message a preflight error
 * @param {string|null} platformId the platform reporting it
 * @returns {{section: string, field: RegExp|null, platformId: string|null, settings: boolean}}
 */
export function resolveIssueTarget(message = '', platformId = null) {
  const text = String(message || '');
  const hit = RULES.find(([pattern]) => pattern.test(text));
  if (!hit) return { section: 'platforms', field: null, platformId, settings: false };
  const target = hit[1];
  if (target.section === 'settings') return { section: 'settings', field: null, platformId, settings: true };
  return {
    section: target.section,
    field: target.field || null,
    platformId: target.platformPanel ? platformId : null,
    settings: false,
  };
}

/** Find the element a target points at, inside `root`. Null when nothing matches. */
export function findTargetElement(root, field) {
  if (!root) return null;
  if (!field) return root;
  const candidates = root.querySelectorAll('label, [data-field-caption], [data-section-title]');
  for (const candidate of candidates) {
    const text = (candidate.textContent || '').replace('*', '').trim();
    if (field.test(text)) return candidate;
  }
  return root;
}

/** The control that belongs to a label-like element, for focus. */
export function controlFor(element) {
  if (!element) return null;
  const inside = element.querySelector('input, textarea, select, [role="combobox"], button');
  if (inside) return inside;
  let sibling = element.nextElementSibling;
  for (let steps = 0; sibling && steps < 3; steps += 1) {
    const control = sibling.matches('input, textarea, select, [role="combobox"]') ? sibling : sibling.querySelector('input, textarea, select, [role="combobox"]');
    if (control) return control;
    sibling = sibling.nextElementSibling;
  }
  return null;
}
