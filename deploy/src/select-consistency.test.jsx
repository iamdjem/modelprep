// One dropdown, everywhere. A native <select> paints an OS menu (dark on macOS,
// system font, different again on Windows), which is why sixty-one of them
// looked nothing like the app they were in.
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'App.jsx'),
  'utf8',
);

// Comments may name the tag; markup may not use it.
const markup = source
  .split('\n')
  .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
  .join('\n');

describe('every dropdown is the same dropdown', () => {
  test('no native select or option survives in the markup', () => {
    expect(markup).not.toMatch(/<select\b/);
    expect(markup).not.toMatch(/<option\b/);
    expect(markup).not.toMatch(/<optgroup\b/);
  });

  test('the trigger keeps the semantics a select had', () => {
    const component = source.slice(source.indexOf('function Select({'));
    expect(component).toMatch(/role="combobox"/);
    expect(component).toMatch(/aria-haspopup="listbox"/);
    expect(component).toMatch(/aria-expanded=\{open\}/);
    expect(component).toMatch(/aria-controls=\{listId\}/);
    // The chosen value stays readable from the DOM, which is what `value` gave.
    expect(component).toMatch(/data-value=/);
  });

  test('search appears only when the list is long enough to need it', () => {
    // MDS: Select suits lists of five or more, and search is for "many". A
    // search box over four options is furniture.
    expect(source).toMatch(/const SELECT_SEARCH_FROM = 8;/);
    const component = source.slice(source.indexOf('function Select({'));
    expect(component).toMatch(/searchable = items\.length >= SELECT_SEARCH_FROM/);
  });
});
