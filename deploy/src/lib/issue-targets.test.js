import { describe, expect, it } from 'vitest';
import { resolveIssueTarget } from './issue-targets.js';

const to = (message, platform = 'makerworld') => resolveIssueTarget(message, platform);

describe('where a preflight message points', () => {
  it('sends profile problems to Profiles', () => {
    expect(to('Select at least one print-profile photo.').section).toBe('platforms');
    expect(to('Select at least one print-profile photo.').field.test('Profile photos')).toBe(true);
    expect(to('Add a print-profile name.').field.test('Profile name')).toBe(true);
    expect(to('Accept the MakerWorld Print Profile Guidelines.').section).toBe('platforms');
    expect(to('Confirm that a selected profile photo shows the real printed model.').section).toBe('platforms');
  });

  it('sends listing text to the field on Details', () => {
    expect(to('Add a model description.')).toMatchObject({ section: 'details', platformId: null });
    expect(to('Add a model description.').field.test('Description (markdown)')).toBe(true);
    expect(to('Title is empty.').field.test('Title')).toBe(true);
    expect(to('Answer whether AI was used in Details.').field.test('Origin and disclosures')).toBe(true);
    expect(to('MakerWorld accepts at most 50 tags.').field.test('Tags')).toBe(true);
  });

  it('opens the platform panel for platform-only fields', () => {
    const category = to('Choose a MakerWorld category.');
    expect(category).toMatchObject({ section: 'platforms', platformId: 'makerworld' });
    expect(category.field.test('Category')).toBe(true);
    expect(to('Choose a Cults3D license before upload.', 'cults').field.test('Cults3D license')).toBe(true);
    expect(to('Choose FDM, Resin, or Both for MakerOnline.', 'makeronline').field.test('Print method')).toBe(true);
    expect(to('Choose Private or Public visibility for MyMiniFactory.', 'mmf').field.test('Visibility')).toBe(true);
  });

  it('sends pictures to Images and file caps to Files', () => {
    expect(to('Select a cover image.').section).toBe('images');
    expect(to('MakerRoad requires 3 to 10 ordered images.', 'makeroad').section).toBe('images');
    expect(to('dragon.stl is 300MB: over the 200MB per-file cap.').section).toBe('files');
  });

  it('sends account problems to Settings, even when the wording mentions upload', () => {
    expect(to('MakerWorld upload is disabled for this account.')).toMatchObject({ section: 'settings', settings: true, platformId: 'makerworld' });
  });

  it('falls back to Platforms for wording it has never seen', () => {
    expect(to('Something entirely new.').section).toBe('platforms');
  });
});
