import { describe, expect, it } from 'vitest';
import { REQUIRED_RULES, isRequiredField, stripRequiredSuffix } from './platform-required.js';

describe('required fields per platform', () => {
  it('marks what preflight rejects and nothing else', () => {
    expect(isRequiredField('cults', 'Cults3D category (required)')).toBe(true);
    expect(isRequiredField('cults', 'Cults3D license (required)')).toBe(true);
    expect(isRequiredField('cults', 'Manufacturing settings (optional)')).toBe(false);
    expect(isRequiredField('mmf', 'Visibility')).toBe(true);
    expect(isRequiredField('mmf', 'Printing tips')).toBe(false);
    expect(isRequiredField('makerworld', 'Category')).toBe(true);
    expect(isRequiredField('makerworld', 'Visibility')).toBe(false);
    expect(isRequiredField('makeronline', 'Print method')).toBe(true);
    expect(isRequiredField('details', 'Title')).toBe(true);
    expect(isRequiredField('details', 'Description')).toBe(false);
  });

  it('is quiet outside a known scope', () => {
    expect(isRequiredField(null, 'Category')).toBe(false);
    expect(isRequiredField('nope', 'Category')).toBe(false);
    expect(isRequiredField('cults', '')).toBe(false);
  });

  it('covers every platform the app publishes to', () => {
    for (const id of ['makerworld', 'printables', 'cults', 'mmf', 'thingiverse', 'thangs', 'nexprint', 'creality', 'makeronline', 'makeroad']) {
      expect(Array.isArray(REQUIRED_RULES[id])).toBe(true);
    }
  });

  it('drops a literal "(required)" so the mark is not said twice', () => {
    expect(stripRequiredSuffix('Cults3D category (required)')).toBe('Cults3D category');
    expect(stripRequiredSuffix('Visibility')).toBe('Visibility');
  });
});
