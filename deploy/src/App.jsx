import React, { useState, useRef, useEffect, useCallback, useMemo, useReducer, createContext, useContext, useSyncExternalStore } from 'react';
import {
  mdToHtml, mdToPlain, mdToMakerWorldHtml, formatBytes,
  fileExt, isModelFile, isProfile, isImageFile, slugify, uniqueFileName,
} from './lib/format';
import {
  MAKERWORLD_REGULAR_FORMATS, MAKERWORLD_LASER_FORMATS, MAKERWORLD_PRINTERS,
  compatibilityFromProducts, flattenMakerWorldCategories,
  isMakerWorldLaserFile, isMakerWorldRegularFile, makerWorldFilesForMode,
  makerWorldLicenseAllowsRemix, makerWorldPrimaryProfile, makerWorldPublishIssues, readLacMetadata,
} from './lib/makerworld.js';
import { makerWorldResponseError, uploadMakerWorldFile } from './lib/makerworld-upload.js';
import {
  DESKTOP_MAKERWORLD_SECRET,
  isDesktopMakerWorldSession,
  makerWorldFetch,
} from './lib/makerworld-auth.js';
import {
  DESKTOP_PRINTABLES_SECRET,
  isDesktopPrintablesSession,
  printablesFetch,
} from './lib/printables-auth.js';
import {
  cultsFetch,
  desktopCultsAccountId,
  desktopCultsSecret,
  isDesktopCultsSession,
} from './lib/cults-auth.js';
import {
  DESKTOP_NEXPRINT_SECRET,
  isDesktopNexprintSession,
  nexprintFetch,
} from './lib/nexprint-auth.js';
import { nexprintResponseError, uploadNexprintFile } from './lib/nexprint-upload.js';
import {
  DESKTOP_CREALITY_SECRET,
  crealityFetch,
  isDesktopCrealitySession,
} from './lib/creality-auth.js';
import { crealityResponseError, uploadCrealityFile } from './lib/creality-upload.js';
import { fileSlicer, parseThreeMF, slicerLabel, SLICERS } from './lib/threemf.js';
import { isFileExcluded, toggleExcludedFileId, withoutExcluded } from './lib/platform-files.js';
import {
  describeDue, dueReleasePlans, dueScheduledTargets, loadReleasePlans, patchReleasePlan,
  pendingReleasePlans, planForProjectPlatform, releasePlanIssues, removeReleasePlan,
  saveReleasePlans, unnotifiedDuePlans, upsertReleasePlan,
} from './lib/release-plan.js';
import {
  CREALITY_CATEGORIES,
  CREALITY_INSTRUCTION_FORMATS,
  CREALITY_LICENSE_MAP,
  CREALITY_LICENSES,
  CREALITY_MODEL_FORMATS,
  crealityRawModelFiles,
  crealityUsesRenderedModelCover,
} from './lib/creality.js';
import {
  DESKTOP_MAKERONLINE_SECRET,
  isDesktopMakerOnlineSession,
  makerOnlineFetch,
} from './lib/makeronline-auth.js';
import { makerOnlineResponseError, uploadMakerOnlineFile } from './lib/makeronline-upload.js';
import { DESKTOP_MAKEROAD_SECRET, isDesktopMakerRoadSession, makerRoadFetch } from './lib/makeroad-auth.js';
import { makerRoadResponseError, uploadMakerRoadFile } from './lib/makeroad-upload.js';
import { MAKEROAD_DOCUMENT_FORMATS, MAKEROAD_LICENSES, MAKEROAD_MODEL_FORMATS, normalizeMakerRoadCategoryPath } from './lib/makeroad.js';
import { DESKTOP_THANGS_SECRET, isDesktopThangsSession, thangsFetch } from './lib/thangs-auth.js';
import { thangsResponseError, uploadThangsFile } from './lib/thangs-upload.js';
import { flattenThangsCategories, selectThangsSourceFiles, THANGS_CATEGORIES } from './lib/thangs.js';
import { DESKTOP_THINGIVERSE_SECRET, isDesktopThingiverseSession, thingiverseFetch } from './lib/thingiverse-auth.js';
import { thingiverseResponseError, uploadThingiverseFile } from './lib/thingiverse-upload.js';
import { THINGIVERSE_CATEGORIES, THINGIVERSE_LICENSES } from './lib/thingiverse.js';
import {
  DESKTOP_MYMINIFACTORY_SECRET,
  isDesktopMyMiniFactorySession,
  myMiniFactoryFetch,
} from './lib/myminifactory-auth.js';
import { myMiniFactoryResponseError, uploadMyMiniFactoryFile } from './lib/myminifactory-upload.js';
import {
  flattenMyMiniFactoryCategories,
  myMiniFactoryObjectUrl,
  MYMINIFACTORY_CATEGORY_TREE,
  verifyMyMiniFactoryObjectState,
  waitForMyMiniFactoryReadback,
} from './lib/myminifactory.js';
import {
  flattenMakerOnlineCategories,
  MAKERONLINE_DOCUMENT_FORMATS,
  MAKERONLINE_LICENSE_MAP,
  MAKERONLINE_LICENSES,
  MAKERONLINE_MODEL_FORMATS,
} from './lib/makeronline.js';
import {
  printablesResponseError,
  uploadPrintablesFile,
  waitForPrintablesUploads,
} from './lib/printables-upload.js';
import {
  applyPrintablesFileSettings,
  buildPrintablesSummary,
  normalizePrintablesTags,
  parsePrintablesRemixSource,
  PRINTABLES_FILE_NOTE_MAX,
  PRINTABLES_FOLDER_NAME_MAX,
  PRINTABLES_PRICE_MIN,
  PRINTABLES_PRICE_MAX,
  printablesFileSettingIssues,
  printablesPaidIssues,
  publishVerifiedPrintablesModel,
  printablesReadbackMismatches,
  validatePrintablesModel,
  waitForPrintablesPublication,
} from './lib/printables-model.js';
import {
  advancePublishBatch,
  appendPublishBatchResourceSample,
  batchPublishIntent,
  createPublishBatch,
  createPublishBatchResourceReport,
  DESKTOP_PUBLISH_CONCURRENCY,
  LIVE_PUBLISH_PLATFORM_IDS,
  loadRetainedPublishBatchResourceReports,
  orderedPlatformImages,
  publishBatchResourceRequest,
  publishBatchResourceSummary,
  publishBatchSummary,
  publishReceiptLabel,
  retainPublishBatchResourceReport,
  retryFailedPublishBatch,
} from './lib/batch-publish.js';
import { convertHeicFileToJpeg, isHeicFile } from './lib/heic.js';
import {
  addFallbackProvider,
  AI_PROVIDER_IDS,
  AI_PROVIDERS,
  aiChain,
  chainFailureMessage,
  checkCloudProvider,
  detectProviders,
  providerSettings,
  readAiConfig,
  removeProvider,
  runListingChain,
  setPrimaryProvider,
  updateProviderSettings,
  writeAiConfig,
} from './lib/ai-providers.js';
import {
  cultsGalleryVideos,
  GALLERY_IMAGE_ACCEPT,
  isGalleryVideoFile,
  makerWorldVideo,
  makerWorldVideoIssues,
  makerWorldVideoReadbackIssues,
  readVideoDuration,
} from './lib/gallery-media.js';
import makerWorldCategoryTree from './data/makerworld-categories.json';
import makerWorldForbiddenWords from './data/makerworld-forbidden-words.json';
import {
  Upload, Download, Copy, Image as ImageIcon, FileText, Check, Sparkles,
  Folder, Send, Star, X, Plus, Trash2, ChevronRight, ChevronDown, ChevronUp,
  AlertCircle, Layers, FileCheck, Loader, Save, Bookmark, Search, Clock,
  Globe, DollarSign, Info, Edit3, ArrowRight, User, LogOut, Settings,
  PanelLeftClose, PanelLeftOpen, Video, RefreshCw
} from 'lucide-react';
import {
  useAccounts, getAccounts, getActive, setStatus, CONNECTABLE, rehydrateDesktopAccount,
} from './lib/accounts.js';

// Lets any component open the Connections (accounts) modal without prop-threading.
const ConnectionsCtx = createContext(() => {});
const useOpenConnections = () => useContext(ConnectionsCtx);

// Build stamp (injected by vite.config.js) — shows exactly which version is running.
const BUILD_COMMIT = (typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'dev');
const BUILD_TIME = (typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '');
const BUILD_DATE_LABEL = BUILD_TIME
  ? new Date(BUILD_TIME).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Development build';
const BUILD_LABEL = BUILD_TIME
  ? `${BUILD_COMMIT} · ${BUILD_DATE_LABEL}`
  : BUILD_COMMIT;

// Polls the deployed version.json; shows a banner when a newer build is live so you
// always know whether the open app is the latest (important for the desktop app, which
// loads the cached website until refreshed).
function VersionBanner() {
  const [latest, setLatest] = useState(null);
  useEffect(() => {
    let alive = true;
    const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
    const check = () => fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(v => { if (alive && v) setLatest(v); }).catch(() => {});
    check();
    const id = setInterval(check, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  const stale = latest && BUILD_TIME && latest.time && latest.time > BUILD_TIME;
  if (!stale) return null;
  return (
    <button onClick={() => window.location.reload()} className="w-full text-center py-1.5 px-4 mp-mono text-[12px] uppercase tracking-[0.15em] flex items-center justify-center gap-2" style={{ background: '#1a7f37', color: '#fff' }}>
      <Loader size={12} /> New build available ({latest.commit}) — click to refresh
    </button>
  );
}

// =====================================================================
// PLATFORM CONFIGURATION (from research report, May 2026)
// =====================================================================

const UPLOAD_URLS = {
  makerworld:  'https://makerworld.com/en/my/models/publish?type=original',
  printables:  'https://www.printables.com/model/create',
  cults:       'https://cults3d.com/en/upload',
  mmf:         'https://www.myminifactory.com/upload/object',
  // 2026-08-03: /upload returns HTTP 500 even when signed in (verified against
  // an authenticated session). /create returns 200 and redirects to
  // /create/designs. Browser link only; the direct upload path is unaffected.
  thingiverse: 'https://www.thingiverse.com/create',
  // 2026-08-03, verified against a signed-in session by HTTP status, not by
  // rendered appearance: /3d-model/upload and /upload BOTH return 404 (the SPA
  // still renders a marketing shell, so the page looks fine). There is no
  // direct upload URL — uploading starts from the "Add new" button on My
  // Thangs, which is a button with no href. /mythangs returns 200.
  thangs:      'https://thangs.com/mythangs',
  nexprint:    'https://www.nexprint.com/en/upload',
  creality:    'https://www.crealitycloud.com/create-model-new?editType=editModel',
  makeronline: 'https://www.makeronline.com/en/upload',
  makeroad:    'https://www.makeroad.com/printable_3D_model/upload',
};

// How each platform expects tags pasted into its UI
const TAG_FORMATS = {
  makerworld:  { sep: ', ', hashtag: false },
  printables:  { sep: ', ', hashtag: false },
  cults:       { sep: ', ', hashtag: false },
  mmf:         { sep: ', ', hashtag: false },
  thingiverse: { sep: ' ',  hashtag: false }, // historically space-separated single words
  thangs:      { sep: ', ', hashtag: false },
  nexprint:    { sep: ', ', hashtag: false },
  creality:    { sep: ', ', hashtag: false },
  makeronline: { sep: ', ', hashtag: false },
  makeroad:    { sep: ', ', hashtag: false },
};

const CULTS_META_TAGS = [
  ['articulated', 'Articulated'], ['customizable', 'Customizable'], ['functional_part', 'Functional part'],
  ['hollow_model', 'Hollow model'], ['multicolor', 'Multicolor'], ['multi_material', 'Multi material'],
  ['no_support', 'No support'], ['print_in_place', 'Print in place'], ['remix', 'Remix'],
  ['resin_print', 'Resin print'], ['scale_model', 'Scale model'], ['scan', 'Scan'],
];

const NEXPRINT_MODEL_FORMATS = [
  '3ds', '3mf', 'amf', 'blend', 'dwg', 'dxf', 'elesat', 'f3d', 'f3z',
  'factory', 'fcstd', 'iges', 'ipt', 'obj', 'ply', 'py', 'rsdoc', 'scad',
  'shape', 'shapr', 'skp', 'sldasm', 'sldprt', 'slvs', 'step', 'stl',
  'stp', 'studio3', 'zpr', 'stpz',
];
const NEXPRINT_ATTACHMENT_FORMATS = [
  'ai', 'bgcode', 'cdr', 'csv', 'ctb', 'gcode', 'goo', 'ini', 'ino',
  'lys', 'lyt', 'pdf', 'svg', 'txt', 'zip',
];
const NEXPRINT_LICENSES = [
  { id: 0, name: 'CC BY' },
  { id: 1, name: 'CC BY-SA' },
  { id: 2, name: 'CC BY-NC' },
  { id: 3, name: 'CC BY-NC-SA' },
  { id: 4, name: 'CC BY-ND' },
  { id: 5, name: 'CC BY-NC-ND' },
  { id: 6, name: 'CC0' },
  { id: 7, name: 'Standard Digital File License' },
];
const NEXPRINT_LICENSE_MAP = {
  ccby: 0, ccbysa: 1, ccbync: 2, ccbyncsa: 3, ccbynd: 4, cc0: 6, standard: 7,
};

const MYMINIFACTORY_MODEL_FORMATS = [
  'x3g', 'gcode', 'stl', 'scad', 'fbx', '3dc', '3ds', 'ac', 'asc', 'bvh',
  'blend', 'geo', 'dae', 'dwf', 'dw', 'x', 'gra', 'mu', 'kmz', 'lwo', 'lwz',
  'flt', 'iv', 'osg', 'osgt', 'osgb', 'ive', 'ply', 'shp', 'vpk', 'wrl',
  'wrz', 'dxf', 'pdf', 'obj', 'sdf', 'mtl', '3mf', 'jpeg', 'step', 'skp',
  'thing', 'zup', 'amf', 'fcstd', 'f3d', 'bmp', 'glb', 'gltf', 'jpg', 'png',
  'chitubox', 'lyt', 'lys',
];
const MYMINIFACTORY_LICENSES = [
  { id: 1, name: 'CC0' },
  { id: 2, name: 'CC BY' },
  { id: 3, name: 'CC BY-SA' },
  { id: 4, name: 'CC BY-NC' },
  { id: 5, name: 'CC BY-NC-SA' },
  { id: 6, name: 'CC BY-ND' },
  { id: 7, name: 'CC BY-NC-ND' },
  { id: 8, name: 'MMF Exclusive · Remix · Commercial' },
  { id: 9, name: 'MMF Exclusive · Remix · Noncommercial' },
  { id: 10, name: 'MMF Exclusive · No remix · Commercial' },
  { id: 11, name: 'MMF Exclusive · No remix · Noncommercial' },
  { id: 13, name: 'MMF · Remix · Commercial' },
  { id: 14, name: 'MMF · Remix · Noncommercial' },
  { id: 15, name: 'MMF · No remix · Commercial' },
  { id: 16, name: 'MMF · No remix · Noncommercial' },
];

function formatTagsFor(platformId, tags) {
  const fmt = TAG_FORMATS[platformId] || { sep: ', ', hashtag: false };
  return tags.map(t => fmt.hashtag ? `#${t}` : t).join(fmt.sep);
}

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Platforms whose description box is a rich-text/WYSIWYG editor (not a raw-HTML
// or markdown field). Pasting HTML *source* into these shows literal tags, so we
// copy rendered content as rich text instead — paste keeps the formatting.
const RICH_TEXT_PLATFORMS = ['makerworld', 'printables', 'nexprint', 'creality', 'makeronline', 'mmf'];
function isRichTextPlatform(id) { return RICH_TEXT_PLATFORMS.includes(id); }

// Copy rendered HTML to the clipboard as rich text (with a plain-text fallback),
// so pasting into a WYSIWYG editor preserves headings/bold/lists.
async function copyRichText(html, plain) {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch (e) { /* fall through to plain text */ }
  try { await navigator.clipboard.writeText(plain); return true; } catch (e) { return false; }
}

// Copy plain text to clipboard, returning true only on confirmed success. Falls
// back to a hidden-textarea + execCommand for insecure contexts where the async
// Clipboard API is unavailable.
async function copyPlainText(text) {
  const value = text || '';
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (e) { /* fall through to legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

const PRINTABLES_FORMATS = ['3dm', '3ds', '3dxml', '3mf', 'ai', 'amf', 'asm', 'bgcode', 'blend', 'cdr', 'csv', 'ctb', 'dwg', 'dxf', 'easm', 'f3d', 'f3z', 'factory', 'fcstd', 'gcode', 'gif', 'heic', 'heif', 'iges', 'igs', 'ini', 'ino', 'ipt', 'jpeg', 'jpg', 'lys', 'lyt', 'obj', 'par', 'pdf', 'ply', 'png', 'prt', 'py', 'rsdoc', 'scad', 'shape', 'shapr', 'skp', 'sl1', 'sl1s', 'sldasm', 'sldprt', 'slvs', 'step', 'stl', 'stp', 'studio3', 'svg', 'txt', 'webp', 'zip', 'zpr'];

const PLATFORMS = [
  {
    id: 'makerworld', name: 'MakerWorld', org: 'Bambu Lab', dot: '#FF6900',
    covers: [
      { id: 'web', label: 'Web cover', w: 1920, h: 1440, aspect: '4:3' },
      { id: 'app', label: 'App cover', w: 1500, h: 2000, aspect: '3:4' },
    ],
    descFormat: 'html', maxImages: 16, maxFileMb: 200, maxTotalMb: 250,
    // Full accepted raw-model set (re-checked against the live form 2026-07-18).
    formats: MAKERWORLD_REGULAR_FORMATS,
    hasApi: true, apiSupport: 'oneclick', apiLive: true,
    fields: ['remix'], note: 'Largest audience. Real photo of print required. Connects Printables/Thingiverse for import.',
    // Verified from the live MakerWorld publish form.
    limits: { titleMax: 50, tagMax: 50, tagCharMax: 100 },
  },
  {
    id: 'printables', name: 'Printables', org: 'Prusa Research', dot: '#FA6831',
    covers: [{ id: 'cover', label: 'Original image', w: null, h: null, aspect: 'original' }],
    preserveOriginalImages: true,
    descFormat: 'html', maxImages: null, maxFileMb: 1024, maxTotalMb: null,
    formats: PRINTABLES_FORMATS,
    hasApi: true, apiSupport: 'oneclick', apiLive: true,
    fields: [], note: 'Real desktop upload through Printables’ first-party form contract. Drafts stay unpublished; Publish is public.',
    limits: { titleMax: 255, tagCharMax: 25, tagPattern: /^[a-z0-9\s]+$/, tagHint: 'lowercase letters, numbers and spaces' },
  },
  {
    id: 'cults', name: 'Cults3D', org: 'Independent', dot: '#F79E2E',
    covers: [{ id: 'cover', label: 'Original media', w: null, h: null, aspect: 'original' }],
    preserveOriginalImages: true,
    // Verified from Cults's web upload form (May 2026): 40 accepted file types,
    // 1 GB per file, images max 10 MB / 8000×8000 px, jpg/png/webp + webm/mp4 video.
    descFormat: 'markdown', maxImages: null, maxFileMb: 1024, maxTotalMb: null,
    formats: ['3ds', '3mf', 'ai', 'amf', 'bin', 'blend', 'bmp', 'curaprofile', 'dae', 'doc', 'dst', 'dwg', 'dxf', 'eps', 'f3d', 'f3z', 'fcstd', 'fff', 'gbr', 'gbx', 'gcode', 'ini', 'mtl', 'obj', 'pdf', 'ply', 'ppt', 'psd', 'rcp', 'scad', 'skp', 'sldasm', 'sldprt', 'step', 'stl', 'stp', 'svg', 'txt', 'x3d', 'zip'],
    hasApi: true, apiSupport: 'oneclick', apiLive: true,
    fields: ['price'], note: 'Direct desktop upload through Cults3D’s authenticated first-party Rails/S3 flow. Paid marketplace, 80% creator share. Accepts video (mp4/webm). Real-photo emphasis: place prints first in gallery.',
  },
  {
    id: 'mmf', name: 'MyMiniFactory', org: 'SoulCrafted', dot: '#4FB286',
    covers: [{ id: 'cover', label: 'Cover', w: 1920, h: 1440, aspect: '4:3' }],
    // The authenticated form exposes no image-count cap. Keep the verified
    // 100 MiB object-file cap, but do not invent a gallery limit.
    descFormat: 'html', maxImages: null, maxFileMb: 100, maxTotalMb: null,
    formats: MYMINIFACTORY_MODEL_FORMATS, hasApi: true, apiSupport: 'oneclick', apiLive: true,
    fields: [], note: 'Direct desktop upload through MyMiniFactory’s authenticated first-party form. Private is the safe default; public remains explicit and enters MyMiniFactory review.',
    limits: { tagMax: 20 },
  },
  {
    id: 'thingiverse', name: 'Thingiverse', org: 'Thingiverse', dot: '#248BFB',
    covers: [{ id: 'cover', label: 'Original image', w: null, h: null, aspect: 'original' }],
    preserveOriginalImages: true,
    descFormat: 'markdown', maxImages: null, maxFileMb: null, maxTotalMb: null,
    formats: ['stl', 'obj', '3mf', 'scad', 'jpg', 'jpeg', 'txt', 'amf', 'dae', '3ds', 'x3d', 'blend', 'ply', 'fcstd', 'dxf', 'ai', 'svg', 'cdr', 'ps', 'eps', 'epsi', 'sch', 'brd', 'png', 'gif', 'doc', 'docx'], hasApi: true, apiSupport: 'oneclick', apiLive: true,
    fields: [], note: 'Full draft/publish flow with files, media, taxonomy, license, optional metadata and readback. Draft is the safe default; public publish remains explicit.',
  },
  {
    id: 'thangs', name: 'Thangs', org: 'Physna', dot: '#3A86FF',
    covers: [{ id: 'cover', label: 'Original image', w: null, h: null, aspect: 'original' }],
    preserveOriginalImages: true,
    descFormat: 'html', maxImages: null, maxFileMb: null, maxTotalMb: null,
    formats: ['stl', '3mf', 'step', 'stp', 'obj', 'glb', 'fbx', 'blend', 'usdz', 'gltf'], hasApi: true, apiSupport: 'oneclick', apiLive: true,
    fields: [], note: 'Direct desktop upload through Thangs’ authenticated signed-storage flow. New uploads stay private unless public is explicitly selected.',
  },
  {
    id: 'nexprint', name: 'Nexprint', org: 'Elegoo', dot: '#FFB627',
    covers: [{ id: 'cover', label: 'Cover', w: 2000, h: 1500, aspect: '4:3' }],
    descFormat: 'html', maxImages: 10, maxFileMb: 2048, maxTotalMb: null,
    formats: NEXPRINT_MODEL_FORMATS, hasApi: true, apiSupport: 'oneclick', apiLive: true,
    fields: [], note: 'Direct desktop upload through Nexprint’s authenticated first-party web flow. Draft-first by default; videos are not accepted by the current form.',
    // Verified against the signed-in upload page and production front-end bundle on 2026-07-31.
    limits: { titleMax: 80, tagMax: 20, tagCharMax: 50, descMax: 10000 },
  },
  {
    id: 'creality', name: 'Creality Cloud', org: 'Creality', dot: '#E63946',
    covers: [
      { id: 'web', label: 'Web cover', w: 1600, h: 1200, aspect: '4:3' },
      { id: 'app', label: 'App cover', w: 1200, h: 1600, aspect: '3:4' },
    ],
    descFormat: 'html', maxImages: 10, maxFileMb: 2048, maxTotalMb: null,
    formats: CREALITY_MODEL_FORMATS, hasApi: true, apiSupport: 'oneclick', apiLive: true,
    fields: [], note: 'Direct desktop upload through Creality Cloud’s authenticated first-party web flow. Private-first for new uploads; existing drafts can be edited; public is explicit.',
    limits: { titleMax: 60, tagMax: 20 },
  },
  {
    id: 'makeronline', name: 'MakerOnline', org: 'Anycubic', dot: '#111827',
    covers: [{ id: 'cover', label: 'Cover', w: 1600, h: 1200, aspect: '4:3' }],
    descFormat: 'html', maxImages: 20, maxFileMb: 500, maxTotalMb: null,
    formats: MAKERONLINE_MODEL_FORMATS, hasApi: true, apiSupport: 'oneclick', apiLive: true,
    fields: [], note: 'Direct desktop upload through MakerOnline’s authenticated first-party web flow. Draft-first; public publishing is explicit. Supports raw models, documentation, and optional .3mf print profiles.',
    // Verified against the signed-in upload page and production Nuxt bundle on 2026-07-31.
    limits: { titleMax: 100, tagMax: 20, tagCharMax: 20, descMax: 9000 },
  },
  {
    id: 'makeroad', name: 'MakerRoad', org: 'ELEGOO', dot: '#7C3AED',
    // The live form recommends 1:1 but does not require a crop. Preserve the
    // creator's original image bytes/aspect and show the recommendation only.
    covers: [{ id: 'cover', label: 'Original image (1:1 recommended)', w: null, h: null, aspect: 'original' }],
    preserveOriginalImages: true,
    descFormat: 'html', maxImages: 10, maxFileMb: null, maxTotalMb: null,
    formats: MAKEROAD_MODEL_FORMATS, hasApi: true, apiSupport: 'oneclick', apiLive: true,
    fields: [], note: 'Direct desktop save through MakerRoad’s authenticated first-party flow. Private Save is the safe default; publishing is an explicit review submission. The current native form has no video field.',
    limits: { titleMax: 60 },
  },
];

// MakerWorld's live form counts "Model Pictures" separately from the two cover
// crops, while the other platforms' maxImages values include their cover.
function galleryCapacity(platform) {
  if (!Number.isFinite(platform.maxImages)) return Number.POSITIVE_INFINITY;
  return platform.id === 'makerworld' ? platform.maxImages : Math.max(0, platform.maxImages - 1);
}

// Cults3D, MyMiniFactory, Thingiverse and Thangs expose NO documented
// title/tag length caps (their APIs declare the fields as bare strings). We deliberately
// leave their `limits` unset rather than invent numbers — so they impose no cap until a
// value is verified from their authenticated upload form (same approach as the MW capture).

// Files a platform's upload flow would consider, before per-platform exclusions.
// Mirrors what each flow's own format filter accepts, so the Platforms-step file
// picker shows exactly the set that would otherwise upload.
const FORMAT_FILTERED_PLATFORM_IDS = new Set(['printables', 'nexprint', 'creality', 'makeronline', 'mmf', 'makeroad', 'thangs']);
export function platformCandidateFiles(platform, project) {
  return FORMAT_FILTERED_PLATFORM_IDS.has(platform.id)
    ? project.files.filter((file) => platform.formats.includes(fileExt(file.name)) && !file.isImage)
    : project.files.filter((f) => f.isModel);
}

// --- Release plans (reminders + scheduled uploads) ---------------------------
// A tiny subscribable store over localStorage so the Platforms cards, the
// Publish queue and the root scheduler all see one consistent list without
// prop-drilling. Scheduled publishes run only while the app is open.
export const releasePlanStore = (() => {
  const storage = typeof window !== 'undefined' ? window.localStorage : null;
  let plans = loadReleasePlans(storage);
  const listeners = new Set();
  return {
    get: () => plans,
    set(next) {
      plans = next;
      saveReleasePlans(storage, plans);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
})();
function useReleasePlans() {
  return useSyncExternalStore(releasePlanStore.subscribe, releasePlanStore.get, releasePlanStore.get);
}
function notifyReleasePlan(plan) {
  if (typeof Notification === 'undefined') return;
  const show = () => new Notification(`ModelPrep: ${plan.platformName || plan.platformId} release due`, {
    body: `${plan.projectTitle} — ${plan.mode === 'scheduled' ? 'scheduled publish is starting from the Publish step' : 'time to publish'}${plan.note ? ` (${plan.note})` : ''}`,
  });
  try {
    if (Notification.permission === 'granted') show();
    else if (Notification.permission !== 'denied') Notification.requestPermission().then((perm) => { if (perm === 'granted') show(); });
  } catch { /* notifications are best-effort */ }
}

// The binding limit for a shared field across several targets is the STRICTEST (min) of the
// targeted platforms that actually declare one. Returns {titleMax, titleMaxBy, ...}.
function effectiveLimits(platforms) {
  const out = {};
  for (const key of ['titleMax', 'tagMax', 'tagCharMax', 'descMax']) {
    let min = null, by = null;
    for (const p of platforms) {
      const v = p.limits?.[key];
      if (typeof v === 'number' && (min === null || v < min)) { min = v; by = p.name; }
    }
    if (min !== null) { out[key] = min; out[`${key}By`] = by; }
  }
  return out;
}

const CATEGORIES = [
  'Home & Living', 'Tools', 'Toys & Games', 'Hobby & DIY', 'Art & Decor',
  'Fashion & Jewelry', 'Electronics & Tech', 'Outdoor & Garden', 'Educational',
  'Miniatures & Tabletop', 'Cosplay & Props', 'Holiday & Seasonal', 'Other',
];

const LICENSES = [
  { id: 'cc0', name: 'CC0 — Public Domain', commercial: true, derivatives: true },
  { id: 'ccby', name: 'CC BY — Attribution', commercial: true, derivatives: true },
  { id: 'ccbysa', name: 'CC BY-SA — Attribution, ShareAlike', commercial: true, derivatives: true },
  { id: 'ccbync', name: 'CC BY-NC — Attribution, NonCommercial', commercial: false, derivatives: true },
  { id: 'ccbyncsa', name: 'CC BY-NC-SA — NonCommercial, ShareAlike', commercial: false, derivatives: true },
  { id: 'ccbynd', name: 'CC BY-ND — Attribution, NoDerivatives', commercial: true, derivatives: false },
  { id: 'standard', name: 'Standard Digital License (paid)', commercial: true, derivatives: false },
];

const SECTIONS = [
  { id: 'files',     label: 'Files',     icon: Folder,    description: 'Upload your STL and 3MF files' },
  { id: 'details',   label: 'Details',   icon: FileText,  description: 'Title, description, tags, category, license' },
  { id: 'images',    label: 'Images',    icon: ImageIcon, description: 'Cover, gallery photos and compatible model videos' },
  { id: 'profiles',  label: 'Profiles',  icon: Layers,    description: 'Print profile per 3MF, with own description' },
  { id: 'platforms', label: 'Platforms', icon: Globe,     description: 'Choose where to publish and platform-specific options' },
  { id: 'publish',   label: 'Publish',   icon: Send,      description: 'Publish once to selected platforms or individually' },
];

const SAMPLE_DESCRIPTION = `# Articulating Desk Dragon

A snap-fit dragon that prints in place.

No supports, no glue, no shame.

## What's included

- STL files for both sizes (S, M)
- A 3MF with my recommended Bambu profile
- Print orientation diagram

## Print settings

**Layer height:** 0.2mm
**Infill:** 15% gyroid
**Supports:** None needed
**Wall loops:** 3

## Tips

If the joints are too tight after printing, give them a gentle wiggle. The clearance is tuned for a 0.4mm nozzle. For 0.6mm nozzles, scale to 105%.`;

// =====================================================================
// HELPERS
// =====================================================================

function cropToCanvas(img, targetW, targetH, focal) {
  const c = document.createElement('canvas');
  c.width = targetW; c.height = targetH;
  const ctx = c.getContext('2d');
  const srcA = img.naturalWidth / img.naturalHeight;
  const tgtA = targetW / targetH;
  let sx, sy, sw, sh;
  if (srcA > tgtA) { sh = img.naturalHeight; sw = sh * tgtA; sy = 0; sx = (img.naturalWidth - sw) * focal.x; }
  else { sw = img.naturalWidth; sh = sw / tgtA; sx = 0; sy = (img.naturalHeight - sh) * focal.y; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return c;
}
function downloadCanvas(c, filename) {
  c.toBlob(b => {
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(u);
  }, 'image/jpeg', 0.92);
}
// Mock 3MF parser: real parsing needs JSZip; for prototype we generate believable profiles
function mockParseThreeMF(filename) {
  const printers = ['Bambu A1 Mini', 'Bambu P1S', 'Bambu X1C', 'Prusa MK4', 'Elegoo Centauri Carbon'];
  const materials = ['PLA', 'PETG', 'PLA Silk', 'ABS', 'PLA Matte'];
  const layers = ['0.08mm', '0.12mm', '0.16mm', '0.2mm', '0.28mm'];
  const seed = filename.length;
  return {
    printer: printers[seed % printers.length],
    material: materials[(seed + 1) % materials.length],
    layerHeight: layers[(seed + 2) % layers.length],
    plates: 1 + (seed % 3),
    estimatedTime: `${1 + (seed % 8)}h ${(seed * 7) % 60}min`,
    filamentGrams: 20 + (seed % 80),
  };
}

function makeSampleImage(label = 'SAMPLE', tint = ['#FF5722', '#FFB627', '#1A1A1A']) {
  const c = document.createElement('canvas');
  c.width = 2400; c.height = 1800;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, tint[0]); g.addColorStop(0.5, tint[1]); g.addColorStop(1, tint[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(c.width * (0.15 + i * 0.1), c.height * (0.3 + (i % 3) * 0.15), 120 + i * 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = 'bold 260px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, c.width / 2, c.height / 2 - 50);
  ctx.font = '60px monospace';
  ctx.fillText('2400 × 1800', c.width / 2, c.height / 2 + 160);
  return c.toDataURL('image/jpeg', 0.9);
}

function loadImageFromDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Lazy-load JSZip from the bundle (code-split into its own chunk) on first use.
// Bundled rather than CDN-loaded so the core download feature never depends on
// a third-party CDN being reachable. Cached after first load.
let _jszipPromise = null;
function loadJSZip() {
  if (_jszipPromise) return _jszipPromise;
  _jszipPromise = import('jszip')
    .then(m => m.default || m)
    .catch(err => { _jszipPromise = null; throw new Error('Could not load the ZIP library. Reload the page and try again.'); });
  return _jszipPromise;
}

function canvasToBlob(canvas, quality = 0.92) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}


function generateMetadataText(platform, project, platformState, tagString) {
  const license = (typeof LICENSES !== 'undefined'
    ? LICENSES.find(l => l.id === project.license)?.name
    : project.license) || project.license;
  const descExt = platform.descFormat === 'markdown' ? 'md' : platform.descFormat === 'html' ? 'html' : 'txt';
  const lines = [
    `# Upload package for ${platform.name}`,
    `# Generated by ModelPrep`,
    `# ${new Date().toISOString()}`,
    ``,
    `TITLE`,
    project.title,
    ``,
    `CATEGORY`,
    project.category,
    ``,
    `LICENSE`,
    license,
    ``,
    `TAGS (${platform.id === 'thingiverse' ? 'space-separated' : 'comma-separated'})`,
    tagString,
    ``,
    `DESCRIPTION (${platform.descFormat})`,
    `// see description.${descExt} for the full text`,
    ``,
  ];
  if (platformState.price !== undefined) {
    lines.push(`PRICE`, platformState.free ? 'Free' : `$${platformState.price.toFixed(2)} USD`, ``);
  }
  if (platformState.contestEntry) {
    lines.push(`CONTEST ENTRY`, platformState.contestEntry, ``);
  }
  if (platformState.remix) {
    lines.push(`REMIX`, 'YES: link the original in the description', ``);
  }
  return lines.join('\n');
}

function generateReadme(platform, project, descExt, imageCount, fileCount) {
  const uploadUrl = (typeof UPLOAD_URLS !== 'undefined' ? UPLOAD_URLS[platform.id] : '') || '';
  const originalMedia = !!platform.preserveOriginalImages;
  const galleryVideos = platform.id === 'cults' ? cultsGalleryVideos(project.media || []) : [];
  const lines = [
    `${platform.name.toUpperCase()} UPLOAD PACKAGE`,
    '='.repeat(40),
    '',
    `Generated by ModelPrep / MakerStats Studio`,
    new Date().toISOString(),
    '',
    `MODEL:       ${project.title}`,
    `TARGET:      ${platform.name} (${platform.org})`,
    `UPLOAD URL:  ${uploadUrl}`,
    '',
    `WHAT IS IN THIS FOLDER`,
    '-'.repeat(40),
    originalMedia
      ? `- 1 original cover image, named 01_cover_original.*`
      : `- ${platform.covers.length} cover image(s), named 01_cover_*.jpg`,
    originalMedia
      ? `- ${Math.min(Math.max(0, imageCount - 1), galleryCapacity(platform))} original gallery image(s), retaining their source formats`
      : `- ${Math.min(Math.max(0, imageCount - 1), galleryCapacity(platform))} gallery image(s), named 02_gallery_*.jpg, 03_gallery_*.jpg, ...`,
    ...(galleryVideos.length ? [`- gallery_media/ folder with ${galleryVideos.length} typed video file(s)`] : []),
    isRichTextPlatform(platform.id)
      ? `- description.html (rendered — open in a browser, select all, copy, then paste into ${platform.name}'s visual editor; do NOT paste the raw HTML)`
      : `- description.${descExt} (in ${platform.descFormat} format, ready to paste)`,
    `- metadata.txt (title, category, tags, license, all paste-ready)`,
    `- files/ folder with ${fileCount} model file(s)`,
    ...((project.profiles || []).some(p => !p.useMainCover && p.coverImageId)
      ? [`- profile_covers/ folder — a per-profile cover image for each 3MF that has its own`]
      : []),
    '',
    `UPLOAD STEPS`,
    '-'.repeat(40),
    `1. Open ${uploadUrl} in your browser.`,
    `2. Drag the contents of the files/ folder into the model files slot.`,
    originalMedia
      ? `3. Drag 01_cover_original.* into the cover image slot.`
      : `3. Drag 01_cover_*.jpg into the cover image slot.`,
    `4. Drag the gallery images (02_*, 03_*, ...) into the gallery, in order.`,
    `5. Open metadata.txt, copy and paste the title field.`,
    isRichTextPlatform(platform.id)
      ? `6. Open description.html in a browser, select all, copy, paste into the description editor — formatting is preserved. (Do NOT paste raw HTML; ${platform.name}'s editor shows the tags.)`
      : `6. Open description.${descExt}, select all, copy, paste into description.`,
    `7. Copy tags from metadata.txt into the tags field.`,
    `8. Pick the closest category match and the license listed.`,
  ];
  if (platform.id === 'makerworld') {
    lines.push('9. MakerWorld requires at least one image of an actual printed object.');
  }
  if (platform.id === 'mmf') {
    lines.push('9. MyMiniFactory will test-print before publishing. Expect 1 to 3 day delay.');
  }
  if (platform.id === 'nexprint') {
    lines.push('9. Submit to a contest in the Contests section if applicable.');
  }
  if (platform.id === 'cults' || platform.id === 'mmf') {
    lines.push('10. Set price (free or paid) per the value listed in metadata.txt.');
  }
  lines.push('', 'Final step: click Submit / Publish on the platform.');
  return lines.join('\n');
}

// Build one platform's complete upload package as a zip Blob. Single source of
// truth for the export (was duplicated in BatchZipButton + PlatformPackageCard).
// onProgress(msg) is called with human-readable progress strings.
async function buildPlatformZip(JSZip, platform, project, cover, onProgress = () => {}) {
  const zip = new JSZip();
  let counter = 1;
  const main = platform.covers[0];

  // 1. Main cover(s) cropped to each of the platform's cover dimensions.
  if (cover) {
    if (platform.preserveOriginalImages) {
      onProgress('Adding original cover');
      const blob = await fetch(cover.dataUrl).then((response) => response.blob());
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      zip.file(`${String(counter++).padStart(2, '0')}_cover_original.${ext}`, blob);
    } else {
      onProgress('Cropping cover');
      const coverImg = await loadImageFromDataUrl(cover.dataUrl);
      for (const c of platform.covers) {
        const canvas = cropToCanvas(coverImg, c.w, c.h, cover.focal);
        const blob = await canvasToBlob(canvas);
        const label = platform.covers.length > 1 ? `cover_${c.id}` : 'cover';
        zip.file(`${String(counter++).padStart(2, '0')}_${label}_${c.w}x${c.h}.jpg`, blob);
      }
    }
  }

  // 2. Gallery images (cover excluded), capped at the platform's max.
  const others = project.images.filter(i => i.id !== project.coverImageId);
  const galleryLimit = Math.min(others.length, galleryCapacity(platform));
  for (let i = 0; i < galleryLimit; i++) {
    if (platform.preserveOriginalImages) {
      onProgress(`Adding original gallery ${i + 1}/${galleryLimit}`);
      const blob = await fetch(others[i].dataUrl).then((response) => response.blob());
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      zip.file(`${String(counter++).padStart(2, '0')}_gallery_${String(i + 1).padStart(2, '0')}_original.${ext}`, blob);
    } else {
      onProgress(`Cropping gallery ${i + 1}/${galleryLimit}`);
      const galImg = await loadImageFromDataUrl(others[i].dataUrl);
      const canvas = cropToCanvas(galImg, main.w, main.h, others[i].focal);
      const blob = await canvasToBlob(canvas);
      zip.file(`${String(counter++).padStart(2, '0')}_gallery_${String(i + 1).padStart(2, '0')}_${main.w}x${main.h}.jpg`, blob);
    }
  }

  // Cults3D keeps videos as ordered illustration media; never squeeze them
  // through the image crop pipeline or send WebM to incompatible platforms.
  const galleryVideos = platform.id === 'cults' ? cultsGalleryVideos(project.media || []) : [];
  if (galleryVideos.length) {
    const mediaFolder = zip.folder('gallery_media');
    for (const video of galleryVideos) if (video.blob) mediaFolder.file(video.name, video.blob);
  }

  // 3. Per-profile covers — each 3MF profile that opted for its own image.
  const profileCovers = (project.profiles || []).filter(p => !p.useMainCover && p.coverImageId);
  if (profileCovers.length) {
    const pfolder = zip.folder('profile_covers');
    for (const prof of profileCovers) {
      const pimg = project.images.find(im => im.id === prof.coverImageId);
      if (!pimg) continue;
      if (platform.preserveOriginalImages) {
        onProgress(`Adding original profile cover: ${prof.name}`);
        const blob = await fetch(pimg.dataUrl).then((response) => response.blob());
        const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        pfolder.file(`${slugify(prof.name) || 'profile'}_original.${ext}`, blob);
      } else {
        onProgress(`Cropping profile cover: ${prof.name}`);
        const loaded = await loadImageFromDataUrl(pimg.dataUrl);
        const canvas = cropToCanvas(loaded, main.w, main.h, pimg.focal);
        const blob = await canvasToBlob(canvas);
        pfolder.file(`${slugify(prof.name) || 'profile'}_${main.w}x${main.h}.jpg`, blob);
      }
    }
  }

  // 4. Description in the platform's format.
  onProgress('Writing description');
  const descExt = platform.descFormat === 'markdown' ? 'md' : platform.descFormat === 'html' ? 'html' : 'txt';
  const desc = platform.descFormat === 'markdown' ? project.description
    : platform.descFormat === 'html' ? mdToHtml(project.description)
    : mdToPlain(project.description);
  zip.file(`description.${descExt}`, desc);

  // 5. Metadata + README.
  const platformState = project.platforms[platform.id];
  const tagString = formatTagsFor(platform.id, project.tags);
  zip.file('metadata.txt', generateMetadataText(platform, project, platformState, tagString));
  zip.file('README.txt', generateReadme(platform, project, descExt, project.images.length, project.files.length));

  // 6. Model files.
  if (project.files.length) {
    const folder = zip.folder('files');
    for (const f of project.files) if (f.blob) folder.file(f.name, f.blob);
  }

  // 7. Compress.
  onProgress('Compressing 0%');
  return zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (m) => onProgress(`Compressing ${m.percent.toFixed(0)}%`)
  );
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =====================================================================
// MAIN COMPONENT
// =====================================================================

// Per-platform MakerWorld options — live in project.platforms.makerworld so they're
// edited on the Platforms step and read by the Publish flow (serializable; File-based
// docs are kept in a small runtime holder, see mwRuntimeDocs).
const MW_DEFAULT_OPTS = {
  categoryId: 401, visibility: 'private', license: '', // '' = follow the Details-step license (see MW_LICENSE_MAP)
  productMode: '3d', laserMode: 'raw', modelSource: 'original',
  exclusive: false, exclusiveTermsAccepted: false, communityPost: false,
  remixModel: null, remixUrl: '', remixLicense: '', remixDescription: '', relatedModel: null,
  primaryProfileFileId: null, primaryLacFileId: null, cyberBrick: false,
  laserInfo: { machineName: '', processTypes: '', materialIds: '', otherTools: '', compatibleDevices: '' },
  laserProfile: { title: '', description: '', visibility: 'private', useMainCover: true, coverImageId: null, photoIds: [] },
  boms: { kits: [], filaments: [], materials: [] }, otherParts: [],
};
// Runtime-only holder for File-based MakerWorld docs (can't live in serializable project state).
const mwRuntimeDocs = { docGuides: [], docOthers: [] };
// CyberBrick files are also runtime-only File objects; the serializable toggle and
// descriptive fields stay in project.platforms.makerworld.
const mwRuntimeCyberBrick = { controlConfigs: [], motionConfigs: [], microPython: [], mainControlConfig: null };

// MakerWorld's license options as {label (UI), value (exact API `license` string)}.
// VERIFIED 2026-06-21 (browser-agent capture from the live license config module +
// PUT /my/draft/<id> round-trips): CC licenses use SHORT CODES (CC0/BY/BY-SA/…);
// SDFL/Exclusive use the full string. The backend derives all share/commercial flags
// from this single string (the four radio questions are just a UX affordance).
const MW_LICENSE_OPTIONS = [
  { label: 'Creative Commons Public Domain', value: 'CC0' },
  { label: 'Creative Commons Attribution', value: 'BY' },
  { label: 'Creative Commons Attribution-Share Alike', value: 'BY-SA' },
  { label: 'Creative Commons Attribution-NoDerivatives', value: 'BY-ND' },
  { label: 'Creative Commons Attribution-Noncommercial', value: 'BY-NC' },
  { label: 'Creative Commons Attribution-Noncommercial-Share Alike', value: 'BY-NC-SA' },
  { label: 'Creative Commons Attribution-Noncommercial-NoDerivatives', value: 'BY-NC-ND' },
  { label: 'Standard Digital File License', value: 'Standard Digital File License' },
  { label: 'MakerWorld Exclusive License', value: 'MakerWorld Exclusive License' },
  { label: 'Standard Digital File License - Community Use', value: 'Standard Digital File License - Community Use' },
  { label: 'Standard Digital File License - Platform Print Only (SDFL-PPO)', value: 'Standard Digital File License - Platform Print Only (SDFL-PPO)' },
];
// Our Details-step license id → the MakerWorld license API value.
const MW_LICENSE_MAP = {
  cc0: 'CC0', ccby: 'BY', ccbysa: 'BY-SA', ccbync: 'BY-NC', ccbyncsa: 'BY-NC-SA', ccbynd: 'BY-ND',
  standard: 'Standard Digital File License',
};
// Resolve the MakerWorld license: explicit override > mapped from Details > MakerWorld default.
const mwResolveLicense = (opts, project) => opts?.license || MW_LICENSE_MAP[project?.license] || 'Standard Digital File License';

const initialProject = {
  name: 'Untitled Project',
  files: [],
  images: [],
  media: [],
  coverImageId: null,
  title: '',
  description: '',
  category: '',
  tags: [],
  license: 'ccbync',
  profiles: [],
  platforms: {
    makerworld: { enabled: true, ...MW_DEFAULT_OPTS },
    printables: { enabled: true, publication: 'draft', categoryId: '', licenseId: '', summary: '', authorship: 'author', remixParents: [], remixDescription: '', nsfw: false, aiGenerated: null, politicalContent: false, zipMode: 'unzip', club: false, store: false, price: '', excludeCommercialUsage: false, capabilities: null },
    cults: { enabled: true, price: 0, free: true, visibility: 'secret', details: '', metaTags: [], madeWithAi: false, showComments: true },
    mmf: { enabled: true, publication: 'private', categoryIds: [], licenseId: 5, printingTips: '', timeFrom: '', timeTo: '', dimensions: '', dimensionsUnit: 0, technology: '', materialQuantity: '', supportFree: false, remix: false, remixParentIds: [], confirmOriginalNoAi: false },
    thingiverse: { enabled: true, publication: 'draft', summary: '', categoryId: '', license: 'cc-nc', aiGenerated: false, wip: false, customizable: false, remix: false, sourceThingId: '', nsfw: false, printSettings: {}, sections: [], education: null, termsAccepted: false },
    thangs: { enabled: true, publication: 'private', structure: 'single', units: 'mm', primaryFileId: '', category: '', allowRemix: true, aiGenerated: false, feedbackEnabled: true, folderId: '', workspaceId: '', resumeDraftId: '', accessTypeId: '', planIds: [], dependencies: [], versionNotes: '', marketplace: false, price: 0, license: 'CC BY-NC' },
    nexprint: {
      enabled: false,
      publication: 'draft',
      originalityType: 1,
      sourceUrl: '',
      sourceModelId: '',
      categoryId: '',
      licenseType: 2,
      nsfw: false,
      aiGenerated: false,
      hasBom: false,
      bom: [],
      collectionIds: [],
      activityIds: [],
      worldFirstRelease: false,
    },
    creality: {
      enabled: false,
      publication: 'private',
      categoryId: '',
      license: 'CC BY-NC',
      modelSource: 1,
      sourceUrl: '',
      nsfw: false,
    },
    makeronline: {
      enabled: false,
      publication: 'draft',
      source: 1,
      originalUrl: '',
      license: 3,
      categoryId: '',
      permission: 2,
      printMethod: 3,
      aiHelp: false,
      nsfw: false,
      includePrintProfile: true,
      printTitle: '',
      printDescription: '',
      relatedKits: false,
      storeKitIds: [],
      syncChina: false,
      exclusive: false,
    },
    makeroad: {
      enabled: false, publication: 'draft', uploadType: 1, referUrl: '', categoryIds: [],
      printMethods: ['FDM'], printerIds: [], materialIds: [], colorIds: [],
      licenseIndex: 2, aiGenerated: false, nsfw: false, visibility: 'private',
      scheduled: false, planTime: '', payType: 'free', payValue: 0, termsAccepted: false,
    },
  },
};

function mergePlatformDefaults(savedPlatforms = {}) {
  const merged = {};
  for (const [id, defaults] of Object.entries(initialProject.platforms)) {
    merged[id] = { ...defaults, ...(savedPlatforms?.[id] || {}) };
  }
  for (const [id, value] of Object.entries(savedPlatforms || {})) {
    if (!merged[id]) merged[id] = value;
  }
  return merged;
}

// --- Real upload test data ----------------------------------------------------
// A fully-populated, private/draft-first project for exercising the real desktop
// publishers. Loading it never uploads by itself; the Publish button remains the
// single explicit mutation boundary.
function buildDemoProject() {
  const tints = [
    ['#FF5722', '#FFB627', '#1A1A1A'],
    ['#3A86FF', '#4FB286', '#1A1A1A'],
    ['#FF6900', '#F79E2E', '#1A1A1A'],
    ['#9B5DE5', '#F15BB5', '#1A1A1A'],
  ];
  const labels = ['HERO RENDER', 'PRINTED', 'DETAIL', 'IN SCALE'];
  const images = tints.map((tint, i) => ({
    id: 'demoimg_' + i,
    dataUrl: makeSampleImage(labels[i], tint),
    naturalW: 2400, naturalH: 1800,
    focal: { x: 0.5, y: i % 2 ? 0.42 : 0.5 },
    alt: labels[i],
  }));
  const mkFile = (name, size, type) => ({
    id: 'demofile_' + name,
    name, size, type,
    isModel: isModelFile(name), isProfile: isProfile(name), isImage: isImageFile(name),
    isLaserCut: isMakerWorldLaserFile(name), makerWorld: { note: '', openSource: true, folderPath: '' },
    printables: { note: '', folder: '' },
    blob: new Blob([`ModelPrep demo placeholder — ${name}`], { type: type || 'application/octet-stream' }),
  });
  const files = [
    mkFile('desk-dragon-S.stl', 4_180_000, 'model/stl'),
    mkFile('desk-dragon-M.stl', 7_640_000, 'model/stl'),
    mkFile('desk-dragon-bambu.3mf', 9_220_000, 'model/3mf'),
  ];
  const profiles = files.filter(f => isProfile(f.name)).map(f => ({
    id: 'prof_' + f.id,
    fileId: f.id,
    name: f.name.replace(/\.3mf$/i, ''),
    description: 'Calibrated for Bambu A1 Mini, 0.4mm nozzle. Matte PLA, 0.2mm layers, 15% gyroid infill, no supports.',
    useMainCover: false,
    coverImageId: images[1].id,
    photoIds: [images[1].id, images[2].id],
    visibility: 'private',
    compatiblePrinters: [],
    realPhotoConfirmed: true,
    guidelinesAccepted: true,
    parsed: mockParseThreeMF('desk-dragon-bambu.3mf'),
  }));
  return {
    name: 'Articulating Desk Dragon (demo)',
    files,
    images,
    coverImageId: images[0].id,
    title: 'Articulating Desk Dragon — Print-in-Place',
    description: SAMPLE_DESCRIPTION,
    category: 'Toys & Games',
    tags: ['articulated', 'flexi', 'dragon', 'print-in-place', 'no-supports', 'desk-toy', 'fidget', 'fantasy'],
    license: 'ccbync',
    profiles,
    platforms: {
      makerworld: { enabled: true, ...MW_DEFAULT_OPTS },
      printables: { enabled: true, publication: 'draft', categoryId: '36', licenseId: '3', summary: 'A print-in-place articulated desk dragon with poseable wings and tail.', authorship: 'author', remixParents: [], remixDescription: '', nsfw: false, aiGenerated: false, politicalContent: false, zipMode: 'unzip', club: false, store: false, price: '', excludeCommercialUsage: false, capabilities: null },
      // Keep the cross-platform certification fixture free so the shared
      // CC BY-NC license remains valid on Cults. Paid Cults listings require
      // CULTS CU and are certified as a separate optional branch.
      cults: { enabled: true, price: 0, free: true, visibility: 'secret', details: '', metaTags: [], madeWithAi: false, showComments: true },
      mmf: { enabled: true, publication: 'private', categoryIds: [60, 462], licenseId: 5, printingTips: 'Print-in-place. No supports required.', timeFrom: 180, timeTo: 300, dimensions: '120 × 75 × 45', dimensionsUnit: 0, technology: 'FDM', materialQuantity: '45 g', supportFree: true, remix: false, remixParentIds: [], confirmOriginalNoAi: true },
      thingiverse: { enabled: true, publication: 'draft', summary: 'A print-in-place articulated desk dragon.', categoryId: '124', license: 'cc-nc', aiGenerated: false, wip: false, customizable: false, remix: false, sourceThingId: '', nsfw: false, printSettings: {}, sections: [], education: null, termsAccepted: false },
      thangs: {
        ...initialProject.platforms.thangs,
        enabled: true,
        publication: 'private',
        structure: 'single',
        primaryFileId: 'demofile_desk-dragon-S.stl',
        category: 'Toys & Games/Articulated',
        versionNotes: 'ModelPrep private single-part certification upload.',
      },
      nexprint: {
        enabled: true,
        publication: 'draft',
        originalityType: 1,
        sourceUrl: '',
        sourceModelId: '',
        categoryId: '1422473859006468',
        licenseType: 2,
        nsfw: false,
        aiGenerated: false,
        hasBom: true,
        bom: [{ materialName: 'PLA filament', materialNum: 1, materialRemark: 'Any color' }],
        collectionIds: [],
        activityIds: [],
        worldFirstRelease: false,
      },
      creality: {
        enabled: true,
        publication: 'private',
        categoryId: '6007',
        license: 'CC BY-NC',
        modelSource: 1,
        sourceUrl: '',
        nsfw: false,
      },
      makeronline: {
        enabled: true,
        publication: 'draft',
        source: 1,
        originalUrl: '',
        license: 3,
        categoryId: '104',
        permission: 2,
        printMethod: 3,
        aiHelp: false,
        nsfw: false,
        includePrintProfile: true,
        printTitle: 'Desk Dragon — Bambu A1 Mini',
        printDescription: '0.2 mm PLA profile with 15% gyroid infill and no supports.',
        relatedKits: false,
        storeKitIds: [],
        syncChina: false,
        exclusive: false,
      },
      makeroad: {
        ...initialProject.platforms.makeroad,
        enabled: true,
        publication: 'draft',
        categoryIds: [],
        categoryPaths: ["Games & Toys › Kids' Toys"],
        visibility: 'private',
      },
    },
    __testProject: true,
  };
}

// ---- Demo: bundled crop-focused assets ---------------------------------------
// A coherent landscape / portrait / square set makes the focal-point behavior obvious
// and stays deterministic offline. Each composition has useful landmarks near the edges,
// so switching between 4:3, 1:1, and 3:4 visibly changes what remains in frame.
const DEMO_IMAGE_ASSETS = [
  { file: 'desk-dragon-landscape.webp', alt: 'Desk dragon — wide workshop hero', focal: { x: 0.66, y: 0.38 } },
  { file: 'desk-dragon-portrait.webp', alt: 'Desk dragon — portrait product shot', focal: { x: 0.64, y: 0.34 } },
  { file: 'desk-dragon-detail.webp', alt: 'Desk dragon — print detail', focal: { x: 0.68, y: 0.36 } },
  { file: 'desk-dragon-rear.webp', alt: 'Desk dragon — rear articulation', focal: { x: 0.58, y: 0.30 } },
  { file: 'desk-dragon-hand-scale.webp', alt: 'Desk dragon — hand-held scale', focal: { x: 0.62, y: 0.30 } },
  { file: 'desk-dragon-wing-detail.webp', alt: 'Desk dragon — wing mechanism', focal: { x: 0.62, y: 0.34 } },
  { file: 'desk-dragon-tail-detail.webp', alt: 'Desk dragon — tail articulation', focal: { x: 0.68, y: 0.30 } },
  { file: 'desk-dragon-front.webp', alt: 'Desk dragon — front view', focal: { x: 0.50, y: 0.34 } },
  { file: 'desk-dragon-side.webp', alt: 'Desk dragon — side profile', focal: { x: 0.33, y: 0.32 } },
  { file: 'desk-dragon-printer-bed.webp', alt: 'Desk dragon — printer-bed context', focal: { x: 0.65, y: 0.36 } },
  { file: 'desk-dragon-overhead.webp', alt: 'Desk dragon — overhead articulation', focal: { x: 0.70, y: 0.30 } },
  { file: 'desk-dragon-measure.webp', alt: 'Desk dragon — dimensional scale', focal: { x: 0.68, y: 0.34 } },
  { file: 'desk-dragon-shelf.webp', alt: 'Desk dragon — shelf display', focal: { x: 0.27, y: 0.44 } },
  { file: 'desk-dragon-low-angle.webp', alt: 'Desk dragon — low-angle hero', focal: { x: 0.42, y: 0.34 } },
  { file: 'desk-dragon-rear-wings.webp', alt: 'Desk dragon — rear wing spread', focal: { x: 0.58, y: 0.40 } },
  { file: 'desk-dragon-material.webp', alt: 'Desk dragon — layer and material detail', focal: { x: 0.61, y: 0.30 } },
];

async function loadDemoImages() {
  const built = await Promise.all(DEMO_IMAGE_ASSETS.map(async (asset, i) => {
    try {
      const url = `${import.meta.env.BASE_URL}demo/${asset.file}`;
      const blob = await fetch(url).then((r) => { if (!r.ok) throw new Error('http ' + r.status); return r.blob(); });
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
      const img = await loadImageFromDataUrl(dataUrl);
      return {
        id: 'demoimg_' + i,
        dataUrl,
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        focal: asset.focal,
        alt: asset.alt,
        demoAsset: true,
      };
    } catch {
      const dataUrl = makeSampleImage(`PHOTO ${i + 1}`);
      return {
        id: 'demoimg_' + i,
        dataUrl,
        naturalW: 2400,
        naturalH: 1800,
        focal: asset.focal,
        alt: asset.alt,
        demoAsset: true,
      };
    }
  }));
  return built;
}

// A valid ASCII STL of a cube — a real, uploadable model file.
function makeCubeStl(s = 20) {
  const v = [[0,0,0],[s,0,0],[s,s,0],[0,s,0],[0,0,s],[s,0,s],[s,s,s],[0,s,s]];
  const faces = [[0,3,2],[0,2,1],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
  let out = 'solid modelprep_demo\n';
  for (const f of faces) {
    out += '  facet normal 0 0 0\n    outer loop\n';
    for (const idx of f) out += `      vertex ${v[idx][0]} ${v[idx][1]} ${v[idx][2]}\n`;
    out += '    endloop\n  endfacet\n';
  }
  out += 'endsolid modelprep_demo\n';
  return new Blob([out], { type: 'model/stl' });
}

// Build the bundled-asset patch for the demo: crop-focused images + real model files.
// MakerWorld's .3mf path REQUIRES a genuine Bambu-Studio 3mf ("not generated by
// Bambu Studio" → publish fails), and we can't synthesize one. So:
//   • if a real Bambu .3mf is bundled at public/demo/desk-dragon-bambu.3mf → use it (the
//     full print-profile flow is demoed AND a connected user can really publish it);
//   • otherwise → STL-only (drop the 3mf + profiles) so the real publish actually succeeds.
async function loadDemoAssets(base) {
  // Ten images exercise every crop while remaining inside MakerRoad's strict
  // 3–10 image window, so the same fixture can be sent to all destinations.
  const images = (await loadDemoImages()).slice(0, 10);
  const cover = images[0];
  const realMf = await fetch(`${import.meta.env.BASE_URL}demo/desk-dragon-bambu.3mf`)
    .then((r) => (r.ok ? r.blob() : null)).catch(() => null);

  let files, profiles;
  if (realMf) {
    files = base.files.map((f) => {
      if (/\.3mf$/i.test(f.name)) return { ...f, blob: realMf, size: realMf.size };
      if (/\.stl$/i.test(f.name)) { const stl = makeCubeStl(); return { ...f, blob: stl, size: stl.size }; }
      return f;
    });
    profiles = base.profiles.map((p) => ({ ...p, coverImageId: images[1]?.id || cover.id, photoIds: images.map((im) => im.id) }));
  } else {
    // No real Bambu 3mf available → STL-only so a connected user's real publish succeeds.
    files = base.files.filter((f) => !/\.3mf$/i.test(f.name)).map((f) => {
      if (/\.stl$/i.test(f.name)) { const stl = makeCubeStl(); return { ...f, blob: stl, size: stl.size }; }
      return f;
    });
    profiles = [];
  }
  return {
    images,
    coverImageId: cover.id,
    files,
    profiles,
    platforms: {
      ...base.platforms,
      makeronline: {
        ...base.platforms.makeronline,
        includePrintProfile: !!realMf,
      },
    },
  };
}

// --- Autosave (localStorage) -------------------------------------------------
// We persist only serializable METADATA — not files (File blobs) or image pixels
// (base64 dataUrls would blow the ~5MB quota). Restoring brings back the typed
// description, tags, category, license and per-platform settings; files/images
// are re-added by the user.
const AUTOSAVE_KEY = 'modelprep:autosave:v1';
const AUTOSAVE_HANDLED_KEY = 'modelprep:autosave:handled:v1';
function serializeProjectMeta(p) {
  return {
    name: p.name, title: p.title, description: p.description,
    tags: p.tags, category: p.category, license: p.license,
    platforms: p.platforms,
    savedAt: Date.now(),
  };
}

function canonicalAutosaveValue(value) {
  if (Array.isArray(value)) return value.map(canonicalAutosaveValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalAutosaveValue(value[key])]),
  );
}

function meaningfulPlatformSettings(platforms = {}) {
  const meaningful = {};
  for (const id of Object.keys(platforms || {}).sort()) {
    const settings = platforms[id];
    if (!settings || typeof settings !== 'object') continue;
    const defaults = initialProject.platforms[id] || {};
    const differences = {};
    for (const key of Object.keys(settings).sort()) {
      if (JSON.stringify(canonicalAutosaveValue(settings[key])) !== JSON.stringify(canonicalAutosaveValue(defaults[key]))) {
        differences[key] = settings[key];
      }
    }
    if (Object.keys(differences).length) meaningful[id] = differences;
  }
  return meaningful;
}

function autosaveFingerprint(saved) {
  if (!saved) return '';
  return JSON.stringify(canonicalAutosaveValue({
    version: 2,
    name: saved.name || '',
    title: saved.title || '',
    description: saved.description || '',
    tags: saved.tags || [],
    category: saved.category || '',
    license: saved.license || '',
    // Restoring merges newly introduced platform defaults into old snapshots.
    // Default-valued fields are not user edits and must not make the same
    // snapshot look new on the next launch.
    platforms: meaningfulPlatformSettings(saved.platforms),
  }));
}
function autosaveWasHandled(saved, handledFingerprint) {
  const fingerprint = autosaveFingerprint(saved);
  if (handledFingerprint === fingerprint) return true;
  // v1 stored the fingerprint object directly. Re-fingerprint it using the v2
  // canonical rules so upgrades do not resurrect an already handled prompt.
  try {
    const legacy = JSON.parse(handledFingerprint || 'null');
    if (legacy && !legacy.version && autosaveFingerprint(legacy) === fingerprint) {
      localStorage.setItem(AUTOSAVE_HANDLED_KEY, fingerprint);
      return true;
    }
  } catch (e) { /* malformed/old storage: offer recovery normally */ }
  return false;
}
function markAutosaveHandled(saved) {
  try {
    localStorage.setItem(AUTOSAVE_HANDLED_KEY, autosaveFingerprint(saved));
  } catch (e) { /* private mode */ }
}
function projectHasContent(p) {
  return !!(p.title || p.description || p.tags.length ||
    Object.values(p.platforms).some(pl => pl.price || pl.contestEntry || pl.remix));
}

// Single reducer for the whole project. All state transitions go through here so
// updates are centralized and an APPLY (functional) update always sees fresh
// state. `updateProject`/`setProject` below are thin dispatchers over it.
function projectReducer(state, action) {
  switch (action.type) {
    case 'SET':   return action.value;                  // full replace
    case 'PATCH': return { ...state, ...action.patch }; // shallow merge
    case 'APPLY': return action.updater(state);         // functional, fresh state
    default:      return state;
  }
}

// ── Folder import (pure-convention) ──────────────────────────────────────────
// Select/drop a folder and we infer a whole project from how it's organised — no
// manifest needed. Recognised purely by name + extension:
//   folder name             → title          title.txt        → title override
//   description.md / .txt    → description    (readme.md works too)
//   tags.txt / .csv          → tags (comma- or line-separated)
//   license.txt              → license (CC-BY-SA, CC0… mapped to our ids)
//   category.txt             → category (best-effort match to our list)
//   cover.*                  → cover image (else the first photo wins)
//   any image                → gallery (ordered by filename)
//   .stl/.3mf/.step/.obj…    → model files (3MF auto-become print profiles)
// Everything is optional; whatever's missing is REPORTED, never invented.

function prettifyFolderName(name) {
  return name.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapLicenseString(raw) {
  const s = (raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s) return null;
  if (s.includes('cc0') || s.includes('publicdomain')) return 'cc0';
  if (s.includes('byncsa')) return 'ccbyncsa';
  if (s.includes('bync')) return 'ccbync';
  if (s.includes('bysa')) return 'ccbysa';
  if (s.includes('bynd')) return 'ccbynd';
  if (s.includes('ccby') || s === 'by' || s === 'attribution') return 'ccby';
  if (s.includes('standard') || s.includes('paid')) return 'standard';
  return null;
}

function readFileText(file) {
  if (file.text) return file.text();
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result || ''); r.onerror = () => res(''); r.readAsText(file); });
}

async function buildImportImage(file, idx) {
  const dataUrl = await new Promise((res) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null);
    try { r.readAsDataURL(file); } catch { res(null); }
  });
  if (!dataUrl) return null;
  try {
    const img = await loadImageFromDataUrl(dataUrl);
    return { id: 'img_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 7),
      dataUrl, naturalW: img.naturalWidth, naturalH: img.naturalHeight, focal: { x: 0.5, y: 0.5 },
      alt: file.name.replace(/\.[^.]+$/, '') };
  } catch { return null; }
}

// Parse a flat FileList (webkitdirectory / dropped folder) → { patch, summary }.
async function importFolderToProject(fileList) {
  const rel = (f) => f.webkitRelativePath || f.name;
  const baseOf = (f) => rel(f).split('/').pop();
  const files = Array.from(fileList).filter(f => { const b = baseOf(f); return b && !b.startsWith('.'); });
  if (!files.length) return null;

  const rootName = rel(files[0]).split('/')[0] || 'Imported model';
  const meta = (f, re) => re.test(baseOf(f));
  const summary = { found: [], missing: [], warnings: [] };

  // Warn (don't silently merge) if this looks like a batch of several models.
  const topDirs = new Set();
  for (const f of files) { const p = rel(f).split('/'); if (p.length > 2) topDirs.add(p[1]); }
  const batchish = [...topDirs].filter(d => files.some(f => rel(f).startsWith(`${rootName}/${d}/`) && (isModelFile(baseOf(f)) || isImageFile(baseOf(f))))).length;
  if (batchish >= 2) summary.warnings.push(`${batchish} subfolders look like separate models — imported as ONE for now (batch import is coming next).`);

  const patch = {};
  const descFile  = files.find(f => meta(f, /^(description|readme)\.(md|markdown|txt)$/i));
  const titleFile = files.find(f => meta(f, /^title\.txt$/i));
  const tagsFile  = files.find(f => meta(f, /^tags\.(txt|csv|md)$/i));
  const licFile   = files.find(f => meta(f, /^licen[cs]e\.(txt|md)$/i));
  const catFile   = files.find(f => meta(f, /^category\.txt$/i));
  const consumed  = new Set([descFile, titleFile, tagsFile, licFile, catFile].filter(Boolean));

  patch.title = (titleFile ? (await readFileText(titleFile)).trim().split('\n')[0] : '') || prettifyFolderName(rootName);
  summary.found.push(`Title: “${patch.title}”${titleFile ? '' : ' (from folder name)'}`);

  if (descFile) { patch.description = (await readFileText(descFile)).trim(); summary.found.push(`Description (${patch.description.length} chars)`); }
  else summary.missing.push('Description — add description.md');

  if (tagsFile) {
    const tags = [...new Set((await readFileText(tagsFile)).split(/[\n,]/).map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean))];
    if (tags.length) { patch.tags = tags; summary.found.push(`${tags.length} tags`); }
  }
  if (!patch.tags) summary.missing.push('Tags — add tags.txt');

  if (licFile) { const id = mapLicenseString(await readFileText(licFile)); if (id) { patch.license = id; summary.found.push(`License: ${id}`); } else summary.warnings.push(`Couldn't read the license in ${baseOf(licFile)} — left default`); }
  if (catFile) {
    const want = (await readFileText(catFile)).trim().toLowerCase();
    const match = CATEGORIES.find(c => c.toLowerCase() === want) || CATEGORIES.find(c => want && c.toLowerCase().includes(want));
    if (match) { patch.category = match; summary.found.push(`Category: ${match}`); }
    else if (want) summary.warnings.push(`Category “${want}” didn't match — pick one in Details`);
  }
  if (!patch.category) summary.missing.push('Category — pick one in Details');

  // Images → gallery (cover first, then filename order).
  const imgs = files.filter(f => isImageFile(baseOf(f)));
  const coverFile = imgs.find(f => /^cover\./i.test(baseOf(f)));
  const ordered = [...imgs].sort((a, b) => rel(a).localeCompare(rel(b), undefined, { numeric: true }));
  const finalOrder = coverFile ? [coverFile, ...ordered.filter(f => f !== coverFile)] : ordered;
  const builtImages = (await Promise.all(finalOrder.map((f, i) => buildImportImage(f, i)))).filter(Boolean);
  if (builtImages.length) {
    patch.images = builtImages; patch.coverImageId = builtImages[0].id;
    summary.found.push(`${builtImages.length} photo${builtImages.length > 1 ? 's' : ''} (cover: ${baseOf(coverFile || finalOrder[0])})`);
  } else summary.missing.push('Photos — add images (MakerWorld needs a real print photo)');

  // Model + reference files (skip the meta text files we already consumed).
  const taken = new Set();
  const buildFiles = files
    .filter(f => !consumed.has(f) && (isModelFile(baseOf(f)) || isMakerWorldLaserFile(baseOf(f)) || PRINTABLES_FORMATS.includes(fileExt(baseOf(f))) || fileExt(baseOf(f)) === 'md'))
    .map((f) => { const name = uniqueFileName(baseOf(f), taken); taken.add(name.toLowerCase());
      return { id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), name, size: f.size, type: f.type,
        isModel: isModelFile(name), isProfile: isProfile(name), isImage: isImageFile(name),
        isLaserCut: isMakerWorldLaserFile(name), makerWorld: { note: '', openSource: true, folderPath: '' },
        printables: { note: '', folder: '' }, blob: f }; });
  if (buildFiles.length) {
    patch.files = buildFiles;
    const models = buildFiles.filter(f => f.isModel).length;
    summary.found.push(`${models} model file${models === 1 ? '' : 's'}${buildFiles.length > models ? ` + ${buildFiles.length - models} extra` : ''}`);
  } else summary.missing.push('Model files — add an .stl or .3mf');

  return { patch, summary };
}

function buildImportSummaryText(s) {
  const parts = [];
  if (s.found.length)    parts.push('Imported:\n• ' + s.found.join('\n• '));
  if (s.warnings.length) parts.push('Heads up:\n• ' + s.warnings.join('\n• '));
  if (s.missing.length)  parts.push('Still needed:\n• ' + s.missing.join('\n• '));
  // If the text fields are missing but photos came in, point at the AI generator.
  if (s.missing.some(m => /description|tags|title/i.test(m)) && s.found.some(f => /photo/i.test(f))) {
    parts.push('Tip: click “✨ Generate with AI” on the Details step to write the title, description and tags from your photos.');
  }
  return parts.join('\n\n');
}

export default function App() {
  const [project, dispatchProject] = useReducer(projectReducer, initialProject);
  const [currentSection, setCurrentSection] = useState('files');

  // Release-plan scheduler: while the app is open, surface due reminders as
  // system notifications and, for scheduled uploads, jump to the Publish step
  // so its (only-mounted-there) batch machinery can auto-start the publish.
  const releasePlans = useReleasePlans();
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const plans = releasePlanStore.get();
      const due = unnotifiedDuePlans(plans, now);
      if (!due.length) return;
      let next = plans;
      for (const plan of due) {
        notifyReleasePlan(plan);
        next = patchReleasePlan(next, plan.id, { notifiedAt: now });
      }
      releasePlanStore.set(next);
      if (due.some((plan) => plan.mode === 'scheduled')) setCurrentSection('publish');
    };
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  // Beta diagnostics: forward uncaught renderer errors to the main process,
  // which sanitizes and stores them locally. Best-effort; never throws.
  useEffect(() => {
    const desktop = (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop) ? window.modelprepDesktop : null;
    if (!desktop?.reportDiagnostic) return undefined;
    const send = (kind, message, stack) => { try { desktop.reportDiagnostic({ kind: 'rendererError', message: `${kind}: ${message}`, stack, context: location.hash || '', build: BUILD_LABEL }); } catch { /* ignore */ } };
    const onError = (e) => send('error', e?.message || 'unknown', e?.error?.stack);
    const onRejection = (e) => send('unhandledrejection', (e?.reason?.message || String(e?.reason)) || 'unknown', e?.reason?.stack);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);

  // Desktop: mirror release plans into the main process so reminders and
  // unattended publishes keep firing after the window is closed, and respond
  // when main reopens the app to run a due plan or show the queue.
  useEffect(() => {
    const desktop = (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop) ? window.modelprepDesktop : null;
    if (!desktop?.syncReleasePlans) return undefined;
    const push = () => { try { desktop.syncReleasePlans(releasePlanStore.get()); } catch { /* main may be busy */ } };
    push();
    const unsub = releasePlanStore.subscribe(push);
    const offRun = desktop.onRunScheduledRelease?.((planId) => {
      const plan = releasePlanStore.get().find((p) => p.id === planId);
      if (plan) setCurrentSection('publish'); // PublishSection's effect does the session-checked publish
    });
    const offQueue = desktop.onOpenReleaseQueue?.(() => setCurrentSection('publish'));
    return () => { unsub?.(); offRun?.(); offQueue?.(); };
  }, []);

  const workspaceMainRef = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('modelprep.sidebarCollapsed') === 'true'; } catch (error) { return false; }
  });
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [dialog, setDialog] = useState(null); // styled prompt/confirm modal
  const [demoActive, setDemoActive] = useState(false);
  const [showConnections, setShowConnections] = useState(false); // unified Settings modal
  const [settingsTab, setSettingsTab] = useState('accounts');     // accounts | ai | about
  const openSettings = (tab = 'accounts') => { setSettingsTab(tab); setShowConnections(true); };
  const stashedProject = useRef(null);

  useEffect(() => {
    const desktop = (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop)
      ? window.modelprepDesktop
      : null;
    if (!desktop?.discoverAccounts) return undefined;
    let cancelled = false;
    desktop.discoverAccounts()
      .then((result) => {
        if (cancelled || !result?.ok || !Array.isArray(result.accounts)) return;
        const available = new Map(CONNECTABLE.map((platform) => [platform, new Set()]));
        for (const account of result.accounts) {
          if (account?.platform === 'makerworld') {
            available.get('makerworld').add(DESKTOP_MAKERWORLD_SECRET);
            rehydrateDesktopAccount('makerworld', {
              label: account.label || 'MakerWorld',
              secret: DESKTOP_MAKERWORLD_SECRET,
            });
          } else if (account?.platform === 'printables') {
            available.get('printables').add(DESKTOP_PRINTABLES_SECRET);
            rehydrateDesktopAccount('printables', {
              label: account.label || 'Printables',
              secret: DESKTOP_PRINTABLES_SECRET,
            });
          } else if (account?.platform === 'cults' && account.accountId) {
            const secret = desktopCultsSecret(account.accountId);
            available.get('cults').add(secret);
            rehydrateDesktopAccount('cults', {
              label: account.label || 'Cults3D',
              secret,
              status: account.needsReconnect ? 'reconnect' : 'connected',
            });
          } else if (account?.platform === 'nexprint') {
            available.get('nexprint').add(DESKTOP_NEXPRINT_SECRET);
            rehydrateDesktopAccount('nexprint', {
              label: account.label || 'Nexprint',
              secret: DESKTOP_NEXPRINT_SECRET,
            });
          } else if (account?.platform === 'creality') {
            available.get('creality').add(DESKTOP_CREALITY_SECRET);
            rehydrateDesktopAccount('creality', {
              label: account.label || 'Creality Cloud',
              secret: DESKTOP_CREALITY_SECRET,
            });
          } else if (account?.platform === 'makeronline') {
            available.get('makeronline').add(DESKTOP_MAKERONLINE_SECRET);
            rehydrateDesktopAccount('makeronline', {
              label: account.label || 'MakerOnline',
              secret: DESKTOP_MAKERONLINE_SECRET,
            });
          } else if (account?.platform === 'mmf') {
            available.get('mmf').add(DESKTOP_MYMINIFACTORY_SECRET);
            rehydrateDesktopAccount('mmf', {
              label: account.label || 'MyMiniFactory',
              secret: DESKTOP_MYMINIFACTORY_SECRET,
            });
          } else if (account?.platform === 'makeroad') {
            available.get('makeroad').add(DESKTOP_MAKEROAD_SECRET);
            rehydrateDesktopAccount('makeroad', { label: account.label || 'MakerRoad', secret: DESKTOP_MAKEROAD_SECRET });
          } else if (account?.platform === 'thangs') {
            available.get('thangs').add(DESKTOP_THANGS_SECRET);
            rehydrateDesktopAccount('thangs', { label: account.label || 'Thangs', secret: DESKTOP_THANGS_SECRET });
          } else if (account?.platform === 'thingiverse') {
            available.get('thingiverse').add(DESKTOP_THINGIVERSE_SECRET);
            rehydrateDesktopAccount('thingiverse', { label: account.label || 'Thingiverse', secret: DESKTOP_THINGIVERSE_SECRET });
          }
        }
        for (const platform of CONNECTABLE) {
          for (const account of getAccounts(platform)) {
            const isOpaqueDesktopAccount = (
              (platform === 'makerworld' && isDesktopMakerWorldSession(account.secret))
              || (platform === 'printables' && isDesktopPrintablesSession(account.secret))
              || (platform === 'cults' && isDesktopCultsSession(account.secret))
              || (platform === 'nexprint' && isDesktopNexprintSession(account.secret))
              || (platform === 'creality' && isDesktopCrealitySession(account.secret))
              || (platform === 'makeronline' && isDesktopMakerOnlineSession(account.secret))
              || (platform === 'mmf' && isDesktopMyMiniFactorySession(account.secret))
              || (platform === 'makeroad' && isDesktopMakerRoadSession(account.secret))
              || (platform === 'thangs' && isDesktopThangsSession(account.secret))
              || (platform === 'thingiverse' && isDesktopThingiverseSession(account.secret))
            );
            if (isOpaqueDesktopAccount && !available.get(platform).has(account.secret)) {
              if (typeof desktop.recoverAccount === 'function') {
                setStatus(platform, account.id, 'checking');
                const accountId = platform === 'cults' ? desktopCultsAccountId(account.secret) : '';
                desktop.recoverAccount(platform, accountId)
                  .then((recovery) => {
                    if (cancelled) return;
                    if (recovery?.ok) {
                      rehydrateDesktopAccount(platform, {
                        label: desktopIdentityLabel(platform, recovery.user, account.label),
                        secret: account.secret,
                      });
                    } else setStatus(platform, account.id, 'reconnect');
                  })
                  .catch(() => { if (!cancelled) setStatus(platform, account.id, 'reconnect'); });
              } else setStatus(platform, account.id, 'reconnect');
            }
          }
        }
      })
      .catch(() => { /* Settings still offers normal sign-in when discovery fails. */ });
    return () => { cancelled = true; };
  }, []);

  // A step change is a navigation event. Always restore the workspace to the
  // beginning so a long previous step cannot leave the next one half-hidden.
  useEffect(() => {
    if (workspaceMainRef.current) workspaceMainRef.current.scrollTop = 0;
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    try { workspaceMainRef.current?.focus?.({ preventScroll: true }); } catch (e) { /* older WebViews */ }
  }, [currentSection]);

  useEffect(() => {
    try { localStorage.setItem('modelprep.sidebarCollapsed', String(sidebarCollapsed)); } catch (error) { /* storage unavailable */ }
  }, [sidebarCollapsed]);

  // Test-project mode fills the project with bundled sample files and metadata.
  // It remains excluded from autosave so exiting restores the user's own project,
  // but publish actions are real and still require an explicit button press.
  const [demoLoading, setDemoLoading] = useState(false);
  const toggleDemo = () => {
    if (!demoActive) {
      stashedProject.current = project;
      // Persist the real project's text/settings now, so it survives even a reload
      // while in demo (autosave is suppressed during demo).
      try {
        if (projectHasContent(project)) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeProjectMeta(project)));
      } catch (e) { /* ignore */ }
      const base = buildDemoProject();
      setProject(base);           // show placeholders instantly
      setDemoActive(true);
      setCurrentSection('files');
      // Upgrade to bundled crop-focused images + STL/3MF in the background so the demo
      // stays deterministic and makes each platform's framing visibly different.
      setDemoLoading(true);
      loadDemoAssets(base)
        .then((assets) => setProject((p) => p.__testProject ? { ...p, ...assets } : p))
        .catch(() => { /* keep placeholders */ })
        .finally(() => setDemoLoading(false));
    } else {
      setProject(stashedProject.current || { ...initialProject, name: 'Untitled Project' });
      stashedProject.current = null;
      setDemoActive(false);
      setDemoLoading(false);
    }
  };

  // Thin dispatchers — keep the existing call-site shapes working:
  //   updateProject({ ...patch })         shallow-merge
  //   setProject(prev => next) / setProject(obj)   functional or full replace
  const updateProject = (patch) => dispatchProject({ type: 'PATCH', patch });
  const setProject = (v) => dispatchProject(typeof v === 'function' ? { type: 'APPLY', updater: v } : { type: 'SET', value: v });

  // Scan newly added 3MF files for their real slicer/print metadata. Detection
  // is advisory: it sets badges, profile stats and smart defaults, and the user
  // can override the attribution per file. Failures mark the file scanned with
  // slicer "unknown" so a malformed package never blocks import or loops here.
  useEffect(() => {
    const pending = project.files.filter((f) => f.isProfile && f.blob && !f.threemf);
    if (!pending.length) return;
    let cancelled = false;
    (async () => {
      for (const file of pending) {
        const scan = await parseThreeMF(file.blob, loadJSZip);
        if (cancelled) return;
        setProject((prev) => ({
          ...prev,
          files: prev.files.map((f) => (f.id === file.id ? { ...f, threemf: scan } : f)),
          profiles: prev.profiles.map((p) => (p.fileId === file.id && !p.parsed
            ? { ...p, parsed: scan.sliced || scan.printer ? {
              printer: scan.printer || '', material: scan.material || '',
              layerHeight: scan.layerHeight || '', plates: scan.plates || null,
              estimatedTime: scan.estimatedTime || '', filamentGrams: scan.filamentGrams || null,
            } : p.parsed }
            : p)),
        }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.files]);

  // Auto-generate profile entries when 3MF files are added
  useEffect(() => {
    // Single functional update derived from the previous state, so adding new
    // 3MFs and pruning deleted ones can't clobber each other (was two stale-
    // closure updateProject calls that could drop a just-added profile).
    setProject(prev => {
      const liveFileIds = new Set(prev.files.map(f => f.id));
      const existing = new Set(prev.profiles.map(p => p.fileId));
      const kept = prev.profiles.filter(p => liveFileIds.has(p.fileId));
      const added = prev.files
        .filter(f => isProfile(f.name) && !existing.has(f.id))
        .map(f => ({
          id: 'prof_' + f.id,
          fileId: f.id,
          name: f.name.replace(/\.3mf$/i, ''),
          description: '',
          useMainCover: true,
          coverImageId: null,
          photoIds: [],
          visibility: 'private',
          compatiblePrinters: [],
          realPhotoConfirmed: false,
          guidelinesAccepted: false,
          // Real stats arrive asynchronously from the 3MF metadata scan.
          parsed: null,
        }));
      // No change → return prev to avoid an extra render.
      if (!added.length && kept.length === prev.profiles.length) return prev;
      return { ...prev, profiles: [...kept, ...added] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.files]);

  // Autosave project metadata to localStorage (debounced). Only writes once the
  // project has real content, so a fresh load never clobbers a saved session.
  const saveTimer = useRef(null);
  useEffect(() => {
    if (demoActive || !projectHasContent(project)) return; // never persist demo data
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeProjectMeta(project))); } catch (e) { /* quota/private mode */ }
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [project, demoActive]);

  // On first load, offer to restore a previous session if one was saved.
  useEffect(() => {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null'); } catch (e) { saved = null; }
    if (!saved || (!saved.title && !saved.description && !(saved.tags || []).length)) return;
    let handledFingerprint = '';
    try { handledFingerprint = localStorage.getItem(AUTOSAVE_HANDLED_KEY) || ''; } catch (e) { /* private mode */ }
    if (autosaveWasHandled(saved, handledFingerprint)) return;
    setDialog({
      kind: 'confirm',
      title: 'Restore text & settings?',
      message: `We saved your text${saved.title ? ` for “${saved.title}”` : ''} — title, description, tags, category, license and platform settings. We could NOT save your model files, images, or print profiles, so you'll need to re-add those.`,
      confirmLabel: 'Restore text & settings',
      onCancel: () => markAutosaveHandled(saved),
      onConfirm: () => {
        markAutosaveHandled(saved);
        updateProject({
          name: saved.name || 'Untitled Project',
          title: saved.title || '',
          description: saved.description || '',
          tags: saved.tags || [],
          category: saved.category || '',
          license: saved.license || 'ccbync',
          platforms: mergePlatformDefaults(saved.platforms),
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Section completion logic
  const completion = useMemo(() => ({
    files: project.files.length > 0,
    details: project.title.trim() && project.description.trim() && project.category && project.tags.length > 0,
    images: project.images.length > 0 && project.coverImageId !== null,
    profiles: project.profiles.length === 0 || project.profiles.every(p => p.name.trim()),
    platforms: Object.values(project.platforms).some(p => p.enabled),
    publish: false,
  }), [project]);

  const allReady = completion.files && completion.details && completion.images && completion.profiles && completion.platforms;

  const saveAsTemplate = () => {
    setShowTemplates(false);
    setDialog({
      kind: 'prompt',
      title: 'Save as template',
      message: 'Name this reusable template (Marjan’s “Sjabloon”) — it stores the description, category, tags and license.',
      placeholder: 'e.g. Functional prints — CC BY-NC',
      confirmLabel: 'Save template',
      onConfirm: (name) => {
        if (!name || !name.trim()) return;
        setTemplates(t => [...t, {
          id: 't_' + Date.now(), name: name.trim(),
          data: { description: project.description, category: project.category, tags: project.tags, license: project.license },
        }]);
      },
    });
  };
  const loadTemplate = (t) => {
    setShowTemplates(false);
    const apply = () => {
      updateProject({ description: t.data.description, category: t.data.category, tags: t.data.tags, license: t.data.license });
    };
    // Warn before overwriting existing edits.
    if (project.description || project.tags.length || project.category) {
      setDialog({
        kind: 'confirm',
        title: 'Load template?',
        message: `“${t.name}” will replace your current description, category, tags and license. Your files and images stay.`,
        confirmLabel: 'Load template',
        onConfirm: apply,
      });
    } else {
      apply();
    }
  };
  const isDirty = () => project.files.length || project.images.length || (project.media || []).length || project.title || project.description || project.tags.length || Object.values(project.platforms).some(p => p.enabled);
  // Folder import: infer a whole project from a chosen folder, then land on Details
  // for review. Replaces the current project (with confirmation if it has content).
  const importFolder = (fileList) => {
    if (!fileList || !fileList.length) return;
    const run = async () => {
      try {
        const result = await importFolderToProject(fileList);
        if (!result) { setDialog({ kind: 'confirm', title: 'Nothing to import', message: 'That folder had no recognisable files (photos, models, or description/tags text).', confirmLabel: 'OK' }); return; }
        setDemoActive(false);
        stashedProject.current = null;
        setProject({ ...initialProject, platforms: applyDefaultPlatforms(initialProject.platforms), name: result.patch.title || 'Imported project', ...result.patch });
        setCurrentSection('details');
        setDialog({ kind: 'confirm', title: 'Folder imported', message: buildImportSummaryText(result.summary), confirmLabel: 'Review details' });
      } catch (e) {
        setDialog({ kind: 'confirm', title: 'Import failed', message: String((e && e.message) || e), confirmLabel: 'OK' });
      }
    };
    if (projectHasContent(project) && !demoActive) {
      setDialog({ kind: 'confirm', title: 'Replace current project?', message: 'Importing a folder replaces your current title, files, photos and settings.', confirmLabel: 'Import & replace', danger: true, onConfirm: run });
    } else run();
  };

  const newProject = () => {
    const reset = () => {
      try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) { /* ignore */ }
      try { localStorage.removeItem(AUTOSAVE_HANDLED_KEY); } catch (e) { /* ignore */ }
      setDemoActive(false);
      stashedProject.current = null;
      setProject({ ...initialProject, platforms: applyDefaultPlatforms(initialProject.platforms), name: 'Untitled Project' });
      setCurrentSection('files');
    };
    if (isDirty()) {
      setDialog({
        kind: 'confirm',
        title: 'Start a new project?',
        message: 'This clears everything — files, images, description and platform choices. This can’t be undone.',
        confirmLabel: 'Discard & start fresh',
        danger: true,
        onConfirm: reset,
      });
    } else {
      reset();
    }
  };

  return (
    <ConnectionsCtx.Provider value={openSettings}>
    <div className="min-h-screen w-full" style={{ background: '#EDE9DE', color: '#15171C', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <GlobalStyles />

      {/* Background workshop pattern: subtle layer lines */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(21,23,28,0.022) 0px, rgba(21,23,28,0.022) 1px, transparent 1px, transparent 7px)',
        zIndex: 0,
      }} />
      <div className="relative z-10 min-h-screen flex flex-col">

      <TopHeader
        project={project}
        updateProject={updateProject}
        templates={templates}
        showTemplates={showTemplates}
        setShowTemplates={setShowTemplates}
        onSaveTemplate={saveAsTemplate}
        onLoadTemplate={loadTemplate}
        onNewProject={newProject}
        onImportFolder={importFolder}
        demoActive={demoActive}
        demoLoading={demoLoading}
        onToggleDemo={toggleDemo}
        onOpenConnections={openSettings}
      />
      <VersionBanner />

      {/* Fill the viewport below the header. Short steps keep Back/Next aligned
          directly above the fixed status bar; long steps retain sticky navigation. */}
      <div className="flex flex-1 flex-col lg:flex-row w-full max-w-[1760px] 2xl:max-w-[2200px] mx-auto">
        <Sidebar
          currentSection={currentSection}
          setCurrentSection={setCurrentSection}
          completion={completion}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />

        <main
          ref={workspaceMainRef}
          data-testid="workspace-main"
          tabIndex={-1}
          aria-label={`${SECTIONS.find((section) => section.id === currentSection)?.label || 'Project'} step`}
          className="flex flex-1 flex-col min-w-0 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 lg:pt-5 overflow-x-hidden"
          style={{ paddingBottom: 0 }}
        >
          <div data-testid="section-content" className="mp-section-content flex flex-1 flex-col min-h-0">
            {currentSection === 'files' && (
              <FilesSection project={project} updateProject={updateProject} setCurrentSection={setCurrentSection} />
            )}
            {currentSection === 'details' && (
              <DetailsSection project={project} updateProject={updateProject} setCurrentSection={setCurrentSection} />
            )}
            {currentSection === 'images' && (
              <ImagesSection project={project} updateProject={updateProject} setCurrentSection={setCurrentSection} />
            )}
            {currentSection === 'profiles' && (
              <ProfilesSection project={project} updateProject={updateProject} setCurrentSection={setCurrentSection} />
            )}
            {currentSection === 'platforms' && (
              <PlatformsSection project={project} updateProject={updateProject} setCurrentSection={setCurrentSection} />
            )}
            {currentSection === 'publish' && (
              <PublishSection
                key={project.__testProject ? 'test' : 'project'}
                project={project}
                allReady={allReady}
                completion={completion}
                setCurrentSection={setCurrentSection}
              />
            )}
          </div>
        </main>
      </div>

      <StatusBar project={project} completion={completion} currentSection={currentSection} />
      </div>

      {dialog && <Modal dialog={dialog} onClose={() => setDialog(null)} />}
      <SettingsModal open={showConnections} onClose={() => setShowConnections(false)} tab={settingsTab} setTab={setSettingsTab} />
    </div>
    </ConnectionsCtx.Provider>
  );
}

// Styled replacement for native alert/prompt/confirm. Keyboard: Enter confirms,
// Escape cancels. Focus moves into the dialog on open.
function Modal({ dialog, onClose }) {
  const { kind, title, message, placeholder, confirmLabel = 'Confirm', danger } = dialog;
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') cancel(); };
    document.addEventListener('keydown', onKey);
    if (kind === 'prompt') setTimeout(() => inputRef.current?.focus(), 30);
    return () => document.removeEventListener('keydown', onKey);
  }, [kind, onClose]);
  const cancel = () => { dialog.onCancel?.(); onClose(); };
  const confirm = () => { dialog.onConfirm?.(kind === 'prompt' ? value : undefined); onClose(); };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="modelprep-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(21,23,28,0.55)' }} onMouseDown={cancel}>
      <div className="mp-card w-full max-w-md p-5" style={{ background: '#EDE9DE' }} onMouseDown={(e) => e.stopPropagation()}>
        <h3 id="modelprep-dialog-title" className="mp-display text-[22px] leading-none mb-2">{title}</h3>
        {message && <p className="mp-body text-sm mb-4 whitespace-pre-line max-h-[50vh] overflow-y-auto" style={{ color: 'rgba(21,23,28,0.7)' }}>{message}</p>}
        {kind === 'prompt' && (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) confirm(); }}
            placeholder={placeholder}
            aria-label={title}
            className="mp-input mb-4"
          />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={cancel} className="mp-btn mp-btn-ghost text-[13px] py-2 px-3">Cancel</button>
          <button
            onClick={confirm}
            disabled={kind === 'prompt' && !value.trim()}
            className="mp-btn text-[13px] py-2 px-3 disabled:opacity-40"
            style={danger ? { background: '#c83f10', borderColor: '#c83f10' } : undefined}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ project, completion, currentSection }) {
  const totalSize = project.files.reduce((s, f) => s + f.size, 0);
  const enabledCount = Object.values(project.platforms).filter(p => p.enabled).length;
  const doneCount = Object.values(completion).filter(Boolean).length;
  const totalSteps = Object.keys(completion).length - 1; // publish doesn't count
  const allDone = doneCount >= totalSteps;
  const status = doneCount === 0 ? { label: 'EMPTY', color: '#FFB627' }
    : allDone ? { label: 'READY TO PUBLISH', color: '#4FB286' }
    : { label: 'IN PROGRESS', color: '#FFB627' };
  return (
    <div data-testid="status-bar" className="fixed bottom-0 left-0 right-0 z-20 border-t" style={{
      background: '#15171C',
      color: '#EDE9DE',
      borderColor: '#15171C',
      height: 32,
    }}>
      <div className="max-w-[1760px] 2xl:max-w-[2200px] mx-auto h-full flex items-center justify-between px-4 sm:px-6 overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-3 sm:gap-5 mp-mono text-[12px] uppercase tracking-[0.15em]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5" style={{ background: status.color }} />
            {status.label}
          </span>
          <span className="hidden sm:inline" style={{ color: 'rgba(237,233,222,0.5)' }}>│</span>
          <span className="hidden sm:inline">SECTION /{currentSection.toUpperCase()}</span>
          <span style={{ color: 'rgba(237,233,222,0.5)' }}>│</span>
          <span>{doneCount}/{totalSteps} STEPS</span>
        </div>
        <div className="hidden sm:flex items-center gap-5 mp-mono text-[12px] uppercase tracking-[0.15em]">
          <span>FILES <span style={{ color: '#FF5722' }}>{project.files.length}</span></span>
          <span>MEDIA <span style={{ color: '#FF5722' }}>{project.images.length + (project.media || []).length}</span></span>
          <span>SIZE <span style={{ color: '#FF5722' }}>{formatBytes(totalSize)}</span></span>
          <span>TARGETS <span style={{ color: '#FF5722' }}>{enabledCount}/{PLATFORMS.length}</span></span>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// GLOBAL STYLES
// =====================================================================

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

      /* Design tokens — single source of truth for color & ink opacity.
         Use var(--ink-65) etc. instead of ad-hoc rgba() in new code. */
      :root {
        --ink: #15171C;
        --ink-65: rgba(21,23,28,0.65);  /* secondary text / subtitles */
        --ink-50: rgba(21,23,28,0.5);   /* helper / caption */
        --ink-35: rgba(21,23,28,0.35);  /* faint / placeholder */
        --ink-04: rgba(21,23,28,0.04);  /* inset / code surface */
        --paper: #EDE9DE;
        --accent: #FF5722;              /* primary accent, focus, links */
        --api: #3A86FF;                 /* API / demo CTAs + panels */
        --success: #4FB286;
        --success-text: #3a8d68;
        --warn: #FFB627;
        --danger-text: #c83f10;
      }

      /* Industrial / workshop type system */
      .mp-display { font-family: 'Big Shoulders Display', 'Impact', sans-serif; font-weight: 800; letter-spacing: -0.005em; line-height: 0.95; text-transform: uppercase; }
      .mp-body { font-family: 'Space Grotesk', system-ui, sans-serif; }
      .mp-mono { font-family: 'JetBrains Mono', 'Courier New', monospace; font-feature-settings: "ss01", "zero"; }

      /* Layer-line background (subtle horizontal stripes like 3D print layers) */
      .mp-grid {
        background-image: repeating-linear-gradient(0deg, rgba(21,23,28,0.04) 0px, rgba(21,23,28,0.04) 1px, transparent 1px, transparent 8px);
      }
      .mp-blueprint {
        background-image:
          linear-gradient(to right, rgba(43,58,85,0.06) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(43,58,85,0.06) 1px, transparent 1px),
          linear-gradient(to right, rgba(43,58,85,0.12) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(43,58,85,0.12) 1px, transparent 1px);
        background-size: 8px 8px, 8px 8px, 80px 80px, 80px 80px;
      }

      /* Dimension-line decoration for section headers (CAD drawing style) */
      .mp-dimline { position: relative; display: inline-block; padding: 0 14px; }
      .mp-dimline::before, .mp-dimline::after {
        content: ''; position: absolute; top: 50%; width: 10px; height: 1px; background: currentColor;
      }
      .mp-dimline::before { left: 0; box-shadow: 0 -4px 0 0 currentColor, 0 4px 0 0 currentColor; }
      .mp-dimline::after  { right: 0; box-shadow: 0 -4px 0 0 currentColor, 0 4px 0 0 currentColor; }

      /* Tick rule (for project name underline etc.) */
      .mp-tickrule {
        background-image: repeating-linear-gradient(to right, currentColor 0px, currentColor 1px, transparent 1px, transparent 6px);
        height: 1px; opacity: 0.4;
      }

      .mp-textarea::placeholder { color: rgba(21,23,28,0.3); }
      .mp-prose h1,.mp-prose h2,.mp-prose h3 { font-family: 'Big Shoulders Display'; font-weight: 800; margin: 0.7em 0 0.25em; line-height: 1.05; text-transform: uppercase; letter-spacing: -0.005em; }
      .mp-prose h1 { font-size: 1.6em; } .mp-prose h2 { font-size: 1.35em; } .mp-prose h3 { font-size: 1.15em; }
      .mp-prose p { margin: 0.55em 0; line-height: 1.6; font-family: 'Space Grotesk'; }
      .mp-prose ul { margin: 0.4em 0; padding-left: 1.2em; font-family: 'Space Grotesk'; }
      .mp-prose li { margin: 0.15em 0; line-height: 1.5; }
      .mp-prose code { font-family: 'JetBrains Mono'; font-size: 0.88em; background: rgba(21,23,28,0.06); padding: 0.12em 0.35em; }
      .mp-prose a { color: #FF5722; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
      .mp-pre { white-space: pre-wrap; word-break: break-word; }

      .mp-input { background: #FFFFFF; border: 1px solid rgba(21,23,28,0.18); padding: 0.7rem 0.95rem; min-height: 44px; font-family: 'Space Grotesk', system-ui, sans-serif; font-size: 0.95rem; width: 100%; color: #15171C; }
      .mp-input:focus { outline: none; border-color: #FF5722; box-shadow: inset 0 0 0 1px #FF5722; }
      /* Compact input variant for inline controls (datetime, price). One height for all. */
      .mp-input-sm { background: #FFFFFF; border: 1px solid rgba(21,23,28,0.18); padding: 0.4rem 0.6rem; min-height: 38px; font-family: 'Space Grotesk', system-ui, sans-serif; font-size: 0.9rem; color: #15171C; }
      .mp-input-sm:focus { outline: none; border-color: #FF5722; box-shadow: inset 0 0 0 1px #FF5722; }

      .mp-btn { font-family: 'Big Shoulders Display'; font-weight: 800; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.03em; padding: 0.7rem 1.25rem; min-height: 44px; background: #15171C; color: #EDE9DE; cursor: pointer; transition: background 0.15s; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border: 1px solid #15171C; }
      .mp-btn:hover:not(:disabled) { background: #FF5722; border-color: #FF5722; }
      .mp-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      .mp-btn-ghost { background: transparent; color: #15171C; border: 1px solid rgba(21,23,28,0.25); }
      .mp-btn-ghost:hover:not(:disabled) { background: #15171C; color: #EDE9DE; border-color: #15171C; }

      .mp-card { background: #FFFFFF; border: 1px solid rgba(21,23,28,0.12); }
      .mp-section-content > * { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; }

      /* Workshop-style status pill */
      .mp-pill { font-family: 'JetBrains Mono'; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; padding: 3px 8px; border-radius: 0; display: inline-flex; align-items: center; }

      @keyframes mp-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      .mp-spin { animation: mp-spin 1s linear infinite; }
      @keyframes mp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      .mp-pulse { animation: mp-pulse 1.5s ease-in-out infinite; }
      @keyframes mp-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
      .mp-scan { animation: mp-scan 2s linear infinite; }

      /* Global body font */
      body, [class*="mp-"] { font-family: 'Space Grotesk', system-ui, sans-serif; }
    `}</style>
  );
}

// =====================================================================
// TOP HEADER
// =====================================================================

function TopHeader({ project, updateProject, templates, showTemplates, setShowTemplates, onSaveTemplate, onLoadTemplate, onNewProject, onImportFolder, demoActive, demoLoading, onToggleDemo, onOpenConnections }) {
  const [editingName, setEditingName] = useState(false);
  const templatesRef = useRef(null);
  const folderRef = useRef(null);
  // webkitdirectory must be set imperatively — React doesn't render it reliably as a prop.
  useEffect(() => { if (folderRef.current) { folderRef.current.setAttribute('webkitdirectory', ''); folderRef.current.setAttribute('directory', ''); } }, []);

  // Close the Templates menu on outside tap/click or Escape (works on touch).
  useEffect(() => {
    if (!showTemplates) return;
    const onDoc = (e) => { if (templatesRef.current && !templatesRef.current.contains(e.target)) setShowTemplates(false); };
    const onKey = (e) => { if (e.key === 'Escape') setShowTemplates(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [showTemplates, setShowTemplates]);

  return (
    <header className="sticky top-0 z-20 border-b backdrop-blur" style={{ borderColor: 'rgba(21,23,28,0.1)', background: 'rgba(237,233,222,0.92)' }}>
      <div data-testid="top-header-layout" className="max-w-[1760px] 2xl:max-w-[2200px] mx-auto px-4 sm:px-6 py-3 flex flex-col xl:flex-row xl:flex-nowrap xl:items-center xl:justify-between gap-3 xl:gap-4">
        <div data-testid="top-header-brand" className="flex items-center gap-3 min-w-0 w-full xl:w-auto xl:max-w-[360px] 2xl:max-w-[520px]">
          <img data-testid="modelprep-logo" src={`${import.meta.env.BASE_URL}modelprep-logo.svg`} alt="" className="w-11 h-11 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2.5 min-w-0">
              <h1 className="mp-display text-[26px] leading-none">ModelPrep</h1>
              <span className="hidden sm:inline mp-mono text-[10px] uppercase tracking-[0.16em] whitespace-nowrap" style={{ color: 'rgba(21,23,28,0.66)' }}>v0.3</span>
            </div>
            <div data-testid="visible-build-stamp" className="mp-mono text-[9px] sm:text-[10px] uppercase tracking-[0.13em] whitespace-nowrap mt-0.5" style={{ color: 'rgba(21,23,28,0.66)' }} title={BUILD_TIME ? new Date(BUILD_TIME).toISOString() : BUILD_DATE_LABEL}>
              Build {BUILD_COMMIT} · {BUILD_DATE_LABEL}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              {editingName ? (
                <input
                  autoFocus
                  aria-label="Project name"
                  value={project.name}
                  onChange={(e) => updateProject({ name: e.target.value })}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
                  className="mp-mono text-[13px] bg-transparent outline-none border-b"
                  style={{ borderColor: '#FF5722', width: 220 }}
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="mp-mono text-[13px] flex items-center gap-1 group min-w-0 max-w-full truncate"
                  style={{ color: 'rgba(21,23,28,0.66)' }}
                >
                  ▸ {project.name}
                  <Edit3 size={10} className="opacity-0 group-hover:opacity-100 transition" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div data-testid="top-header-actions" className="grid grid-cols-2 sm:flex sm:flex-wrap xl:flex-nowrap xl:justify-end items-center gap-2 w-full xl:w-auto min-w-0">
          <ConnectionsButton onOpen={onOpenConnections} />
          <div className="relative" ref={templatesRef}>
            <button onClick={() => setShowTemplates(s => !s)} className="mp-btn mp-btn-ghost text-xs py-2 px-3" aria-haspopup="true" aria-expanded={showTemplates}>
              <Bookmark size={13} /> Templates
              {templates.length > 0 && (
                <span className="ml-1 mp-mono text-[12px]" style={{ color: '#FF5722' }}>{templates.length}</span>
              )}
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-72 max-w-[calc(100vw-2rem)] mp-card z-30">
                <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
                  <button onClick={() => { onSaveTemplate(); setShowTemplates(false); }} className="w-full text-left text-xs flex items-center gap-2 py-1" style={{ color: '#FF5722' }}>
                    <Save size={12} /> Save current as template
                  </button>
                </div>
                {templates.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-center" style={{ color: 'rgba(21,23,28,0.66)' }}>
                    No templates yet. Save your current setup as a reusable template (Marjan's "Sjabloon").
                  </div>
                ) : (
                  templates.map(t => (
                    <button key={t.id} onClick={() => onLoadTemplate(t)} className="w-full text-left px-3 py-2 text-xs hover:bg-black/5 transition flex justify-between items-center">
                      <span>{t.name}</span>
                      <span className="mp-mono text-[12px]" style={{ color: 'rgba(21,23,28,0.66)' }}>{t.data.tags?.length || 0} tags</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            onClick={onToggleDemo}
            className="mp-btn text-xs py-2 px-3"
            style={demoActive ? { background: '#3A86FF', borderColor: '#3A86FF' } : { background: 'transparent', color: '#15171C', border: '1px solid rgba(21,23,28,0.25)' }}
            aria-pressed={demoActive}
            title={demoActive ? 'Exit the demo and restore your project' : 'Load a sample project to explore the flow (nothing is uploaded)'}
          >
            <Sparkles size={13} /> {demoActive ? 'Exit demo' : 'Try demo'}
          </button>
          <button
            onClick={() => folderRef.current?.click()}
            className="mp-btn mp-btn-ghost text-xs py-2 px-3"
            title="Import a folder of photos, files, description.md and tags.txt — fills everything in"
          >
            <Folder size={13} /> Import
          </button>
          <input
            ref={folderRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { onImportFolder(e.target.files); e.target.value = ''; }}
          />
          <button onClick={onNewProject} className="mp-btn mp-btn-ghost text-xs py-2 px-3">
            <Plus size={13} /> New
          </button>
        </div>
      </div>
      {demoActive && (
        <div className="text-center py-1.5 px-4 mp-mono text-[12px] uppercase tracking-[0.15em] flex items-center justify-center gap-2" style={{ background: '#3A86FF', color: '#fff' }}>
          {demoLoading
            ? <><Loader size={12} className="animate-spin" /> Loading 16 crop-focused demo renders &amp; model…</>
            : <><Sparkles size={12} /> Demo project loaded — nothing has been uploaded. Every destination is set to private, secret, or draft; head to Publish when you’re ready.</>}
        </div>
      )}
    </header>
  );
}

// =====================================================================
// SIDEBAR
// =====================================================================

function Sidebar({ currentSection, setCurrentSection, completion, collapsed, setCollapsed }) {
  const activeIndex = Math.max(0, SECTIONS.findIndex((section) => section.id === currentSection));
  return (
    <aside
      data-testid="project-sidebar"
      className={`w-full ${collapsed ? 'lg:w-20' : 'lg:w-64'} flex-shrink-0 border-b lg:border-b-0 lg:border-r`}
      style={{ borderColor: 'rgba(21,23,28,0.15)', minHeight: '100%' }}
    >
      <nav aria-label="Project steps" className={`py-3 px-3 lg:py-5 ${collapsed ? 'lg:px-2' : 'lg:px-3'} lg:sticky lg:top-[81px]`}>
        <div className="lg:hidden flex items-center gap-3">
          <details className="min-w-0 flex-1 relative">
            <span className="mp-mono text-[10px] uppercase tracking-[0.16em] block mb-1" style={{ color: 'rgba(21,23,28,0.66)' }}>
              Step {activeIndex + 1} of {SECTIONS.length}
            </span>
            <summary className="mp-input-sm w-full cursor-pointer list-none flex items-center justify-between gap-2">
              <span>{String(activeIndex + 1).padStart(2, '0')} · {SECTIONS[activeIndex].label}</span>
              <ChevronDown size={14} />
            </summary>
            <div className="absolute top-full left-0 right-0 z-30 mp-card mt-1 p-1 shadow-lg">
              {SECTIONS.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={(event) => {
                    setCurrentSection(section.id);
                    event.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                  aria-current={section.id === currentSection ? 'step' : undefined}
                  className="w-full text-left px-2.5 py-2 flex items-center gap-2 text-[12px]"
                  style={{ background: section.id === currentSection ? '#15171C' : 'transparent', color: section.id === currentSection ? '#EDE9DE' : '#15171C' }}
                >
                  <span className="mp-mono opacity-55">{String(index + 1).padStart(2, '0')}</span>
                  <span className="flex-1">{section.label}</span>
                  {completion[section.id] && <Check size={12} style={{ color: '#4FB286' }} />}
                </button>
              ))}
            </div>
          </details>
          <div className="mp-mono text-[11px] uppercase tracking-[0.12em] pt-5" style={{ color: completion[currentSection] ? '#247255' : 'rgba(21,23,28,0.45)' }}>
            {completion[currentSection] ? 'Complete' : 'In progress'}
          </div>
        </div>
        <div className={`hidden lg:flex mb-3 items-center gap-2 ${collapsed ? 'justify-center' : 'px-3'}`} style={{ color: 'rgba(21,23,28,0.66)' }}>
          {!collapsed && (
            <>
              <span className="mp-mono text-[11px] uppercase tracking-[0.25em]">┌─ JOB SHEET</span>
              <div className="flex-1 mp-tickrule" />
            </>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 flex items-center justify-center flex-shrink-0 hover:bg-[rgba(21,23,28,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]"
            aria-label={collapsed ? 'Expand project steps' : 'Collapse project steps'}
            title={collapsed ? 'Expand project steps' : 'Collapse project steps'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <div className="hidden lg:block">
        {SECTIONS.map((s, i) => {
          const Icon = s.icon;
          const done = completion[s.id];
          const active = currentSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setCurrentSection(s.id)}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${s.label}${done ? ' (complete)' : ''}`}
              title={collapsed ? `${String(i + 1).padStart(2, '0')} · ${s.label} — ${s.description}` : undefined}
              className={`flex-shrink-0 w-[210px] lg:w-full text-left p-3 mb-0.5 flex transition-colors group relative ${collapsed ? 'justify-center' : 'items-start gap-3'}`}
              style={{
                background: active ? '#15171C' : 'transparent',
                color: active ? '#EDE9DE' : '#15171C',
              }}
            >
              {active && (
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: '#FF5722' }} />
              )}
              <div className="flex-shrink-0 mt-0.5 relative">
                <Icon size={16} strokeWidth={2.25} />
                {done && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 flex items-center justify-center" style={{ background: '#FF5722' }}>
                    <Check size={8} strokeWidth={3.5} color="#fff" />
                  </div>
                )}
              </div>
              <div className={collapsed ? 'hidden' : 'min-w-0 flex-1'}>
                <div className="flex items-baseline gap-2">
                  <span className="mp-mono text-[11px] tracking-[0.15em] opacity-50">{String(i + 1).padStart(2, '0')}/</span>
                  <span className="mp-display text-[17px] leading-none">{s.label}</span>
                </div>
                <div className="mp-body text-[13px] mt-1 leading-tight" style={{ color: active ? 'rgba(237,233,222,0.6)' : 'rgba(21,23,28,0.5)' }}>
                  {s.description}
                </div>
              </div>
            </button>
          );
        })}
        </div>
        <div className={`${collapsed ? 'hidden' : 'hidden lg:flex'} mp-mono text-[11px] uppercase tracking-[0.25em] px-3 mt-3 items-center gap-2`} style={{ color: 'rgba(21,23,28,0.66)' }}>
          <span>└─</span>
          <div className="flex-1 mp-tickrule" />
        </div>
      </nav>
    </aside>
  );
}

// =====================================================================
// SECTION: FILES
// =====================================================================

// Largest "total package" allowance across platforms — anything over this is
// rejected everywhere, so we block the upload outright rather than just warn.
const MAX_BUILD_FILE_MB = 2048;

// Pre-flight: validate the project against ONE platform's real requirements before publish,
// so the user is told what won't pass instead of finding out after a failed upload.
// Returns { errors:[], warnings:[] } — errors will definitely fail; warnings may degrade.
export function platformPreflight(platform, project) {
  if (platform.id === 'makerworld') {
    return makerWorldPublishIssues(project, { ...MW_DEFAULT_OPTS, ...(project.platforms?.makerworld || {}) }, {
      cyberControlCount: mwRuntimeCyberBrick.controlConfigs.length,
      forbiddenWords: makerWorldForbiddenWords,
      videoIssues: makerWorldVideoIssues(project.media || []),
    });
  }
  const errors = [], warnings = [];
  const lim = platform.limits || {};
  const MB = 1024 * 1024;
  const candidateFiles = platformCandidateFiles(platform, project);
  const platformOpts = project.platforms?.[platform.id];
  const modelFiles = withoutExcluded(candidateFiles, platformOpts);

  if (!modelFiles.length) {
    errors.push(candidateFiles.length
      ? `All compatible files are excluded for ${platform.name} — re-include at least one in its file list.`
      : 'No model file to upload (add an .stl/.3mf in Files).');
  }
  for (const f of modelFiles) {
    const ext = fileExt(f.name);
    if (!platform.formats.includes(ext)) errors.push(`${f.name}: .${ext} isn't accepted here (this file won't upload).`);
    if (platform.maxFileMb && f.size / MB > platform.maxFileMb) errors.push(`${f.name} is ${formatBytes(f.size)} — over the ${platform.maxFileMb}MB per-file cap.`);
  }
  const totalMb = project.files.reduce((s, f) => s + f.size, 0) / MB;
  if (platform.maxTotalMb && totalMb > platform.maxTotalMb) errors.push(`Files total ${Math.round(totalMb)}MB — over the ${platform.maxTotalMb}MB cap.`);

  if (project.images.length === 0) errors.push('No photos — at least one is required.');
  else if (!project.coverImageId) warnings.push('No cover photo selected.');
  const galleryCount = Math.max(0, project.images.length - (project.coverImageId ? 1 : 0));
  if (platform.maxImages && galleryCount > galleryCapacity(platform)) warnings.push(`${galleryCount} gallery photos — only the first ${galleryCapacity(platform)} will upload.`);
  if (platform.id === 'makerworld') warnings.push('MakerWorld requires a real photo of the print (renders can be rejected).');

  if (!project.title.trim()) errors.push('Title is empty.');
  else if (lim.titleMax && project.title.length > lim.titleMax) errors.push(`Title is ${project.title.length}/${lim.titleMax} chars — too long for ${platform.name}.`);
  if (lim.tagMax && project.tags.length > lim.tagMax) warnings.push(`${project.tags.length} tags — ${platform.name} allows ${lim.tagMax}.`);
  if (lim.tagCharMax) { const long = project.tags.filter(t => t.length > lim.tagCharMax); if (long.length) warnings.push(`${long.length} tag(s) over ${lim.tagCharMax} chars.`); }
  if (!project.description.trim()) warnings.push('Description is empty.');
  if (!project.category) warnings.push('No category selected.');

  const cults = project.platforms?.cults;
  if (platform.id === 'cults' && cults && !cults.free && !(cults.price > 0)) warnings.push('Marked paid but the price is 0.');
  const printables = project.platforms?.printables;
  if (platform.id === 'printables' && printables) {
    errors.push(...printablesFileSettingIssues(modelFiles));
    errors.push(...printablesPaidIssues(printables));
    if (!printables.categoryId) errors.push('Choose a Printables category in Platforms.');
    if (printables.aiGenerated == null) errors.push('Answer whether AI was used in Platforms.');
    if ((printables.authorship === 'remix' || printables.authorship === 'reupload') && !printables.remixParents?.[0]) {
      errors.push('Add the original model/source for this remix or reupload.');
    }
    if (printables.authorship === 'remix' && !printables.remixDescription?.trim()) {
      errors.push('Describe what changed in the remix.');
    }
    const normalizedTags = normalizePrintablesTags(project.tags);
    if (normalizedTags.length !== project.tags.length || normalizedTags.some((tag, index) => tag !== project.tags[index])) {
      warnings.push('Printables tags will be split on whitespace and normalized to unique lowercase letters and numbers.');
    }
    if (printables.zipMode === 'archive') {
      for (const file of modelFiles.filter((entry) => fileExt(entry.name) === 'zip')) {
        if (file.size > 256 * MB) errors.push(`${file.name} exceeds Printables’ 256MB retained-ZIP limit.`);
      }
    }
  }
  const nexprint = project.platforms?.nexprint;
  if (platform.id === 'nexprint' && nexprint) {
    if (!nexprint.categoryId) errors.push('Choose a Nexprint category in Platforms.');
    if (![0, 1, 2, 3, 4, 5, 6, 7].includes(Number(nexprint.licenseType))) {
      errors.push('Choose a Nexprint license in Platforms.');
    }
    if (![1, 2, 3].includes(Number(nexprint.originalityType || 1))) {
      errors.push('Choose whether the Nexprint model is original, adapted, or a reprint.');
    }
    if (Number(nexprint.originalityType || 1) !== 1
      && !String(nexprint.sourceUrl || '').trim()
      && !String(nexprint.sourceModelId || '').trim()) {
      errors.push('Adapted and reprinted Nexprint models require the original URL or Nexprint model ID.');
    }
    const bom = nexprint.hasBom ? (nexprint.bom || []) : [];
    if (bom.length > 100) errors.push('Nexprint accepts at most 100 BOM rows.');
    if (bom.some((row) => !String(row.materialName || '').trim() || !(Number(row.materialNum) > 0))) {
      errors.push('Every Nexprint BOM row needs a material name and positive quantity.');
    }
    const attachments = project.files.filter((file) => NEXPRINT_ATTACHMENT_FORMATS.includes(fileExt(file.name)));
    if (modelFiles.length > 100) errors.push('Nexprint accepts at most 100 model files per listing.');
    if (attachments.length > 100) errors.push('Nexprint accepts at most 100 attachment files.');
    if (project.tags.length > 20) errors.push('Nexprint accepts at most 20 tags.');
    if (project.tags.some((tag) => [...String(tag)].length > 50)) errors.push('Nexprint tags may not exceed 50 characters.');
    if ([...mdToHtml(project.description)].length > 10000) errors.push('The rendered Nexprint description exceeds 10,000 characters.');
    if (project.files.some((file) => fileExt(file.name) === 'mp4' || fileExt(file.name) === 'webm')) {
      warnings.push('Nexprint’s current upload form has no video field; video files will not upload.');
    }
    if (nexprint.aiGenerated && !project.tags.some((tag) => /ai[-\s]?generated/i.test(tag))) {
      warnings.push('ModelPrep will add the required “AI-generated” tag to the Nexprint listing.');
    }
  }
  const creality = project.platforms?.creality;
  if (platform.id === 'creality' && creality) {
    if (!creality.categoryId) errors.push('Choose a Creality Cloud category in Platforms.');
    const crealityLicense = creality.license || CREALITY_LICENSE_MAP[project.license] || 'CXY-SL';
    if (!CREALITY_LICENSES.some((license) => license.value === crealityLicense)) {
      errors.push('Choose a Creality Cloud license in Platforms.');
    }
    if (Number(creality.modelSource || 1) !== 1) {
      errors.push('Remix and Non-original Creality uploads need native source attribution/proof; use Original for direct upload or finish the source fields on Creality Cloud.');
    }
    const instructions = project.files.filter((file) => CREALITY_INSTRUCTION_FORMATS.includes(fileExt(file.name)));
    if (project.tags.length > 20) errors.push('Creality Cloud accepts at most 20 tags.');
    if (project.tags.some((tag) => [...String(tag)].length > 30)) errors.push('Creality Cloud tags may not exceed 30 characters.');
    if (instructions.length) warnings.push(`${instructions.length} compatible instruction file${instructions.length === 1 ? '' : 's'} will upload with the model.`);
    if (project.files.some((file) => ['mp4', 'webm'].includes(fileExt(file.name)))) {
      warnings.push('The current Creality model form has no direct video upload; add a YouTube link in the rich description instead.');
    }
    const nonCreality3mfs = withoutExcluded(project.files, creality)
      .filter((file) => file.isProfile && !['crealityprint', 'unknown'].includes(fileSlicer(file)));
    if (nonCreality3mfs.length) {
      warnings.push(`${nonCreality3mfs.length} 3MF file${nonCreality3mfs.length === 1 ? ' was' : 's were'} sliced outside Creality Print and will upload as plain model files; Creality's parsed print-settings branch is not enabled yet.`);
    }
  }
  const makeronline = project.platforms?.makeronline;
  if (platform.id === 'makeronline' && makeronline) {
    if (!makeronline.categoryId) errors.push('Choose a MakerOnline leaf category in Platforms.');
    const makerOnlineLicense = Number(makeronline.license ?? MAKERONLINE_LICENSE_MAP[project.license] ?? 3);
    if (!MAKERONLINE_LICENSES.some((license) => license.value === makerOnlineLicense)) {
      errors.push('Choose a MakerOnline license in Platforms.');
    }
    if (![1, 2].includes(Number(makeronline.source || 1))) errors.push('Choose Original or Remix for MakerOnline.');
    if (Number(makeronline.source || 1) === 2 && !String(makeronline.originalUrl || '').trim()) {
      errors.push('MakerOnline remixes require the original work URL.');
    }
    if (Number(makeronline.source || 1) === 2 && [5, 6].includes(makerOnlineLicense)) {
      errors.push('MakerOnline remixes cannot use a NoDerivatives license.');
    }
    if (![1, 2].includes(Number(makeronline.permission || 2))) errors.push('Choose Public or Private permission for MakerOnline.');
    if (makeronline.publication === 'public' && Number(makeronline.permission || 2) !== 1) errors.push('Public MakerOnline publishing requires Public model permission.');
    if (![1, 2, 3].includes(Number(makeronline.printMethod || 3))) errors.push('Choose FDM, Resin, or Both for MakerOnline.');
    if (project.images.length > 20) warnings.push('MakerOnline uploads only the first 20 ordered model images.');
    if (project.tags.length > 20) errors.push('MakerOnline accepts at most 20 tags.');
    if (project.tags.some((tag) => [...String(tag)].length > 20)) errors.push('MakerOnline tags may not exceed 20 characters.');
    if ([...mdToPlain(project.description)].length > 9000) errors.push('The MakerOnline description exceeds 9,000 text characters.');
    if (modelFiles.length > 100) errors.push('MakerOnline accepts at most 100 raw model files.');
    const documentation = project.files.filter((file) => MAKERONLINE_DOCUMENT_FORMATS.includes(fileExt(file.name)) && !MAKERONLINE_MODEL_FORMATS.includes(fileExt(file.name)));
    if (documentation.length > 50) errors.push('MakerOnline accepts at most 50 documentation files.');
    if (makeronline.relatedKits && !(makeronline.storeKitIds || []).length) errors.push('Choose at least one MakerOnline Creative Kit.');
    if (makeronline.syncChina && (Number(makeronline.permission || 2) !== 1 || makeronline.nsfw)) {
      errors.push('MakerOnline China sync requires a public, non-NSFW model.');
    }
    const profileFiles = withoutExcluded(project.files.filter((file) => fileExt(file.name) === '3mf' && file.blob), makeronline);
    if (makeronline.includePrintProfile && Number(makeronline.printMethod || 3) !== 2 && !profileFiles.length) {
      errors.push('MakerOnline print profiles are enabled, but no .3mf profile file is available.');
    }
    if (Number(makeronline.printMethod || 3) === 2 && makeronline.includePrintProfile) {
      warnings.push('MakerOnline omits print profiles for Resin listings; the raw model files still upload.');
    }
    if (makeronline.exclusive && !makeronline.exclusiveEligible) errors.push('This MakerOnline account is not currently eligible for exclusive submission.');
  }
  if (platform.id === 'makeroad') {
    const videos = (project.media || []).filter((media) => {
      const type = String(media?.type || media?.blob?.type || '').toLowerCase();
      return type.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm', 'avi'].includes(fileExt(media?.name || ''));
    });
    if (videos.length) {
      warnings.push('MakerRoad’s current upload form has no native video field; video media will not upload.');
    }
  }
  const mmf = project.platforms?.mmf;
  if (platform.id === 'mmf' && mmf) {
    if (!['private', 'public'].includes(mmf.publication || 'private')) errors.push('Choose Private or Public visibility for MyMiniFactory.');
    if (!Array.isArray(mmf.categoryIds) || !mmf.categoryIds.length) errors.push('Choose a MyMiniFactory category in Platforms.');
    if (!MYMINIFACTORY_LICENSES.some((license) => license.id === Number(mmf.licenseId || 5))) errors.push('Choose a MyMiniFactory license in Platforms.');
    if (!mmf.confirmOriginalNoAi) errors.push('Confirm MyMiniFactory’s original, no-generative-AI, and Terms declaration in Platforms.');
    if (mmf.remix && !(mmf.remixParentIds || []).length) errors.push('MyMiniFactory remixes require at least one parent object ID.');
    if (project.tags.length > 20) errors.push('MyMiniFactory accepts at most 20 tags.');
    if (modelFiles.length > 500) errors.push('MyMiniFactory accepts at most 500 object files.');
    if (String(mmf.dimensions || '').length > 100) errors.push('MyMiniFactory dimensions must be at most 100 characters.');
    if (String(mmf.materialQuantity || '').length > 45) errors.push('MyMiniFactory material quantity must be at most 45 characters.');
    if (project.images.some((image) => !image.dataUrl)) errors.push('Every MyMiniFactory image must be available for upload.');
  }
  const makeroad = project.platforms?.makeroad;
  if (platform.id === 'makeroad' && makeroad) {
    const makerRoadCategoryCount = (makeroad.categoryIds || []).length || (makeroad.categoryPaths || []).length;
    if (makerRoadCategoryCount < 1 || makerRoadCategoryCount > 3) errors.push('Choose 1 to 3 MakerRoad categories in Platforms.');
    if (project.images.length < 3 || project.images.length > 10) errors.push('MakerRoad requires 3 to 10 ordered images.');
    if (modelFiles.length > 80) errors.push('MakerRoad accepts at most 80 model files.');
    const profiles = project.files.filter((file) => fileExt(file.name) === '3mf' && file.blob);
    if (profiles.length > 10) errors.push('MakerRoad accepts at most 10 print configurations.');
    const docs = project.files.filter((file) => MAKEROAD_DOCUMENT_FORMATS.includes(fileExt(file.name)));
    if (docs.length > 5) errors.push('MakerRoad accepts at most 5 instruction documents.');
    if (!(makeroad.printMethods || []).length) errors.push('Choose at least one MakerRoad print method.');
    if (Number(makeroad.uploadType || 1) === 2 && !String(makeroad.referUrl || '').trim()) errors.push('MakerRoad remixes require the original model URL.');
    if (makeroad.scheduled && !makeroad.planTime) errors.push('Choose a MakerRoad scheduled publication time.');
    if (makeroad.payType !== 'free' && !(Number(makeroad.payValue) > 0)) errors.push('MakerRoad paid downloads require a positive value.');
    if (makeroad.publication === 'publish' && !makeroad.termsAccepted) errors.push('Accept MakerRoad’s current terms before public submission.');
  }
  const thangs = project.platforms?.thangs;
  if (platform.id === 'thangs' && thangs) {
    if (!['single', 'bulk', 'multipart', 'assembly'].includes(thangs.structure || 'single')) errors.push('Choose a valid Thangs model structure.');
    if (thangs.resumeDraftId && !/^\d+$/.test(String(thangs.resumeDraftId))) errors.push('Thangs recovery draft ID must be numeric.');
    if (thangs.structure === 'single' && thangs.primaryFileId && !modelFiles.some((file) => file.id === thangs.primaryFileId)) errors.push('Choose an available primary Thangs model file.');
    if (modelFiles.length > 1 && !thangs.primaryFileId) errors.push('Choose a primary Thangs model part.');
    if (modelFiles.some((file) => file.size > 250 * MB)) errors.push('Thangs model files may not exceed 250 MB; move oversized files to references.');
    if (project.files.some((file) => /["/\\:$#&@?\n\t*<>%]/.test(file.name))) errors.push('One or more filenames contain characters Thangs rejects.');
    if (thangs.marketplace && !(Number(thangs.price) > 0)) errors.push('Thangs marketplace listings require a positive price.');
  }
  const thingiverse = project.platforms?.thingiverse;
  if (platform.id === 'thingiverse' && thingiverse) {
    if (!thingiverse.summary?.trim()) errors.push('Add the required Thingiverse summary.');
    if (!thingiverse.categoryId) errors.push('Choose a Thingiverse category ID.');
    if (!THINGIVERSE_LICENSES.includes(thingiverse.license)) errors.push('Choose a Thingiverse license.');
    if (thingiverse.remix && !String(thingiverse.sourceThingId || '').trim()) errors.push('Thingiverse remixes require a source Thing ID.');
    if (thingiverse.customizable && !modelFiles.some((file) => fileExt(file.name) === 'scad')) errors.push('Thingiverse Customizer requires at least one .SCAD model file.');
    if (thingiverse.publication === 'publish' && !thingiverse.termsAccepted) errors.push('Accept Thingiverse’s current terms before publish.');
  }
  return { errors, warnings };
}

function FilesSection({ project, updateProject, setCurrentSection }) {
  const fileInputRef = useRef(null);
  const [notice, setNotice] = useState(null); // { kind: 'image' | 'toobig' | 'renamed', detail }

  const handleFiles = (fileList) => {
    const arr = Array.from(fileList);
    const supported = arr.filter(f => isModelFile(f.name) || isMakerWorldLaserFile(f.name)
      || PRINTABLES_FORMATS.includes(fileExt(f.name))
      || NEXPRINT_MODEL_FORMATS.includes(fileExt(f.name))
      || NEXPRINT_ATTACHMENT_FORMATS.includes(fileExt(f.name))
      || CREALITY_MODEL_FORMATS.includes(fileExt(f.name))
      || CREALITY_INSTRUCTION_FORMATS.includes(fileExt(f.name))
      || MAKERONLINE_MODEL_FORMATS.includes(fileExt(f.name))
      || MAKERONLINE_DOCUMENT_FORMATS.includes(fileExt(f.name))
      || MAKEROAD_DOCUMENT_FORMATS.includes(fileExt(f.name))
      || MYMINIFACTORY_MODEL_FORMATS.includes(fileExt(f.name))
      || fileExt(f.name) === 'md');

    // #1 — reject single files larger than any platform will accept.
    const tooBig = supported.filter(f => f.size / 1024 / 1024 > MAX_BUILD_FILE_MB);
    const withinLimit = supported.filter(f => f.size / 1024 / 1024 <= MAX_BUILD_FILE_MB);

    // De-duplicate names against existing files and within this batch.
    const taken = new Set(project.files.map(f => f.name.toLowerCase()));
    const renamed = [];
    const additions = withinLimit.map(f => {
      const name = uniqueFileName(f.name, taken);
      taken.add(name.toLowerCase());
      if (name !== f.name) renamed.push(`${f.name} → ${name}`);
      return {
        id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        name,
        size: f.size,
        type: f.type,
        isModel: isModelFile(f.name),
        isProfile: isProfile(f.name),
        isImage: isImageFile(f.name),
        isLaserCut: isMakerWorldLaserFile(f.name),
        makerWorld: { note: '', openSource: true, folderPath: '' },
        printables: { note: '', folder: '' },
        blob: f,  // keep the actual File so we can include it in ZIP exports
      };
    });

    if (tooBig.length) {
      setNotice({ kind: 'toobig', detail: tooBig.map(f => `${f.name} (${formatBytes(f.size)})`).join(', ') });
    } else if (renamed.length) {
      setNotice({ kind: 'renamed', detail: renamed.join(', ') });
    } else if (additions.some(a => a.isImage)) {
      // #3 — images are accepted as reference files, but gallery photos belong in step 03.
      setNotice({ kind: 'image', detail: null });
    } else {
      setNotice(null);
    }

    if (additions.length === 0) {
      if (!tooBig.length) setNotice({ kind: 'unsupported', detail: null });
      return;
    }
    updateProject({ files: [...project.files, ...additions] });
  };

  const removeFile = (id) => updateProject({ files: project.files.filter(f => f.id !== id) });
  const updateFile = (id, patch) => updateProject({
    files: project.files.map((file) => (file.id === id ? { ...file, ...patch } : file)),
  });

  const updateMakerWorldFile = (id, patch) => updateProject({
    files: project.files.map((file) => file.id === id
      ? { ...file, makerWorld: { note: '', openSource: true, folderPath: '', ...(file.makerWorld || {}), ...patch } }
      : file),
  });
  const updatePrintablesFile = (id, patch) => updateProject({
    files: project.files.map((file) => file.id === id
      ? { ...file, printables: { note: '', folder: '', ...(file.printables || {}), ...patch } }
      : file),
  });

  const renameFile = (id, newName) => {
    // Don't let a rename collide with another file's name.
    const taken = new Set(project.files.filter(f => f.id !== id).map(f => f.name.toLowerCase()));
    const finalName = uniqueFileName(newName, taken);
    updateProject({ files: project.files.map(f => f.id === id ? {
      ...f, name: finalName,
      isModel: isModelFile(finalName), isProfile: isProfile(finalName),
      isImage: isImageFile(finalName), isLaserCut: isMakerWorldLaserFile(finalName),
    } : f) });
  };

  const totalSize = project.files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="w-full min-w-0">
      <SectionHeader
        number="01"
        title="Drop your files"
        subtitle="Add model files, print profiles, and source files. Platform-specific settings stay attached."
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload build files — drop here or press Enter to browse"
        className={`mp-blueprint border-2 border-dashed cursor-pointer transition-colors mt-6 focus:outline-none focus-visible:border-[#FF5722] ${project.files.length ? 'p-3 text-left' : 'py-16 px-6 text-center'}`}
        style={{ borderColor: 'rgba(21,23,28,0.25)' }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#FF5722'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(21,23,28,0.25)'}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={[...new Set([...PRINTABLES_FORMATS, 'bmp', 'fbx', 'glb', 'lac', 'md', 'stpz', 'x3d'])].map((extension) => `.${extension}`).join(',')}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        {project.files.length ? (
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 flex-shrink-0" style={{ background: '#15171C' }}>
              <Plus size={17} strokeWidth={2.5} style={{ color: '#FF5722' }} />
            </div>
            <div className="min-w-0">
              <h2 className="mp-display text-[20px] leading-none">Add more build files</h2>
              <p className="mp-body text-[12px] mt-1" style={{ color: 'rgba(21,23,28,0.62)' }}>Drop files here or click to browse · max {MAX_BUILD_FILE_MB}MB each</p>
            </div>
            <span className="mp-mono text-[11px] uppercase tracking-[0.14em] ml-auto hidden sm:block" style={{ color: 'rgba(21,23,28,0.66)' }}>
              {project.files.length} loaded
            </span>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 mb-4" style={{ background: '#15171C' }}>
              <Upload size={22} strokeWidth={2.5} style={{ color: '#FF5722' }} />
            </div>
            <h2 className="mp-display text-[36px] leading-none mb-2">Load build files</h2>
            <p className="mp-body text-sm mb-3" style={{ color: 'rgba(21,23,28,0.65)' }}>drag &amp; drop · or click anywhere in the work area · max {MAX_BUILD_FILE_MB}MB per file</p>
            <div className="inline-flex items-center gap-1.5 mp-mono text-[12px] uppercase tracking-[0.2em] flex-wrap justify-center" style={{ color: 'rgba(21,23,28,0.66)' }}>
              {['stl', '3mf', 'step', 'dwg', 'svg', 'dxf', 'lac', 'ai', 'zip'].map(ext => (
                <span key={ext} className="mp-pill" style={{ background: 'rgba(21,23,28,0.06)' }}>.{ext}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {notice && (
        <div className="mt-4 p-3 flex items-start gap-3" style={{ background: 'rgba(255,87,34,0.08)', border: '1px solid rgba(255,87,34,0.3)' }}>
          <AlertCircle size={16} style={{ color: '#FF5722' }} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs flex-1">
            {notice.kind === 'toobig' ? (
              <>
                <div className="mp-display font-bold mb-1">File too large — not added</div>
                <div style={{ color: 'rgba(21,23,28,0.7)' }}>
                  {notice.detail} exceeds the {MAX_BUILD_FILE_MB}MB per-file ceiling that platforms accept. Decimate the mesh or split it before uploading.
                </div>
              </>
            ) : notice.kind === 'unsupported' ? (
              <>
                <div className="mp-display font-bold mb-1">Nothing added — unsupported files</div>
                <div style={{ color: 'rgba(21,23,28,0.7)' }}>
                  None of those files are supported here. Try a MakerWorld 3D or Laser &amp; Cut format, or a supported documentation file.
                </div>
              </>
            ) : notice.kind === 'renamed' ? (
              <>
                <div className="mp-display font-bold mb-1">Renamed to avoid a duplicate</div>
                <div style={{ color: 'rgba(21,23,28,0.7)' }}>
                  A file with that name was already added, so we renamed it: {notice.detail}. (Same-named files would otherwise overwrite each other in the upload package.)
                </div>
              </>
            ) : (
              <>
                <div className="mp-display font-bold mb-1">Added an image as a build file</div>
                <div style={{ color: 'rgba(21,23,28,0.7)' }}>
                  Kept it (handy for print diagrams). But if these are gallery photos, add them in <strong>step 03 · Images</strong> instead — that's where per-platform crops happen.
                </div>
              </>
            )}
          </div>
          <button onClick={() => setNotice(null)} className="p-2 -m-1 opacity-50 hover:opacity-100 transition" aria-label="Dismiss notice"><X size={14} /></button>
        </div>
      )}

      {project.files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="mp-mono text-[13px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
              {project.files.length} file{project.files.length === 1 ? '' : 's'} · {formatBytes(totalSize)} total
            </span>
            <button onClick={() => updateProject({ files: [] })} className="mp-mono text-[12px] uppercase tracking-[0.2em] opacity-60 hover:opacity-100 transition">
              Clear all
            </button>
          </div>
          <div className="space-y-2">
            {project.files.map(f => (
              <FileRow key={f.id} file={f} onRemove={() => removeFile(f.id)} onRename={(name) => renameFile(f.id, name)}
                onUpdateMakerWorld={(patch) => updateMakerWorldFile(f.id, patch)}
                onUpdatePrintables={(patch) => updatePrintablesFile(f.id, patch)}
                onUpdateFile={(patch) => updateFile(f.id, patch)} />
            ))}
          </div>
        </div>
      )}

      <FileSizeWarnings files={project.files} totalSize={totalSize} />

      <SectionNav
        backLabel={null}
        nextLabel="Continue to Details"
        nextDisabled={project.files.length === 0}
        disabledReason="Add at least one model file to continue"
        onNext={() => setCurrentSection('details')}
      />
    </div>
  );
}

export function FileRow({ file, onRemove, onRename, onUpdateMakerWorld, onUpdatePrintables, onUpdateFile }) {
  const isProf = file.isProfile;
  const isImg = file.isImage;
  const ext = fileExt(file.name);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(baseName);
  const supportsMakerWorld = isMakerWorldRegularFile(file.name) || isMakerWorldLaserFile(file.name);
  const supportsPrintables = PRINTABLES_FORMATS.includes(ext) && !isImg;
  const makerWorld = { note: '', openSource: true, folderPath: '', ...(file.makerWorld || {}) };
  const printables = { note: '', folder: '', ...(file.printables || {}) };
  const isPrintablesGcode = ext === 'gcode' || ext === 'bgcode';

  const startEdit = () => { setDraft(baseName); setEditing(true); };
  const commit = () => {
    const clean = draft.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\.+$/, '');
    if (clean && clean !== baseName) onRename(`${clean}.${ext}`);
    setEditing(false);
  };

  return (
    <div className="mp-card p-3">
      <div className="flex items-center gap-3">
      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: isProf ? '#FF5722' : isImg ? 'rgba(21,23,28,0.4)' : '#15171C' }}>
        {isProf ? <Layers size={16} color="#fff" /> : isImg ? <ImageIcon size={16} color="#EDE9DE" /> : <FileCheck size={16} color="#EDE9DE" />}
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              aria-label="New file name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
              className="mp-mono text-sm bg-transparent outline-none border-b flex-1 min-w-0"
              style={{ borderColor: '#FF5722' }}
            />
            <span className="mp-mono text-sm flex-shrink-0" style={{ color: 'rgba(21,23,28,0.66)' }}>.{ext}</span>
          </div>
        ) : (
          <button onClick={startEdit} className="mp-display font-bold text-sm truncate flex items-center gap-1.5 group/name max-w-full" title="Click to rename">
            <span className="truncate">{file.name}</span>
            <Edit3 size={11} className="opacity-0 group-hover/name:opacity-50 transition flex-shrink-0" />
          </button>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="mp-mono text-[12px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
            .{ext} · {formatBytes(file.size)}
          </span>
          {isProf && (
            <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: '#FF5722', color: '#fff' }}>
              Print profile
            </span>
          )}
          {isProf && onUpdateFile && (
            <select
              aria-label={`Slicer for ${file.name}`}
              title="Detected from the file's own metadata; override if the detection is wrong"
              className="mp-mono text-[11px] uppercase tracking-[0.15em] bg-transparent border px-1 py-0.5"
              style={{ borderColor: 'rgba(21,23,28,0.2)', color: 'rgba(21,23,28,0.7)' }}
              value={file.slicerOverride || ''}
              onChange={(e) => onUpdateFile({ slicerOverride: e.target.value || null })}
            >
              <option value="">
                {file.threemf ? `Auto: ${slicerLabel(file.threemf.slicer)}` : 'Detecting slicer…'}
              </option>
              {Object.entries(SLICERS).filter(([id]) => id !== 'unknown').map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          )}
          {isImg && (
            <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: 'rgba(21,23,28,0.4)', color: '#fff' }}>
              Reference image
            </span>
          )}
          {file.isLaserCut && (
            <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: 'rgba(255,105,0,0.14)', color: '#B23A1A' }}>
              Laser &amp; Cut
            </span>
          )}
        </div>
      </div>
      <button onClick={startEdit} className="p-2.5 opacity-60 hover:opacity-100 hover:text-[#FF5722] transition" aria-label="Rename file" title="Rename">
        <Edit3 size={15} />
      </button>
      <button onClick={onRemove} className="p-2.5 opacity-60 hover:opacity-100 hover:text-[#FF5722] transition" aria-label="Remove file" title="Remove">
        <Trash2 size={15} />
      </button>
      </div>
      {supportsMakerWorld && (
        <details className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
          <summary className="cursor-pointer mp-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'rgba(21,23,28,0.66)' }}>MakerWorld file settings</summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            <label className="text-[11px] space-y-1"><span>Folder path (optional)</span>
              <input className="mp-input text-[12px]" value={makerWorld.folderPath}
                placeholder="parts/large" onChange={(e) => onUpdateMakerWorld({ folderPath: e.target.value.replace(/^\/+|\/+$/g, '') })} />
            </label>
            <label className="text-[11px] space-y-1"><span>File note (optional)</span>
              <input className="mp-input text-[12px]" value={makerWorld.note} maxLength={500}
                placeholder="Print this part twice" onChange={(e) => onUpdateMakerWorld({ note: e.target.value })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-[11px] mt-2">
            <input type="checkbox" checked={makerWorld.openSource} onChange={(e) => onUpdateMakerWorld({ openSource: e.target.checked })} />
            Open Source — allow the raw file to be downloaded
          </label>
        </details>
      )}
      {supportsPrintables && (
        <details className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
          <summary className="cursor-pointer mp-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'rgba(21,23,28,0.66)' }}>Printables file settings</summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            <label className="text-[11px] space-y-1"><span>Folder path (optional)</span>
              <input className="mp-input text-[12px]" value={printables.folder}
                placeholder="parts/large" onChange={(e) => onUpdatePrintables({ folder: e.target.value.replace(/^\/+|\/+$/g, '') })} />
            </label>
            <label className="text-[11px] space-y-1"><span>File note (optional)</span>
              <input className="mp-input text-[12px]" value={printables.note} maxLength={PRINTABLES_FILE_NOTE_MAX}
                placeholder="Print this part twice" onChange={(e) => onUpdatePrintables({ note: e.target.value })} />
            </label>
            {isPrintablesGcode && (
              <label className="text-[11px] space-y-1"><span>Layer height (mm override)</span>
                <input className="mp-input text-[12px]" type="number" min="0.001" step="0.001"
                  value={printables.layerHeight ?? ''} placeholder="0.20"
                  onChange={(e) => onUpdatePrintables({ layerHeight: e.target.value })} />
              </label>
            )}
            {isPrintablesGcode && (
              <label className="text-[11px] space-y-1"><span>Nozzle diameter (mm override)</span>
                <input className="mp-input text-[12px]" type="number" min="0.01" step="0.01"
                  value={printables.nozzleDiameter ?? ''} placeholder="0.40"
                  onChange={(e) => onUpdatePrintables({ nozzleDiameter: e.target.value })} />
              </label>
            )}
            {isPrintablesGcode && (
              <label className="text-[11px] space-y-1"><span>Print duration (hours override)</span>
                <input className="mp-input text-[12px]" type="number" min="0.01" max="999" step="0.01"
                  value={printables.printDuration ?? ''} placeholder="1.5"
                  onChange={(e) => onUpdatePrintables({ printDuration: e.target.value })} />
              </label>
            )}
            {isPrintablesGcode && (
              <label className="text-[11px] space-y-1"><span>Printed weight (g override)</span>
                <input className="mp-input text-[12px]" type="number" min="1" step="1"
                  value={printables.weight ?? ''} placeholder="13"
                  onChange={(e) => onUpdatePrintables({ weight: e.target.value })} />
              </label>
            )}
          </div>
          {isPrintablesGcode && (
            <label className="flex items-center gap-2 text-[11px] mt-2">
              <input type="checkbox" checked={!!printables.excludeFromTotalSum}
                onChange={(e) => onUpdatePrintables({ excludeFromTotalSum: e.target.checked })} />
              Exclude this G-code from the model totals
            </label>
          )}
          <p className="text-[10px] mt-1.5" style={{ color: 'rgba(21,23,28,0.66)' }}>
            File notes are limited to {PRINTABLES_FILE_NOTE_MAX} characters. Each folder path segment is limited to {PRINTABLES_FOLDER_NAME_MAX} characters. Specialist overrides are used when Printables cannot inspect them from the file. Printables file order follows the file order shown above.
          </p>
        </details>
      )}
    </div>
  );
}

// Conservative compatibility warning for platforms with smaller/unknown caps.
// Nexprint itself accepts 2 GiB model/attachment files; each platform preflight
// remains authoritative.
const COMMON_FILE_MB = 100;

function FileSizeWarnings({ files, totalSize }) {
  const mb = (b) => b / 1024 / 1024;
  const totalMb = mb(totalSize);
  const warnings = [];
  // Per-file: flag anything most platforms will reject.
  files.forEach(f => {
    const fm = mb(f.size);
    if (fm > COMMON_FILE_MB) {
      warnings.push({ platform: 'Most platforms', limit: `${COMMON_FILE_MB}MB per file`, current: `${fm.toFixed(0)}MB (${f.name})` });
    }
  });
  if (totalMb > 250) warnings.push({ platform: 'MakerWorld', limit: '250MB total', current: `${totalMb.toFixed(0)}MB` });
  files.filter(f => f.isProfile).forEach(f => {
    if (mb(f.size) > 150) {
      warnings.push({ platform: 'MakerWorld', limit: '150MB per profile', current: `${mb(f.size).toFixed(0)}MB (${f.name})` });
    }
  });
  if (warnings.length === 0) return null;
  return (
    <div className="mt-4 p-3 flex items-start gap-3" style={{ background: 'rgba(255,87,34,0.08)', border: '1px solid rgba(255,87,34,0.3)' }}>
      <AlertCircle size={16} style={{ color: '#FF5722' }} className="flex-shrink-0 mt-0.5" />
      <div className="text-xs">
        <div className="mp-display font-bold mb-1">Size warnings</div>
        {warnings.map((w, i) => (
          <div key={i}>
            <span className="mp-mono text-[12px] uppercase tracking-wider">{w.platform}</span>: {w.limit} exceeded ({w.current})
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// SECTION: DETAILS
// =====================================================================

const AI_TAG_SUGGESTIONS = {
  'dragon':    ['articulated', 'flexi', 'fidget', 'no-supports', 'print-in-place', 'figurine', 'fantasy'],
  'phone':     ['stand', 'holder', 'desk', 'organizer', 'accessory', 'tech'],
  'planter':   ['plant', 'pot', 'garden', 'home-decor', 'succulent', 'indoor'],
  'box':       ['storage', 'container', 'organizer', 'modular', 'gridfinity', 'functional'],
  'figure':    ['figurine', 'collectible', 'display', 'detailed', 'miniature'],
  'desk':      ['organizer', 'office', 'workspace', 'functional', 'productivity'],
  'default':   ['functional', 'easy-print', 'no-supports', '3d-print', 'useful', 'design'],
};

function aiSuggestTags(title) {
  const t = title.toLowerCase();
  for (const k of Object.keys(AI_TAG_SUGGESTIONS)) {
    if (k !== 'default' && t.includes(k)) return AI_TAG_SUGGESTIONS[k];
  }
  return AI_TAG_SUGGESTIONS.default;
}

// data:image/jpeg;base64,XXXX → { base64, mediaType } for the AI endpoint.
function dataUrlToParts(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
  if (!m) return null;
  return { mediaType: m[1], base64: m[2] };
}

// Provider registry, stored configuration, detection and error vocabulary all live in
// lib/ai-providers.js; this file only wires them to the UI and to the actual calls.

// Default platform selection — which platforms a NEW project starts with enabled.
// null = the user hasn't customised it → use initialProject's built-in defaults.
const DEFAULT_PLATFORMS_KEY = 'modelprep:default-platforms';
function getDefaultPlatforms() {
  try { const v = JSON.parse(localStorage.getItem(DEFAULT_PLATFORMS_KEY) || 'null'); return Array.isArray(v) ? v : null; }
  catch { return null; }
}
function setDefaultPlatforms(ids) { try { localStorage.setItem(DEFAULT_PLATFORMS_KEY, JSON.stringify(ids)); } catch { /* quota */ } }
// Apply the saved default selection onto a platforms map (no-op if none saved).
function applyDefaultPlatforms(platforms) {
  const ids = getDefaultPlatforms();
  if (!ids) return platforms;
  const out = {};
  for (const k of Object.keys(platforms)) out[k] = { ...platforms[k], enabled: ids.includes(k) };
  return out;
}

// Minimal client-side mirror of the Worker's prompt + JSON parse, used ONLY for the local
// (Ollama) path that can't go through the Worker.
function aiSystemPrompt(limits, categories) {
  const lim = limits || {}; const rules = [];
  if (lim.titleMax) rules.push(`- Title: at most ${lim.titleMax} characters.`);
  if (lim.descMax) rules.push(`- Description: at most ${lim.descMax} characters.`);
  if (lim.tagMax) rules.push(`- Tags: at most ${lim.tagMax} tags.`);
  if (lim.tagCharMax) rules.push(`- Each tag: at most ${lim.tagCharMax} characters.`);
  return [
    'You write listings for 3D-printable models. You are given real photos of a printed model (and maybe a one-line hint).',
    'Return STRICT JSON only (no prose, no code fences) with keys:',
    '{"title": string, "description": string (Markdown), "tags": string[], "category": string, "realPhotoDetected": boolean, "notes": string}',
    `Category must be EXACTLY ONE of, copied verbatim, or "": ${JSON.stringify(categories || [])}.`,
    'Tags: lowercase, relevant, no "#", no duplicates. Be accurate; do not invent features you cannot see.',
    ...(rules.length ? ['Hard limits (obey exactly):', ...rules] : []),
  ].join('\n');
}
function parseAiListing(text, categories, limits) {
  let raw = (text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) raw = fence[1].trim();
  if (raw[0] !== '{') { const i = raw.indexOf('{'), j = raw.lastIndexOf('}'); if (i >= 0 && j > i) raw = raw.slice(i, j + 1); }
  const obj = JSON.parse(raw); const lim = limits || {};
  let title = String(obj.title || '').trim(); if (lim.titleMax) title = title.slice(0, lim.titleMax).trim();
  let description = String(obj.description || '').trim(); if (lim.descMax) description = description.slice(0, lim.descMax).trim();
  let tags = Array.isArray(obj.tags) ? [...new Set(obj.tags.map(t => String(t).trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')).filter(Boolean))] : [];
  if (lim.tagCharMax) tags = tags.filter(t => t.length <= lim.tagCharMax);
  if (lim.tagMax) tags = tags.slice(0, lim.tagMax);
  let category = String(obj.category || '').trim();
  if (category && !(categories || []).includes(category)) category = (categories || []).find(c => c.toLowerCase() === category.toLowerCase()) || '';
  return { title, description, tags, category, realPhotoDetected: obj.realPhotoDetected === true, notes: String(obj.notes || '').trim() || undefined };
}

// Desktop bridge, or null in the browser build.
function desktopBridge() {
  return (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop) ? window.modelprepDesktop : null;
}

// The instruction that follows the photos, shared by every provider.
function aiUserInstruction(hint) {
  return hint?.trim()
    ? `Maker's one-line hint: "${hint.trim()}". Write the listing for the model in these photos.`
    : 'Write the listing for the model in these photos.';
}

// Local model server (Ollama, LM Studio). Routed through the desktop main process, which can
// call http://localhost without the server having to allow this origin — otherwise every
// maker would have to set OLLAMA_ORIGINS before a free local model worked at all.
async function callLocalHttpListing({ providerId, baseUrl, model, parts, hint, limits, categories }) {
  const bridge = desktopBridge();
  if (!bridge?.localAiChat) throw new Error(`${AI_PROVIDERS[providerId]?.name || 'Local model'} needs the ModelPrep desktop app`);
  const content = parts.map(p => ({ type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.base64}` } }));
  content.push({ type: 'text', text: aiUserInstruction(hint) });
  const res = await bridge.localAiChat({
    baseUrl: baseUrl || AI_PROVIDERS[providerId]?.baseUrl,
    model,
    messages: [{ role: 'system', content: aiSystemPrompt(limits, categories) }, { role: 'user', content }],
  });
  if (!res?.ok) throw new Error(res?.error || `${AI_PROVIDERS[providerId]?.name || providerId} failed`);
  return parseAiListing(res.text, categories, limits);
}

// Cloud provider, proxied through the Worker with the maker's own key per request.
async function callCloudListing({ providerId, apiKey, model, baseUrl, parts, hint, limits, categories }) {
  const res = await fetch(`${WORKER_URL}/api/v1/ai/generate-listing`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: providerId, apiKey, model, baseUrl, images: parts, hint: hint || '', categories: categories || [], limits: limits || {} }),
  });
  if (res.ok) {
    const d = await res.json();
    return { title: d.title || '', description: d.description || '', tags: d.tags || [], category: d.category || '', notes: d.notes, realPhotoDetected: d.realPhotoDetected };
  }
  const body = await res.json().catch(() => ({}));
  const detail = body.error === 'missing_key' ? 'No API key saved for this provider'
    : body.error === 'missing_model' ? 'No model chosen for this provider'
    : body.message || body.error || `provider error ${res.status}`;
  throw new Error(`${res.status}: ${detail}`);
}

// Renderer → desktop → local `codex exec`. Costs $0 beyond the ChatGPT/Codex subscription the
// maker already has: no API key, and the photos never leave the machine except through the
// maker's own Codex session. The CLI takes one prompt (no system/user split), so the shared
// system prompt and the per-run instruction are concatenated.
async function callCliListing({ providerId, model, binPath, parts, hint, limits, categories }) {
  const meta = AI_PROVIDERS[providerId];
  const bridge = desktopBridge();
  if (!bridge?.generateCliListing) throw new Error(`${meta?.name || 'This CLI'} needs the ModelPrep desktop app`);
  const res = await bridge.generateCliListing({
    agent: meta.agent,
    prompt: `${aiSystemPrompt(limits, categories)}\n\n${aiUserInstruction(hint)}`,
    images: parts, model: model || '', binPath: binPath || '',
  });
  if (!res?.ok) throw new Error(res?.error || `${meta?.name || providerId} failed`);
  return parseAiListing(res.text, categories, limits);
}

/** One callable per configured provider, ready for `runListingChain`. */
function listingCallers({ config, parts, hint, limits, categories }) {
  const callers = {};
  for (const providerId of aiChain(config)) {
    const meta = AI_PROVIDERS[providerId];
    const settings = providerSettings(config, providerId);
    const shared = { parts, hint, limits, categories };
    if (meta.kind === 'cli') {
      callers[providerId] = () => callCliListing({ providerId, model: settings.model, binPath: settings.binPath, ...shared });
    } else if (meta.kind === 'local-http') {
      callers[providerId] = () => callLocalHttpListing({ providerId, baseUrl: settings.baseUrl || meta.baseUrl, model: settings.model, ...shared });
    } else {
      callers[providerId] = () => callCloudListing({ providerId, apiKey: settings.apiKey, model: settings.model || meta.defaultModel, baseUrl: settings.baseUrl, ...shared });
    }
  }
  return callers;
}

// Generate Title/Description/Tags/Category from the project's photos + an optional one-line
// hint. Tries each configured provider in turn, so a maker who has run out of monthly quota
// on one keeps working on the next, and falls back to an on-device draft when the whole chain
// declines — the button always does *something*.
// Returns { fields, source: 'ai' | 'offline', providerId?, attempts, notes?, realPhotoDetected? }.
async function generateListingAI({ images, hint, limits, categories, onAttempt }) {
  const config = readAiConfig();
  // Down-rez to keep the request small + cheap; vision doesn't need full res.
  const parts = [];
  for (const img of (images || []).slice(0, 8)) {
    try {
      const blob = await cropImageToBlob(img, 1024, 768, 'image/jpeg', 0.8);
      const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(blob); });
      const p = dataUrlToParts(dataUrl); if (p) parts.push(p);
    } catch { /* skip unreadable image */ }
  }

  let attempts = [];
  if (parts.length) {
    const outcome = await runListingChain({
      chain: aiChain(config),
      callers: listingCallers({ config, parts, hint, limits, categories }),
      onAttempt,
    });
    if (outcome.ok) {
      const fields = outcome.fields;
      return { source: 'ai', providerId: outcome.providerId, attempts: outcome.attempts, notes: fields.notes, realPhotoDetected: fields.realPhotoDetected, fields };
    }
    attempts = outcome.attempts;
  }

  // ── Offline heuristic fallback ──────────────────────────────────────────
  const seed = (hint || '').trim();
  const title = seed
    ? seed.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, limits?.titleMax || 120)
    : '';
  const tags = [...new Set(aiSuggestTags(seed || 'thing'))].slice(0, limits?.tagMax || 20);
  const description = seed
    ? `# ${title}\n\n${seed}.\n\n## Print settings\n- Layer height: 0.2 mm\n- Material: PLA\n- Supports: as needed\n`
    : '';
  return { source: 'offline', attempts, providerError: chainFailureMessage(attempts), fields: { title, description, tags, category: '' } };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI SETTINGS
//
// The panel answers three questions in order: who is writing my listings, what else could,
// and why isn't this one working. Providers are detected on open, so the common case is one
// click — "Use this" — and everything else (model, endpoint, chain position) is filled in.

const AI_TONE = {
  ready:   { fg: '#1a7f37', bg: 'rgba(26,127,55,0.10)', label: 'Ready' },
  setup:   { fg: '#8a5a00', bg: 'rgba(138,90,0,0.10)',  label: 'Needs setup' },
  key:     { fg: 'rgba(21,23,28,0.55)', bg: 'rgba(21,23,28,0.06)', label: 'Needs key' },
  missing: { fg: 'rgba(21,23,28,0.45)', bg: 'rgba(21,23,28,0.05)', label: 'Not found' },
  unsupported: { fg: 'rgba(21,23,28,0.45)', bg: 'rgba(21,23,28,0.05)', label: 'Desktop only' },
  checking: { fg: 'rgba(21,23,28,0.45)', bg: 'rgba(21,23,28,0.05)', label: 'Checking' },
  error:   { fg: '#991b1b', bg: 'rgba(185,28,28,0.08)', label: 'Problem' },
};

const aiLabelClass = 'mp-mono text-[10px] uppercase tracking-[0.12em] block mb-1';
const aiMuted = 'rgba(21,23,28,0.55)';

function AiStatusChip({ state }) {
  const tone = AI_TONE[state] || AI_TONE.missing;
  return (
    <span className="mp-pill shrink-0" style={{ background: tone.bg, color: tone.fg }}>
      {state === 'checking' && <Loader size={9} className="mp-spin mr-1" />}
      {tone.label}
    </span>
  );
}

// Anything a maker has to act on: a rejected key, an exhausted quota, a server that is not
// running. Always states the problem and the fix, and keeps the provider's own words.
function AiProblem({ title, fix, detail, tone = 'warn' }) {
  const colors = tone === 'error'
    ? { fg: '#991b1b', bg: 'rgba(185,28,28,0.06)', border: 'rgba(185,28,28,0.30)' }
    : { fg: '#7a4f00', bg: 'rgba(138,90,0,0.07)', border: 'rgba(138,90,0,0.30)' };
  return (
    <div role="status" className="p-2.5 text-[12px] leading-relaxed break-words" style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.fg }}>
      <span className="font-semibold">{title}</span>{fix ? ` — ${fix}` : ''}
      {detail ? <div className="mp-mono text-[10px] mt-1 opacity-70 break-all">{detail}</div> : null}
    </div>
  );
}

/** Model picker: a dropdown when we know what the provider offers, a text box when we don't.
 *  A saved model missing from the catalog is kept and marked, never silently replaced. */
function AiModelField({ providerId, models, value, onChange, placeholder }) {
  const id = `ai-model-${providerId}`;
  const options = useMemo(() => {
    if (!models?.length) return [];
    if (!value || models.some((m) => m.slug === value)) return models;
    return [...models, { slug: value, label: `${value} (not offered by your plan)` }];
  }, [models, value]);

  return (
    <div className="min-w-0">
      <label className={aiLabelClass} htmlFor={id} style={{ color: aiMuted }}>Model</label>
      {options.length ? (
        <select id={id} className="mp-input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Recommended default</option>
          {options.map((m) => <option key={m.slug} value={m.slug}>{m.label}</option>)}
        </select>
      ) : (
        <input id={id} className="mp-input" value={value || ''} placeholder={placeholder || 'model name'} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function AiProviderRow({ meta, detection, config, models, expanded, onToggle, onUse, onBackup, onRemove, onSettings, onCheckKey, checking }) {
  const id = meta.id;
  const settings = providerSettings(config, id);
  const isPrimary = config.primary === id;
  const backupIndex = (config.fallbacks || []).indexOf(id);
  const inChain = isPrimary || backupIndex >= 0;
  const state = detection?.state || 'checking';
  const usable = state === 'ready' || (meta.kind === 'cloud' && !!settings.apiKey);
  const problem = detection?.error || null;

  return (
    <div className="mp-card" style={{ borderColor: isPrimary ? 'rgba(255,87,34,0.55)' : 'rgba(21,23,28,0.12)' }}>
      <div className="flex items-start gap-3 p-3">
        <button
          type="button" onClick={onToggle} aria-expanded={expanded}
          className="flex-1 min-w-0 text-left flex items-start gap-2"
        >
          <ChevronRight size={14} className="mt-0.5 shrink-0 transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'none', color: aiMuted }} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold">{meta.name}</span>
              {isPrimary && <span className="mp-pill" style={{ background: 'rgba(255,87,34,0.12)', color: '#B23C15' }}>Primary</span>}
              {backupIndex >= 0 && <span className="mp-pill" style={{ background: 'rgba(21,23,28,0.06)', color: aiMuted }}>Backup {backupIndex + 1}</span>}
            </span>
            <span className="block text-[12px] mt-0.5 break-words" style={{ color: aiMuted }}>
              {detection?.detail || meta.cost}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <AiStatusChip state={problem && state === 'ready' ? 'error' : state} />
          {/* One obvious next step per row: use it, or open the one thing standing in the way. */}
          {usable && !isPrimary && (
            <button type="button" className="mp-btn mp-btn-ghost text-[12px]" style={{ minHeight: 32, padding: '0.3rem 0.7rem' }} onClick={onUse}>
              {inChain ? 'Make primary' : 'Use this'}
            </button>
          )}
          {/* A provider that only needs explaining gets a quiet link, not a second solid
              button — otherwise every row shouts equally and the ready one stops standing out. */}
          {!usable && state !== 'checking' && !expanded && (
            <button
              type="button" onClick={onToggle}
              className="mp-mono text-[10px] uppercase tracking-[0.12em] shrink-0 hover:text-[#FF5722] transition"
              style={{ color: aiMuted }}
            >
              {meta.kind === 'cloud' ? 'Add key' : state === 'setup' ? 'Finish setup' : 'What’s needed'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.10)' }}>
          <p className="text-[12px] leading-relaxed break-words" style={{ color: aiMuted }}>{meta.blurb}</p>

          {detection?.warning && <AiProblem title="Heads up" fix={detection.warning} />}
          {problem && <AiProblem title={problem.title || 'Needs a step first'} fix={problem.message || problem.fix} detail={problem.detail} tone={problem.code === 'auth' ? 'warn' : 'warn'} />}
          {state === 'missing' && meta.setupHint && <AiProblem title="Not set up yet" fix={meta.setupHint} />}
          {state === 'unsupported' && <AiProblem title="Desktop app only" fix="A web page cannot start a program on your computer. Open the ModelPrep desktop app to use this." />}

          {meta.kind === 'cloud' && (
            <div className="space-y-3">
              <div className="min-w-0">
                <label className={aiLabelClass} htmlFor={`ai-key-${id}`} style={{ color: aiMuted }}>API key</label>
                <div className="flex gap-2 flex-wrap">
                  <input
                    id={`ai-key-${id}`} type="password" autoComplete="off" className="mp-input flex-1" style={{ minWidth: 180 }}
                    value={settings.apiKey || ''} placeholder="sk-…"
                    onChange={(e) => onSettings({ apiKey: e.target.value })}
                  />
                  <button type="button" className="mp-btn mp-btn-ghost text-[13px] shrink-0" style={{ minHeight: 44 }} onClick={onCheckKey} disabled={checking}>
                    {checking ? <Loader size={13} className="mp-spin" /> : <Check size={13} />} Check key
                  </button>
                </div>
                <p className="text-[11px] mt-1" style={{ color: aiMuted }}>Stored in this browser only, and sent with each request.</p>
              </div>
              {meta.custom && (
                <div className="min-w-0">
                  <label className={aiLabelClass} htmlFor={`ai-url-${id}`} style={{ color: aiMuted }}>Endpoint</label>
                  <input id={`ai-url-${id}`} className="mp-input" value={settings.baseUrl || ''} placeholder="https://…/v1" onChange={(e) => onSettings({ baseUrl: e.target.value })} />
                </div>
              )}
            </div>
          )}

          {(usable || inChain) && (
            <AiModelField
              providerId={id} models={models} value={settings.model}
              placeholder={meta.defaultModel || 'model name'}
              onChange={(model) => onSettings({ model })}
            />
          )}

          {/* Only worth showing when the automatic lookup failed, or when a maker has already
              overridden it. Asking everyone else for a path they do not need is noise. */}
          {meta.kind === 'cli' && (state !== 'ready' || settings.binPath) && (
            <div className="min-w-0">
              <label className={aiLabelClass} htmlFor={`ai-bin-${id}`} style={{ color: aiMuted }}>Program location</label>
              <input id={`ai-bin-${id}`} className="mp-input" value={settings.binPath || ''} placeholder="Found automatically" onChange={(e) => onSettings({ binPath: e.target.value })} />
              <p className="text-[11px] mt-1" style={{ color: aiMuted }}>Only needed if ModelPrep cannot find it on its own.</p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {usable && !isPrimary && <button type="button" className="mp-btn text-[13px]" style={{ minHeight: 36 }} onClick={onUse}>Use for listings</button>}
            {usable && !inChain && <button type="button" className="mp-btn mp-btn-ghost text-[13px]" style={{ minHeight: 36 }} onClick={onBackup}>Add as backup</button>}
            {inChain && <button type="button" className="mp-btn mp-btn-ghost text-[13px]" style={{ minHeight: 36 }} onClick={onRemove}>Remove from chain</button>}
            {meta.setupUrl && (
              <a href={meta.setupUrl} target="_blank" rel="noreferrer" className="text-[12px] underline" style={{ color: '#B23C15' }}>
                {meta.kind === 'cloud' ? 'Get a key' : 'Install guide'}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AiSettings() {
  const [config, setConfig] = useState(() => readAiConfig());
  const [detected, setDetected] = useState(null);        // null = first check running
  const [expanded, setExpanded] = useState('');
  const [checkingKey, setCheckingKey] = useState('');
  const [keyResults, setKeyResults] = useState({});      // provider id → { models, error }
  const desktop = desktopBridge();

  const scan = useCallback(async () => {
    setDetected(null);
    const result = await detectProviders({ desktop });
    setDetected(result);
    return result;
  }, [desktop]);

  useEffect(() => { let live = true; detectProviders({ desktop }).then((r) => { if (live) setDetected(r); }); return () => { live = false; }; }, [desktop]);

  const commit = (next) => { setConfig(next); writeAiConfig(next); };
  const chain = aiChain(config);

  // Models we know about for a provider: detected (local) or returned by the key check (cloud).
  const modelsFor = (id) => keyResults[id]?.models || detected?.[id]?.models || [];

  // "Use this" has to leave nothing else to do: pick the provider, and pick a model for it if
  // one is needed and none is saved.
  const useProvider = (id) => {
    const models = modelsFor(id);
    const settings = providerSettings(config, id);
    const model = settings.model || (AI_PROVIDERS[id].kind === 'cloud' ? (models[0]?.slug || AI_PROVIDERS[id].defaultModel || '') : (AI_PROVIDERS[id].kind === 'local-http' ? models[0]?.slug || '' : ''));
    commit(setPrimaryProvider(config, id, model ? { model } : {}));
    setExpanded('');
  };

  const checkKey = async (id) => {
    setCheckingKey(id);
    const settings = providerSettings(config, id);
    const result = await checkCloudProvider({ id, apiKey: settings.apiKey, baseUrl: settings.baseUrl });
    setKeyResults((prev) => ({ ...prev, [id]: result }));
    setCheckingKey('');
  };

  // Ready first, then anything one step away, then the rest — the useful ones stay on top.
  const order = { ready: 0, setup: 1, key: 2, checking: 3, missing: 4, unsupported: 5 };
  const rows = AI_PROVIDER_IDS
    .map((id) => ({ id, meta: AI_PROVIDERS[id], detection: detected?.[id] }))
    .sort((a, b) => {
      const rank = (row) => (config.primary === row.id ? -2 : chain.includes(row.id) ? -1 : order[row.detection?.state] ?? 9);
      return rank(a) - rank(b);
    });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="mp-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: aiMuted }}>Writing your listings</div>
          <p className="text-[13px] mt-1 break-words">
            {chain.length
              ? <>ModelPrep asks <strong>{AI_PROVIDERS[chain[0]].name}</strong>{chain.length > 1 ? <>, then {chain.slice(1).map((id) => AI_PROVIDERS[id].name).join(', ')} if that fails</> : null}.</>
              : <>No AI picked yet — ModelPrep writes a basic draft from your hint. Choose one below to write from your photos.</>}
          </p>
        </div>
        <button
          type="button" onClick={scan} disabled={detected === null}
          className="mp-mono text-[10px] uppercase tracking-[0.12em] flex items-center gap-1.5 shrink-0 mt-1 hover:text-[#FF5722] transition disabled:opacity-50"
          style={{ color: aiMuted }}
        >
          <RefreshCw size={11} className={detected === null ? 'mp-spin' : ''} /> {detected === null ? 'Checking' : 'Check again'}
        </button>
      </div>

      {chain.length > 1 && (
        <p className="text-[11px]" style={{ color: aiMuted }}>
          Backups take over automatically — useful when a monthly quota runs out mid-batch.
        </p>
      )}

      <div className="space-y-2">
        {rows.map(({ id, meta, detection }) => (
          <AiProviderRow
            key={id}
            meta={meta}
            detection={keyResults[id]?.error ? { ...detection, error: keyResults[id].error } : detection}
            config={config}
            models={modelsFor(id)}
            expanded={expanded === id}
            checking={checkingKey === id}
            onToggle={() => setExpanded(expanded === id ? '' : id)}
            onUse={() => useProvider(id)}
            onBackup={() => commit(addFallbackProvider(config, id))}
            onRemove={() => commit(removeProvider(config, id))}
            onSettings={(patch) => commit(updateProviderSettings(config, id, patch))}
            onCheckKey={() => checkKey(id)}
          />
        ))}
      </div>
    </div>
  );
}

function CategorySelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = options.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(''); }}
        className="mp-input flex items-center justify-between text-left"
        style={{ color: value ? '#15171C' : 'rgba(21,23,28,0.45)' }}
      >
        <span className="truncate">{value || 'Choose a category…'}</span>
        <ChevronDown size={14} style={{ color: 'rgba(21,23,28,0.66)' }} className="flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 mp-card shadow-lg" style={{ background: '#FFFFFF' }}>
          <div className="flex items-center gap-2 px-2.5 py-2 border-b" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
            <Search size={13} style={{ color: 'rgba(21,23,28,0.66)' }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search categories"
              placeholder="Search categories…"
              className="bg-transparent outline-none text-xs flex-1"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-[13px]" style={{ color: 'rgba(21,23,28,0.66)' }}>No match for “{query}”.</div>
            )}
            {filtered.map(o => (
              <button
                key={o}
                type="button"
                onClick={() => { onChange(o); setOpen(false); }}
                className="w-full text-left px-3 py-2.5 text-xs hover:bg-[rgba(255,87,34,0.08)] transition flex items-center justify-between"
                style={{ background: value === o ? 'rgba(255,87,34,0.06)' : 'transparent' }}
              >
                <span>{o}</span>
                {value === o && <Check size={12} style={{ color: '#FF5722' }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const LICENSE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'commercial', label: '$ Commercial OK' },
  { id: 'noncommercial', label: 'Non-commercial' },
  { id: 'remix', label: '↻ Remix OK' },
  { id: 'noderiv', label: 'No derivatives' },
];

function matchesLicenseFilter(l, f) {
  if (f === 'commercial') return l.commercial;
  if (f === 'noncommercial') return !l.commercial;
  if (f === 'remix') return l.derivatives;
  if (f === 'noderiv') return !l.derivatives;
  return true;
}

function DetailsSection({ project, updateProject, setCurrentSection }) {
  useAccounts();
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestBusy, setTagSuggestBusy] = useState(false);
  const [tagSuggestMsg, setTagSuggestMsg] = useState('');
  const [previewMode, setPreviewMode] = useState('write'); // write | preview | formats
  const [aiHint, setAiHint] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState(null); // { kind:'ok'|'warn', text }
  const openSettings = useOpenConnections();
  const aiPrimary = readAiConfig().primary;
  const [licenseFilter, setLicenseFilter] = useState('all');
  const [showLicenseChooser, setShowLicenseChooser] = useState(false);

  const visibleLicenses = LICENSES.filter(l => matchesLicenseFilter(l, licenseFilter));
  const selectedLicense = LICENSES.find((license) => license.id === project.license);

  // Strictest limits across the platforms the user is actually targeting (all of them
  // until any are enabled, so we warn against the tightest possible case up front).
  const targeted = PLATFORMS.filter(p => project.platforms?.[p.id]?.enabled);
  const lim = effectiveLimits(targeted.length ? targeted : PLATFORMS);
  const MAX_TAGS = lim.tagMax ?? 50;
  const titleOver = lim.titleMax && project.title.length > lim.titleMax;
  const descOver = lim.descMax && project.description.length > lim.descMax;
  const longTags = lim.tagCharMax ? project.tags.filter(t => t.length > lim.tagCharMax) : [];

  // ✨ Generate Title/Description/Tags/Category from the photos (+ optional hint).
  const runGenerate = async () => {
    if (aiBusy) return;
    if (!project.images.length && !aiHint.trim()) {
      setAiMsg({ kind: 'warn', text: 'Add photos in step 03 (or type a one-line hint) first.' });
      return;
    }
    setAiBusy(true); setAiMsg(null);
    try {
      const out = await generateListingAI({ images: project.images, hint: aiHint, limits: lim, categories: CATEGORIES });
      const f = out.fields;
      const patch = {};
      if (f.title) patch.title = f.title;
      if (f.description) patch.description = f.description;
      if (f.tags?.length) patch.tags = [...new Set(f.tags)];
      if (f.category) patch.category = f.category;
      if (Object.keys(patch).length) updateProject(patch);
      const filled = Object.keys(patch).map(k => k === 'tags' ? `${patch.tags.length} tags` : k).join(', ') || 'nothing';
      // Name whoever actually wrote it. When a backup stepped in, say why the first one didn't
      // — a maker seeing "quota" on their primary knows exactly what to do about it.
      const wrote = out.source === 'ai' ? ` by ${AI_PROVIDERS[out.providerId]?.name || 'AI'}` : '';
      const skipped = out.attempts?.length
        ? ` ${out.attempts.map((a) => `${AI_PROVIDERS[a.providerId]?.name || a.providerId} was skipped (${a.error.title.toLowerCase()})`).join('; ')}.`
        : '';
      const tail = out.source === 'offline'
        ? ` ${out.providerError}`
        : `${skipped}${out.realPhotoDetected === false ? ' ⚠ No real print photo detected — MakerWorld requires one.' : ''}`;
      setAiMsg({
        kind: out.source === 'offline' || out.realPhotoDetected === false ? 'warn' : 'ok',
        text: `Generated ${filled}${wrote}.${out.notes ? ' ' + out.notes : ''}${tail}`,
      });
    } catch (e) {
      setAiMsg({ kind: 'warn', text: 'Generation failed — ' + String((e && e.message) || e) });
    } finally { setAiBusy(false); }
  };

  const addTag = (raw) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || project.tags.includes(t) || project.tags.length >= MAX_TAGS) return;
    updateProject({ tags: [...project.tags, t] });
  };
  const removeTag = (t) => updateProject({ tags: project.tags.filter(x => x !== t) });

  const handleTagKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); addTag(tagInput); setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && project.tags.length) {
      removeTag(project.tags[project.tags.length - 1]);
    }
  };

  const suggestTags = async () => {
    const room = MAX_TAGS - project.tags.length;
    if (room <= 0) return;
    setTagSuggestBusy(true); setTagSuggestMsg('');
    try {
      let suggestions = [];
      const makerWorldAccount = project.platforms?.makerworld?.enabled ? getActive('makerworld') : null;
      if (makerWorldAccount?.secret) {
        const keyword = tagInput.trim() || project.title.trim() || 'model';
        const response = await makerWorldFetch(
          `${WORKER_URL}/api/v1/makerworld/web/suggest-tags?keyword=${encodeURIComponent(keyword)}`,
          { headers: { 'X-MW-Cookie': makerWorldAccount.secret } },
          makerWorldAccount.secret,
        );
        const data = await response.json().catch(() => ({}));
        if (response.ok) suggestions = (data.suggestions || []).map((item) => item.text).filter(Boolean);
      }
      if (!suggestions.length) {
        suggestions = aiSuggestTags(project.title || 'thing');
        setTagSuggestMsg(makerWorldAccount ? 'MakerWorld had no suggestions; used local suggestions.' : 'Connect MakerWorld for live tag suggestions.');
      }
      const newTags = suggestions.map((tag) => String(tag).trim().toLowerCase().replace(/\s+/g, '-'))
        .filter((tag) => tag && !project.tags.includes(tag)).slice(0, Math.min(5, room));
      updateProject({ tags: [...project.tags, ...newTags] });
    } catch (error) {
      const suggestions = aiSuggestTags(project.title || 'thing');
      const newTags = suggestions.filter((tag) => !project.tags.includes(tag)).slice(0, Math.min(5, room));
      updateProject({ tags: [...project.tags, ...newTags] });
      setTagSuggestMsg(`Live suggestions unavailable; used local suggestions. ${error instanceof Error ? error.message : String(error)}`);
    } finally { setTagSuggestBusy(false); }
  };

  return (
    <div className="w-full min-w-0">
      <SectionHeader
        number="02"
        title="Project details"
        subtitle="Set shared metadata; ModelPrep adapts it for each publishing platform."
      />

      {/* ✨ AI generate — reads the photos (+ an optional one-line hint) and fills in
          Title, Description, Tags and Category. The most you ever type is one line. */}
      <div className="mp-card p-4 mt-6" style={{ background: 'rgba(255,87,34,0.05)', borderColor: 'rgba(255,87,34,0.3)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={15} style={{ color: '#FF5722' }} />
          <span className="mp-mono text-[12px] uppercase tracking-[0.15em]" style={{ color: '#FF5722' }}>Generate with AI</span>
          <span className="text-[12px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
            from your {project.images.length} photo{project.images.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => openSettings('ai')}
            className="ml-auto mp-mono text-[11px] uppercase tracking-[0.12em] flex items-center gap-1 hover:text-[#FF5722] transition"
            style={{ color: 'rgba(21,23,28,0.66)' }}
            title="Configure the AI provider in Settings"
          >
            <Settings size={11} /> {aiPrimary ? (AI_PROVIDERS[aiPrimary]?.name || 'AI') : 'Set up AI'}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="mp-input flex-1"
            placeholder="Optional one-line hint, e.g. “articulating desk dragon, PLA, no supports”"
            value={aiHint}
            onChange={(e) => setAiHint(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runGenerate(); }}
            disabled={aiBusy}
          />
          <button
            onClick={runGenerate}
            disabled={aiBusy}
            className="mp-btn text-[13px] py-2 px-4 disabled:opacity-50 flex items-center gap-1.5 justify-center"
            style={{ background: '#FF5722', borderColor: '#FF5722', color: '#fff' }}
          >
            {aiBusy ? <><Loader size={13} className="animate-spin" /> Generating…</> : <><Sparkles size={13} /> Generate</>}
          </button>
        </div>
        {aiMsg && (
          <p className="text-[12px] mt-2" style={{ color: aiMsg.kind === 'warn' ? '#c83f10' : 'rgba(21,23,28,0.6)' }}>
            {aiMsg.text}
          </p>
        )}
        <p className="text-[11px] mt-2" style={{ color: 'rgba(21,23,28,0.66)' }}>
          Looks at your print photos to write everything — you review and tweak below. Respects each platform's length/tag limits.
          {!aiPrimary && ' Right now it writes from your hint alone — pick an AI in Settings to write from the photos themselves.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="mb-0">Title</Label>
              {lim.titleMax && (
                <span className="mp-mono text-[12px]" style={{ color: titleOver ? '#FF5722' : 'rgba(21,23,28,0.4)' }}>
                  {project.title.length}/{lim.titleMax}
                  {titleOver && ` · over ${lim.titleMaxBy}'s limit`}
                </span>
              )}
            </div>
            <input
              className="mp-input"
              placeholder="e.g. Articulating Desk Dragon"
              value={project.title}
              onChange={(e) => updateProject({ title: e.target.value })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="mb-0">Description (markdown)</Label>
              <div className="flex items-center gap-1">
                {['write', 'preview', 'formats'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPreviewMode(m)}
                    className="mp-mono text-[12px] uppercase tracking-[0.15em] px-2 py-1 transition"
                    style={{
                      background: previewMode === m ? '#15171C' : 'transparent',
                      color: previewMode === m ? '#EDE9DE' : 'rgba(21,23,28,0.5)',
                    }}
                  >
                    {m}
                  </button>
                ))}
                {!project.description && (
                  <button
                    onClick={() => updateProject({ description: SAMPLE_DESCRIPTION })}
                    className="mp-mono text-[12px] uppercase tracking-[0.15em] px-2 py-1 ml-1"
                    style={{ color: '#FF5722' }}
                  >
                    <Sparkles size={10} className="inline" /> Sample
                  </button>
                )}
              </div>
            </div>

            {previewMode === 'write' && (
              <textarea
                className="mp-textarea mp-mono mp-input text-sm leading-relaxed resize-none"
                style={{ minHeight: 320 }}
                placeholder={"# Your model title\n\nA hook about what's special.\n\n## Print settings\n\n**Layer height:** 0.2mm"}
                value={project.description}
                onChange={(e) => updateProject({ description: e.target.value })}
              />
            )}
            {previewMode === 'preview' && (
              <div className="mp-card p-5 mp-prose text-sm" style={{ minHeight: 320 }} dangerouslySetInnerHTML={{ __html: mdToHtml(project.description) || '<p style="color: rgba(21,23,28,0.3)">Preview shows once you write something</p>' }} />
            )}
            {previewMode === 'formats' && (
              <FormatTabs description={project.description} />
            )}

            <div className="flex items-center justify-between mt-1.5">
              <span className="mp-mono text-[12px]" style={{ color: descOver ? '#FF5722' : 'rgba(21,23,28,0.4)' }}>
                {project.description.length}{lim.descMax ? `/${lim.descMax}` : ''} chars
                {descOver && ` · over ${lim.descMaxBy}'s limit`}
              </span>
              <span className="mp-mono text-[12px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
                Formatted for MakerWorld/Printables/Nexprint · Markdown for Cults · HTML for MMF/Thangs/Creality · Plain for Thingiverse
              </span>
            </div>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="mp-card p-3">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {project.tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-0.5 pl-2 pr-0.5 py-1 mp-mono text-[12px] uppercase tracking-[0.15em]" style={{ background: '#15171C', color: '#EDE9DE' }}>
                    {t}
                    <button onClick={() => removeTag(t)} className="p-1.5 opacity-70 hover:opacity-100 hover:text-[#FF5722] transition" aria-label={`Remove tag ${t}`}><X size={13} /></button>
                  </span>
                ))}
                <input
                  aria-label="Add a tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKey}
                  onBlur={() => { if (tagInput) { addTag(tagInput); setTagInput(''); } }}
                  placeholder={project.tags.length ? '+ tag' : 'type and press Enter'}
                  className="bg-transparent outline-none text-xs flex-1 min-w-[100px]"
                />
              </div>
              <div className="flex items-center justify-between text-[12px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
                <span className="mp-mono uppercase tracking-[0.15em]">
                  {project.tags.length}/{lim.tagMax ?? '∞'} tags
                  {lim.tagMax && project.tags.length >= lim.tagMax && ` · ${lim.tagMaxBy} max`}
                </span>
                <button onClick={suggestTags} disabled={tagSuggestBusy} className="mp-mono uppercase tracking-[0.15em] flex items-center gap-1 hover:text-[#FF5722] transition disabled:opacity-40">
                  {tagSuggestBusy ? <Loader size={10} className="animate-spin" /> : <Sparkles size={10} />} {tagSuggestBusy ? 'Checking MakerWorld…' : 'Suggest tags'}
                </button>
              </div>
              {tagSuggestMsg && <p className="text-[11px] mt-1.5 opacity-55">{tagSuggestMsg}</p>}
              {longTags.length > 0 && (
                <p className="mp-mono text-[11px] mt-1.5" style={{ color: '#FF5722' }}>
                  {longTags.length} tag{longTags.length > 1 ? 's' : ''} over {lim.tagCharMax} chars ({lim.tagCharMaxBy} limit): {longTags.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <Label>Category</Label>
            <CategorySelect value={project.category} onChange={(c) => updateProject({ category: c })} options={CATEGORIES} />
            <p className="text-[12px] mt-1.5" style={{ color: 'rgba(21,23,28,0.66)' }}>
              Each platform has its own category tree. We pick a close match for each.
            </p>
          </div>

          <div>
            <Label>License</Label>
            <div className="mp-card p-3" style={{ borderColor: '#FF5722', background: 'rgba(255,87,34,0.035)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight">{selectedLicense?.name || project.license}</div>
                  {selectedLicense && (
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="mp-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: selectedLicense.commercial ? '#247255' : 'rgba(21,23,28,0.5)' }}>
                        {selectedLicense.commercial ? 'Commercial use allowed' : 'Non-commercial'}
                      </span>
                      <span className="mp-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: selectedLicense.derivatives ? '#247255' : 'rgba(21,23,28,0.5)' }}>
                        {selectedLicense.derivatives ? 'Remixes allowed' : 'No derivatives'}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowLicenseChooser((open) => !open)}
                  aria-expanded={showLicenseChooser}
                  className="mp-btn mp-btn-ghost text-[11px] py-1.5 px-2.5 min-h-[36px] flex-shrink-0"
                >
                  {showLicenseChooser ? 'Close' : 'Change'}
                </button>
              </div>
            </div>
            {showLicenseChooser && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {LICENSE_FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setLicenseFilter(f.id)}
                      className="mp-mono text-[11px] uppercase tracking-[0.15em] px-2 py-1 transition"
                      style={{
                        background: licenseFilter === f.id ? '#15171C' : 'rgba(21,23,28,0.06)',
                        color: licenseFilter === f.id ? '#EDE9DE' : 'rgba(21,23,28,0.65)',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                  {visibleLicenses.length === 0 && (
                    <p className="text-[13px] py-2" style={{ color: 'rgba(21,23,28,0.66)' }}>No license matches that combination.</p>
                  )}
                  {visibleLicenses.map(l => (
                    <label key={l.id} className="flex items-start gap-2.5 mp-card p-2.5 cursor-pointer transition" style={{
                      borderColor: project.license === l.id ? '#FF5722' : 'rgba(21,23,28,0.1)',
                      background: project.license === l.id ? 'rgba(255,87,34,0.04)' : '#FFFFFF',
                    }}>
                      <input
                        type="radio"
                        name="license"
                        value={l.id}
                        checked={project.license === l.id}
                        onChange={() => { updateProject({ license: l.id }); setShowLicenseChooser(false); }}
                        className="mt-0.5"
                        style={{ accentColor: '#FF5722' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold leading-tight">{l.name}</div>
                        <div className="flex gap-2 mt-1">
                          <span className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: l.commercial ? '#4FB286' : 'rgba(21,23,28,0.4)' }}>
                            {l.commercial ? '$ commercial' : 'non-commercial'}
                          </span>
                          <span className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: l.derivatives ? '#4FB286' : 'rgba(21,23,28,0.4)' }}>
                            {l.derivatives ? '↻ remix ok' : 'no derivatives'}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SectionNav
        backLabel="Back to Files"
        nextLabel="Continue to Images"
        nextDisabled={!project.title || !project.description || !project.category || project.tags.length === 0}
        disabledReason={`Add ${[!project.title && 'a title', !project.description && 'a description', !project.category && 'a category', project.tags.length === 0 && 'at least one tag'].filter(Boolean).join(', ')} to continue`}
        onBack={() => setCurrentSection('files')}
        onNext={() => setCurrentSection('images')}
      />
    </div>
  );
}

function Label({ children, className = '' }) {
  return <label className={`mp-mono text-[12px] uppercase tracking-[0.2em] block mb-2 ${className}`} style={{ color: 'rgba(21,23,28,0.66)' }}>{children}</label>;
}

function FormatTabs({ description }) {
  const [active, setActive] = useState('md');
  const [copied, setCopied] = useState(null); // null | 'ok' | 'fail'
  const html = mdToHtml(description);
  const plain = mdToPlain(description);
  const outputs = { md: description, rich: html, html, plain };
  const copy = async (k) => {
    const ok = k === 'rich' ? await copyRichText(html, plain) : await copyPlainText(outputs[k]);
    setCopied(ok ? 'ok' : 'fail'); setTimeout(() => setCopied(null), 1600);
  };
  const tabs = [
    { k: 'md',    label: 'Markdown',  platforms: ['Cults3D'] },
    { k: 'rich',  label: 'Formatted', platforms: ['MakerWorld', 'Printables', 'Nexprint'] },
    { k: 'html',  label: 'HTML',      platforms: ['MyMiniFactory', 'Thangs', 'Creality'] },
    { k: 'plain', label: 'Plain',     platforms: ['Thingiverse'] },
  ];
  const copyLabel = active === 'rich' ? 'Copy formatted' : `Copy ${active}`;
  return (
    <div className="mp-card">
      <div className="flex border-b" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
        {tabs.map(({ k, label, platforms }) => (
          <button
            key={k}
            onClick={() => setActive(k)}
            className="flex-1 px-3 py-2.5 mp-display font-bold text-xs transition border-r last:border-r-0"
            style={{
              background: active === k ? '#15171C' : 'transparent',
              color: active === k ? '#EDE9DE' : '#15171C',
              borderColor: 'rgba(21,23,28,0.1)',
            }}
          >
            {label}
            <div className="text-[11px] font-normal opacity-60 mt-0.5">
              {platforms.join(', ')}
            </div>
          </button>
        ))}
      </div>
      <div className="p-3 flex items-center justify-between border-b gap-2" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
        <span className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
          {active === 'rich' ? 'Rendered — paste into the visual editor, keeps formatting' : active === 'html' ? 'Raw HTML source' : active === 'md' ? 'Markdown source' : 'Plain text'}
        </span>
        <button onClick={() => copy(active)} className="mp-mono text-[12px] uppercase tracking-[0.2em] flex items-center gap-1.5 hover:text-[#FF5722] transition flex-shrink-0 py-1" aria-label={copyLabel}>
          {copied === 'ok' ? <><Check size={13} style={{ color: '#4FB286' }} /> Copied</> : copied === 'fail' ? <><X size={13} style={{ color: '#c83f10' }} /> Select &amp; copy</> : <><Copy size={12} /> {copyLabel}</>}
        </button>
      </div>
      {active === 'rich' ? (
        <div className="mp-prose p-4 text-sm max-h-64 overflow-auto"
          dangerouslySetInnerHTML={{ __html: html || '<span style="color:rgba(21,23,28,0.3)">Write something in markdown to see the formatted output</span>' }} />
      ) : (
        <pre className="mp-pre mp-mono p-4 text-xs leading-relaxed max-h-64 overflow-auto" style={{ color: 'rgba(21,23,28,0.85)' }}>
          {outputs[active] || <span style={{ color: 'rgba(21,23,28,0.3)' }}>Write something in markdown to see formatted outputs</span>}
        </pre>
      )}
    </div>
  );
}

// =====================================================================
// SECTION: IMAGES
// =====================================================================

function ImagesSection({ project, updateProject, setCurrentSection }) {
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [activeImageId, setActiveImageId] = useState(null);
  const [imageWorkspace, setImageWorkspace] = useState('gallery');
  const [cropPlatformId, setCropPlatformId] = useState('makerworld');
  const [imgNotice, setImgNotice] = useState(null); // string | null
  const desktop = (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop)
    ? window.modelprepDesktop
    : null;

  const handleVideoFiles = async (fileList) => {
    const candidates = Array.from(fileList || []).filter(isGalleryVideoFile);
    if (!candidates.length) {
      setImgNotice('No supported videos found. Use MP4 or MOV for MakerWorld; Cults3D also accepts WebM.');
      return;
    }
    const additions = [];
    const failures = [];
    for (const file of candidates) {
      try {
        const duration = await readVideoDuration(file);
        additions.push({
          id: 'media_' + Date.now() + '_' + additions.length + '_' + Math.random().toString(36).slice(2, 7),
          kind: 'video', name: file.name, size: file.size, type: file.type,
          duration, blob: file, previewUrl: URL.createObjectURL(file),
        });
      } catch {
        failures.push(file.name);
      }
    }
    if (additions.length) updateProject({ media: [...(project.media || []), ...additions] });
    setImgNotice(failures.length ? `Added ${additions.length} video(s). Could not read: ${failures.join(', ')}.` : null);
  };

  const removeVideo = (id) => {
    const item = (project.media || []).find((entry) => entry.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    updateProject({ media: (project.media || []).filter((entry) => entry.id !== id) });
  };

  const handleImageFiles = async (fileList) => {
    const all = Array.from(fileList);
    // Accept by MIME, but fall back to extension when the browser reports no type
    // (drag from some sources, HEIC, renamed files, etc.).
    const candidates = all.filter(f => f.type.startsWith('image/') || isImageFile(f.name));
    const rejectedType = all.length - candidates.length;
    const additions = [];
    let failed = 0;
    for (const sourceFile of candidates) {
      let file = sourceFile;
      try {
        file = await convertHeicFileToJpeg(sourceFile);
      } catch (e) {
        failed++;
        continue;
      }
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        try { reader.readAsDataURL(file); } catch (e) { resolve(null); }
      });
      if (!dataUrl) { failed++; continue; }
      try {
        const img = await loadImageFromDataUrl(dataUrl);
        additions.push({
          id: 'img_' + Date.now() + '_' + additions.length + '_' + Math.random().toString(36).slice(2, 7),
          dataUrl,
          name: sourceFile.name,
          size: sourceFile.size,
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
          focal: { x: 0.5, y: 0.5 },
          alt: sourceFile.name.replace(/\.[^.]+$/, ''),
        });
      } catch (e) { failed++; }
    }

    // Surface what happened so a drop never silently does nothing.
    if (!additions.length) {
      if (rejectedType && !failed) setImgNotice("Those files aren't recognized as images. Use JPG, PNG, WebP, GIF, HEIC or HEIF.");
      else if (failed) setImgNotice(`Couldn't read ${failed} file${failed === 1 ? '' : 's'} — it may be corrupt or an unsupported format.`);
      else setImgNotice('No images found in that drop.');
      return;
    }
    if (failed || rejectedType) {
      const parts = [];
      if (failed) parts.push(`${failed} couldn't be read`);
      if (rejectedType) parts.push(`${rejectedType} weren't images`);
      setImgNotice(`Added ${additions.length}. Skipped ${parts.join(' and ')}.`);
    } else {
      setImgNotice(null);
    }

    const newImages = [...project.images, ...additions];
    const patch = { images: newImages };
    if (!project.coverImageId && newImages.length) patch.coverImageId = newImages[0].id;
    updateProject(patch);
    if (!activeImageId) setActiveImageId(additions[0].id);
  };

  const chooseImageFiles = async () => {
    if (!desktop?.pickGalleryImages) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const result = await desktop.pickGalleryImages();
      if (!result?.ok) throw new Error(result?.error || 'Image picker failed.');
      const files = (result.files || []).map((item) => {
        const binary = atob(item.base64 || '');
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        return new File([bytes], item.name, { type: item.type || 'application/octet-stream' });
      });
      if (files.length) await handleImageFiles(files);
    } catch (error) {
      setImgNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const addSamples = async (specs) => {
    // Build every sample first, then commit in ONE update so they don't race.
    const results = await Promise.all(specs.map(async ({ label, tint }, i) => {
      try {
        const dataUrl = makeSampleImage(label, tint);
        const img = await loadImageFromDataUrl(dataUrl);
        return {
          id: 'img_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 7),
          dataUrl, naturalW: img.naturalWidth, naturalH: img.naturalHeight, focal: { x: 0.5, y: 0.5 }, alt: `Sample ${i + 1}`,
        };
      } catch (e) { return null; }
    }));
    const built = results.filter(Boolean);
    if (!built.length) return;
    const newImages = [...project.images, ...built];
    const patch = { images: newImages };
    if (!project.coverImageId && built.length) patch.coverImageId = built[0].id;
    updateProject(patch);
    if (!activeImageId && built.length) setActiveImageId(built[0].id);
  };

  const removeImage = (id) => {
    const next = project.images.filter(i => i.id !== id);
    const patch = { images: next };
    if (project.coverImageId === id) patch.coverImageId = next[0]?.id || null;
    // Clear any per-profile cover that pointed at the removed image (avoid dangling refs).
    if (project.profiles?.some(p => p.coverImageId === id)) {
      patch.profiles = project.profiles.map(p => p.coverImageId === id ? { ...p, coverImageId: null, useMainCover: true } : p);
    }
    updateProject(patch);
    if (activeImageId === id) setActiveImageId(next[0]?.id || null);
  };

  const updateImageFocal = (id, focal) => {
    updateProject({ images: project.images.map(i => i.id === id ? { ...i, focal } : i) });
  };

  const setAsCover = (id) => updateProject({ coverImageId: id });

  const moveImage = (id, dir) => {
    const imgs = [...project.images];
    const idx = imgs.findIndex(i => i.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= imgs.length) return;
    [imgs[idx], imgs[swap]] = [imgs[swap], imgs[idx]];
    updateProject({ images: imgs });
  };

  const activeImage = project.images.find(i => i.id === activeImageId) || project.images[0];
  const cropPlatform = PLATFORMS.find((platform) => platform.id === cropPlatformId) || PLATFORMS[0];

  return (
    <div className="w-full min-w-0">
      <SectionHeader
        number="03"
        title="Cover, gallery and video"
        subtitle="Add ordered media. Only platforms with verified crop rules are cropped."
      />

      {imgNotice && (
        <div className="mt-4 p-3 flex items-start gap-3" style={{ background: 'rgba(255,87,34,0.08)', border: '1px solid rgba(255,87,34,0.3)' }}>
          <AlertCircle size={16} style={{ color: '#FF5722' }} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs flex-1" style={{ color: 'rgba(21,23,28,0.7)' }}>{imgNotice}</div>
          <button onClick={() => setImgNotice(null)} className="p-2 -m-1 opacity-50 hover:opacity-100 transition" aria-label="Dismiss notice"><X size={14} /></button>
        </div>
      )}

      <div className="mp-card p-4 mt-5" data-testid="typed-video-media">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="mp-display text-[20px] flex items-center gap-2"><Video size={18} /> Model videos</div>
            <p className="text-[12px] mt-1" style={{ color: 'rgba(21,23,28,0.58)' }}>
              MakerWorld: one MP4/MOV, maximum 30 seconds. Cults3D: ordered MP4/WebM media. Other platforms skip videos.
            </p>
          </div>
          <button type="button" onClick={() => videoInputRef.current?.click()} className="mp-btn mp-btn-ghost text-xs py-2 px-3">
            <Plus size={13} /> Add video
          </button>
          <input ref={videoInputRef} type="file" multiple accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={(event) => handleVideoFiles(event.target.files)} className="hidden" />
        </div>
        {(project.media || []).filter((item) => item.kind === 'video').length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
            {(project.media || []).filter((item) => item.kind === 'video').map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-2" style={{ background: 'rgba(21,23,28,0.04)' }}>
                <video src={item.previewUrl} preload="metadata" muted playsInline className="w-28 h-20 object-contain bg-black" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate">{item.name}</div>
                  <div className="mp-mono text-[10px] uppercase mt-1 opacity-55">{item.duration.toFixed(1)}s · {formatBytes(item.size)}</div>
                  <div className="text-[11px] mt-1" style={{ color: item.duration > 30 ? '#b91c1c' : '#247255' }}>
                    {item.duration > 30 ? 'Too long for MakerWorld' : 'Duration accepted by MakerWorld'}
                  </div>
                </div>
                <button type="button" onClick={() => removeVideo(item.id)} aria-label={`Delete video ${item.name}`} className="p-2 opacity-60 hover:text-[#FF5722]"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {project.images.length === 0 ? (
        <ImageDropZone
          onDrop={handleImageFiles}
          onBrowse={chooseImageFiles}
          inputRef={fileInputRef}
          onSamples={() => addSamples([
            { label: 'SAMPLE 1', tint: ['#FF5722', '#FFB627', '#1A1A1A'] },
            { label: 'SAMPLE 2', tint: ['#3A86FF', '#4FB286', '#1A1A1A'] },
            { label: 'SAMPLE 3', tint: ['#FF6900', '#F79E2E', '#1A1A1A'] },
          ])}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6">
          <div className="md:col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="mp-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
                {project.images.length} images · first selected cover stays first
              </span>
              <button onClick={chooseImageFiles} className="mp-mono text-[12px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition flex items-center gap-1">
                <Plus size={11} /> Add
              </button>
              <input ref={fileInputRef} type="file" multiple accept={GALLERY_IMAGE_ACCEPT || undefined} onChange={(e) => handleImageFiles(e.target.files)} className="hidden" />
            </div>

            <p className="mp-mono text-[11px] uppercase tracking-[0.15em] mb-1" style={{ color: 'rgba(21,23,28,0.66)' }}>
              Order = gallery order on every platform. Reorder with ↑ ↓.
            </p>
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {project.images.map((img, idx) => {
                const active = activeImageId === img.id;
                return (
                  <div
                    key={img.id}
                    className="w-full flex items-center gap-2 p-1.5 transition relative group"
                    style={{
                      background: active ? '#15171C' : '#FFFFFF',
                      color: active ? '#EDE9DE' : '#15171C',
                      border: '1px solid rgba(21,23,28,0.1)',
                    }}
                  >
                    <button
                      onClick={() => setActiveImageId(img.id)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      style={{ color: 'inherit' }}
                    >
                      <div className="w-14 h-14 flex-shrink-0 overflow-hidden" style={{ background: '#15171C' }}>
                        <img src={img.dataUrl} alt={img.alt || `Gallery image ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="mp-mono text-[11px] uppercase tracking-[0.15em] opacity-60">{String(idx + 1).padStart(2, '0')}</div>
                        <div className="text-[13px] truncate">{img.alt || 'Image'}</div>
                        {project.coverImageId === img.id && (
                          <div className="mp-mono text-[11px] uppercase tracking-[0.15em] mt-0.5 inline-flex items-center gap-1" style={{ color: '#FF5722' }}>
                            <Star size={8} fill="#FF5722" /> Cover
                          </div>
                        )}
                      </div>
                    </button>
                    <div className="flex flex-col flex-shrink-0">
                      <button
                        onClick={() => moveImage(img.id, -1)}
                        disabled={idx === 0}
                        aria-label={`Move ${img.alt || 'image'} up`}
                        className="p-2 transition disabled:opacity-20 disabled:cursor-not-allowed hover:text-[#FF5722]"
                        style={{ color: 'inherit' }}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={() => moveImage(img.id, 1)}
                        disabled={idx === project.images.length - 1}
                        aria-label={`Move ${img.alt || 'image'} down`}
                        className="p-2 transition disabled:opacity-20 disabled:cursor-not-allowed hover:text-[#FF5722]"
                        style={{ color: 'inherit' }}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          <div className="md:col-span-9">
            {activeImage && (
              <>
                <div role="tablist" aria-label="Image workspace" className="inline-flex mp-card p-1 mb-4">
                  <button
                    role="tab"
                    aria-selected={imageWorkspace === 'gallery'}
                    onClick={() => setImageWorkspace('gallery')}
                    className="mp-mono text-[11px] uppercase tracking-[0.14em] min-h-[38px] px-3"
                    style={{ background: imageWorkspace === 'gallery' ? '#15171C' : 'transparent', color: imageWorkspace === 'gallery' ? '#EDE9DE' : '#15171C' }}
                  >
                    Gallery editor
                  </button>
                  <button
                    role="tab"
                    aria-selected={imageWorkspace === 'crops'}
                    onClick={() => setImageWorkspace('crops')}
                    className="mp-mono text-[11px] uppercase tracking-[0.14em] min-h-[38px] px-3"
                    style={{ background: imageWorkspace === 'crops' ? '#15171C' : 'transparent', color: imageWorkspace === 'crops' ? '#EDE9DE' : '#15171C' }}
                  >
                    Platform crops
                  </button>
                </div>
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <span className="mp-mono text-[13px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
                    {imageWorkspace === 'gallery'
                      ? `Image · ${activeImage.naturalW} × ${activeImage.naturalH} · drag the dot to set focal point`
                      : `Crop check · ${cropPlatform.name} · uses the same focal point`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAsCover(activeImage.id)} aria-pressed={project.coverImageId === activeImage.id} className="mp-mono text-[12px] uppercase tracking-[0.15em] min-h-[40px] py-2 px-3 flex items-center gap-1.5 transition" style={{
                      background: project.coverImageId === activeImage.id ? '#FF5722' : '#15171C',
                      color: '#EDE9DE',
                    }}>
                      <Star size={12} fill={project.coverImageId === activeImage.id ? '#fff' : 'none'} />
                      {project.coverImageId === activeImage.id ? 'Cover' : 'Set as cover'}
                    </button>
                    <button onClick={() => removeImage(activeImage.id)} aria-label="Delete this image" title="Delete image" className="p-2.5 hover:text-[#FF5722] transition opacity-60 hover:opacity-100">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {imageWorkspace === 'gallery' ? (
                  <FocalPicker
                    image={activeImage}
                    onUpdate={(focal) => updateImageFocal(activeImage.id, focal)}
                  />
                ) : (
                  <div className="mp-card p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                      <div>
                        <div className="mp-display text-[20px]">Review platform framing</div>
                        <p className="text-[12px] mt-1" style={{ color: 'rgba(21,23,28,0.58)' }}>One platform at a time keeps the crop decision readable. Return to Gallery editor to move the focal point.</p>
                      </div>
                      <label className="min-w-[220px]">
                        <span className="sr-only">Platform to preview</span>
                        <select className="mp-input-sm w-full" value={cropPlatformId} onChange={(event) => setCropPlatformId(event.target.value)}>
                          {PLATFORMS.map((platform) => (
                            <option key={platform.id} value={platform.id}>{platform.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {cropPlatform.covers.map((cover) => (
                        <PlatformCropPreview key={`${cropPlatform.id}-${cover.id}`} image={activeImage} platform={cropPlatform} cover={cover} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <SectionNav
        backLabel="Back to Details"
        nextLabel={project.profiles.length ? 'Continue to Profiles' : 'Continue to Platforms'}
        nextDisabled={project.images.length === 0 || !project.coverImageId}
        disabledReason={project.images.length === 0 ? 'Add at least one image to continue' : 'Pick a cover image to continue'}
        onBack={() => setCurrentSection('details')}
        onNext={() => setCurrentSection(project.profiles.length ? 'profiles' : 'platforms')}
      />
    </div>
  );
}

function ImageDropZone({ onDrop, onBrowse, inputRef, onSamples }) {
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload images — drop here or press Enter to browse"
        className="mp-blueprint border-2 border-dashed py-16 px-6 text-center cursor-pointer transition-colors mt-6 focus:outline-none focus-visible:border-[#FF5722]"
        style={{ borderColor: 'rgba(21,23,28,0.25)' }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#FF5722'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(21,23,28,0.25)'}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBrowse(); } }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.files); }}
        onClick={onBrowse}
      >
        <input ref={inputRef} type="file" multiple accept="image/*" onChange={(e) => onDrop(e.target.files)} className="hidden" />
        <div className="inline-flex items-center justify-center w-14 h-14 mb-4" style={{ background: '#15171C' }}>
          <ImageIcon size={22} strokeWidth={2.5} style={{ color: '#FF5722' }} />
        </div>
        <h2 className="mp-display text-[36px] leading-none mb-2">Load renders &amp; photos</h2>
        <p className="mp-body text-sm mb-3" style={{ color: 'rgba(21,23,28,0.65)' }}>jpg, png, webp, gif, heic · first image becomes the cover</p>
        <p className="mp-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
          ◯ min recommended 2000 × 1500 px
        </p>
      </div>
      <div className="text-center mt-3">
        <button onClick={onSamples} className="mp-mono text-[12px] uppercase tracking-[0.2em] py-2 px-3 hover:text-[#FF5722] transition inline-flex items-center gap-1.5">
          <Sparkles size={11} /> Load 3 sample images
        </button>
      </div>
    </>
  );
}

function FocalPicker({ image, onUpdate }) {
  const imgRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const move = (e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const cx = e.touches?.[0]?.clientX ?? e.clientX;
    const cy = e.touches?.[0]?.clientY ?? e.clientY;
    const x = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (cy - rect.top) / rect.height));
    onUpdate({ x, y });
  };
  return (
    <div className="relative w-full select-none" style={{ background: '#15171C', textAlign: 'center' }}>
      <div
        className="relative inline-block cursor-crosshair"
        style={{ maxWidth: '100%', verticalAlign: 'top', touchAction: 'none' }}
        onMouseDown={(e) => { setDragging(true); move(e); }}
        onMouseMove={(e) => dragging && move(e)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchStart={(e) => { setDragging(true); move(e); }}
        onTouchMove={(e) => { if (dragging) { e.preventDefault(); move(e); } }}
        onTouchEnd={() => setDragging(false)}
      >
        <img ref={imgRef} src={image.dataUrl} alt="" draggable={false} style={{ display: 'block', maxWidth: '100%', maxHeight: '55vh', userSelect: 'none' }} />
        {/* Calibration crosshair, like a print bed leveling target */}
        <div className="absolute pointer-events-none" style={{ left: `${image.focal.x * 100}%`, top: `${image.focal.y * 100}%`, transform: 'translate(-50%, -50%)' }}>
          <svg width="44" height="44" viewBox="0 0 44 44" style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.5))' }}>
            {/* Outer corner brackets */}
            <path d="M 4 14 L 4 4 L 14 4" stroke="#FF5722" strokeWidth="1.5" fill="none" />
            <path d="M 30 4 L 40 4 L 40 14" stroke="#FF5722" strokeWidth="1.5" fill="none" />
            <path d="M 40 30 L 40 40 L 30 40" stroke="#FF5722" strokeWidth="1.5" fill="none" />
            <path d="M 14 40 L 4 40 L 4 30" stroke="#FF5722" strokeWidth="1.5" fill="none" />
            {/* Crosshair ticks */}
            <line x1="22" y1="10" x2="22" y2="18" stroke="#FF5722" strokeWidth="1.5" />
            <line x1="22" y1="26" x2="22" y2="34" stroke="#FF5722" strokeWidth="1.5" />
            <line x1="10" y1="22" x2="18" y2="22" stroke="#FF5722" strokeWidth="1.5" />
            <line x1="26" y1="22" x2="34" y2="22" stroke="#FF5722" strokeWidth="1.5" />
            {/* Center dot */}
            <circle cx="22" cy="22" r="2" fill="#FF5722" />
          </svg>
        </div>
        <div className="absolute bottom-2 left-2 mp-mono text-[12px] uppercase tracking-[0.2em] px-2 py-1 pointer-events-none" style={{ background: 'rgba(0,0,0,0.75)', color: '#FF5722' }}>
          ◉ FOCAL {(image.focal.x * 100).toFixed(0)}.{Math.floor((image.focal.x * 100 % 1) * 10)} × {(image.focal.y * 100).toFixed(0)}.{Math.floor((image.focal.y * 100 % 1) * 10)}
        </div>
      </div>
    </div>
  );
}

function PlatformCropPreview({ image, platform, cover }) {
  const canvasRef = useRef(null);
  const preserveOriginal = platform.preserveOriginalImages || !cover.w || !cover.h;
  useEffect(() => {
    if (preserveOriginal || !canvasRef.current || !image) return;
    const img = document.createElement('img');
    img.onload = () => {
      const c = canvasRef.current; if (!c) return;
      const aspect = cover.w / cover.h;
      const dispW = 320, dispH = dispW / aspect;
      c.width = dispW; c.height = dispH;
      const ctx = c.getContext('2d');
      const srcA = img.naturalWidth / img.naturalHeight;
      let sx, sy, sw, sh;
      if (srcA > aspect) { sh = img.naturalHeight; sw = sh * aspect; sy = 0; sx = (img.naturalWidth - sw) * image.focal.x; }
      else { sw = img.naturalWidth; sh = sw / aspect; sx = 0; sy = (img.naturalHeight - sh) * image.focal.y; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dispW, dispH);
    };
    img.src = image.dataUrl;
  }, [image, cover, preserveOriginal]);
  return (
    <div className="mp-card">
      <div className="overflow-hidden" style={{ background: '#15171C' }}>
        {preserveOriginal
          ? <img src={image.dataUrl} alt={`${platform.name} original`} className="w-full max-h-72 object-contain" />
          : <canvas ref={canvasRef} className="w-full block" />}
      </div>
      <div className="p-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-1.5 h-1.5 flex-shrink-0" style={{ background: platform.dot }} />
          <div className="min-w-0">
            <div className="mp-display font-bold text-[13px] leading-tight truncate">
              {platform.name}{cover.label !== 'Cover' ? ` · ${cover.label}` : ''}
            </div>
            <div className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
              {preserveOriginal ? 'Original aspect · no forced crop' : `${cover.w}×${cover.h} (${cover.aspect})`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// SECTION: PROFILES (per 3MF)
// =====================================================================

function ProfilesSection({ project, updateProject, setCurrentSection }) {
  const [activeProfileId, setActiveProfileId] = useState(project.profiles[0]?.id);
  const [imagePicker, setImagePicker] = useState(null); // cover | photos | null

  useEffect(() => {
    if (!imagePicker) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setImagePicker(null); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [imagePicker]);

  const updateProfile = (id, patch) => {
    updateProject({ profiles: project.profiles.map(p => p.id === id ? { ...p, ...patch } : p) });
  };

  if (project.profiles.length === 0) {
    return (
      <div className="w-full min-w-0">
        <SectionHeader number="04" title="Print profiles" subtitle="Add a 3MF file to configure a print profile." />
        <div className="mt-6 p-8 text-center mp-card">
          <Layers size={32} className="mx-auto mb-3 opacity-30" />
          <h3 className="mp-display font-bold text-lg mb-1">No 3MF files yet</h3>
          <p className="text-sm mb-4" style={{ color: 'rgba(21,23,28,0.66)' }}>Add 3MF files in step 01 to define print profiles. STL-only models skip this step.</p>
          <button onClick={() => setCurrentSection('files')} className="mp-btn mp-btn-ghost text-xs">
            <ChevronRight size={12} className="rotate-180" /> Back to Files
          </button>
        </div>
        <SectionNav
          backLabel="Back to Images"
          nextLabel="Continue to Platforms"
          onBack={() => setCurrentSection('images')}
          onNext={() => setCurrentSection('platforms')}
        />
      </div>
    );
  }

  const active = project.profiles.find(p => p.id === activeProfileId) || project.profiles[0];
  const selectedProfileCover = active?.useMainCover
    ? project.images.find((image) => image.id === project.coverImageId)
    : project.images.find((image) => image.id === active?.coverImageId);
  const selectedProfilePhotos = project.images.filter((image) => (active?.photoIds || []).includes(image.id));

  return (
    <div className="w-full min-w-0">
      <SectionHeader
        number="04"
        title="Print profiles"
        subtitle="Configure print profiles and choose the initial MakerWorld profile."
      />


      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6">
        <div className="md:col-span-3 space-y-1.5">
          {project.profiles.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveProfileId(p.id)}
              className="w-full text-left p-2.5 transition-colors"
              style={{
                background: active?.id === p.id ? '#15171C' : '#FFFFFF',
                color: active?.id === p.id ? '#EDE9DE' : '#15171C',
                border: '1px solid rgba(21,23,28,0.1)',
              }}
            >
              <div className="flex items-start gap-2">
                <Layers size={14} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="mp-display font-bold text-xs truncate">{p.name || 'Untitled profile'}</div>
                  <div className="mp-mono text-[11px] uppercase tracking-[0.15em] mt-0.5 opacity-60">
                    {p.parsed?.printer || ''}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="md:col-span-9 space-y-5">
          {active && (
            <>
              <div>
                <Label>Profile name</Label>
                <input
                  className="mp-input"
                  value={active.name}
                  maxLength={60}
                  onChange={(e) => updateProfile(active.id, { name: e.target.value })}
                />
                <div className="text-[10px] text-right mt-1 opacity-50">{active.name.length}/60</div>
              </div>

              <div>
                <Label>MakerWorld profile visibility</Label>
                <select className="mp-input" value={active.visibility || 'private'} onChange={(e) => updateProfile(active.id, { visibility: e.target.value })}>
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
                <div className="text-[10px] mt-1 opacity-50">Independent from the model visibility, matching MakerWorld's profile editor.</div>
              </div>

              {active.parsed && (
                <div className="mp-card p-4">
                  <div className="mp-mono text-[12px] uppercase tracking-[0.2em] mb-3" style={{ color: 'rgba(21,23,28,0.66)' }}>
                    Estimated from file (preview)
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                    <Stat label="Printer" value={active.parsed.printer || '—'} />
                    <Stat label="Material" value={active.parsed.material || '—'} />
                    <Stat label="Layer height" value={active.parsed.layerHeight || '—'} />
                    <Stat label="Plates" value={active.parsed.plates || '—'} />
                    <Stat label="Print time" value={active.parsed.estimatedTime || '—'} />
                    <Stat label="Filament" value={active.parsed.filamentGrams ? `${active.parsed.filamentGrams}g` : '—'} />
                  </div>
                </div>
              )}

              <div>
                <Label>Profile description (optional)</Label>
                <textarea
                  className="mp-input mp-textarea text-sm"
                  style={{ minHeight: 120, resize: 'vertical' }}
                  placeholder="What's specific about this profile? e.g. 'Calibrated for Bambu A1 Mini with 0.4mm nozzle. Use Matte PLA for best surface finish.'"
                  value={active.description}
                  onChange={(e) => updateProfile(active.id, { description: e.target.value })}
                />
              </div>

              <div>
                <Label>Cover image for this profile</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 mp-card p-2.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={active.useMainCover}
                      onChange={() => updateProfile(active.id, { useMainCover: true })}
                      style={{ accentColor: '#FF5722' }}
                    />
                    <span className="text-xs">Use the main project cover image</span>
                  </label>
                  <label className="flex items-center gap-2.5 mp-card p-2.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={!active.useMainCover}
                      onChange={() => { updateProfile(active.id, { useMainCover: false }); setImagePicker('cover'); }}
                      style={{ accentColor: '#FF5722' }}
                    />
                    <span className="text-xs">Pick a specific image from the gallery</span>
                  </label>
                  {!active.useMainCover && (
                    <div className="ml-7 mp-card p-2.5 flex items-center gap-3">
                      {selectedProfileCover ? (
                        <img src={selectedProfileCover.dataUrl} alt={selectedProfileCover.alt || 'Selected profile cover'} className="w-16 h-16 object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(21,23,28,0.06)' }}><ImageIcon size={18} className="opacity-35" /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium truncate">{selectedProfileCover?.alt || 'No specific cover selected'}</div>
                        <button type="button" onClick={() => setImagePicker('cover')} className="mp-mono text-[11px] uppercase tracking-[0.13em] mt-1 underline" style={{ color: '#FF5722' }}>
                          Choose image
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Print-profile photos — MakerWorld requires ≥1 photo of the PRINTED model
                  for this profile (or it can be taken down). Picked here, used at publish. */}
              <div>
                <Label>Print profile photos <span style={{ opacity: 0.6, fontWeight: 400 }}>· photos of the printed model (MakerWorld requires ≥1)</span></Label>
                {project.images.length === 0 ? (
                  <p className="text-xs" style={{ color: '#B23A1A' }}>Add images in step 03 first — at least one printed-model photo is required.</p>
                ) : (
                  <div className="mp-card p-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {selectedProfilePhotos.slice(0, 6).map((image, index) => (
                        <img key={image.id} src={image.dataUrl} alt={image.alt || `Selected print photo ${index + 1}`} className="w-14 h-14 object-cover flex-shrink-0" />
                      ))}
                      {selectedProfilePhotos.length === 0 && (
                        <span className="text-[12px] py-4" style={{ color: 'rgba(21,23,28,0.66)' }}>No print photos selected.</span>
                      )}
                      {selectedProfilePhotos.length > 6 && (
                        <span className="mp-mono text-[11px] flex-shrink-0">+{selectedProfilePhotos.length - 6}</span>
                      )}
                      <button type="button" onClick={() => setImagePicker('photos')} className="mp-btn mp-btn-ghost text-[11px] min-h-[38px] py-1.5 px-2.5 ml-auto flex-shrink-0">
                        Choose photos
                      </button>
                    </div>
                  </div>
                )}
                {(active.photoIds || []).length === 0 && project.images.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>Select at least one real printed-model photo before publishing.</p>
                )}
                <label className="flex items-start gap-2 text-[12px] mt-2">
                  <input type="checkbox" className="mt-0.5" checked={!!active.realPhotoConfirmed}
                    onChange={(e) => updateProfile(active.id, { realPhotoConfirmed: e.target.checked })} />
                  <span>I confirm that at least one selected photo shows the <strong>real printed model</strong>, not only a render.</span>
                </label>
              </div>

              <MwSection title="Additional compatible printers" hint="optional" badge={(active.compatiblePrinters || []).length}>
                <div className="text-[11px] opacity-60">MakerWorld detects the native printer from the 3MF. Select only additional printers you have verified.</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {MAKERWORLD_PRINTERS.map((printer) => {
                    const selected = (active.compatiblePrinters || []).includes(printer.product);
                    return (
                      <label key={printer.product} className="flex items-center gap-1.5 text-[11px] mp-card p-1.5">
                        <input type="checkbox" checked={selected} onChange={() => updateProfile(active.id, {
                          compatiblePrinters: selected
                            ? (active.compatiblePrinters || []).filter((name) => name !== printer.product)
                            : [...(active.compatiblePrinters || []), printer.product],
                        })} />
                        {printer.product}
                      </label>
                    );
                  })}
                </div>
              </MwSection>

              <label className="flex items-start gap-2 text-[12px]">
                <input type="checkbox" className="mt-0.5" checked={!!active.guidelinesAccepted}
                  onChange={(e) => updateProfile(active.id, { guidelinesAccepted: e.target.checked })} />
                <span>I have read and this profile meets MakerWorld's <a href="https://makerworld.com/en/rules" target="_blank" rel="noopener noreferrer" className="underline">Print Profile Guidelines</a>.</span>
              </label>
            </>
          )}
        </div>
      </div>

      {imagePicker && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(21,23,28,0.58)' }} onMouseDown={() => setImagePicker(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="profile-image-picker-title" className="mp-card w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" style={{ background: '#EDE9DE' }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="p-4 border-b flex items-start gap-3" style={{ borderColor: 'rgba(21,23,28,0.12)' }}>
              <div className="flex-1">
                <h3 id="profile-image-picker-title" className="mp-display text-[26px] leading-none">{imagePicker === 'cover' ? 'Choose profile cover' : 'Choose print photos'}</h3>
                <p className="text-[12px] mt-1" style={{ color: 'rgba(21,23,28,0.66)' }}>
                  {imagePicker === 'cover' ? 'Select one image for this profile.' : 'Select every real photo that shows the printed model.'}
                </p>
              </div>
              <button type="button" onClick={() => setImagePicker(null)} aria-label="Close image chooser" className="p-2"><X size={18} /></button>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {project.images.map((image, index) => {
                const selected = imagePicker === 'cover'
                  ? active.coverImageId === image.id
                  : (active.photoIds || []).includes(image.id);
                return (
                  <button
                    key={image.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${selected ? 'Deselect' : 'Select'} ${image.alt || `image ${index + 1}`}`}
                    onClick={() => {
                      if (imagePicker === 'cover') {
                        updateProfile(active.id, { useMainCover: false, coverImageId: image.id });
                        setImagePicker(null);
                      } else {
                        const ids = active.photoIds || [];
                        updateProfile(active.id, { photoIds: selected ? ids.filter((id) => id !== image.id) : [...ids, image.id] });
                      }
                    }}
                    className="relative aspect-square overflow-hidden"
                    style={{ outline: selected ? '3px solid #FF5722' : '1px solid rgba(21,23,28,0.18)', outlineOffset: -2 }}
                  >
                    <img src={image.dataUrl} alt="" className="w-full h-full object-cover" />
                    <span className="absolute left-1.5 bottom-1.5 right-1.5 text-left text-[10px] truncate px-1.5 py-1" style={{ background: 'rgba(21,23,28,0.78)', color: '#fff' }}>{image.alt || `Image ${index + 1}`}</span>
                    {selected && <span className="absolute top-1.5 right-1.5 flex items-center justify-center w-5 h-5" style={{ background: '#FF5722' }}><Check size={12} color="#fff" /></span>}
                  </button>
                );
              })}
            </div>
            {imagePicker === 'photos' && (
              <div className="p-3 border-t flex items-center justify-between gap-3" style={{ borderColor: 'rgba(21,23,28,0.12)' }}>
                <span className="text-[12px]">{(active.photoIds || []).length} selected</span>
                <button type="button" onClick={() => setImagePicker(null)} className="mp-btn text-[12px] py-2 px-4">Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      <SectionNav
        backLabel="Back to Images"
        nextLabel="Continue to Platforms"
        onBack={() => setCurrentSection('images')}
        onNext={() => setCurrentSection('platforms')}
      />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="mp-mono text-[11px] uppercase tracking-[0.2em] mb-1" style={{ color: 'rgba(21,23,28,0.66)' }}>{label}</div>
      <div className="mp-display font-bold text-sm">{value}</div>
    </div>
  );
}

// =====================================================================
// SECTION: PLATFORMS
// =====================================================================

function PlatformsSection({ project, updateProject, setCurrentSection }) {
  const accounts = useAccounts();
  const openConnections = useOpenConnections();
  const togglePlatform = (id) => {
    updateProject({
      platforms: { ...project.platforms, [id]: { ...project.platforms[id], enabled: !project.platforms[id].enabled } },
    });
  };
  const updatePlatformField = (id, field, value) => {
    const patch = typeof field === 'object' ? field : { [field]: value };
    updateProject({
      platforms: { ...project.platforms, [id]: { ...project.platforms[id], ...patch } },
    });
  };

  const enabledCount = Object.values(project.platforms).filter(p => p.enabled).length;
  const directPlatforms = PLATFORMS.filter((platform) => LIVE_PUBLISH_PLATFORM_IDS.includes(platform.id));
  const exportPlatforms = PLATFORMS.filter((platform) => !LIVE_PUBLISH_PLATFORM_IDS.includes(platform.id));
  const directEnabledCount = directPlatforms.filter((platform) => project.platforms[platform.id]?.enabled).length;
  const exportEnabledCount = exportPlatforms.filter((platform) => project.platforms[platform.id]?.enabled).length;
  const setAll = (enabled) => {
    const next = {}; for (const k of Object.keys(project.platforms)) next[k] = { ...project.platforms[k], enabled };
    updateProject({ platforms: next });
  };
  const [savedDefault, setSavedDefault] = useState(false);
  const saveAsDefault = () => {
    setDefaultPlatforms(PLATFORMS.filter(p => project.platforms[p.id]?.enabled).map(p => p.id));
    setSavedDefault(true); setTimeout(() => setSavedDefault(false), 2000);
  };

  return (
    <div className="w-full min-w-0">
      <SectionHeader
        number="05"
        title="Choose your platforms"
        subtitle={`${directEnabledCount} direct and ${exportEnabledCount} export target${exportEnabledCount === 1 ? '' : 's'} selected. Adjust platform-specific options.`}
      />

      <div className="flex flex-wrap items-center gap-2 mt-5">
        <button onClick={() => setAll(true)} className="mp-btn mp-btn-ghost text-[12px] py-1.5 px-3"><Check size={12} /> Select all</button>
        <button onClick={() => setAll(false)} className="mp-btn mp-btn-ghost text-[12px] py-1.5 px-3"><X size={12} /> Deselect all</button>
        <span className="mx-1" style={{ color: 'rgba(21,23,28,0.2)' }}>·</span>
        <button onClick={saveAsDefault} className="mp-btn mp-btn-ghost text-[12px] py-1.5 px-3" title="Remember this selection for new projects">
          <Star size={12} /> {savedDefault ? 'Saved as default ✓' : 'Save as default'}
        </button>
        <span className="mp-mono text-[12px] ml-auto" style={{ color: 'rgba(21,23,28,0.66)' }}>{enabledCount}/{PLATFORMS.length} enabled</span>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <h3 className="mp-display text-[22px] leading-none">Direct publishing</h3>
            <p className="text-[12px] mt-1" style={{ color: 'rgba(21,23,28,0.58)' }}>These platforms can publish from ModelPrep after an account is connected.</p>
          </div>
          <span className="mp-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: 'rgba(21,23,28,0.66)' }}>{directEnabledCount}/{directPlatforms.length} selected</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
        {directPlatforms.map((p) => {
          const activeAccount = accounts.getActive(p.id);
          const connectionLabel = accountIsUsable(activeAccount)
            ? 'Connected'
            : activeAccount?.status === 'checking' ? 'Checking session' : activeAccount ? 'Reconnect needed' : 'Connect account';
          return <PlatformCard
            key={p.id}
            platform={p}
            state={project.platforms[p.id]}
            project={project}
            connectionLabel={connectionLabel}
            onConnect={() => openConnections('accounts')}
            onToggle={() => togglePlatform(p.id)}
            onUpdate={(field, value) => updatePlatformField(p.id, field, value)}
          />;
        })}
        </div>
      </div>

      <div className="mt-7">
        <div className="flex items-end justify-between gap-3 mb-2">
          <div>
            <h3 className="mp-display text-[22px] leading-none">Export &amp; future connections</h3>
            <p className="text-[12px] mt-1" style={{ color: 'rgba(21,23,28,0.58)' }}>ModelPrep prepares adapted packages; direct account publishing is not available yet.</p>
          </div>
          <span className="mp-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: 'rgba(21,23,28,0.66)' }}>{exportEnabledCount}/{exportPlatforms.length} selected</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
        {exportPlatforms.map(p => (
          <PlatformCard
            key={p.id}
            platform={p}
            state={project.platforms[p.id]}
            project={project}
            connectionLabel="Export package"
            onToggle={() => togglePlatform(p.id)}
            onUpdate={(field, value) => updatePlatformField(p.id, field, value)}
          />
        ))}
        </div>
      </div>

      <SectionNav
        backLabel={project.profiles.length ? 'Back to Profiles' : 'Back to Images'}
        nextLabel="Continue to Publish"
        nextDisabled={enabledCount === 0}
        disabledReason="Enable at least one platform to continue"
        onBack={() => setCurrentSection(project.profiles.length ? 'profiles' : 'images')}
        onNext={() => setCurrentSection('publish')}
      />
    </div>
  );
}

// Per-platform release plan: no plan (default), a reminder, or a scheduled
// upload. One pending plan per project+platform; plans persist locally and
// scheduled ones auto-start from the Publish step while the app is open.
export function ReleasePlanControls({ platform, project }) {
  const plans = useReleasePlans();
  const desktopBridge = (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop) ? window.modelprepDesktop : null;
  const active = planForProjectPlatform(plans, project.title, platform.id);
  const [draft, setDraft] = useState(null); // {mode, dueAt, note} while editing
  const current = draft || active || { mode: '', dueAt: '', note: '' };
  const issues = current.mode ? releasePlanIssues({ ...current, platformId: platform.id }, draft ? Date.now() : 0) : [];

  const apply = (patch) => {
    const next = { ...current, ...patch };
    if (!next.mode) {
      setDraft(null);
      if (active) releasePlanStore.set(removeReleasePlan(plans, active.id));
      return;
    }
    setDraft(next);
    if (releasePlanIssues({ ...next, platformId: platform.id }, Date.now()).length) return;
    releasePlanStore.set(upsertReleasePlan(plans, {
      id: active?.id || `plan-${platform.id}-${Date.now()}`,
      projectTitle: project.title || 'Untitled Project',
      platformId: platform.id,
      platformName: platform.name,
      mode: next.mode,
      dueAt: next.dueAt,
      note: next.note || '',
      unattended: next.mode === 'scheduled' ? !!next.unattended : false,
      createdAt: active?.createdAt || Date.now(),
      status: 'pending',
    }));
  };

  return (
    <div className="mt-3">
      <div className="mp-mono text-[11px] uppercase tracking-[0.2em] mb-1.5" style={{ color: 'rgba(21,23,28,0.66)' }}>
        Release plan{active ? ` · ${describeDue(active, Date.now())}` : ''}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`${platform.name} release plan`}
          className="mp-input text-xs py-1 w-auto"
          value={current.mode}
          onChange={(e) => apply({ mode: e.target.value })}
        >
          <option value="">No plan</option>
          <option value="remind">Remind me to publish</option>
          <option value="scheduled">Publish automatically</option>
        </select>
        {current.mode && (
          <input
            aria-label={`${platform.name} release date`}
            type="datetime-local"
            className="mp-input text-xs py-1 w-auto"
            value={current.dueAt || ''}
            onChange={(e) => apply({ dueAt: e.target.value })}
          />
        )}
        {current.mode && (
          <input
            aria-label={`${platform.name} release note`}
            placeholder="note (e.g. after Thangs exclusivity)"
            maxLength={120}
            className="mp-input text-xs py-1 flex-1 min-w-[140px]"
            value={current.note || ''}
            onChange={(e) => apply({ note: e.target.value })}
          />
        )}
      </div>
      {current.mode === 'scheduled' && (
        <>
          {desktopBridge?.syncReleasePlans && (
            <label className="flex items-start gap-2 text-[11px] mt-1.5 cursor-pointer">
              <input
                type="checkbox"
                aria-label={`${platform.name} unattended publish`}
                checked={!!current.unattended}
                onChange={(e) => apply({ unattended: e.target.checked })}
                style={{ accentColor: '#FF5722', marginTop: 2 }}
              />
              <span>Publish even if ModelPrep is closed (unattended). ModelPrep reopens at the set time and publishes only if this account's session is still valid; otherwise it becomes an overdue reminder.</span>
            </label>
          )}
          <p className="text-[11px] mt-1" style={{ color: 'rgba(21,23,28,0.66)' }}>
            {current.unattended
              ? 'Runs in the background at the set time using this platform’s saved action and visibility, after a session pre-flight.'
              : 'Publishes through the normal pipeline at the set time while ModelPrep is open, using this platform’s saved action and visibility. If the app is closed it becomes an overdue reminder instead.'}
          </p>
        </>
      )}
      {issues.length > 0 && (
        <p className="text-[11px] mt-1" style={{ color: '#B23A1A' }}>{issues.join(' ')}</p>
      )}
    </div>
  );
}

// Per-platform file checklist. Everything compatible is included by default;
// unchecking a file adds it to this platform's excludedFileIds so slicer-
// specific variants (e.g. an Elegoo 3MF) can be kept off platforms where they
// only add noise. Preflight fails closed if every file ends up excluded.
export function PlatformFilePicker({ platform, project, opts, onUpdate }) {
  const candidates = platformCandidateFiles(platform, project);
  if (candidates.length < 2) return null; // nothing to choose between
  const excludedCount = candidates.filter((file) => isFileExcluded(file, opts)).length;
  return (
    <div className="mt-3">
      <div className="mp-mono text-[11px] uppercase tracking-[0.2em] mb-1.5" style={{ color: 'rgba(21,23,28,0.66)' }}>
        Files for {platform.name}{excludedCount ? ` · ${excludedCount} excluded` : ''}
      </div>
      <div className="space-y-1">
        {candidates.map((file) => {
          const included = !isFileExcluded(file, opts);
          const slicer = file.isProfile ? fileSlicer(file) : null;
          return (
            <label key={file.id} className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={included}
                aria-label={`Send ${file.name} to ${platform.name}`}
                onChange={() => onUpdate('excludedFileIds', toggleExcludedFileId(opts, file.id))}
                style={{ accentColor: '#FF5722' }}
              />
              <span className="truncate" style={{ opacity: included ? 1 : 0.45 }}>{file.name}</span>
              {slicer && slicer !== 'unknown' && (
                <span className="mp-mono text-[10px] uppercase tracking-[0.15em] px-1 py-0.5 flex-shrink-0" style={{ background: 'rgba(21,23,28,0.08)' }}>
                  {slicerLabel(slicer)}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PlatformCard({ platform, state, project, connectionLabel, onConnect, onToggle, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const acceptedFormats = platform.id === 'makerworld' && state.productMode === 'laser-cut'
    ? MAKERWORLD_LASER_FORMATS
    : platform.formats;
  return (
    <div className="mp-card" style={{ borderColor: state.enabled ? 'rgba(21,23,28,0.2)' : 'rgba(21,23,28,0.08)', opacity: state.enabled ? 1 : 0.65 }}>
      <div className="p-3.5 flex items-start gap-3">
        <button
          onClick={onToggle}
          role="switch"
          aria-checked={state.enabled}
          aria-label={`${state.enabled ? 'Disable' : 'Enable'} ${platform.name}`}
          className="flex-shrink-0 mt-0.5 mp-mono text-[12px] uppercase tracking-[0.15em] px-2.5 min-h-[40px] flex items-center justify-center gap-1.5 transition"
          style={{
            background: state.enabled ? '#FF5722' : 'transparent',
            color: state.enabled ? '#fff' : 'rgba(21,23,28,0.5)',
            border: `1px solid ${state.enabled ? '#FF5722' : 'rgba(21,23,28,0.25)'}`,
            minWidth: 58,
          }}
        >
          {state.enabled ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
          {state.enabled ? 'ON' : 'OFF'}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
              <div className="w-2 h-2 flex-shrink-0" style={{ background: platform.dot }} />
              <h3 className="mp-display font-bold text-base flex-shrink-0">{platform.name}</h3>
              {platform.apiSupport === 'oneclick' && (
                <span className="mp-pill flex-shrink-0 whitespace-nowrap" style={{ background: '#4FB286', color: '#fff' }}>API</span>
              )}
              {platform.apiSupport === 'manual' && (
                <span className="mp-pill flex-shrink-0 whitespace-nowrap" style={{ background: 'rgba(21,23,28,0.1)', color: 'rgba(21,23,28,0.66)' }}>manual</span>
              )}
              {platform.apiSupport === 'addon' && (
                <span className="mp-pill flex-shrink-0 whitespace-nowrap" style={{ background: 'rgba(58,134,255,0.15)', color: '#3A86FF' }}>addon</span>
              )}
              {connectionLabel && (
                <span className="mp-pill flex-shrink-0 whitespace-nowrap" style={{
                  background: connectionLabel === 'Connected' ? 'rgba(79,178,134,0.14)' : 'rgba(21,23,28,0.07)',
                  color: connectionLabel === 'Connected' ? '#247255' : 'rgba(21,23,28,0.58)',
                }}>{connectionLabel}</span>
              )}
              {onConnect && connectionLabel !== 'Connected' && (
                <button
                  onClick={onConnect}
                  aria-label={`${connectionLabel === 'Reconnect needed' ? 'Reconnect' : connectionLabel === 'Checking session' ? 'View status for' : 'Connect'} ${platform.name}`}
                  className="mp-mono text-[10px] uppercase tracking-[0.08em] underline"
                  style={{ color: '#d35400' }}
                >
                  {connectionLabel === 'Checking session' ? 'View status' : connectionLabel === 'Reconnect needed' ? 'Reconnect' : 'Connect'}
                </button>
              )}
            </div>
            <button onClick={() => setExpanded(s => !s)} className="p-2 opacity-50 hover:opacity-100 transition flex-shrink-0" aria-label={expanded ? 'Collapse platform options' : 'Expand platform options'} aria-expanded={expanded}>
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          <div className="mp-mono text-[12px] uppercase tracking-[0.15em] mt-0.5" style={{ color: 'rgba(21,23,28,0.66)' }}>
            {platform.org} · {platform.descFormat}
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'rgba(21,23,28,0.65)' }}>{platform.note}</p>
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
          <div className="grid grid-cols-3 gap-2 my-3 text-[12px]">
            <Stat label="Max images" value={Number.isFinite(platform.maxImages) ? platform.maxImages : 'Not published'} />
            <Stat label="File size cap" value={platform.maxFileMb ? `${platform.maxFileMb}MB` : 'Not published'} />
            <Stat label="Total cap" value={platform.maxTotalMb ? `${platform.maxTotalMb}MB` : 'Not published'} />
          </div>

          <div className="mb-3">
            <Label>Accepted formats</Label>
            <div className="flex flex-wrap gap-1">
              {acceptedFormats.map(f => (
                <span key={f} className="mp-mono text-[11px] uppercase tracking-[0.15em] px-1.5 py-0.5" style={{ background: 'rgba(21,23,28,0.06)' }}>
                  .{f}
                </span>
              ))}
            </div>
          </div>

          {platform.fields.includes('price') && state.enabled && (
            <div className="mt-3">
              <Label>Price (USD)</Label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    checked={state.free}
                    onChange={() => onUpdate('free', true)}
                    style={{ accentColor: '#FF5722' }}
                  /> Free
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    checked={!state.free}
                    onChange={() => onUpdate('free', false)}
                    style={{ accentColor: '#FF5722' }}
                  /> Paid
                </label>
                {!state.free && (
                  <div className="flex items-center gap-1">
                    <DollarSign size={12} className="opacity-50" />
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      value={state.price}
                      onChange={(e) => onUpdate('price', parseFloat(e.target.value) || 0)}
                      className="mp-input-sm"
                      style={{ width: 90 }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {platform.fields.includes('contestEntry') && state.enabled && (
            <div className="mt-3">
              <Label>Submit to contest (optional)</Label>
              <select
                className="mp-input"
                value={state.contestEntry || ''}
                onChange={(e) => onUpdate('contestEntry', e.target.value)}
              >
                <option value="">No contest</option>
                <option value="creator-fund">$1M Creator Fund (ongoing)</option>
                <option value="elegoo-summer">Elegoo Summer Showcase</option>
                <option value="best-functional">Best Functional Print 2026</option>
              </select>
              {state.contestEntry && (
                <div className="mt-2 p-2.5 flex items-start gap-2 text-[13px]" style={{ background: 'rgba(255,182,39,0.12)', border: '1px solid rgba(255,182,39,0.5)' }}>
                  <AlertCircle size={14} style={{ color: '#FF9500' }} className="flex-shrink-0 mt-0.5" />
                  <span style={{ color: 'rgba(21,23,28,0.8)' }}>
                    <strong>{platform.name} contest entries must be opted in during upload.</strong> This package can't enter you automatically — when you upload, tick the contest checkbox on {platform.name}'s page. You can't add an entry after the model is published.
                  </span>
                </div>
              )}
            </div>
          )}

          {state.enabled && (
            <PlatformFilePicker platform={platform} project={project} opts={state} onUpdate={onUpdate} />
          )}
          {state.enabled && LIVE_PUBLISH_PLATFORM_IDS.includes(platform.id) && (
            <ReleasePlanControls platform={platform} project={project} />
          )}
          {platform.id === 'makerworld' && state.enabled && (
            <MakerWorldOptions opts={state} project={project} onUpdate={onUpdate} />
          )}
          {platform.id === 'printables' && state.enabled && (
            <PrintablesOptions opts={state} onUpdate={onUpdate} />
          )}
          {platform.id === 'nexprint' && state.enabled && (
            <NexprintOptions opts={state} project={project} onUpdate={onUpdate} />
          )}
          {platform.id === 'creality' && state.enabled && (
            <CrealityOptions opts={state} project={project} onUpdate={onUpdate} />
          )}
          {platform.id === 'makeronline' && state.enabled && (
            <MakerOnlineOptions opts={state} project={project} onUpdate={onUpdate} />
          )}
          {platform.id === 'makeroad' && state.enabled && (
            <MakerRoadOptions opts={state} onUpdate={onUpdate} />
          )}
          {platform.id === 'thangs' && state.enabled && (
            <ThangsOptions opts={state} project={project} onUpdate={onUpdate} />
          )}
          {platform.id === 'thingiverse' && state.enabled && (
            <ThingiverseOptions opts={state} project={project} onUpdate={onUpdate} />
          )}
          {platform.id === 'mmf' && state.enabled && (
            <MyMiniFactoryOptions opts={state} onUpdate={onUpdate} />
          )}
          {platform.id === 'cults' && state.enabled && <CultsOptions opts={state} onUpdate={onUpdate} />}
        </div>
      )}
    </div>
  );
}

export function CultsOptions({ opts, onUpdate }) {
  const metaTags = Array.isArray(opts.metaTags) ? opts.metaTags : [];
  const toggleMetaTag = (value) => onUpdate('metaTags', metaTags.includes(value)
    ? metaTags.filter((tag) => tag !== value)
    : [...metaTags, value]);
  return (
    <div className="mt-3 space-y-3">
      <div>
        <Label>Visibility</Label>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5"><input type="radio" checked={(opts.visibility || 'secret') === 'secret'} onChange={() => onUpdate('visibility', 'secret')} style={{ accentColor: '#FF5722' }} /> Secret (unlisted)</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={opts.visibility === 'public'} onChange={() => onUpdate('visibility', 'public')} style={{ accentColor: '#FF5722' }} /> Public</label>
        </div>
      </div>
      <div>
        <Label>Manufacturing settings <span className="opacity-50">(optional)</span></Label>
        <textarea value={opts.details || ''} onChange={(event) => onUpdate('details', event.target.value)} placeholder="Print, CNC or laser settings" rows={2} className="w-full mp-card text-xs p-2" />
      </div>
      <div>
        <Label>Platform labels</Label>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {CULTS_META_TAGS.map(([value, label]) => <label key={value} className="flex items-center gap-1.5"><input type="checkbox" checked={metaTags.includes(value)} onChange={() => toggleMetaTag(value)} style={{ accentColor: '#FF5722' }} /> {label}</label>)}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!opts.madeWithAi} onChange={(event) => onUpdate('madeWithAi', event.target.checked)} style={{ accentColor: '#FF5722' }} /> Made with AI</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={opts.showComments !== false} onChange={(event) => onUpdate('showComments', event.target.checked)} style={{ accentColor: '#FF5722' }} /> Allow comments</label>
      </div>
      <p className="text-[11px] opacity-60">3D printing usage is selected automatically. Current Cults terms still require a separate review before public or paid publishing.</p>
    </div>
  );
}

export function MyMiniFactoryOptions({ opts, onUpdate }) {
  const accounts = useAccounts();
  const active = accounts.getActive('mmf');
  const secret = active?.secret || '';
  const [categoryTree, setCategoryTree] = useState(MYMINIFACTORY_CATEGORY_TREE);
  const [categorySource, setCategorySource] = useState('snapshot');
  const parentIds = Array.isArray(opts.remixParentIds) ? opts.remixParentIds.join(', ') : '';
  useEffect(() => {
    let alive = true;
    if (!isDesktopMyMiniFactorySession(secret)) {
      setCategoryTree(MYMINIFACTORY_CATEGORY_TREE);
      setCategorySource('snapshot');
      return () => { alive = false; };
    }
    myMiniFactoryFetch(`${WORKER_URL}/api/v1/myminifactory/web/categories`, {}, secret)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok || !Array.isArray(data.categories)) throw new Error(myMiniFactoryResponseError(data, response.status, 'MyMiniFactory categories failed'));
        if (alive) { setCategoryTree(data.categories); setCategorySource('live'); }
      })
      .catch(() => {
        if (alive) { setCategoryTree(MYMINIFACTORY_CATEGORY_TREE); setCategorySource('snapshot'); }
      });
    return () => { alive = false; };
  }, [secret]);
  const categories = flattenMyMiniFactoryCategories(categoryTree);
  const selectedCategoryId = String((opts.categoryIds || []).at(-1) || '');
  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label>Category (required)</Label>
          <select
            aria-label="MyMiniFactory category"
            className="mp-input"
            value={selectedCategoryId}
            onChange={(event) => {
              const selected = categories.find((category) => category.id === event.target.value);
              onUpdate('categoryIds', selected?.pathIds || []);
            }}
          >
            <option value="">Choose MyMiniFactory category…</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
          <p className="text-[11px] mt-1 opacity-55">{categorySource === 'live' ? 'Loaded from MyMiniFactory’s current taxonomy.' : 'Using the audited taxonomy snapshot; reconnect to refresh it live.'}</p>
        </div>
        <div>
          <Label>Visibility</Label>
          <select aria-label="Visibility" className="mp-input" value={opts.publication || 'private'} onChange={(event) => onUpdate('publication', event.target.value)}>
            <option value="private">Private (recommended)</option>
            <option value="public">Public — enters review</option>
          </select>
        </div>
        <div>
          <Label>License</Label>
          <select aria-label="License" className="mp-input" value={Number(opts.licenseId || 5)} onChange={(event) => onUpdate('licenseId', Number(event.target.value))}>
            {MYMINIFACTORY_LICENSES.map((license) => <option key={license.id} value={license.id}>{license.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Technology</Label>
          <select aria-label="Technology" className="mp-input" value={opts.technology || ''} onChange={(event) => onUpdate('technology', event.target.value)}>
            <option value="">Not specified</option><option value="FDM">FDM</option><option value="DLP/SLA">DLP/SLA</option><option value="SLS">SLS</option>
          </select>
        </div>
        <div>
          <Label>Material quantity</Label>
          <input aria-label="Material quantity" className="mp-input" maxLength={45} value={opts.materialQuantity || ''} onChange={(event) => onUpdate('materialQuantity', event.target.value)} placeholder="For example: 45 g" />
        </div>
        <div>
          <Label>Dimensions</Label>
          {/* `.mp-input` sets width:100%, which outranks the w-20 utility in the
              cascade and collapsed this text field to a few pixels in the
              packaged app. Inline flex sizing wins deterministically. */}
          <div className="flex gap-2">
            <input aria-label="Dimensions" className="mp-input" style={{ flex: '1 1 0%', minWidth: 0 }} maxLength={100} value={opts.dimensions || ''} onChange={(event) => onUpdate('dimensions', event.target.value)} placeholder="120 × 75 × 45" />
            <select aria-label="Dimensions unit" className="mp-input" style={{ flex: '0 0 5rem', width: '5rem' }} value={Number(opts.dimensionsUnit || 0)} onChange={(event) => onUpdate('dimensionsUnit', Number(event.target.value))}>
              <option value={0}>mm</option><option value={1}>cm</option><option value={2}>in</option>
            </select>
          </div>
        </div>
        <div>
          {/* MyMiniFactory stores this range in MINUTES: its native field reads
              "Time to print … in minutes" and the object page renders
              "Time to do 3 - 5 minutes". ModelPrep previously labelled it hours,
              so an entered 3–5 was published as 3–5 minutes. Numbers round-trip
              unchanged, so no read-back check could detect the mismatch. */}
          <Label>Print time range (minutes)</Label>
          <div className="flex items-center gap-2">
            <input type="number" min="0" placeholder="Min" className="mp-input w-24" value={opts.timeFrom ?? ''} onChange={(event) => onUpdate('timeFrom', event.target.value === '' ? '' : Number(event.target.value))} />
            <span className="text-xs opacity-50">to</span>
            <input type="number" min="0" placeholder="Max" className="mp-input w-24" value={opts.timeTo ?? ''} onChange={(event) => onUpdate('timeTo', event.target.value === '' ? '' : Number(event.target.value))} />
          </div>
        </div>
      </div>
      <div>
        <Label>Printing tips</Label>
        <textarea aria-label="Printing tips" className="mp-input min-h-20" value={opts.printingTips || ''} onChange={(event) => onUpdate('printingTips', event.target.value)} placeholder="Orientation, layer height, supports, and material advice" />
      </div>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={!!opts.supportFree} onChange={(event) => onUpdate('supportFree', event.target.checked)} style={{ accentColor: '#4FB286' }} /><span>This model prints without supports.</span></label>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={!!opts.remix} onChange={(event) => onUpdate('remix', event.target.checked)} style={{ accentColor: '#4FB286' }} /><span>This object is a remix.</span></label>
      {opts.remix && <div><Label>Parent MyMiniFactory object IDs</Label><input aria-label="Parent MyMiniFactory object IDs" className="mp-input" value={parentIds} onChange={(event) => onUpdate('remixParentIds', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="Comma-separated object IDs" /></div>}
      <div>
        <Label>Verify an existing object (read-only)</Label>
        <input aria-label="Existing MyMiniFactory object ID to verify" className="mp-input" value={opts.verifyObjectId || ''} onChange={(event) => onUpdate('verifyObjectId', event.target.value.replace(/[^0-9]/g, ''))} placeholder="Existing object ID, e.g. 829284" />
        <p className="text-[11px] mt-1 opacity-55">Re-reads an object this account already owns and compares the persisted state above. It only reads; it never creates or edits an object.</p>
      </div>
      <label className="flex items-start gap-2 p-3 text-xs" style={{ border: '1px solid rgba(79,178,134,0.55)', background: 'rgba(79,178,134,0.08)' }}>
        <input type="checkbox" checked={!!opts.confirmOriginalNoAi} onChange={(event) => onUpdate('confirmOriginalNoAi', event.target.checked)} style={{ accentColor: '#4FB286' }} />
        <span><strong>Required declaration:</strong> I confirm this object and its imagery are original, made without generative AI, and comply with MyMiniFactory’s Terms and Conditions.</span>
      </label>
    </div>
  );
}

function flattenNexprintCategories(nodes, depth = 0, parent = '') {
  const output = [];
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const id = node.id ?? node.classificationId ?? node.categoryId;
    const name = node.classificationNameEn
      ?? node.nameEn
      ?? node.englishName
      ?? node.classificationName
      ?? node.categoryName
      ?? node.name
      ?? node.label;
    const childrenValue = node.children ?? node.childList ?? node.classificationList ?? node.list;
    const children = Array.isArray(childrenValue) ? childrenValue : [];
    // Nexprint's first column is navigation only. The second-column leaves are
    // the actual category values accepted by the upload form.
    if (id != null && name && children.length === 0) {
      output.push({
        id: String(id),
        name: parent ? `${parent} › ${name}` : String(name),
        depth,
      });
    }
    output.push(...flattenNexprintCategories(children, depth + 1, name ? (parent ? `${parent} › ${name}` : String(name)) : parent));
  }
  return output;
}

function nexprintOptionId(option) {
  return String(option?.id ?? option?.activityId ?? option?.collectionId ?? option?.modelCollectionId ?? '');
}

function nexprintOptionName(option) {
  return String(option?.name ?? option?.activityName ?? option?.collectionName ?? option?.title ?? nexprintOptionId(option));
}

export function NexprintOptions({ opts, project, onUpdate }) {
  const accounts = useAccounts();
  const active = accounts.getActive('nexprint');
  const secret = active?.secret || '';
  const [categories, setCategories] = useState([]);
  const [dynamic, setDynamic] = useState({ activities: [], collections: [], error: '', loading: false });

  useEffect(() => {
    let alive = true;
    const url = `https://www.nexprint.com/gateway/api/v1/model-library-server/model-classification/tree?time=${Date.now()}`;
    fetch(url, {
      headers: { Accept: 'application/json', 'Client-Id': 'Nexprint', 'User-Lang': 'en' },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || Number(data.code) !== 0) throw new Error(data.msg || `HTTP ${response.status}`);
        return flattenNexprintCategories(data.data || []);
      })
      .then((items) => { if (alive) setCategories(items); })
      .catch(() => { if (alive) setCategories([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!secret || !isDesktopNexprintSession(secret)) {
      setDynamic({ activities: [], collections: [], error: '', loading: false });
      return () => { alive = false; };
    }
    setDynamic((current) => ({ ...current, loading: true, error: '' }));
    Promise.all([
      nexprintFetch(`${WORKER_URL}/api/v1/nexprint/web/activities`, {}, secret)
        .then(async (response) => ({ response, data: await response.json().catch(() => ({})) })),
      nexprintFetch(`${WORKER_URL}/api/v1/nexprint/web/collections`, {}, secret)
        .then(async (response) => ({ response, data: await response.json().catch(() => ({})) })),
    ])
      .then(([activityResult, collectionResult]) => {
        if (!activityResult.response.ok || !activityResult.data.ok) {
          throw new Error(nexprintResponseError(activityResult.data, activityResult.response.status, 'Could not load Nexprint activities'));
        }
        if (!collectionResult.response.ok || !collectionResult.data.ok) {
          throw new Error(nexprintResponseError(collectionResult.data, collectionResult.response.status, 'Could not load Nexprint collections'));
        }
        if (alive) setDynamic({
          activities: Array.isArray(activityResult.data.activities) ? activityResult.data.activities : [],
          collections: Array.isArray(collectionResult.data.collections) ? collectionResult.data.collections : [],
          error: '',
          loading: false,
        });
      })
      .catch((error) => {
        if (alive) setDynamic({
          activities: [],
          collections: [],
          error: error instanceof Error ? error.message : String(error),
          loading: false,
        });
      });
    return () => { alive = false; };
  }, [secret]);

  const toggleId = (field, rawId) => {
    const id = String(rawId);
    const current = (opts[field] || []).map(String);
    onUpdate(field, current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };
  const updateBom = (index, patch) => {
    const rows = [...(opts.bom || [])];
    rows[index] = { ...rows[index], ...patch };
    onUpdate('bom', rows);
  };
  const removeBom = (index) => onUpdate('bom', (opts.bom || []).filter((_, rowIndex) => rowIndex !== index));
  const addBom = () => {
    if ((opts.bom || []).length >= 100) return;
    onUpdate('bom', [...(opts.bom || []), { materialName: '', materialNum: 1, materialRemark: '' }]);
  };

  return (
    <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Batch action</Label>
          <select className="mp-input" value={opts.publication || 'draft'} onChange={(event) => onUpdate('publication', event.target.value)}>
            <option value="draft">Save draft (recommended)</option>
            <option value="publish">Publish publicly</option>
          </select>
        </div>
        <div>
          <Label>Originality</Label>
          <select className="mp-input" value={Number(opts.originalityType || 1)} onChange={(event) => onUpdate('originalityType', Number(event.target.value))}>
            <option value={1}>Original</option>
            <option value={2}>Adapted</option>
            <option value={3}>Reprint</option>
          </select>
        </div>
      </div>

      {Number(opts.originalityType || 1) !== 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Original URL</Label>
            <input className="mp-input" value={opts.sourceUrl || ''} onChange={(event) => onUpdate('sourceUrl', event.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label>Nexprint model ID (alternative)</Label>
            <input className="mp-input" value={opts.sourceModelId || ''} onChange={(event) => onUpdate('sourceModelId', event.target.value)} placeholder="G…" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <select className="mp-input" value={opts.categoryId || ''} onChange={(event) => onUpdate('categoryId', event.target.value)}>
            <option value="">Choose Nexprint category…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          {!categories.length && <p className="text-[11px] mt-1 opacity-55">Category tree loads from Nexprint’s current live taxonomy.</p>}
        </div>
        <div>
          <Label>License</Label>
          <select className="mp-input" value={Number(opts.licenseType ?? NEXPRINT_LICENSE_MAP[project.license] ?? 7)} onChange={(event) => onUpdate('licenseType', Number(event.target.value))}>
            {NEXPRINT_LICENSES.map((license) => <option key={license.id} value={license.id}>{license.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!opts.nsfw} onChange={(event) => onUpdate('nsfw', event.target.checked)} style={{ accentColor: '#FF5722' }} /> NSFW</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!opts.aiGenerated} onChange={(event) => onUpdate('aiGenerated', event.target.checked)} style={{ accentColor: '#FF5722' }} /> AI-generated content</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!opts.hasBom} onChange={(event) => onUpdate('hasBom', event.target.checked)} style={{ accentColor: '#FF5722' }} /> Include bill of materials</label>
      </div>
      {opts.aiGenerated && (
        <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
          ModelPrep adds “AI-generated” to the listing tags to satisfy Nexprint’s disclosure rule.
        </p>
      )}

      {opts.hasBom && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Bill of materials ({(opts.bom || []).length}/100)</Label>
            <button onClick={addBom} disabled={(opts.bom || []).length >= 100} className="mp-btn mp-btn-ghost text-[11px] py-1 px-2 disabled:opacity-40"><Plus size={11} /> Add material</button>
          </div>
          {(opts.bom || []).map((row, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_90px_minmax(0,1.4fr)_32px] gap-2">
              <input className="mp-input" maxLength={80} value={row.materialName || ''} onChange={(event) => updateBom(index, { materialName: event.target.value })} placeholder="Material" />
              <input className="mp-input" type="number" min={1} max={9999} value={row.materialNum || 1} onChange={(event) => updateBom(index, { materialNum: Number(event.target.value) })} aria-label="Quantity" />
              <input className="mp-input" maxLength={1000} value={row.materialRemark || ''} onChange={(event) => updateBom(index, { materialRemark: event.target.value })} placeholder="Remark (optional)" />
              <button onClick={() => removeBom(index)} aria-label={`Remove material ${index + 1}`} className="opacity-55 hover:opacity-100"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <div>
        <Label>Eligible activities and contests</Label>
        {!active && <p className="text-[11px] opacity-55">Connect Nexprint to load the activities currently available to this account.</p>}
        {dynamic.loading && <p className="text-[11px] opacity-55">Loading current Nexprint options…</p>}
        {dynamic.error && <p className="text-[11px]" style={{ color: '#b91c1c' }}>{dynamic.error}</p>}
        {!!dynamic.activities.length && (
          <div className="flex flex-wrap gap-2 mt-1">
            {dynamic.activities.map((activity) => {
              const id = nexprintOptionId(activity);
              return (
                <label key={id} className="mp-card px-2 py-1 text-[11px] flex items-center gap-1.5">
                  <input type="checkbox" checked={(opts.activityIds || []).map(String).includes(id)} onChange={() => toggleId('activityIds', id)} style={{ accentColor: '#FF5722' }} />
                  {nexprintOptionName(activity)}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {!!dynamic.collections.length && (
        <div>
          <Label>Your collections</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {dynamic.collections.map((collection) => {
              const id = nexprintOptionId(collection);
              return (
                <label key={id} className="mp-card px-2 py-1 text-[11px] flex items-center gap-1.5">
                  <input type="checkbox" checked={(opts.collectionIds || []).map(String).includes(id)} onChange={() => toggleId('collectionIds', id)} style={{ accentColor: '#FF5722' }} />
                  {nexprintOptionName(collection)}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {!!dynamic.activities.length && Number(opts.originalityType || 1) !== 3 && (
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={!!opts.worldFirstRelease} onChange={(event) => onUpdate('worldFirstRelease', event.target.checked)} style={{ accentColor: '#FF5722' }} />
          Mark eligible activity submission as a world-first release
        </label>
      )}

      <div className="p-2.5 text-[11px] leading-relaxed" style={{ background: 'rgba(255,182,39,0.10)', border: '1px solid rgba(255,182,39,0.45)' }}>
        Creator-fund eligibility is not a static checkbox. Nexprint supplies account-eligible activities dynamically; creator-fund submissions currently require at least two images, including one real printed photo.
      </div>
    </div>
  );
}

export function CrealityOptions({ opts, project, onUpdate }) {
  return (
    <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Batch action</Label>
          <select aria-label="Creality batch action" className="mp-input" value={opts.publication === 'public' ? 'public' : 'private'} onChange={(event) => onUpdate('publication', event.target.value)}>
            <option value="private">Create private model (recommended)</option>
            <option value="public">Publish publicly (LIVE)</option>
          </select>
          <p className="text-[11px] mt-1 opacity-60">Creality's new-model uploader supports Private or Public. Its draft endpoint only edits drafts that already exist.</p>
        </div>
        <div>
          <Label>Model source</Label>
          <select aria-label="Creality model source" className="mp-input" value={Number(opts.modelSource || 1)} onChange={(event) => onUpdate('modelSource', Number(event.target.value))}>
            <option value={1}>Original</option>
            <option value={3}>Remix Models</option>
            <option value={2}>Non-original</option>
          </select>
          {Number(opts.modelSource || 1) !== 1 && (
            <p className="text-[11px] mt-1" style={{ color: '#b45309' }}>Creality requires a native source-model object and, for some cases, proof images. ModelPrep maps these fields but intentionally sends only Original uploads until source attribution can be verified without guesswork.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <select aria-label="Creality category" className="mp-input" value={opts.categoryId || ''} onChange={(event) => onUpdate('categoryId', event.target.value)}>
            <option value="">Choose Creality category…</option>
            {CREALITY_CATEGORIES.map((category) => (
              <optgroup key={category.id} label={category.label}>
                <option value={category.id}>{category.label} (top level)</option>
                {category.children.map(([id, label]) => <option key={id} value={id}>{category.label} › {label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <Label>License</Label>
          <select aria-label="Creality license" className="mp-input" value={opts.license || CREALITY_LICENSE_MAP[project.license] || 'CXY-SL'} onChange={(event) => onUpdate('license', event.target.value)}>
            {CREALITY_LICENSES.map((license) => <option key={license.value} value={license.value}>{license.label}</option>)}
          </select>
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={!!opts.nsfw} onChange={(event) => onUpdate('nsfw', event.target.checked)} style={{ accentColor: '#FF5722' }} />
        <span>Contains nudity, violence, blasphemy, or other potentially disturbing content (Creality maturity rating).</span>
      </label>

      <div className="p-2.5 text-[11px] leading-relaxed" style={{ background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.32)' }}>
        ModelPrep sends the web and app cover crops, up to 9 gallery images, every compatible model file, compatible instruction files, tags, rich description, category, license, source type, maturity rating, and draft/private/public state. Creality’s optional paid-model controls are account-gated and are not exposed to this new account.
      </div>
    </div>
  );
}

function makerRoadOptionId(value) { return String(value?.id ?? value?.value ?? value?.classifyId ?? ''); }
function makerRoadOptionName(value) { return String(value?.name ?? value?.label ?? value?.title ?? makerRoadOptionId(value)); }
function makerRoadReadbackValues(value) {
  if (Array.isArray(value)) return value.filter((item) => item != null && item !== '').map((item) => String(item?.id ?? item?.fileId ?? item));
  return String(value || '').split('|').filter(Boolean);
}
export function makerRoadReadbackIssues(expected, model) {
  const issues = [];
  if (!model || typeof model !== 'object') return ['MakerRoad edit read-back returned no model.'];
  const own = (field) => Object.prototype.hasOwnProperty.call(model, field);
  const title = model.name ?? model.title ?? model.modelTitle;
  if (title != null && String(title) !== String(expected.title)) issues.push('MakerRoad read-back changed the title.');
  const visible = model.visible ?? model.visibility;
  if (visible != null && Number(visible) !== (expected.visibility === 'public' ? 1 : 2)) issues.push('MakerRoad read-back changed visibility.');
  const plan = model.plan;
  if (plan != null && Number(plan) !== (expected.scheduled ? 2 : 1)) issues.push('MakerRoad read-back changed the publication plan.');
  const payType = model.payType;
  if (payType != null && Number(payType) !== ({ free: 1, points: 2, cash: 3 }[expected.payType] || 1)) issues.push('MakerRoad read-back changed the download price type.');
  for (const [field, label, expectedCount] of [
    ['fileModel', 'model files', expected.models], ['filePrintconf', 'print configurations', expected.profiles],
    ['fileDoc', 'instruction documents', expected.documents], ['pics', 'images', expected.images],
  ]) {
    if (own(field) && makerRoadReadbackValues(model[field]).length !== expectedCount) {
      issues.push(`MakerRoad read-back returned a different number of ${label}.`);
    }
  }
  return issues;
}
function flattenMakerRoadOptions(values, prefix = '') {
  return (Array.isArray(values) ? values : values?.list || values?.rows || []).flatMap((value) => {
    const name = `${prefix}${makerRoadOptionName(value)}`;
    const own = makerRoadOptionId(value) ? [{ id: makerRoadOptionId(value), name }] : [];
    return [...own, ...flattenMakerRoadOptions(value?.children || value?.child || [], `${name} › `)];
  });
}

export function MakerRoadOptions({ opts, onUpdate }) {
  const accounts = useAccounts();
  const makerRoadAccount = accounts.getActive('makeroad');
  const secret = accountIsUsable(makerRoadAccount) ? makerRoadAccount.secret : '';
  const [meta, setMeta] = useState({ categories: [], printers: [], materials: [], colors: [], loading: false, error: '' });
  useEffect(() => {
    let alive = true;
    if (!isDesktopMakerRoadSession(secret)) return () => { alive = false; };
    setMeta((value) => ({ ...value, loading: true, error: '' }));
    makerRoadFetch(`${WORKER_URL}/api/v1/makeroad/web/meta`, {}, secret)
      .then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
      .then(({ response, data }) => {
        if (!response.ok || !data.ok) throw new Error(makerRoadResponseError(data, response.status, 'MakerRoad metadata failed'));
        const source = data.meta || {};
        if (alive) setMeta({
          categories: flattenMakerRoadOptions(source.modelsClassify),
          printers: flattenMakerRoadOptions(source.printer),
          materials: flattenMakerRoadOptions(source.material),
          colors: flattenMakerRoadOptions(source.color), loading: false, error: '',
        });
      }).catch((error) => { if (alive) setMeta((value) => ({ ...value, loading: false, error: error.message })); });
    return () => { alive = false; };
  }, [secret]);
  const toggle = (field, id, max = Infinity) => {
    const values = (opts[field] || []).map(String);
    onUpdate(field, values.includes(String(id)) ? values.filter((value) => value !== String(id)) : values.length < max ? [...values, String(id)] : values);
  };
  const license = MAKEROAD_LICENSES[Number(opts.licenseIndex || 0)] || MAKEROAD_LICENSES[0];
  return (
    <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Batch action</Label><select aria-label="MakerRoad batch action" className="mp-input" value={opts.publication || 'draft'} onChange={(e) => onUpdate('publication', e.target.value)}><option value="draft">Save private draft (recommended)</option><option value="publish">Submit for public review (LIVE)</option></select></div>
        <div><Label>Upload type</Label><select aria-label="MakerRoad upload type" className="mp-input" value={Number(opts.uploadType || 1)} onChange={(e) => onUpdate('uploadType', Number(e.target.value))}><option value={1}>Original</option><option value={2}>Remix</option></select></div>
      </div>
      {Number(opts.uploadType || 1) === 2 && <div><Label>Original model URL</Label><input className="mp-input" value={opts.referUrl || ''} onChange={(e) => onUpdate('referUrl', e.target.value)} placeholder="https://…" /></div>}
      <div><Label>Categories ({(opts.categoryIds || []).length}/3)</Label>{meta.loading && <p className="text-[11px] opacity-55">Loading live MakerRoad taxonomy…</p>}{meta.error && <p className="text-[11px] text-red-700">{meta.error}</p>}<div className="max-h-40 overflow-auto grid md:grid-cols-2 gap-1">{meta.categories.map((item) => <label key={item.id} className="text-[11px] flex gap-1.5"><input type="checkbox" checked={(opts.categoryIds || []).map(String).includes(item.id)} onChange={() => toggle('categoryIds', item.id, 3)} />{item.name}</label>)}</div></div>
      <div className="grid md:grid-cols-2 gap-3"><div><Label>License</Label><select aria-label="MakerRoad license" className="mp-input" value={Number(opts.licenseIndex || 0)} onChange={(e) => onUpdate('licenseIndex', Number(e.target.value))}>{MAKEROAD_LICENSES.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}</select></div><div><Label>Visibility</Label><select className="mp-input" value={opts.visibility || 'private'} onChange={(e) => onUpdate('visibility', e.target.value)}><option value="private">Private</option><option value="public">Public</option></select></div></div>
      <div><Label>Print methods</Label><div className="flex gap-4 text-xs">{['FDM', 'LCD', 'Others'].map((value) => <label key={value}><input type="checkbox" checked={(opts.printMethods || []).includes(value)} onChange={() => toggle('printMethods', value)} /> {value}</label>)}</div></div>
      {!!meta.printers.length && <div><Label>Compatible printers (optional)</Label><select className="mp-input" value="" onChange={(e) => { toggle('printerIds', e.target.value); e.target.value = ''; }}><option value="">Add printer…</option>{meta.printers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="text-[11px] opacity-55">{(opts.printerIds || []).length} selected</p></div>}
      <div className="grid md:grid-cols-2 gap-3">
        <div><Label>Materials (optional)</Label><select className="mp-input" value="" onChange={(e) => { toggle('materialIds', e.target.value); e.target.value = ''; }}><option value="">Add material…</option>{meta.materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="text-[11px] opacity-55">{(opts.materialIds || []).length} selected</p></div>
        <div><Label>Colors (optional)</Label><select className="mp-input" value="" onChange={(e) => { toggle('colorIds', e.target.value); e.target.value = ''; }}><option value="">Add color…</option>{meta.colors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="text-[11px] opacity-55">{(opts.colorIds || []).length} selected</p></div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs"><label><input type="checkbox" checked={!!opts.aiGenerated} onChange={(e) => onUpdate('aiGenerated', e.target.checked)} /> AI-generated</label><label><input type="checkbox" checked={!!opts.nsfw} onChange={(e) => onUpdate('nsfw', e.target.checked)} /> NSFW</label></div>
      <div className="grid md:grid-cols-2 gap-3"><div><Label>Download price</Label><select className="mp-input" value={opts.payType || 'free'} onChange={(e) => onUpdate('payType', e.target.value)}><option value="free">Free</option><option value="points">Points</option><option value="cash">Cash</option></select></div>{opts.payType !== 'free' && <div><Label>Value</Label><input className="mp-input" type="number" min="0" value={opts.payValue || 0} onChange={(e) => onUpdate('payValue', Number(e.target.value))} /></div>}</div>
      <label className="text-xs flex gap-2"><input type="checkbox" checked={!!opts.scheduled} onChange={(e) => onUpdate('scheduled', e.target.checked)} /> Schedule public availability</label>
      {opts.scheduled && <input aria-label="MakerRoad schedule" className="mp-input" type="datetime-local" value={opts.planTime || ''} onChange={(e) => onUpdate('planTime', e.target.value)} />}
      {opts.publication === 'publish' && <label className="text-xs flex gap-2"><input type="checkbox" checked={!!opts.termsAccepted} onChange={(e) => onUpdate('termsAccepted', e.target.checked)} /><span>I agree to MakerRoad’s current Terms and Privacy Policy for this public submission.</span></label>}
      <p className="text-[11px] opacity-60">Current license mapping: {license.label}. ModelPrep uploads model files, optional 3MF print configurations, 3–10 ordered images, compatible documents, dynamic taxonomy, print settings, attribution, visibility, schedule, and price. MakerRoad’s current native form has no video field, so video media is not sent.</p>
    </div>
  );
}

export function ThangsOptions({ opts, project, onUpdate }) {
  const modelFiles = project.files.filter((file) => file.blob && ['stl', '3mf', 'step', 'stp', 'obj', 'glb', 'fbx', 'blend', 'usdz', 'gltf'].includes(fileExt(file.name)));
  const accounts = useAccounts();
  const thangsAccount = accounts.getActive('thangs');
  const secret = accountIsUsable(thangsAccount) ? thangsAccount.secret : '';
  const [categories, setCategories] = useState(THANGS_CATEGORIES);
  const [categorySource, setCategorySource] = useState('snapshot');
  const [categoryError, setCategoryError] = useState('');
  useEffect(() => {
    let alive = true;
    if (!isDesktopThangsSession(secret)) return () => { alive = false; };
    thangsFetch(`${WORKER_URL}/api/v1/thangs/web/meta`, {}, secret)
      .then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
      .then(({ response, data }) => {
        if (!response.ok || !data.ok) throw new Error(thangsResponseError(data, response.status, 'Thangs categories failed'));
        const values = flattenThangsCategories(data.meta?.categories || []);
        if (alive) { setCategories(values.length ? values : THANGS_CATEGORIES); setCategorySource(values.length ? 'live' : 'snapshot'); setCategoryError(''); }
      }).catch((error) => { if (alive) { setCategories(THANGS_CATEGORIES); setCategorySource('snapshot'); setCategoryError(`${error.message} Using today’s verified taxonomy snapshot.`); } });
    return () => { alive = false; };
  }, [secret]);
  return <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
    <div className="grid md:grid-cols-2 gap-3"><div><Label>Visibility</Label><select aria-label="Thangs visibility" className="mp-input" value={opts.publication || 'private'} onChange={(e) => onUpdate('publication', e.target.value)}><option value="private">Private (recommended)</option><option value="public">Public (LIVE)</option></select></div><div><Label>Structure</Label><select aria-label="Thangs structure" className="mp-input" value={opts.structure || 'single'} onChange={(e) => onUpdate('structure', e.target.value)}><option value="single">Single model</option><option value="bulk">Separate bulk models</option><option value="multipart">Multipart model</option><option value="assembly">Assembly</option></select></div></div>
    <div className="grid md:grid-cols-2 gap-3"><div><Label>Units</Label><select className="mp-input" value={opts.units || 'mm'} onChange={(e) => onUpdate('units', e.target.value)}><option value="mm">Millimeters</option><option value="cm">Centimeters</option><option value="m">Meters</option><option value="in">Inches</option></select></div><div><Label>Primary part</Label><select className="mp-input" value={opts.primaryFileId || modelFiles[0]?.id || ''} onChange={(e) => onUpdate('primaryFileId', e.target.value)}>{modelFiles.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}</select></div></div>
    <div><Label>Category path</Label><select aria-label="Thangs category" className="mp-input" value={opts.category || ''} onChange={(e) => onUpdate('category', e.target.value)}><option value="">Choose category…</option>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select>{categoryError && <p className="text-[11px] text-red-700">{categoryError}</p>}<p className="text-[11px] opacity-55">Taxonomy source: {categorySource === 'live' ? 'authenticated Thangs endpoint' : 'verified 2026-08-01 production snapshot'}.</p></div>
    <div className="grid md:grid-cols-2 gap-3"><div><Label>Folder ID (optional)</Label><input className="mp-input" value={opts.folderId || ''} onChange={(e) => onUpdate('folderId', e.target.value)} /></div><div><Label>Workspace ID (optional)</Label><input className="mp-input" value={opts.workspaceId || ''} onChange={(e) => onUpdate('workspaceId', e.target.value)} /></div></div>
    <div><Label>Resume existing private draft ID (recovery only)</Label><input aria-label="Thangs resume draft ID" className="mp-input" value={opts.resumeDraftId || ''} onChange={(e) => onUpdate('resumeDraftId', e.target.value.trim())} placeholder="Leave empty for a new model" /><p className="text-[11px] opacity-55">Use only after Thangs created a private draft but rejected its details; ModelPrep will update that draft instead of creating a duplicate.</p></div>
    <div className="grid md:grid-cols-2 gap-3"><div><Label>Access type ID (optional)</Label><input className="mp-input" value={opts.accessTypeId || ''} onChange={(e) => onUpdate('accessTypeId', e.target.value)} /></div><div><Label>Plan IDs (comma-separated)</Label><input className="mp-input" value={(opts.planIds || []).join(', ')} onChange={(e) => onUpdate('planIds', e.target.value.split(',').map((value) => value.trim()).filter(Boolean))} /></div></div>
    <div><Label>Dependency model IDs (comma-separated)</Label><input className="mp-input" value={(opts.dependencies || []).join(', ')} onChange={(e) => onUpdate('dependencies', e.target.value.split(',').map((value) => value.trim()).filter(Boolean))} /></div>
    <div><Label>Version notes</Label><textarea className="mp-input" value={opts.versionNotes || ''} onChange={(e) => onUpdate('versionNotes', e.target.value)} /></div>
    <div className="flex flex-wrap gap-4 text-xs"><label><input type="checkbox" checked={opts.allowRemix !== false} onChange={(e) => onUpdate('allowRemix', e.target.checked)} /> Allow remix</label><label><input type="checkbox" checked={!!opts.aiGenerated} onChange={(e) => onUpdate('aiGenerated', e.target.checked)} /> AI-generated</label><label><input type="checkbox" checked={opts.feedbackEnabled !== false} onChange={(e) => onUpdate('feedbackEnabled', e.target.checked)} /> Enable feedback</label></div>
    <label className="text-xs flex gap-2"><input type="checkbox" checked={!!opts.marketplace} onChange={(e) => onUpdate('marketplace', e.target.checked)} /> Paid marketplace listing (account eligibility required)</label>{opts.marketplace && <input aria-label="Thangs price" className="mp-input" type="number" min="0" value={opts.price || 0} onChange={(e) => onUpdate('price', Number(e.target.value))} />}
    <div><Label>License</Label><input className="mp-input" value={opts.license || ''} onChange={(e) => onUpdate('license', e.target.value)} /></div>
    <p className="text-[11px] opacity-60">Model files over 250 MB must be reference files. ModelPrep verifies details, attachments, and license after creation. Plans and paid access remain account-gated.</p>
  </div>;
}

export function ThingiverseOptions({ opts, project = { files: [] }, onUpdate }) {
  const hasScad = (project.files || []).some((file) => fileExt(file.name) === 'scad');
  return <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
    <div className="p-2.5 text-[11px]" style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.30)' }}><strong>Direct upload ready:</strong> Save draft is the safe default. Public publishing remains a separate explicit action and requires accepting Thingiverse’s current terms.</div>
    <div className="grid md:grid-cols-2 gap-3"><div><Label>Action</Label><select aria-label="Thingiverse action" className="mp-input" value={opts.publication || 'draft'} onChange={(e) => onUpdate('publication', e.target.value)}><option value="draft">Save draft (recommended)</option><option value="publish">Publish publicly (LIVE)</option></select></div><div><Label>License</Label><select aria-label="Thingiverse license" className="mp-input" value={opts.license || 'cc-nc'} onChange={(e) => onUpdate('license', e.target.value)}>{THINGIVERSE_LICENSES.map((value) => <option key={value}>{value}</option>)}</select></div></div>
    <div><Label>Summary (required)</Label><textarea className="mp-input" value={opts.summary || ''} onChange={(e) => onUpdate('summary', e.target.value)} /></div>
    <div><Label>Category (required)</Label><select aria-label="Thingiverse category" className="mp-input" value={String(opts.categoryId ?? '')} onChange={(e) => onUpdate('categoryId', e.target.value)}><option value="">Choose category…</option>{THINGIVERSE_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select><p className="text-[11px] opacity-55">Current production taxonomy snapshot; ModelPrep stores the category ID, never its picker position.</p></div>
    <div className="flex flex-wrap gap-4 text-xs"><label><input type="checkbox" checked={!!opts.aiGenerated} onChange={(e) => onUpdate('aiGenerated', e.target.checked)} /> AI-generated</label><label><input type="checkbox" checked={!!opts.wip} onChange={(e) => onUpdate('wip', e.target.checked)} /> Work in progress</label><label title={hasScad ? '' : 'Add a .SCAD model file to enable Thingiverse Customizer.'}><input aria-label="Thingiverse Customizer" type="checkbox" checked={!!opts.customizable} disabled={!hasScad} onChange={(e) => onUpdate('customizable', e.target.checked)} /> Customizable</label><label><input type="checkbox" checked={!!opts.nsfw} onChange={(e) => onUpdate('nsfw', e.target.checked)} /> NSFW</label></div>
    {!hasScad && <p className="text-[11px] opacity-60">Thingiverse enables Customizer only when the upload includes a .SCAD model file.</p>}
    <label className="text-xs"><input type="checkbox" checked={!!opts.remix} onChange={(e) => onUpdate('remix', e.target.checked)} /> Remix</label>{opts.remix && <input aria-label="Source Thing ID" className="mp-input" value={opts.sourceThingId || ''} onChange={(e) => onUpdate('sourceThingId', e.target.value)} placeholder="Source Thing ID" />}
    {opts.publication === 'publish' && <label className="text-xs flex gap-2"><input type="checkbox" checked={!!opts.termsAccepted} onChange={(e) => onUpdate('termsAccepted', e.target.checked)} /> Accept Thingiverse’s current publishing terms at action time</label>}
    <div className="grid md:grid-cols-2 gap-3"><div><Label>Printer / model</Label><input className="mp-input" value={opts.printSettings?.printer || ''} onChange={(e) => onUpdate('printSettings', { ...(opts.printSettings || {}), printer: e.target.value })} /></div><div><Label>Material</Label><input className="mp-input" value={opts.printSettings?.material || ''} onChange={(e) => onUpdate('printSettings', { ...(opts.printSettings || {}), material: e.target.value })} /></div><div><Label>Resolution</Label><input className="mp-input" value={opts.printSettings?.resolution || ''} onChange={(e) => onUpdate('printSettings', { ...(opts.printSettings || {}), resolution: e.target.value })} /></div><div><Label>Infill</Label><input className="mp-input" value={opts.printSettings?.infill || ''} onChange={(e) => onUpdate('printSettings', { ...(opts.printSettings || {}), infill: e.target.value })} /></div></div>
    <div><Label>Custom sections (JSON)</Label><textarea className="mp-input" value={JSON.stringify(opts.sections || [])} onChange={(e) => { try { onUpdate('sections', JSON.parse(e.target.value)); } catch { /* retain last valid value */ } }} /></div>
    <div><Label>Education project data (JSON, optional)</Label><textarea className="mp-input" value={opts.education ? JSON.stringify(opts.education) : ''} onChange={(e) => { if (!e.target.value.trim()) onUpdate('education', null); else { try { onUpdate('education', JSON.parse(e.target.value)); } catch { /* retain last valid value */ } } }} /></div>
    <p className="text-[11px] opacity-60">Print settings, custom rich sections, education fields, ordered uploads, remix attribution, draft/publish separation, and complete readback are represented in the saved project and adapter contract.</p>
  </div>;
}

export function MakerOnlineOptions({ opts, project, onUpdate }) {
  const accounts = useAccounts();
  const active = accounts.getActive('makeronline');
  const secret = active?.secret || '';
  const [meta, setMeta] = useState({ categories: [], kits: [], loading: false, error: '' });
  const [eligibility, setEligibility] = useState({ exclusive: null, chinaSync: null });

  useEffect(() => {
    if (!secret || !isDesktopMakerOnlineSession(secret)) {
      setMeta({ categories: [], kits: [], loading: false, error: '' });
      setEligibility({ exclusive: null, chinaSync: null });
      return undefined;
    }
    let alive = true;
    setMeta((current) => ({ ...current, loading: true, error: '' }));
    const read = async (route) => {
      const response = await makerOnlineFetch(`${WORKER_URL}/api/v1/makeronline/web/${route}`, {}, secret);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(makerOnlineResponseError(data, response.status, `Could not load MakerOnline ${route}`));
      }
      return data;
    };
    Promise.all([read('meta'), read('eligibility')])
      .then(([metaData, eligibilityData]) => {
        if (!alive) return;
        setMeta({
          categories: flattenMakerOnlineCategories(metaData.categories),
          kits: Array.isArray(metaData.kits) ? metaData.kits : [],
          loading: false,
          error: '',
        });
        const nextEligibility = {
          exclusive: eligibilityData.exclusive || { eligible: false },
          chinaSync: eligibilityData.chinaSync || { eligible: false },
        };
        setEligibility(nextEligibility);
        onUpdate({
          exclusiveEligible: !!nextEligibility.exclusive.eligible,
          chinaSyncEligible: !!nextEligibility.chinaSync.eligible,
          ...(!nextEligibility.exclusive.eligible ? { exclusive: false } : {}),
          ...(!nextEligibility.chinaSync.eligible ? { syncChina: false } : {}),
        });
      })
      .catch((error) => {
        if (alive) setMeta({ categories: [], kits: [], loading: false, error: error instanceof Error ? error.message : String(error) });
      });
    return () => { alive = false; };
    // Refresh when the active account changes; onUpdate is intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret]);

  const categoryOptions = meta.categories.some((category) => category.id === String(opts.categoryId || ''))
    ? meta.categories
    : (opts.categoryId ? [{ id: String(opts.categoryId), label: `Saved category ${opts.categoryId}` }, ...meta.categories] : meta.categories);
  const kitId = (kit) => String(kit.id ?? kit.store_kit_id ?? kit.value ?? '');
  const kitName = (kit) => String(kit.name_en ?? kit.store_name ?? kit.storeName ?? kit.name ?? kit.title ?? `Kit ${kitId(kit)}`);
  const selectedKits = (opts.storeKitIds || []).map(String);
  const toggleKit = (id) => onUpdate('storeKitIds', selectedKits.includes(String(id))
    ? selectedKits.filter((value) => value !== String(id))
    : [...selectedKits, String(id)]);
  const source = Number(opts.source || 1);
  const license = Number(opts.license ?? MAKERONLINE_LICENSE_MAP[project.license] ?? 3);
  const printMethod = Number(opts.printMethod || 3);

  return (
    <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Batch action</Label>
          <select aria-label="MakerOnline batch action" className="mp-input" value={opts.publication || 'draft'} onChange={(event) => onUpdate(event.target.value === 'public' ? { publication: 'public', permission: 1 } : { publication: 'draft' })}>
            <option value="draft">Save unpublished draft (recommended)</option>
            <option value="public">Publish publicly (LIVE)</option>
          </select>
        </div>
        <div>
          <Label>Model source</Label>
          <select aria-label="MakerOnline model source" className="mp-input" value={source} onChange={(event) => onUpdate('source', Number(event.target.value))}>
            <option value={1}>Original</option>
            <option value={2}>Remix</option>
          </select>
        </div>
      </div>

      {source === 2 && (
        <div>
          <Label>Original work URL (required for remix)</Label>
          <input aria-label="MakerOnline original work URL" className="mp-input" maxLength={1000} value={opts.originalUrl || ''} onChange={(event) => onUpdate('originalUrl', event.target.value)} placeholder="https://…" />
          {[5, 6].includes(license) && <p className="text-[11px] mt-1" style={{ color: '#b91c1c' }}>NoDerivatives licenses cannot be used for a remix.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <select aria-label="MakerOnline category" className="mp-input" value={opts.categoryId || ''} onChange={(event) => onUpdate('categoryId', event.target.value)}>
            <option value="">{meta.loading ? 'Loading live taxonomy…' : 'Choose MakerOnline category…'}</option>
            {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
          {!secret && <p className="text-[11px] mt-1 opacity-55">Connect MakerOnline to load its live category tree.</p>}
        </div>
        <div>
          <Label>License</Label>
          <select aria-label="MakerOnline license" className="mp-input" value={license} onChange={(event) => onUpdate('license', Number(event.target.value))}>
            {MAKERONLINE_LICENSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Model permissions</Label>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1.5"><input type="radio" checked={Number(opts.permission || 2) === 1} onChange={() => onUpdate('permission', 1)} style={{ accentColor: '#FF5722' }} /> Public</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={Number(opts.permission || 2) === 2} onChange={() => onUpdate('permission', 2)} style={{ accentColor: '#FF5722' }} /> Private</label>
          </div>
          <p className="text-[11px] mt-1 opacity-55">Draft controls whether the listing is submitted now; permissions are stored with the model.</p>
        </div>
        <div>
          <Label>Printing method</Label>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1.5"><input type="radio" checked={printMethod === 3} onChange={() => onUpdate('printMethod', 3)} style={{ accentColor: '#FF5722' }} /> Both</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={printMethod === 1} onChange={() => onUpdate('printMethod', 1)} style={{ accentColor: '#FF5722' }} /> FDM</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={printMethod === 2} onChange={() => onUpdate('printMethod', 2)} style={{ accentColor: '#FF5722' }} /> Resin</label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <label className="flex items-start gap-2"><input type="checkbox" checked={!!opts.aiHelp} onChange={(event) => onUpdate('aiHelp', event.target.checked)} style={{ accentColor: '#FF5722' }} /><span>Created with AI assistance</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={!!opts.nsfw} onChange={(event) => onUpdate({ nsfw: event.target.checked, ...(event.target.checked ? { syncChina: false } : {}) })} style={{ accentColor: '#FF5722' }} /><span>NSFW: nudity, violence, profanity, or disturbing themes</span></label>
      </div>

      {printMethod !== 2 && (
        <div className="p-2.5 space-y-2" style={{ background: 'rgba(17,24,39,0.04)', border: '1px solid rgba(17,24,39,0.18)' }}>
          <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={!!opts.includePrintProfile} onChange={(event) => onUpdate('includePrintProfile', event.target.checked)} style={{ accentColor: '#FF5722' }} /><span>Upload available .3mf files as MakerOnline print profiles as well as raw model files</span></label>
          {opts.includePrintProfile && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div><Label>Print profile title</Label><input aria-label="MakerOnline print profile title" className="mp-input" maxLength={100} value={opts.printTitle || ''} onChange={(event) => onUpdate('printTitle', event.target.value)} placeholder={project.title || 'Profile title'} /></div>
              <div><Label>Print profile description (max 1,000)</Label><input aria-label="MakerOnline print profile description" className="mp-input" maxLength={1000} value={opts.printDescription || ''} onChange={(event) => onUpdate('printDescription', event.target.value)} placeholder="Printer, material, layer height…" /></div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={!!opts.relatedKits} onChange={(event) => onUpdate({ relatedKits: event.target.checked, ...(!event.target.checked ? { storeKitIds: [] } : {}) })} style={{ accentColor: '#FF5722' }} /><span>This model uses MakerOnline Creative Kits</span></label>
        {opts.relatedKits && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
            {meta.kits.map((kit) => {
              const id = kitId(kit);
              return <label key={id} className="flex items-start gap-2 text-[11px] p-1.5 bg-white"><input type="checkbox" checked={selectedKits.includes(id)} onChange={() => toggleKit(id)} style={{ accentColor: '#FF5722' }} /><span>{kitName(kit)}</span></label>;
            })}
            {!meta.loading && meta.kits.length === 0 && <span className="text-[11px] opacity-55">Connect the account to load current Creative Kits.</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <label className="flex items-start gap-2"><input type="checkbox" disabled={!eligibility.chinaSync?.eligible || !!opts.nsfw || Number(opts.permission || 2) !== 1} checked={!!opts.syncChina} onChange={(event) => onUpdate('syncChina', event.target.checked)} style={{ accentColor: '#FF5722' }} /><span>Sync to MakerOnline China{!eligibility.chinaSync?.eligible ? ' (account not linked/eligible)' : ''}</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" disabled={!eligibility.exclusive?.eligible} checked={!!opts.exclusive} onChange={(event) => onUpdate(event.target.checked ? { exclusive: true, source: 1, permission: 1, license: 8, includePrintProfile: true } : { exclusive: false })} style={{ accentColor: '#FF5722' }} /><span>Exclusive model{!eligibility.exclusive?.eligible ? ' (account not eligible)' : ''}</span></label>
      </div>

      {meta.error && <div className="text-[11px]" style={{ color: '#b91c1c' }}>{meta.error}</div>}
      <div className="p-2.5 text-[11px] leading-relaxed" style={{ background: 'rgba(17,24,39,0.04)', border: '1px solid rgba(17,24,39,0.22)' }}>
        ModelPrep maps all current upload branches: ordered gallery (20 max), title, live two-level category, tags, license, source/original URL, public/private permission, FDM/Resin/Both, rich description, documentation, AI/NSFW disclosure, Creative Kits, account-gated China sync/exclusive controls, raw files, and optional parsed .3mf print profiles. Paid pricing is dormant in the current form and is not exposed.
      </div>
    </div>
  );
}

export function PrintablesOptions({ opts, onUpdate }) {
  const accounts = useAccounts();
  const active = accounts.getActive('printables');
  const [metaState, setMetaState] = useState({ categories: [], licenses: [], error: '' });
  const [capabilityState, setCapabilityState] = useState(opts.capabilities || null);
  const [capabilityError, setCapabilityError] = useState('');
  useEffect(() => {
    let active = true;
    fetch(`${WORKER_URL}/api/v1/printables/meta`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
        return data;
      })
      .then((data) => {
        if (active) setMetaState({ categories: data.categories || [], licenses: data.licenses || [], error: '' });
      })
      .catch((error) => {
        if (active) setMetaState({ categories: [], licenses: [], error: error instanceof Error ? error.message : String(error) });
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!active?.secret) return;
    let current = true;
    printablesFetch(`${WORKER_URL}/api/v1/printables/web/whoami`, {}, active.secret)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(printablesResponseError(data, response.status, 'Printables account capability check failed'));
        return data;
      })
      .then((data) => {
        if (!current) return;
        const capability = {
          designerStatus: data.designerStatus || null,
          storeActive: !!data.storeActive,
          storeFee: data.storeFee == null ? null : Number(data.storeFee),
          storeModelsCount: Number(data.storeModelsCount || 0),
          maxStoreModels: data.maxStoreModels == null ? null : Number(data.maxStoreModels),
          tiers: (data.tiers || []).map((tier) => ({ id: String(tier.id), name: tier.name || '' })),
        };
        setCapabilityState(capability);
        setCapabilityError('');
        onUpdate('capabilities', capability);
      })
      .catch((error) => {
        if (current) setCapabilityError(error instanceof Error ? error.message : String(error));
      });
    return () => { current = false; };
    // Account identity is the request trigger; onUpdate is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.secret]);
  const categories = metaState.categories.filter((category) => category.level !== 0);
  const paidSelected = !!opts.club || !!opts.store;
  const licenses = metaState.licenses.filter((license) =>
    license.isSelectable !== false && (paidSelected ? license.storeModels !== false : license.freeModels !== false));
  const paidEligible = !!capabilityState?.storeActive || [
    'PUBLISHED', 'APPROVED', 'REVIEW_REQUESTED', 'REVIEW_REJECTED', 'EDIT_APPROVED',
  ].includes(capabilityState?.designerStatus);
  const storeLimitReached = !!capabilityState?.maxStoreModels
    && capabilityState.storeModelsCount >= capabilityState.maxStoreModels;
  return (
    <div className="mt-3 space-y-3">
      <div>
        <Label>Batch action</Label>
        <select className="mp-input" value={opts.publication || 'draft'} onChange={(event) => onUpdate('publication', event.target.value)}>
          <option value="draft">Save unpublished draft (recommended)</option>
          <option value="publish">Publish publicly</option>
        </select>
      </div>
      <div>
        <Label>Printables summary (required, 120 characters)</Label>
        <input
          className="mp-input"
          maxLength={120}
          value={opts.summary || ''}
          onChange={(event) => onUpdate('summary', event.target.value)}
          placeholder="Short listing summary; falls back to the description"
        />
        <div className="mp-mono text-[10px] mt-1" style={{ color: 'rgba(21,23,28,0.66)' }}>
          {(opts.summary || '').length}/120 · leave blank to derive it from the description
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label>Printables category (required)</Label>
          <select className="mp-input" value={opts.categoryId || ''} onChange={(event) => onUpdate('categoryId', event.target.value)}>
            <option value="">Choose from live taxonomy…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.path?.length > 1 ? `${category.path[0].name} › ` : ''}{category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Printables license (required)</Label>
          <select className="mp-input" value={opts.licenseId || ''} onChange={(event) => onUpdate('licenseId', event.target.value)}>
            <option value="">Use mapped project license</option>
            {licenses.map((license) => <option key={license.id} value={license.id}>{license.name}</option>)}
          </select>
        </div>
      </div>
      {metaState.error && (
        <p className="text-[11px]" style={{ color: '#b91c1c' }}>
          Live Printables options could not load: {metaState.error}. Deploy/start the Worker before publishing.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label>Authorship</Label>
          <select className="mp-input" value={opts.authorship || 'author'} onChange={(event) => onUpdate('authorship', event.target.value)}>
            <option value="author">I am the original author</option>
            <option value="remix">This is a remix</option>
            <option value="reupload">This is a reupload</option>
          </select>
        </div>
        <div>
          <Label>AI used? (required)</Label>
          <select className="mp-input" value={opts.aiGenerated == null ? '' : String(opts.aiGenerated)} onChange={(event) => onUpdate('aiGenerated', event.target.value === '' ? null : event.target.value === 'true')}>
            <option value="">Choose yes or no…</option>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>
      </div>
      {(opts.authorship === 'remix' || opts.authorship === 'reupload') && (
        <div className="space-y-2">
          <div>
            <Label>{opts.authorship === 'remix' ? 'Original model URL or Printables ID' : 'Original source URL'}</Label>
            <input
              className="mp-input"
              value={opts.remixParents?.[0] || ''}
              onChange={(event) => onUpdate('remixParents', event.target.value ? [event.target.value] : [])}
              placeholder="https://www.printables.com/model/…"
            />
          </div>
          {opts.authorship === 'remix' && (
            <div>
              <Label>What did you change?</Label>
              <textarea className="mp-input" rows={3} value={opts.remixDescription || ''} onChange={(event) => onUpdate('remixDescription', event.target.value)} />
            </div>
          )}
        </div>
      )}
      <div className="p-2.5 space-y-2" style={{ background: 'rgba(250,104,49,0.05)', border: '1px solid rgba(250,104,49,0.24)' }}>
        <Label>Free, Store, or Club</Label>
        {!active && <p className="text-[11px]">Connect Printables to check account-specific paid and Club eligibility.</p>}
        {active && !capabilityState && !capabilityError && <p className="text-[11px]">Checking account eligibility…</p>}
        {capabilityError && <p className="text-[11px]" style={{ color: '#b91c1c' }}>{capabilityError}</p>}
        {capabilityState && !paidEligible && (
          <p className="text-[11px]">This account currently exposes only free models. Store/Club controls stay hidden until Printables reports designer eligibility.</p>
        )}
        {capabilityState && paidEligible && (
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!opts.store} disabled={!capabilityState.storeActive || storeLimitReached || opts.authorship === 'reupload'} onChange={(event) => onUpdate('store', event.target.checked)} />
              Paid Store model
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!opts.club} disabled={!capabilityState.tiers?.length || opts.authorship === 'reupload'} onChange={(event) => onUpdate('club', event.target.checked)} />
              Club model
            </label>
            {opts.store && (
              <div>
                <Label>Store price (whole USD, ${PRINTABLES_PRICE_MIN}–${PRINTABLES_PRICE_MAX})</Label>
                <input className="mp-input" type="number" min={PRINTABLES_PRICE_MIN} max={PRINTABLES_PRICE_MAX} step="1" value={opts.price || ''} onChange={(event) => onUpdate('price', event.target.value)} />
              </div>
            )}
            {opts.club && (
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={!!opts.excludeCommercialUsage} onChange={(event) => onUpdate('excludeCommercialUsage', event.target.checked)} />
                Exclude commercial usage for Club tiers
              </label>
            )}
            {capabilityState.storeFee != null && <p className="text-[11px]">Current account Store fee: {capabilityState.storeFee}%.</p>}
            {storeLimitReached && <p className="text-[11px]" style={{ color: '#b91c1c' }}>Store model limit reached ({capabilityState.maxStoreModels}).</p>}
            {opts.authorship === 'reupload' && <p className="text-[11px]" style={{ color: '#b91c1c' }}>Printables does not permit paid or Club reuploads.</p>}
          </div>
        )}
      </div>
      <div>
        <Label>ZIP handling</Label>
        <div className="flex gap-3 text-xs">
          <label className="flex items-center gap-1.5"><input type="radio" checked={(opts.zipMode || 'unzip') === 'unzip'} onChange={() => onUpdate('zipMode', 'unzip')} /> Unpack into model files</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={opts.zipMode === 'archive'} onChange={() => onUpdate('zipMode', 'archive')} /> Keep ZIP as Other file (256 MiB max)</label>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!opts.nsfw} onChange={(event) => onUpdate('nsfw', event.target.checked)} /> NSFW</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!opts.politicalContent} onChange={(event) => onUpdate('politicalContent', event.target.checked)} /> Political content</label>
      </div>
    </div>
  );
}

// =====================================================================
// SECTION: PREPARE FOR UPLOAD (real exports, no fake publishing)
// =====================================================================

// Pre-flight: run platformPreflight for every enabled platform and surface issues BEFORE
// the user publishes. Collapsed when everything's clean; expanded with details otherwise.
function PreflightPanel({ enabled, project, setCurrentSection }) {
  const [open, setOpen] = useState(false);
  const reports = enabled.map(p => ({ platform: p, ...platformPreflight(p, project) }));
  const totalErr = reports.reduce((n, r) => n + r.errors.length, 0);
  const totalWarn = reports.reduce((n, r) => n + r.warnings.length, 0);
  const clean = totalErr === 0 && totalWarn === 0;
  const bg = totalErr ? 'rgba(185,28,28,0.06)' : totalWarn ? 'rgba(255,87,34,0.05)' : 'rgba(79,178,134,0.08)';
  const bd = totalErr ? 'rgba(185,28,28,0.35)' : totalWarn ? 'rgba(255,87,34,0.3)' : 'rgba(79,178,134,0.35)';
  if (!enabled.length) return null;
  return (
    <div className="mp-card p-3 mt-5" style={{ background: bg, borderColor: bd }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 text-left">
        {clean ? <Check size={15} style={{ color: '#3a8d68' }} /> : totalErr ? <AlertCircle size={15} style={{ color: '#B91C1C' }} /> : <AlertCircle size={15} style={{ color: '#c83f10' }} />}
        <span className="text-[13px] font-medium" style={{ color: '#15171C' }}>
          {clean ? 'Pre-flight checks passed — ready to publish'
            : `Pre-flight: ${totalErr ? `${totalErr} blocker${totalErr > 1 ? 's' : ''}` : ''}${totalErr && totalWarn ? ' · ' : ''}${totalWarn ? `${totalWarn} warning${totalWarn > 1 ? 's' : ''}` : ''} across ${enabled.length} platform${enabled.length > 1 ? 's' : ''}`}
        </span>
        <span className="ml-auto">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {open && !clean && (
        <div className="mt-3 space-y-3">
          {reports.filter(r => r.errors.length || r.warnings.length).map(r => (
            <div key={r.platform.id}>
              <div className="flex items-center gap-1.5 text-[12px] font-medium mb-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: r.platform.dot }} />{r.platform.name}
              </div>
              <ul className="space-y-0.5 ml-3.5">
                {r.errors.map((e, i) => <li key={'e' + i} className="text-[12px]" style={{ color: '#B91C1C' }}>❌ {e}</li>)}
                {r.warnings.map((w, i) => <li key={'w' + i} className="text-[12px]" style={{ color: '#c83f10' }}>⚠ {w}</li>)}
              </ul>
            </div>
          ))}
          <div className="text-[11px] pt-1" style={{ color: 'rgba(21,23,28,0.66)' }}>
            Fix in <button onClick={() => setCurrentSection('files')} className="underline">Files</button> · <button onClick={() => setCurrentSection('details')} className="underline">Details</button> · <button onClick={() => setCurrentSection('images')} className="underline">Images</button>. Blockers (❌) will fail the upload; warnings (⚠) may just degrade the listing.
          </div>
        </div>
      )}
    </div>
  );
}

function PublishSection({ project, allReady, completion, setCurrentSection }) {
  const accounts = useAccounts();
  const openConnections = useOpenConnections();
  const enabled = PLATFORMS.filter(p => project.platforms[p.id]?.enabled);
  const directEnabled = enabled.filter((platform) => LIVE_PUBLISH_PLATFORM_IDS.includes(platform.id));
  const exportEnabled = enabled.filter((platform) => !LIVE_PUBLISH_PLATFORM_IDS.includes(platform.id));
  const cover = project.images.find(i => i.id === project.coverImageId);
  const publishTargets = enabled
    .filter((platform) => LIVE_PUBLISH_PLATFORM_IDS.includes(platform.id))
    .map((platform) => {
      const account = accounts.getActive(platform.id);
      const connected = accountIsUsable(account);
      const mode = project.__demo ? 'simulation' : connected ? 'real' : 'missing';
      const intent = batchPublishIntent(platform.id, project);
      return {
        id: platform.id,
        name: platform.name,
        accountLabel: connected ? account.label : (mode === 'simulation' ? 'Demo simulation' : account ? `${account.label} · session expired` : 'No account connected'),
        accountStatus: account?.status || 'unknown',
        mode,
        safeDemo: !!project.__demo,
        ...intent,
        issues: platformPreflight(platform, project),
      };
    });
  const [publishBatch, setPublishBatch] = useState(null);
  const [resourceTelemetry, setResourceTelemetry] = useState(null);
  const [resourceReportStatus, setResourceReportStatus] = useState('idle');
  const [retainedResourceReport, setRetainedResourceReport] = useState(() => {
    try {
      return loadRetainedPublishBatchResourceReports(window.localStorage)[0] || null;
    } catch {
      return null;
    }
  });
  // Broadcast signals so the parent can expand/collapse every card at once.
  // Cards keep their own `expanded` state; they just react to a signal change.
  // `allExpanded` tracks the last bulk action so the single toggle button can
  // show "Collapse all" or "Expand all" appropriately.
  const [expandSignal, setExpandSignal] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [allExpanded, setAllExpanded] = useState(false); // review details are on demand
  const [showExports, setShowExports] = useState(false);
  const [showZip, setShowZip] = useState(false);
  const toggleAll = () => {
    if (allExpanded) { setCollapseSignal(n => n + 1); setAllExpanded(false); }
    else { setExpandSignal(n => n + 1); setAllExpanded(true); }
  };
  const startPublishBatch = () => {
    if (publishBatch?.status === 'running') return;
    const isDesktop = typeof window !== 'undefined' && !!window.modelprepDesktop;
    const readyTargets = publishTargets.filter((target) => target.mode !== 'missing' && target.issues.errors.length === 0);
    setPublishBatch(createPublishBatch(readyTargets, `batch-${Date.now()}`, isDesktop ? DESKTOP_PUBLISH_CONCURRENCY : 1));
  };
  const handleBatchResult = (outcome) => {
    setPublishBatch((current) => advancePublishBatch(current, outcome));
  };
  const retryFailedBatch = () => {
    setPublishBatch((current) => retryFailedPublishBatch(current, `batch-retry-${Date.now()}`));
  };
  const readyTargetCount = publishTargets.filter((target) => target.mode !== 'missing' && target.issues.errors.length === 0).length;

  // Release queue: due scheduled plans for THIS project auto-start a normal
  // single-target batch as soon as this step is mounted and idle. Reminders
  // never auto-start; they stay in the queue until acted on or dismissed.
  const releasePlans = useReleasePlans();
  const queuedPlans = pendingReleasePlans(releasePlans);
  const startPlanPublish = (plan) => {
    if (publishBatch?.status === 'running') return false;
    const target = publishTargets.find((candidate) => candidate.id === plan.platformId);
    if (!target || target.mode === 'missing' || target.issues.errors.length) return false;
    const isDesktop = typeof window !== 'undefined' && !!window.modelprepDesktop;
    setPublishBatch(createPublishBatch([target], `plan-${plan.id}-${Date.now()}`, isDesktop ? DESKTOP_PUBLISH_CONCURRENCY : 1));
    releasePlanStore.set(patchReleasePlan(releasePlanStore.get(), plan.id, { status: 'done', firedAt: Date.now() }));
    return true;
  };
  useEffect(() => {
    if (publishBatch?.status === 'running') return;
    const due = dueScheduledTargets(releasePlans, project.title, publishTargets, Date.now());
    if (due.length) startPlanPublish(due[0].plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releasePlans, publishBatch?.status]);
  const resourceSummary = publishBatchSummary(publishBatch);
  const resourceSignature = [
    publishBatch?.runId || 'ready',
    publishBatch?.status || 'idle',
    (publishBatch?.activeIds || []).length,
    resourceSummary.succeeded,
    resourceSummary.failed,
    readyTargetCount,
  ].join(':');
  const resourceReport = useMemo(
    () => createPublishBatchResourceReport(publishBatch, resourceTelemetry),
    [publishBatch, resourceTelemetry],
  );

  useEffect(() => {
    const capture = typeof window !== 'undefined' ? window.modelprepDesktop?.captureResourceTelemetry : null;
    if (!allReady || directEnabled.length === 0 || typeof capture !== 'function') return undefined;
    let cancelled = false;
    const batchAtRequest = publishBatch;
    Promise.resolve(capture(publishBatchResourceRequest(batchAtRequest, readyTargetCount)))
      .then((sample) => {
        if (cancelled || Number(sample?.schemaVersion) !== 1) return;
        setResourceTelemetry(sample);
        if (batchAtRequest) {
          setPublishBatch((current) => current?.runId === batchAtRequest.runId
            ? appendPublishBatchResourceSample(current, sample)
            : current);
        }
      })
      .catch(() => { /* resource telemetry must never block publishing */ });
    return () => { cancelled = true; };
  }, [allReady, directEnabled.length, readyTargetCount, resourceSignature]);

  useEffect(() => {
    if (!resourceReport) {
      setResourceReportStatus('idle');
      return;
    }
    try {
      const retained = retainPublishBatchResourceReport(window.localStorage, resourceReport);
      setRetainedResourceReport(retained[0] || resourceReport);
      setResourceReportStatus('saved');
    } catch {
      setResourceReportStatus('unavailable');
    }
  }, [resourceReport]);

  const downloadableResourceReport = resourceReport || retainedResourceReport;
  const downloadResourceReport = () => {
    if (!downloadableResourceReport) return;
    const blob = new Blob([`${JSON.stringify(downloadableResourceReport, null, 2)}\n`], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = (downloadableResourceReport.completedAt || new Date().toISOString()).replace(/[:.]/g, '-');
    link.href = href;
    link.download = `modelprep-resource-report-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const releaseQueuePanel = (
    <>
      {queuedPlans.length > 0 && (
        <div className="mt-6 mp-card p-4" data-testid="release-queue">
          <div className="mp-mono text-[12px] uppercase tracking-[0.2em] mb-2" style={{ color: 'rgba(21,23,28,0.66)' }}>
            Release queue · {queuedPlans.length} planned
          </div>
          <div className="space-y-2">
            {queuedPlans.map((plan) => {
              const due = Date.parse(plan.dueAt) <= Date.now();
              const mine = (plan.projectTitle || '').trim().toLowerCase() === (project.title || 'Untitled Project').trim().toLowerCase();
              return (
                <div key={plan.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="mp-mono text-[11px] uppercase tracking-[0.15em] px-1.5 py-0.5" style={{ background: due ? '#FF5722' : 'rgba(21,23,28,0.08)', color: due ? '#fff' : 'inherit' }}>
                    {describeDue(plan, Date.now())}
                  </span>
                  <span className="font-bold">{plan.platformName || plan.platformId}</span>
                  <span className="truncate" style={{ opacity: 0.7 }}>{plan.projectTitle}{plan.note ? ` · ${plan.note}` : ''}</span>
                  <span className="mp-mono text-[10px] uppercase tracking-[0.15em]" style={{ opacity: 0.5 }}>
                    {plan.mode === 'scheduled' ? 'auto-publish' : 'reminder'}
                  </span>
                  <span className="flex-1" />
                  {mine && (
                    <button
                      className="mp-btn mp-btn-ghost text-[11px] py-1 px-2"
                      onClick={() => { if (!startPlanPublish(plan)) setCurrentSection('platforms'); }}
                    >
                      Publish now
                    </button>
                  )}
                  {!mine && <span className="text-[11px]" style={{ opacity: 0.55 }}>open “{plan.projectTitle}” to publish</span>}
                  <button
                    className="mp-btn mp-btn-ghost text-[11px] py-1 px-2"
                    aria-label={`Dismiss ${plan.platformName} plan`}
                    onClick={() => releasePlanStore.set(removeReleasePlan(releasePlanStore.get(), plan.id))}
                  >
                    Dismiss
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] mt-2" style={{ color: 'rgba(21,23,28,0.66)' }}>
            Scheduled publishes start automatically from this step while ModelPrep is open; reminders wait for you.
          </p>
        </div>
      )}
    </>
  );

  if (!allReady) {
    return (
      <div className="w-full min-w-0">
        <SectionHeader number="06" title="Prepare upload packages" subtitle="Complete the missing steps to prepare platform-ready packages." />
        <div className="mt-6 space-y-2">
          {SECTIONS.slice(0, -1).map(s => (
            <button key={s.id} onClick={() => setCurrentSection(s.id)} className="w-full p-3.5 mp-card flex items-center gap-3 text-left transition hover:border-[#FF5722]">
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: completion[s.id] ? '#4FB286' : 'rgba(21,23,28,0.08)' }}>
                {completion[s.id] ? <Check size={14} color="#fff" /> : <AlertCircle size={14} style={{ color: '#FF5722' }} />}
              </div>
              <div className="flex-1">
                <div className="mp-display text-[18px] leading-none">{s.label}</div>
                <div className="mp-body text-[13px] mt-1" style={{ color: 'rgba(21,23,28,0.66)' }}>
                  {completion[s.id] ? 'Complete' : 'Missing or incomplete'}
                </div>
              </div>
              <ChevronRight size={14} className="opacity-50" />
            </button>
          ))}
        </div>
        {releaseQueuePanel}
        <SectionNav backLabel="Back to Platforms" onBack={() => setCurrentSection('platforms')} />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <SectionHeader
        number="06"
        title="Publish"
        subtitle="Review the adapted package, then publish to all selected platforms or individually."
      />

      <div className="mp-card p-2.5 mb-4 text-[12px]" style={{ background: 'rgba(255,182,39,0.1)', border: '1px solid rgba(255,182,39,0.5)', color: 'rgba(21,23,28,0.75)' }}>
        <span className="mp-mono text-[10px] uppercase tracking-[0.2em] mr-1.5" style={{ color: '#8A4B08' }}>Beta</span>
        Private/draft publishing is fully certified. Public and paid publishing work but are still being verified per platform — check each platform’s visibility before publishing publicly.
      </div>

      <ProjectReviewSummary project={project} cover={cover} setCurrentSection={setCurrentSection} />

      <PreflightPanel enabled={enabled} project={project} setCurrentSection={setCurrentSection} />

      {releaseQueuePanel}

      {publishTargets.length > 0 && (
        <BatchPublishPanel
          targets={publishTargets}
          batch={publishBatch}
          resourceTelemetry={resourceTelemetry}
          resourceReport={downloadableResourceReport}
          resourceReportStatus={resourceReport ? resourceReportStatus : retainedResourceReport ? 'previous' : 'idle'}
          onPublish={startPublishBatch}
          onRetryFailed={retryFailedBatch}
          onDownloadResourceReport={downloadResourceReport}
          onOpenConnections={() => openConnections('accounts')}
          isTestProject={!!project.__testProject}
        />
      )}

      {directEnabled.length > 0 && (
        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="mp-display text-[22px] leading-none">Publishing destinations</h3>
            <p className="text-[12px] mt-1" style={{ color: 'rgba(21,23,28,0.56)' }}>{directEnabled.length} direct target{directEnabled.length === 1 ? '' : 's'} · expand only when you want the full platform preview or individual controls</p>
          </div>
          <button
            onClick={toggleAll}
            className="mp-mono text-[12px] uppercase tracking-[0.15em] py-1.5 px-2 hover:text-[#FF5722] transition flex items-center gap-1.5"
            aria-label={allExpanded ? 'Collapse every platform package' : 'Expand every platform package'}
          >
            {allExpanded ? <><ChevronRight size={13} /> Collapse all</> : <><ChevronDown size={13} /> Expand all</>}
          </button>
        </div>
      )}

      <div className="mt-3 space-y-4">
        {directEnabled.map(p => (
          <PlatformPackageCard
            key={p.id}
            platform={p}
            project={project}
            cover={cover}
            platformState={project.platforms[p.id]}
            expandSignal={expandSignal}
            collapseSignal={collapseSignal}
            setCurrentSection={setCurrentSection}
            batchRequest={publishBatch?.status === 'running' && (publishBatch.activeIds || [publishBatch.currentId]).includes(p.id)
              ? {
                runId: publishBatch.runId,
                action: publishBatch.results[p.id]?.action,
                visibility: publishBatch.results[p.id]?.visibility,
              }
              : null}
            onBatchResult={handleBatchResult}
          />
        ))}
      </div>

      {exportEnabled.length > 0 && (
      <div className="mt-6 mp-card" style={{ background: 'rgba(21,23,28,0.02)' }}>
        <button onClick={() => setShowExports((open) => !open)} className="w-full flex items-center gap-2 p-3 text-left" aria-expanded={showExports}>
          {showExports ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="mp-display text-[17px]">Export packages</span>
          <span className="text-[12px] ml-auto" style={{ color: 'rgba(21,23,28,0.66)' }}>{exportEnabled.length} selected · manual/future connections</span>
        </button>
        {showExports && (
          <div className="px-3 pb-3">
            <div className="space-y-3">
              {exportEnabled.map((platform) => (
                <PlatformPackageCard
                  key={platform.id}
                  platform={platform}
                  project={project}
                  cover={cover}
                  platformState={project.platforms[platform.id]}
                  setCurrentSection={setCurrentSection}
                />
              ))}
            </div>
            <div className="mt-3 border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
              <button onClick={() => setShowZip((open) => !open)} className="w-full flex items-center gap-2 py-2 text-left" aria-expanded={showZip}>
                {showZip ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="mp-display text-[15px]">Download every selected .zip</span>
                <span className="text-[12px] ml-auto" style={{ color: 'rgba(21,23,28,0.66)' }}>manual fallback</span>
              </button>
              {showZip && (
                <div className="pt-2 flex flex-col md:flex-row md:items-center gap-3">
                  <p className="mp-body text-xs leading-relaxed flex-1" style={{ color: 'rgba(21,23,28,0.7)' }}>
                    Creates one adapted package per selected platform with cropped images, formatted copy, metadata, and model files.
                  </p>
                  <BatchZipButton enabled={enabled} project={project} cover={cover} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      <SectionNav backLabel="Back to Platforms" onBack={() => setCurrentSection('platforms')} />
    </div>
  );
}

function ProjectReviewSummary({ project, cover, setCurrentSection }) {
  const license = LICENSES.find((item) => item.id === project.license);
  const gallery = project.images.filter((image) => image.id !== project.coverImageId).slice(0, 5);
  const profileNames = project.profiles.map((profile) => profile.name).filter(Boolean);
  return (
    <section className="mt-5 mp-card p-4" aria-labelledby="project-review-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 id="project-review-title" className="mp-display text-[22px] leading-none">Project review</h3>
          <p className="text-[12px] mt-1" style={{ color: 'rgba(21,23,28,0.56)' }}>The shared source ModelPrep will adapt for each selected platform.</p>
        </div>
        <button onClick={() => setCurrentSection('details')} className="mp-btn mp-btn-ghost text-[11px] py-1.5 px-2.5 min-h-[36px]"><Edit3 size={12} /> Edit details</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-4">
        <div>
          {cover ? (
            <img
              src={cover.dataUrl}
              alt={cover.alt || 'Selected project cover'}
              className="w-full aspect-[4/3] object-cover"
              style={{ objectPosition: `${cover.focal.x * 100}% ${cover.focal.y * 100}%`, background: '#15171C' }}
            />
          ) : (
            <div className="w-full aspect-[4/3] flex items-center justify-center" style={{ background: 'rgba(21,23,28,0.06)' }}><ImageIcon size={24} className="opacity-30" /></div>
          )}
          <button onClick={() => setCurrentSection('images')} className="mp-mono text-[10px] uppercase tracking-[0.13em] underline mt-1.5" style={{ color: '#FF5722' }}>Review image crops</button>
        </div>
        <div className="min-w-0">
          <h4 className="mp-display text-[28px] leading-none truncate">{project.title || 'Untitled project'}</h4>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
            <span><strong>{project.files.length}</strong> file{project.files.length === 1 ? '' : 's'}</span>
            <span><strong>{project.images.length}</strong> image{project.images.length === 1 ? '' : 's'}</span>
            <span><strong>{project.tags.length}</strong> tag{project.tags.length === 1 ? '' : 's'}</span>
            <span><strong>{profileNames.length}</strong> print profile{profileNames.length === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-2 text-[12px] leading-relaxed" style={{ color: 'rgba(21,23,28,0.62)' }}>
            {project.category || 'No category'} · {license?.name || project.license}
            {profileNames.length > 0 && <> · {profileNames.join(', ')}</>}
          </div>
          {gallery.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Images queued after the cover">
              {gallery.map((image, index) => (
                <img key={image.id} src={image.dataUrl} alt={image.alt || `Gallery image ${index + 2}`} className="w-14 h-14 object-cover flex-shrink-0" style={{ objectPosition: `${image.focal.x * 100}% ${image.focal.y * 100}%` }} />
              ))}
              {project.images.length - 1 > gallery.length && (
                <span className="w-14 h-14 flex items-center justify-center mp-mono text-[11px] flex-shrink-0" style={{ background: 'rgba(21,23,28,0.06)' }}>+{project.images.length - 1 - gallery.length}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Format a datetime-local value ("2026-05-25T14:00") for display.
function formatSchedule(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return v;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
// A datetime-local min value (now) so users can't schedule in the past.
function nowLocalMin() {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BatchPublishPanel({ targets, batch, resourceTelemetry = null, resourceReport = null, resourceReportStatus = 'idle', onPublish, onRetryFailed, onDownloadResourceReport, onOpenConnections, isTestProject = false }) {
  const missing = targets.filter((target) => target.mode === 'missing');
  const blockedTargets = targets.filter((target) => target.issues.errors.length > 0);
  const blocking = blockedTargets.flatMap((target) => target.issues.errors.map((issue) => `${target.name}: ${issue}`));
  const readyTargets = targets.filter((target) => target.mode !== 'missing' && target.issues.errors.length === 0);
  const running = batch?.status === 'running';
  const hasReal = targets.some((target) => target.mode === 'real');
  const publicTargets = targets.filter((target) => target.mode === 'real' && target.visibility === 'public');
  const noPublicRealTargets = hasReal && publicTargets.length === 0;
  const disabled = running || readyTargets.length === 0;
  const safeDemo = targets.some((target) => target.safeDemo);
  const summary = publishBatchSummary(batch);
  const batchResources = publishBatchResourceSummary(batch);
  const latestResources = batchResources.latest || resourceTelemetry;
  const adaptation = {
    makerworld: 'Landscape + portrait covers · up to 16 model pictures · adapted listing and Bambu profile',
    printables: 'Ordered photos · adapted listing, tags and category · per-file details',
    cults: 'Ordered photos · adapted listing, category and license · price and visibility',
    nexprint: '4:3 cover + ordered gallery · adapted listing and BOM · raw files and attachments',
    creality: 'Web + app covers · ordered gallery · raw files, instructions and visibility',
    makeronline: 'Ordered images · adapted listing and live taxonomy · raw files, docs and optional parsed 3MF profiles',
    mmf: 'Ordered photos · hierarchical category path · private/public state · raw files and print details',
    makeroad: '3–10 ordered images · live category resolution · models, profiles and private draft',
    thangs: 'Ordered images · typed multipart models · references, category, license and private state',
    thingiverse: 'Draft-first direct upload · ordered files and media · category, license and complete metadata readback',
  };

  return (
    <div className="mt-5 mp-card p-4" style={{ background: 'rgba(58,134,255,0.055)', border: '1px solid rgba(58,134,255,0.42)' }}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="mp-display text-[20px] leading-none">Publish selected platforms</span>
            <span className="mp-pill" style={{ background: '#3A86FF', color: '#fff' }}>one click</span>
          </div>
          <p className="mp-body text-[12px] leading-relaxed mt-1.5" style={{ color: 'rgba(21,23,28,0.7)' }}>
            The desktop app safely runs up to four platforms at once, while every platform keeps its own required request order. Browser fallback runs one at a time. A failure never stops the other selected destinations.
          </p>
          {latestResources && (
            <p data-testid="batch-resource-telemetry" className="mp-mono text-[10px] uppercase tracking-[0.08em] mt-1.5" style={{ color: 'rgba(21,23,28,0.52)' }}>
              Resource telemetry · {batchResources.sampleCount ? `peak ${batchResources.peakActivePublishers}` : latestResources.publishers.active} active · {batchResources.sampleCount ? `peak ${batchResources.peakAppWorkingSetMb}` : latestResources.memory.appWorkingSetMb} MB app working set · {latestResources.processes.total} processes · {batchResources.sampleCount ? `peak ${batchResources.peakAppCpuPercent}` : latestResources.cpu.appPercent}% CPU
            </p>
          )}
          {resourceReport && (batch?.status === 'done' || resourceReportStatus === 'previous') && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="mp-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: resourceReportStatus === 'unavailable' ? '#8A4B08' : 'rgba(21,23,28,0.52)' }}>
                {resourceReportStatus === 'saved'
                  ? `Resource report retained locally · ${resourceReport.samples.length} sample${resourceReport.samples.length === 1 ? '' : 's'}`
                  : resourceReportStatus === 'previous'
                    ? `Latest retained resource report · ${resourceReport.samples.length} sample${resourceReport.samples.length === 1 ? '' : 's'}`
                  : resourceReportStatus === 'unavailable'
                    ? 'Local resource-report retention unavailable'
                    : 'Preparing local resource report'}
              </span>
              <button type="button" onClick={onDownloadResourceReport} className="mp-btn mp-btn-ghost text-[10px] py-1 px-2">
                <Download size={11} /> Download resource report
              </button>
            </div>
          )}
          {noPublicRealTargets && (
            <p className="text-[12px] leading-relaxed mt-1.5" style={{ color: '#24634f' }}>
              No public listings: {targets.map((target) => `${target.name} ${target.visibility}`).join(' · ')}.
            </p>
          )}
          {safeDemo && (
            <p className="mt-2 text-[12px] leading-relaxed" style={{ color: '#24634f' }}>
              Demo safety is on: nothing is uploaded. Exit the demo when you want to publish with your connected accounts.
            </p>
          )}
          {isTestProject && !safeDemo && (
            <p className="text-[12px] leading-relaxed mt-2" style={{ color: '#8A4B08' }}>
              Demo publish: this sends the bundled sample files to every ready account. Destinations are set private, secret, or draft; unavailable ones are skipped and reported below.
            </p>
          )}
        </div>
        <button
          onClick={onPublish}
          disabled={disabled}
          title={blocking.length ? blocking.join(' ') : missing.length ? `Connect ${missing.map((target) => target.name).join(', ')}` : ''}
          className="mp-btn text-[13px] py-3 px-5 disabled:opacity-40 lg:min-w-[260px]"
          style={!disabled ? { background: '#3A86FF', borderColor: '#3A86FF' } : undefined}
        >
          {running
            ? <><Loader size={14} className="mp-spin" /> Publishing {summary.running} · {summary.succeeded + summary.failed}/{summary.total} complete</>
            : <><Send size={14} /> {isTestProject && !safeDemo ? 'Upload real test' : safeDemo ? (hasReal ? 'Run safe demo' : 'Simulate safe demo') : (hasReal ? (noPublicRealTargets ? 'Upload' : 'Publish') : 'Simulate publish')} to {readyTargets.length} ready platform{readyTargets.length === 1 ? '' : 's'}</>}
        </button>
      </div>

      {batch?.status === 'done' && (
        <div
          role="status"
          className="mt-3 p-2.5 text-[12px] mp-card flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: summary.failed ? 'rgba(255,182,39,0.1)' : 'rgba(79,178,134,0.1)',
            color: summary.failed ? '#8A4B08' : '#24634f',
          }}
        >
          <span>
            Batch finished: <strong>{summary.succeeded} succeeded</strong>
            {summary.failed ? <> · <strong>{summary.failed} failed</strong></> : ' · no failures'}.
            Review each platform receipt below before opening or sharing a listing.
          </span>
          {summary.failed > 0 && (
            <button onClick={onRetryFailed} className="mp-btn mp-btn-ghost text-[11px] py-1.5 px-3">
              <RefreshCw size={12} /> Retry {summary.failed} failed only
            </button>
          )}
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {targets.map((target) => {
          const result = batch?.results?.[target.id];
          const targetBlocked = target.issues.errors.length > 0;
          const state = result?.state || (target.mode === 'missing' || targetBlocked ? 'error' : 'ready');
          const receiptLabel = result
            ? publishReceiptLabel(result)
            : target.mode === 'missing'
              ? 'Skipped · Connect account'
              : targetBlocked
                ? 'Skipped · Fix requirements'
                : 'Ready';
          const receiptColor = state === 'error'
            ? '#b91c1c'
            : state === 'done'
              ? (result?.simulated ? '#3A86FF' : '#1a7f37')
              : 'rgba(21,23,28,0.55)';
          const receiptBackground = state === 'error'
            ? 'rgba(185,28,28,0.07)'
            : state === 'done'
              ? (result?.simulated ? 'rgba(58,134,255,0.08)' : 'rgba(26,127,55,0.08)')
              : 'rgba(21,23,28,0.05)';
          return (
            <div key={target.id} className="mp-card p-2.5 text-[12px]" style={{ background: '#fff' }}>
              <div className="flex items-center gap-2">
                {state === 'publishing' ? <Loader size={13} className="mp-spin" style={{ color: '#3A86FF' }} />
                  : state === 'done' ? <Check size={13} style={{ color: '#1a7f37' }} />
                    : state === 'error' ? <X size={13} style={{ color: '#b91c1c' }} />
                      : <StatusDot status={target.mode === 'missing' ? 'unknown' : 'connected'} />}
                <strong>{target.name}</strong>
                <span className="mp-mono text-[10px] uppercase ml-auto" style={{ color: target.mode === 'simulation' ? '#3A86FF' : 'rgba(21,23,28,0.5)' }}>
                  {target.mode}
                </span>
              </div>
              <div className="mt-1 truncate" title={target.accountLabel} style={{ color: 'rgba(21,23,28,0.58)' }}>{target.accountLabel}</div>
              <div
                className="mp-mono text-[10px] uppercase mt-1 inline-flex px-1.5 py-0.5"
                style={{ color: receiptColor, background: receiptBackground }}
                aria-label={`${target.name} publish status: ${receiptLabel}`}
              >
                {receiptLabel}
              </div>
              {target.mode === 'missing' && (
                <button
                  onClick={onOpenConnections}
                  className="mp-btn mp-btn-ghost text-[10px] py-1 px-2 min-h-[32px] mt-1.5"
                >
                  <RefreshCw size={11} /> {target.accountStatus === 'reconnect' ? `Reconnect ${target.name}` : `Connect ${target.name}`}
                </button>
              )}
              <div className="mt-1.5 leading-snug" style={{ color: 'rgba(21,23,28,0.66)' }}>{adaptation[target.id]}</div>
              {result?.detail && (
                <div className="mt-1 break-words" title={result.fullDetail || result.detail} style={{ color: state === 'error' ? '#b91c1c' : 'rgba(21,23,28,0.58)' }}>
                  {state === 'error' ? 'Error: ' : ''}{result.detail}
                </div>
              )}
              {state === 'done' && result?.url && !result.simulated && (
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 underline" style={{ color: '#3A86FF' }}>
                  Open result ↗
                </a>
              )}
            </div>
          );
        })}
      </div>

      {publicTargets.length > 0 && (
        <div className="mt-3 p-2 text-[12px] mp-card" style={{ background: 'rgba(255,182,39,0.1)', color: '#8A4B08' }}>
          ⚠️ This single action creates real public listings on {publicTargets.map((target) => target.name).join(', ')}. Other targets use the visibility shown above.
        </div>
      )}
      {missing.length > 0 && (
        <div className="mt-3 text-[12px]" style={{ color: '#b91c1c' }}>
          Skipped until connected: {missing.map((target) => target.name).join(', ')}.{' '}
          <button onClick={onOpenConnections} className="underline">Reconnect accounts</button>
        </div>
      )}
      {blocking.length > 0 && (
        <div className="mt-3 text-[12px]" style={{ color: '#b91c1c' }}>
          Skipped until its requirements are fixed: {blockedTargets.map((target) => target.name).join(', ')}. The preflight panel above lists {blocking.length} blocking requirement{blocking.length === 1 ? '' : 's'}.
        </div>
      )}
    </div>
  );
}

function BatchZipButton({ enabled, project, cover }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileNamePrefix = slugify(project.title);

  const downloadAllPlatforms = async () => {
    if (busy || !cover) return;
    setBusy(true);
    try {
      const JSZip = await loadJSZip();

      for (let pIdx = 0; pIdx < enabled.length; pIdx++) {
        const platform = enabled[pIdx];
        setMsg(`[${pIdx + 1}/${enabled.length}] ${platform.name}`);
        const zipBlob = await buildPlatformZip(JSZip, platform, project, cover,
          (m) => setMsg(`[${pIdx + 1}/${enabled.length}] ${platform.name} · ${m}`));
        triggerDownload(zipBlob, `${fileNamePrefix}_${platform.id}.zip`);
        // Brief gap between downloads to keep the browser happy.
        await new Promise(r => setTimeout(r, 600));
      }

      setMsg(`Done: ${enabled.length} zip(s)`);
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      console.error(e);
      setMsg(`Error: ${e.message}`);
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={downloadAllPlatforms}
      disabled={busy || !cover || enabled.length === 0}
      className="mp-btn text-[13px] py-2.5 px-4 whitespace-nowrap disabled:opacity-40"
      title={!cover ? 'Add at least one image first' : `Download ${enabled.length} zip(s), one per platform`}
    >
      {busy ? (
        <><Loader size={13} className="mp-spin" /> <span className="mp-mono text-[13px] tracking-normal normal-case">{msg || 'Working'}</span></>
      ) : (
        <><Download size={13} /> {enabled.length} .zip files</>
      )}
    </button>
  );
}

function PlatformPackageCard({
  platform,
  project,
  cover,
  platformState,
  expandSignal = 0,
  collapseSignal = 0,
  setCurrentSection,
  batchRequest,
  onBatchResult,
}) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progressMsg, setProgressMsg] = useState(null);
  const [uploadSignal, setUploadSignal] = useState(0);
  // Platforms with a real one-click upload: hide all the manual .zip/copy-paste prep
  // (it's redundant) and show only the live upload flow. Others keep the manual package.
  const hasRealUpload = platform.id === 'cults' || platform.id === 'makerworld' || platform.id === 'printables' || platform.id === 'nexprint' || platform.id === 'creality' || platform.id === 'makeronline' || platform.id === 'mmf' || platform.id === 'makeroad' || platform.id === 'thangs' || platform.id === 'thingiverse';

  // React to the parent's expand-all / collapse-all broadcasts.
  useEffect(() => { if (expandSignal > 0) setExpanded(true); }, [expandSignal]);
  useEffect(() => { if (collapseSignal > 0) setExpanded(false); }, [collapseSignal]);

  const desc = useMemo(() => {
    if (platform.descFormat === 'markdown') return project.description;
    if (platform.descFormat === 'html')     return mdToHtml(project.description);
    return mdToPlain(project.description);
  }, [platform.descFormat, project.description]);

  const tagString = formatTagsFor(platform.id, project.tags);
  const uploadUrl = UPLOAD_URLS[platform.id];
  const fileNamePrefix = (project.title || 'model').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'model';

  const downloadImage = async (image, w, h, suffix) => {
    if (!w || !h || platform.preserveOriginalImages) {
      const blob = await fetch(image.dataUrl).then((response) => response.blob());
      const ext = fileExt(image.name || '') || (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      triggerDownload(blob, `${fileNamePrefix}_${platform.id}_${suffix}_original.${ext}`);
      return;
    }
    const img = await loadImageFromDataUrl(image.dataUrl);
    const canvas = cropToCanvas(img, w, h, image.focal);
    downloadCanvas(canvas, `${fileNamePrefix}_${platform.id}_${suffix}_${w}x${h}.jpg`);
  };

  const downloadAllCovers = async () => {
    if (!cover) return;
    setDownloading(true);
    for (let i = 0; i < platform.covers.length; i++) {
      const c = platform.covers[i];
      await downloadImage(cover, c.w, c.h, c.id);
      await new Promise(r => setTimeout(r, 350));
    }
    setDownloading(false);
  };

  const downloadAllGallery = async () => {
    setDownloading(true);
    const others = project.images.filter(i => i.id !== project.coverImageId);
    const limit = Math.min(others.length, galleryCapacity(platform));
    const main = platform.covers[0];
    for (let i = 0; i < limit; i++) {
      await downloadImage(others[i], main.w, main.h, `gallery${String(i + 2).padStart(2, '0')}`);
      await new Promise(r => setTimeout(r, 300));
    }
    setDownloading(false);
  };

  const downloadDescriptionFile = () => {
    const ext = platform.descFormat === 'markdown' ? 'md' : platform.descFormat === 'html' ? 'html' : 'txt';
    downloadTextFile(desc, `${fileNamePrefix}_${platform.id}_description.${ext}`);
  };

  const downloadEverything = async () => {
    if (downloading) return;
    setDownloading(true);
    setProgressMsg('Loading ZIP library');
    try {
      const JSZip = await loadJSZip();
      const zipBlob = await buildPlatformZip(JSZip, platform, project, cover, setProgressMsg);
      triggerDownload(zipBlob, `${fileNamePrefix}_${platform.id}.zip`);
      setProgressMsg(`Done: ${formatBytes(zipBlob.size)}`);
      setTimeout(() => setProgressMsg(null), 2500);
    } catch (e) {
      console.error('ZIP generation failed', e);
      setProgressMsg(`Error: ${e.message}`);
      setTimeout(() => setProgressMsg(null), 4000);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mp-card">
      {/* Header row */}
      <div className="p-4 flex flex-col gap-3 border-b sm:flex-row sm:items-start" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-2.5 h-2.5 mt-1.5 flex-shrink-0" style={{ background: platform.dot }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="mp-display text-[22px] leading-none">{platform.name}</h3>
              {platform.apiSupport === 'oneclick' && (
                <span className="mp-pill" style={{ background: '#4FB286', color: '#fff' }}>{platform.apiLive ? 'API' : 'API soon'}</span>
              )}
              {platform.apiSupport === 'manual' && (
                <span className="mp-pill" style={{ background: 'rgba(21,23,28,0.1)', color: 'rgba(21,23,28,0.66)' }}>manual</span>
              )}
              {platform.apiSupport === 'addon' && (
                <span className="mp-pill" style={{ background: 'rgba(58,134,255,0.15)', color: '#3A86FF' }}>addon</span>
              )}
            </div>
            <div className="mp-mono text-[12px] uppercase tracking-[0.15em] mt-1" style={{ color: 'rgba(21,23,28,0.66)' }}>
              {platform.org} · {platform.descFormat} description · {platform.id === 'makerworld'
                ? `${platform.maxImages} model pictures + cover`
                : Number.isFinite(platform.maxImages) ? `${platform.maxImages} img max` : 'image count not published'}
            </div>
          </div>
          <button onClick={() => setExpanded(s => !s)} className="p-2 opacity-60 hover:opacity-100 transition flex-shrink-0 sm:hidden" aria-label={expanded ? 'Collapse package' : 'Expand package'} aria-expanded={expanded}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          {/* Manual prep (download package, open upload page) — only for platforms without
              a real one-click upload. */}
          {!hasRealUpload && (
            <>
              <button
                onClick={downloadEverything}
                disabled={downloading || !cover}
                className="mp-btn text-[13px] py-2 px-3 disabled:opacity-40 flex-1 sm:flex-none sm:min-w-[140px]"
                title={!cover ? 'Add at least one image first' : 'Download a ZIP containing everything for this platform'}
              >
                {downloading ? (
                  <><Loader size={12} className="mp-spin" /> <span className="mp-mono text-[13px] normal-case tracking-normal truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{progressMsg || 'Working'}</span></>
                ) : (
                  <><Download size={12} /> {progressMsg ? progressMsg : 'Download .zip'}</>
                )}
              </button>
              <a href={uploadUrl} target="_blank" rel="noopener noreferrer" className="mp-btn mp-btn-ghost text-[13px] py-2 px-3 flex-1 sm:flex-none">
                <Send size={12} /> Open upload page
              </a>
            </>
          )}
          <button onClick={() => setExpanded(s => !s)} className="p-2 opacity-60 hover:opacity-100 transition hidden sm:block" aria-label={expanded ? 'Collapse package' : 'Expand package'} aria-expanded={expanded}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {(expanded || hasRealUpload) && (
        <div className={expanded ? 'p-4 space-y-4' : 'hidden'} aria-hidden={!expanded}>
          {!hasRealUpload && (
          <>
          {/* Title + category + license row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <PackageField label="Title" value={project.title} />
            <PackageField label="Category" value={project.category} />
            <PackageField label="License" value={LICENSES.find(l => l.id === project.license)?.name.split(' — ')[0] || project.license} />
          </div>

          {/* Platform-specific fields */}
          {(platformState.price !== undefined || platformState.contestEntry || platformState.remix) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {platformState.price !== undefined && (
                <PackageField label="Price" value={platformState.free ? 'Free' : `$${platformState.price.toFixed(2)}`} />
              )}
              {platformState.contestEntry && (
                <PackageField label="Contest entry" value={platformState.contestEntry} />
              )}
              {platformState.remix && (
                <PackageField label="Remix" value="Yes — link the original in description" />
              )}
            </div>
          )}

          {/* Tags */}
          <div>
            <PackageLabel label="Tags" hint={`${project.tags.length} · ${platform.id === 'thingiverse' ? 'space-separated' : 'comma-separated'}`}>
              <CopyButton text={tagString} />
            </PackageLabel>
            <div className="mp-card mp-mono text-xs p-2.5" style={{ background: 'rgba(21,23,28,0.03)' }}>{tagString || <span style={{ color: 'rgba(21,23,28,0.66)' }}>(no tags)</span>}</div>
          </div>

          {/* Description */}
          <div>
            {isRichTextPlatform(platform.id) ? (
              <>
                <PackageLabel label="Description (rich text)" hint={`${platform.name} uses a visual editor — paste keeps formatting`}>
                  <RichCopyButton html={mdToHtml(project.description)} plain={mdToPlain(project.description)} />
                  <button onClick={downloadDescriptionFile} className="mp-mono text-[12px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
                    <Download size={10} /> .html
                  </button>
                </PackageLabel>
                <div className="mp-card mp-prose p-4 text-[14px] max-h-56 overflow-auto" style={{ background: '#FFFFFF' }}
                  dangerouslySetInnerHTML={{ __html: mdToHtml(project.description) || '<span style="color:rgba(21,23,28,0.4)">(no description)</span>' }} />
                <p className="text-[12px] mt-1.5 leading-snug" style={{ color: 'rgba(21,23,28,0.66)' }}>
                  Don't paste raw HTML into {platform.name} — it shows the tags. Hit <strong>Copy formatted</strong>, then paste into the description box. (The .html download is a backup: open it in a browser, select all, copy.)
                </p>
              </>
            ) : (
              <>
                <PackageLabel label={`Description (${platform.descFormat})`} hint={`${desc.length} chars`}>
                  <CopyButton text={desc} />
                  <button onClick={downloadDescriptionFile} className="mp-mono text-[12px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
                    <Download size={10} /> .{platform.descFormat === 'markdown' ? 'md' : platform.descFormat === 'html' ? 'html' : 'txt'}
                  </button>
                </PackageLabel>
                <pre className="mp-pre mp-mono text-[13px] leading-relaxed mp-card p-3 max-h-48 overflow-auto" style={{ background: 'rgba(21,23,28,0.03)', color: 'rgba(21,23,28,0.85)' }}>
                  {desc || <span style={{ color: 'rgba(21,23,28,0.66)' }}>(no description)</span>}
                </pre>
              </>
            )}
          </div>

          {/* Cover image(s) */}
          {cover && (
            <div>
              <PackageLabel label={`Cover image${platform.covers.length > 1 ? 's' : ''}`} hint={platform.covers.map(c => `${c.w}×${c.h}`).join(' · ')}>
                <button onClick={downloadAllCovers} disabled={downloading} className="mp-mono text-[12px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
                  <Download size={10} /> {platform.covers.length > 1 ? `Both covers` : 'JPG'}
                </button>
              </PackageLabel>
              <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${platform.covers.length}, minmax(0, 1fr))` }}>
                {platform.covers.map((c) => (
                  <CoverPreview key={c.id} image={cover} cover={c} onDownload={() => downloadImage(cover, c.w, c.h, c.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Gallery images */}
          {project.images.length > 1 && (
            <div>
              <PackageLabel
                label="Gallery images"
                hint={Number.isFinite(platform.maxImages)
                  ? `${Math.min(project.images.length - 1, galleryCapacity(platform))} of ${project.images.length - 1} additional (cap ${galleryCapacity(platform)})`
                  : `${project.images.length - 1} additional · platform cap not published`}
              >
                <button onClick={downloadAllGallery} disabled={downloading} className="mp-mono text-[12px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
                  <Download size={10} /> All gallery
                </button>
              </PackageLabel>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {project.images
                  .filter(i => i.id !== project.coverImageId)
                  .slice(0, galleryCapacity(platform))
                  .map((img, i) => (
                    <GalleryThumb
                      key={img.id}
                      image={img}
                      mainCover={platform.covers[0]}
                      onDownload={() => downloadImage(img, platform.covers[0].w, platform.covers[0].h, `gallery${String(i + 2).padStart(2, '0')}`)}
                    />
                  ))}
              </div>
              {Number.isFinite(platform.maxImages) && project.images.length - 1 > galleryCapacity(platform) && (
                <div className="mt-2 mp-mono text-[12px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
                  /// {project.images.length - 1 - galleryCapacity(platform)} image(s) skipped, {platform.name} caps at {galleryCapacity(platform)} gallery images
                </div>
              )}
            </div>
          )}

          {/* Files to upload */}
          {project.files.length > 0 && (
            <div>
              <PackageLabel label="Model files" hint={`${project.files.length} file${project.files.length === 1 ? '' : 's'}, uploaded directly to ${platform.name}`} />
              <div className="space-y-1.5">
                {project.files.map(f => {
                  const ext = fileExt(f.name);
                  const accepted = platform.formats.includes(ext);
                  return (
                    <div key={f.id} className="mp-card p-2 flex items-center gap-2 text-xs" style={{ opacity: accepted ? 1 : 0.55 }}>
                      <div className="w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ background: f.isProfile ? '#FF5722' : '#15171C', color: '#fff' }}>
                        {f.isProfile ? <Layers size={11} /> : <FileCheck size={11} />}
                      </div>
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="mp-mono text-[12px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
                        {formatBytes(f.size)}
                      </span>
                      {accepted ? (
                        <span className="mp-pill" style={{ background: 'rgba(79,178,134,0.15)', color: '#3a8d68' }}>accepted</span>
                      ) : (
                        <span className="mp-pill" style={{ background: 'rgba(255,87,34,0.15)', color: '#c83f10' }}>not supported</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          </>
          )}

          {/* Read-only listing preview (collapsed) — verify per-platform before publishing. */}
          {hasRealUpload && <PlatformPreview platform={platform} project={project} cover={cover} setCurrentSection={setCurrentSection} />}

          {/* Real upload (live). Other API platforms still simulated until their flows land. */}
          {platform.id === 'cults' && <CultsUploadFlow platform={platform} project={project} batchRequest={batchRequest} onBatchResult={onBatchResult} />}
          {platform.id === 'makerworld' && <MakerWorldUploadFlow platform={platform} project={project} batchRequest={batchRequest} onBatchResult={onBatchResult} />}
          {platform.id === 'printables' && <PrintablesUploadFlow platform={platform} project={project} batchRequest={batchRequest} onBatchResult={onBatchResult} />}
          {platform.id === 'nexprint' && <NexprintUploadFlow platform={platform} project={project} batchRequest={batchRequest} onBatchResult={onBatchResult} />}
          {platform.id === 'creality' && <CrealityUploadFlow platform={platform} project={project} batchRequest={batchRequest} onBatchResult={onBatchResult} />}
          {platform.id === 'makeronline' && <MakerOnlineUploadFlow platform={platform} project={project} batchRequest={batchRequest} onBatchResult={onBatchResult} />}
          {platform.id === 'mmf' && <MyMiniFactoryUploadFlow platform={platform} project={project} batchRequest={batchRequest} onBatchResult={onBatchResult} />}
          {platform.id === 'makeroad' && <MakerRoadUploadFlow platform={platform} project={project} batchRequest={batchRequest} onBatchResult={onBatchResult} />}
          {platform.id === 'thangs' && <ThangsUploadFlow platform={platform} project={project} batchRequest={batchRequest} onBatchResult={onBatchResult} />}
          {platform.id === 'thingiverse' && <ThingiverseUploadFlow platform={platform} project={project} batchRequest={batchRequest} onBatchResult={onBatchResult} />}
          {platform.hasApi && platform.id !== 'cults' && platform.id !== 'makerworld' && platform.id !== 'printables' && platform.id !== 'nexprint' && platform.id !== 'creality' && platform.id !== 'makeronline' && platform.id !== 'mmf' && platform.id !== 'makeroad' && platform.id !== 'thangs' && platform.id !== 'thingiverse' && <MockUploadFlow platform={platform} project={project} startSignal={uploadSignal} />}

          {/* Manual workflow hint — only for platforms without a real upload. */}
          {!hasRealUpload && (
            <div className="border-t pt-3 flex items-start gap-2 text-[13px]" style={{ borderColor: 'rgba(21,23,28,0.08)', color: 'rgba(21,23,28,0.66)' }}>
              <Info size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#FF5722' }} />
              <div>
                <strong className="mp-display tracking-wide" style={{ color: '#15171C' }}>{platform.hasApi ? 'MANUAL UPLOAD (WORKS TODAY)' : 'WORKFLOW'}</strong>{' '}
                <span>1) Click "Open upload page". 2) Drag model files into the form. 3) Copy → paste title and description. 4) Drop the downloaded cover image. 5) Drop gallery images in order. 6) Paste tags. 7) Pick the closest category. Done.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PackageLabel({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div>
        <span className="mp-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.66)' }}>{label}</span>
        {hint && <span className="mp-mono text-[12px] uppercase tracking-[0.15em] ml-2" style={{ color: 'rgba(21,23,28,0.35)' }}>· {hint}</span>}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

function PackageField({ label, value }) {
  const [state, setState] = useState(null); // null | 'ok' | 'fail'
  const copy = async () => {
    const ok = await copyPlainText(value || '');
    setState(ok ? 'ok' : 'fail');
    setTimeout(() => setState(null), 1600);
  };
  return (
    <div className="mp-card p-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="mp-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.66)' }}>{label}</span>
        <button onClick={copy} className="p-1.5 -m-1 opacity-60 hover:opacity-100 transition" aria-label={`Copy ${label}`} title={state === 'fail' ? 'Copy failed — select manually' : `Copy ${label}`}>
          {state === 'ok' ? <Check size={13} style={{ color: '#4FB286' }} /> : state === 'fail' ? <X size={13} style={{ color: '#c83f10' }} /> : <Copy size={13} />}
        </button>
      </div>
      <div className="mp-display text-[15px] leading-tight truncate">{value || <span style={{ color: 'rgba(21,23,28,0.66)' }} className="mp-body">—</span>}</div>
    </div>
  );
}

function CopyButton({ text }) {
  const [state, setState] = useState(null); // null | 'ok' | 'fail'
  const copy = async () => {
    const ok = await copyPlainText(text || '');
    setState(ok ? 'ok' : 'fail');
    setTimeout(() => setState(null), 1600);
  };
  return (
    <button onClick={copy} disabled={!text} className="mp-mono text-[12px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1 disabled:opacity-30 py-1" aria-label="Copy to clipboard">
      {state === 'ok' ? <><Check size={13} style={{ color: '#4FB286' }} /> Copied</> : state === 'fail' ? <><X size={13} style={{ color: '#c83f10' }} /> Select &amp; copy</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

// Copy button for rich-text editors: puts formatted content on the clipboard so
// pasting into a WYSIWYG box (e.g. MakerWorld) keeps headings/bold/lists.
function RichCopyButton({ html, plain, label = 'Copy formatted' }) {
  const [state, setState] = useState(null); // null | 'ok' | 'fail'
  const copy = async () => {
    const ok = await copyRichText(html, plain);
    setState(ok ? 'ok' : 'fail');
    setTimeout(() => setState(null), 1600);
  };
  return (
    <button onClick={copy} disabled={!plain} className="mp-mono text-[12px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1 disabled:opacity-30 py-1" aria-label={label}>
      {state === 'ok' ? <><Check size={13} style={{ color: '#4FB286' }} /> Copied</> : state === 'fail' ? <><X size={13} style={{ color: '#c83f10' }} /> Select &amp; copy</> : <><Copy size={12} /> {label}</>}
    </button>
  );
}

// Simulated one-click upload for platforms with a real upload API (Cults3D,
// MyMiniFactory, Thingiverse). This is a DEMO — no network calls, no real upload.
// It previews the UX that a backend-backed v0.3 would deliver.
function MockUploadFlow({ platform, project, startSignal = 0 }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | uploading | done | scheduled
  const [stepMsg, setStepMsg] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const cancelled = useRef(false);
  const statusRef = useRef('idle');
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { cancelled.current = false; return () => { cancelled.current = true; }; }, []);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const fileCount = project.files.length;
  const imgCount = project.images.length;

  const connect = async () => {
    setStatus('connecting');
    await sleep(1100);
    if (cancelled.current) return;
    setStatus('connected');
  };

  // Triggered by the "One-click upload" button on the collapsed row.
  useEffect(() => {
    if (startSignal > 0 && statusRef.current === 'idle') connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal]);

  const publish = async () => {
    // If a publish time is set, capture the schedule instead of uploading now.
    if (scheduledAt) { setStatus('scheduled'); return; }
    setStatus('uploading');
    const steps = [
      `Authenticating with ${platform.name}…`,
      `Uploading ${fileCount} model file${fileCount === 1 ? '' : 's'}…`,
      `Uploading ${imgCount} image${imgCount === 1 ? '' : 's'}…`,
      `Submitting title, description, tags, license…`,
      platform.id === 'mmf' ? `Queuing for curation (test print)…` : `Publishing…`,
    ];
    for (const s of steps) {
      if (cancelled.current) return;
      setStepMsg(s);
      await sleep(850);
    }
    if (cancelled.current) return;
    const slug = (project.title || 'untitled-model').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'model';
    const urls = {
      cults: `https://cults3d.com/en/3d-model/${slug}`,
      mmf: `https://www.myminifactory.com/object/${slug}`,
      thingiverse: `https://www.thingiverse.com/thing:${slug}`,
    };
    setResultUrl(urls[platform.id] || '#');
    setStatus('done');
  };

  return (
    <div className="border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="mp-card p-3" style={{ background: 'rgba(58,134,255,0.05)', border: '1px solid rgba(58,134,255,0.35)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="mp-display tracking-wide text-[14px]" style={{ color: '#15171C' }}>ONE-CLICK UPLOAD</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: '#3A86FF', color: '#fff' }}>Demo</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.66)' }}>{platform.name} has an upload API</span>
        </div>

        {status === 'idle' && (
          <>
            <p className="text-[13px] mb-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.65)' }}>
              {platform.name} supports publishing via API. Connect your account once, then publish straight from here — no manual upload page.
            </p>
            <button onClick={connect} className="mp-btn text-xs py-2 px-3"><Globe size={13} /> Connect {platform.name}</button>
          </>
        )}

        {status === 'connecting' && (
          <div className="flex items-center gap-2 text-xs py-1.5" style={{ color: 'rgba(21,23,28,0.7)' }}>
            <Loader size={14} className="mp-spin" /> Opening {platform.name} authorization…
          </div>
        )}

        {status === 'connected' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-2.5" style={{ color: '#3a8d68' }}>
              <Check size={14} /> Connected as <span className="mp-mono">@your-handle</span> <span style={{ color: 'rgba(21,23,28,0.66)' }}>(demo)</span>
            </div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <label className="mp-mono text-[11px] uppercase tracking-[0.15em] flex items-center gap-1.5" style={{ color: 'rgba(21,23,28,0.66)' }}>
                <Clock size={12} /> Schedule
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={nowLocalMin()}
                onChange={(e) => setScheduledAt(e.target.value)}
                aria-label={`Schedule publish to ${platform.name}`}
                className="mp-input-sm"
              />
              {scheduledAt && (
                <button onClick={() => setScheduledAt('')} className="mp-mono text-[11px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition" aria-label="Clear schedule">clear</button>
              )}
            </div>
            <p className="text-[11px] mb-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.66)' }}>Preview only — won't actually publish at that time yet (timed publishing runs server-side, coming with the backend).</p>
            <button onClick={publish} className="mp-btn text-xs py-2 px-3">
              {scheduledAt ? <><Clock size={13} /> Save schedule for {formatSchedule(scheduledAt)}</> : <><Send size={13} /> Publish to {platform.name}</>}
            </button>
          </>
        )}

        {status === 'uploading' && (
          <div className="flex items-center gap-2 text-xs py-1.5" style={{ color: 'rgba(21,23,28,0.7)' }}>
            <Loader size={14} className="mp-spin" /> {stepMsg}
          </div>
        )}

        {status === 'scheduled' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-1.5" style={{ color: '#3a8d68' }}>
              <Clock size={14} /> Scheduled for {formatSchedule(scheduledAt)}
            </div>
            <p className="text-[12px] mb-2 leading-snug" style={{ color: 'rgba(21,23,28,0.66)' }}>
              {platform.name} will publish automatically at that time once timed publishing ships (it runs server-side). For now this captures the intent.
            </p>
            <button onClick={() => setStatus('connected')} className="mp-mono text-[12px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
              <ArrowRight size={11} /> Change schedule
            </button>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-1.5" style={{ color: '#15171C' }}>
              <Check size={14} style={{ color: '#3a8d68' }} /> Demo only — nothing was uploaded
            </div>
            <p className="text-[12px] mb-1.5 leading-snug" style={{ color: 'rgba(21,23,28,0.66)' }}>
              This is what one-click {platform.id === 'mmf' ? 'submit (then MyMiniFactory test-prints before going live)' : 'publish'} will look like. Example URL it would produce:
            </p>
            <div className="mp-card mp-mono text-[13px] p-2 mb-2 break-all" style={{ background: 'rgba(21,23,28,0.04)', color: 'rgba(21,23,28,0.66)', textDecoration: 'line-through' }}>{resultUrl}</div>
            <button onClick={() => { setStatus('connected'); setStepMsg(''); }} className="mp-mono text-[12px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
              <ArrowRight size={11} /> Run again
            </button>
          </>
        )}

        <p className="text-[11px] mt-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.66)' }}>
          Simulation only—nothing is uploaded. This platform’s live API flow is not connected yet; use the manual package below.
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// REAL Cults3D publish flow — sends one multipart request through Electron.
// The per-account Chromium session calls Cults's web flow and signed S3 path,
// creates the draft, applies pricing/license/visibility, and returns a
// `substituted[]` array for any category/license mapping fallback.
// =====================================================================
// VITE_WORKER_URL is set per-env: .env.local for dev (your local override),
// .env.production for prod builds (committed; points at the deployed Worker).
const WORKER_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WORKER_URL)
  || 'http://localhost:8787';
// Cults credentials never enter the accounts store. lib/accounts.js scrubs the
// legacy password record and marks that account for an interactive reconnect.

function useMakerWorldCapabilities(cookie, enabled = true) {
  const [state, setState] = useState({ data: null, error: '', loading: false });
  useEffect(() => {
    let active = true;
    if (!enabled || !cookie) { setState({ data: null, error: '', loading: false }); return () => { active = false; }; }
    setState({ data: null, error: '', loading: true });
    makerWorldFetch(
      `${WORKER_URL}/api/v1/makerworld/web/capabilities`,
      { headers: { 'X-MW-Cookie': cookie } },
      cookie,
    )
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(makerWorldResponseError(data, response.status, 'Could not check MakerWorld upload eligibility'));
        return data;
      })
      .then((data) => { if (active) setState({ data, error: '', loading: false }); })
      .catch((error) => { if (active) setState({ data: null, error: error instanceof Error ? error.message : String(error), loading: false }); });
    return () => { active = false; };
  }, [cookie, enabled]);
  return state;
}

function CultsUploadFlow({ platform, project, batchRequest, onBatchResult }) {
  const acc = useAccounts();
  const openConnections = useOpenConnections();
  const desktop = (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop) ? window.modelprepDesktop : null;
  const cultsAccounts = acc.getAccounts('cults');
  // Demo mode simulates the publish (no network) with a synthetic connected account.
  const isDemo = !!project.__demo;
  const realActive = acc.getActive('cults');
  const realCreds = realActive?.secret || null;
  const simulate = isDemo;
  const active = realActive || (isDemo ? { id: 'demo', label: 'Demo account', status: 'connected' } : null);
  const creds = realCreds || (isDemo ? 'demo' : null);
  const [status, setStatus] = useState(creds ? 'connected' : 'idle'); // connected | publishing | done | error | deactivating | idle
  // Default to 'secret' so the first publish doesn't immediately surface on
  // the user's profile — they can flip to 'public' once they've seen the
  // listing render. Persisted in component state per session, not saved.
  const visibility = project.platforms?.cults?.visibility || 'secret'; // set on the Platforms step
  const [result, setResult] = useState(null); // { designUrl, slug, substituted, uploadedFiles } | null
  const [errorMsg, setErrorMsg] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const handledBatchRun = useRef(null);
  const reportBatch = (batchRunId, state, detail, metadata = {}) => {
    if (!batchRunId) return;
    onBatchResult?.({ runId: batchRunId, platformId: 'cults', state, detail, ...metadata });
  };

  // My Listings panel state — toggled open per-session. Listings load on open;
  // refresh button re-fetches. Per-row pending state lets us disable buttons
  // while a deactivate/delete is in flight without blocking the whole panel.
  const [listingsOpen, setListingsOpen] = useState(false);
  const [listings, setListings] = useState(null);             // CultsWebMyCreation[] | null
  const [listingsError, setListingsError] = useState('');
  const [listingsLoading, setListingsLoading] = useState(false);
  const [pendingRow, setPendingRow] = useState({ slug: null, action: null }); // { slug, 'deactivate'|'delete' }

  // Sign-in is managed centrally in the Connections modal; here we only switch/clear.
  const disconnect = async () => {
    if (realActive && desktop?.disconnectCults && isDesktopCultsSession(realActive.secret)) {
      try { await desktop.disconnectCults(desktopCultsAccountId(realActive.secret)); } catch { /* still clear renderer marker */ }
    }
    if (active) acc.removeAccount('cults', active.id);
    setResult(null);
    setStatus('idle');
  };
  // Keep local status in sync with the active account (sign-in/out happens in the modal).
  useEffect(() => {
    setStatus((s) => (creds && s === 'idle') ? 'connected' : (!creds && s === 'connected') ? 'idle' : s);
  }, [creds]);

  // Convert a project image (data URL) to a real File so it can ride the
  // multipart upload. Cover image alt is used as the filename hint.
  const imgToFile = async (img, fallbackName) => {
    const blob = await fetch(img.dataUrl).then(r => r.blob());
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const name = `${slugify(img.alt || fallbackName)}.${ext}`;
    return new File([blob], name, { type: blob.type || 'image/jpeg' });
  };

  // The whole web-flow publish is ONE multipart POST. Electron does
  // login → S3 upload per file → create draft → set price + visibility,
  // then returns { designUrl, slug, substituted, ... }. Per-file progress
  // isn't streamable through a single fetch, so we just show a generic
  // "publishing…" message; full timing shows up in `wrangler tail`.
  const publish = async (batchRunId = null, requestedVisibility = visibility) => {
    const effectiveVisibility = requestedVisibility || visibility;
    if (simulate) {
      setStatus('publishing'); setErrorMsg(''); setResult(null);
      setProgressMsg('Simulating publish (demo)…');
      await new Promise((r) => setTimeout(r, 900));
      const n = project.files.filter(f => f.isModel && platform.formats.includes(fileExt(f.name))).length
        + orderedPlatformImages(platform, project).length + cultsGalleryVideos(project.media || []).length;
      setResult({ designUrl: 'https://cults3d.com/', slug: 'demo', substituted: [], uploadedFiles: n, visibility: effectiveVisibility, demo: true });
      setStatus('done'); setProgressMsg('');
      reportBatch(batchRunId, 'success', `${effectiveVisibility === 'secret' ? 'Secret, unlisted publish' : 'Public publish'} simulated — nothing uploaded`, {
        publicationState: effectiveVisibility,
        simulated: true,
      });
      return;
    }
    if (!creds) {
      reportBatch(batchRunId, 'error', 'No active Cults3D account');
      return;
    }
    setStatus('publishing');
    setErrorMsg('');
    setResult(null);
    try {
      // 1. Pick files from project state.
      const orderedImages = orderedPlatformImages(platform, project);
      const coverImg = orderedImages[0];
      const galleryImgs = orderedImages.slice(1);
      const galleryVideos = cultsGalleryVideos(project.media || []);
      const modelFiles = withoutExcluded(project.files.filter(f =>
        f.isModel && f.blob && platform.formats.includes(fileExt(f.name))), project.platforms?.cults);
      const preflight = platformPreflight(platform, project);
      if (preflight.errors.length) throw new Error(preflight.errors.join(' '));
      if (!coverImg) throw new Error('Pick a cover image in step 03 before publishing.');
      if (!modelFiles.length) throw new Error('Add at least one model file in step 01 before publishing.');

      setProgressMsg('Packing files…');

      // 2. Build the multipart body. Field naming matches the Worker's
      //    /api/v1/cults3d/web/publish route — `model` for each STL/3MF,
      //    `illustration` for cover + gallery (cover is first).
      const fd = new FormData();
      fd.append('name', project.title || 'ModelPrep web-flow publish');
      fd.append('description', project.description || 'Sent from ModelPrep.');
      fd.append('category', project.category || '');
      fd.append('license', project.license || '');
      fd.append('free', String(project.platforms?.cults?.free ?? true));
      fd.append('price', String(project.platforms?.cults?.price ?? 0));
      fd.append('visibility', effectiveVisibility);
      fd.append('details', project.platforms?.cults?.details || '');
      fd.append('metaTags', JSON.stringify(project.platforms?.cults?.metaTags || []));
      fd.append('madeWithAi', String(!!project.platforms?.cults?.madeWithAi));
      fd.append('showComments', String(project.platforms?.cults?.showComments !== false));
      // Tags — Worker joins these into space-separated `flat_keywords`.
      fd.append('tags', JSON.stringify(project.tags ?? []));

      // Cover image MUST be the first illustration so Cults uses it as the
      // listing's primary; gallery follows.
      const coverFile = await imgToFile(coverImg, 'cover');
      fd.append('illustration', coverFile, coverFile.name);
      for (let i = 0; i < galleryImgs.length; i++) {
        const f = await imgToFile(galleryImgs[i], `image-${i + 2}`);
        fd.append('illustration', f, f.name);
      }
      for (const video of galleryVideos) {
        fd.append('illustration', video.blob, video.name);
      }
      for (let i = 0; i < modelFiles.length; i++) {
        fd.append('model', modelFiles[i].blob, modelFiles[i].name);
      }

      setProgressMsg('Uploading + publishing to Cults3D…');

      // 3. Desktop sends this Worker-shaped request to Electron main, which
      // talks directly to Cults/S3 through the account's Chromium session.
      const res = await cultsFetch(`${WORKER_URL}/api/v1/cults3d/web/publish`, {
        method: 'POST',
        body: fd,
      }, creds);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      }
      if (!data.designUrl || !data.slug) {
        throw new Error('Publish completed but response was missing designUrl / slug — check Worker logs.');
      }
      const receipt = {
        designUrl: data.designUrl,
        slug: data.slug,
        substituted: data.substituted || [],
        uploadedFiles: modelFiles.length + galleryImgs.length + galleryVideos.length + 1,
        visibility: effectiveVisibility, // remember what we published with
        readback: data.readback || null,
        readbackIssues: data.readbackIssues || [],
      };
      setResult(receipt);
      if (receipt.readbackIssues.length) {
        const message = `Cults3D created and retained the listing, but persisted readback did not certify it: ${receipt.readbackIssues.join(' ')}`;
        setErrorMsg(message);
        setStatus('error');
        reportBatch(batchRunId, 'error', message, {
          publicationState: effectiveVisibility,
          url: data.designUrl,
        });
        return;
      }
      setStatus('done');
      reportBatch(batchRunId, 'success', `${effectiveVisibility === 'secret' ? 'Secret, unlisted listing' : 'Public listing'} created and read back`, {
        publicationState: effectiveVisibility,
        url: data.designUrl,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
      setStatus('error');
      reportBatch(batchRunId, 'error', message);
    } finally {
      setProgressMsg('');
    }
  };

  useEffect(() => {
    if (!batchRequest?.runId || handledBatchRun.current === batchRequest.runId) return;
    handledBatchRun.current = batchRequest.runId;
    publish(batchRequest.runId, batchRequest.visibility);
    // The request id is the batch trigger. The publish function reads the latest project/account state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchRequest?.runId]);

  // Deactivate the listing we just published. POST /web/unpublish with the
  // slug returned from publish. Cults's "Deactivate" — not a permanent
  // delete, but it hides the listing from search + profile (logged-in owner
  // can still see it in /en/creations/mine and re-activate).
  const deactivate = async () => {
    if (simulate) { setResult(r => r ? { ...r, deactivated: true } : r); setStatus('done'); return; }
    if (!creds || !result?.slug) return;
    setStatus('deactivating');
    setErrorMsg('');
    try {
      const res = await cultsFetch(`${WORKER_URL}/api/v1/cults3d/web/unpublish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: result.slug }),
      }, creds);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      // Mark the result deactivated so the UI shows it.
      setResult(r => r ? { ...r, deactivated: true } : r);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  };

  // ---- My Listings panel ------------------------------------------------
  // Fetches /api/v1/cults3d/web/my-creations which scrapes /en/creations/mine
  // and returns ALL listings including OFFLINE drafts (which the GraphQL API
  // doesn't expose). Used to drive the per-row deactivate/delete buttons.

  const loadListings = async () => {
    if (simulate) { setListings([]); setListingsError(''); return; }
    if (!creds) return;
    setListingsLoading(true);
    setListingsError('');
    try {
      const res = await cultsFetch(`${WORKER_URL}/api/v1/cults3d/web/my-creations`, {
        method: 'GET',
      }, creds);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      setListings(data.creations || []);
    } catch (err) {
      setListingsError(err instanceof Error ? err.message : String(err));
      setListings([]);
    } finally {
      setListingsLoading(false);
    }
  };

  const toggleListings = () => {
    const next = !listingsOpen;
    setListingsOpen(next);
    // Auto-load on first open (don't re-fetch on close→re-open if we already
    // have data — user can hit the Refresh button if they want fresh).
    if (next && listings === null) loadListings();
  };

  // Per-row action — same shape for deactivate and delete; only the endpoint
  // and the optimistic update differ. On success we refresh the list (cheap)
  // rather than mutating in place, so server is source of truth.
  const rowAction = async (slug, action) => {
    if (!creds) return;
    if (action === 'delete') {
      // Hard delete is irreversible — a single confirm() is appropriate for
      // a personal-tool stage; if this gets shared, swap for an in-UI modal.
      // eslint-disable-next-line no-alert
      if (!confirm(`Permanently delete "${slug}" from Cults?\nThis can't be undone.`)) return;
    }
    setPendingRow({ slug, action });
    setListingsError('');
    try {
      const endpoint = action === 'delete' ? 'delete' : 'unpublish';
      const res = await cultsFetch(`${WORKER_URL}/api/v1/cults3d/web/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      }, creds);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      await loadListings();
    } catch (err) {
      setListingsError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingRow({ slug: null, action: null });
    }
  };

  return (
    <div className="border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="mp-card p-3" style={{ background: 'rgba(255,87,34,0.06)', border: '1px solid rgba(255,87,34,0.45)' }}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="mp-display tracking-wide text-[14px]" style={{ color: '#15171C' }}>CULTS3D PUBLISH</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: simulate ? '#3A86FF' : '#c83f10', color: '#fff' }}>{simulate ? 'Simulation' : 'Real'}</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.66)' }}>{isDesktopCultsSession(realCreds) ? 'direct desktop upload' : 'web upload'}</span>
        </div>

        {status === 'idle' && (
          <>
            <p className="text-[13px] mb-2.5 leading-snug flex items-center gap-1.5" style={{ color: 'rgba(21,23,28,0.7)' }}>
              <StatusDot status="unknown" /> {platform.name} — not connected. Sign in to publish for real (tags, secret listings, deactivate).
            </p>
            <button onClick={openConnections} className="mp-btn text-xs py-2 px-3"><Globe size={13} /> Connect {platform.name}</button>
          </>
        )}

        {status === 'connected' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-2.5 flex-wrap" style={{ color: '#3a8d68' }}>
              <StatusDot status={active?.status || 'connected'} /> Publishing as
              {cultsAccounts.length > 1 ? (
                <select value={active?.id} onChange={(e) => acc.setActive('cults', e.target.value)} className="mp-card text-[12px] p-1 max-w-[180px]">
                  {cultsAccounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              ) : <span className="mp-mono">{simulate ? 'Demo account (simulation only)' : realActive?.label}</span>}
              <button onClick={openConnections} className="mp-mono text-[11px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition ml-1" style={{ color: 'rgba(21,23,28,0.66)' }}>manage</button>
              {!simulate && <button onClick={disconnect} className="mp-mono text-[11px] uppercase tracking-[0.15em] hover:text-[#c83f10] transition" style={{ color: 'rgba(21,23,28,0.66)' }}>disconnect</button>}
            </div>
            {/* Visibility is set on the Platforms step (project.platforms.cults.visibility). */}
            <div className="flex items-center gap-2 mb-2.5 text-[12px] flex-wrap" style={{ color: 'rgba(21,23,28,0.7)' }}>
              <span className="mp-mono uppercase tracking-[0.15em] text-[11px]">visibility</span>
              <strong>{visibility === 'secret' ? 'Secret' : 'Public'}</strong>
              <span className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>· change in the Platforms step</span>
            </div>
            <p className="text-[12px] mb-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.66)' }}>
              {simulate
                ? <>Demo simulation only—nothing will be sent to Cults3D. Connect a real account in Settings to test the live upload.</>
                : <>⚠️ This publishes a <strong>real listing</strong> on cults3d.com under <span className="mp-mono">{realActive?.label}</span>. Files upload directly to Cults's S3. {visibility === 'secret' ? 'Secret listings are reachable only via the URL we return—you can flip to public from Cults later.' : 'Public listings appear on your profile + search immediately.'}</>}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => publish()} className="mp-btn text-xs py-2 px-3">
                <Send size={13} /> {simulate ? `Simulate ${platform.name} publish` : `Publish to ${platform.name} (LIVE)`}
              </button>
              <button onClick={toggleListings} className="mp-mono text-[12px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition" style={{ color: 'rgba(21,23,28,0.7)' }}>
                {listingsOpen ? '▾ Hide my listings' : '▸ My listings on Cults'}
              </button>
            </div>

            {/* My Listings panel — collapsed by default; loads on first open.
                Shows ALL listings on the user's Cults account (public, secret,
                offline) with per-row Open / Deactivate / Delete actions hitting
                the /web/* endpoints we built. Useful for cleaning up test
                listings without bouncing to cults3d.com. */}
            {listingsOpen && (
              <div className="mt-3 mp-card p-2" style={{ background: 'rgba(21,23,28,0.03)', border: '1px solid rgba(21,23,28,0.08)' }}>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <span className="mp-mono uppercase tracking-[0.15em] text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
                    My listings on cults3d.com{listings !== null && !listingsLoading ? ` · ${listings.length}` : ''}
                  </span>
                  <button onClick={loadListings} disabled={listingsLoading} className="mp-mono text-[11px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition disabled:opacity-40" style={{ color: 'rgba(21,23,28,0.66)' }}>
                    {listingsLoading ? '… refreshing' : '↻ refresh'}
                  </button>
                </div>

                {listingsError && (
                  <div className="text-[12px] p-2 mb-2 break-all" style={{ background: 'rgba(200,63,16,0.06)', border: '1px solid rgba(200,63,16,0.3)', color: 'rgba(21,23,28,0.8)' }}>
                    {listingsError}
                  </div>
                )}

                {listingsLoading && listings === null && (
                  <div className="flex items-center gap-2 text-xs py-2" style={{ color: 'rgba(21,23,28,0.66)' }}>
                    <Loader size={13} className="mp-spin" /> Loading your listings…
                  </div>
                )}

                {listings !== null && listings.length === 0 && !listingsLoading && (
                  <p className="text-[12px] py-1" style={{ color: 'rgba(21,23,28,0.66)' }}>No listings yet — publish one above and they'll appear here.</p>
                )}

                {listings !== null && listings.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {listings.map(l => {
                      const isPending = pendingRow.slug === l.slug;
                      const badgeColor = l.status === 'public' ? '#3a8d68' : l.status === 'secret' ? '#7c3aed' : 'rgba(21,23,28,0.5)';
                      return (
                        <div key={l.slug} className="flex items-center gap-2 p-1.5" style={{ background: '#fff', border: '1px solid rgba(21,23,28,0.06)' }}>
                          {l.thumbnailUrl && (
                            <img src={l.thumbnailUrl} alt="" width={32} height={32} loading="lazy" style={{ objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] truncate" style={{ color: '#15171C' }} title={l.title}>{l.title}</div>
                            <div className="flex items-center gap-1.5 text-[10px] mp-mono uppercase tracking-[0.1em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
                              <span style={{ color: badgeColor }}>{l.status}</span>
                              {l.priceLabel && <span>· {l.priceLabel}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a href={l.editUrl} target="_blank" rel="noopener noreferrer" className="mp-mono text-[10px] uppercase tracking-[0.1em] hover:text-[#FF5722] transition px-1" style={{ color: 'rgba(21,23,28,0.66)' }} title="Open on Cults">
                              open
                            </a>
                            {l.status !== 'offline' && (
                              <button onClick={() => rowAction(l.slug, 'deactivate')} disabled={isPending} className="mp-mono text-[10px] uppercase tracking-[0.1em] hover:text-[#FF5722] transition px-1 disabled:opacity-40" style={{ color: 'rgba(21,23,28,0.66)' }} title="Hide from search + profile (reversible)">
                                {isPending && pendingRow.action === 'deactivate' ? '…' : 'deactivate'}
                              </button>
                            )}
                            <button onClick={() => rowAction(l.slug, 'delete')} disabled={isPending} className="mp-mono text-[10px] uppercase tracking-[0.1em] hover:text-[#c83f10] transition px-1 disabled:opacity-40" style={{ color: 'rgba(200,63,16,0.7)' }} title="Permanently remove from Cults (irreversible)">
                              {isPending && pendingRow.action === 'delete' ? '…' : 'delete'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-[10px] mt-2 leading-snug" style={{ color: 'rgba(21,23,28,0.66)' }}>
                  <strong>deactivate</strong> hides but keeps the listing (re-activate from Cults). <strong>delete</strong> permanently removes — no undo.
                </p>
              </div>
            )}
          </>
        )}

        {status === 'publishing' && (
          <div className="flex items-center gap-2 text-xs py-1.5" style={{ color: 'rgba(21,23,28,0.7)' }}>
            <Loader size={14} className="mp-spin" /> {progressMsg || `Publishing to ${platform.name}…`}
          </div>
        )}

        {status === 'deactivating' && (
          <div className="flex items-center gap-2 text-xs py-1.5" style={{ color: 'rgba(21,23,28,0.7)' }}>
            <Loader size={14} className="mp-spin" /> Deactivating listing…
          </div>
        )}

        {status === 'done' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-1.5 flex-wrap" style={{ color: result?.deactivated ? 'rgba(21,23,28,0.55)' : '#3a8d68' }}>
              <Check size={14} />
              {result?.deactivated
                ? <>Deactivated. The listing is hidden from your profile + search; re-activate from <a href="https://cults3d.com/en/creations/mine" target="_blank" rel="noopener noreferrer" style={{ color: '#FF5722', textDecoration: 'underline' }}>cults3d.com/en/creations/mine</a></>
                : <>{result?.demo ? 'Simulated publish (demo) to ' : 'Published to '}{platform.name} ({result?.visibility === 'secret' ? 'secret' : 'public'}){result?.uploadedFiles ? <span style={{ color: 'rgba(21,23,28,0.66)' }}> · {result.uploadedFiles} file{result.uploadedFiles === 1 ? '' : 's'}</span> : null}</>}
            </div>
            {result?.demo && <div className="mp-mono text-[11px] mb-1.5" style={{ color: '#3A86FF' }}>Demo mode — nothing was uploaded. Exit demo and connect a real account to publish for real.</div>}
            {result?.designUrl && (
              <a href={result.designUrl} target="_blank" rel="noopener noreferrer" className="mp-card mp-mono text-[13px] p-2 mb-2 break-all block hover:text-[#FF5722] transition" style={{ background: 'rgba(21,23,28,0.04)', color: 'rgba(21,23,28,0.85)' }}>
                {result.designUrl}
              </a>
            )}
            {result?.substituted?.length > 0 && (
              <p className="text-[11px] mb-2 leading-snug" style={{ color: 'rgba(21,23,28,0.66)' }}>
                {/* Web flow surfaces per-field substitutions for license / category. Tags + media are handled inline (always work). */}
                {result.substituted.includes('license') && 'License was swapped — Cults requires CC licenses on free listings and cults_cu on paid listings; the closest valid one was used. '}
                {result.substituted.includes('category') && 'Category mapped to Various — your category wasn\'t in Cults\'s top-level list. Pick a sub-category inside Cults after publish if needed. '}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => { setStatus('connected'); setResult(null); }} className="mp-mono text-[12px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
                <ArrowRight size={11} /> Publish another
              </button>
              {result?.slug && !result?.deactivated && (
                <>
                  <span style={{ color: 'rgba(21,23,28,0.25)' }}>·</span>
                  <button onClick={deactivate} className="mp-mono text-[12px] uppercase tracking-[0.15em] hover:text-[#c83f10] transition" style={{ color: 'rgba(21,23,28,0.66)' }}>
                    Deactivate this listing
                  </button>
                </>
              )}
              <span style={{ color: 'rgba(21,23,28,0.25)' }}>·</span>
              <button onClick={disconnect} className="mp-mono text-[12px] uppercase tracking-[0.15em] hover:text-[#c83f10] transition" style={{ color: 'rgba(21,23,28,0.66)' }}>disconnect</button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-1.5" style={{ color: '#c83f10' }}>
              <X size={14} /> Publish failed
            </div>
            <div className="mp-card text-[12px] p-2 mb-2 break-all" style={{ background: 'rgba(200,63,16,0.06)', border: '1px solid rgba(200,63,16,0.3)', color: 'rgba(21,23,28,0.8)' }}>
              {errorMsg || 'Unknown error.'}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => publish()} className="mp-btn text-xs py-2 px-3"><ArrowRight size={13} /> Retry</button>
              <button onClick={disconnect} className="mp-mono text-[12px] uppercase tracking-[0.15em] hover:text-[#c83f10] transition" style={{ color: 'rgba(21,23,28,0.66)' }}>disconnect</button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// =====================================================================
// REAL Printables upload flow — first-party GraphQL contract, with direct
// presigned storage uploads. The desktop main process owns the session.
// Saving a draft is unpublished; publishing is always an explicit second
// button and is not inferred from a successful model update.
// =====================================================================
const PRINTABLES_LICENSE_MAP = {
  cc0: '7',
  ccby: '1',
  ccbysa: '2',
  ccbynd: '8',
  ccbync: '3',
  ccbyncsa: '4',
  standard: '13',
};

function PrintablesUploadFlow({ platform, project, batchRequest, onBatchResult }) {
  const accounts = useAccounts();
  const openConnections = useOpenConnections();
  const active = accounts.getActive('printables');
  const secret = active?.secret || '';
  const options = project.platforms?.printables || {};
  const simulate = !!project.__demo;
  const [status, setStatus] = useState(active || simulate ? 'connected' : 'idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [modelId, setModelId] = useState('');
  const [modelsOpen, setModelsOpen] = useState(false);
  const [models, setModels] = useState(null);
  const [modelsError, setModelsError] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const handledBatchRun = useRef(null);
  const reportBatch = (batchRunId, state, detail, metadata = {}) => {
    if (!batchRunId) return;
    onBatchResult?.({ runId: batchRunId, platformId: 'printables', state, detail, ...metadata });
  };

  useEffect(() => {
    setStatus((current) => {
      if ((active || simulate) && current === 'idle') return 'connected';
      if (!active && !simulate && current === 'connected') return 'idle';
      return current;
    });
  }, [active, simulate]);

  const workerRequest = async (route, body, method = 'POST') => {
    const response = await printablesFetch(
      `${WORKER_URL}/api/v1/printables/web/${route}`,
      {
        method,
        headers: body == null ? {} : { 'Content-Type': 'application/json' },
        body: body == null ? undefined : JSON.stringify(body),
      },
      secret,
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(printablesResponseError(data, response.status, `Printables ${route} failed`));
    }
    return data;
  };

  const imageFile = async (image, index) => {
    const blob = await fetch(image.dataUrl).then((response) => response.blob());
    const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `${String(index + 1).padStart(2, '0')}-${slugify(image.alt || 'model-image')}.${extension}`, {
      type: blob.type || 'image/jpeg',
    });
  };

  const decimalOverride = (value, fallback = null) => value === '' || value == null
    ? fallback
    : String(value);
  const cleanGcode = (file, source) => ({
    ...applyPrintablesFileSettings(file, source),
    weight: source?.printables?.weight === '' || source?.printables?.weight == null
      ? file.weight ?? null
      : Number(source.printables.weight),
    material: file.material?.id ?? file.material ?? null,
    nozzleDiameter: decimalOverride(source?.printables?.nozzleDiameter, file.nozzleDiameter ?? null),
    layerHeight: decimalOverride(source?.printables?.layerHeight, file.layerHeight ?? null),
    printDuration: decimalOverride(source?.printables?.printDuration, file.printDuration ?? null),
    excludeFromTotalSum: source?.printables?.excludeFromTotalSum ?? !!file.excludeFromTotalSum,
  });

  const validate = () => {
    const cover = project.images.find((image) => image.id === project.coverImageId) || project.images[0];
    const modelFiles = withoutExcluded(project.files.filter((file) => file.blob && platform.formats.includes(fileExt(file.name)) && !file.isImage), project.platforms?.printables);
    return validatePrintablesModel({
      title: project.title,
      summary: options.summary,
      description: mdToPlain(project.description),
      images: cover ? project.images : [],
      files: modelFiles,
      options,
    });
  };

  const submit = async (publish, batchRunId = null) => {
    const issues = validate();
    if (issues.length) {
      const message = issues.join(' ');
      setError(message);
      setStatus('error');
      reportBatch(batchRunId, 'error', message);
      return;
    }
    if (simulate) {
      setStatus('uploading');
      setProgress(publish ? 'Simulating Printables publish…' : 'Simulating Printables draft…');
      await new Promise((resolve) => setTimeout(resolve, 700));
      setResult({ id: 'demo', state: publish ? 'simulated-public' : 'simulated-draft', demo: true });
      setStatus('done');
      setProgress('');
      reportBatch(batchRunId, 'success', publish
        ? 'Public publish simulated — nothing uploaded'
        : 'Draft save simulated — nothing uploaded', {
        publicationState: publish ? 'public' : 'draft',
        simulated: true,
      });
      return;
    }
    if (!secret) {
      reportBatch(batchRunId, 'error', 'No active Printables account');
      return;
    }
    setStatus('uploading');
    setError('');
    setResult(null);
    try {
      const orderedImages = orderedPlatformImages(platform, project);
      const cover = orderedImages[0];
      const modelFiles = withoutExcluded(project.files.filter((file) =>
        file.blob && platform.formats.includes(fileExt(file.name)) && !file.isImage && !isHeicFile(file.name)), project.platforms?.printables);
      const uploadRecords = [];

      for (let index = 0; index < orderedImages.length; index += 1) {
        setProgress(`Uploading image ${index + 1} of ${orderedImages.length}…`);
        const source = orderedImages[index];
        const file = await imageFile(source, index);
        const uploaded = await uploadPrintablesFile({
          workerUrl: WORKER_URL,
          secret,
          file,
          imageWidth: source.naturalW,
          imageHeight: source.naturalH,
        });
        uploadRecords.push({ id: uploaded.id, kind: 'image', source, order: index });
      }
      for (let index = 0; index < modelFiles.length; index += 1) {
        setProgress(`Uploading model file ${index + 1} of ${modelFiles.length}…`);
        const source = modelFiles[index];
        const file = source.blob instanceof File && source.blob.name === source.name
          ? source.blob
          : new File([source.blob], source.name, { type: source.type || 'application/octet-stream' });
        const uploaded = await uploadPrintablesFile({
          workerUrl: WORKER_URL,
          secret,
          file,
          folder: source.printables?.folder || '',
          unzip: fileExt(source.name) === 'zip' ? options.zipMode !== 'archive' : true,
        });
        uploadRecords.push({ id: uploaded.id, kind: 'file', source, order: index });
      }

      setProgress('Printables is inspecting the uploaded files…');
      const processed = await waitForPrintablesUploads({
        workerUrl: WORKER_URL,
        secret,
        ids: uploadRecords.map((record) => record.id),
      });
      const recordById = new Map(uploadRecords.map((record) => [String(record.id), record]));
      const images = processed
        .flatMap((upload) => (upload.images || []).map((image) => ({
          ...image,
          order: recordById.get(String(upload.id))?.order ?? image.order ?? 0,
        })))
        .sort((left, right) => left.order - right.order);
      const collectFiles = (key) => processed
        .flatMap((upload) => {
          const record = recordById.get(String(upload.id));
          return (upload[key] || []).map((file, childIndex) => ({
            file,
            source: record?.source,
            order: (record?.order ?? 0) * 1000 + childIndex,
          }));
        })
        .sort((left, right) => left.order - right.order);
      const stls = collectFiles('stls');
      const slas = collectFiles('slas');
      const gcodes = collectFiles('gcodes');
      const otherFiles = collectFiles('otherFiles');
      if (!images.length) throw new Error('Printables finished processing but returned no gallery images.');
      if (![stls, slas, gcodes, otherFiles].some((files) => files.length)) {
        throw new Error('Printables finished processing but returned no model files.');
      }

      setProgress(publish ? 'Saving complete model metadata…' : 'Saving unpublished draft…');
      const summary = buildPrintablesSummary(options.summary, mdToPlain(project.description));
      const normalizedTags = normalizePrintablesTags(project.tags);
      let remixParents = [];
      if (options.authorship === 'remix' || options.authorship === 'reupload') {
        const parsed = parsePrintablesRemixSource(options.remixParents?.[0]);
        setProgress('Validating the original model/source…');
        const resolved = await workerRequest('remix/resolve', { value: options.remixParents[0] });
        if (parsed.type === 'printables' && String(resolved.model?.id || '') !== parsed.id) {
          throw new Error('Printables could not resolve that source model. Check its URL/ID and license.');
        }
        if (parsed.type === 'external' && !resolved.remixUrlInfo?.url) {
          throw new Error('Printables could not inspect that external source URL.');
        }
        const restriction = resolved.model?.license?.disallowRemixing || resolved.remixUrlInfo?.license?.disallowRemixing;
        if (restriction && restriction !== 'allow') {
          throw new Error(`The source license does not allow this ${options.authorship}.`);
        }
        remixParents = [parsed.id];
        setProgress(publish ? 'Saving complete model metadata…' : 'Saving unpublished draft…');
      }
      const modelPayload = {
        ...(modelId ? { id: modelId } : {}),
        name: project.title.trim().slice(0, 255),
        summary,
        description: mdToHtml(project.description),
        category: String(options.categoryId),
        license: String(options.licenseId || PRINTABLES_LICENSE_MAP[project.license] || '13'),
        tags: normalizedTags,
        // The live website always creates a real draft first. A brand-new
        // model cannot enter public mode in the same modelUpdate mutation.
        draft: true,
        mainImage: String(images[0].id),
        authorship: options.authorship || 'author',
        remixParents,
        remixDescription: options.authorship === 'remix' ? options.remixDescription : null,
        nsfw: !!options.nsfw,
        aiGenerated: !!options.aiGenerated,
        politicalContent: !!options.politicalContent,
        club: !!options.club,
        price: options.store ? Number(options.price) : 0,
        excludeCommercialUsage: !!options.club && !!options.excludeCommercialUsage,
        images: images.map((image) => ({ id: String(image.id) })),
        stls: stls.map((entry) => applyPrintablesFileSettings(entry.file, entry.source)),
        slas: slas.map((entry) => applyPrintablesFileSettings(entry.file, entry.source)),
        gcodes: gcodes.map((entry) => cleanGcode(entry.file, entry.source)),
        otherFiles: otherFiles.map((entry) => applyPrintablesFileSettings(entry.file, entry.source)),
      };
      const update = await workerRequest('model', modelPayload);
      const id = String(update.output.id);
      setModelId(id);
      setProgress('Verifying saved metadata and files…');
      const readback = await workerRequest(`status?id=${encodeURIComponent(id)}`, null, 'GET');
      const mismatches = printablesReadbackMismatches(modelPayload, readback.model);
      if (mismatches.length) {
        throw new Error(`Printables saved the model, but verification found: ${mismatches.join('; ')}`);
      }
      if (!publish) {
        setResult({
          id,
          state: 'draft',
          url: `https://www.printables.com/model/${id}/edit`,
          verified: true,
        });
        setStatus('done');
        reportBatch(batchRunId, 'success', 'Unpublished draft saved and verified', {
          publicationState: 'draft',
          url: `https://www.printables.com/model/${id}/edit`,
        });
        return;
      }

      const approvalRequired = !!readback.model?.publishApprovalRequired;
      setProgress(approvalRequired
        ? 'Requesting Printables publication approval…'
        : 'Publishing the verified Printables draft…');
      const publication = await publishVerifiedPrintablesModel({
        request: workerRequest,
        id,
        modelPayload,
        readbackModel: readback.model,
      });
      setProgress('Waiting for Printables to confirm publication…');
      const statusData = await waitForPrintablesPublication({
        request: workerRequest,
        id,
        strategy: publication.strategy,
      });
      const slug = statusData.model?.slug || update.output.slug || '';
      const publishedState = statusData.state;
      setResult({
        id,
        state: publishedState,
        url: publishedState === 'live'
          ? `https://www.printables.com/model/${id}${slug ? `-${slug}` : ''}`
          : `https://www.printables.com/model/${id}/edit`,
      });
      setStatus('done');
      reportBatch(batchRunId, 'success', publishedState === 'live' ? 'Confirmed live' : 'Publication approval pending', {
        publicationState: publishedState,
        url: publishedState === 'live'
          ? `https://www.printables.com/model/${id}${slug ? `-${slug}` : ''}`
          : `https://www.printables.com/model/${id}/edit`,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      setStatus('error');
      reportBatch(batchRunId, 'error', message);
    } finally {
      setProgress('');
    }
  };

  useEffect(() => {
    if (!batchRequest?.runId || handledBatchRun.current === batchRequest.runId) return;
    handledBatchRun.current = batchRequest.runId;
    submit(batchRequest.action !== 'draft', batchRequest.runId);
    // The request id is the batch trigger. The submit function reads the latest project/account state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchRequest?.runId]);

  const deleteResult = async () => {
    if (!result?.id || result.demo) {
      setResult(null);
      setStatus('connected');
      return;
    }
    // eslint-disable-next-line no-alert
    if (!confirm(`Permanently delete Printables model ${result.id}? This cannot be undone.`)) return;
    setStatus('uploading');
    setProgress('Deleting Printables model…');
    try {
      await workerRequest('delete', { id: result.id });
      setResult(null);
      setModelId('');
      setStatus('connected');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus('error');
    } finally { setProgress(''); }
  };

  const loadModels = async () => {
    if (simulate) {
      setModels({ drafts: [], published: [] });
      return;
    }
    setModelsLoading(true);
    setModelsError('');
    try {
      const data = await workerRequest('my-models', null, 'GET');
      setModels({ drafts: data.drafts || [], published: data.published || [] });
    } catch (cause) {
      setModelsError(cause instanceof Error ? cause.message : String(cause));
      setModels({ drafts: [], published: [] });
    } finally { setModelsLoading(false); }
  };
  const toggleModels = () => {
    const next = !modelsOpen;
    setModelsOpen(next);
    if (next && models === null) loadModels();
  };
  const deleteListedModel = async (item) => {
    // eslint-disable-next-line no-alert
    if (!confirm(`Permanently delete "${item.name || item.id}" from Printables? This cannot be undone.`)) return;
    setModelsError('');
    try {
      await workerRequest('delete', { id: String(item.id) });
      await loadModels();
    } catch (cause) {
      setModelsError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="mp-card p-3" style={{ background: 'rgba(250,104,49,0.06)', border: '1px solid rgba(250,104,49,0.45)' }}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="mp-display tracking-wide text-[14px]">PRINTABLES UPLOAD</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: simulate ? '#3A86FF' : '#FA6831', color: '#fff' }}>{simulate ? 'Simulation' : 'Real'}</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.66)' }}>desktop session</span>
        </div>
        {status === 'idle' && (
          <>
            <p className="text-[13px] mb-2.5" style={{ color: 'rgba(21,23,28,0.65)' }}>Connect Printables through its real Prusa Account window to upload.</p>
            <button onClick={openConnections} className="mp-btn text-xs py-2 px-3"><Globe size={13} /> Connect Printables</button>
          </>
        )}
        {status === 'connected' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-2.5" style={{ color: '#3a8d68' }}>
              <StatusDot status={active?.status || 'connected'} /> {simulate ? 'Demo account (simulation only)' : <>Connected as <span className="mp-mono">{active?.label}</span></>}
              <button onClick={openConnections} className="mp-mono text-[11px] uppercase tracking-[0.15em] ml-1" style={{ color: 'rgba(21,23,28,0.66)' }}>manage</button>
            </div>
            <p className="text-[12px] mb-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.62)' }}>
              {simulate
                ? <>Demo simulation only—neither action sends anything to Printables.</>
                : <><strong>Save draft</strong> uploads an unpublished model only you can edit. <strong>Publish public</strong> submits a real public listing (or an approval request when Printables requires review).</>}
            </p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => submit(false)} className="mp-btn mp-btn-ghost text-xs py-2 px-3"><Save size={13} /> {simulate ? 'Simulate draft save' : 'Save unpublished draft'}</button>
              <button onClick={() => submit(true)} className="mp-btn text-xs py-2 px-3"><Send size={13} /> {simulate ? 'Simulate public publish' : 'Publish public (LIVE)'}</button>
              <button onClick={toggleModels} className="mp-mono text-[11px] uppercase tracking-[0.15em] px-2">
                {modelsOpen ? 'Hide my models' : 'My Printables models'}
              </button>
            </div>
            {modelsOpen && (
              <div className="mt-3 mp-card p-2" style={{ background: 'rgba(21,23,28,0.03)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="mp-mono text-[11px] uppercase tracking-[0.15em]">
                    Drafts and published models
                  </span>
                  <button onClick={loadModels} disabled={modelsLoading} className="mp-mono text-[10px] uppercase tracking-[0.12em] disabled:opacity-40">
                    {modelsLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
                {modelsError && <div className="text-[11px] mb-2" style={{ color: '#b91c1c' }}>{modelsError}</div>}
                {modelsLoading && models === null && <div className="text-[11px]"><Loader size={11} className="mp-spin inline mr-1" />Loading…</div>}
                {models && models.drafts.length === 0 && models.published.length === 0 && !modelsLoading && (
                  <div className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>No models found.</div>
                )}
                {models && [...models.drafts.map((item) => ({ ...item, state: 'draft' })), ...models.published.map((item) => ({ ...item, state: 'live' }))].map((item) => {
                  const href = item.state === 'live'
                    ? `https://www.printables.com/model/${item.id}${item.slug ? `-${item.slug}` : ''}`
                    : `https://www.printables.com/model/${item.id}/edit`;
                  const imageSrc = item.image?.filePath
                    ? (item.image.filePath.startsWith('http') ? item.image.filePath : `https://media.printables.com/${item.image.filePath.replace(/^\/+/, '')}`)
                    : '';
                  return (
                    <div key={`${item.state}-${item.id}`} className="flex items-center gap-2 p-1.5 mb-1" style={{ background: '#fff' }}>
                      {imageSrc && <img src={imageSrc} alt="" width={34} height={34} style={{ objectFit: 'cover' }} />}
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] truncate">{item.name || `Model ${item.id}`}</div>
                        <div className="mp-mono text-[10px] uppercase" style={{ color: item.state === 'live' ? '#3a8d68' : '#d97706' }}>{item.state}</div>
                      </div>
                      <a href={href} target="_blank" rel="noopener noreferrer" className="mp-mono text-[10px] uppercase">Open</a>
                      <button onClick={() => deleteListedModel(item)} className="mp-mono text-[10px] uppercase" style={{ color: '#b91c1c' }}>Delete</button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {status === 'uploading' && (
          <div className="flex items-center gap-2 text-xs py-1.5"><Loader size={14} className="mp-spin" /> {progress || 'Working…'}</div>
        )}
        {status === 'done' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-2" style={{ color: result?.demo ? '#3A86FF' : '#3a8d68' }}>
              <Check size={14} />
              {result?.demo
                ? `Simulation complete — nothing was uploaded (${result.state}).`
                : result?.state === 'live'
                  ? 'Confirmed live on Printables.'
                  : result?.state === 'pending'
                    ? 'Publication requested; Printables approval is pending.'
                    : 'Unpublished Printables draft saved.'}
            </div>
            {!result?.demo && result?.url && (
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="mp-card mp-mono text-[13px] p-2 mb-2 break-all block hover:text-[#FA6831]">{result.url}</a>
            )}
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => { setResult(null); setStatus('connected'); }} className="mp-mono text-[11px] uppercase tracking-[0.15em]">Upload another</button>
              <button onClick={deleteResult} className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: '#b91c1c' }}>{result?.demo ? 'Clear simulated result' : 'Delete this model'}</button>
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-[12px] p-2 mb-2 break-all" style={{ background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.3)', color: '#991b1b' }}>{error}</div>
            <button onClick={() => setStatus(active || simulate ? 'connected' : 'idle')} className="mp-btn mp-btn-ghost text-xs py-1.5 px-3"><ArrowRight size={12} /> Back</button>
          </>
        )}
      </div>
    </div>
  );
}

function NexprintUploadFlow({ platform, project, batchRequest, onBatchResult }) {
  const accounts = useAccounts();
  const openConnections = useOpenConnections();
  const active = accounts.getActive('nexprint');
  const secret = active?.secret || '';
  const options = project.platforms?.nexprint || {};
  // Demo projects are always simulations, even when a real account is connected.
  const simulate = !!project.__demo;
  const [status, setStatus] = useState(active || simulate ? 'connected' : 'idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [models, setModels] = useState(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const handledBatchRun = useRef(null);

  const reportBatch = (batchRunId, state, detail, metadata = {}) => {
    if (!batchRunId) return;
    onBatchResult?.({ runId: batchRunId, platformId: 'nexprint', state, detail, ...metadata });
  };

  useEffect(() => {
    setStatus((current) => {
      if ((active || simulate) && current === 'idle') return 'connected';
      if (!active && !simulate && current === 'connected') return 'idle';
      return current;
    });
  }, [active, simulate]);

  const request = async (route, body, method = body == null ? 'GET' : 'POST') => {
    const response = await nexprintFetch(
      `${WORKER_URL}/api/v1/nexprint/web/${route}`,
      {
        method,
        headers: body == null ? {} : { 'Content-Type': 'application/json' },
        body: body == null ? undefined : JSON.stringify(body),
      },
      secret,
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(nexprintResponseError(data, response.status, `Nexprint ${route} failed`));
    }
    return data;
  };

  const imageFile = async (image, role, index) => {
    const blob = role === 'cover'
      ? await cropImageToBlob(image, platform.covers[0].w, platform.covers[0].h)
      : await fetch(image.dataUrl).then((response) => response.blob());
    const ext = blob.type === 'image/png'
      ? 'png'
      : blob.type === 'image/webp'
        ? 'webp'
        : blob.type === 'image/gif'
          ? 'gif'
          : 'jpg';
    const prefix = role === 'cover' ? 'cover' : `gallery-${String(index + 1).padStart(2, '0')}`;
    return new File([blob], `${prefix}-${slugify(image.alt || project.title || 'model')}.${ext}`, {
      type: blob.type || 'image/jpeg',
    });
  };

  const projectFile = (source) => source.blob instanceof File && source.blob.name === source.name
    ? source.blob
    : new File([source.blob], source.name, { type: source.type || 'application/octet-stream' });

  const submit = async (publish, batchRunId = null) => {
    const preflight = platformPreflight(platform, project);
    if (preflight.errors.length) {
      const message = preflight.errors.join(' ');
      setError(message);
      setStatus('error');
      reportBatch(batchRunId, 'error', message);
      return;
    }
    if (simulate) {
      setStatus('uploading');
      setError('');
      setProgress(publish ? 'Simulating Nexprint publish…' : 'Simulating Nexprint draft save…');
      await new Promise((resolve) => setTimeout(resolve, 700));
      setResult({
        id: 'demo',
        state: publish ? 'simulated-public' : 'simulated-draft',
        demo: true,
        verified: false,
      });
      setStatus('done');
      setProgress('');
      reportBatch(batchRunId, 'success', publish
        ? 'Public Nexprint publish simulated — nothing uploaded'
        : 'Nexprint draft save simulated — nothing uploaded', {
        publicationState: publish ? 'public' : 'draft',
        simulated: true,
      });
      return;
    }
    if (!secret || !isDesktopNexprintSession(secret)) {
      const message = 'Connect Nexprint in ModelPrep Desktop before uploading.';
      setError(message);
      setStatus('error');
      reportBatch(batchRunId, 'error', message);
      return;
    }

    setStatus('uploading');
    setError('');
    setResult(null);
    try {
      const orderedImages = orderedPlatformImages(platform, project);
      const cover = orderedImages[0];
      const gallery = orderedImages.slice(1, 10);
      const modelFiles = withoutExcluded(project.files.filter((file) =>
        file.blob && NEXPRINT_MODEL_FORMATS.includes(fileExt(file.name))), project.platforms?.nexprint);
      const attachments = project.files.filter((file) =>
        file.blob && NEXPRINT_ATTACHMENT_FORMATS.includes(fileExt(file.name)));
      if (!cover) throw new Error('Choose a cover image before sending to Nexprint.');
      if (!modelFiles.length) throw new Error('Add at least one Nexprint-compatible model file.');

      setProgress('Uploading Nexprint cover…');
      const coverRecord = await uploadNexprintFile({
        workerUrl: WORKER_URL,
        secret,
        role: 'cover',
        file: await imageFile(cover, 'cover', 0),
      });

      const photoRecords = [];
      for (let index = 0; index < gallery.length; index += 1) {
        setProgress(`Uploading Nexprint gallery image ${index + 1} of ${gallery.length}…`);
        photoRecords.push(await uploadNexprintFile({
          workerUrl: WORKER_URL,
          secret,
          role: 'photo',
          file: await imageFile(gallery[index], 'photo', index),
        }));
      }

      const modelRecords = [];
      for (let index = 0; index < modelFiles.length; index += 1) {
        setProgress(`Uploading Nexprint model file ${index + 1} of ${modelFiles.length}…`);
        modelRecords.push(await uploadNexprintFile({
          workerUrl: WORKER_URL,
          secret,
          role: 'model',
          file: projectFile(modelFiles[index]),
        }));
      }

      const attachmentRecords = [];
      for (let index = 0; index < attachments.length; index += 1) {
        setProgress(`Uploading Nexprint attachment ${index + 1} of ${attachments.length}…`);
        attachmentRecords.push(await uploadNexprintFile({
          workerUrl: WORKER_URL,
          secret,
          role: 'attachment',
          file: projectFile(attachments[index]),
        }));
      }

      setProgress(publish ? 'Publishing Nexprint listing…' : 'Saving unpublished Nexprint draft…');
      const saved = await request('submit', {
        title: project.title.trim(),
        description: mdToHtml(project.description),
        categoryId: String(options.categoryId),
        licenseType: Number(options.licenseType ?? NEXPRINT_LICENSE_MAP[project.license] ?? 7),
        originalityType: Number(options.originalityType || 1),
        sourceUrl: String(options.sourceUrl || '').trim(),
        sourceModelId: String(options.sourceModelId || '').trim(),
        draftOnly: !publish,
        cover: coverRecord,
        photos: photoRecords,
        models: modelRecords,
        attachments: attachmentRecords,
        tags: project.tags,
        nsfw: !!options.nsfw,
        aiGenerated: !!options.aiGenerated,
        hasBom: !!options.hasBom,
        bom: options.bom || [],
        collectionIds: options.collectionIds || [],
        activityIds: options.activityIds || [],
        worldFirstRelease: !!options.worldFirstRelease,
        firstCommitPublish: true,
      });

      setProgress('Reading the saved Nexprint model back…');
      const readback = await request(`status?id=${encodeURIComponent(saved.id)}`, null, 'GET');
      if (!readback.model || typeof readback.model !== 'object') {
        throw new Error('Nexprint accepted the submit but returned no model during read-back verification.');
      }
      const readbackState = readback.model.status
        ?? readback.model.modelStatus
        ?? readback.model.modelBaseInfo?.status;
      if (!publish && readbackState != null && Number(readbackState) !== 0) {
        throw new Error(`Nexprint read-back reported status ${readbackState} instead of draft.`);
      }
      if (publish && readbackState != null && Number(readbackState) === 0) {
        throw new Error('Nexprint read-back still reports a draft after public publish was requested.');
      }
      const state = publish ? 'public' : 'draft';
      setResult({
        id: String(saved.id),
        state,
        url: saved.url,
        verified: true,
        readbackState,
      });
      setStatus('done');
      reportBatch(batchRunId, 'success', publish
        ? 'Nexprint publish saved and read back'
        : 'Unpublished Nexprint draft saved and read back', {
        publicationState: state,
        url: saved.url,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      setStatus('error');
      reportBatch(batchRunId, 'error', message);
    } finally {
      setProgress('');
    }
  };

  useEffect(() => {
    if (!batchRequest?.runId || handledBatchRun.current === batchRequest.runId) return;
    handledBatchRun.current = batchRequest.runId;
    submit(batchRequest.action === 'publish', batchRequest.runId);
    // The request id is the batch trigger. The submit function reads current project/account state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchRequest?.runId]);

  const loadModels = async () => {
    if (simulate) {
      setModels([]);
      setModelsError('');
      return;
    }
    setModelsLoading(true);
    setModelsError('');
    try {
      const data = await request('my-models?pageNo=1&pageSize=50', null, 'GET');
      setModels(data.models || []);
    } catch (cause) {
      setModelsError(cause instanceof Error ? cause.message : String(cause));
      setModels([]);
    } finally { setModelsLoading(false); }
  };

  const toggleModels = () => {
    const next = !modelsOpen;
    setModelsOpen(next);
    if (next && models === null) loadModels();
  };

  return (
    <div className="border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="mp-card p-3" style={{ background: 'rgba(255,182,39,0.08)', border: '1px solid rgba(255,182,39,0.55)' }}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="mp-display tracking-wide text-[14px]">NEXPRINT UPLOAD</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: simulate ? '#3A86FF' : '#15171C', color: '#fff' }}>{simulate ? 'Simulation' : 'Real'}</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.66)' }}>direct desktop upload</span>
        </div>

        {status === 'idle' && (
          <>
            <p className="text-[13px] mb-2.5" style={{ color: 'rgba(21,23,28,0.65)' }}>
              Connect through Nexprint’s real sign-in window. ModelPrep keeps the bearer session outside page storage.
            </p>
            <button onClick={openConnections} className="mp-btn text-xs py-2 px-3"><Globe size={13} /> Connect Nexprint</button>
          </>
        )}

        {status === 'connected' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-2.5" style={{ color: '#3a8d68' }}>
              <StatusDot status={active?.status || 'connected'} />
              {simulate ? 'Demo account (simulation only)' : <>Connected as <span className="mp-mono">{active?.label}</span></>}
              <button onClick={openConnections} className="mp-mono text-[11px] uppercase tracking-[0.15em] ml-1" style={{ color: 'rgba(21,23,28,0.66)' }}>manage</button>
            </div>
            <p className="text-[12px] mb-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.62)' }}>
              {simulate
                ? 'Demo simulation only—neither action sends files or metadata to Nexprint.'
                : 'Save draft uploads an unpublished editable model. Publish public sends a real public listing; review the Nexprint-specific options above first.'}
            </p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => submit(false)} className="mp-btn mp-btn-ghost text-xs py-2 px-3"><Save size={13} /> {simulate ? 'Simulate draft save' : 'Save unpublished draft'}</button>
              <button onClick={() => submit(true)} className="mp-btn text-xs py-2 px-3"><Send size={13} /> {simulate ? 'Simulate public publish' : 'Publish public (LIVE)'}</button>
              <button onClick={toggleModels} className="mp-mono text-[11px] uppercase tracking-[0.15em] px-2">
                {modelsOpen ? 'Hide my models' : 'My Nexprint models'}
              </button>
            </div>
            {modelsOpen && (
              <div className="mt-3 mp-card p-2" style={{ background: 'rgba(21,23,28,0.03)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="mp-mono text-[11px] uppercase tracking-[0.15em]">Recent models</span>
                  <button onClick={loadModels} disabled={modelsLoading} className="mp-mono text-[10px] uppercase tracking-[0.12em] disabled:opacity-40">
                    {modelsLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
                {modelsError && <div className="text-[11px] mb-2" style={{ color: '#b91c1c' }}>{modelsError}</div>}
                {modelsLoading && models === null && <div className="text-[11px]"><Loader size={11} className="mp-spin inline mr-1" />Loading…</div>}
                {models && models.length === 0 && !modelsLoading && <div className="text-[11px] opacity-55">No models found.</div>}
                {(models || []).map((item) => {
                  const id = String(item.id ?? item.modelId ?? '');
                  const code = item.modelCode ?? item.code ?? id;
                  const draft = Number(item.status ?? item.modelStatus ?? 0) === 0;
                  const href = draft
                    ? `https://www.nexprint.com/en/editUpload/${id}`
                    : `https://www.nexprint.com/en/models/${code}`;
                  return (
                    <div key={id || code} className="flex items-center gap-2 p-1.5 mb-1" style={{ background: '#fff' }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] truncate">{item.modelName || item.name || `Model ${id}`}</div>
                        <div className="mp-mono text-[10px] uppercase" style={{ color: draft ? '#d97706' : '#3a8d68' }}>{draft ? 'draft' : 'published'}</div>
                      </div>
                      <a href={href} target="_blank" rel="noopener noreferrer" className="mp-mono text-[10px] uppercase">Open</a>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {status === 'uploading' && (
          <div className="flex items-center gap-2 text-xs py-1.5"><Loader size={14} className="mp-spin" /> {progress || 'Working…'}</div>
        )}

        {status === 'done' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-2" style={{ color: result?.demo ? '#3A86FF' : '#3a8d68' }}>
              <Check size={14} />
              {result?.demo
                ? `Simulation complete — nothing was uploaded (${result.state}).`
                : result?.state === 'public'
                  ? 'Nexprint accepted the public listing and the saved model was read back.'
                  : 'Unpublished Nexprint draft saved and read back.'}
            </div>
            {!result?.demo && result?.url && (
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="mp-card mp-mono text-[13px] p-2 mb-2 break-all block hover:text-[#FF9500]">{result.url}</a>
            )}
            <button onClick={() => { setResult(null); setStatus('connected'); }} className="mp-mono text-[11px] uppercase tracking-[0.15em]">
              {result?.demo ? 'Clear simulated result' : 'Upload another'}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-[12px] p-2 mb-2 break-all" style={{ background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.3)', color: '#991b1b' }}>{error}</div>
            <button onClick={() => setStatus(active || simulate ? 'connected' : 'idle')} className="mp-btn mp-btn-ghost text-xs py-1.5 px-3"><ArrowRight size={12} /> Back</button>
          </>
        )}
      </div>
    </div>
  );
}

function CrealityUploadFlow({ platform, project, batchRequest, onBatchResult }) {
  const accounts = useAccounts();
  const openConnections = useOpenConnections();
  const active = accounts.getActive('creality');
  const secret = active?.secret || '';
  const options = project.platforms?.creality || {};
  const simulate = !!project.__demo;
  const [status, setStatus] = useState(active || simulate ? 'connected' : 'idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [drafts, setDrafts] = useState(null);
  const [draftsError, setDraftsError] = useState('');
  const handledBatchRun = useRef(null);

  const reportBatch = (batchRunId, state, detail, metadata = {}) => {
    if (!batchRunId) return;
    onBatchResult?.({ runId: batchRunId, platformId: 'creality', state, detail, ...metadata });
  };

  useEffect(() => {
    setStatus((current) => {
      if ((active || simulate) && current === 'idle') return 'connected';
      if (!active && !simulate && current === 'connected') return 'idle';
      return current;
    });
  }, [active, simulate]);

  const request = async (route, body, method = body == null ? 'GET' : 'POST') => {
    const response = await crealityFetch(
      `${WORKER_URL}/api/v1/creality/web/${route}`,
      {
        method,
        headers: body == null ? {} : { 'Content-Type': 'application/json' },
        body: body == null ? undefined : JSON.stringify(body),
      },
      secret,
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(crealityResponseError(data, response.status, `Creality ${route} failed`));
    }
    return data;
  };

  const projectFile = (source) => source.blob instanceof File && source.blob.name === source.name
    ? source.blob
    : new File([source.blob], source.name, { type: source.type || 'application/octet-stream' });

  const croppedImageFile = async (image, width, height, prefix, index = 0) => {
    const blob = await cropImageToBlob(image, width, height);
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const suffix = index ? `-${String(index).padStart(2, '0')}` : '';
    return new File([blob], `${prefix}${suffix}-${slugify(image.alt || project.title || 'model')}.${ext}`, {
      type: blob.type || 'image/jpeg',
    });
  };

  const submit = async (publication, batchRunId = null) => {
    const preflight = platformPreflight(platform, project);
    if (preflight.errors.length) {
      const message = preflight.errors.join(' ');
      setError(message); setStatus('error'); reportBatch(batchRunId, 'error', message); return;
    }
    if (simulate) {
      setStatus('uploading'); setError('');
      setProgress(`Simulating Creality ${publication} save…`);
      await new Promise((resolve) => setTimeout(resolve, 700));
      setResult({ id: 'demo', state: `simulated-${publication}`, demo: true });
      setStatus('done'); setProgress('');
      reportBatch(batchRunId, 'success', `Creality ${publication} save simulated — nothing uploaded`, {
        publicationState: publication,
        simulated: true,
      });
      return;
    }
    if (!secret || !isDesktopCrealitySession(secret)) {
      const message = 'Connect Creality Cloud in ModelPrep Desktop before uploading.';
      setError(message); setStatus('error'); reportBatch(batchRunId, 'error', message); return;
    }

    setStatus('uploading'); setError(''); setResult(null);
    try {
      const orderedImages = orderedPlatformImages(platform, project);
      const cover = orderedImages[0];
      const gallery = orderedImages.slice(1, 10);
      const modelFiles = withoutExcluded(crealityRawModelFiles(project.files, project.profiles), project.platforms?.creality);
      const instructionFiles = withoutExcluded(project.files.filter((file) =>
        file.blob && CREALITY_INSTRUCTION_FORMATS.includes(fileExt(file.name))), project.platforms?.creality);
      if (!cover) throw new Error('Choose a cover image before sending to Creality Cloud.');
      if (!modelFiles.length) throw new Error('Add at least one Creality-compatible model file.');

      setProgress('Uploading Creality web cover…');
      const pcCover = await uploadCrealityFile({
        workerUrl: WORKER_URL, secret, role: 'cover',
        file: await croppedImageFile(cover, 1600, 1200, 'web-cover'),
      });
      pcCover.width = 1600; pcCover.height = 1200;

      setProgress('Uploading Creality app cover…');
      const appCover = await uploadCrealityFile({
        workerUrl: WORKER_URL, secret, role: 'cover',
        file: await croppedImageFile(cover, 1200, 1600, 'app-cover'),
      });
      appCover.width = 1200; appCover.height = 1600;

      const galleryRecords = [];
      for (let index = 0; index < gallery.length; index += 1) {
        setProgress(`Uploading Creality gallery image ${index + 1} of ${gallery.length}…`);
        const record = await uploadCrealityFile({
          workerUrl: WORKER_URL, secret, role: 'photo',
          file: await croppedImageFile(gallery[index], 1600, 1200, 'gallery', index + 1),
        });
        galleryRecords.push({ ...record, width: 1600, height: 1200 });
      }

      const modelRecords = [];
      for (let index = 0; index < modelFiles.length; index += 1) {
        setProgress(`Uploading Creality model file ${index + 1} of ${modelFiles.length}…`);
        const uploadedModel = await uploadCrealityFile({
          workerUrl: WORKER_URL, secret, role: 'model', file: projectFile(modelFiles[index]),
        });
        // Creality's native modelList includes a type-2 preview for rendered
        // model formats. Reuse the already-uploaded cover rather than sending
        // another identical image solely for the file card.
        modelRecords.push(crealityUsesRenderedModelCover(modelFiles[index].name)
          ? { ...uploadedModel, cover: { url: pcCover.url, type: 2 } }
          : uploadedModel);
      }

      const instructionRecords = [];
      for (let index = 0; index < instructionFiles.length; index += 1) {
        setProgress(`Uploading Creality instruction file ${index + 1} of ${instructionFiles.length}…`);
        instructionRecords.push(await uploadCrealityFile({
          workerUrl: WORKER_URL, secret, role: 'instruction', file: projectFile(instructionFiles[index]),
        }));
      }

      setProgress(publication === 'public'
        ? 'Publishing Creality model publicly…'
        : 'Creating private Creality model…');
      const saved = await request('submit', {
        title: project.title.trim(),
        description: mdToHtml(project.description),
        categoryId: String(options.categoryId),
        license: options.license || CREALITY_LICENSE_MAP[project.license] || 'CXY-SL',
        modelSource: Number(options.modelSource || 1),
        publication,
        nsfw: !!options.nsfw,
        pcCover,
        appCover,
        gallery: galleryRecords,
        models: modelRecords,
        instructions: instructionRecords,
        tags: project.tags,
      });

      setProgress('Reading the saved Creality model back…');
      const readback = await request(`status?id=${encodeURIComponent(saved.id)}&state=${encodeURIComponent(saved.state)}`, null, 'GET');
      const model = readback.model || {};
      const info = model.modelInfo || model.modelGroupDetail || model.groupItem || model;
      const readbackTitle = info.groupName || info.modelName || '';
      if (readbackTitle && String(readbackTitle) !== project.title.trim()) {
        throw new Error(`Creality read-back returned a different title: ${readbackTitle}.`);
      }
      if (publication === 'private' && info.isShared === true) {
        throw new Error('Creality read-back reports a shared model instead of private.');
      }
      if (publication === 'public' && info.isShared === false) {
        throw new Error('Creality read-back still reports a private model after public publish.');
      }
      if (info.categoryId != null && String(info.categoryId) !== String(options.categoryId)) {
        throw new Error(`Creality read-back returned category ${info.categoryId} instead of ${options.categoryId}.`);
      }
      const readbackModels = model.modelList || info.modelList;
      if (Array.isArray(readbackModels) && readbackModels.length < modelRecords.length) {
        throw new Error(`Creality read-back returned ${readbackModels.length} model files after uploading ${modelRecords.length}.`);
      }
      setResult({ id: String(saved.id), state: saved.state, url: saved.url, verified: true });
      setStatus('done');
      reportBatch(batchRunId, 'success', `${saved.state} Creality model saved and read back`, {
        publicationState: saved.state,
        url: saved.url,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message); setStatus('error'); reportBatch(batchRunId, 'error', message);
    } finally { setProgress(''); }
  };

  useEffect(() => {
    if (!batchRequest?.runId || handledBatchRun.current === batchRequest.runId) return;
    handledBatchRun.current = batchRequest.runId;
    submit(batchRequest.visibility || (batchRequest.action === 'publish' ? 'public' : batchRequest.action), batchRequest.runId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchRequest?.runId]);

  const loadDrafts = async () => {
    if (simulate) { setDrafts([]); return; }
    setDraftsError('');
    try { setDrafts((await request('drafts', null, 'GET')).drafts || []); }
    catch (cause) { setDraftsError(cause instanceof Error ? cause.message : String(cause)); setDrafts([]); }
  };
  const toggleDrafts = () => {
    const next = !draftsOpen; setDraftsOpen(next); if (next && drafts === null) loadDrafts();
  };

  return (
    <div className="border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="mp-card p-3" style={{ background: 'rgba(230,57,70,0.05)', border: '1px solid rgba(230,57,70,0.42)' }}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="mp-display tracking-wide text-[14px]">CREALITY CLOUD UPLOAD</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: simulate ? '#3A86FF' : '#E63946', color: '#fff' }}>{simulate ? 'Simulation' : 'Real'}</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.15em] opacity-55">isolated desktop session</span>
        </div>

        {status === 'idle' && <><p className="text-[13px] mb-2.5 opacity-65">Connect through Creality Cloud’s real sign-in page to upload.</p><button onClick={openConnections} className="mp-btn text-xs py-2 px-3"><Globe size={13} /> Connect Creality Cloud</button></>}
        {status === 'connected' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-2.5" style={{ color: '#3a8d68' }}><StatusDot status={active?.status || 'connected'} />{simulate ? 'Demo account (simulation only)' : <>Connected as <span className="mp-mono">{active?.label}</span></>}<button onClick={openConnections} className="mp-mono text-[11px] uppercase tracking-[0.15em] ml-1 opacity-60">manage</button></div>
            <p className="text-[12px] mb-2.5 leading-snug opacity-65">{simulate ? 'Demo simulation only—no files or metadata leave the app.' : "Private creates a real cloud-stored model visible only to you. Creality's new-model page does not create drafts; it only edits existing drafts. Public creates a real public listing."}</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => submit('private')} className="mp-btn mp-btn-ghost text-xs py-2 px-3"><Bookmark size={13} /> {simulate ? 'Simulate private model' : 'Create private model'}</button>
              <button onClick={() => submit('public')} className="mp-btn text-xs py-2 px-3"><Send size={13} /> {simulate ? 'Simulate public publish' : 'Publish public (LIVE)'}</button>
              <button onClick={toggleDrafts} className="mp-mono text-[11px] uppercase tracking-[0.15em] px-2">{draftsOpen ? 'Hide drafts' : 'My Creality drafts'}</button>
            </div>
            {draftsOpen && (
              <div className="mt-3 mp-card p-2" style={{ background: 'rgba(21,23,28,0.03)' }}>
                <div className="flex items-center justify-between mb-2"><span className="mp-mono text-[11px] uppercase tracking-[0.15em]">Recent drafts</span><button onClick={loadDrafts} className="mp-mono text-[10px] uppercase">Refresh</button></div>
                {draftsError && <div className="text-[11px] mb-2" style={{ color: '#b91c1c' }}>{draftsError}</div>}
                {drafts && drafts.length === 0 && <div className="text-[11px] opacity-55">No drafts found.</div>}
                {(drafts || []).map((draft) => {
                  const id = String(draft.id ?? draft.modelDraftId ?? '');
                  const name = draft.groupName ?? draft.modelInfo?.groupName ?? `Draft ${id}`;
                  return <div key={id || name} className="flex items-center gap-2 p-1.5 mb-1 bg-white"><span className="flex-1 truncate text-[12px]">{name}</span><span className="mp-mono text-[10px] uppercase" style={{ color: '#d97706' }}>draft</span></div>;
                })}
              </div>
            )}
          </>
        )}
        {status === 'uploading' && <div className="flex items-center gap-2 text-xs py-1.5"><Loader size={14} className="mp-spin" /> {progress || 'Working…'}</div>}
        {status === 'done' && <><div className="flex items-center gap-2 text-xs mb-2" style={{ color: result?.demo ? '#3A86FF' : '#3a8d68' }}><Check size={14} />{result?.demo ? `Simulation complete — nothing uploaded (${result.state}).` : `${result?.state} Creality model saved and read back.`}</div>{!result?.demo && result?.url && <a href={result.url} target="_blank" rel="noopener noreferrer" className="mp-card mp-mono text-[13px] p-2 mb-2 break-all block">{result.url}</a>}<button onClick={() => { setResult(null); setStatus('connected'); }} className="mp-mono text-[11px] uppercase tracking-[0.15em]">{result?.demo ? 'Clear simulated result' : 'Upload another'}</button></>}
        {status === 'error' && <><div className="text-[12px] p-2 mb-2 break-all" style={{ background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.3)', color: '#991b1b' }}>{error}</div><button onClick={() => setStatus(active || simulate ? 'connected' : 'idle')} className="mp-btn mp-btn-ghost text-xs py-1.5 px-3"><ArrowRight size={12} /> Back</button></>}
      </div>
    </div>
  );
}

function ThingiverseUploadFlow({ platform, project, batchRequest, onBatchResult }) {
  const accounts = useAccounts(); const openConnections = useOpenConnections(); const active = accounts.getActive('thingiverse'); const secret = active?.secret || ''; const options = project.platforms?.thingiverse || {}; const simulate = !!project.__demo;
  const usable = accountIsUsable(active);
  const [status, setStatus] = useState(usable || simulate ? 'connected' : 'idle'); const [progress, setProgress] = useState(''); const [error, setError] = useState(''); const [result, setResult] = useState(null); const handled = useRef(null);
  const request = async (route, body) => { const response = await thingiverseFetch(`${WORKER_URL}/api/v1/thingiverse/web/${route}`, { method: body == null ? 'GET' : 'POST', headers: body == null ? {} : { 'Content-Type': 'application/json' }, body: body == null ? undefined : JSON.stringify(body) }, secret); const data = await response.json().catch(() => ({})); if (!response.ok || !data.ok) throw new Error(thingiverseResponseError(data, response.status, `Thingiverse ${route} failed`)); return data; };
  useEffect(() => { setStatus((value) => (usable || simulate) && value === 'idle' ? 'connected' : (!usable && !simulate && value === 'connected' ? 'idle' : value)); }, [usable, simulate]);
  const report = (runId, state, detail, extra = {}) => { if (runId) onBatchResult?.({ runId, platformId: 'thingiverse', state, detail, ...extra }); };
  const submit = async (publish, runId = null) => {
    const preflight = platformPreflight(platform, project); if (preflight.errors.length) { const message = preflight.errors.join(' '); setError(message); setStatus('error'); report(runId, 'error', message); return; }
    if (simulate) { setStatus('uploading'); setProgress('Simulating Thingiverse draft…'); await new Promise((resolve) => setTimeout(resolve, 450)); setResult({ demo: true, state: publish ? 'public' : 'draft' }); setStatus('done'); setProgress(''); report(runId, 'success', 'Thingiverse simulation complete — nothing uploaded', { publicationState: publish ? 'public' : 'draft', simulated: true }); return; }
    setStatus('uploading'); setError('');
    try {
      const pending = []; const modelFiles = withoutExcluded(project.files.filter((file) => file.blob && platform.formats.includes(fileExt(file.name)) && !file.isImage), project.platforms?.thingiverse);
      for (let i = 0; i < modelFiles.length; i += 1) { setProgress(`Uploading Thingiverse file ${i + 1} of ${modelFiles.length}…`); const source = modelFiles[i]; const file = source.blob instanceof File ? source.blob : new File([source.blob], source.name, { type: source.type }); pending.push(await uploadThingiverseFile({ workerUrl: WORKER_URL, secret, role: 'model', file })); }
      const images = orderedPlatformImages(platform, project); for (let i = 0; i < images.length; i += 1) { setProgress(`Uploading Thingiverse image ${i + 1} of ${images.length}…`); const blob = await fetch(images[i].dataUrl).then((response) => response.blob()); const file = new File([blob], `${String(i + 1).padStart(2, '0')}-${slugify(images[i].alt || 'image')}.${blob.type.includes('png') ? 'png' : 'jpg'}`, { type: blob.type }); pending.push(await uploadThingiverseFile({ workerUrl: WORKER_URL, secret, role: 'image', file })); }
      setProgress(publish ? 'Publishing Thingiverse Thing…' : 'Saving Thingiverse draft…'); const saved = await request('submit', { name: project.title, summary: options.summary, description: project.description, categoryId: options.categoryId, license: options.license, tags: project.tags, files: pending, publish, termsAccepted: !!options.termsAccepted, aiGenerated: !!options.aiGenerated, wip: !!options.wip, customizable: !!options.customizable, remix: !!options.remix, sourceThingId: options.sourceThingId, nsfw: !!options.nsfw, printSettings: options.printSettings || {}, sections: options.sections || [], education: options.education || null });
      setProgress('Reading completed Thingiverse data back…'); const readback = await request(`status?id=${encodeURIComponent(saved.id)}`, null); if (!readback.thing) throw new Error('Thingiverse complete read-back was empty.'); setResult({ ...saved, verified: true }); setStatus('done'); report(runId, 'success', `${publish ? 'Published' : 'Draft'} Thingiverse Thing saved and read back`, { publicationState: publish ? 'public' : 'draft', url: saved.url });
    } catch (cause) { const message = cause instanceof Error ? cause.message : String(cause); setError(message); setStatus('error'); report(runId, 'error', message); } finally { setProgress(''); }
  };
  useEffect(() => { if (!batchRequest?.runId || handled.current === batchRequest.runId) return; handled.current = batchRequest.runId; submit(batchRequest.action === 'publish', batchRequest.runId); }, [batchRequest?.runId]);
  return <div className="border-t pt-3 space-y-2">{status === 'idle' && <button className="mp-btn text-xs" onClick={openConnections}>Connect Thingiverse</button>}{status === 'uploading' && <p className="text-xs"><Loader size={14} className="inline mp-spin" /> {progress}</p>}{(status === 'connected' || status === 'error') && <div className="flex gap-2"><button className="mp-btn mp-btn-ghost text-xs" onClick={() => submit(false)}>Save draft</button><button className="mp-btn text-xs" onClick={() => submit(true)}>Publish (LIVE)</button></div>}{error && <p className="text-xs text-red-700">{error}</p>}{status === 'done' && <p className="text-xs text-green-700"><Check size={14} className="inline" /> {result?.demo ? 'Simulation complete — nothing uploaded.' : 'Thingiverse result saved and verified.'}</p>}</div>;
}

function ThangsUploadFlow({ platform, project, batchRequest, onBatchResult }) {
  const accounts = useAccounts(); const openConnections = useOpenConnections(); const active = accounts.getActive('thangs'); const secret = active?.secret || ''; const options = project.platforms?.thangs || {}; const simulate = !!project.__demo;
  const usable = accountIsUsable(active);
  const [status, setStatus] = useState(usable || simulate ? 'connected' : 'idle'); const [progress, setProgress] = useState(''); const [error, setError] = useState(''); const [result, setResult] = useState(null); const handled = useRef(null);
  useEffect(() => { setStatus((value) => (usable || simulate) && value === 'idle' ? 'connected' : (!usable && !simulate && value === 'connected' ? 'idle' : value)); }, [usable, simulate]);
  const report = (runId, state, detail, extra = {}) => { if (runId) onBatchResult?.({ runId, platformId: 'thangs', state, detail, ...extra }); };
  const request = async (route, body) => { const response = await thangsFetch(`${WORKER_URL}/api/v1/thangs/web/${route}`, { method: body == null ? 'GET' : 'POST', headers: body == null ? {} : { 'Content-Type': 'application/json' }, body: body == null ? undefined : JSON.stringify(body) }, secret); const data = await response.json().catch(() => ({})); if (!response.ok || !data.ok) { const error = new Error(thangsResponseError(data, response.status, `Thangs ${route} failed`)); if (data.draftId) error.draftId = String(data.draftId); throw error; } return data; };
  const verifyExisting = async () => {
    const id = String(options.resumeDraftId || '').trim();
    if (!id) return;
    setStatus('uploading'); setError(''); setProgress(`Verifying existing private Thangs draft ${id}…`);
    try {
      const readback = await request(`status?id=${encodeURIComponent(id)}`, null);
      if (!readback.readback?.details || !readback.readback?.license) throw new Error('Thangs complete read-back was empty.');
      setResult({ id, url: `https://thangs.com/designer/model/${encodeURIComponent(id)}`, verified: true }); setStatus('done');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setStatus('error'); } finally { setProgress(''); }
  };
  const submit = async (isPublic, runId = null) => {
    const preflight = platformPreflight(platform, project); if (preflight.errors.length) { const message = preflight.errors.join(' '); setError(message); setStatus('error'); report(runId, 'error', message); return; }
    if (simulate) { setStatus('uploading'); setProgress('Simulating private Thangs model…'); await new Promise((resolve) => setTimeout(resolve, 450)); setResult({ demo: true, state: isPublic ? 'public' : 'private' }); setStatus('done'); setProgress(''); report(runId, 'success', 'Thangs upload simulated — nothing uploaded', { publicationState: isPublic ? 'public' : 'private', simulated: true }); return; }
    if (!isDesktopThangsSession(secret)) { const message = 'Connect Thangs in ModelPrep Desktop before uploading.'; setError(message); setStatus('error'); report(runId, 'error', message); return; }
    setStatus('uploading'); setError('');
    try {
      const eligibleFiles = withoutExcluded(project.files.filter((file) => file.blob && platform.formats.includes(fileExt(file.name))), project.platforms?.thangs);
      const { models: modelSources, references: referenceSources } = selectThangsSourceFiles(eligibleFiles, options);
      const uploadSources = async (values, role, convert = (file) => file.blob instanceof File ? file.blob : new File([file.blob], file.name, { type: file.type })) => { const receipts = []; for (let i = 0; i < values.length; i += 1) { setProgress(`Uploading Thangs ${role} ${i + 1} of ${values.length}…`); receipts.push(await uploadThangsFile({ workerUrl: WORKER_URL, secret, role, file: await convert(values[i], i) })); } return receipts; };
      const parts = await uploadSources(modelSources, 'model');
      parts.forEach((part, index) => { part.primary = modelSources[index].id === options.primaryFileId || (!options.primaryFileId && index === 0); part.partName = modelSources[index].name.replace(/\.[^.]+$/, ''); });
      const references = await uploadSources(referenceSources, 'reference');
      const images = await uploadSources(orderedPlatformImages(platform, project), 'image', async (image, index) => { const blob = await fetch(image.dataUrl).then((response) => response.blob()); return new File([blob], `${String(index + 1).padStart(2, '0')}-${slugify(image.alt || 'image')}.${blob.type.includes('png') ? 'png' : 'jpg'}`, { type: blob.type }); });
      setProgress('Creating Thangs model…');
      const saved = await request('submit', { existingId: options.resumeDraftId || '', name: project.title, description: mdToHtml(project.description), category: options.category, tags: project.tags, isPublic, structure: options.structure || 'single', units: options.units || 'mm', parts, images, references, allowRemix: options.allowRemix !== false, aiGenerated: !!options.aiGenerated, feedbackEnabled: options.feedbackEnabled !== false, folderId: options.folderId, workspaceId: options.workspaceId, accessTypeId: options.accessTypeId, planIds: options.planIds || [], dependencies: options.dependencies || [], versionNotes: options.versionNotes || '', marketplace: !!options.marketplace, price: options.price || 0, license: options.license });
      setProgress('Verifying Thangs details, attachments, and license…'); const readback = await request(`status?id=${encodeURIComponent(saved.id)}`, null); if (!readback.readback?.details) throw new Error('Thangs details read-back was empty.');
      setResult({ ...saved, verified: true }); setStatus('done'); report(runId, 'success', `${isPublic ? 'Public' : 'Private'} Thangs model saved and fully read back`, { publicationState: isPublic ? 'public' : 'private', url: saved.url });
    } catch (cause) { const message = cause instanceof Error ? cause.message : String(cause); setError(message); setStatus('error'); report(runId, 'error', message); } finally { setProgress(''); }
  };
  useEffect(() => { if (!batchRequest?.runId || handled.current === batchRequest.runId) return; handled.current = batchRequest.runId; submit(batchRequest.action === 'publish', batchRequest.runId); }, [batchRequest?.runId]);
  return <div className="border-t pt-3 space-y-2">{status === 'idle' && <button className="mp-btn text-xs" onClick={openConnections}>Connect Thangs</button>}{status === 'uploading' && <p className="text-xs"><Loader size={14} className="inline mp-spin mr-2" />{progress}</p>}{(status === 'connected' || status === 'error') && <div className="flex flex-wrap gap-2">{options.resumeDraftId && <button className="mp-btn mp-btn-ghost text-xs" onClick={verifyExisting}>Verify existing draft</button>}<button className="mp-btn mp-btn-ghost text-xs" onClick={() => submit(false)}>Create private</button><button className="mp-btn text-xs" onClick={() => submit(true)}>Publish public (LIVE)</button></div>}{error && <p className="text-xs text-red-700">{error}</p>}{status === 'done' && <p className="text-xs text-green-700"><Check size={14} className="inline" /> {result?.demo ? 'Simulation complete — nothing uploaded.' : 'Thangs model saved and verified.'} {result?.url && <a href={result.url} target="_blank" rel="noreferrer" className="underline">Open result</a>}</p>}</div>;
}

function MakerRoadUploadFlow({ platform, project, batchRequest, onBatchResult }) {
  const accounts = useAccounts();
  const openConnections = useOpenConnections();
  const active = accounts.getActive('makeroad');
  const secret = active?.secret || '';
  const options = project.platforms?.makeroad || {};
  const simulate = !!project.__demo;
  const usable = accountIsUsable(active);
  const [status, setStatus] = useState(usable || simulate ? 'connected' : 'idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const handledBatchRun = useRef(null);
  useEffect(() => { setStatus((value) => (usable || simulate) && value === 'idle' ? 'connected' : (!usable && !simulate && value === 'connected' ? 'idle' : value)); }, [usable, simulate]);
  const report = (runId, state, detail, extra = {}) => { if (runId) onBatchResult?.({ runId, platformId: 'makeroad', state, detail, ...extra }); };
  const request = async (route, body, method = body == null ? 'GET' : 'POST') => {
    const response = await makerRoadFetch(`${WORKER_URL}/api/v1/makeroad/web/${route}`, { method, headers: body == null ? {} : { 'Content-Type': 'application/json' }, body: body == null ? undefined : JSON.stringify(body) }, secret);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(makerRoadResponseError(data, response.status, `MakerRoad ${route} failed`));
    return data;
  };
  const sourceFile = (file) => file.blob instanceof File && file.blob.name === file.name ? file.blob : new File([file.blob], file.name, { type: file.type || 'application/octet-stream' });
  const submit = async (publish, runId = null) => {
    const preflight = platformPreflight(platform, project);
    if (preflight.errors.length) { const message = preflight.errors.join(' '); setError(message); setStatus('error'); report(runId, 'error', message); return; }
    if (simulate) { setStatus('uploading'); setProgress('Simulating MakerRoad private save…'); await new Promise((resolve) => setTimeout(resolve, 500)); setResult({ demo: true, state: publish ? 'pending' : 'draft' }); setStatus('done'); setProgress(''); report(runId, 'success', 'MakerRoad save simulated — nothing uploaded', { publicationState: publish ? 'pending' : 'draft', simulated: true }); return; }
    if (!isDesktopMakerRoadSession(secret)) { const message = 'Connect MakerRoad in ModelPrep Desktop before uploading.'; setError(message); setStatus('error'); report(runId, 'error', message); return; }
    setStatus('uploading'); setError(''); setResult(null);
    let saved = null;
    try {
      let resolvedCategoryIds = (options.categoryIds || []).map(String);
      if (!resolvedCategoryIds.length && (options.categoryPaths || []).length) {
        setProgress('Resolving the current MakerRoad categories…');
        const metadata = await request('meta', null, 'GET');
        const liveCategories = flattenMakerRoadOptions(metadata.meta?.modelsClassify || []);
        resolvedCategoryIds = options.categoryPaths.map((path) => {
          const wanted = normalizeMakerRoadCategoryPath(path);
          return liveCategories.find((category) => normalizeMakerRoadCategoryPath(category.name) === wanted)?.id || '';
        }).filter(Boolean);
        if (resolvedCategoryIds.length !== options.categoryPaths.length) {
          throw new Error('MakerRoad’s live category taxonomy no longer contains the prepared test category. Choose a current category in Platforms.');
        }
      }
      const orderedImages = orderedPlatformImages(platform, project).slice(0, 10);
      const modelFiles = withoutExcluded(project.files.filter((file) => file.blob && MAKEROAD_MODEL_FORMATS.includes(fileExt(file.name)) && !file.isProfile), project.platforms?.makeroad);
      const profileFiles = withoutExcluded(project.files.filter((file) => file.blob && fileExt(file.name) === '3mf' && file.isProfile), project.platforms?.makeroad).slice(0, 10);
      const documentFiles = withoutExcluded(project.files.filter((file) => file.blob && MAKEROAD_DOCUMENT_FORMATS.includes(fileExt(file.name))), project.platforms?.makeroad).slice(0, 5);
      const uploadMany = async (values, role, label, transform = sourceFile) => {
        const receipts = [];
        for (let index = 0; index < values.length; index += 1) {
          setProgress(`Uploading MakerRoad ${label} ${index + 1} of ${values.length}…`);
          receipts.push(await uploadMakerRoadFile({ workerUrl: WORKER_URL, secret, role, file: await transform(values[index], index) }));
        }
        return receipts;
      };
      const images = await uploadMany(orderedImages, 'image', 'image', async (image, index) => {
        const blob = await fetch(image.dataUrl).then((response) => response.blob());
        const ext = blob.type === 'image/png' ? 'png'
          : blob.type === 'image/webp' ? 'webp'
            : blob.type === 'image/gif' ? 'gif'
              : 'jpg';
        return new File([blob], `${String(index + 1).padStart(2, '0')}-${slugify(image.alt || project.title || 'image')}.${ext}`, { type: blob.type || 'image/jpeg' });
      });
      const models = await uploadMany(modelFiles, 'model', 'model file');
      const profiles = await uploadMany(profileFiles, 'profile', 'print configuration');
      const documents = await uploadMany(documentFiles, 'document', 'document');
      const license = MAKEROAD_LICENSES[Number(options.licenseIndex || 0)] || MAKEROAD_LICENSES[0];
      setProgress(publish ? 'Submitting MakerRoad model for review…' : 'Saving private MakerRoad draft…');
      saved = await request('submit', {
        action: publish ? 'publish' : 'save', uploadType: Number(options.uploadType || 1), referUrl: options.referUrl,
        models, profiles, images, documents, title: project.title, description: mdToHtml(project.description),
        categoryIds: resolvedCategoryIds, tags: project.tags, printMethods: options.printMethods || [],
        printerIds: options.printerIds || [], materialIds: options.materialIds || [], colorIds: options.colorIds || [],
        aiGenerated: !!options.aiGenerated, nsfw: !!options.nsfw, visibility: options.visibility || 'private',
        scheduled: !!options.scheduled, planTime: options.planTime, payType: options.payType || 'free', payValue: options.payValue || 0,
        shareNosign: license.shareNosign, shareEdit: license.shareEdit, shareBusiness: license.shareBusiness,
      });
      setProgress('Reading the saved MakerRoad model back…');
      const readback = await request(`status?id=${encodeURIComponent(saved.id)}`, null, 'GET');
      const readbackIssues = makerRoadReadbackIssues({
        title: project.title.trim(), visibility: options.visibility || 'private', scheduled: !!options.scheduled,
        payType: options.payType || 'free', models: models.length, profiles: profiles.length, documents: documents.length, images: images.length,
      }, readback.model);
      if (readbackIssues.length) throw new Error(readbackIssues.join(' '));
      const publicationState = publish ? 'pending' : 'draft';
      setResult({ ...saved, verified: true, state: publicationState }); setStatus('done');
      report(runId, 'success', publish ? 'MakerRoad submission saved and read back; review pending' : 'Private MakerRoad draft saved and read back', { publicationState, url: saved.url });
    } catch (cause) { const message = cause instanceof Error ? cause.message : String(cause); setError(message); setStatus('error'); report(runId, 'error', message); }
    finally { setProgress(''); }
  };
  useEffect(() => { if (!batchRequest?.runId || handledBatchRun.current === batchRequest.runId) return; handledBatchRun.current = batchRequest.runId; submit(batchRequest.action === 'publish', batchRequest.runId); }, [batchRequest?.runId]);
  return <div className="border-t pt-3 space-y-2" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
    {status === 'idle' && <button className="mp-btn text-xs" onClick={() => openConnections('accounts')}>Connect MakerRoad</button>}
    {status === 'uploading' && <div className="text-xs flex gap-2"><Loader size={14} className="mp-spin" />{progress}</div>}
    {(status === 'connected' || status === 'error') && <div className="flex gap-2 flex-wrap"><button className="mp-btn mp-btn-ghost text-xs" onClick={() => submit(false)}><Bookmark size={13} />{simulate ? 'Simulate private save' : 'Save private draft'}</button><button className="mp-btn text-xs" onClick={() => submit(true)}><Send size={13} />{simulate ? 'Simulate review submit' : 'Submit for review (LIVE)'}</button></div>}
    {error && <p className="text-xs text-red-700">{error}</p>}
    {status === 'done' && <div className="text-xs" style={{ color: '#247255' }}><Check size={14} className="inline mr-1" />{result?.demo ? 'Simulation complete — nothing uploaded.' : result?.state === 'pending' ? 'Saved and verified; public review is pending.' : 'Private draft saved and verified.'}{result?.url && <a className="ml-2 underline" href={result.url} target="_blank" rel="noreferrer">Open result</a>}</div>}
  </div>;
}

function MakerOnlineUploadFlow({ platform, project, batchRequest, onBatchResult }) {
  const accounts = useAccounts();
  const openConnections = useOpenConnections();
  const active = accounts.getActive('makeronline');
  const secret = active?.secret || '';
  const options = project.platforms?.makeronline || {};
  const simulate = !!project.__demo;
  const [status, setStatus] = useState(active || simulate ? 'connected' : 'idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const handledBatchRun = useRef(null);

  const reportBatch = (batchRunId, state, detail, metadata = {}) => {
    if (!batchRunId) return;
    onBatchResult?.({ runId: batchRunId, platformId: 'makeronline', state, detail, ...metadata });
  };

  useEffect(() => {
    setStatus((current) => {
      if ((active || simulate) && current === 'idle') return 'connected';
      if (!active && !simulate && current === 'connected') return 'idle';
      return current;
    });
  }, [active, simulate]);

  const request = async (route, body, method = body == null ? 'GET' : 'POST') => {
    const response = await makerOnlineFetch(
      `${WORKER_URL}/api/v1/makeronline/web/${route}`,
      {
        method,
        headers: body == null ? {} : { 'Content-Type': 'application/json' },
        body: body == null ? undefined : JSON.stringify(body),
      },
      secret,
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(makerOnlineResponseError(data, response.status, `MakerOnline ${route} failed`));
    }
    return data;
  };

  const projectFile = (source) => source.blob instanceof File && source.blob.name === source.name
    ? source.blob
    : new File([source.blob], source.name, { type: source.type || 'application/octet-stream' });

  const imageFile = async (image, prefix, index = 0) => {
    const blob = await fetch(image.dataUrl).then((response) => response.blob());
    const ext = blob.type === 'image/png' ? 'png'
      : blob.type === 'image/webp' ? 'webp'
        : blob.type === 'image/gif' ? 'gif'
          : 'jpg';
    const suffix = index ? `-${String(index).padStart(2, '0')}` : '';
    return new File([blob], `${prefix}${suffix}-${slugify(image.alt || project.title || 'model')}.${ext}`, {
      type: blob.type || 'image/jpeg',
    });
  };

  const submit = async (publication, batchRunId = null) => {
    const effectiveProject = publication === 'public'
      ? { ...project, platforms: { ...project.platforms, makeronline: { ...options, publication: 'public', permission: 1 } } }
      : project;
    const preflight = platformPreflight(platform, effectiveProject);
    if (preflight.errors.length) {
      const message = preflight.errors.join(' ');
      setError(message); setStatus('error'); reportBatch(batchRunId, 'error', message); return;
    }
    if (simulate) {
      setStatus('uploading'); setError(''); setProgress(`Simulating MakerOnline ${publication}…`);
      await new Promise((resolve) => setTimeout(resolve, 700));
      setResult({ id: 'demo', state: `simulated-${publication}`, demo: true });
      setStatus('done'); setProgress('');
      reportBatch(batchRunId, 'success', `MakerOnline ${publication} simulated — nothing uploaded`, {
        publicationState: publication,
        simulated: true,
      });
      return;
    }
    if (!secret || !isDesktopMakerOnlineSession(secret)) {
      const message = 'Connect MakerOnline in ModelPrep Desktop before uploading.';
      setError(message); setStatus('error'); reportBatch(batchRunId, 'error', message); return;
    }

    setStatus('uploading'); setError(''); setResult(null);
    try {
      const orderedImages = orderedPlatformImages(platform, project).slice(0, 20);
      const modelFiles = withoutExcluded(project.files.filter((file) => file.blob && MAKERONLINE_MODEL_FORMATS.includes(fileExt(file.name))), project.platforms?.makeronline);
      const documentationFiles = project.files.filter((file) =>
        file.blob
        && MAKERONLINE_DOCUMENT_FORMATS.includes(fileExt(file.name))
        && !MAKERONLINE_MODEL_FORMATS.includes(fileExt(file.name)));
      const profileFiles = options.includePrintProfile && Number(options.printMethod || 3) !== 2
        ? withoutExcluded(project.files.filter((file) => file.blob && fileExt(file.name) === '3mf'), project.platforms?.makeronline)
        : [];
      if (!orderedImages.length) throw new Error('Choose a cover image before sending to MakerOnline.');
      if (!modelFiles.length) throw new Error('Add at least one MakerOnline-compatible raw model file.');

      const imageRecords = [];
      for (let index = 0; index < orderedImages.length; index += 1) {
        setProgress(`Uploading MakerOnline image ${index + 1} of ${orderedImages.length}…`);
        imageRecords.push(await uploadMakerOnlineFile({
          workerUrl: WORKER_URL,
          secret,
          role: index === 0 ? 'cover' : 'photo',
          file: await imageFile(orderedImages[index], index === 0 ? 'cover' : 'gallery', index),
        }));
      }

      const modelRecords = [];
      for (let index = 0; index < modelFiles.length; index += 1) {
        setProgress(`Uploading MakerOnline raw model ${index + 1} of ${modelFiles.length}…`);
        modelRecords.push(await uploadMakerOnlineFile({
          workerUrl: WORKER_URL, secret, role: 'model', file: projectFile(modelFiles[index]),
        }));
      }

      const documentRecords = [];
      for (let index = 0; index < documentationFiles.length; index += 1) {
        setProgress(`Uploading MakerOnline documentation ${index + 1} of ${documentationFiles.length}…`);
        documentRecords.push(await uploadMakerOnlineFile({
          workerUrl: WORKER_URL, secret, role: 'documentation', file: projectFile(documentationFiles[index]),
        }));
      }

      const profileRecords = [];
      for (let index = 0; index < profileFiles.length; index += 1) {
        setProgress(`Uploading MakerOnline print profile ${index + 1} of ${profileFiles.length}…`);
        const uploaded = await uploadMakerOnlineFile({
          workerUrl: WORKER_URL, secret, role: 'profile', file: projectFile(profileFiles[index]),
        });
        setProgress(`Parsing MakerOnline print profile ${index + 1} of ${profileFiles.length}…`);
        const parsed = await request('parse-profile', uploaded, 'POST');
        profileRecords.push({ ...uploaded, parsed: parsed.parsed || {} });
      }

      const profileImageRecords = [];
      if (profileRecords.length) {
        const requestedIds = [...new Set(project.profiles.flatMap((profile) => [
          ...(profile.photoIds || []),
          profile.coverImageId,
        ]).filter(Boolean))];
        const requestedImages = requestedIds.map((id) => project.images.find((image) => image.id === id)).filter(Boolean);
        const profileImages = (requestedImages.length ? requestedImages : [orderedImages[0]]).slice(0, 100);
        for (let index = 0; index < profileImages.length; index += 1) {
          setProgress(`Uploading MakerOnline print-profile image ${index + 1} of ${profileImages.length}…`);
          profileImageRecords.push(await uploadMakerOnlineFile({
            workerUrl: WORKER_URL,
            secret,
            role: 'profile-photo',
            file: await imageFile(profileImages[index], 'print-profile', index),
          }));
        }
      }

      setProgress(publication === 'public' ? 'Publishing MakerOnline model publicly…' : 'Saving unpublished MakerOnline draft…');
      const saved = await request('submit', {
        publication,
        title: project.title.trim(),
        description: mdToHtml(project.description),
        source: Number(options.source || 1),
        originalUrl: String(options.originalUrl || '').trim(),
        license: Number(options.license ?? MAKERONLINE_LICENSE_MAP[project.license] ?? 3),
        categoryId: String(options.categoryId),
        permission: publication === 'public' ? 1 : Number(options.permission || 2),
        printMethod: Number(options.printMethod || 3),
        aiHelp: !!options.aiHelp,
        nsfw: !!options.nsfw,
        relatedKits: !!options.relatedKits,
        storeKitIds: options.storeKitIds || [],
        syncChina: !!options.syncChina,
        exclusive: !!options.exclusive,
        includePrintProfile: !!options.includePrintProfile,
        images: imageRecords,
        models: modelRecords,
        documents: documentRecords,
        printProfiles: profileRecords,
        printImages: profileImageRecords,
        printTitle: String(options.printTitle || project.profiles[0]?.name || project.title).trim(),
        printDescription: mdToHtml(options.printDescription || project.profiles[0]?.description || ''),
        tags: project.tags,
      });

      setProgress('Reading the saved MakerOnline model back…');
      const readback = await request(`status?id=${encodeURIComponent(saved.id)}`, null, 'GET');
      const model = readback.model || {};
      const info = model.mold_info || model.moldInfo || model.model || model;
      const readbackTitle = info.title || info.model_title || info.modelTitle || '';
      if (readbackTitle && String(readbackTitle) !== project.title.trim()) {
        throw new Error(`MakerOnline read-back returned a different title: ${readbackTitle}.`);
      }
      const readbackCategory = info.category_id ?? info.categoryId;
      if (readbackCategory != null && String(readbackCategory) !== String(options.categoryId)) {
        throw new Error(`MakerOnline read-back returned category ${readbackCategory} instead of ${options.categoryId}.`);
      }
      const readbackImages = info.images || model.images;
      if (Array.isArray(readbackImages) && readbackImages.length < imageRecords.length) {
        throw new Error(`MakerOnline read-back returned ${readbackImages.length} images after uploading ${imageRecords.length}.`);
      }
      const readbackFiles = info.files || model.files;
      if (Array.isArray(readbackFiles) && readbackFiles.length < modelRecords.length) {
        throw new Error(`MakerOnline read-back returned ${readbackFiles.length} raw model files after uploading ${modelRecords.length}.`);
      }
      setResult({ id: String(saved.id), state: saved.state, url: saved.url, verified: true });
      setStatus('done');
      reportBatch(batchRunId, 'success', `${saved.state} MakerOnline model saved and read back`, {
        publicationState: saved.state,
        url: saved.url,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message); setStatus('error'); reportBatch(batchRunId, 'error', message);
    } finally { setProgress(''); }
  };

  useEffect(() => {
    if (!batchRequest?.runId || handledBatchRun.current === batchRequest.runId) return;
    handledBatchRun.current = batchRequest.runId;
    submit(batchRequest.action === 'publish' || batchRequest.visibility === 'public' ? 'public' : 'draft', batchRequest.runId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchRequest?.runId]);

  return (
    <div className="border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="mp-card p-3" style={{ background: 'rgba(17,24,39,0.04)', border: '1px solid rgba(17,24,39,0.42)' }}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="mp-display tracking-wide text-[14px]">MAKERONLINE UPLOAD</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: simulate ? '#3A86FF' : '#111827', color: '#fff' }}>{simulate ? 'Simulation' : 'Real'}</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.15em] opacity-55">isolated desktop session</span>
        </div>
        {status === 'idle' && <><p className="text-[13px] mb-2.5 opacity-65">Connect through MakerOnline’s real sign-in page to upload.</p><button onClick={openConnections} className="mp-btn text-xs py-2 px-3"><Globe size={13} /> Connect MakerOnline</button></>}
        {status === 'connected' && (
          <>
            <div className="flex items-center gap-2 text-xs mb-2.5" style={{ color: '#3a8d68' }}><StatusDot status={active?.status || 'connected'} />{simulate ? 'Demo account (simulation only)' : <>Connected as <span className="mp-mono">{active?.label}</span></>}<button onClick={openConnections} className="mp-mono text-[11px] uppercase tracking-[0.15em] ml-1 opacity-60">manage</button></div>
            <p className="text-[12px] mb-2.5 leading-snug opacity-65">{simulate ? 'Demo simulation only—no files or metadata leave the app.' : 'Draft uploads real files and metadata but keeps the model unpublished. Public creates a real visible listing.'}</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => submit('draft')} className="mp-btn mp-btn-ghost text-xs py-2 px-3"><Save size={13} /> {simulate ? 'Simulate draft save' : 'Save unpublished draft'}</button>
              <button onClick={() => submit('public')} className="mp-btn text-xs py-2 px-3"><Send size={13} /> {simulate ? 'Simulate public publish' : 'Publish public (LIVE)'}</button>
              <a href={UPLOAD_URLS.makeronline} target="_blank" rel="noopener noreferrer" className="mp-mono text-[11px] uppercase tracking-[0.15em] px-2 py-2">Open MakerOnline upload</a>
            </div>
          </>
        )}
        {status === 'uploading' && <div className="flex items-center gap-2 text-xs py-1.5"><Loader size={14} className="mp-spin" /> {progress || 'Working…'}</div>}
        {status === 'done' && <><div className="flex items-center gap-2 text-xs mb-2" style={{ color: result?.demo ? '#3A86FF' : '#3a8d68' }}><Check size={14} />{result?.demo ? `Simulation complete — nothing uploaded (${result.state}).` : `${result?.state} MakerOnline model saved and read back.`}</div>{!result?.demo && result?.url && <a href={result.url} target="_blank" rel="noopener noreferrer" className="mp-card mp-mono text-[13px] p-2 mb-2 break-all block">{result.url}</a>}<button onClick={() => { setResult(null); setStatus('connected'); }} className="mp-mono text-[11px] uppercase tracking-[0.15em]">{result?.demo ? 'Clear simulated result' : 'Upload another'}</button></>}
        {status === 'error' && <><div className="text-[12px] p-2 mb-2 break-all" style={{ background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.3)', color: '#991b1b' }}>{error}</div><button onClick={() => setStatus(active || simulate ? 'connected' : 'idle')} className="mp-btn mp-btn-ghost text-xs py-1.5 px-3"><ArrowRight size={12} /> Back</button></>}
      </div>
    </div>
  );
}

function MyMiniFactoryUploadFlow({ platform, project, batchRequest, onBatchResult }) {
  const accounts = useAccounts();
  const openConnections = useOpenConnections();
  const active = accounts.getActive('mmf');
  const secret = active?.secret || '';
  const options = project.platforms?.mmf || {};
  const simulate = !!project.__demo;
  const [status, setStatus] = useState(active || simulate ? 'connected' : 'idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const handledBatchRun = useRef(null);

  const reportBatch = (batchRunId, state, detail, metadata = {}) => {
    if (batchRunId) onBatchResult?.({ runId: batchRunId, platformId: 'mmf', state, detail, ...metadata });
  };
  useEffect(() => {
    setStatus((current) => {
      if ((active || simulate) && current === 'idle') return 'connected';
      if (!active && !simulate && current === 'connected') return 'idle';
      return current;
    });
  }, [active, simulate]);

  const request = async (route, body, method = body == null ? 'GET' : 'POST') => {
    const response = await myMiniFactoryFetch(`${WORKER_URL}/api/v1/myminifactory/web/${route}`, {
      method,
      headers: body == null ? {} : { 'Content-Type': 'application/json' },
      body: body == null ? undefined : JSON.stringify(body),
    }, secret);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(myMiniFactoryResponseError(data, response.status, `MyMiniFactory ${route} failed`));
    return data;
  };
  // Read-only certification of an object this account already owns. It calls
  // the GET status route only, so it can never create or duplicate an object;
  // `Retry failed only` and the submit buttons stay untouched.
  const verifyExisting = async () => {
    let url = '';
    try { url = myMiniFactoryObjectUrl(options.verifyObjectId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setStatus('error'); return; }
    setStatus('uploading'); setError(''); setProgress(`Re-reading existing MyMiniFactory object ${options.verifyObjectId}…`);
    try {
      const { object } = await request(`status?url=${encodeURIComponent(url)}`, null, 'GET');
      const verified = verifyMyMiniFactoryObjectState({
        object,
        title: project.title,
        publication: options.publication || 'private',
        categoryIds: options.categoryIds || [],
        advanced: {
          licenseId: Number(options.licenseId || 5),
          printingTips: String(options.printingTips || ''),
          timeFrom: Number(options.timeFrom || 0),
          timeTo: Number(options.timeTo || 0),
          dimensions: String(options.dimensions || ''),
          dimensionsUnit: Number(options.dimensionsUnit || 0),
          technology: String(options.technology || ''),
          materialQuantity: String(options.materialQuantity || ''),
          supportFree: !!options.supportFree,
          remix: !!options.remix,
          remixParentIds: options.remixParentIds || [],
        },
      });
      setResult({
        id: String(options.verifyObjectId), state: verified.visibility, url, verified: true, readOnly: true,
        detail: `${verified.visibility} · ${verified.imageNames.length} images (ordered by ${verified.imageOrderSource}${verified.primaryImage ? `, cover ${verified.primaryImage}` : ''}) · ${verified.fileNames.length} files · categories ${verified.categoryIds.join('/')}${verified.remix ? ` · remix of ${verified.remixParentIds.join(', ')}` : ''}`,
      });
      setStatus('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause)); setStatus('error');
    } finally { setProgress(''); }
  };
  const projectFile = (source) => source.blob instanceof File && source.blob.name === source.name
    ? source.blob
    : new File([source.blob], source.name, { type: source.type || 'application/octet-stream' });
  const imageFile = async (image, index) => {
    const loaded = await loadImageFromDataUrl(image.dataUrl);
    const scale = Math.min(1, 2400 / Math.max(loaded.naturalWidth || loaded.width, loaded.naturalHeight || loaded.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((loaded.naturalWidth || loaded.width) * scale));
    canvas.height = Math.max(1, Math.round((loaded.naturalHeight || loaded.height) * scale));
    canvas.getContext('2d').drawImage(loaded, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 0.9);
    return new File([blob], `${index === 0 ? 'cover' : `gallery-${String(index).padStart(2, '0')}`}-${slugify(image.alt || project.title || 'model')}.jpg`, { type: 'image/jpeg' });
  };

  const submit = async (publication, batchRunId = null) => {
    const effectiveProject = { ...project, platforms: { ...project.platforms, mmf: { ...options, publication } } };
    const preflight = platformPreflight(platform, effectiveProject);
    if (preflight.errors.length) {
      const message = preflight.errors.join(' '); setError(message); setStatus('error'); reportBatch(batchRunId, 'error', message); return;
    }
    if (simulate) {
      setStatus('uploading'); setError(''); setProgress(`Simulating MyMiniFactory ${publication} upload…`);
      await new Promise((resolve) => setTimeout(resolve, 700));
      setResult({ id: 'demo', state: `simulated-${publication}`, demo: true }); setStatus('done'); setProgress('');
      reportBatch(batchRunId, 'success', `MyMiniFactory ${publication} simulated — nothing uploaded`, { publicationState: publication, simulated: true });
      return;
    }
    if (!secret || !isDesktopMyMiniFactorySession(secret)) {
      const message = 'Connect MyMiniFactory in ModelPrep Desktop before uploading.'; setError(message); setStatus('error'); reportBatch(batchRunId, 'error', message); return;
    }
    setStatus('uploading'); setError(''); setResult(null);
    let saved = null;
    try {
      const orderedImages = orderedPlatformImages(platform, project).slice(0, platform.maxImages || 20);
      const modelFiles = withoutExcluded(project.files.filter((file) => file.blob && MYMINIFACTORY_MODEL_FORMATS.includes(fileExt(file.name))), project.platforms?.mmf);
      if (!orderedImages.length) throw new Error('Choose a cover image before sending to MyMiniFactory.');
      if (!modelFiles.length) throw new Error('Add at least one MyMiniFactory-compatible object file.');
      setProgress('Preparing the MyMiniFactory upload form…');
      const prepared = await request('prepare', {}, 'POST');
      const imageRecords = [];
      for (let index = 0; index < orderedImages.length; index += 1) {
        setProgress(`Uploading MyMiniFactory image ${index + 1} of ${orderedImages.length}…`);
        imageRecords.push(await uploadMyMiniFactoryFile({ workerUrl: WORKER_URL, secret, uploadSessionId: prepared.uploadSessionId, role: 'image', file: await imageFile(orderedImages[index], index) }));
      }
      const fileRecords = [];
      for (let index = 0; index < modelFiles.length; index += 1) {
        setProgress(`Uploading MyMiniFactory object file ${index + 1} of ${modelFiles.length}…`);
        fileRecords.push(await uploadMyMiniFactoryFile({ workerUrl: WORKER_URL, secret, uploadSessionId: prepared.uploadSessionId, role: 'file', file: projectFile(modelFiles[index]) }));
      }
      setProgress(publication === 'public' ? 'Submitting the MyMiniFactory object for public review…' : 'Creating the private MyMiniFactory object…');
      saved = await request('submit', {
        uploadSessionId: prepared.uploadSessionId,
        publication,
        title: project.title.trim(),
        description: mdToHtml(project.description),
        tags: project.tags,
        categoryIds: options.categoryIds || [],
        images: imageRecords,
        files: fileRecords,
        licenseId: Number(options.licenseId || 5),
        printingTips: String(options.printingTips || ''),
        timeFrom: options.timeFrom === '' || options.timeFrom == null ? '' : Number(options.timeFrom),
        timeTo: options.timeTo === '' || options.timeTo == null ? '' : Number(options.timeTo),
        dimensions: String(options.dimensions || ''),
        dimensionsUnit: Number(options.dimensionsUnit || 0),
        technology: String(options.technology || ''),
        materialQuantity: String(options.materialQuantity || ''),
        supportFree: !!options.supportFree,
        remix: !!options.remix,
        remixParentIds: options.remixParentIds || [],
        confirmOriginalNoAi: !!options.confirmOriginalNoAi,
      });
      setProgress('Waiting for the saved MyMiniFactory files and metadata to finish attaching…');
      await waitForMyMiniFactoryReadback({
        read: async () => (await request(`status?url=${encodeURIComponent(saved.url)}`, null, 'GET')).object,
        expected: {
        title: project.title,
        publication,
        categoryIds: options.categoryIds || [],
        imageNames: imageRecords.map((image) => image.name),
        fileNames: modelFiles.map((file) => file.name),
        advanced: {
          licenseId: Number(options.licenseId || 5),
          printingTips: String(options.printingTips || ''),
          timeFrom: Number(options.timeFrom || 0),
          timeTo: Number(options.timeTo || 0),
          dimensions: String(options.dimensions || ''),
          dimensionsUnit: Number(options.dimensionsUnit || 0),
          technology: String(options.technology || ''),
          materialQuantity: String(options.materialQuantity || ''),
          supportFree: !!options.supportFree,
          remix: !!options.remix,
          remixParentIds: options.remixParentIds || [],
        },
        },
      });
      setResult({ id: String(saved.id), state: saved.state, url: saved.url, verified: true }); setStatus('done');
      reportBatch(batchRunId, 'success', `${saved.state} MyMiniFactory object saved and read back`, { publicationState: saved.state, url: saved.url });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      // A submit can create a retained private object before a later read-back
      // detects a mismatch. Preserve that safe receipt so it is auditable and
      // never invites a duplicate retry.
      if (saved?.id && saved?.url) setResult({ id: String(saved.id), state: saved.state, url: saved.url, verified: false });
      setError(message); setStatus('error');
      reportBatch(batchRunId, 'error', message, saved?.url ? { publicationState: saved.state, url: saved.url, retained: true } : undefined);
    } finally { setProgress(''); }
  };

  useEffect(() => {
    if (!batchRequest?.runId || handledBatchRun.current === batchRequest.runId) return;
    handledBatchRun.current = batchRequest.runId;
    submit(batchRequest.action === 'publish' || batchRequest.visibility === 'public' ? 'public' : 'private', batchRequest.runId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchRequest?.runId]);

  return (
    <div className="border-t pt-3" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
      <div className="mp-card p-3" style={{ background: 'rgba(79,178,134,0.06)', border: '1px solid rgba(79,178,134,0.5)' }}>
        <div className="flex items-center gap-2 mb-2 flex-wrap"><span className="mp-display tracking-wide text-[14px]">MYMINIFACTORY UPLOAD</span><span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: simulate ? '#3A86FF' : '#4FB286', color: '#fff' }}>{simulate ? 'Simulation' : 'Real'}</span><span className="mp-mono text-[11px] uppercase tracking-[0.15em] opacity-55">isolated desktop session</span></div>
        {status === 'idle' && <><p className="text-[13px] mb-2.5 opacity-65">Connect through MyMiniFactory’s real sign-in page to upload.</p><button onClick={openConnections} className="mp-btn text-xs py-2 px-3"><Globe size={13} /> Connect MyMiniFactory</button></>}
        {status === 'connected' && <><div className="flex items-center gap-2 text-xs mb-2.5" style={{ color: '#3a8d68' }}><StatusDot status={active?.status || 'connected'} />{simulate ? 'Demo account (simulation only)' : <>Connected as <span className="mp-mono">{active?.label}</span></>}<button onClick={openConnections} className="mp-mono text-[11px] uppercase tracking-[0.15em] ml-1 opacity-60">manage</button></div><p className="text-[12px] mb-2.5 leading-snug opacity-65">{simulate ? 'Demo simulation only—no files or metadata leave the app.' : 'Private uploads real files but keeps the object private. Public submits a visible object into MyMiniFactory’s review flow.'}</p><div className="flex gap-2 flex-wrap">{!simulate && options.verifyObjectId && <button onClick={verifyExisting} className="mp-btn mp-btn-ghost text-xs py-2 px-3"><Check size={13} /> Verify existing object (read-only)</button>}<button onClick={() => submit('private')} className="mp-btn mp-btn-ghost text-xs py-2 px-3"><Bookmark size={13} /> {simulate ? 'Simulate private object' : 'Create private object'}</button><button onClick={() => submit('public')} className="mp-btn text-xs py-2 px-3"><Send size={13} /> {simulate ? 'Simulate public submit' : 'Submit public (LIVE)'}</button><a href={UPLOAD_URLS.mmf} target="_blank" rel="noopener noreferrer" className="mp-mono text-[11px] uppercase tracking-[0.15em] px-2 py-2">Open MyMiniFactory upload</a></div></>}
        {status === 'uploading' && <div className="flex items-center gap-2 text-xs py-1.5"><Loader size={14} className="mp-spin" /> {progress || 'Working…'}</div>}
        {status === 'done' && <><div className="flex items-center gap-2 text-xs mb-2" style={{ color: result?.demo ? '#3A86FF' : '#3a8d68' }}><Check size={14} />{result?.demo ? `Simulation complete — nothing uploaded (${result.state}).` : result?.readOnly ? `Existing ${result.state} MyMiniFactory object ${result.id} re-read and verified.` : `${result?.state} MyMiniFactory object saved and read back.`}</div>{result?.readOnly && result?.detail && <p className="mp-mono text-[12px] mb-2 break-all opacity-70">{result.detail}</p>}{!result?.demo && result?.url && <a href={result.url} target="_blank" rel="noopener noreferrer" className="mp-card mp-mono text-[13px] p-2 mb-2 break-all block">{result.url}</a>}<button onClick={() => { setResult(null); setStatus('connected'); }} className="mp-mono text-[11px] uppercase tracking-[0.15em]">{result?.demo ? 'Clear simulated result' : result?.readOnly ? 'Done' : 'Upload another'}</button></>}
        {status === 'error' && <><div className="text-[12px] p-2 mb-2 break-all" style={{ background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.3)', color: '#991b1b' }}>{error}</div><button onClick={() => setStatus(active || simulate ? 'connected' : 'idle')} className="mp-btn mp-btn-ghost text-xs py-1.5 px-3"><ArrowRight size={12} /> Back</button></>}
      </div>
    </div>
  );
}

// =====================================================================
// ACCOUNT CONNECTIONS — centralized multi-account sign-in (Settings modal)
// =====================================================================
const ACCT_STATUS = {
  connected: { dot: '#1a7f37', label: 'Connected' },
  checking:  { dot: '#3A86FF', label: 'Checking saved session' },
  reconnect: { dot: '#d97706', label: 'Reconnect needed' },
  error:     { dot: '#dc2626', label: 'Error' },
  unknown:   { dot: 'rgba(21,23,28,0.3)', label: 'Not verified' },
};
function accountIsUsable(account) {
  return !!account?.secret && account.status === 'connected';
}
const DESKTOP_CONNECT_METHODS = {
  makerworld: 'connectMakerWorld',
  printables: 'connectPrintables',
  cults: 'connectCults',
  nexprint: 'connectNexprint',
  creality: 'connectCreality',
  makeronline: 'connectMakerOnline',
  mmf: 'connectMyMiniFactory',
  makeroad: 'connectMakerRoad',
  thangs: 'connectThangs',
  thingiverse: 'connectThingiverse',
};
function desktopIdentityLabel(platform, user, fallback) {
  if (!user || typeof user !== 'object') return fallback || PLATFORMS.find((item) => item.id === platform)?.name || platform;
  if (platform === 'makerworld' && user.handle) return user.name ? `${user.name} (@${user.handle})` : `@${user.handle}`;
  if (platform === 'printables' && user.handle) return user.publicUsername ? `${user.publicUsername} (@${user.handle})` : `@${user.handle}`;
  return String(user.nickname || user.username || user.email || user.handle || user.id || fallback || platform);
}
function isDesktopManagedAccount(platform, secret) {
  return (platform === 'makerworld' && isDesktopMakerWorldSession(secret))
    || (platform === 'printables' && isDesktopPrintablesSession(secret))
    || (platform === 'cults' && isDesktopCultsSession(secret))
    || (platform === 'nexprint' && isDesktopNexprintSession(secret))
    || (platform === 'creality' && isDesktopCrealitySession(secret))
    || (platform === 'makeronline' && isDesktopMakerOnlineSession(secret))
    || (platform === 'mmf' && isDesktopMyMiniFactorySession(secret))
    || (platform === 'makeroad' && isDesktopMakerRoadSession(secret))
    || (platform === 'thangs' && isDesktopThangsSession(secret))
    || (platform === 'thingiverse' && isDesktopThingiverseSession(secret));
}
function StatusDot({ status }) {
  const s = ACCT_STATUS[status] || ACCT_STATUS.unknown;
  return <span title={s.label} className="inline-block rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: s.dot }} />;
}

// The header "Accounts" button: shows how many platforms have an active connection.
function ConnectionsButton({ onOpen }) {
  useAccounts();
  const connected = CONNECTABLE.filter((id) => accountIsUsable(getActive(id))).length;
  return (
    <button onClick={() => onOpen('accounts')} className="mp-btn mp-btn-ghost text-xs py-2 px-3" title="Settings — sign-ins, AI, and more">
      <Settings size={13} /> Settings
      {connected > 0 && <span className="ml-1 mp-mono text-[12px]" style={{ color: '#1a7f37' }}>{connected}</span>}
    </button>
  );
}

// Unified Settings: everything that's configured once and remembered across runs —
// platform sign-ins (Accounts), AI provider/key (AI), and build/info + reset (About).
// All of it persists in localStorage (accounts store + ai-config), so it survives reloads.
function SettingsModal({ open, onClose, tab, setTab }) {
  useAccounts();
  if (!open) return null;
  const desktop = (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop) ? window.modelprepDesktop : null;
  const missingDesktopPlatforms = desktop
    ? CONNECTABLE.filter((id) => typeof desktop[DESKTOP_CONNECT_METHODS[id]] !== 'function')
    : [];
  const meta = (id) => PLATFORMS.find((p) => p.id === id) || { id, name: id, dot: '#888' };
  const connectedCount = CONNECTABLE.filter((id) => accountIsUsable(getActive(id))).length;
  const accountPlatformOrder = [...CONNECTABLE].sort((left, right) => {
    const rank = (id) => {
      const status = getActive(id)?.status;
      return status === 'reconnect' || status === 'error' ? 0 : status === 'checking' ? 1 : 2;
    };
    return rank(left) - rank(right);
  });
  const aiPrimary = readAiConfig().primary;
  const TABS = [
    { id: 'accounts', label: 'Accounts', icon: User, badge: connectedCount || null },
    { id: 'ai', label: 'AI', icon: Sparkles, badge: aiPrimary ? '•' : null },
    { id: 'defaults', label: 'Defaults', icon: Globe, badge: null },
    { id: 'about', label: 'About', icon: Info, badge: null },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-auto" style={{ background: 'rgba(21,23,28,0.45)' }} onClick={onClose}>
      <div className="mp-card w-full max-w-2xl my-8" style={{ background: '#EDE9DE' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10" style={{ borderColor: 'rgba(21,23,28,0.12)', background: '#EDE9DE' }}>
          <div className="flex items-center gap-2"><Settings size={16} /><span className="mp-display text-[18px]">Settings</span></div>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {/* Tab strip */}
        {/* Wraps rather than clipping the last tab on a narrow window. */}
        <div className="flex flex-wrap gap-1 px-4 pt-3 border-b" style={{ borderColor: 'rgba(21,23,28,0.12)' }}>
          {TABS.map((t) => {
            const Icon = t.icon; const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-3 py-2 mp-mono text-[12px] uppercase tracking-[0.12em] flex items-center gap-1.5 -mb-px border-b-2 transition"
                style={{ borderColor: on ? '#FF5722' : 'transparent', color: on ? '#15171C' : 'rgba(21,23,28,0.5)' }}>
                <Icon size={13} /> {t.label}
                {t.badge != null && <span className="mp-mono text-[10px]" style={{ color: '#1a7f37' }}>{t.badge}</span>}
              </button>
            );
          })}
        </div>
        <div className="p-4 space-y-3 max-h-[68vh] overflow-auto">
          {tab === 'accounts' && (
            <>
              <p className="text-[12px]" style={{ color: 'rgba(21,23,28,0.66)' }}>Each sign-in stays in its own encrypted, isolated session — separate from Chrome. If a platform’s session expires, Reconnect quietly refreshes it and only opens a sign-in window when it has to.</p>
              {!!missingDesktopPlatforms.length && (
                <div role="alert" className="mp-card p-3 text-[12px] leading-relaxed" style={{ background: 'rgba(185,28,28,0.06)', borderColor: 'rgba(185,28,28,0.35)', color: '#991b1b' }}>
                  <strong>Desktop app update required.</strong> This page is newer than the running ModelPrep desktop shell, so {missingDesktopPlatforms.map((id) => meta(id).name).join(', ')} cannot connect. Quit every ModelPrep window and launch the current app build.
                </div>
              )}
              {accountPlatformOrder.map((id) => <PlatformConnections key={id} platform={meta(id)} />)}
              <div className="mp-card p-3" style={{ background: 'rgba(21,23,28,0.03)' }}>
                <div className="text-[11px] mp-mono uppercase tracking-[0.12em] mb-1.5" style={{ color: 'rgba(21,23,28,0.66)' }}>Coming soon</div>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORMS.filter((p) => !CONNECTABLE.includes(p.id)).map((p) => (
                    <span key={p.id} className="mp-pill text-[11px] flex items-center" style={{ background: 'rgba(21,23,28,0.06)', color: 'rgba(21,23,28,0.66)' }}>
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: p.dot }} />{p.name}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
          {tab === 'ai' && (
            <>
              <AiSettings />
            </>
          )}
          {tab === 'defaults' && <SettingsDefaults />}
          {tab === 'about' && <SettingsAbout onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}

// Defaults tab — which platforms a NEW project starts with enabled.
function SettingsDefaults() {
  const initial = getDefaultPlatforms() || PLATFORMS.filter(p => initialProject.platforms[p.id]?.enabled).map(p => p.id);
  const [sel, setSel] = useState(initial);
  const toggle = (id) => {
    const next = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
    setSel(next); setDefaultPlatforms(next);
  };
  const setAll = (on) => { const next = on ? PLATFORMS.map(p => p.id) : []; setSel(next); setDefaultPlatforms(next); };
  return (
    <div className="space-y-2">
      <p className="text-[12px]" style={{ color: 'rgba(21,23,28,0.66)' }}>Pick which platforms a new project starts with enabled, so you don't toggle them every time. Saved in this browser; applies to <strong>new</strong> and imported projects.</p>
      <div className="flex gap-2">
        <button onClick={() => setAll(true)} className="mp-btn mp-btn-ghost text-[12px] py-1.5 px-3"><Check size={12} /> All</button>
        <button onClick={() => setAll(false)} className="mp-btn mp-btn-ghost text-[12px] py-1.5 px-3"><X size={12} /> None</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {PLATFORMS.map(p => {
          const on = sel.includes(p.id);
          return (
            <button key={p.id} onClick={() => toggle(p.id)} className="mp-card flex items-center gap-2 p-2 text-left transition" style={{ background: on ? 'rgba(255,87,34,0.06)' : 'rgba(21,23,28,0.02)', borderColor: on ? 'rgba(255,87,34,0.3)' : 'rgba(21,23,28,0.1)' }}>
              <span className="w-4 h-4 flex items-center justify-center flex-shrink-0" style={{ background: on ? '#FF5722' : 'transparent', border: `1px solid ${on ? '#FF5722' : 'rgba(21,23,28,0.3)'}`, color: '#fff' }}>{on && <Check size={11} />}</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.dot }} />
              <span className="text-[13px]">{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// About tab — build info + a hard reset for the locally-stored settings/accounts.
function SettingsAbout({ onClose }) {
  const acc = useAccounts();
  const desktop = (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop) ? window.modelprepDesktop : null;
  const clearAll = async () => {
    try {
      if (desktop?.disconnectMakerWorld) await desktop.disconnectMakerWorld();
      if (desktop?.disconnectPrintables) await desktop.disconnectPrintables();
      if (desktop?.disconnectNexprint) await desktop.disconnectNexprint();
      if (desktop?.disconnectCreality) await desktop.disconnectCreality();
      if (desktop?.disconnectMakerOnline) await desktop.disconnectMakerOnline();
      if (desktop?.disconnectMyMiniFactory) await desktop.disconnectMyMiniFactory();
      if (desktop?.disconnectCults) {
        for (const account of acc.getAccounts('cults')) {
          const accountId = desktopCultsAccountId(account.secret);
          if (accountId) await desktop.disconnectCults(accountId);
        }
      }
      for (const id of CONNECTABLE) for (const a of acc.getAccounts(id)) acc.removeAccount(id, a.id);
      localStorage.removeItem(AI_CONFIG_KEY);
      localStorage.removeItem(DEFAULT_PLATFORMS_KEY);
    } catch { /* ignore */ }
    onClose();
  };
  return (
    <div className="space-y-3 text-[13px]" style={{ color: 'rgba(21,23,28,0.8)' }}>
      <div className="mp-card p-3 space-y-1">
        <div className="mp-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'rgba(21,23,28,0.66)' }}>Build</div>
        <div className="mp-mono text-[12px]">{BUILD_LABEL}</div>
      </div>
      <p className="text-[12px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
        {desktop
          ? `All direct-platform sessions are isolated and encrypted in the desktop app (bridge v${desktop.bridgeVersion || 'legacy'}); AI settings are saved in this renderer profile. Clearing removes them from this device.`
          : 'Your sign-ins and AI settings are saved in this browser only and persist across runs. Clearing removes them from this device.'}
      </p>
      {desktop && <UpdatePanel desktop={desktop} />}
      {desktop && <DiagnosticsPanel desktop={desktop} />}
      <button onClick={clearAll} className="mp-btn mp-btn-ghost text-xs py-2 px-3" style={{ color: '#b91c1c' }}>
        <Trash2 size={13} /> Clear saved accounts &amp; AI settings
      </button>
    </div>
  );
}

// Auto-update status for the packaged app: shows checking/downloading/ready and
// offers Restart to install. Desktop-only; silent when there's nothing to do.
function UpdatePanel({ desktop }) {
  const [state, setState] = useState({ status: 'idle' });
  useEffect(() => {
    if (!desktop?.updateStatus) return undefined;
    desktop.updateStatus().then((s) => s && setState(s)).catch(() => {});
    const off = desktop.onUpdateState?.((s) => setState(s || { status: 'idle' }));
    return () => off?.();
  }, [desktop]);
  if (!desktop?.updateStatus) return null;
  const label = {
    checking: 'Checking for updates…',
    downloading: `Downloading update${state.percent ? ` (${state.percent}%)` : ''}…`,
    ready: `Update ${state.version || ''} ready`,
    current: 'ModelPrep is up to date',
  }[state.status];
  return (
    <div className="mp-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="mp-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'rgba(21,23,28,0.66)' }}>Updates</div>
        <button onClick={() => desktop.checkForUpdate?.()} className="mp-mono text-[10px] underline" style={{ color: '#FF5722' }}>check now</button>
      </div>
      <div className="text-[12px]" style={{ color: 'rgba(21,23,28,0.7)' }}>{label || 'Automatic updates are on.'}</div>
      {state.status === 'ready' && (
        <button onClick={() => desktop.installUpdate?.()} className="mp-btn text-[11px] py-1.5 px-2">Restart to update</button>
      )}
    </div>
  );
}

// Beta diagnostics: shows the local error count, lets the user export the
// sanitized log or open a prefilled problem report. Desktop-only.
function DiagnosticsPanel({ desktop }) {
  const [diag, setDiag] = useState({ count: 0, entries: [] });
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!desktop?.getDiagnostics) return;
    desktop.getDiagnostics().then((value) => setDiag(value || { count: 0, entries: [] })).catch(() => {});
  }, [desktop]);
  if (!desktop?.getDiagnostics) return null;
  const recent = diag.entries?.slice(-3).reverse() || [];
  return (
    <div className="mp-card p-3 space-y-2">
      <div className="mp-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
        Diagnostics · {diag.count} recorded
      </div>
      <p className="text-[12px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
        Errors are stored locally and sanitized (no cookies, tokens, or signed URLs). Nothing is sent unless you export or report.
      </p>
      {recent.length > 0 && (
        <ul className="text-[11px] space-y-0.5" style={{ color: 'rgba(21,23,28,0.66)' }}>
          {recent.map((e, i) => (
            <li key={i} className="truncate mp-mono">{e.source}/{e.kind}: {String(e.message || '').split('\n')[0]}</li>
          ))}
        </ul>
      )}
      <textarea
        aria-label="Problem description"
        className="mp-card text-[12px] p-2 w-full"
        rows={2}
        placeholder="Describe a problem to report (optional)…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          onClick={async () => { const r = await desktop.exportDiagnostics(); setMsg(r?.ok ? `Saved to ${r.path}` : ''); }}
          className="mp-btn mp-btn-ghost text-[11px] py-1.5 px-2"
        >Export diagnostics</button>
        <button
          onClick={async () => { await desktop.reportProblem({ note, build: BUILD_LABEL }); setMsg('Opened a prefilled report in your browser.'); }}
          className="mp-btn text-[11px] py-1.5 px-2"
        >Report a problem</button>
      </div>
      {msg && <div className="text-[11px]" style={{ color: '#1a7f37' }}>{msg}</div>}
    </div>
  );
}

function PlatformConnections({ platform }) {
  const acc = useAccounts();
  const accounts = acc.getAccounts(platform.id);
  const active = acc.getActive(platform.id);
  const [adding, setAdding] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);
  const [accountNotice, setAccountNotice] = useState('');
  const desktop = (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop) ? window.modelprepDesktop : null;
  const showForm = adding || accounts.length === 0;
  useEffect(() => {
    if (platform.id !== 'makerworld' || !desktop?.storeMakerWorldSession) return;
    for (const account of accounts) {
      if (typeof account.secret !== 'string' || isDesktopMakerWorldSession(account.secret)) continue;
      desktop.storeMakerWorldSession(account.secret)
        .then((result) => {
          if (result?.ok) acc.updateAccount('makerworld', account.id, { secret: DESKTOP_MAKERWORLD_SECRET, status: 'connected' });
        })
        .catch(() => {});
      break;
    }
  }, [platform.id, accounts, desktop, acc]);
  const refreshMakerWorld = async (account) => {
    setRefreshingId(account.id); setAccountNotice('');
    try {
      const response = await makerWorldFetch(`${WORKER_URL}/api/v1/makerworld/web/refresh`, {
        method: 'POST', headers: { 'X-MW-Cookie': account.secret },
      }, account.secret);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.cookie) throw new Error(makerWorldResponseError(data, response.status, 'Session refresh failed'));
      acc.updateAccount('makerworld', account.id, {
        secret: isDesktopMakerWorldSession(account.secret) ? DESKTOP_MAKERWORLD_SECRET : data.cookie,
        status: 'connected',
      });
      setAccountNotice(`Refreshed ${account.label}.`);
    } catch (error) {
      acc.updateAccount('makerworld', account.id, { status: 'reconnect' });
      setAccountNotice(error instanceof Error ? error.message : String(error));
    } finally { setRefreshingId(null); }
  };
  const reconnectAccount = async (account) => {
    if (platform.id === 'cults' && desktop?.connectCults && !isDesktopCultsSession(account.secret)) {
      setRefreshingId(account.id);
      setAccountNotice('Complete the Cults3D sign-in and browser security check to reconnect.');
      try {
        const result = await desktop.connectCults({ label: account.label });
        if (!result?.ok || !result.accountId) throw new Error(result?.error || 'Cults3D sign-in was not completed.');
        acc.updateAccount('cults', account.id, {
          label: result.label || account.label,
          secret: desktopCultsSecret(result.accountId),
          status: 'connected',
        });
        acc.setActive('cults', account.id);
        setAdding(false);
        setAccountNotice('Cults3D is connected and ready.');
      } catch (error) {
        acc.updateAccount('cults', account.id, { status: 'reconnect' });
        setAccountNotice(error instanceof Error ? error.message : String(error));
      } finally { setRefreshingId(null); }
      return;
    }
    if (!desktop || !isDesktopManagedAccount(platform.id, account.secret)) {
      setAdding(true);
      setAccountNotice('Sign in again below to reconnect this account.');
      return;
    }
    setRefreshingId(account.id);
    setAccountNotice('Checking the saved encrypted session…');
    try {
      let result = typeof desktop.recoverAccount === 'function'
        ? await desktop.recoverAccount(platform.id, platform.id === 'cults' ? desktopCultsAccountId(account.secret) : '')
        : { ok: false, needsInteractive: true };
      if (!result?.ok && result?.needsInteractive) {
        const method = DESKTOP_CONNECT_METHODS[platform.id];
        if (!method || typeof desktop[method] !== 'function') throw new Error(`Reconnect is unavailable in this ModelPrep desktop build.`);
        setAccountNotice(`The saved ${platform.name} session expired. Complete the sign-in window to continue.`);
        result = platform.id === 'cults'
          ? await desktop[method]({ accountId: desktopCultsAccountId(account.secret), label: account.label })
          : await desktop[method]();
      }
      if (!result?.ok) throw new Error(result?.error || `${platform.name} sign-in was not completed.`);
      acc.updateAccount(platform.id, account.id, {
        label: desktopIdentityLabel(platform.id, result.user, account.label),
        ...(platform.id === 'cults' && result.accountId ? { secret: desktopCultsSecret(result.accountId) } : {}),
        status: 'connected',
      });
      acc.setActive(platform.id, account.id);
      setAdding(false);
      setAccountNotice(`${platform.name} is connected and ready.`);
    } catch (error) {
      acc.updateAccount(platform.id, account.id, { status: 'reconnect' });
      setAccountNotice(error instanceof Error ? error.message : String(error));
    } finally { setRefreshingId(null); }
  };
  const removePlatformAccount = async (account) => {
    if (platform.id === 'makerworld' && desktop?.disconnectMakerWorld && isDesktopMakerWorldSession(account.secret)) {
      try { await desktop.disconnectMakerWorld(); } catch { /* still remove the local marker */ }
    }
    if (platform.id === 'printables' && desktop?.disconnectPrintables && isDesktopPrintablesSession(account.secret)) {
      try { await desktop.disconnectPrintables(); } catch { /* still remove the local marker */ }
    }
    if (platform.id === 'cults' && desktop?.disconnectCults && isDesktopCultsSession(account.secret)) {
      try { await desktop.disconnectCults(desktopCultsAccountId(account.secret)); } catch { /* still remove the local marker */ }
    }
    if (platform.id === 'nexprint' && desktop?.disconnectNexprint && isDesktopNexprintSession(account.secret)) {
      try { await desktop.disconnectNexprint(); } catch { /* still remove the local marker */ }
    }
    if (platform.id === 'creality' && desktop?.disconnectCreality && isDesktopCrealitySession(account.secret)) {
      try { await desktop.disconnectCreality(); } catch { /* still remove the local marker */ }
    }
    if (platform.id === 'makeronline' && desktop?.disconnectMakerOnline && isDesktopMakerOnlineSession(account.secret)) {
      try { await desktop.disconnectMakerOnline(); } catch { /* still remove the local marker */ }
    }
    if (platform.id === 'mmf' && desktop?.disconnectMyMiniFactory && isDesktopMyMiniFactorySession(account.secret)) {
      try { await desktop.disconnectMyMiniFactory(); } catch { /* still remove the local marker */ }
    }
    if (platform.id === 'makeroad' && desktop?.disconnectMakerRoad && isDesktopMakerRoadSession(account.secret)) {
      try { await desktop.disconnectMakerRoad(); } catch { /* still remove marker */ }
    }
    if (platform.id === 'thangs' && desktop?.disconnectThangs && isDesktopThangsSession(account.secret)) { try { await desktop.disconnectThangs(); } catch {} }
    if (platform.id === 'thingiverse' && desktop?.disconnectThingiverse && isDesktopThingiverseSession(account.secret)) { try { await desktop.disconnectThingiverse(); } catch {} }
    acc.removeAccount(platform.id, account.id);
  };
  return (
    <section className="mp-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: platform.dot }} />
        <span className="mp-display text-[15px]">{platform.name}</span>
        {accounts.length > 0 && <span className="mp-mono text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>{accounts.length} account{accounts.length > 1 ? 's' : ''}</span>}
      </div>
      {accounts.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-2 text-[13px] mp-card p-2" style={{ background: a.id === active?.id ? 'rgba(26,127,55,0.06)' : 'rgba(21,23,28,0.03)' }}>
          <StatusDot status={a.status} />
          <span className="flex-1 min-w-[150px] truncate">{a.label}</span>
          <span className="mp-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: (ACCT_STATUS[a.status] || ACCT_STATUS.unknown).dot }}>
            {(ACCT_STATUS[a.status] || ACCT_STATUS.unknown).label}
          </span>
          {a.id === active?.id
            ? <span className="mp-pill text-[10px]" style={{ background: 'rgba(26,127,55,0.15)', color: '#1a7f37' }}>Active</span>
            : <button onClick={() => acc.setActive(platform.id, a.id)} className="mp-mono text-[11px] underline" style={{ color: '#FF5722' }}>Use</button>}
          {['reconnect', 'error', 'unknown'].includes(a.status) && (
            <button
              onClick={() => reconnectAccount(a)}
              disabled={refreshingId === a.id}
              className="mp-btn text-[11px] py-1 px-2 min-h-[32px] disabled:opacity-40"
            >
              {refreshingId === a.id ? <><Loader size={11} className="mp-spin" /> Checking…</> : <><RefreshCw size={11} /> Reconnect</>}
            </button>
          )}
          {platform.id === 'makerworld' && typeof a.secret === 'string' && a.secret.includes('refreshToken=') && (
            <button onClick={() => refreshMakerWorld(a)} disabled={refreshingId === a.id} className="mp-mono text-[10px] underline disabled:opacity-40" style={{ color: 'rgba(21,23,28,0.66)' }}>
              {refreshingId === a.id ? 'refreshing…' : 'refresh session'}
            </button>
          )}
          <button onClick={() => removePlatformAccount(a)} aria-label="Remove account" className="opacity-50 hover:opacity-100"><Trash2 size={13} /></button>
        </div>
      ))}
      {accountNotice && <div role="status" className="text-[11px]" style={{ color: /connected|ready|refreshed/i.test(accountNotice) ? '#1a7f37' : /checking|complete the sign-in/i.test(accountNotice) ? '#8A4B08' : '#B91C1C' }}>{accountNotice}</div>}
      {accounts.some((account) => ['reconnect', 'error'].includes(account.status)) && (
        <p className="text-[11px] opacity-60">Reconnect checks the saved encrypted session first. A sign-in window opens only if {platform.name} rejects it.</p>
      )}
      {platform.id === 'cults' && (
        <p className="text-[11px] opacity-60">Cults3D signs in through a ModelPrep window and publishes from that same in-app browser session, so it stays past Cloudflare without any extension.</p>
      )}
      {showForm
        ? <ConnectForm platform={platform} onDone={() => setAdding(false)} canCancel={accounts.length > 0} />
        : <button onClick={() => setAdding(true)} className="mp-btn mp-btn-ghost text-[11px] py-1.5 px-2"><Plus size={11} /> Add account</button>}
    </section>
  );
}

// Platform-specific "add account" form (different sign-in per platform).
function ConnectForm({ platform, onDone, canCancel }) {
  const acc = useAccounts();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [label, setLabel] = useState('');
  const [cookie, setCookie] = useState('');
  const [code, setCode] = useState('');
  const [needCode, setNeedCode] = useState(false); // MakerWorld emailed a verification code
  const [tfaKey, setTfaKey] = useState('');
  const desktop = (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop) ? window.modelprepDesktop : null;
  const inputCls = 'mp-card text-[13px] p-2 w-full';

  if (platform.id === 'makeroad') {
    const connect = async () => {
      setBusy(true); setErr('');
      try {
        if (!desktop?.connectMakerRoad) throw new Error('MakerRoad one-click sign-in requires the current ModelPrep desktop app.');
        const result = await desktop.connectMakerRoad();
        if (!result?.ok) throw new Error(result?.error || 'MakerRoad sign-in was cancelled.');
        const response = await makerRoadFetch(`${WORKER_URL}/api/v1/makeroad/web/whoami`, {}, DESKTOP_MAKEROAD_SECRET);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(makerRoadResponseError(data, response.status, 'MakerRoad session check failed'));
        for (const account of acc.getAccounts('makeroad')) acc.removeAccount('makeroad', account.id);
        acc.addAccount('makeroad', { label: label.trim() || result.user?.nickname || 'MakerRoad', secret: DESKTOP_MAKEROAD_SECRET, status: 'connected' });
        onDone();
      } catch (error) { setErr(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); }
    };
    return <div className="space-y-1.5"><input className={inputCls} placeholder="Account name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} /><button disabled={busy || !desktop?.connectMakerRoad} onClick={connect} className="mp-btn text-sm py-2 px-4 w-full disabled:opacity-40">{busy ? 'Waiting for MakerRoad sign-in…' : 'Sign in via MakerRoad window (desktop)'}</button><p className="text-[11px] opacity-55">The authenticated cookies remain in an isolated encrypted desktop session.</p>{err && <div className="text-[11px] text-red-700">{err}</div>}{canCancel && <button onClick={onDone} className="mp-mono text-[11px] underline">Cancel</button>}</div>;
  }

  if (platform.id === 'thangs') {
    const connect = async () => { setBusy(true); setErr(''); try { if (!desktop?.connectThangs) throw new Error('Thangs sign-in requires the current ModelPrep desktop app.'); const result = await desktop.connectThangs(); if (!result?.ok) throw new Error(result?.error || 'Thangs sign-in was cancelled.'); const response = await thangsFetch(`${WORKER_URL}/api/v1/thangs/web/whoami`, {}, DESKTOP_THANGS_SECRET); const data = await response.json().catch(() => ({})); if (!response.ok || !data.ok) throw new Error(thangsResponseError(data, response.status, 'Thangs session check failed')); for (const account of acc.getAccounts('thangs')) acc.removeAccount('thangs', account.id); acc.addAccount('thangs', { label: label.trim() || 'Thangs', secret: DESKTOP_THANGS_SECRET, status: 'connected' }); onDone(); } catch (error) { setErr(error.message); } finally { setBusy(false); } };
    return <div className="space-y-1.5"><input className={inputCls} placeholder="Account name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} /><button disabled={busy || !desktop?.connectThangs} onClick={connect} className="mp-btn text-sm py-2 px-4 w-full disabled:opacity-40">{busy ? 'Waiting for Thangs sign-in…' : 'Sign in via Thangs window (desktop)'}</button><p className="text-[11px] opacity-55">The signed-in session stays encrypted and isolated in the desktop app.</p>{err && <p className="text-[11px] text-red-700">{err}</p>}{canCancel && <button onClick={onDone}>Cancel</button>}</div>;
  }

  if (platform.id === 'thingiverse') {
    const connect = async () => { setBusy(true); setErr(''); try { if (!desktop?.connectThingiverse) throw new Error('Thingiverse sign-in requires the current ModelPrep desktop app.'); const result = await desktop.connectThingiverse(); if (!result?.ok) throw new Error(result?.error || 'Thingiverse sign-in was cancelled.'); const response = await thingiverseFetch(`${WORKER_URL}/api/v1/thingiverse/web/whoami`, {}, DESKTOP_THINGIVERSE_SECRET); const data = await response.json().catch(() => ({})); if (!response.ok || !data.ok) throw new Error(thingiverseResponseError(data, response.status, 'Thingiverse session check failed')); for (const account of acc.getAccounts('thingiverse')) acc.removeAccount('thingiverse', account.id); acc.addAccount('thingiverse', { label: label.trim() || 'Thingiverse', secret: DESKTOP_THINGIVERSE_SECRET, status: 'connected' }); onDone(); } catch (error) { setErr(error.message); } finally { setBusy(false); } };
    return <div className="space-y-1.5"><input className={inputCls} placeholder="Account name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} /><button disabled={busy || !desktop?.connectThingiverse} onClick={connect} className="mp-btn text-sm py-2 px-4 w-full disabled:opacity-40">{busy ? 'Waiting for Thingiverse sign-in…' : 'Sign in via Thingiverse window (desktop)'}</button><p className="text-[11px] opacity-55">The isolated Thingiverse session supports direct draft-first upload. Public publishing remains an explicit action.</p>{err && <p className="text-[11px] text-red-700">{err}</p>}{canCancel && <button onClick={onDone}>Cancel</button>}</div>;
  }

  const finishMw = async (rawCookie) => {
    setBusy(true); setErr('');
    try {
      const res = await makerWorldFetch(
        `${WORKER_URL}/api/v1/makerworld/web/check`,
        { headers: { 'X-MW-Cookie': rawCookie } },
        rawCookie,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('Session not valid — sign in again or paste a current MakerWorld token.');
      // Auto-label from the MakerWorld profile (handle/name); a typed label overrides it.
      let autoLabel = label.trim();
      if (!autoLabel) {
        try {
          const me = await (await makerWorldFetch(
            `${WORKER_URL}/api/v1/makerworld/web/whoami`,
            { headers: { 'X-MW-Cookie': rawCookie } },
            rawCookie,
          )).json();
          if (me?.handle) autoLabel = me.name ? `${me.name} (@${me.handle})` : `@${me.handle}`;
        } catch { /* fall back below */ }
      }
      if (isDesktopMakerWorldSession(rawCookie)) {
        for (const account of acc.getAccounts('makerworld')) acc.removeAccount('makerworld', account.id);
      }
      acc.addAccount('makerworld', { label: autoLabel || 'MakerWorld', secret: rawCookie, status: 'connected' });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  if (platform.id === 'mmf') {
    const desktopNeedsUpdate = !!desktop && !desktop.connectMyMiniFactory;
    const connectMyMiniFactory = async () => {
      setBusy(true); setErr('');
      try {
        if (!desktop?.connectMyMiniFactory) throw new Error('MyMiniFactory one-click sign-in requires the ModelPrep desktop app.');
        const result = await desktop.connectMyMiniFactory();
        if (!result?.ok) throw new Error(result?.error || 'MyMiniFactory sign-in was cancelled.');
        const response = await myMiniFactoryFetch(`${WORKER_URL}/api/v1/myminifactory/web/whoami`, {}, DESKTOP_MYMINIFACTORY_SECRET);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(myMiniFactoryResponseError(data, response.status, 'MyMiniFactory session check failed'));
        for (const account of acc.getAccounts('mmf')) acc.removeAccount('mmf', account.id);
        const identity = data.user?.username || data.user?.id || result.user?.username || result.user?.id;
        acc.addAccount('mmf', { label: label.trim() || (identity ? String(identity) : 'MyMiniFactory'), secret: DESKTOP_MYMINIFACTORY_SECRET, status: 'connected' });
        onDone();
      } catch (error) { setErr(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); }
    };
    return (
      <div className="space-y-1.5">
        <input className={inputCls} placeholder="Account name (optional)" value={label} onChange={(event) => setLabel(event.target.value)} />
        <button disabled={busy || !desktop?.connectMyMiniFactory} onClick={connectMyMiniFactory} className="mp-btn text-sm py-2 px-4 w-full disabled:opacity-40">{busy ? 'Waiting for MyMiniFactory sign-in…' : desktopNeedsUpdate ? 'Update ModelPrep Desktop to connect MyMiniFactory' : 'Sign in via MyMiniFactory window (desktop)'}</button>
        {!desktop?.connectMyMiniFactory && <p className="text-[11px]" style={{ color: desktopNeedsUpdate ? '#991b1b' : 'rgba(21,23,28,0.55)' }}>{desktopNeedsUpdate ? 'This desktop build does not include the MyMiniFactory bridge. Quit every ModelPrep window and launch the current build.' : 'Open this project in ModelPrep Desktop to connect MyMiniFactory.'}</p>}
        <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>MyMiniFactory’s real sign-in/upload page opens in an isolated desktop session. Cookies, form tokens, and upload-folder identifiers never enter page storage or the ModelPrep Worker.</p>
        {err && <div className="text-[11px]" style={{ color: '#b91c1c' }}>{err}</div>}
        {canCancel && <button onClick={onDone} className="mp-mono text-[11px] underline" style={{ color: 'rgba(21,23,28,0.66)' }}>Cancel</button>}
      </div>
    );
  }

  if (platform.id === 'makeronline') {
    const desktopNeedsUpdate = !!desktop && !desktop.connectMakerOnline;
    const connectMakerOnline = async () => {
      setBusy(true); setErr('');
      try {
        if (!desktop?.connectMakerOnline) {
          throw new Error('MakerOnline one-click sign-in requires the ModelPrep desktop app.');
        }
        const result = await desktop.connectMakerOnline();
        if (!result?.ok) throw new Error(result?.error || 'MakerOnline sign-in was cancelled.');
        const response = await makerOnlineFetch(
          `${WORKER_URL}/api/v1/makeronline/web/whoami`,
          {},
          DESKTOP_MAKERONLINE_SECRET,
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          throw new Error(makerOnlineResponseError(data, response.status, 'MakerOnline session check failed'));
        }
        for (const account of acc.getAccounts('makeronline')) acc.removeAccount('makeronline', account.id);
        const user = data.user || result.user || {};
        const identity = user.nickname || user.id;
        acc.addAccount('makeronline', {
          label: label.trim() || (identity ? String(identity) : 'MakerOnline'),
          secret: DESKTOP_MAKERONLINE_SECRET,
          status: 'connected',
        });
        onDone();
      } catch (error) {
        setErr(error instanceof Error ? error.message : String(error));
      } finally { setBusy(false); }
    };
    return (
      <div className="space-y-1.5">
        <input className={inputCls} placeholder="Account name (optional)" value={label} onChange={(event) => setLabel(event.target.value)} />
        <button disabled={busy || !desktop?.connectMakerOnline} onClick={connectMakerOnline} className="mp-btn text-sm py-2 px-4 w-full disabled:opacity-40">
          {busy ? 'Waiting for MakerOnline sign-in…' : desktopNeedsUpdate ? 'Update ModelPrep Desktop to connect MakerOnline' : 'Sign in via MakerOnline window (desktop)'}
        </button>
        {!desktop?.connectMakerOnline && <p className="text-[11px]" style={{ color: desktopNeedsUpdate ? '#991b1b' : 'rgba(21,23,28,0.55)' }}>{desktopNeedsUpdate ? 'The running desktop shell is older than this page. Quit every ModelPrep window and launch the current build.' : 'Open this project in ModelPrep Desktop to connect MakerOnline.'}</p>}
        <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>MakerOnline’s real sign-in/upload page opens in an isolated desktop session. Its access token and cookies never enter page storage or the ModelPrep Worker.</p>
        {err && <div className="text-[11px]" style={{ color: '#b91c1c' }}>{err}</div>}
        {canCancel && <button onClick={onDone} className="mp-mono text-[11px] underline" style={{ color: 'rgba(21,23,28,0.66)' }}>Cancel</button>}
      </div>
    );
  }

  if (platform.id === 'creality') {
    const connectCreality = async () => {
      setBusy(true); setErr('');
      try {
        if (!desktop?.connectCreality) {
          throw new Error('Creality Cloud one-click sign-in requires the ModelPrep desktop app.');
        }
        const result = await desktop.connectCreality();
        if (!result?.ok) throw new Error(result?.error || 'Creality Cloud sign-in was cancelled.');
        const response = await crealityFetch(
          `${WORKER_URL}/api/v1/creality/web/whoami`,
          {},
          DESKTOP_CREALITY_SECRET,
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          throw new Error(crealityResponseError(data, response.status, 'Creality Cloud session check failed'));
        }
        for (const account of acc.getAccounts('creality')) acc.removeAccount('creality', account.id);
        const user = data.user || result.user || {};
        const identity = user.nickname || user.id;
        acc.addAccount('creality', {
          label: label.trim() || (identity ? String(identity) : 'Creality Cloud'),
          secret: DESKTOP_CREALITY_SECRET,
          status: 'connected',
        });
        onDone();
      } catch (error) {
        setErr(error instanceof Error ? error.message : String(error));
      } finally { setBusy(false); }
    };
    return (
      <div className="space-y-1.5">
        <input className={inputCls} placeholder="Account name (optional)" value={label} onChange={(event) => setLabel(event.target.value)} />
        <button disabled={busy || !desktop?.connectCreality} onClick={connectCreality} className="mp-btn text-sm py-2 px-4 w-full disabled:opacity-40">
          {busy ? 'Waiting for Creality Cloud sign-in…' : 'Sign in via Creality Cloud window (desktop)'}
        </button>
        {!desktop?.connectCreality && (
          <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
            Open this project in ModelPrep Desktop to connect Creality Cloud.
          </p>
        )}
        <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
          Creality’s real sign-in/upload page opens in an isolated desktop session. Its token, user id, cookies, and short-lived storage credentials never enter page storage or the ModelPrep Worker.
        </p>
        {err && <div className="text-[11px]" style={{ color: '#b91c1c' }}>{err}</div>}
        {canCancel && <button onClick={onDone} className="mp-mono text-[11px] underline" style={{ color: 'rgba(21,23,28,0.66)' }}>Cancel</button>}
      </div>
    );
  }

  if (platform.id === 'nexprint') {
    const connectNexprint = async () => {
      setBusy(true); setErr('');
      try {
        if (!desktop?.connectNexprint) {
          throw new Error('Nexprint one-click sign-in requires the ModelPrep desktop app.');
        }
        const result = await desktop.connectNexprint();
        if (!result?.ok) throw new Error(result?.error || 'Nexprint sign-in was cancelled.');
        const response = await nexprintFetch(
          `${WORKER_URL}/api/v1/nexprint/web/whoami`,
          {},
          DESKTOP_NEXPRINT_SECRET,
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          throw new Error(nexprintResponseError(data, response.status, 'Nexprint session check failed'));
        }
        for (const account of acc.getAccounts('nexprint')) acc.removeAccount('nexprint', account.id);
        const user = data.user || result.user || {};
        const identity = user.nickname || user.handle || user.id;
        acc.addAccount('nexprint', {
          label: label.trim() || (identity ? String(identity) : 'Nexprint'),
          secret: DESKTOP_NEXPRINT_SECRET,
          status: 'connected',
        });
        onDone();
      } catch (error) {
        setErr(error instanceof Error ? error.message : String(error));
      } finally { setBusy(false); }
    };
    return (
      <div className="space-y-1.5">
        <input className={inputCls} placeholder="Account name (optional)" value={label} onChange={(event) => setLabel(event.target.value)} />
        <button disabled={busy || !desktop?.connectNexprint} onClick={connectNexprint} className="mp-btn text-sm py-2 px-4 w-full disabled:opacity-40">
          {busy ? 'Waiting for Nexprint sign-in…' : 'Sign in via Nexprint window (desktop)'}
        </button>
        {!desktop?.connectNexprint && (
          <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
            Open this project in ModelPrep Desktop to connect Nexprint. Browser builds intentionally do not store its bearer token.
          </p>
        )}
        <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
          Nexprint’s real sign-in and upload page opens in an isolated desktop window. The authenticated session is encrypted and never enters page storage or the ModelPrep Worker.
        </p>
        {err && <div className="text-[11px]" style={{ color: '#b91c1c' }}>{err}</div>}
        {canCancel && <button onClick={onDone} className="mp-mono text-[11px] underline" style={{ color: 'rgba(21,23,28,0.66)' }}>Cancel</button>}
      </div>
    );
  }

  if (platform.id === 'printables') {
    const connectPrintables = async () => {
      setBusy(true); setErr('');
      try {
        if (!desktop?.connectPrintables) {
          throw new Error('Printables one-click sign-in requires the ModelPrep desktop app.');
        }
        const result = await desktop.connectPrintables();
        if (!result?.ok) throw new Error(result?.error || 'Printables sign-in was cancelled.');
        const response = await printablesFetch(
          `${WORKER_URL}/api/v1/printables/web/whoami`,
          {},
          DESKTOP_PRINTABLES_SECRET,
        );
        const user = await response.json().catch(() => ({}));
        if (!response.ok || !user.ok) {
          throw new Error(printablesResponseError(user, response.status, 'Printables session check failed'));
        }
        for (const account of acc.getAccounts('printables')) acc.removeAccount('printables', account.id);
        const handle = user.handle || result.user?.handle;
        const publicName = user.publicUsername || result.user?.publicUsername;
        const accountLabel = label.trim() || (handle ? (publicName ? `${publicName} (@${handle})` : `@${handle}`) : 'Printables');
        acc.addAccount('printables', {
          label: accountLabel,
          secret: DESKTOP_PRINTABLES_SECRET,
          status: 'connected',
        });
        onDone();
      } catch (error) {
        setErr(error instanceof Error ? error.message : String(error));
      } finally { setBusy(false); }
    };
    return (
      <div className="space-y-1.5">
        <input className={inputCls} placeholder="Account name (optional — defaults to your @handle)" value={label} onChange={(event) => setLabel(event.target.value)} />
        <button disabled={busy || !desktop?.connectPrintables} onClick={connectPrintables} className="mp-btn text-sm py-2 px-4 w-full disabled:opacity-40">
          {busy ? 'Waiting for Printables sign-in…' : 'Sign in via Printables window (desktop)'}
        </button>
        {!desktop?.connectPrintables && (
          <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
            Open this project in ModelPrep Desktop to sign in through Prusa Account. ModelPrep does not ask for or store your Printables password.
          </p>
        )}
        <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
          The real Printables/Prusa OAuth page opens in an isolated window. Its session is encrypted by the desktop app and never enters page storage.
        </p>
        {err && <div className="text-[11px]" style={{ color: '#b91c1c' }}>{err}</div>}
        {canCancel && <button onClick={onDone} className="mp-mono text-[11px] underline" style={{ color: 'rgba(21,23,28,0.66)' }}>Cancel</button>}
      </div>
    );
  }

  if (platform.id === 'cults') {
    const connectCults = async () => {
      setBusy(true); setErr('');
      try {
        if (!desktop?.connectCults) throw new Error('Cults3D sign-in requires the ModelPrep desktop app.');
        const response = await desktop.connectCults({ label: label.trim() });
        if (!response?.ok || !response.accountId) throw new Error(response?.error || 'Cults3D sign-in failed.');
        acc.addAccount('cults', {
          label: label.trim() || response.label || 'Cults3D',
          secret: desktopCultsSecret(response.accountId),
          status: 'connected',
        });
        onDone();
      } catch (error) {
        setErr(error instanceof Error ? error.message : String(error));
      } finally { setBusy(false); }
    };
    return (
      <div className="space-y-1.5">
        <input className={inputCls} placeholder="Account name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        {err && <div className="text-[11px]" style={{ color: '#b91c1c' }}>{err}</div>}
        <div className="flex gap-2">
          <button disabled={busy || !desktop?.connectCults} onClick={connectCults} className="mp-btn text-xs py-1.5 px-3 disabled:opacity-40">
            {busy ? 'Waiting for Cults3D sign-in…' : 'Sign in via Cults3D window (desktop)'}
          </button>
          {canCancel && <button onClick={onDone} className="mp-btn mp-btn-ghost text-xs py-1.5 px-3">Cancel</button>}
        </div>
        <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
          {desktop
            ? 'Complete Cults3D sign-in and any browser security check in the isolated window. ModelPrep stores the resulting per-account browser session, never your password.'
            : 'Open this project in ModelPrep Desktop. Browser builds intentionally do not collect or forward a Cults3D password.'}
        </p>
      </div>
    );
  }
  // MakerWorld — desktop exchanges credentials directly from Electron and keeps the
  // resulting session encrypted in the main process. The web build uses the Worker.
  const loginMw = async () => {
    setBusy(true); setErr('');
    try {
      let status;
      let data;
      if (desktop?.loginMakerWorld) {
        const result = await desktop.loginMakerWorld({ account: email.trim(), password: pass });
        status = result.status;
        data = result.data || {};
      } else {
        const res = await fetch(`${WORKER_URL}/api/v1/makerworld/web/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: email.trim(), password: pass }),
        });
        status = res.status;
        data = await res.json().catch(() => ({}));
      }
      if (data.needCode) {
        setTfaKey(data.tfaKey || '');
        setNeedCode(true); setBusy(false); setErr(''); return;
      }
      if (status < 200 || status >= 300 || !data.ok || (!desktop && !data.cookie)) throw new Error(data.error || `Sign-in failed (HTTP ${status}).`);
      await finishMw(desktop ? DESKTOP_MAKERWORLD_SECRET : data.cookie);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };
  const loginMwCode = async () => {
    setBusy(true); setErr('');
    try {
      let status;
      let data;
      if (desktop?.loginMakerWorld) {
        const result = await desktop.loginMakerWorld({ account: email.trim(), code: code.trim(), tfaKey });
        status = result.status;
        data = result.data || {};
      } else {
        const res = await fetch(`${WORKER_URL}/api/v1/makerworld/web/login-code`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: email.trim(), code: code.trim(), ...(tfaKey ? { tfaKey } : {}) }),
        });
        status = res.status;
        data = await res.json().catch(() => ({}));
      }
      if (status < 200 || status >= 300 || !data.ok || (!desktop && !data.cookie)) throw new Error(data.error || `Code not accepted (HTTP ${status}).`);
      await finishMw(desktop ? DESKTOP_MAKERWORLD_SECRET : data.cookie);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };
  return (
    <div className="space-y-1.5">
      <input className={inputCls} placeholder="Account name (optional — defaults to your @handle)" value={label} onChange={(e) => setLabel(e.target.value)} />
      {desktop && (
        <button disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { const r = await desktop.connectMakerWorld(); if (!r?.ok) throw new Error(r?.error || 'Sign-in cancelled.'); await finishMw(DESKTOP_MAKERWORLD_SECRET); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); } }} className="mp-btn text-sm py-2 px-4 w-full disabled:opacity-40">{busy ? 'Waiting for sign-in…' : 'Sign in via MakerWorld window (desktop)'}</button>
      )}
      <details>
        <summary className="text-[11px] cursor-pointer font-medium" style={{ color: 'rgba(21,23,28,0.66)' }}>Advanced fallback: email + password</summary>
        <div className="mt-1.5 space-y-1.5">
          <input className={inputCls} placeholder="MakerWorld email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={needCode} onKeyDown={(e) => { if (e.key === 'Enter' && email.trim() && pass) loginMw(); }} />
          {!needCode && <input className={inputCls} type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && email.trim() && pass) loginMw(); }} />}
          {!needCode ? (
            <button disabled={!email.trim() || !pass || busy} onClick={loginMw} className="mp-btn text-sm py-2 px-4 disabled:opacity-40">{busy ? 'Signing in…' : 'Sign in to MakerWorld'}</button>
          ) : (
            <>
              <div className="text-[11px]" style={{ color: '#3a8d68' }}>MakerWorld emailed a verification code to <strong>{email}</strong>. Enter it to finish signing in:</div>
              <input className={inputCls} placeholder="Verification code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) loginMwCode(); }} />
              <div className="flex gap-2">
                <button disabled={!code.trim() || busy} onClick={loginMwCode} className="mp-btn text-sm py-2 px-4 disabled:opacity-40">{busy ? 'Verifying…' : 'Verify & connect'}</button>
                <button disabled={busy} onClick={() => { setNeedCode(false); setCode(''); setTfaKey(''); setErr(''); }} className="mp-btn mp-btn-ghost text-xs py-1.5 px-3">Back</button>
              </div>
            </>
          )}
          <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>
            {desktop
              ? 'The desktop app sends your password directly to MakerWorld over HTTPS for the token exchange, never to the ModelPrep Worker, and never stores it. The resulting session is encrypted with macOS Keychain-backed storage.'
              : 'Your password is sent over HTTPS to the ModelPrep Worker only for MakerWorld’s token exchange and is never stored. Use ModelPrep Desktop if you want a fully direct sign-in and upload path.'}
            {' '}MakerWorld may require an emailed code or CAPTCHA; use the MakerWorld window if that happens.
          </p>
        </div>
      </details>
      <details>
        <summary className="text-[11px] cursor-pointer" style={{ color: 'rgba(21,23,28,0.66)' }}>Trouble signing in? Paste a session cookie instead</summary>
        <div className="mt-1.5 space-y-1.5">
          <div className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>From a logged-in MakerWorld tab: DevTools → Application → Cookies → copy <code>token</code> (and <code>refreshToken</code>).</div>
          <textarea className={inputCls} rows={2} placeholder="token=…; refreshToken=…" value={cookie} onChange={(e) => setCookie(e.target.value)} />
          <button disabled={!cookie.trim() || busy} onClick={() => finishMw(cookie.trim())} className="mp-btn mp-btn-ghost text-xs py-1.5 px-3 disabled:opacity-40">{busy ? 'Checking…' : 'Connect with cookie'}</button>
        </div>
      </details>
      {err && <div className="text-[11px]" style={{ color: '#b91c1c' }}>{err}</div>}
      {canCancel && <button onClick={onDone} className="mp-mono text-[11px] underline" style={{ color: 'rgba(21,23,28,0.66)' }}>Cancel</button>}
    </div>
  );
}

// ---- MakerWorld (Bambu Lab) real upload flow ----
// Auth = the user's own MakerWorld session cookie (HttpOnly, so pasted/extension-
// grabbed). Files upload one-by-one to the Worker (which presigns + PUTs to
// MakerWorld's S3), then one /publish call with the URLs. Backend:
// backend/src/adapters/makerworld-web.ts + /api/v1/makerworld/web/*.
// (Session now lives in the accounts store; lib/accounts.js migrates the legacy
// `modelprep:makerworld-cookie` key on first load.)
// Full MakerWorld hierarchy captured from the live publish page. Keep the source
// tree in data/ so category labels and exact integer ids remain inspectable.
const MW_CATEGORIES = flattenMakerWorldCategories(makerWorldCategoryTree).filter((category) => category.isLeaf);

// Prefer the Worker's seven-day live cache; use the bundled catalog only when the
// session/edge cannot refresh it. The ~548KB seed stays lazy-loaded.
let _mwCatalogCache = null;
async function loadMwCatalog(cookie = '') {
  if (_mwCatalogCache) return _mwCatalogCache;
  try {
    const res = await makerWorldFetch(`${WORKER_URL}/api/v1/makerworld/web/bom-catalog`, {
      headers: cookie ? { 'X-MW-Cookie': cookie } : {},
    }, cookie);
    const data = await res.json();
    if (res.ok && data?.catalog) {
      _mwCatalogCache = data.catalog;
      return _mwCatalogCache;
    }
  } catch { /* offline/development: fall through to the bundled seed */ }
  const mod = await import('./data/makerworld-bom-catalog.json');
  _mwCatalogCache = mod.default || mod;
  return _mwCatalogCache;
}

// DFS the catalog tree for a leaf whose sku matches (case-insensitive), returning
// the node plus the ancestor `value` path (parentIds the picker would have added).
function mwFindBySku(roots, sku) {
  const want = sku.trim().toLowerCase();
  if (!want) return null;
  const walk = (nodes, path) => {
    for (const n of nodes || []) {
      if ((n.sku || '').toLowerCase() === want) return { node: n, parentIds: path };
      if (n.children) { const hit = walk(n.children, [...path, n.value]); if (hit) return hit; }
    }
    return null;
  };
  return walk(roots, []);
}

function mwCatalogItem(node, parentIds, quantity) {
  const item = {
    value: node.value, sku: node.sku, title: node.title, label: node.label,
    image: node.image, pieces: node.pieces, handle: node.handle,
    parentIds, quantity: Math.max(1, quantity | 0 || 1),
  };
  if (node.filamentCodes) item.filamentCodes = node.filamentCodes;
  return item;
}

// Cascade picker over one catalog tree (kits | filaments | materials). Drills down
// via chained <select>s; a node with a non-empty sku is an addable leaf.
function MwBomPicker({ roots, onAdd }) {
  const [path, setPath] = useState([]); // selected node objects, root → leaf

  const levels = [];
  let nodes = roots || [];
  for (let depth = 0; ; depth++) {
    levels.push(nodes);
    const chosen = path[depth];
    if (!chosen || !(chosen.children && chosen.children.length)) break;
    nodes = chosen.children;
  }
  const leaf = path[path.length - 1];
  const canAdd = !!(leaf && leaf.sku);
  const [qty, setQty] = useState(1);

  const pick = (depth, value) => {
    const node = levels[depth].find(n => n.value === value);
    setPath(node ? [...path.slice(0, depth), node] : path.slice(0, depth));
  };
  const add = () => { if (canAdd) { onAdd(mwCatalogItem(leaf, path.slice(0, -1).map(n => n.value), qty)); setPath([]); setQty(1); } };

  const sel = 'mp-card text-[12px] p-1.5 w-full';
  return (
    <div className="space-y-1.5">
      {levels.map((opts, depth) => (
        <select key={depth} className={sel} value={path[depth]?.value || ''} onChange={(e) => pick(depth, e.target.value)}>
          <option value="">{depth === 0 ? 'Choose…' : '— choose —'}</option>
          {opts.map(n => <option key={n.value} value={n.value}>{n.label || n.title}{n.sku ? ` · ${n.sku}` : ''}</option>)}
        </select>
      ))}
      {canAdd && (
        <div className="flex items-center gap-2">
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="mp-card text-[12px] p-1.5 w-16" />
          <button onClick={add} className="mp-btn text-[11px] py-1.5 px-3">Add {leaf.sku}</button>
        </div>
      )}
    </div>
  );
}

// Search the user's own MakerWorld designs (3D or Laser&Cut) to link as remix /
// related model. type 0 = 3D models, 1 = Laser & Cut.
function MwRelatedSearch({ cookie, type, selected, onSelect, label }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const search = async () => {
    setBusy(true); setErr(''); setResults(null);
    try {
      const res = await makerWorldFetch(
        `${WORKER_URL}/api/v1/makerworld/web/related?type=${type}&keyword=${encodeURIComponent(q)}`,
        { headers: { 'X-MW-Cookie': cookie } },
        cookie,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || 'Search failed');
      setResults(data.designs || []);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-1.5">
      {selected ? (
        <div className="flex items-center gap-2 text-[12px] mp-card p-1.5" style={{ background: 'rgba(21,23,28,0.04)' }}>
          {selected.cover && <img src={selected.cover} alt="" className="w-7 h-7 object-cover" />}
          <span className="flex-1 truncate">{selected.title} <span className="mp-mono opacity-50">#{selected.id}</span></span>
          <button onClick={() => onSelect(null)} className="mp-mono text-[11px] underline opacity-60">clear</button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input className="mp-card text-[12px] p-1.5 flex-1" placeholder={label || 'Search your designs…'} value={q}
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} />
            <button onClick={search} disabled={busy} className="mp-btn text-[11px] py-1.5 px-3 disabled:opacity-40">{busy ? '…' : 'Search'}</button>
          </div>
          {results && results.length === 0 && <div className="text-[11px] opacity-60">No matching designs.</div>}
          {results && results.length > 0 && (
            <div className="space-y-1 max-h-44 overflow-auto">
              {results.map(d => (
                <button key={d.id} onClick={() => { onSelect(d); setResults(null); }} className="w-full flex items-center gap-2 text-[12px] mp-card p-1.5 text-left hover:opacity-80">
                  {d.cover && <img src={d.cover} alt="" className="w-7 h-7 object-cover" />}
                  <span className="flex-1 truncate">{d.title}</span>
                  <span className="mp-mono text-[10px] opacity-50">#{d.id}</span>
                </button>
              ))}
            </div>
          )}
          {err && <div className="text-[11px]" style={{ color: '#B91C1C' }}>{err}</div>}
        </>
      )}
    </div>
  );
}

// Lightweight collapsible "advanced" section.
function MwSection({ title, hint, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mp-card" style={{ background: 'rgba(21,23,28,0.02)' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-2.5 text-left">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-[13px] font-medium" style={{ color: '#15171C' }}>{title}</span>
        {badge != null && badge !== 0 && <span className="mp-mono text-[10px] px-1.5 py-0.5" style={{ background: 'rgba(255,105,0,0.15)', color: '#B23A1A' }}>{badge}</span>}
        {hint && <span className="text-[11px] ml-auto" style={{ color: 'rgba(21,23,28,0.66)' }}>{hint}</span>}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// Map a live MakerWorld model to a status dot + label. The published list only contains
// LIVE models, so being here = live; offline/odd status is flagged conservatively.
function mwModelStatus(m) {
  if (m.offlineInstCnt > 0) return { dot: '#d97706', label: `Live · ${m.offlineInstCnt} profile${m.offlineInstCnt === 1 ? '' : 's'} offline` };
  if (m.status === 1) return { dot: '#1a7f37', label: 'Live' };
  return { dot: '#d97706', label: `status ${m.status} — check on MakerWorld` };
}

// "My MakerWorld models" — polls the live published list so you can confirm a model
// actually went live (post-submit) and spot takedowns. Honest about the gap: it only
// shows LIVE models; "verifying"/rejected models aren't fetchable server-side yet.
function MwMyModels({ cookie, isDemo, kind = '3d' }) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setModels(null); setErr(''); }, [kind, cookie]);
  const load = async () => {
    if (isDemo) { setModels([]); setErr(''); return; }
    setLoading(true); setErr('');
    try {
      const endpoint = kind === 'laser-cut' ? 'related?type=1&keyword=' : 'my-creations';
      const res = await makerWorldFetch(
        `${WORKER_URL}/api/v1/makerworld/web/${endpoint}`,
        { headers: { 'X-MW-Cookie': cookie } },
        cookie,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || data?.error || 'Failed to load');
      setModels(Array.isArray(data.designs) ? data.designs.map((model) => ({
        ...model,
        status: model.status ?? 1,
        coverUrl: model.coverUrl || model.cover,
        url: model.url || `https://makerworld.com/en/models/${model.id}`,
      })) : []);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  };
  useEffect(() => { if (open && models === null) load(); }, [open]); // eslint-disable-line
  return (
    <div className="mp-card" style={{ background: 'rgba(21,23,28,0.02)' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-2.5 text-left">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-[13px] font-medium" style={{ color: '#15171C' }}>My MakerWorld {kind === 'laser-cut' ? 'Laser & Cut designs' : 'models'}</span>
        {models && <span className="mp-mono text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>{models.length} live</span>}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          <button onClick={load} disabled={loading} className="mp-btn mp-btn-ghost text-[11px] py-1 px-2 disabled:opacity-40">{loading ? 'Loading…' : 'Refresh'}</button>
          {err && <div className="text-[11px]" style={{ color: '#B91C1C' }}>{err}</div>}
          {models && models.length === 0 && !loading && <div className="text-[11px] opacity-60">No live {kind === 'laser-cut' ? 'Laser & Cut designs' : 'models'} found.</div>}
          {models && models.map((m) => {
            const s = mwModelStatus(m);
            return (
              <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[12px] mp-card p-1.5" style={{ background: 'rgba(21,23,28,0.03)' }}>
                {m.coverUrl && <img src={m.coverUrl} alt="" className="w-7 h-7 object-cover flex-shrink-0" />}
                <span className="flex-1 truncate">{m.title}</span>
                <span className="flex items-center gap-1 flex-shrink-0"><StatusDot status="connected" /><span style={{ color: s.dot }}>{s.label}</span></span>
              </a>
            );
          })}
          <div className="text-[10px] opacity-50">Shows your <strong>live</strong> models. Models still in <em>verifying</em> or that were <em>rejected</em> can't be read here yet — check them on MakerWorld.</div>
        </div>
      )}
    </div>
  );
}

// Slim Publish-step component: connection status + a summary of the options set on the
// Platforms step + the print-profile summary (Profiles step) + the actual publish action.
function MakerWorldUploadFlow({ platform, project, batchRequest, onBatchResult }) {
  const acc = useAccounts();
  const openConnections = useOpenConnections();
  const mwAccounts = acc.getAccounts('makerworld');
  // In demo mode the publish is simulated (no network), and we present a synthetic
  // "connected" account so the full flow is explorable even without a real sign-in.
  const isDemo = !!project.__demo;
  const realActive = acc.getActive('makerworld');
  const realCookie = realActive?.secret || '';
  // Demo projects always simulate, even if a real account is connected.
  const simulate = isDemo;
  const active = realActive || (isDemo ? { id: 'demo', label: 'Demo account', status: 'connected' } : null);
  const cookie = realCookie || (isDemo ? 'demo-cookie' : ''); // '' = not signed in
  const uploadCapabilities = useMakerWorldCapabilities(realCookie, !simulate && !!realCookie);
  const [status, setStatus] = useState('idle'); // idle|publishing|done|error|deleting
  const [errorMsg, setErrorMsg] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const [result, setResult] = useState(null);
  const [liveCheck, setLiveCheck] = useState(null); // post-submit "did it actually go live?"
  const handledBatchRun = useRef(null);
  const reportBatch = (batchRunId, state, detail, metadata = {}) => {
    if (!batchRunId) return;
    onBatchResult?.({ runId: batchRunId, platformId: 'makerworld', state, detail, ...metadata });
  };

  // All MakerWorld options now live on the Platforms step (project.platforms.makerworld);
  // File-based docs live in the runtime holder. This component only reads + publishes.
  const opts = { ...MW_DEFAULT_OPTS, ...(project.platforms?.makerworld || {}) };
  const { categoryId, visibility, productMode, modelSource, exclusive, communityPost, remixModel, relatedModel } = opts;
  const license = mwResolveLicense(opts, project); // override > mapped from Details > default
  const boms = opts.boms || { kits: [], filaments: [], materials: [] };
  const otherParts = opts.otherParts || [];
  const docGuides = mwRuntimeDocs.docGuides;
  const docOthers = mwRuntimeDocs.docOthers;
  const isLC = productMode === 'laser-cut';
  const publishIssues = makerWorldPublishIssues(project, opts, {
    cyberControlCount: mwRuntimeCyberBrick.controlConfigs.length,
    forbiddenWords: makerWorldForbiddenWords,
    videoIssues: !isLC ? makerWorldVideoIssues(project.media || []) : [],
    rcUpload: simulate ? true : uploadCapabilities.data?.rcUpload,
    uploadAllowed: simulate ? true : uploadCapabilities.data?.uploadAllowed,
  });
  const modelFiles = publishIssues.files.filter((file) => file.blob);
  const draftIssues = [
    uploadCapabilities.data?.uploadAllowed === false ? 'MakerWorld upload is disabled for this account.' : '',
    opts.cyberBrick && uploadCapabilities.data?.rcUpload === false ? 'CyberBrick upload is not enabled for this MakerWorld account.' : '',
    !String(project.title || '').trim() ? 'Add a title before saving a draft.' : '',
    !project.coverImageId ? 'Select a cover image before saving a draft.' : '',
    !modelFiles.length ? `Add at least one ${isLC ? 'Laser & Cut' : '3D model'} file before saving a draft.` : '',
    ...(!isLC ? makerWorldVideoIssues(project.media || []) : []),
  ].filter(Boolean);
  const has3mf = modelFiles.some(f => /\.3mf$/i.test(f.name));
  const primaryLacProjectFile = isLC && opts.laserMode === 'lac'
    ? (modelFiles.find((file) => file.id === opts.primaryLacFileId && fileExt(file.name) === 'lac')
      || modelFiles.find((file) => fileExt(file.name) === 'lac'))
    : null;
  const bomCount = boms.kits.length + boms.filaments.length + boms.materials.length;

  // The .3mf's print profile (name, photos, guidelines) is configured in the Profiles step.
  const mw3mfFile = modelFiles.find((file) => file.id === opts.primaryProfileFileId && /\.3mf$/i.test(file.name))
    || modelFiles.find((f) => /\.3mf$/i.test(f.name) && fileSlicer(f) === 'bambu')
    || modelFiles.find(f => /\.3mf$/i.test(f.name));
  const mwProfile = !isLC ? makerWorldPrimaryProfile(project, { ...opts, primaryProfileFileId: mw3mfFile?.id }) : null;
  const laserProfile = { ...MW_DEFAULT_OPTS.laserProfile, ...(opts.laserProfile || {}) };
  const profileName = isLC ? laserProfile.title : (mwProfile?.name || 'Print profile');
  const profilePicIds = isLC ? (laserProfile.photoIds || []) : (mwProfile?.photoIds || []);
  const catLabel = MW_CATEGORIES.find(c => String(c.id) === String(categoryId))?.label || categoryId;

  // Sign-in is managed centrally in the Connections modal; here we only switch/clear.
  const disconnect = () => { if (active) acc.removeAccount('makerworld', active.id); setStatus('idle'); setResult(null); };

  const uploadOne = async (fileOrBlob, name) => {
    return uploadMakerWorldFile({
      workerUrl: WORKER_URL,
      cookie,
      file: fileOrBlob,
      name,
      fetchImpl: (url, options) => makerWorldFetch(url, options, cookie),
    });
  };

  const publish = async (draftOnly = false, batchRunId = null) => {
    const blockingIssues = draftOnly ? draftIssues : publishIssues.errors;
    if (blockingIssues.length) {
      const message = blockingIssues.join(' ');
      setErrorMsg(message);
      setStatus('error');
      reportBatch(batchRunId, 'error', message);
      return;
    }
    if (simulate) {
      // No real account connected — simulate so the demo flow is still explorable.
      setStatus('publishing'); setErrorMsg(''); setResult(null);
      setProgressMsg(draftOnly ? 'Simulating draft save (demo)…' : 'Simulating publish (demo)…');
      await new Promise((r) => setTimeout(r, 900));
      setResult({ id: 'demo-' + Math.random().toString(36).slice(2, 8), status: draftOnly ? 'draft' : 8, url: 'https://makerworld.com/', kind: isLC ? 'laser-cut' : '3d', files: modelFiles.length + project.images.length + (has3mf ? 1 : 0), visibility, demo: true, draftOnly });
      setStatus('done'); setProgressMsg('');
      reportBatch(batchRunId, 'success', draftOnly
        ? 'Draft save simulated — nothing uploaded'
        : `${visibility} publish simulated — nothing uploaded`, {
        publicationState: draftOnly ? 'draft' : visibility,
        simulated: true,
      });
      return;
    }
    if (!cookie) {
      reportBatch(batchRunId, 'error', 'No active MakerWorld account');
      return;
    }
    setStatus('publishing'); setErrorMsg(''); setResult(null);
    try {
      const coverImg = project.images.find(i => i.id === project.coverImageId);
      if (!coverImg) throw new Error('Pick a cover image in step 03 before publishing.');
      let effectiveLacMetadata = null;
      if (isLC && opts.laserMode === 'lac') {
        const source = primaryLacProjectFile;
        setProgressMsg('Reading Bambu Suite metadata…');
        const parsed = await readLacMetadata(source?.blob, loadJSZip);
        const manualProcessTypes = String(opts.laserInfo?.processTypes || '').split(',').map((value) => value.trim()).filter(Boolean);
        const manualMaterialIds = String(opts.laserInfo?.materialIds || '').split(',').map((value) => value.trim()).filter(Boolean);
        const manualDevices = String(opts.laserInfo?.compatibleDevices || '').split(',').map((value) => value.trim()).filter(Boolean);
        effectiveLacMetadata = {
          lacInfo: {
            plates: parsed.lacInfo.plates,
            processTypes: manualProcessTypes.length ? manualProcessTypes : parsed.lacInfo.processTypes,
            machineName: String(opts.laserInfo?.machineName || '').trim() || parsed.lacInfo.machineName,
            materialIds: manualMaterialIds.length ? manualMaterialIds : parsed.lacInfo.materialIds,
          },
          lacCustomInfo: {
            otherTools: String(opts.laserInfo?.otherTools || '').trim() || parsed.lacCustomInfo.otherTools,
            compatibleDevicesSelected: manualDevices.length ? manualDevices : parsed.lacCustomInfo.compatibleDevicesSelected,
          },
          model2DInfo: parsed.model2DInfo,
        };
        if (!draftOnly && !effectiveLacMetadata.lacInfo.plates.length) {
          throw new Error('Could not read plate metadata from this .lac file. Re-save it with the current Bambu Suite before publishing.');
        }
        if (!draftOnly && (!effectiveLacMetadata.lacInfo.machineName || !effectiveLacMetadata.lacInfo.processTypes.length)) {
          throw new Error('Could not read the machine/process metadata from this .lac file. Enter the Bambu Suite profile overrides in MakerWorld options.');
        }
      }

      // Crop every image to MakerWorld's exact aspects (4:3 web cover + 3:4 app cover,
      // 4:3 gallery) using the focal point, and re-encode to JPEG — so the uploaded files
      // match the per-platform preview instead of being raw images MakerWorld center-crops.
      const webSpec = platform.covers.find(c => c.aspect === '4:3') || platform.covers[0];
      const appSpec = platform.covers.find(c => c.aspect === '3:4');
      setProgressMsg('Preparing cover…');
      const cover = await uploadOne(await cropImageToBlob(coverImg, webSpec.w, webSpec.h), 'cover.jpg');
      const imageUrlById = { [coverImg.id]: cover.url }; // image id → uploaded 4:3 url (for the print-profile picker)
      let portraitUrl = cover.url;
      if (appSpec) { portraitUrl = (await uploadOne(await cropImageToBlob(coverImg, appSpec.w, appSpec.h), 'cover-portrait.jpg')).url; }

      // Gallery / Model Pictures — crop each to MakerWorld's recommended 4:3, capped at maxImages.
      const galleryImgs = project.images.filter(i => i.id !== coverImg.id).slice(0, galleryCapacity(platform));
      setProgressMsg('Preparing gallery…');
      const galleryUrls = [];
      for (let i = 0; i < galleryImgs.length; i++) {
        const u = (await uploadOne(await cropImageToBlob(galleryImgs[i], webSpec.w, webSpec.h), `image-${i + 2}.jpg`)).url;
        galleryUrls.push(u); imageUrlById[galleryImgs[i].id] = u;
      }
      let designVideo = [];
      const modelVideo = !isLC ? makerWorldVideo(project.media || []) : null;
      if (modelVideo) {
        setProgressMsg('Uploading model video…');
        const uploadedVideo = await uploadOne(modelVideo.blob, modelVideo.name);
        designVideo = [{ name: modelVideo.name, url: uploadedVideo.url }];
      }
      // Print-profile media is independent from the model gallery. Upload exactly the
      // configured cover/photos and never silently substitute a render or model cover.
      const needsProfileMedia = (!isLC && !!mw3mfFile) || (isLC && opts.laserMode === 'lac');
      const profileCoverId = isLC
        ? (laserProfile.useMainCover ? coverImg.id : laserProfile.coverImageId)
        : (mwProfile?.useMainCover ? coverImg.id : mwProfile?.coverImageId);
      const profileImageIds = needsProfileMedia
        ? [...new Set([profileCoverId, ...profilePicIds].filter(Boolean))]
        : [];
      for (const imageId of profileImageIds) {
        if (imageUrlById[imageId]) continue;
        const image = project.images.find((item) => item.id === imageId);
        if (!image) continue;
        imageUrlById[imageId] = (await uploadOne(await cropImageToBlob(image, webSpec.w, webSpec.h), `profile-${imageId}.jpg`)).url;
      }
      const profilePicUrls = profileImageIds.map((id) => imageUrlById[id]).filter(Boolean);

      setProgressMsg('Uploading model files…');
      let model3mf = null; let lacFile = null; const mfList = [];
      const filesToUpload = modelFiles;
      for (const mf of filesToUpload) {
        const up = await uploadOne(mf.blob, mf.name);
        const type = (mf.name.split('.').pop() || '').toLowerCase();
        if (!isLC && type === '3mf' && mf.id === mw3mfFile?.id) model3mf = { name: mf.name, size: up.size, url: up.url };
        else if (isLC && opts.laserMode === 'lac' && mf.id === primaryLacProjectFile?.id) lacFile = { uniKey: up.key, name: mf.name, size: up.size, url: up.url };
        else mfList.push({
          modelName: mf.name, modelSize: up.size, modelType: type, modelUrl: up.url,
          note: mf.makerWorld?.note || '', protected: mf.makerWorld?.openSource === false,
          relativePath: [mf.makerWorld?.folderPath, mf.name].filter(Boolean).join('/'),
          cdnPrefix: up.cdnPrefix, uploadKey: up.key,
          thumbnailUrl: cover.url, thumbnailName: 'cover.jpg', thumbnailSize: cover.size,
        });
      }

      // Documentation uploads (Assembly Guide + Other Files) → {name,url,size} refs.
      const uploadDocs = async (files) => {
        const out = [];
        for (const f of files) { const up = await uploadOne(f, f.name); out.push({ uniKey: up.key, name: f.name, url: up.url, size: up.size }); }
        return out;
      };

      const uploadRuntimeFiles = async (files) => {
        const out = [];
        for (const file of files || []) {
          const up = await uploadOne(file, file.name);
          out.push({ uniKey: up.key, name: file.name, size: up.size, url: up.url });
        }
        return out;
      };
      let cyberBrick;
      if (opts.cyberBrick) {
        setProgressMsg('Uploading CyberBrick files…');
        const [controlConfig, motionConfig, originMicroPython, mainControlList] = await Promise.all([
          uploadRuntimeFiles(mwRuntimeCyberBrick.controlConfigs),
          uploadRuntimeFiles(mwRuntimeCyberBrick.motionConfigs),
          uploadRuntimeFiles(mwRuntimeCyberBrick.microPython),
          uploadRuntimeFiles(mwRuntimeCyberBrick.mainControlConfig ? [mwRuntimeCyberBrick.mainControlConfig] : []),
        ]);
        cyberBrick = { controlConfig, motionConfig, originMicroPython, ...(mainControlList[0] ? { mainControlConfig: mainControlList[0] } : {}) };
      }

      const remixFields = modelSource === 'remix' ? {
        modelSource: 'remix',
        remixSourceUrl: opts.remixUrl,
        remixSourceLicense: opts.remixLicense || remixModel?.license || '',
        remixDescription: opts.remixDescription,
        remixOriginalDesignType: remixModel?.designType ?? (isLC ? 1 : 0),
        ...(remixModel ? { remixOriginalIds: [remixModel.id] } : {}),
      } : { modelSource: 'original' };

      let endpoint, input;
      if (isLC) {
        setProgressMsg('Uploading documentation…');
        const [docGuide, docOther] = [await uploadDocs(docGuides), await uploadDocs(docOthers)];
        endpoint = `${WORKER_URL}/api/v1/makerworld/web/laser-cut/publish`;
        input = {
          title: project.title || 'ModelPrep upload',
          license, visibility, tags: project.tags ?? [],
          ...remixFields,
          modelFiles: mfList,
          ...(lacFile ? {
            lacFile,
            lacInfo: effectiveLacMetadata.lacInfo,
            lacCustomInfo: effectiveLacMetadata.lacCustomInfo,
            model2DInfo: effectiveLacMetadata.model2DInfo,
            profileTitle: laserProfile.title,
            profileDescription: laserProfile.description ? mdToMakerWorldHtml(laserProfile.description) : '',
            profileVisibility: laserProfile.visibility || visibility,
            profilePictures: profilePicUrls,
          } : {}),
          pictures: [cover.url, portraitUrl, ...galleryUrls].filter(Boolean),
          ...(cyberBrick ? { cyberBrick } : {}),
          ...(relatedModel ? { relatedModel: { id: relatedModel.id, designType: 0, title: relatedModel.title, cover: relatedModel.cover, status: relatedModel.status } } : {}),
          ...(docGuide.length ? { docGuide } : {}),
          ...(docOther.length ? { docOther } : {}),
          ...(draftOnly ? { draftOnly: true } : {}),
        };
      } else {
        setProgressMsg('Uploading documentation…');
        const [designGuide, designOther] = [await uploadDocs(docGuides), await uploadDocs(docOthers)];
        const validOtherParts = otherParts.filter((part) => String(part.name || '').trim());
        const hasBom = bomCount > 0 || validOtherParts.length > 0;
        // MakerWorld's description (`summary`) is a CKEditor HTML field with a fixed schema
        // (#→<h2>, *italic*→<i>, links with target/rel, ol/ul, blockquote). Use the
        // MakerWorld-specific converter so it renders correctly instead of literal Markdown.
        const remixHtml = modelSource === 'remix' ? `<h2>Remix details</h2>${mdToMakerWorldHtml(opts.remixDescription)}` : '';
        const htmlDesc = `${mdToMakerWorldHtml(project.description) || '<p>Uploaded with ModelPrep.</p>'}${remixHtml}`;
        endpoint = `${WORKER_URL}/api/v1/makerworld/web/publish`;
        input = {
          title: project.title || 'ModelPrep upload',
          description: htmlDesc,
          categoryId: Number(categoryId),
          tags: project.tags ?? [],
          license,
          visibility,
          coverUrl: cover.url,
          coverPortraitUrl: portraitUrl,
          galleryUrls,
          ...(designVideo.length ? { designVideo } : {}),
          modelFiles: mfList,
          ...remixFields,
          ...(cyberBrick ? { cyberBrick } : {}),
          ...(relatedModel ? { relatedModel: { id: relatedModel.id, designType: 1, title: relatedModel.title, cover: relatedModel.cover, status: relatedModel.status } } : {}),
          ...(exclusive ? { exclusive: 1, exclusiveTermsAccepted: !!opts.exclusiveTermsAccepted } : {}),
          ...(hasBom ? { boms: { ...boms, ...(validOtherParts.length ? { otherParts: validOtherParts } : {}) } } : {}),
          ...(designGuide.length ? { designGuide } : {}),
          ...(designOther.length ? { designOther } : {}),
          ...(model3mf ? { model3mf, printProfile: {
            title: profileName,
            description: mwProfile?.description ? mdToMakerWorldHtml(mwProfile.description) : '',
            pictureUrls: profilePicUrls,
            visibility: mwProfile?.visibility || visibility,
            realPhotoConfirmed: !!mwProfile?.realPhotoConfirmed,
            isPrinterTested: !!mwProfile?.guidelinesAccepted,
            otherCompatibility: compatibilityFromProducts(mwProfile?.compatiblePrinters || []),
          } } : {}),
          ...(communityPost ? { communityPost: { content: htmlDesc } } : {}),
          ...(draftOnly ? { draftOnly: true } : {}),
        };
      }

      setProgressMsg(draftOnly
        ? 'Saving MakerWorld draft…'
        : (isLC ? 'Creating Laser & Cut draft + publishing…' : (has3mf ? 'Creating draft + print profile + publishing…' : 'Creating draft + publishing…')));
      const res = await makerWorldFetch(endpoint, {
        method: 'POST', headers: { 'X-MW-Cookie': cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      }, cookie);
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(makerWorldResponseError(data, res.status, 'MakerWorld publish failed'));
      setResult({ id: data.id, status: data.status, url: data.url, kind: data.kind || '3d', files: mfList.length + galleryUrls.length + designVideo.length + 1 + (model3mf || lacFile ? 1 : 0), visibility, draftOnly, designVideo });
      setStatus('done');
      reportBatch(batchRunId, 'success', draftOnly ? 'Unpublished draft saved' : `${visibility} listing submitted`, {
        publicationState: draftOnly ? 'draft' : visibility,
        url: data.url,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
      setStatus('error');
      reportBatch(batchRunId, 'error', message);
    }
    finally { setProgressMsg(''); }
  };

  useEffect(() => {
    if (!batchRequest?.runId || handledBatchRun.current === batchRequest.runId) return;
    handledBatchRun.current = batchRequest.runId;
    publish(batchRequest.action === 'draft', batchRequest.runId);
    // The request id is the batch trigger. The publish function reads the latest project/account state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchRequest?.runId]);

  const del = async () => {
    if (simulate) { setResult(null); setStatus('idle'); setErrorMsg(''); setLiveCheck(null); return; }
    if (!cookie || !result?.id) return;
    setStatus('deleting'); setErrorMsg('');
    try {
      const delPath = result.kind === 'laser-cut' ? 'laser-cut/delete' : 'delete';
      const res = await makerWorldFetch(
        `${WORKER_URL}/api/v1/makerworld/web/${delPath}`,
        { method: 'POST', headers: { 'X-MW-Cookie': cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: result.designId || result.id }) },
        cookie,
      );
      const data = await res.json();
      if (!res.ok || !data.deleted) throw new Error(data?.message || data?.error || `Delete failed (HTTP ${res.status})`);
      setResult(null); setStatus('connected'); setLiveCheck(null);
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : String(err)); setStatus('done'); }
  };

  // Post-submit verification: a submit returns "verifying" — this confirms whether the
  // model actually became LIVE (appears in the published list) vs. still in review/rejected.
  const checkLive = async () => {
    if (simulate) { setLiveCheck({ loading: false, error: 'This was a simulation; no MakerWorld listing exists to check.' }); return; }
    if (!cookie || !result?.id || result.draftOnly) return;
    setLiveCheck({ loading: true });
    try {
      // 1. Did slicing/verification FAIL? draft-status carries the exact reason
      //    (e.g. "The 3mf was not generated by Bambu Studio"). resultType != 0 = failed.
      const statusPath = result.kind === 'laser-cut' ? 'laser-cut/draft-status' : 'draft-status';
      const sres = await makerWorldFetch(
        `${WORKER_URL}/api/v1/makerworld/web/${statusPath}?id=${result.id}`,
        { headers: { 'X-MW-Cookie': cookie } },
        cookie,
      );
      const sdata = await sres.json().catch(() => ({}));
      if (sres.ok && sdata.ok && sdata.outcome === 'failed') {
        setLiveCheck({ loading: false, failed: true, reason: sdata.reason || `Verification failed (code ${sdata.code})`, profileTitle: sdata.profileTitle });
        return;
      }
      if (sres.ok && sdata.ok && sdata.outcome === 'live' && sdata.designId) {
        const liveUrl = result.kind === 'laser-cut'
          ? result.url
          : `https://makerworld.com/en/models/${sdata.designId}${sdata.profileId ? `#profileId-${sdata.profileId}` : ''}`;
        const model = {
          id: sdata.designId,
          title: sdata.title || project.title,
          status: sdata.status || 1,
          url: liveUrl,
          profileId: sdata.profileId,
          designVideo: sdata.designVideo || [],
        };
        setResult((current) => ({ ...current, status: 'live', designId: sdata.designId, profileId: sdata.profileId, url: liveUrl }));
        const videoReadbackIssues = makerWorldVideoReadbackIssues(result.designVideo, sdata.designVideo);
        if (videoReadbackIssues.length) {
          setLiveCheck({
            loading: false,
            error: `MakerWorld listing is live, but model-video readback failed: ${videoReadbackIssues.join(' ')}`,
            model,
          });
          return;
        }
        setLiveCheck({ loading: false, live: true, model });
        return;
      }
      // 2. Not failed → confirm it's actually live (in the published list) vs still verifying.
      const listPath = result.kind === 'laser-cut' ? 'related?type=1&keyword=' : 'my-creations';
      const res = await makerWorldFetch(
        `${WORKER_URL}/api/v1/makerworld/web/${listPath}`,
        { headers: { 'X-MW-Cookie': cookie } },
        cookie,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || data?.error || 'Status check failed');
      const found = (data.designs || []).find((m) => String(m.id) === String(result.designId || result.id));
      if (found && result.designVideo?.length) {
        setLiveCheck({
          loading: false,
          error: 'MakerWorld listing is live, but the fallback listing response does not contain model-video metadata. Retry the draft readback before certifying the video.',
          model: found,
        });
        return;
      }
      setLiveCheck({ loading: false, live: !!found, model: found });
    } catch (e) { setLiveCheck({ loading: false, error: e instanceof Error ? e.message : String(e) }); }
  };

  // Auto-check ~6s after a real publish so a rejection surfaces without the user clicking.
  useEffect(() => {
    if (status === 'done' && result?.id && !result.draftOnly && !simulate && !liveCheck) {
      const t = setTimeout(() => checkLive(), 6000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, result?.id]);

  return (
    <div className="space-y-3">
      {!cookie ? (
        <div className="mp-card p-3 space-y-2" style={{ background: 'rgba(21,23,28,0.04)' }}>
          <div className="mp-mono text-[11px] uppercase tracking-[0.15em] flex items-center gap-1.5" style={{ color: 'rgba(21,23,28,0.66)' }}><StatusDot status="unknown" /> {platform.name} — not connected</div>
          <p className="text-[13px]" style={{ color: 'rgba(21,23,28,0.7)' }}>Sign in to MakerWorld to publish. Accounts are managed in <strong>Connections</strong>.</p>
          <button onClick={() => openConnections('accounts')} className="mp-btn text-sm py-2 px-4">Connect MakerWorld</button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <span className="flex items-center gap-1.5 min-w-0" style={{ color: 'rgba(21,23,28,0.7)' }}>
              <StatusDot status={active.status} /> Publishing as
              {mwAccounts.length > 1 ? (
                <select value={active.id} onChange={(e) => acc.setActive('makerworld', e.target.value)} className="mp-card text-[12px] p-1 max-w-[160px]">
                  {mwAccounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              ) : <strong className="truncate">{active.label}{simulate ? ' (simulation only)' : ''}</strong>}
            </span>
            <span className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => openConnections('accounts')} className="mp-mono text-[11px] underline" style={{ color: 'rgba(21,23,28,0.66)' }}>manage</button>
              {realActive && <button onClick={disconnect} className="mp-mono text-[11px] underline" style={{ color: 'rgba(21,23,28,0.66)' }}>disconnect</button>}
            </span>
          </div>
          {!simulate ? (
            <div className="mp-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
              {isDesktopMakerWorldSession(realCookie) ? 'Direct desktop transport · no ModelPrep Worker' : 'Web transport · ModelPrep Worker fallback'}
            </div>
          ) : null}

          <div className="mp-card p-2 text-[12px]" style={{ background: 'rgba(21,23,28,0.03)', color: 'rgba(21,23,28,0.7)' }}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Globe size={13} style={{ color: '#FF5722' }} />
              <span>{isLC ? 'Laser & Cut' : '3D model'} · {isLC ? (modelSource === 'remix' ? 'Remix' : 'Original') : catLabel} · <strong>{visibility}</strong>{bomCount ? ` · BOM ${bomCount}` : ''}{!isLC && modelSource === 'remix' ? ' · Remix' : ''}{!isLC && exclusive ? ' · Exclusive' : ''}{relatedModel ? ' · linked' : ''}{communityPost ? ' · community post' : ''}</span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'rgba(21,23,28,0.66)' }}>Edit these in the <strong>Platforms</strong> step → MakerWorld options.</div>
          </div>

          {!isLC && has3mf && (
            <div className="mp-card p-2 text-[12px] flex items-start gap-2" style={{ background: 'rgba(255,105,0,0.06)', color: 'rgba(21,23,28,0.75)' }}>
              <Layers size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#FF5722' }} />
              <span>Print profile <strong>{profileName}</strong> · {profilePicIds.length || 'no'} photo{profilePicIds.length === 1 ? '' : 's'}. Edit in the <strong>Profiles</strong> step.</span>
            </div>
          )}

          {visibility === 'public' && (
            <div className="text-[12px] p-2 mp-card" style={{ background: 'rgba(255,87,34,0.08)', color: '#B23A1A' }}>
              ⚠️ Publishing <strong>public</strong> submits a real, live listing to MakerWorld (it enters review/"verifying").
            </div>
          )}

          {publishIssues.errors.length > 0 && (
            <div className="mp-card p-2.5 text-[12px] space-y-1" style={{ background: 'rgba(185,28,28,0.07)', borderColor: 'rgba(185,28,28,0.3)', color: '#B91C1C' }}>
              <strong>Complete these MakerWorld fields before publishing:</strong>
              <ul className="list-disc pl-5">{publishIssues.errors.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>
          )}
          {publishIssues.warnings.length > 0 && (
            <div className="mp-card p-2.5 text-[12px] space-y-1" style={{ background: 'rgba(255,182,39,0.09)', color: '#8A4B08' }}>
              <ul className="list-disc pl-5">{publishIssues.warnings.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>
          )}

          {status !== 'done' && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => publish(false)} disabled={status === 'publishing' || publishIssues.errors.length > 0} className="mp-btn text-sm py-2 px-4 disabled:opacity-40">
                {status === 'publishing' ? (progressMsg || 'Publishing…') : `Publish to ${platform.name}`}
              </button>
              <button onClick={() => publish(true)} disabled={status === 'publishing' || draftIssues.length > 0} className="mp-btn mp-btn-ghost text-sm py-2 px-4 disabled:opacity-40">
                <Save size={13} /> Save as MakerWorld draft
              </button>
            </div>
          )}

          {result && (
            <div className="mp-card p-3 space-y-2" style={{ background: 'rgba(21,23,28,0.04)' }}>
              <div className="text-[13px]" style={{ color: 'rgba(21,23,28,0.85)' }}>
                <Check size={14} className="inline" /> {result.demo
                  ? (result.draftOnly ? 'Simulated draft save (demo) — ' : 'Simulated publish (demo) — ')
                  : (result.draftOnly ? 'Saved to MakerWorld — ' : 'Submitted to MakerWorld — ')}status <span className="mp-mono">{result.status}</span> · {result.files} file(s) · {result.visibility}
              </div>
              {result.demo && <div className="mp-mono text-[11px]" style={{ color: '#3A86FF' }}>Nothing was uploaded. Exit Demo mode before using a connected account for a real upload.</div>}
              {result.url && !result.demo && <a href={result.url} target="_blank" rel="noopener noreferrer" className="mp-mono text-[12px] underline break-all block" style={{ color: '#FF5722' }}>{result.url}</a>}
              {/* Post-submit verification — a 200 submit = "accepted for review", not "live". */}
              {!result.demo && !result.draftOnly && (
                <div className="space-y-1">
                  <button onClick={checkLive} disabled={liveCheck?.loading} className="mp-btn mp-btn-ghost text-xs py-1.5 px-3 disabled:opacity-40">{liveCheck?.loading ? 'Checking…' : 'Check if it went live'}</button>
                  {liveCheck && !liveCheck.loading && (
                    liveCheck.failed ? (
                      <div className="mp-card p-2 text-[12px]" style={{ background: 'rgba(185,28,28,0.08)', borderColor: 'rgba(185,28,28,0.35)', color: '#B91C1C' }}>
                        <strong>❌ Rejected by MakerWorld:</strong> {liveCheck.reason}
                        {liveCheck.profileTitle ? <span style={{ opacity: 0.8 }}> (print profile “{liveCheck.profileTitle}”)</span> : null}
                        <div className="mt-1" style={{ opacity: 0.85 }}>Fix the issue and re-publish, or <button onClick={del} className="underline" style={{ color: '#B91C1C' }}>delete this draft</button>.{result.kind === 'laser-cut' ? ' Re-save the source in the current Bambu Suite if package metadata was rejected.' : ' The 3mf must be sliced/exported by Bambu Studio.'}</div>
                      </div>
                    )
                    : liveCheck.error ? <div className="text-[12px]" style={{ color: '#B91C1C' }}>{liveCheck.error}</div>
                    : liveCheck.live ? <div className="text-[12px]" style={{ color: '#1a7f37' }}>✓ Confirmed live on MakerWorld{liveCheck.model?.offlineInstCnt > 0 ? ` (⚠ ${liveCheck.model.offlineInstCnt} print profile(s) offline)` : ''}.</div>
                    : <div className="text-[12px]" style={{ color: '#B23A1A' }}>
                        Not live yet — it's still in <strong>review</strong>, or it was <strong>rejected</strong>.
                        {' '}Check {result.kind === 'laser-cut' ? 'your Laser & Cut drafts on MakerWorld' : <a href="https://makerworld.com/en/my/notification/3DModel" target="_blank" rel="noopener noreferrer" style={{ color: '#FF5722', textDecoration: 'underline' }}>your MakerWorld notifications</a>} for the reason.
                      </div>
                  )}
                </div>
              )}
              <button onClick={del} disabled={status === 'deleting'} className="mp-btn text-xs py-1.5 px-3 disabled:opacity-40">{result.demo ? 'Clear simulated result' : (status === 'deleting' ? 'Deleting…' : (result.draftOnly ? 'Delete this draft' : 'Delete this listing'))}</button>
            </div>
          )}

          <MwMyModels cookie={cookie} isDemo={simulate} kind={isLC ? 'laser-cut' : '3d'} />
        </>
      )}
      {errorMsg && <div className="text-[12px] p-2 mp-card" style={{ background: 'rgba(220,38,38,0.08)', color: '#B91C1C' }}>{errorMsg}</div>}
    </div>
  );
}

// MakerWorld options form — rendered on the Platforms step; edits project.platforms.makerworld.
export function MakerWorldOptions({ opts, project, onUpdate }) {
  useAccounts();
  const cookie = getActive('makerworld')?.secret || '';
  const o = { ...MW_DEFAULT_OPTS, ...(opts || {}) };
  const isLC = o.productMode === 'laser-cut';
  const boms = o.boms || { kits: [], filaments: [], materials: [] };
  const laserInfo = { ...MW_DEFAULT_OPTS.laserInfo, ...(o.laserInfo || {}) };
  const laserProfile = { ...MW_DEFAULT_OPTS.laserProfile, ...(o.laserProfile || {}) };
  const otherParts = o.otherParts || [];
  const bomCount = boms.kits.length + boms.filaments.length + boms.materials.length;
  const [catalog, setCatalog] = useState(null);
  const [catalogErr, setCatalogErr] = useState('');
  const [skuInput, setSkuInput] = useState('');
  const [docGuides, setDocGuides] = useState(mwRuntimeDocs.docGuides);
  const [docOthers, setDocOthers] = useState(mwRuntimeDocs.docOthers);
  const [docNotice, setDocNotice] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const uploadCapabilities = useMakerWorldCapabilities(cookie, !!cookie && !project?.__demo);
  const [cyberFiles, setCyberFiles] = useState(() => ({
    controlConfigs: mwRuntimeCyberBrick.controlConfigs,
    motionConfigs: mwRuntimeCyberBrick.motionConfigs,
    microPython: mwRuntimeCyberBrick.microPython,
    mainControlConfig: mwRuntimeCyberBrick.mainControlConfig,
  }));
  const inputCls = 'mp-card text-[13px] p-2 w-full';
  const profileFiles = (project?.files || []).filter((file) => fileExt(file.name) === '3mf');
  const lacFiles = (project?.files || []).filter((file) => fileExt(file.name) === 'lac');
  const cyberBrickPath = (!isLC && profileFiles.length > 0) || (isLC && o.laserMode === 'lac');
  useEffect(() => {
    if (uploadCapabilities.data?.rcUpload === false && o.cyberBrick) onUpdate('cyberBrick', false);
  }, [uploadCapabilities.data?.rcUpload, o.cyberBrick, onUpdate]);
  const visibleCategories = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase();
    if (!query) return MW_CATEGORIES;
    const matches = MW_CATEGORIES.filter((category) => category.label.toLowerCase().includes(query));
    const selected = MW_CATEGORIES.find((category) => String(category.id) === String(o.categoryId));
    return selected && !matches.some((category) => category.id === selected.id) ? [selected, ...matches] : matches;
  }, [categoryQuery, o.categoryId]);

  const ensureCatalog = async () => { if (catalog) return catalog; try { const c = await loadMwCatalog(cookie); setCatalog(c); return c; } catch (e) { setCatalogErr(e instanceof Error ? e.message : String(e)); return null; } };
  const addBom = (kind, item) => onUpdate('boms', { ...boms, [kind]: [...boms[kind], item] });
  const removeBom = (kind, idx) => onUpdate('boms', { ...boms, [kind]: boms[kind].filter((_, i) => i !== idx) });
  const setOtherParts = (next) => onUpdate('otherParts', typeof next === 'function' ? next(otherParts) : next);
  const addBySku = async () => {
    const c = await ensureCatalog(); if (!c) return;
    for (const kind of ['kits', 'filaments', 'materials']) { const hit = mwFindBySku(c[kind], skuInput); if (hit) { addBom(kind, mwCatalogItem(hit.node, hit.parentIds, 1)); setSkuInput(''); setCatalogErr(''); return; } }
    setCatalogErr(`No catalog item with Product ID "${skuInput.trim()}".`);
  };
  // MakerWorld documentation limits (verified from the upload UI 2026-06-22):
  //   Assembly Guide: pdf/png/jpg/webp/gif · images ≤30MB, pdf ≤50MB · max 25.
  //   Other Files:    txt/pdf/zip · txt ≤2MB, pdf ≤50MB, zip ≤100MB · max 10.
  const validateDocs = (files, kind) => {
    const MB = 1024 * 1024, max = kind === 'guide' ? 25 : 10, rejected = [];
    let ok = Array.from(files).filter((f) => {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const allowed = kind === 'guide' ? ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'] : ['txt', 'pdf', 'zip'];
      if (!allowed.includes(ext)) { rejected.push(`${f.name} (unsupported type)`); return false; }
      const limit = kind === 'guide' ? (ext === 'pdf' ? 50 : 30) : (ext === 'txt' ? 2 : ext === 'pdf' ? 50 : 100);
      if (f.size > limit * MB) { rejected.push(`${f.name} (over ${limit}MB)`); return false; }
      return true;
    });
    if (ok.length > max) { rejected.push(`${ok.length - max} file(s) over the ${max}-file limit`); ok = ok.slice(0, max); }
    return { ok, rejected };
  };
  const setGuides = (files) => { const { ok, rejected } = validateDocs(files, 'guide'); mwRuntimeDocs.docGuides = ok; setDocGuides(ok); setDocNotice(rejected.length ? `Assembly guide — skipped: ${rejected.join('; ')}` : ''); };
  const setOthers = (files) => { const { ok, rejected } = validateDocs(files, 'other'); mwRuntimeDocs.docOthers = ok; setDocOthers(ok); setDocNotice(rejected.length ? `Other files — skipped: ${rejected.join('; ')}` : ''); };
  const setCyberRuntimeFiles = (kind, files) => {
    const allowed = kind === 'microPython' ? ['py', 'mpy'] : ['json'];
    const picked = Array.from(files || []).filter((file) => allowed.includes(fileExt(file.name)));
    const value = kind === 'mainControlConfig' ? (picked[0] || null) : picked;
    mwRuntimeCyberBrick[kind] = value;
    setCyberFiles((previous) => ({ ...previous, [kind]: value }));
  };
  const changeModelSource = (value) => onUpdate(value === 'remix'
    ? { modelSource: 'remix', exclusive: false, exclusiveTermsAccepted: false }
    : { modelSource: value });
  const setLaserInfo = (field, value) => onUpdate('laserInfo', { ...laserInfo, [field]: value });
  const setLaserProfile = (field, value) => onUpdate('laserProfile', { ...laserProfile, [field]: value });

  return (
    <div className="space-y-2.5 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
      <div className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.66)' }}>MakerWorld options</div>
      <div className="flex gap-1 mp-card p-1" style={{ background: 'rgba(21,23,28,0.04)' }}>
        {[['3d', '3D Model'], ['laser-cut', 'Laser & Cut']].map(([m, lbl]) => (
          <button key={m} onClick={() => onUpdate({ productMode: m })} className="flex-1 text-[12px] py-1.5 rounded-sm transition"
            style={o.productMode === m ? { background: '#15171C', color: '#fff' } : { color: 'rgba(21,23,28,0.66)' }}>{lbl}</button>
        ))}
      </div>
      {isLC && (
        <label className="text-[12px] space-y-1 block"><span style={{ color: 'rgba(21,23,28,0.66)' }}>Laser &amp; Cut upload mode</span>
          <select className={inputCls} value={o.laserMode || 'raw'} onChange={(e) => onUpdate('laserMode', e.target.value)}>
            <option value="raw">Raw .lac, SVG, DXF, image, or AI source files</option>
            <option value="lac">Bambu Suite .lac file + print profile</option>
          </select>
        </label>
      )}
      {isLC && o.laserMode === 'lac' && (
        <MwSection title="Bambu Suite profile metadata" hint="auto-read · optional overrides" defaultOpen>
          {lacFiles.length > 0 && (
            <label className="text-[12px] space-y-1 block"><span>Primary Bambu Suite profile package</span>
              <select className={inputCls} value={o.primaryLacFileId || lacFiles[0].id} onChange={(e) => onUpdate('primaryLacFileId', e.target.value)}>
                {lacFiles.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}
              </select>
              <span className="text-[10px] opacity-50">Other Laser files, including additional .lac files, are uploaded as raw model files.</span>
            </label>
          )}
          <div className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>ModelPrep reads <span className="mp-mono">lacInfo</span>, plate data, and <span className="mp-mono">model2DInfo</span> from the .lac package locally. Fill these only when you need to override missing or incorrect package metadata.</div>
          <label className="text-[12px] space-y-1 block"><span>Machine name override</span>
            <input className={inputCls} value={laserInfo.machineName} placeholder="e.g. H2D Laser" onChange={(e) => setLaserInfo('machineName', e.target.value)} />
          </label>
          <label className="text-[12px] space-y-1 block"><span>Process type overrides <span className="opacity-50">(comma-separated)</span></span>
            <input className={inputCls} value={laserInfo.processTypes} placeholder="cut, engrave" onChange={(e) => setLaserInfo('processTypes', e.target.value)} />
          </label>
          <label className="text-[12px] space-y-1 block"><span>Material IDs <span className="opacity-50">(comma-separated)</span></span>
            <input className={inputCls} value={laserInfo.materialIds} onChange={(e) => setLaserInfo('materialIds', e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[12px] space-y-1"><span>Other tools</span><input className={inputCls} value={laserInfo.otherTools} onChange={(e) => setLaserInfo('otherTools', e.target.value)} /></label>
            <label className="text-[12px] space-y-1"><span>Compatible devices</span><input className={inputCls} value={laserInfo.compatibleDevices} placeholder="comma-separated" onChange={(e) => setLaserInfo('compatibleDevices', e.target.value)} /></label>
          </div>
          <div className="pt-2 border-t space-y-2" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
            <div className="mp-mono text-[10px] uppercase tracking-[0.12em] opacity-55">Laser &amp; Cut profile</div>
            <label className="text-[12px] space-y-1 block"><span>Profile name</span>
              <input className={inputCls} maxLength={60} value={laserProfile.title} placeholder="e.g. 3mm plywood · cut and engrave" onChange={(e) => setLaserProfile('title', e.target.value)} />
              <span className="text-[10px] opacity-50 block text-right">{laserProfile.title.length}/60</span>
            </label>
            <label className="text-[12px] space-y-1 block"><span>Profile description <span className="opacity-50">(optional)</span></span>
              <textarea className={`${inputCls} min-h-20`} value={laserProfile.description} onChange={(e) => setLaserProfile('description', e.target.value)} />
            </label>
            <label className="text-[12px] space-y-1 block"><span>Profile visibility</span>
              <select className={inputCls} value={laserProfile.visibility} onChange={(e) => setLaserProfile('visibility', e.target.value)}>
                <option value="private">Private</option><option value="public">Public</option>
              </select>
            </label>
            <label className="flex items-start gap-2 text-[12px]">
              <input type="checkbox" className="mt-0.5" checked={!!laserProfile.useMainCover} onChange={(e) => setLaserProfile('useMainCover', e.target.checked)} />
              <span>Use the main model cover as the profile cover.</span>
            </label>
            {!laserProfile.useMainCover && (
              <div className="grid grid-cols-5 gap-1.5">
                {(project?.images || []).map((image) => (
                  <button key={image.id} type="button" onClick={() => setLaserProfile('coverImageId', image.id)} className="relative aspect-square overflow-hidden"
                    style={{ outline: laserProfile.coverImageId === image.id ? '2px solid #FF5722' : '1px solid rgba(21,23,28,0.15)', outlineOffset: -1 }}>
                    <img src={image.dataUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1">
              <span className="text-[12px]">Additional profile pictures · {(laserProfile.photoIds || []).length}/37</span>
              <div className="grid grid-cols-5 gap-1.5">
                {(project?.images || []).map((image) => {
                  const selected = (laserProfile.photoIds || []).includes(image.id);
                  return (
                    <button key={image.id} type="button" onClick={() => setLaserProfile('photoIds', selected
                      ? (laserProfile.photoIds || []).filter((id) => id !== image.id)
                      : [...(laserProfile.photoIds || []), image.id].slice(0, 37))}
                      className="relative aspect-square overflow-hidden"
                      style={{ outline: selected ? '2px solid #FF5722' : '1px solid rgba(21,23,28,0.15)', outlineOffset: -1 }}>
                      <img src={image.dataUrl} alt="" className="w-full h-full object-cover" style={{ opacity: selected ? 1 : 0.55 }} />
                      {selected && <span className="absolute top-1 right-1 rounded-full flex items-center justify-center" style={{ width: 16, height: 16, background: '#FF5722' }}><Check size={10} color="#fff" /></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </MwSection>
      )}
      <div className="grid grid-cols-2 gap-2">
        {!isLC ? (
          <label className="text-[12px] space-y-1"><span style={{ color: 'rgba(21,23,28,0.66)' }}>Category</span>
            <input className={`${inputCls} mb-1`} value={categoryQuery} onChange={(e) => setCategoryQuery(e.target.value)} placeholder="Search categories…" />
            <select className={inputCls} value={o.categoryId} onChange={(e) => onUpdate('categoryId', e.target.value)}>
              {visibleCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        ) : (
          <label className="text-[12px] space-y-1"><span style={{ color: 'rgba(21,23,28,0.66)' }}>Source</span>
            <select className={inputCls} value={o.modelSource} onChange={(e) => changeModelSource(e.target.value)}>
              <option value="original">Original</option><option value="remix">Remix</option>
            </select>
          </label>
        )}
        <label className="text-[12px] space-y-1"><span style={{ color: 'rgba(21,23,28,0.66)' }}>Visibility</span>
          <select className={inputCls} value={o.visibility} onChange={(e) => onUpdate('visibility', e.target.value)}>
            <option value="private">Private</option><option value="public">Public</option>
          </select>
        </label>
      </div>

      {!isLC && profileFiles.length > 0 && (
        <label className="text-[12px] space-y-1 block"><span style={{ color: 'rgba(21,23,28,0.66)' }}>Initial Bambu Studio print profile</span>
          <select className={inputCls} value={o.primaryProfileFileId || profileFiles[0].id} onChange={(e) => onUpdate('primaryProfileFileId', e.target.value)}>
            {profileFiles.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}
          </select>
          <span className="text-[10px] opacity-50">MakerWorld's new-design flow accepts one initial 3MF profile. Other 3MF files remain raw model files.</span>
        </label>
      )}

      <label className="text-[12px] space-y-1 block"><span style={{ color: 'rgba(21,23,28,0.66)' }}>License</span>
        <select className={inputCls} value={o.license || ''} onChange={(e) => onUpdate('license', e.target.value)}>
          <option value="">Same as Details step</option>
          {MW_LICENSE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <span className="text-[10px] block" style={{ color: 'rgba(21,23,28,0.66)' }}>Defaults to your Details-step license (mapped to MakerWorld). Override for MakerWorld-only licenses (Exclusive, SDFL-PPO…).</span>
      </label>

      <MwSection title="Source & remix" hint="original or remix" badge={o.modelSource === 'remix' ? '1' : 0}>
        {!isLC && (
          <label className="text-[12px] space-y-1 block"><span style={{ color: 'rgba(21,23,28,0.66)' }}>Model source</span>
            <select className={inputCls} value={o.modelSource} onChange={(e) => changeModelSource(e.target.value)}>
              <option value="original">Original design</option>
              <option value="remix">Remix of another model</option>
            </select>
          </label>
        )}
        {o.modelSource === 'remix' && (
            <div className="space-y-1">
              <div className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>Paste any source URL, or search your own MakerWorld designs:</div>
              <input className={inputCls} type="url" value={o.remixUrl || ''} placeholder="https://makerworld.com/en/models/… or another source"
                onChange={(e) => onUpdate({ remixUrl: e.target.value, remixModel: null })} />
              <MwRelatedSearch cookie={cookie} type={isLC ? 1 : 0} selected={o.remixModel}
                onSelect={(value) => onUpdate({ remixModel: value, remixUrl: value ? `https://makerworld.com/en/models/${value.id}` : '' })}
                label="Search your MakerWorld designs…" />
              {!o.remixModel && (
                <label className="text-[12px] space-y-1 block"><span>Original model license</span>
                  <select className={inputCls} value={o.remixLicense || ''} onChange={(e) => onUpdate('remixLicense', e.target.value)}>
                    <option value="">Choose the source license…</option>
                    {MW_LICENSE_OPTIONS.map((licenseOption) => <option key={licenseOption.value} value={licenseOption.value}>{licenseOption.label}</option>)}
                  </select>
                </label>
              )}
              {o.remixLicense && !makerWorldLicenseAllowsRemix(o.remixLicense) && (
                <div className="text-[11px]" style={{ color: '#B91C1C' }}>This license does not allow derivative/remix uploads.</div>
              )}
              <label className="text-[12px] space-y-1 block"><span>What did you change?</span>
                <textarea className={`${inputCls} min-h-20`} value={o.remixDescription || ''} maxLength={2000}
                  placeholder="Describe the parts, geometry, sizing, or print setup you changed."
                  onChange={(e) => onUpdate('remixDescription', e.target.value)} />
              </label>
            </div>
        )}
      </MwSection>
      <MwSection title={isLC ? 'Linked 3D model' : 'Linked Laser & Cut model'} hint="optional" badge={o.relatedModel ? '1' : 0}>
        <div className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>{isLC ? 'Link a published 3D model that pairs with this Laser & Cut design.' : 'Link a published Laser & Cut model that pairs with this 3D model.'}</div>
        <MwRelatedSearch cookie={cookie} type={isLC ? 0 : 1} selected={o.relatedModel} onSelect={(v) => onUpdate('relatedModel', v)} label={isLC ? 'Search your 3D models…' : 'Search your Laser & Cut models…'} />
      </MwSection>
      {cyberBrickPath && uploadCapabilities.data?.rcUpload === false && (
        <div className="text-[11px] p-2 mp-card" style={{ background: 'rgba(255,182,39,0.10)', color: 'rgba(21,23,28,0.7)' }}>
          CyberBrick upload is not enabled for this MakerWorld account.
        </div>
      )}
      {cyberBrickPath && uploadCapabilities.data?.rcUpload !== false && (
        <MwSection title="CyberBrick" hint="optional RC model" badge={o.cyberBrick ? cyberFiles.controlConfigs.length : 0}>
          <label className="flex items-start gap-2 text-[12px]">
            <input type="checkbox" className="mt-0.5" checked={!!o.cyberBrick} onChange={(e) => onUpdate('cyberBrick', e.target.checked)} />
            <span>This model uses CyberBrick control files.</span>
          </label>
          {o.cyberBrick && (
            <div className="space-y-2">
              <label className="text-[12px] space-y-1 block"><span>Control configuration JSONs (required) · {cyberFiles.controlConfigs.length}</span>
                <input type="file" multiple accept=".json,application/json" className="text-[11px] w-full" onChange={(e) => setCyberRuntimeFiles('controlConfigs', e.target.files)} />
              </label>
              <label className="text-[12px] space-y-1 block"><span>Motion configuration JSONs (optional) · {cyberFiles.motionConfigs.length}</span>
                <input type="file" multiple accept=".json,application/json" className="text-[11px] w-full" onChange={(e) => setCyberRuntimeFiles('motionConfigs', e.target.files)} />
              </label>
              <label className="text-[12px] space-y-1 block"><span>Main controller JSON (optional)</span>
                <input type="file" accept=".json,application/json" className="text-[11px] w-full" onChange={(e) => setCyberRuntimeFiles('mainControlConfig', e.target.files)} />
              </label>
              <label className="text-[12px] space-y-1 block"><span>MicroPython files (optional) · {cyberFiles.microPython.length}</span>
                <input type="file" multiple accept=".py,.mpy" className="text-[11px] w-full" onChange={(e) => setCyberRuntimeFiles('microPython', e.target.files)} />
              </label>
            </div>
          )}
        </MwSection>
      )}
      {cyberBrickPath && uploadCapabilities.error && (
        <div className="text-[10px]" style={{ color: '#B91C1C' }}>CyberBrick eligibility could not be verified: {uploadCapabilities.error}</div>
      )}
      {!isLC && (
        <MwSection title="Bill of Materials" hint="kits · filaments · materials" badge={bomCount + otherParts.length || 0}>
          <div className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>Pick Maker's Supply catalog items, enter a Product ID, or list free-text parts.</div>
          {!catalog ? (
            <button onClick={ensureCatalog} className="mp-btn text-[11px] py-1.5 px-3">Load BOM catalog</button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input className="mp-card text-[12px] p-1.5 flex-1" placeholder="Product ID (e.g. B-ZH113)" value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBySku(); } }} />
                <button onClick={addBySku} disabled={!skuInput.trim()} className="mp-btn text-[11px] py-1.5 px-3 disabled:opacity-40">Add by ID</button>
              </div>
              {[['kits', 'Kits & Parts'], ['filaments', 'Filaments'], ['materials', 'Materials']].map(([kind, lbl]) => (
                <div key={kind} className="space-y-1.5">
                  <div className="mp-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'rgba(21,23,28,0.66)' }}>{lbl}</div>
                  <MwBomPicker roots={catalog[kind]} onAdd={(item) => addBom(kind, item)} />
                  {boms[kind].map((it, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px] mp-card p-1.5" style={{ background: 'rgba(21,23,28,0.04)' }}>
                      {it.image && <img src={it.image} alt="" className="w-6 h-6 object-cover" />}
                      <span className="flex-1 truncate">{it.title} <span className="mp-mono opacity-50">×{it.quantity}</span></span>
                      <button onClick={() => removeBom(kind, i)} className="opacity-50 hover:opacity-100"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              ))}
              <div className="space-y-1.5">
                <div className="mp-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'rgba(21,23,28,0.66)' }}>Other parts (free text)</div>
                {otherParts.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_64px_1fr_auto] items-center gap-1.5 text-[12px] mp-card p-1.5" style={{ background: 'rgba(21,23,28,0.04)' }}>
                    <input className="mp-input text-[11px]" value={p.name} placeholder="Part name" onChange={(e) => setOtherParts((items) => items.map((item, index) => index === i ? { ...item, name: e.target.value } : item))} />
                    <input className="mp-input text-[11px]" type="number" min={1} value={p.quantity} onChange={(e) => setOtherParts((items) => items.map((item, index) => index === i ? { ...item, quantity: Math.max(1, Number(e.target.value) || 1) } : item))} />
                    <input className="mp-input text-[11px]" value={p.note || ''} placeholder="Note (optional)" onChange={(e) => setOtherParts((items) => items.map((item, index) => index === i ? { ...item, note: e.target.value } : item))} />
                    <button onClick={() => setOtherParts(arr => arr.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100"><X size={13} /></button>
                  </div>
                ))}
                <button onClick={() => setOtherParts(arr => [...arr, { name: '', quantity: 1, note: '' }])} className="mp-btn mp-btn-ghost text-[11px] py-1 px-2"><Plus size={11} /> Add other part</button>
              </div>
            </>
          )}
          {catalogErr && <div className="text-[11px]" style={{ color: '#B91C1C' }}>{catalogErr}</div>}
        </MwSection>
      )}
      <MwSection title="Documentation" hint="assembly guide · other files" badge={docGuides.length + docOthers.length || 0}>
        <label className="text-[12px] space-y-1 block"><span style={{ color: 'rgba(21,23,28,0.66)' }}>Assembly guide ({docGuides.length}/25 · pdf/png/jpg/webp/gif · img ≤30MB, pdf ≤50MB)</span>
          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" className="text-[11px] w-full" onChange={(e) => setGuides(e.target.files || [])} />
        </label>
        {docGuides.length > 0 && <div className="text-[11px] opacity-60">{docGuides.map(f => f.name).join(', ')}</div>}
        <label className="text-[12px] space-y-1 block"><span style={{ color: 'rgba(21,23,28,0.66)' }}>Other files ({docOthers.length}/10 · txt ≤2MB, pdf ≤50MB, zip ≤100MB)</span>
          <input type="file" multiple accept=".txt,.pdf,.zip" className="text-[11px] w-full" onChange={(e) => setOthers(e.target.files || [])} />
        </label>
        {docOthers.length > 0 && <div className="text-[11px] opacity-60">{docOthers.map(f => f.name).join(', ')}</div>}
        {docNotice && <div className="text-[11px]" style={{ color: '#c83f10' }}>{docNotice}</div>}
        <div className="text-[10px] opacity-50">Docs are kept for this session (not saved with the project).</div>
      </MwSection>
      {!isLC && (
        <div className="space-y-1.5">
          <label className="flex items-start gap-2 text-[12px]" style={{ color: 'rgba(21,23,28,0.7)' }}>
            <input type="checkbox" disabled={o.modelSource === 'remix'} checked={!!o.exclusive}
              onChange={(e) => onUpdate({ exclusive: e.target.checked, exclusiveTermsAccepted: false })} className="mt-0.5" />
            <span>Join the <strong>Exclusive Model Program</strong> for this model.{o.modelSource === 'remix' ? ' Remixes are not eligible.' : ''}</span>
          </label>
          {o.exclusive && (
            <label className="flex items-start gap-2 text-[12px] ml-5 mp-card p-2" style={{ background: 'rgba(255,105,0,0.06)' }}>
              <input type="checkbox" className="mt-0.5" checked={!!o.exclusiveTermsAccepted} onChange={(e) => onUpdate('exclusiveTermsAccepted', e.target.checked)} />
              <span>I have read and agree to MakerWorld's <a className="underline" href="https://makerworld.com/en/exclusive-model-program" target="_blank" rel="noopener noreferrer">Exclusive Model Program terms</a>, including the exclusivity obligation.</span>
            </label>
          )}
        </div>
      )}
      {!isLC && (
        <label className="flex items-center gap-2 text-[12px]" style={{ color: 'rgba(21,23,28,0.7)' }}>
          <input type="checkbox" checked={!!o.communityPost} onChange={(e) => onUpdate('communityPost', e.target.checked)} /> Also create a community post
        </label>
      )}
      {isLC && (
        <div className="text-[12px] p-2 mp-card" style={{ background: 'rgba(255,105,0,0.06)', color: 'rgba(21,23,28,0.7)' }}>
          Laser &amp; Cut accepts <span className="mp-mono">{MAKERWORLD_LASER_FORMATS.map((format) => `.${format}`).join(' ')}</span>. Bambu Suite .lac mode also creates a Laser &amp; Cut print profile; raw .lac files remain source files.
        </div>
      )}
      {!cookie && <div className="text-[11px]" style={{ color: '#B23A1A' }}>Connect MakerWorld (in Connections) to search for remix/linked models.</div>}
    </div>
  );
}
// Render a project image to a platform-correct image Blob: crop to the exact target
// aspect/dimensions using the image's focal point, and re-encode (default JPEG) — so the
// UPLOADED file matches the per-platform preview, in an accepted format and a sane size.
function cropImageToBlob(image, w, h, mime = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        const aspect = w / h;
        const srcA = img.naturalWidth / img.naturalHeight;
        const fx = image.focal?.x ?? 0.5, fy = image.focal?.y ?? 0.5;
        let sx, sy, sw, sh;
        if (srcA > aspect) { sh = img.naturalHeight; sw = sh * aspect; sy = 0; sx = (img.naturalWidth - sw) * fx; }
        else { sw = img.naturalWidth; sh = sw / aspect; sx = 0; sy = (img.naturalHeight - sh) * fy; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('crop encode failed')), mime, quality);
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = image.dataUrl;
  });
}

function CoverPreview({ image, cover, onDownload, hideDownload }) {
  const canvasRef = useRef(null);
  const preserveOriginal = !cover.w || !cover.h;
  useEffect(() => {
    if (preserveOriginal || !canvasRef.current || !image) return;
    const img = document.createElement('img');
    img.onload = () => {
      const c = canvasRef.current; if (!c) return;
      const aspect = cover.w / cover.h;
      const dispW = 400, dispH = dispW / aspect;
      c.width = dispW; c.height = dispH;
      const ctx = c.getContext('2d');
      const srcA = img.naturalWidth / img.naturalHeight;
      let sx, sy, sw, sh;
      if (srcA > aspect) { sh = img.naturalHeight; sw = sh * aspect; sy = 0; sx = (img.naturalWidth - sw) * image.focal.x; }
      else { sw = img.naturalWidth; sh = sw / aspect; sx = 0; sy = (img.naturalHeight - sh) * image.focal.y; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dispW, dispH);
    };
    img.src = image.dataUrl;
  }, [image, cover, preserveOriginal]);
  return (
    <div className="relative group" role="img" aria-label={preserveOriginal ? `${image?.alt || 'Project image'} kept at original aspect` : `${image?.alt || 'Project image'} cropped for ${cover.label}, ${cover.w} by ${cover.h} pixels`}>
      <div className="overflow-hidden" style={{ background: '#15171C' }}>
        {preserveOriginal
          ? <img src={image.dataUrl} alt="" className="w-full max-h-96 object-contain" />
          : <canvas ref={canvasRef} className="w-full block" />}
      </div>
      <div className="absolute top-2 left-2 mp-mono text-[11px] uppercase tracking-[0.15em] px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
        {preserveOriginal ? `${cover.label} · original aspect` : `${cover.label} · ${cover.w}×${cover.h}`}
      </div>
      {!hideDownload && (
        <button
          onClick={onDownload}
          className="absolute bottom-2 right-2 mp-mono text-[12px] uppercase tracking-[0.2em] py-1.5 px-2 flex items-center gap-1.5 transition"
          style={{ background: '#15171C', color: '#fff' }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#FF5722'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#15171C'}
        >
          <Download size={11} /> JPG
        </button>
      )}
    </div>
  );
}

function GalleryThumb({ image, mainCover, onDownload, hideDownload }) {
  return (
    <div className="relative group aspect-square overflow-hidden" style={{ background: '#15171C' }}>
      <img
        src={image.dataUrl}
        alt={image.alt || 'Project gallery image'}
        className="w-full h-full object-cover"
        style={{ objectPosition: `${image.focal.x * 100}% ${image.focal.y * 100}%` }}
      />
      {!hideDownload && (
        <button
          onClick={onDownload}
          aria-label="Download this image as JPG"
          title="Download JPG"
          className="absolute bottom-1 right-1 p-1.5 flex items-center justify-center transition hover:bg-[#FF5722]"
          style={{ background: 'rgba(21,23,28,0.85)', color: '#fff' }}
        >
          <Download size={14} />
        </button>
      )}
    </div>
  );
}


// Read-only "what will be published" preview for API platforms — cover cropped to the
// platform's spec, title, rendered description, tags, gallery — collapsed by default,
// with jump-to-edit links. Lets you verify per-platform before publishing without the
// old copy-paste clutter, and without diving into each step.
function PlatformPreview({ platform, project, cover, setCurrentSection }) {
  const [open, setOpen] = useState(false);
  const galleryImgs = project.images.filter(i => i.id !== project.coverImageId).slice(0, galleryCapacity(platform));
  const descHtml = mdToHtml(project.description || '');
  const Edit = ({ to, label = 'edit' }) => <button onClick={() => setCurrentSection?.(to)} className="mp-mono text-[11px] underline" style={{ color: '#FF5722' }}>{label}</button>;
  const lbl = (t) => <span className="text-[11px]" style={{ color: 'rgba(21,23,28,0.66)' }}>{t}</span>;
  return (
    <div className="mp-card" style={{ background: 'rgba(21,23,28,0.02)' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-2.5 text-left">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-[13px] font-medium" style={{ color: '#15171C' }}>Preview listing</span>
        <span className="text-[11px] ml-auto truncate" style={{ color: 'rgba(21,23,28,0.66)', maxWidth: '55%' }}>{project.title || '(no title)'} · {project.images.length} img · {project.tags.length} tags</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {cover ? (
            <div>
              <div className="flex items-center justify-between mb-1">{lbl(`Cover · ${platform.covers.map(c => `${c.w}×${c.h}`).join(' · ')}`)}<Edit to="images" /></div>
              <div
                className="grid gap-2 max-w-[720px]"
                style={{ gridTemplateColumns: platform.covers.length > 1 ? 'minmax(0,2fr) minmax(140px,1fr)' : 'minmax(0,420px)' }}
              >
                {platform.covers.map(c => <CoverPreview key={c.id} image={cover} cover={c} hideDownload />)}
              </div>
            </div>
          ) : <div className="text-[11px]" style={{ color: '#B23A1A' }}>No cover image — <Edit to="images" label="add one in Images" />.</div>}

          <div><div className="flex items-center justify-between mb-1">{lbl('Title')}<Edit to="details" /></div><div className="text-[14px] font-medium">{project.title || <span style={{ opacity: 0.4 }}>(no title)</span>}</div></div>

          <div><div className="flex items-center justify-between mb-1">{lbl(`Description · ${platform.descFormat}`)}<Edit to="details" /></div>
            <div className="mp-prose text-[13px] max-h-44 overflow-auto mp-card p-2.5" style={{ background: '#fff' }} dangerouslySetInnerHTML={{ __html: descHtml || '<span style="opacity:.4">(no description)</span>' }} /></div>

          <div><div className="flex items-center justify-between mb-1">{lbl(`Tags · ${project.tags.length}`)}<Edit to="details" /></div><div className="text-[12px]" style={{ color: 'rgba(21,23,28,0.8)' }}>{project.tags.join(', ') || <span style={{ opacity: 0.4 }}>(none)</span>}</div></div>

          {galleryImgs.length > 0 && (
            <div><div className="flex items-center justify-between mb-1">{lbl(`Gallery · ${galleryImgs.length}`)}<Edit to="images" /></div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {galleryImgs.slice(0, 6).map(img => <GalleryThumb key={img.id} image={img} mainCover={platform.covers[0]} hideDownload />)}
                {galleryImgs.length > 6 && (
                  <div className="aspect-square flex items-center justify-center mp-mono text-[11px]" style={{ background: 'rgba(21,23,28,0.06)' }}>+{galleryImgs.length - 6}</div>
                )}
              </div></div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// SHARED UI BITS
// =====================================================================

function SectionHeader({ number, title, subtitle }) {
  return (
    <div data-testid="section-header" className="border-b pb-3 sm:pb-4" style={{ borderColor: 'rgba(21,23,28,0.15)' }}>
      <div className="flex items-center gap-3 mb-1.5">
        <span className="mp-mono text-[12px] tracking-[0.3em]" style={{ color: '#FF5722' }}>
          <span className="mp-dimline">STEP {number}</span>
        </span>
        <div className="flex-1 mp-tickrule" />
        <span className="mp-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.66)' }}>
          /// modelprep
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="mp-display text-[30px] sm:text-[36px] leading-none" style={{ color: '#15171C' }}>{title}</h2>
        <p className="mp-body w-full text-[14px] leading-5" style={{ color: 'rgba(21,23,28,0.65)' }}>{subtitle}</p>
      </div>
    </div>
  );
}

function SectionNav({ backLabel, nextLabel, nextDisabled, onBack, onNext, disabledReason }) {
  // Sticky just above the fixed 32px status bar, so Back/Next are always reachable
  // without scrolling to the end of long pages (e.g. the 9-crop Images preview).
  return (
    <>
      <div aria-hidden="true" className="h-8 flex-shrink-0" />
      <div
        data-testid="section-nav"
        className="sticky bottom-8 z-[15] mt-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-t flex items-center justify-between gap-4"
        style={{ borderColor: 'rgba(21,23,28,0.14)', background: 'rgba(237,233,222,0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      >
        <div>
          {backLabel && (
            <button onClick={onBack} className="mp-btn mp-btn-ghost text-xs">
              <ChevronRight size={12} className="rotate-180" /> {backLabel}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 justify-end text-right">
          {nextLabel && nextDisabled && disabledReason && (
            <span className="hidden sm:block mp-body text-[13px] leading-snug" style={{ color: 'rgba(21,23,28,0.66)' }}>{disabledReason}</span>
          )}
          {nextLabel && (
            <button onClick={onNext} disabled={nextDisabled} className="mp-btn flex-shrink-0">
              {nextLabel} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
