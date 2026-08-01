export const MAKEROAD_MODEL_FORMATS = ['3mf', 'stl', 'obj'];
export const MAKEROAD_DOCUMENT_FORMATS = ['pdf', 'txt', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
export const normalizeMakerRoadCategoryPath = (value) => String(value || '')
  .replace(/\s*›\s*/g, '›')
  .replace(/\s+/g, '')
  .toLocaleLowerCase();
export const MAKEROAD_LICENSES = [
  // Current MakerRoad radio values: 1 = no, 2 = yes, and shareEdit 3 =
  // adaptations must use the same terms. If attribution is waived (CC0),
  // the native form forces adaptation and commercial use to yes.
  ['CC BY', 1, 2, 2], ['CC BY-SA', 1, 3, 2], ['CC BY-NC', 1, 2, 1],
  ['CC BY-NC-SA', 1, 3, 1], ['CC BY-NC-ND', 1, 1, 1], ['CC BY-ND', 1, 1, 2], ['CC0 / Public Domain', 2, 2, 2],
].map(([label, shareNosign, shareEdit, shareBusiness]) => ({ label, shareNosign, shareEdit, shareBusiness }));
