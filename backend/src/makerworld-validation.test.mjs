import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMakerWorldRemix, validateLaserCutPublish, validateMakerWorldPublish } from './makerworld-validation.ts';

test('regular validation mirrors MakerWorld profile and total-size gates', () => {
  const issues = validateMakerWorldPublish({
    title: 'Model', description: '<p>Model</p>', categoryId: 401,
    coverUrl: 'https://cdn/cover.jpg', coverPortraitUrl: 'https://cdn/portrait.jpg',
    model3mf: { name: 'profile.3mf', size: 151 * 1024 * 1024, url: 'https://cdn/profile.3mf' },
  });
  assert.ok(issues.includes('profile.3mf exceeds the 150MB 3MF limit'));
  assert.ok(issues.includes('a 3MF upload requires printProfile'));
});

test('regular validation accepts one MP4 or MOV model video and rejects invalid media', () => {
  const base = {
    title: 'Model', description: '<p>Model</p>', categoryId: 401,
    coverUrl: 'https://cdn/cover.jpg', coverPortraitUrl: 'https://cdn/portrait.jpg',
    modelFiles: [{ modelName: 'model.stl', modelSize: 10, modelType: 'stl', modelUrl: 'https://cdn/model.stl' }],
  };
  assert.deepEqual(validateMakerWorldPublish({ ...base, designVideo: [{ name: 'demo.mov', url: 'https://cdn/demo.mov' }] }), []);
  const issues = validateMakerWorldPublish({ ...base, designVideo: [
    { name: 'one.mp4', url: 'https://cdn/one.mp4' },
    { name: 'two.webm', url: '' },
  ] });
  assert.ok(issues.includes('at most one model video is allowed'));
  assert.ok(issues.includes('model video url is required'));
  assert.ok(issues.includes('model video must be MP4 or MOV'));
});

test('Laser & Cut .lac validation requires profile data and enforces file size', () => {
  const issues = validateLaserCutPublish({
    title: 'Laser box', pictures: ['https://cdn/cover.jpg'],
    lacFile: { name: 'box.lac', size: 201 * 1024 * 1024, url: 'https://cdn/box.lac' },
    lacInfo: { plates: [{ id: 1 }], machineName: 'H2D', processTypes: ['cut'], materialIds: [] },
  });
  assert.ok(issues.includes('box.lac exceeds the 200MB per-file limit'));
  assert.ok(issues.includes('profileTitle is required for .lac uploads'));
  assert.ok(issues.includes('profilePictures requires at least one picture for .lac uploads'));
});

test('raw Laser & Cut accepts .lac as a source file', () => {
  assert.deepEqual(validateLaserCutPublish({
    title: 'Raw package', pictures: ['https://cdn/cover.jpg'],
    modelFiles: [{ modelName: 'source.lac', modelSize: 20, modelType: 'lac', modelUrl: 'https://cdn/source.lac' }],
  }), []);
});

test('external Laser & Cut remix keeps designType 1', async () => {
  const input = {
    title: 'Laser remix', modelSource: 'remix', remixSourceUrl: 'https://example.com/source',
    remixSourceLicense: 'BY', remixDescription: 'Resized.', remixOriginalDesignType: 1,
  };
  assert.deepEqual(await resolveMakerWorldRemix({ cookie: 'token=test' }, input), []);
  assert.equal(input.resolvedOriginals[0].designType, 1);
  assert.equal(input.resolvedOriginals[0].designId, 0);
});
