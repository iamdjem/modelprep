import { describe, expect, it } from 'vitest';
import { flattenMyMiniFactoryCategories, MYMINIFACTORY_CATEGORY_TREE, verifyMyMiniFactoryReadback, waitForMyMiniFactoryReadback } from './myminifactory.js';

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
});
