// Current MyMiniFactory category taxonomy, captured from the authenticated
// GET /api/store/categories response on 2026-07-31. The desktop UI refreshes
// this live when connected; this snapshot keeps saved projects and offline UI
// usable when the first-party endpoint is temporarily unavailable.
export const MYMINIFACTORY_CATEGORY_TREE = [
  { id: 1015, name: 'Tabletop', children: [
    { id: 617, name: 'Accessories' }, { id: 1304, name: 'Anime & Manga' },
    { id: 1145, name: 'Busts' },
    { id: 785, name: 'Characters & Creatures', children: [
      { id: 780, name: 'Fantasy Universe' }, { id: 784, name: 'Historical Universe' },
      { id: 782, name: 'Sci-Fi Universe' }, { id: 783, name: 'Thriller Universe' },
    ] },
    { id: 1319, name: 'Full Color' }, { id: 1325, name: 'Game Bundles' },
    { id: 1324, name: 'Storage' },
    { id: 787, name: 'Terrain', children: [
      { id: 1153, name: 'Fantasy Terrain' }, { id: 1158, name: 'Sci-Fi terrain' },
    ] },
    { id: 1313, name: 'Trench Crusade' }, { id: 786, name: 'Vehicles & Machines' },
    { id: 1306, name: 'Wargaming', children: [
      { id: 1311, name: 'Fantasy' }, { id: 1312, name: 'Historical' }, { id: 1310, name: 'Sci-fi' },
    ] },
  ] },
  { id: 1303, name: 'PDF Only', children: [
    { id: 1323, name: 'Maps' }, { id: 1322, name: 'Painting Guides' },
    { id: 1320, name: 'RPG (PDF Only)' }, { id: 1321, name: 'Wargames (PDF Only)' },
  ] },
  { id: 60, name: 'Toys', children: [
    { id: 462, name: 'Articulated' }, { id: 1309, name: 'Cuties' },
    { id: 1308, name: 'Marbles' }, { id: 1307, name: 'Mechanical Marvels' },
    { id: 100, name: 'Puzzles & Games' }, { id: 529, name: 'Scaled Models' },
  ] },
  { id: 57, name: 'Home & Decor', children: [
    { id: 150, name: 'Garden & Outdoors' },
    { id: 335, name: 'Home Decor', children: [
      { id: 389, name: 'Candle holders' }, { id: 399, name: 'Clocks' },
      { id: 397, name: 'Fixtures, Fittings & Utilities' }, { id: 372, name: 'Ornaments' },
      { id: 398, name: 'Picture Frames' }, { id: 362, name: 'Vases, pots and planters' },
    ] },
    { id: 149, name: 'Organizer & Storage', children: [
      { id: 377, name: 'Bookends & Bookmarks' }, { id: 382, name: 'Pen Holders' },
    ] },
    { id: 252, name: 'Workshop & Tools' },
  ] },
  { id: 120, name: 'RC Cars', children: [
    { id: 1282, name: 'Accessories Exterior' }, { id: 1283, name: 'Accessories Interior' },
    { id: 1291, name: 'Accessories Spare Parts' }, { id: 1274, name: 'Buggy' },
    { id: 1273, name: 'Crawler' }, { id: 1292, name: 'Drag Racing' },
    { id: 1275, name: 'Drifting' }, { id: 1276, name: 'Monster Truck' },
    { id: 1278, name: 'Scale 1:10' }, { id: 1279, name: 'Scale 1:14' },
    { id: 1280, name: 'Scale 1:16' }, { id: 1281, name: 'Scale 1:24' },
    { id: 1299, name: 'Scale 1:6' }, { id: 1277, name: 'Scale 1:8' },
  ] },
];

export function flattenMyMiniFactoryCategories(nodes, parentNames = [], parentIds = []) {
  const output = [];
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const id = Number(node?.id);
    const name = String(node?.name || '').trim();
    if (!Number.isInteger(id) || id <= 0 || !name) continue;
    const pathNames = [...parentNames, name];
    const pathIds = [...parentIds, id];
    output.push({ id: String(id), label: pathNames.join(' › '), pathIds, depth: parentIds.length });
    output.push(...flattenMyMiniFactoryCategories(node.children, pathNames, pathIds));
  }
  return output;
}

function exactStringArray(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function verifyMyMiniFactoryReadback({ object, title, publication, categoryIds, imageNames, fileNames, description, tags, advanced }) {
  if (!object || typeof object !== 'object') throw new Error('MyMiniFactory returned no object read-back.');

  // Description and tags were previously never read back, so format defects
  // shipped as "verified" (audit X6). Compare when the parser returned them.
  const collapse = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  if (description != null && Object.prototype.hasOwnProperty.call(object, 'description') && collapse(description) !== collapse(object.description)) {
    throw new Error('MyMiniFactory read-back returned a different description.');
  }
  if (Array.isArray(tags) && tags.length && Array.isArray(object.tags)) {
    const normalize = (values) => values.map((tag) => String(tag).trim().toLowerCase()).sort();
    if (JSON.stringify(normalize(tags)) !== JSON.stringify(normalize(object.tags))) {
      throw new Error('MyMiniFactory read-back returned a different tag set.');
    }
  }

  const expectedTitle = String(title || '').trim();
  const actualTitle = String(object.title || '').trim();
  if (!actualTitle || actualTitle !== expectedTitle) {
    throw new Error(`MyMiniFactory read-back returned a different title: ${actualTitle || 'missing'}.`);
  }

  const actualVisibility = String(object.visibility || 'unknown');
  if (actualVisibility !== publication) {
    throw new Error(`MyMiniFactory read-back visibility is ${actualVisibility}, expected ${publication}.`);
  }

  const expectedCategories = (categoryIds || []).map(Number);
  const actualCategories = Array.isArray(object.categoryIds) ? object.categoryIds.map(Number) : [];
  const missingCategoryIds = expectedCategories.filter((id) => !actualCategories.includes(id));
  if (missingCategoryIds.length) {
    throw new Error(`MyMiniFactory read-back is missing category IDs ${missingCategoryIds.join(', ')}.`);
  }

  const expectedImages = (imageNames || []).map(String);
  const actualImages = Array.isArray(object.imageNames) ? object.imageNames.map(String) : [];
  if (!exactStringArray(actualImages, expectedImages)) {
    throw new Error('MyMiniFactory read-back returned different image names, count, or order.');
  }

  const expectedFiles = (fileNames || []).map(String).sort();
  const actualFiles = Array.isArray(object.fileNames) ? object.fileNames.map(String).sort() : [];
  if (!exactStringArray(actualFiles, expectedFiles)) {
    throw new Error('MyMiniFactory read-back returned a different object-file set.');
  }

  if (advanced) {
    const expectedAdvanced = {
      licenseId: Number(advanced.licenseId || 5),
      printingTips: String(advanced.printingTips || ''),
      timeFrom: Number(advanced.timeFrom || 0), timeTo: Number(advanced.timeTo || 0),
      dimensions: String(advanced.dimensions || ''), dimensionsUnit: Number(advanced.dimensionsUnit || 0),
      technology: String(advanced.technology || ''), materialQuantity: String(advanced.materialQuantity || ''),
      supportFree: !!advanced.supportFree, remix: !!advanced.remix,
      remixParentIds: (advanced.remixParentIds || []).map(String),
    };
    const actualAdvanced = {
      licenseId: Number(object.licenseId || 0), printingTips: String(object.printingTips || ''),
      timeFrom: Number(object.timeFrom || 0), timeTo: Number(object.timeTo || 0),
      dimensions: String(object.dimensions || ''), dimensionsUnit: Number(object.dimensionsUnit || 0),
      technology: String(object.technology || ''), materialQuantity: String(object.materialQuantity || ''),
      supportFree: !!object.supportFree, remix: !!object.remix,
      remixParentIds: (object.remixParentIds || []).map(String),
    };
    if (JSON.stringify(actualAdvanced) !== JSON.stringify(expectedAdvanced)) {
      throw new Error('MyMiniFactory read-back returned different advanced print, remix, or license fields.');
    }
  }

  return object;
}

// Read-only certification of an object that already exists on the account.
// The upload path knows the exact image/file names it just sent; a later
// re-read does not, because those names are generated at upload time. This
// check therefore proves the persisted metadata branch — visibility, required
// categories, license, print data, remix and its parents — and reports the
// ordered asset names it actually found instead of inventing an expectation.
// It never submits: callers must reach it through the GET status route only.
export function verifyMyMiniFactoryObjectState({ object, title, publication, categoryIds, advanced, minImages = 1, minFiles = 1 }) {
  if (!object || typeof object !== 'object') throw new Error('MyMiniFactory returned no object read-back.');

  const actualTitle = String(object.title || '').trim();
  const expectedTitle = String(title || '').trim();
  if (!actualTitle) throw new Error('MyMiniFactory read-back returned no title.');
  if (expectedTitle && actualTitle !== expectedTitle) {
    throw new Error(`MyMiniFactory read-back returned a different title: ${actualTitle}.`);
  }

  const actualVisibility = String(object.visibility || 'unknown');
  if (publication && actualVisibility !== publication) {
    throw new Error(`MyMiniFactory read-back visibility is ${actualVisibility}, expected ${publication}.`);
  }
  if (actualVisibility !== 'private' && actualVisibility !== 'public') {
    throw new Error(`MyMiniFactory read-back returned an unreadable visibility: ${actualVisibility}.`);
  }

  const actualCategories = Array.isArray(object.categoryIds) ? object.categoryIds.map(Number) : [];
  if (!actualCategories.length) throw new Error('MyMiniFactory read-back returned no category IDs.');
  const missingCategoryIds = (categoryIds || []).map(Number).filter((id) => !actualCategories.includes(id));
  if (missingCategoryIds.length) {
    throw new Error(`MyMiniFactory read-back is missing category IDs ${missingCategoryIds.join(', ')}.`);
  }

  const imageNames = Array.isArray(object.imageNames) ? object.imageNames.map(String) : [];
  const fileNames = Array.isArray(object.fileNames) ? object.fileNames.map(String) : [];
  if (imageNames.length < minImages) throw new Error(`MyMiniFactory read-back returned ${imageNames.length} images, expected at least ${minImages}.`);
  if (fileNames.length < minFiles) throw new Error(`MyMiniFactory read-back returned ${fileNames.length} object files, expected at least ${minFiles}.`);

  // ModelPrep always submits the first ordered image as `primary_image`. The
  // edit page renders one radio per image and marks the persisted cover, so a
  // re-read can prove the cover survived rather than assuming it did. Only
  // enforced when the page actually reports a primary.
  const primaryImage = String(object.primaryImage || '');
  if (primaryImage && primaryImage !== imageNames[0]) {
    throw new Error(`MyMiniFactory read-back cover is ${primaryImage}, expected the first ordered image ${imageNames[0]}.`);
  }

  if (advanced) {
    const expectedAdvanced = {
      licenseId: Number(advanced.licenseId || 5),
      printingTips: String(advanced.printingTips || ''),
      timeFrom: Number(advanced.timeFrom || 0), timeTo: Number(advanced.timeTo || 0),
      dimensions: String(advanced.dimensions || ''), dimensionsUnit: Number(advanced.dimensionsUnit || 0),
      technology: String(advanced.technology || ''), materialQuantity: String(advanced.materialQuantity || ''),
      supportFree: !!advanced.supportFree, remix: !!advanced.remix,
      remixParentIds: (advanced.remixParentIds || []).map(String),
    };
    const actualAdvanced = {
      licenseId: Number(object.licenseId || 0), printingTips: String(object.printingTips || ''),
      timeFrom: Number(object.timeFrom || 0), timeTo: Number(object.timeTo || 0),
      dimensions: String(object.dimensions || ''), dimensionsUnit: Number(object.dimensionsUnit || 0),
      technology: String(object.technology || ''), materialQuantity: String(object.materialQuantity || ''),
      supportFree: !!object.supportFree, remix: !!object.remix,
      remixParentIds: (object.remixParentIds || []).map(String),
    };
    // Name the differing fields. These are the creator's own product metadata,
    // never session or storage values, and a bare "something differs" error
    // leaves a failed certification impossible to diagnose without a re-read.
    const differing = Object.keys(expectedAdvanced)
      .filter((key) => JSON.stringify(actualAdvanced[key]) !== JSON.stringify(expectedAdvanced[key]));
    if (differing.length) {
      throw new Error(`MyMiniFactory read-back returned different advanced print, remix, or license fields: ${differing.join(', ')}.`);
    }
  }

  return {
    object,
    title: actualTitle,
    visibility: actualVisibility,
    categoryIds: actualCategories,
    imageNames,
    fileNames,
    primaryImage,
    imageOrderSource: String(object.imageOrderSource || 'unknown'),
    remix: !!object.remix,
    remixParentIds: (object.remixParentIds || []).map(String),
  };
}

export function myMiniFactoryObjectUrl(id) {
  const value = String(id || '').trim();
  if (!/^\d+$/.test(value)) throw new Error('Enter a numeric MyMiniFactory object ID to verify.');
  return `https://www.myminifactory.com/object/${value}`;
}

export async function waitForMyMiniFactoryReadback({ read, expected, attempts = 8, delayMs = 1500, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const object = await read();
    try {
      return verifyMyMiniFactoryReadback({ object, ...expected });
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await wait(delayMs);
    }
  }
  throw lastError || new Error('MyMiniFactory read-back did not become complete.');
}
