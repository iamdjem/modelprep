import { describe, expect, it } from 'vitest';
import { normalizeMakerRoadCategoryPath } from './makeroad.js';

describe('MakerRoad category paths', () => {
  it('matches live labels despite inconsistent spacing around ampersands', () => {
    expect(normalizeMakerRoadCategoryPath("Games & Toys › Kids' Toys"))
      .toBe(normalizeMakerRoadCategoryPath("Games &Toys › Kids' Toys"));
  });
});
