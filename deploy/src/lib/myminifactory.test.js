import { describe, expect, it } from 'vitest';
import { flattenMyMiniFactoryCategories, myMiniFactoryObjectUrl, MYMINIFACTORY_CATEGORY_TREE, verifyMyMiniFactoryObjectState, verifyMyMiniFactoryReadback, waitForMyMiniFactoryReadback } from './myminifactory.js';

describe('MyMiniFactory category taxonomy', () => {
  it('keeps the exact hierarchical ID path required by the submitted categories array', () => {
    const categories = flattenMyMiniFactoryCategories(MYMINIFACTORY_CATEGORY_TREE);
    expect(categories.find((category) => category.id === '462')).toEqual({
      id: '462',
      label: 'Toys › Articulated',
      pathIds: [60, 462],
      depth: 1,
    });
    expect(categories.find((category) => category.id === '780')?.pathIds).toEqual([1015, 785, 780]);
  });

  it('fails closed unless title, private visibility, categories, ordered images, and files all read back', () => {
    const expected = {
      title: 'Private certification fixture', publication: 'private', categoryIds: [60, 462],
      imageNames: ['cover.jpg', 'gallery-01.jpg'], fileNames: ['part.stl', 'profile.3mf'],
    };
    const object = {
      title: expected.title, visibility: 'private', categoryIds: [60, 462],
      imageNames: ['cover.jpg', 'gallery-01.jpg'], fileNames: ['profile.3mf', 'part.stl'],
    };
    expect(verifyMyMiniFactoryReadback({ object, ...expected })).toBe(object);
    expect(() => verifyMyMiniFactoryReadback({ object: { ...object, visibility: 'public' }, ...expected })).toThrow(/visibility/i);
    expect(() => verifyMyMiniFactoryReadback({ object: { ...object, imageNames: [...object.imageNames].reverse() }, ...expected })).toThrow(/image names, count, or order/i);
    expect(() => verifyMyMiniFactoryReadback({ object: { ...object, fileNames: ['part.stl'] }, ...expected })).toThrow(/object-file set/i);
  });

  it('retries read-back only until asynchronously attached object files are visible', async () => {
    const expected = {
      title: 'Private certification fixture', publication: 'private', categoryIds: [60, 462],
      imageNames: ['cover.jpg'], fileNames: ['part.stl', 'profile.3mf'],
    };
    const complete = {
      title: expected.title, visibility: 'private', categoryIds: [60, 462],
      imageNames: ['cover.jpg'], fileNames: ['profile.3mf', 'part.stl'],
    };
    const reads = [
      { ...complete, fileNames: [] },
      { ...complete, fileNames: ['part.stl'] },
      complete,
    ];
    const waits = [];
    await expect(waitForMyMiniFactoryReadback({ read: async () => reads.shift(), expected, attempts: 3, delayMs: 25, wait: async (ms) => waits.push(ms) })).resolves.toBe(complete);
    expect(waits).toEqual([25, 25]);
  });

  it('fails closed when an advanced field differs after submit', () => {
    const advanced = { licenseId: 5, printingTips: 'No supports', timeFrom: 3, timeTo: 5, dimensions: '120 × 75 × 45', dimensionsUnit: 0, technology: 'FDM', materialQuantity: '45 g', supportFree: true, remix: false, remixParentIds: [] };
    const expected = { title: 'Private certification fixture', publication: 'private', categoryIds: [60, 462], imageNames: ['cover.jpg'], fileNames: ['part.stl'], advanced };
    const object = { title: expected.title, visibility: 'private', categoryIds: [60, 462], imageNames: ['cover.jpg'], fileNames: ['part.stl'], ...advanced };
    expect(verifyMyMiniFactoryReadback({ object, ...expected })).toBe(object);
    expect(() => verifyMyMiniFactoryReadback({ object: { ...object, materialQuantity: '46 g' }, ...expected })).toThrow(/advanced print/i);
  });
});

describe('MyMiniFactory read-only re-read of an existing object', () => {
  // Mirrors retained private specialist object 829284: the branch whose first
  // exact-package receipt failed closed on the current `remix-checkbox` name.
  const advanced = {
    licenseId: 5, printingTips: 'Print flat, no supports needed.', timeFrom: 3, timeTo: 5,
    dimensions: '120 × 75 × 45', dimensionsUnit: 0, technology: 'FDM', materialQuantity: '45 g',
    supportFree: true, remix: true, remixParentIds: ['829056'],
  };
  const object = {
    title: 'Articulating Desk Dragon (Print-in-Place)', visibility: 'private', categoryIds: [60, 462],
    imageNames: Array.from({ length: 10 }, (_, index) => `${String(index + 1).padStart(2, '0')}-desk-dragon.jpg`),
    fileNames: ['dragon.stl', 'dragon.3mf', 'notes.pdf'],
    ...advanced,
  };
  const expected = { title: object.title, publication: 'private', categoryIds: [60, 462], advanced };

  it('certifies persisted state without inventing upload-time asset names', () => {
    const verified = verifyMyMiniFactoryObjectState({ object, ...expected });
    expect(verified.visibility).toBe('private');
    expect(verified.imageNames).toHaveLength(10);
    expect(verified.fileNames).toHaveLength(3);
    expect(verified.remix).toBe(true);
    expect(verified.remixParentIds).toEqual(['829056']);
  });

  it('fails closed when the current remix control no longer reads back, and names the fields', () => {
    expect(() => verifyMyMiniFactoryObjectState({ object: { ...object, remix: false, remixParentIds: [] }, ...expected }))
      .toThrow(/advanced print, remix, or license fields: remix, remixParentIds\./i);
    expect(() => verifyMyMiniFactoryObjectState({ object: { ...object, dimensions: '' }, ...expected }))
      .toThrow(/fields: dimensions\./i);
  });

  it('fails closed on visibility, missing categories, and empty assets', () => {
    expect(() => verifyMyMiniFactoryObjectState({ object: { ...object, visibility: 'public' }, ...expected })).toThrow(/visibility is public/i);
    expect(() => verifyMyMiniFactoryObjectState({ object: { ...object, visibility: 'unknown' }, ...expected, publication: '' })).toThrow(/unreadable visibility/i);
    expect(() => verifyMyMiniFactoryObjectState({ object: { ...object, categoryIds: [60] }, ...expected })).toThrow(/missing category IDs 462/i);
    expect(() => verifyMyMiniFactoryObjectState({ object: { ...object, imageNames: [] }, ...expected })).toThrow(/0 images/i);
    expect(() => verifyMyMiniFactoryObjectState({ object: { ...object, fileNames: [] }, ...expected })).toThrow(/0 object files/i);
    expect(() => verifyMyMiniFactoryObjectState({ object: null, ...expected })).toThrow(/no object read-back/i);
  });

  it('fails closed when the persisted cover is no longer the first ordered image', () => {
    const withCover = { ...object, primaryImage: object.imageNames[0], imageOrderSource: 'position' };
    expect(verifyMyMiniFactoryObjectState({ object: withCover, ...expected }).primaryImage).toBe(object.imageNames[0]);
    expect(() => verifyMyMiniFactoryObjectState({ object: { ...withCover, primaryImage: object.imageNames[3] }, ...expected }))
      .toThrow(/cover is .*expected the first ordered image/i);
    // Only enforced when the page actually reports a primary.
    expect(() => verifyMyMiniFactoryObjectState({ object: { ...object, primaryImage: '' }, ...expected })).not.toThrow();
  });

  it('builds an object URL only from a numeric ID so the read route cannot be redirected', () => {
    expect(myMiniFactoryObjectUrl('829284')).toBe('https://www.myminifactory.com/object/829284');
    expect(myMiniFactoryObjectUrl(' 829284 ')).toBe('https://www.myminifactory.com/object/829284');
    expect(() => myMiniFactoryObjectUrl('829284/../../upload/object')).toThrow(/numeric MyMiniFactory object ID/i);
    expect(() => myMiniFactoryObjectUrl('https://evil.example/object/1')).toThrow(/numeric MyMiniFactory object ID/i);
    expect(() => myMiniFactoryObjectUrl('')).toThrow(/numeric MyMiniFactory object ID/i);
  });
});
