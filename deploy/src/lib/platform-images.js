// Which pictures each platform gets, and which one leads.
//
// The gallery is written once in Images and sent everywhere, but platforms do
// not accept the same things. MyMiniFactory caps a picture at 5 MiB (documented,
// and enforced mid-transfer before this existed), and several platforms take no
// animation at all. A 6 MB cover used to be a blocker with no remedy: images are
// project-wide, so the only way out was to shrink the picture for everybody or
// drop it from the project.
//
// Files already solved this. Each destination can route a file to its own role,
// including "not sent". This is the same idea for pictures, with one difference:
// nobody wants to curate ten galleries by hand, so the default is automatic. A
// picture a platform cannot take is skipped for that platform and reported as an
// adaptation, which is what DESIGN.md reserves for "something ModelPrep does by
// itself". An explicit per-platform cover is there for when you disagree with
// the automatic choice.

const MB = 1024 * 1024;

// Animation and video, which several platforms reject outright as pictures.
const ANIMATED_TYPES = new Set(['image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']);

function imageBytes(image) {
  if (!image) return 0;
  if (Number.isFinite(image.size) && image.size > 0) return image.size;
  const url = String(image.dataUrl || '');
  const base64 = url.slice(url.indexOf(',') + 1);
  return base64 ? Math.round((base64.length * 3) / 4) : 0;
}

function imageType(image) {
  if (image?.type) return String(image.type).toLowerCase();
  const url = String(image?.dataUrl || '');
  const match = url.match(/^data:([^;,]+)/i);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Why `platform` cannot take `image`, or null when it can.
 *
 * Reasons are written for a person: they end up in the panel verbatim.
 */
export function imageRejection(platform, image) {
  const capMb = platform?.maxImageMb;
  if (capMb) {
    const bytes = imageBytes(image);
    if (bytes > capMb * MB) {
      return `over ${platform.name}'s ${capMb} MB per-picture cap`;
    }
  }
  const type = imageType(image);
  if (platform?.stillImagesOnly && ANIMATED_TYPES.has(type)) {
    return `${platform.name} takes still pictures only`;
  }
  // Availability is not a platform rule: an image the app cannot read is a
  // problem everywhere, and the platform's own preflight says so.
  return null;
}

/**
 * The pictures a platform actually receives.
 *
 * `cover` leads; `gallery` is the rest in gallery order, minus the cover.
 * `skipped` carries one entry per picture the platform cannot take, with the
 * reason. `coverSource` says where the cover came from, so the UI can be honest
 * about whether it was chosen or fell out of the rules.
 */
export function platformImagePlan(platform, project, opts = {}) {
  const images = (project?.images || []).filter(Boolean);
  const skipped = [];
  const usable = [];
  for (const image of images) {
    const reason = imageRejection(platform, image);
    if (reason) skipped.push({ id: image.id, name: image.name || image.alt || 'Picture', reason });
    else usable.push(image);
  }

  const chosen = opts.coverImageId
    ? usable.find((image) => image.id === opts.coverImageId)
    : null;
  const projectCover = usable.find((image) => image.id === project?.coverImageId) || null;
  const cover = chosen || projectCover || usable[0] || null;
  const coverSource = chosen ? 'chosen'
    : projectCover ? 'project'
      : cover ? 'fallback'
        : 'none';

  return {
    cover,
    gallery: usable.filter((image) => image.id !== cover?.id),
    skipped,
    coverSource,
    usableCount: usable.length,
  };
}

/**
 * One line for the platform panel, or null when there is nothing to say.
 *
 * Silence is the goal: a platform that takes every picture says nothing.
 */
export function platformImageNote(platform, project, opts = {}) {
  const plan = platformImagePlan(platform, project, opts);
  if (!plan.skipped.length) return null;
  const reasons = [...new Set(plan.skipped.map((item) => item.reason))];
  const count = plan.skipped.length;
  const noun = count === 1 ? 'picture' : 'pictures';
  if (!plan.cover) return `No picture here can go to ${platform.name}: ${count} ${noun} ${reasons.join('; ')}.`;
  const coverNote = plan.coverSource === 'fallback'
    ? ` ${plan.cover.name || 'The next usable picture'} leads instead.`
    : '';
  return `${count} ${noun} skipped for ${platform.name}: ${reasons.join('; ')}.${coverNote}`;
}
