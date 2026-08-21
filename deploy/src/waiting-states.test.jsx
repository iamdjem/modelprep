// The waiting rules, pinned. They come from the Mews Design System: a Button in
// its loading state for work the person started, a Spinner for work the system
// started, a Skeleton for content on its way. See DESIGN.md, "Waiting".
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'App.jsx'),
  'utf8',
);

describe('waiting states follow one rule', () => {
  test('every spinner is .mp-spin, so reduced motion turns it off', () => {
    // Tailwind's spin utility is not covered by our prefers-reduced-motion
    // block, and four buttons used it. One idiom, one guard.
    // The needle is built rather than written out: Tailwind scans this file too,
    // and a literal here makes it emit the utility we just stopped using.
    const banned = new RegExp(['animate', 'spin'].join('-'));
    expect(source).not.toMatch(banned);
  });

  test('the reduced-motion block covers every animation we ship', () => {
    // One block, not one per feature. A second one elsewhere in the file is how
    // a motion rule gets forgotten, so the count is part of the rule.
    const blocks = source.match(/@media \(prefers-reduced-motion: reduce\)/g) || [];
    expect(blocks).toHaveLength(1);
    const guard = source.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\n      \}/);
    expect(guard).toBeTruthy();
    for (const animated of ['mp-spin', 'mp-pulse', 'mp-scan', 'mp-skeleton', 'mp-thumb-btn']) {
      expect(guard[0]).toContain(animated);
    }
  });

  test('a loading button keeps its size and its name', () => {
    // The label is not removed: transparent text keeps the width, and the
    // accessible name with it. Removing the children would do neither.
    const component = source.match(/function LoadingButton\([\s\S]*?\n}/)[0];
    expect(component).toContain('aria-busy');
    expect(component).toContain('disabled={disabled || loading}');
    expect(component).toContain('{children}');
    expect(source).toMatch(/\.mp-loading \{[^}]*color: transparent/);
  });

  test('sign-in buttons are labelled by the action, not by the wait', () => {
    // "Waiting for Printables sign-in…" was a loading state pretending to be a
    // label. The mark says that now; the label always names the action.
    expect(source).not.toMatch(/Waiting for .*sign-in/);
    expect(source).toMatch(/buttonLabel="Sign in to Printables"/);
    expect(source).toMatch(/buttonLoading=\{busy\}/);
  });

  test('the writer marks the fields it is about to write', () => {
    // Otherwise you type a title into a field that is about to be overwritten.
    const details = source.match(/function DetailsSection\([\s\S]*?\n}\n/)[0];
    expect(details).toMatch(/aiBusy \? <FieldSkeleton/);
    expect(details).toMatch(/aiBusy && <Skeleton/);
    expect(details).toMatch(/!aiBusy && previewMode === 'preview'/);
  });

  test('rows in a list report status, they do not each spin', () => {
    // MDS allows one spinner on the page; ten platforms publishing at once
    // would have shown ten.
    expect(source).toContain('function WorkingStatus(');
    const perPlatformSpinners = source.match(/status === 'uploading' &&[^\n]*mp-spin/g) || [];
    expect(perPlatformSpinners).toHaveLength(0);
  });

  test('background work has a spinner where it happens', () => {
    // Both of these used to run in complete silence.
    expect(source).toMatch(/Reading \{importing\} photo/);
    expect(source).toMatch(/Preparing \{preparing\} file/);
  });
});
