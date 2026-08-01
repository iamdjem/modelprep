import { describe, expect, it } from 'vitest';
import { flattenThangsCategories, selectThangsSourceFiles, THANGS_CATEGORIES } from './thangs.js';

describe('Thangs category taxonomy', () => {
  it('keeps a verified fallback and flattens the authenticated response path', () => {
    expect(THANGS_CATEGORIES).toContainEqual({ value: 'Toys & Games/Articulated', label: 'Toys & Games › Articulated' });
    expect(flattenThangsCategories([{ name: 'Art & Decor', subcategories: ['All', 'Vases & Planters'] }])).toEqual([
      { value: 'Art & Decor', label: 'Art & Decor' },
      { value: 'Art & Decor/Vases & Planters', label: 'Art & Decor › Vases & Planters' },
    ]);
  });
});

describe('Thangs file-role selection', () => {
  const files = [
    { id: 'small', name: 'small.stl', size: 10, blob: {} },
    { id: 'large', name: 'large.stl', size: 20, blob: {} },
    { id: 'profile', name: 'profile.3mf', size: 30, blob: {} },
  ];

  it('uploads only the selected primary model for a single model', () => {
    const result = selectThangsSourceFiles(files, { structure: 'single', primaryFileId: 'profile' });
    expect(result.models.map((file) => file.id)).toEqual(['profile']);
    expect(result.references.map((file) => file.id)).toEqual(['small', 'large']);
  });

  it('keeps single-part-only formats out of multipart and bulk model parts', () => {
    const result = selectThangsSourceFiles(files, { structure: 'multipart' });
    expect(result.models.map((file) => file.id)).toEqual(['small', 'large']);
    expect(result.references.map((file) => file.id)).toEqual(['profile']);
  });
});
