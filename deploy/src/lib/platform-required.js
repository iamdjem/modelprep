// Which fields a platform refuses to publish without.
//
// Derived from what `platformPreflight` (and `makerWorldPublishIssues`) report
// as errors, not adaptations: those are the rejections the live platforms
// actually made during certification. Each entry is a pattern over the
// field's label text, so the mark follows the label wherever it renders and
// the ten panels need no per-field wiring.

const RULES = {
  details: [/^title$/i, /^category$/i],
  makerworld: [/^category$/i, /^visibility$/i, /^licen[cs]e$/i, /original model license/i, /what did you change/i, /print-profile name/i, /profile name/i, /print profile guidelines/i, /exclusive model program terms/i],
  // The label reads "Printables category", so the rule cannot be anchored.
  printables: [/categor/i],
  cults: [/category/i, /licen[cs]e/i, /^price/i, /^visibility$/i],
  nexprint: [/category/i, /licen[cs]e/i, /original|originality/i],
  creality: [/category/i, /licen[cs]e/i],
  makeronline: [/category/i, /licen[cs]e/i, /original or remix|model source|^source$/i, /permission/i, /print(ing)? method/i, /creative kit/i],
  mmf: [/category/i, /licen[cs]e/i, /visibility/i, /original.*generative ai/i],
  makeroad: [/categor/i, /print method/i, /publication time|publish at/i, /terms and privacy policy/i],
  thingiverse: [/category/i, /licen[cs]e/i, /publishing terms/i],
  thangs: [/primary part/i, /^audience$/i],
};

/** True when `labelText` names a field `platformId` requires. */
export function isRequiredField(platformId, labelText) {
  const rules = RULES[platformId];
  if (!rules) return false;
  const text = String(labelText || '').replace(/\((required|optional)\)/i, '').trim();
  if (!text) return false;
  return rules.some((pattern) => pattern.test(text));
}

/** Label text with a literal "(required)" suffix removed; the mark says it now. */
export function stripRequiredSuffix(labelText) {
  return String(labelText || '').replace(/\s*\(required\)\s*$/i, '');
}

export const REQUIRED_RULES = RULES;
