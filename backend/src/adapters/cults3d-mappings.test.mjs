import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveCultsCategory,
  resolveCultsCategoryInt,
  resolveCultsLicense,
} from './cults3d-mappings.ts';

test('Cults category mappings accept exact labels and identifiers but never fall back', () => {
  assert.deepEqual(resolveCultsCategory('Art & Decor'), {
    categoryId: 'Q2F0ZWdvcnkvMjM',
    substituted: false,
  });
  assert.deepEqual(resolveCultsCategory('Q2F0ZWdvcnkvMjM'), {
    categoryId: 'Q2F0ZWdvcnkvMjM',
    substituted: false,
  });
  assert.deepEqual(resolveCultsCategoryInt('Art & Decor'), { categoryId: 23, substituted: false });
  assert.deepEqual(resolveCultsCategoryInt('23'), { categoryId: 23, substituted: false });
  assert.equal(resolveCultsCategory(), null);
  assert.equal(resolveCultsCategory('Unknown category'), null);
  assert.equal(resolveCultsCategoryInt('999'), null);
});

test('Cults license mappings accept exact compatible choices and never substitute', () => {
  assert.deepEqual(resolveCultsLicense('ccby', false), { licenseCode: 'cc_by', substituted: false });
  assert.deepEqual(resolveCultsLicense('cc_by', false), { licenseCode: 'cc_by', substituted: false });
  assert.deepEqual(resolveCultsLicense('standard', true), { licenseCode: 'cults_cu', substituted: false });
  assert.deepEqual(resolveCultsLicense('cults_cu', true), { licenseCode: 'cults_cu', substituted: false });
  assert.equal(resolveCultsLicense(undefined, false), null);
  assert.equal(resolveCultsLicense('unknown', false), null);
  assert.equal(resolveCultsLicense('cc_by', true), null);
  assert.equal(resolveCultsLicense('cults_cu', false), null);
});
