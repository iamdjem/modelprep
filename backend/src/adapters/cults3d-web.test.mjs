import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cultsWebReadCreation,
  cultsWebReadbackIssues,
  cultsWebIllustrationValidationIssue,
  cultsWebFilenameValidationIssue,
} from './cults3d-web.ts';

const session = { cookies: '_cults_session=test', csrfToken: 'csrf' };

function editHtml({ illustrationIds = [21, 22] } = {}) {
  return `<form id="edit_creation_1">
    <input name="creation[name]" value="Demo &amp; dragon">
    <input type="hidden" name="creation[blueprint_ids][]" value="11">
    ${illustrationIds.map((id) => `<input type="hidden" name="creation[illustration_ids][]" value="${id}">`).join('')}
    <a href="https://download.cults3d.com/uploaders/1/blueprint-file/a/dragon.stl?signed=1">dragon.stl</a>
    <a href="https://files.cults3d.com/uploaders/1/illustration-file/b/cover.webp">cover.webp</a>
    <a href="https://files.cults3d.com/uploaders/1/illustration-file/c/turntable.mp4">turntable.mp4</a>
  </form>`;
}

function listHtml() {
  return `<div id="creations-my-creations-1"><table><tbody><tr>
    <td><a title="Demo &amp; dragon" href="/en/creations/demo-dragon">Demo</a></td>
    <td><span class="text-marker">Secret</span></td>
    <td class="price-cell">Free</td>
  </tr></tbody></table></div>`;
}

test('Cults canonical edit readback returns ordered file and video IDs and names', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/en/creations/demo-dragon/edit')) return new Response(editHtml(), { status: 200 });
    if (String(url).endsWith('/en/creations/mine')) return new Response(listHtml(), { status: 200 });
    throw new Error(`Unexpected readback URL: ${url}`);
  };
  t.after(() => { globalThis.fetch = original; });

  const readback = await cultsWebReadCreation(session, 'demo-dragon');

  assert.equal(readback.title, 'Demo & dragon');
  assert.equal(readback.status, 'secret');
  assert.deepEqual(readback.blueprints, { ids: [11], filenames: ['dragon.stl'] });
  assert.deepEqual(readback.illustrations, { ids: [21, 22], filenames: ['cover.webp', 'turntable.mp4'] });
  assert.deepEqual(cultsWebReadbackIssues({
    title: 'Demo & dragon',
    visibility: 'secret',
    blueprintIds: [11],
    blueprintFilenames: ['dragon.stl'],
    illustrationIds: [21, 22],
    illustrationFilenames: ['cover.webp', 'turntable.mp4'],
  }, readback), []);
});

test('Cults readback fails closed when the persisted ordered video ID is missing', () => {
  const issues = cultsWebReadbackIssues({
    title: 'Demo dragon',
    visibility: 'secret',
    blueprintIds: [11],
    blueprintFilenames: ['dragon.stl'],
    illustrationIds: [21, 22],
    illustrationFilenames: ['cover.webp', 'turntable.mp4'],
  }, {
    slug: 'demo-dragon',
    title: 'Demo dragon',
    status: 'secret',
    blueprints: { ids: [11], filenames: ['dragon.stl'] },
    illustrations: { ids: [21], filenames: ['cover.webp', 'turntable.mp4'] },
  });

  assert.deepEqual(issues, ['Cults readback returned 1 illustration IDs; expected 2.']);
});

test('Cults Worker illustration validation accepts GIF and rejects invalid cover or oversized video', () => {
  assert.equal(cultsWebIllustrationValidationIssue([
    { type: 'image/gif', size: 1024 },
    { type: 'video/mp4', size: 1024 },
  ]), null);
  assert.match(cultsWebIllustrationValidationIssue([{ type: 'video/webm', size: 1024 }]), /first.*image cover/i);
  assert.match(cultsWebIllustrationValidationIssue([
    { type: 'image/webp', size: 1024 },
    { type: 'video/mp4', size: (10 * 1024 * 1024) + 1 },
  ]), /10 MiB/i);
});

test('Cults Worker file-name validation mirrors the uploader forbidden characters', () => {
  assert.equal(cultsWebFilenameValidationIssue([
    { name: 'dragon.stl' },
    { name: 'cover.webp' },
  ]), null);
  for (const name of ['dragon&wing.stl', 'cover>1.webp', 'part<a>.3mf']) {
    const issue = cultsWebFilenameValidationIssue([{ name: 'ok.stl' }, { name }]);
    assert.match(issue, /rejects the character/i);
    assert.ok(issue.includes(name));
  }
});
