// Per-platform file roles. Each platform's options may carry a `fileRoles`
// object keyed by file id. The role is the contract: model, native print
// profile, documentation/reference, or not sent. `excludedFileIds` remains a
// read-compatible migration path for saved projects, but new UI never needs to
// turn a useful 3MF into a whole-file exclusion just because its slicer belongs
// to another vendor.
//
// Slicer attribution
// ------------------
// Most slicers are made by a printer vendor that also runs a model platform, so
// a .3mf carries a strong hint about where it belongs: a Bambu Studio profile is
// for MakerWorld, a Creality Print one for Creality Cloud. When a project holds
// the same model sliced five ways, sending all five to all ten platforms buries
// every listing in near-duplicates.
//
// A native slicer can suggest the *profile role*. It never excludes the file as
// a model. Platforms without a retained native-profile contract keep every 3MF
// as an ordinary model even when the file came from their vendor's slicer.
//
// Deliberately NOT attributed:
//   - non-profile geometry (.stl/.step/.obj): vendor-neutral, always included
//   - OrcaSlicer and Cura: community slicers with no platform of their own
//   - unknown/unparsed: never guess from an absent signal

import { fileSlicer } from './threemf.js';

// Slicers whose vendor runs one of our platforms. Anything outside this list is
// treated as neutral and always included.
export const VENDOR_SLICERS = ['bambu', 'prusa', 'crealityprint', 'anycubic', 'elegoo'];

export const NATIVE_SLICERS_BY_PLATFORM = {
  makerworld: ['bambu'],        // Bambu Lab
  printables: ['prusa'],        // Prusa Research
  creality: ['crealityprint'],  // Creality
  makeronline: ['anycubic'],    // Anycubic
  nexprint: ['elegoo'],         // Elegoo
  makeroad: ['elegoo'],         // Elegoo
};

export const DESTINATION_FILE_ROLES = [
  { id: 'model', label: 'Model' },
  { id: 'profile', label: 'Print profile' },
  { id: 'documentation', label: 'Documentation / reference' },
  { id: 'not-sent', label: 'Not sent' },
];

const NATIVE_PROFILE_PLATFORMS = new Set(['makerworld', 'makeroad']);

function isSlicedThreeMf(file) {
  return !!file?.isProfile && file?.threemf?.sliced !== false;
}

/**
 * The automatic role and the reason shown beside it. The MakerOnline parser is
 * server-side, so its matching 3MF remains a model until that parser has
 * actually returned every required field; the UI still shows the profile
 * suggestion instead of silently turning the option on.
 */
export function automaticPlatformFileRole(platformId, file) {
  if (!file) return { role: 'not-sent', reason: 'File is unavailable.', suggestedRole: null };
  if (file.isImage) {
    return { role: 'documentation', reason: 'Imported image is managed with ordered listing media.', suggestedRole: null };
  }
  if (!file.isModel && !file.isProfile) {
    return { role: 'documentation', reason: 'Supporting file is treated as documentation/reference.', suggestedRole: null };
  }
  if (!isSlicedThreeMf(file)) {
    return { role: 'model', reason: file?.threemf?.sliced === false ? 'Unsliced 3MF is ordinary model geometry.' : 'Compatible geometry is sent as a model.', suggestedRole: null };
  }

  const slicer = fileSlicer(file);
  const native = platformNativeSlicers(platformId);
  const nativeMatch = !!native?.includes(slicer);
  if (nativeMatch && NATIVE_PROFILE_PLATFORMS.has(platformId)) {
    return { role: 'profile', reason: `${slicer} metadata matches this platform's native profile role.`, suggestedRole: 'profile' };
  }
  if (nativeMatch && platformId === 'makeronline') {
    return {
      role: 'model',
      reason: 'Anycubic metadata suggests a print profile, but ModelPrep keeps it as a model until MakerOnline parse-info validates every required field.',
      suggestedRole: 'profile',
    };
  }
  if (nativeMatch && (platformId === 'creality' || platformId === 'nexprint')) {
    return {
      role: 'model',
      reason: `${platformId === 'creality' ? 'Creality Print Configuration' : 'Nexprint Print Profile'} objects are not built by ModelPrep yet; the 3MF remains an ordinary model.`,
      suggestedRole: null,
    };
  }
  return {
    role: 'model',
    reason: nativeMatch
      ? 'This platform accepts the 3MF as ordinary model geometry.'
      : 'A different slicer does not make the 3MF incompatible; it remains an ordinary model.',
    suggestedRole: null,
  };
}

export function explicitPlatformFileRole(platformOpts, fileId) {
  const role = platformOpts?.fileRoles?.[String(fileId)];
  return DESTINATION_FILE_ROLES.some((item) => item.id === role) ? role : null;
}

export function platformFileRoleChoice(platformId, file, platformOpts) {
  const explicit = explicitPlatformFileRole(platformOpts, file?.id);
  if (explicit) return { role: explicit, automatic: false, reason: 'Chosen for this destination.', suggestedRole: null };
  if (excludedIdSet(platformOpts).has(String(file?.id))) {
    return { role: 'not-sent', automatic: false, reason: 'Kept from the previous per-platform exclusion setting.', suggestedRole: null };
  }
  return { ...automaticPlatformFileRole(platformId, file), automatic: true };
}

export function platformFileRole(platformId, file, platformOpts) {
  return platformFileRoleChoice(platformId, file, platformOpts).role;
}

export function setPlatformFileRole(platformOpts, fileId, role) {
  if (!DESTINATION_FILE_ROLES.some((item) => item.id === role)) return platformOpts?.fileRoles || {};
  return { ...(platformOpts?.fileRoles || {}), [String(fileId)]: role };
}

export function resetPlatformFileRoles() {
  return { fileSelection: 'auto', fileRoles: {}, excludedFileIds: [] };
}

// Platforms with no slicer of their own (Cults3D, Thingiverse, MyMiniFactory,
// Thangs) have nothing to attribute, so they keep everything.
export function platformNativeSlicers(platformId) {
  return NATIVE_SLICERS_BY_PLATFORM[platformId] || null;
}

// Compatibility export for saved projects and older callers. Automatic slicer
// attribution no longer excludes any file; it is represented by the role and
// reason returned from automaticPlatformFileRole.
export function autoExcludedFileIds(platformId, files) {
  void platformId;
  void files;
  return [];
}

// True while the platform is still following the automatic selection. The first
// manual tick switches it off so a later import cannot undo the user's choice.
export function isAutoFileSelection(platformOpts) {
  return platformOpts?.fileSelection !== 'manual';
}

export function sameIdSet(a, b) {
  const left = [...(a || [])].map(String).sort();
  const right = [...(b || [])].map(String).sort();
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function excludedIdSet(platformOpts) {
  const ids = platformOpts?.excludedFileIds;
  return new Set(Array.isArray(ids) ? ids.map(String) : []);
}

export function withoutExcluded(files, platformOpts, platformId = null) {
  const excluded = excludedIdSet(platformOpts);
  const roles = platformOpts?.fileRoles || {};
  if (!excluded.size && !Object.keys(roles).length) return files;
  return (files || []).filter((file) => {
    if (excluded.has(String(file?.id))) return false;
    if (platformId) return platformFileRole(platformId, file, platformOpts) !== 'not-sent';
    return explicitPlatformFileRole(platformOpts, file?.id) !== 'not-sent';
  });
}

export function isFileExcluded(file, platformOpts, platformId = null) {
  if (excludedIdSet(platformOpts).has(String(file?.id))) return true;
  if (platformId) return platformFileRole(platformId, file, platformOpts) === 'not-sent';
  return explicitPlatformFileRole(platformOpts, file?.id) === 'not-sent';
}

// The print profiles this platform will NOT receive under its current
// selection. The picker explains the automatic choice, but preflight and the
// upload receipt stayed silent about it, so a retained listing with no profile
// read as "the 3MF failed to upload". That is how the 2026-08-08 audit came to
// record a cross-platform "3MF routing defect" on the five platforms whose
// native slicer is not Bambu: nothing was routed wrong, the file was never
// ticked. Every flow that reports what it sent should name what it did not.
export function excludedProfileNames(files, platformOpts) {
  const excluded = excludedIdSet(platformOpts);
  return (files || [])
    .filter((file) => file?.isProfile && (
      excluded.has(String(file?.id))
      || explicitPlatformFileRole(platformOpts, file?.id) === 'not-sent'
    ))
    .map((file) => String(file?.name || ''))
    .filter(Boolean);
}

export function toggleExcludedFileId(platformOpts, fileId) {
  const excluded = excludedIdSet(platformOpts);
  const id = String(fileId);
  if (excluded.has(id)) excluded.delete(id); else excluded.add(id);
  return [...excluded];
}
