// Which files get a print-profile record.
//
// This used to be "only a 3MF we could prove was sliced". That is stricter than
// the platforms. MakerWorld's .3mf path takes a Bambu Studio project file in a
// slot labelled "Bambu Studio File (Print Profile)" and slices it server-side on
// submit, generating the plates, print time and printer compatibility itself
// (makerworld-web-flow.md, live publish 2026-06-20). Its documented publish
// requirements are a profile name, at least one profile picture and the
// guidelines tick. Nothing there asks for G-code in the file.
//
// The old rule made an unsliced Bambu project unpublishable in a way the app
// could not explain: MakerWorld's readiness demanded a configured print profile
// because it saw a `.3mf`, while the Profiles step refused to create one because
// the archive carried no plates, so the blocker had no screen that could clear
// it.
import { fileExt } from './format.js';

/**
 * True when `file` should own a print-profile record.
 *
 * A sliced project of any slicer qualifies, because its settings are real and
 * every platform that accepts profiles can use them. An unsliced project
 * qualifies only when Bambu Studio wrote it, because MakerWorld is the platform
 * that slices for you; an unsliced 3MF from anywhere else is ordinary geometry
 * and belongs in the model files.
 */
export function fileTakesPrintProfile(file) {
  if (!file || fileExt(file.name) !== '3mf') return false;
  const scan = file.threemf;
  if (!scan) return false;
  if (scan.sliced) return true;
  return scan.slicer === 'bambu';
}

/**
 * True while a profile should survive a re-scan.
 *
 * A file whose archive has not been read yet keeps whatever it has: dropping the
 * record mid-scan would wipe a name and photos the person had already typed.
 */
export function fileKeepsPrintProfile(file) {
  if (!file) return false;
  if (!file.threemf?.scanned) return true;
  return fileTakesPrintProfile(file);
}
