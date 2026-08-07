// Per-platform file selection. Each platform's options may carry
// `excludedFileIds`; every publish flow and preflight passes its candidate
// file list through withoutExcluded so an empty/missing list is a guaranteed
// no-op (today's behavior) and exclusions compose with each flow's own
// format filtering.
//
// Slicer attribution
// ------------------
// Most slicers are made by a printer vendor that also runs a model platform, so
// a .3mf carries a strong hint about where it belongs: a Bambu Studio profile is
// for MakerWorld, a Creality Print one for Creality Cloud. When a project holds
// the same model sliced five ways, sending all five to all ten platforms buries
// every listing in near-duplicates.
//
// So a platform with a native slicer starts with only its own profiles ticked.
// Nothing is hidden or dropped: the other files stay listed and one click away,
// because "sliced elsewhere" does not mean "incompatible" - a Bambu .3mf is
// still a valid model file anywhere. This is a smart default, not a filter.
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

// Platforms with no slicer of their own (Cults3D, Thingiverse, MyMiniFactory,
// Thangs) have nothing to attribute, so they keep everything.
export function platformNativeSlicers(platformId) {
  return NATIVE_SLICERS_BY_PLATFORM[platformId] || null;
}

// The ids a platform excludes by default: profiles sliced by a *different*
// vendor's slicer. Returns [] whenever attribution cannot be made.
export function autoExcludedFileIds(platformId, files) {
  const native = platformNativeSlicers(platformId);
  if (!native) return [];
  return (files || [])
    .filter((file) => {
      if (!file?.isProfile) return false;
      const slicer = fileSlicer(file);
      if (!VENDOR_SLICERS.includes(slicer)) return false;
      return !native.includes(slicer);
    })
    .map((file) => String(file.id));
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

export function withoutExcluded(files, platformOpts) {
  const excluded = excludedIdSet(platformOpts);
  if (!excluded.size) return files;
  return (files || []).filter((file) => !excluded.has(String(file?.id)));
}

export function isFileExcluded(file, platformOpts) {
  return excludedIdSet(platformOpts).has(String(file?.id));
}

export function toggleExcludedFileId(platformOpts, fileId) {
  const excluded = excludedIdSet(platformOpts);
  const id = String(fileId);
  if (excluded.has(id)) excluded.delete(id); else excluded.add(id);
  return [...excluded];
}
