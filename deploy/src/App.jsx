import React, { useState, useRef, useEffect, useMemo, useReducer, createContext, useContext } from 'react';
import {
  mdToHtml, mdToPlain, formatBytes,
  fileExt, isModelFile, isProfile, isImageFile, slugify, uniqueFileName,
} from './lib/format';
import {
  Upload, Download, Copy, Image as ImageIcon, FileText, Check, Sparkles,
  Folder, Send, Star, X, Plus, Trash2, ChevronRight, ChevronDown, ChevronUp,
  AlertCircle, Layers, FileCheck, Loader, Save, Bookmark, Search, Clock,
  Globe, DollarSign, Info, Edit3, ArrowRight, User, LogOut
} from 'lucide-react';
import { useAccounts, getActive, CONNECTABLE } from './lib/accounts.js';

// Lets any component open the Connections (accounts) modal without prop-threading.
const ConnectionsCtx = createContext(() => {});
const useOpenConnections = () => useContext(ConnectionsCtx);

// Build stamp (injected by vite.config.js) — shows exactly which version is running.
const BUILD_COMMIT = (typeof __BUILD_COMMIT__ !== 'undefined' ? __BUILD_COMMIT__ : 'dev');
const BUILD_TIME = (typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '');
const BUILD_LABEL = BUILD_TIME
  ? `${BUILD_COMMIT} · ${new Date(BUILD_TIME).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
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
  makerworld:  'https://makerworld.com/en/my/upload',
  printables:  'https://www.printables.com/model/new',
  cults:       'https://cults3d.com/en/upload',
  mmf:         'https://www.myminifactory.com/object/new',
  thingiverse: 'https://www.thingiverse.com/upload',
  thangs:      'https://thangs.com/3d-model/upload',
  nexprint:    'https://www.nexprint.com/en/upload',
  creality:    'https://www.crealitycloud.com/createWork',
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
};

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
const RICH_TEXT_PLATFORMS = ['makerworld'];
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

const PLATFORMS = [
  {
    id: 'makerworld', name: 'MakerWorld', org: 'Bambu Lab', dot: '#FF6900',
    covers: [
      { id: 'web', label: 'Web cover', w: 1920, h: 1440, aspect: '4:3' },
      { id: 'app', label: 'App cover', w: 1500, h: 2000, aspect: '3:4' },
    ],
    descFormat: 'html', maxImages: 16, maxFileMb: 150, maxTotalMb: 250,
    formats: ['3mf', 'stl', 'step', 'obj'], hasApi: false, apiSupport: 'manual',
    fields: ['remix'], note: 'Largest audience. Real photo of print required. Connects Printables/Thingiverse for import.',
  },
  {
    id: 'printables', name: 'Printables', org: 'Prusa Research', dot: '#FA6831',
    covers: [{ id: 'cover', label: 'Cover', w: 1920, h: 1440, aspect: '4:3' }],
    descFormat: 'markdown', maxImages: 25, maxFileMb: 500, maxTotalMb: 2000,
    formats: ['stl', '3mf', 'obj', 'step', 'zip'], hasApi: false, apiSupport: 'manual',
    fields: [], note: 'High file limits. Markdown description. Active contests.',
  },
  {
    id: 'cults', name: 'Cults3D', org: 'Independent', dot: '#F79E2E',
    covers: [{ id: 'cover', label: 'Cover', w: 1500, h: 1500, aspect: '1:1' }],
    // Verified from Cults's web upload form (May 2026): 40 accepted file types,
    // 1 GB per file, images max 10 MB / 8000×8000 px, jpg/png/webp + webm/mp4 video.
    descFormat: 'markdown', maxImages: 20, maxFileMb: 1000, maxTotalMb: 2000,
    formats: ['3ds', '3mf', 'ai', 'amf', 'bin', 'blend', 'bmp', 'curaprofile', 'dae', 'doc', 'dst', 'dwg', 'dxf', 'eps', 'f3d', 'f3z', 'fcstd', 'fff', 'gbr', 'gbx', 'gcode', 'ini', 'mtl', 'obj', 'pdf', 'ply', 'ppt', 'psd', 'rcp', 'scad', 'skp', 'sldasm', 'sldprt', 'step', 'stl', 'stp', 'svg', 'txt', 'x3d', 'zip'],
    hasApi: true, apiSupport: 'oneclick',
    fields: ['price'], note: 'GraphQL API. Paid marketplace, 80% creator share. Accepts video (mp4/webm). Real-photo emphasis: place prints first in gallery.',
  },
  {
    id: 'mmf', name: 'MyMiniFactory', org: 'SoulCrafted', dot: '#4FB286',
    covers: [{ id: 'cover', label: 'Cover', w: 1920, h: 1440, aspect: '4:3' }],
    descFormat: 'html', maxImages: 20, maxFileMb: 100, maxTotalMb: 500,
    formats: ['stl', 'obj', '3mf', 'zip'], hasApi: true, apiSupport: 'oneclick',
    fields: ['price'], note: 'REST + OAuth2. Curated, test print before publish.',
  },
  {
    id: 'thingiverse', name: 'Thingiverse', org: 'MyMiniFactory', dot: '#248BFB',
    covers: [{ id: 'cover', label: 'Cover', w: 1600, h: 1200, aspect: '4:3' }],
    descFormat: 'plain', maxImages: 20, maxFileMb: 100, maxTotalMb: 250,
    formats: ['stl', '3mf', 'obj', 'scad', 'dxf', 'svg', 'pdf'], hasApi: true, apiSupport: 'oneclick',
    fields: [], note: 'OAuth2 REST API. Largest legacy library.',
  },
  {
    id: 'thangs', name: 'Thangs', org: 'Physna', dot: '#3A86FF',
    covers: [{ id: 'cover', label: 'Cover', w: 1920, h: 1440, aspect: '4:3' }],
    descFormat: 'html', maxImages: 15, maxFileMb: 100, maxTotalMb: 500,
    formats: ['stl', '3mf', 'obj', 'step', 'blend', 'fbx', 'glb'], hasApi: false, apiSupport: 'addon',
    fields: [], note: 'Search engine + repo. Ships Blender addon for upload.',
  },
  {
    id: 'nexprint', name: 'Nexprint', org: 'Elegoo', dot: '#FFB627',
    covers: [{ id: 'cover', label: 'Cover', w: 1920, h: 1440, aspect: '4:3' }],
    descFormat: 'markdown', maxImages: 12, maxFileMb: 100, maxTotalMb: 250,
    formats: ['3mf', 'stl', 'obj', 'step', 'amf'], hasApi: false, apiSupport: 'manual',
    fields: ['contestEntry'], note: 'New (Aug 2025), $1M creator fund, $5 per approved model.',
  },
  {
    id: 'creality', name: 'Creality Cloud', org: 'Creality', dot: '#E63946',
    covers: [{ id: 'cover', label: 'Cover', w: 1600, h: 1200, aspect: '4:3' }],
    descFormat: 'html', maxImages: 15, maxFileMb: 100, maxTotalMb: 300,
    formats: ['stl', '3mf', 'obj', 'step'], hasApi: false, apiSupport: 'manual',
    fields: [], note: 'Manufacturer-tied, large Creality user base.',
  },
];

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
  { id: 'images',    label: 'Images',    icon: ImageIcon, description: 'Cover and gallery photos with per-platform crops' },
  { id: 'profiles',  label: 'Profiles',  icon: Layers,    description: 'Print profile per 3MF, with own description' },
  { id: 'platforms', label: 'Platforms', icon: Globe,     description: 'Choose where to publish and platform-specific options' },
  { id: 'publish',   label: 'Publish',   icon: Send,      description: 'Review and (mock) upload to each platform' },
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
    `- ${platform.covers.length} cover image(s), named 01_cover_*.jpg`,
    `- ${Math.min(Math.max(0, imageCount - 1), platform.maxImages - 1)} gallery image(s), named 02_gallery_*.jpg, 03_gallery_*.jpg, ...`,
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
    `3. Drag 01_cover_*.jpg into the cover image slot.`,
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
    onProgress('Cropping cover');
    const coverImg = await loadImageFromDataUrl(cover.dataUrl);
    for (const c of platform.covers) {
      const canvas = cropToCanvas(coverImg, c.w, c.h, cover.focal);
      const blob = await canvasToBlob(canvas);
      const label = platform.covers.length > 1 ? `cover_${c.id}` : 'cover';
      zip.file(`${String(counter++).padStart(2, '0')}_${label}_${c.w}x${c.h}.jpg`, blob);
    }
  }

  // 2. Gallery images (cover excluded), capped at the platform's max.
  const others = project.images.filter(i => i.id !== project.coverImageId);
  const galleryLimit = Math.min(others.length, platform.maxImages - 1);
  for (let i = 0; i < galleryLimit; i++) {
    onProgress(`Cropping gallery ${i + 1}/${galleryLimit}`);
    const galImg = await loadImageFromDataUrl(others[i].dataUrl);
    const canvas = cropToCanvas(galImg, main.w, main.h, others[i].focal);
    const blob = await canvasToBlob(canvas);
    zip.file(`${String(counter++).padStart(2, '0')}_gallery_${String(i + 1).padStart(2, '0')}_${main.w}x${main.h}.jpg`, blob);
  }

  // 3. Per-profile covers — each 3MF profile that opted for its own image.
  const profileCovers = (project.profiles || []).filter(p => !p.useMainCover && p.coverImageId);
  if (profileCovers.length) {
    const pfolder = zip.folder('profile_covers');
    for (const prof of profileCovers) {
      const pimg = project.images.find(im => im.id === prof.coverImageId);
      if (!pimg) continue;
      onProgress(`Cropping profile cover: ${prof.name}`);
      const loaded = await loadImageFromDataUrl(pimg.dataUrl);
      const canvas = cropToCanvas(loaded, main.w, main.h, pimg.focal);
      const blob = await canvasToBlob(canvas);
      pfolder.file(`${slugify(prof.name) || 'profile'}_${main.w}x${main.h}.jpg`, blob);
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
  productMode: '3d', modelSource: 'original', exclusive: false, communityPost: false,
  remixModel: null, relatedModel: null,
  boms: { kits: [], filaments: [], materials: [] }, otherParts: [],
};
// Runtime-only holder for File-based MakerWorld docs (can't live in serializable project state).
const mwRuntimeDocs = { docGuides: [], docOthers: [] };

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
  coverImageId: null,
  title: '',
  description: '',
  category: '',
  tags: [],
  license: 'ccbync',
  profiles: [],
  platforms: {
    makerworld: { enabled: true, ...MW_DEFAULT_OPTS },
    printables: { enabled: true },
    cults: { enabled: true, price: 0, free: true, visibility: 'secret' },
    mmf: { enabled: true, price: 0, free: true },
    thingiverse: { enabled: true },
    thangs: { enabled: true },
    nexprint: { enabled: false, contestEntry: '' },
    creality: { enabled: false },
  },
};

// --- Demo data ---------------------------------------------------------------
// A fully-populated project so users can click through what a finished, filled-in
// project looks like (files, cropped images, profiles, every field, platforms),
// then toggle off to return to their own work.
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
      printables: { enabled: true },
      cults: { enabled: true, price: 4.5, free: false },
      mmf: { enabled: true, price: 0, free: true },
      thingiverse: { enabled: true },
      thangs: { enabled: false },
      nexprint: { enabled: true, contestEntry: 'creator-fund' },
      creality: { enabled: false },
    },
  };
}

// --- Autosave (localStorage) -------------------------------------------------
// We persist only serializable METADATA — not files (File blobs) or image pixels
// (base64 dataUrls would blow the ~5MB quota). Restoring brings back the typed
// description, tags, category, license and per-platform settings; files/images
// are re-added by the user.
const AUTOSAVE_KEY = 'modelprep:autosave:v1';
function serializeProjectMeta(p) {
  return {
    name: p.name, title: p.title, description: p.description,
    tags: p.tags, category: p.category, license: p.license,
    platforms: p.platforms,
    savedAt: Date.now(),
  };
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

export default function App() {
  const [project, dispatchProject] = useReducer(projectReducer, initialProject);
  const [currentSection, setCurrentSection] = useState('files');
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [dialog, setDialog] = useState(null); // styled prompt/confirm modal
  const [demoActive, setDemoActive] = useState(false);
  const [showConnections, setShowConnections] = useState(false); // Connections (accounts) modal
  const stashedProject = useRef(null);

  // Demo mode: fill the whole project with sample data so users can click through
  // a finished UI, then toggle off to restore their own work. We stash the real
  // project on enter and never autosave while demo is on (see autosave effect).
  const toggleDemo = () => {
    if (!demoActive) {
      stashedProject.current = project;
      // Persist the real project's text/settings now, so it survives even a reload
      // while in demo (autosave is suppressed during demo).
      try {
        if (projectHasContent(project)) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeProjectMeta(project)));
      } catch (e) { /* ignore */ }
      setProject(buildDemoProject());
      setDemoActive(true);
      setCurrentSection('files');
    } else {
      setProject(stashedProject.current || { ...initialProject, name: 'Untitled Project' });
      stashedProject.current = null;
      setDemoActive(false);
    }
  };

  // Thin dispatchers — keep the existing call-site shapes working:
  //   updateProject({ ...patch })         shallow-merge
  //   setProject(prev => next) / setProject(obj)   functional or full replace
  const updateProject = (patch) => dispatchProject({ type: 'PATCH', patch });
  const setProject = (v) => dispatchProject(typeof v === 'function' ? { type: 'APPLY', updater: v } : { type: 'SET', value: v });

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
          parsed: mockParseThreeMF(f.name),
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
    setDialog({
      kind: 'confirm',
      title: 'Restore text & settings?',
      message: `We saved your text${saved.title ? ` for “${saved.title}”` : ''} — title, description, tags, category, license and platform settings. We could NOT save your model files, images, or print profiles, so you'll need to re-add those.`,
      confirmLabel: 'Restore text & settings',
      onConfirm: () => updateProject({
        name: saved.name || 'Untitled Project',
        title: saved.title || '',
        description: saved.description || '',
        tags: saved.tags || [],
        category: saved.category || '',
        license: saved.license || 'ccbync',
        platforms: saved.platforms || initialProject.platforms,
      }),
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
  const isDirty = () => project.files.length || project.images.length || project.title || project.description || project.tags.length || Object.values(project.platforms).some(p => p.enabled);
  const newProject = () => {
    const reset = () => {
      try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) { /* ignore */ }
      setDemoActive(false);
      stashedProject.current = null;
      setProject({ ...initialProject, name: 'Untitled Project' });
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
    <ConnectionsCtx.Provider value={() => setShowConnections(true)}>
    <div className="min-h-screen w-full" style={{ background: '#EDE9DE', color: '#15171C', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <GlobalStyles />

      {/* Background workshop pattern: subtle layer lines */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(21,23,28,0.022) 0px, rgba(21,23,28,0.022) 1px, transparent 1px, transparent 7px)',
        zIndex: 0,
      }} />
      <div className="relative z-10">

      <TopHeader
        project={project}
        updateProject={updateProject}
        templates={templates}
        showTemplates={showTemplates}
        setShowTemplates={setShowTemplates}
        onSaveTemplate={saveAsTemplate}
        onLoadTemplate={loadTemplate}
        onNewProject={newProject}
        demoActive={demoActive}
        onToggleDemo={toggleDemo}
        onOpenConnections={() => setShowConnections(true)}
      />
      <VersionBanner />

      {/* No forced full-viewport height — the content area is exactly as tall as its
          content, so SectionNav (Back/Next) flows right after the content instead of
          being pushed to the bottom edge against the status bar. The outer min-h-screen
          div keeps the background full-height on short pages. */}
      <div className="flex flex-col lg:flex-row max-w-[1400px] mx-auto">
        <Sidebar
          currentSection={currentSection}
          setCurrentSection={setCurrentSection}
          completion={completion}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden pb-20">
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
              project={project}
              allReady={allReady}
              completion={completion}
              setCurrentSection={setCurrentSection}
            />
          )}
        </main>
      </div>

      <StatusBar project={project} completion={completion} currentSection={currentSection} />
      </div>

      {dialog && <Modal dialog={dialog} onClose={() => setDialog(null)} />}
      <ConnectionsModal open={showConnections} onClose={() => setShowConnections(false)} />
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
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    if (kind === 'prompt') setTimeout(() => inputRef.current?.focus(), 30);
    return () => document.removeEventListener('keydown', onKey);
  }, [kind, onClose]);
  const confirm = () => { dialog.onConfirm?.(kind === 'prompt' ? value : undefined); onClose(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(21,23,28,0.55)' }} onMouseDown={onClose}>
      <div className="mp-card w-full max-w-md p-5" style={{ background: '#EDE9DE' }} onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="mp-display text-[22px] leading-none mb-2">{title}</h3>
        {message && <p className="mp-body text-sm mb-4" style={{ color: 'rgba(21,23,28,0.7)' }}>{message}</p>}
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
          <button onClick={onClose} className="mp-btn mp-btn-ghost text-[13px] py-2 px-3">Cancel</button>
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
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t" style={{
      background: '#15171C',
      color: '#EDE9DE',
      borderColor: '#15171C',
      height: 32,
    }}>
      <div className="max-w-[1400px] mx-auto h-full flex items-center justify-between px-4 sm:px-6 overflow-x-auto whitespace-nowrap">
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
          <span>IMG <span style={{ color: '#FF5722' }}>{project.images.length}</span></span>
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

function TopHeader({ project, updateProject, templates, showTemplates, setShowTemplates, onSaveTemplate, onLoadTemplate, onNewProject, demoActive, onToggleDemo, onOpenConnections }) {
  const [editingName, setEditingName] = useState(false);
  const templatesRef = useRef(null);

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
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 relative" style={{ background: '#15171C' }}>
            {/* Layer-stack icon: 4 horizontal bars stacked, mimicking print layers */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="3" y="3"  width="16" height="2" fill="#FF5722" />
              <rect x="3" y="7"  width="16" height="2" fill="#EDE9DE" opacity="0.4" />
              <rect x="3" y="11" width="16" height="2" fill="#EDE9DE" opacity="0.6" />
              <rect x="3" y="15" width="16" height="2" fill="#EDE9DE" opacity="0.85" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <h1 className="mp-display text-[26px] leading-none">ModelPrep</h1>
              <span className="hidden sm:inline mp-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.45)' }} title={`Build ${BUILD_COMMIT}${BUILD_TIME ? ' · ' + new Date(BUILD_TIME).toISOString() : ''}`}>v0.3 · {BUILD_LABEL}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
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
                  className="mp-mono text-[13px] flex items-center gap-1 group"
                  style={{ color: 'rgba(21,23,28,0.6)' }}
                >
                  ▸ {project.name}
                  <Edit3 size={10} className="opacity-0 group-hover:opacity-100 transition" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
                  <div className="px-3 py-4 text-xs text-center" style={{ color: 'rgba(21,23,28,0.4)' }}>
                    No templates yet. Save your current setup as a reusable template (Marjan's "Sjabloon").
                  </div>
                ) : (
                  templates.map(t => (
                    <button key={t.id} onClick={() => onLoadTemplate(t)} className="w-full text-left px-3 py-2 text-xs hover:bg-black/5 transition flex justify-between items-center">
                      <span>{t.name}</span>
                      <span className="mp-mono text-[12px]" style={{ color: 'rgba(21,23,28,0.4)' }}>{t.data.tags?.length || 0} tags</span>
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
            title={demoActive ? 'Exit demo and restore your data' : 'Fill the app with sample data to explore'}
          >
            <Sparkles size={13} /> {demoActive ? 'Exit demo' : 'Demo'}
          </button>
          <button onClick={onNewProject} className="mp-btn mp-btn-ghost text-xs py-2 px-3">
            <Plus size={13} /> New
          </button>
        </div>
      </div>
      {demoActive && (
        <div className="text-center py-1.5 px-4 mp-mono text-[12px] uppercase tracking-[0.15em] flex items-center justify-center gap-2" style={{ background: '#3A86FF', color: '#fff' }}>
          <Sparkles size={12} /> Demo data loaded — explore the filled-in flow. Your own work is safe; click “Exit demo” to restore it.
        </div>
      )}
    </header>
  );
}

// =====================================================================
// SIDEBAR
// =====================================================================

function Sidebar({ currentSection, setCurrentSection, completion }) {
  return (
    <aside className="w-full lg:w-64 flex-shrink-0 border-b lg:border-b-0 lg:border-r" style={{ borderColor: 'rgba(21,23,28,0.15)', minHeight: '100%' }}>
      <nav className="py-3 px-2 lg:py-6 lg:px-3 lg:sticky lg:top-[81px]">
        <div className="hidden lg:flex mp-mono text-[11px] uppercase tracking-[0.25em] px-3 mb-3 items-center gap-2" style={{ color: 'rgba(21,23,28,0.45)' }}>
          <span>┌─ JOB SHEET</span>
          <div className="flex-1 mp-tickrule" />
        </div>
        <div className="flex lg:block gap-1 lg:gap-0 overflow-x-auto lg:overflow-visible">
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
              className="flex-shrink-0 w-[210px] lg:w-full text-left p-3 mb-0.5 flex items-start gap-3 transition-colors group relative"
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
              <div className="min-w-0 flex-1">
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
        <div className="hidden lg:flex mp-mono text-[11px] uppercase tracking-[0.25em] px-3 mt-3 items-center gap-2" style={{ color: 'rgba(21,23,28,0.45)' }}>
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
const MAX_BUILD_FILE_MB = 500;

function FilesSection({ project, updateProject, setCurrentSection }) {
  const fileInputRef = useRef(null);
  const [notice, setNotice] = useState(null); // { kind: 'image' | 'toobig' | 'renamed', detail }

  const handleFiles = (fileList) => {
    const arr = Array.from(fileList);
    const supported = arr.filter(f => isModelFile(f.name) || ['pdf', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'zip'].includes(fileExt(f.name)));

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

  const renameFile = (id, newName) => {
    // Don't let a rename collide with another file's name.
    const taken = new Set(project.files.filter(f => f.id !== id).map(f => f.name.toLowerCase()));
    const finalName = uniqueFileName(newName, taken);
    updateProject({ files: project.files.map(f => f.id === id ? { ...f, name: finalName } : f) });
  };

  const totalSize = project.files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="max-w-5xl">
      <SectionHeader
        number="01"
        title="Drop your files"
        subtitle="STL for raw geometry, 3MF for print profiles, plus optional PDFs or images. Each 3MF will become a print profile in step 04."
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload build files — drop here or press Enter to browse"
        className="mp-blueprint border-2 border-dashed py-16 px-6 text-center cursor-pointer transition-colors mt-6 focus:outline-none focus-visible:border-[#FF5722]"
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
          accept=".stl,.3mf,.obj,.step,.stp,.amf,.scad,.dxf,.svg,.pdf,.txt,.md,.zip,.png,.jpg,.jpeg,.webp,.gif"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <div className="inline-flex items-center justify-center w-14 h-14 mb-4" style={{ background: '#15171C' }}>
          <Upload size={22} strokeWidth={2.5} style={{ color: '#FF5722' }} />
        </div>
        <h2 className="mp-display text-[36px] leading-none mb-2">Load build files</h2>
        <p className="mp-body text-sm mb-3" style={{ color: 'rgba(21,23,28,0.65)' }}>drag &amp; drop · or click anywhere in the work area · max {MAX_BUILD_FILE_MB}MB per file</p>
        <div className="inline-flex items-center gap-1.5 mp-mono text-[12px] uppercase tracking-[0.2em] flex-wrap justify-center" style={{ color: 'rgba(21,23,28,0.5)' }}>
          {['stl', '3mf', 'obj', 'step', 'amf', 'scad', 'svg', 'dxf', 'pdf'].map(ext => (
            <span key={ext} className="mp-pill" style={{ background: 'rgba(21,23,28,0.06)' }}>.{ext}</span>
          ))}
        </div>
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
                  None of those files are supported here. Try <strong>.stl, .3mf, .obj, .step, .amf</strong> (or .pdf / .zip extras).
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
            <span className="mp-mono text-[13px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.55)' }}>
              {project.files.length} file{project.files.length === 1 ? '' : 's'} · {formatBytes(totalSize)} total
            </span>
            <button onClick={() => updateProject({ files: [] })} className="mp-mono text-[12px] uppercase tracking-[0.2em] opacity-60 hover:opacity-100 transition">
              Clear all
            </button>
          </div>
          <div className="space-y-2">
            {project.files.map(f => (
              <FileRow key={f.id} file={f} onRemove={() => removeFile(f.id)} onRename={(name) => renameFile(f.id, name)} />
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

function FileRow({ file, onRemove, onRename }) {
  const isProf = file.isProfile;
  const isImg = file.isImage;
  const ext = fileExt(file.name);
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(baseName);

  const startEdit = () => { setDraft(baseName); setEditing(true); };
  const commit = () => {
    const clean = draft.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\.+$/, '');
    if (clean && clean !== baseName) onRename(`${clean}.${ext}`);
    setEditing(false);
  };

  return (
    <div className="mp-card p-3 flex items-center gap-3">
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
            <span className="mp-mono text-sm flex-shrink-0" style={{ color: 'rgba(21,23,28,0.45)' }}>.{ext}</span>
          </div>
        ) : (
          <button onClick={startEdit} className="mp-display font-bold text-sm truncate flex items-center gap-1.5 group/name max-w-full" title="Click to rename">
            <span className="truncate">{file.name}</span>
            <Edit3 size={11} className="opacity-0 group-hover/name:opacity-50 transition flex-shrink-0" />
          </button>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="mp-mono text-[12px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.5)' }}>
            .{ext} · {formatBytes(file.size)}
          </span>
          {isProf && (
            <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: '#FF5722', color: '#fff' }}>
              Print profile
            </span>
          )}
          {isImg && (
            <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: 'rgba(21,23,28,0.4)', color: '#fff' }}>
              Reference image
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
  );
}

// Common per-file cap across most platforms (Cults, MMF, Thingiverse, Thangs,
// Nexprint, Creality). MakerWorld allows 150MB/profile + 250MB total; Printables
// is far higher. We warn early so testers don't download packages that get rejected.
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
        <ChevronDown size={14} style={{ color: 'rgba(21,23,28,0.45)' }} className="flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 mp-card shadow-lg" style={{ background: '#FFFFFF' }}>
          <div className="flex items-center gap-2 px-2.5 py-2 border-b" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
            <Search size={13} style={{ color: 'rgba(21,23,28,0.45)' }} />
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
              <div className="px-3 py-2 text-[13px]" style={{ color: 'rgba(21,23,28,0.5)' }}>No match for “{query}”.</div>
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
  const [tagInput, setTagInput] = useState('');
  const [previewMode, setPreviewMode] = useState('write'); // write | preview | formats
  const [licenseFilter, setLicenseFilter] = useState('all');

  const visibleLicenses = LICENSES.filter(l => matchesLicenseFilter(l, licenseFilter));

  const MAX_TAGS = 20;
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

  const suggestTags = () => {
    const room = MAX_TAGS - project.tags.length;
    if (room <= 0) return;
    const suggestions = aiSuggestTags(project.title || 'thing');
    const newTags = suggestions.filter(t => !project.tags.includes(t)).slice(0, Math.min(5, room));
    updateProject({ tags: [...project.tags, ...newTags] });
  };

  return (
    <div className="max-w-5xl">
      <SectionHeader
        number="02"
        title="Project details"
        subtitle="Title, description, tags, category, and license. These get formatted three ways for the different platforms."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-5">
          <div>
            <Label>Title</Label>
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
              <span className="mp-mono text-[12px]" style={{ color: 'rgba(21,23,28,0.4)' }}>
                {project.description.length} chars
              </span>
              <span className="mp-mono text-[12px]" style={{ color: 'rgba(21,23,28,0.4)' }}>
                Markdown for Printables/Cults/Nexprint · HTML for MakerWorld/MMF/Thangs/Creality · Plain for Thingiverse
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
              <div className="flex items-center justify-between text-[12px]" style={{ color: 'rgba(21,23,28,0.5)' }}>
                <span className="mp-mono uppercase tracking-[0.15em]">{project.tags.length}/20 tags</span>
                <button onClick={suggestTags} className="mp-mono uppercase tracking-[0.15em] flex items-center gap-1 hover:text-[#FF5722] transition">
                  <Sparkles size={10} /> Suggest tags
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <Label>Category</Label>
            <CategorySelect value={project.category} onChange={(c) => updateProject({ category: c })} options={CATEGORIES} />
            <p className="text-[12px] mt-1.5" style={{ color: 'rgba(21,23,28,0.4)' }}>
              Each platform has its own category tree. We pick a close match for each.
            </p>
          </div>

          <div>
            <Label>License</Label>
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
            <div className="space-y-1.5">
              {visibleLicenses.length === 0 && (
                <p className="text-[13px] py-2" style={{ color: 'rgba(21,23,28,0.5)' }}>No license matches that combination.</p>
              )}
              {visibleLicenses.map(l => (
                <label key={l.id} className="flex items-start gap-2.5 mp-card p-2.5 cursor-pointer transition" style={{
                  borderColor: project.license === l.id ? '#FF5722' : 'rgba(21,23,28,0.1)',
                  background: project.license === l.id ? 'rgba(255,87,34,0.04)' : '#FFFFFF',
                }}>
                  <input type="radio" name="license" value={l.id} checked={project.license === l.id} onChange={() => updateProject({ license: l.id })} className="mt-0.5" style={{ accentColor: '#FF5722' }} />
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
  return <label className={`mp-mono text-[12px] uppercase tracking-[0.2em] block mb-2 ${className}`} style={{ color: 'rgba(21,23,28,0.55)' }}>{children}</label>;
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
    { k: 'md',    label: 'Markdown',  platforms: ['Printables', 'Cults3D', 'Nexprint'] },
    { k: 'rich',  label: 'Formatted', platforms: ['MakerWorld'] },
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
        <span className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.45)' }}>
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
  const [activeImageId, setActiveImageId] = useState(null);
  const [showPlatformPreviews, setShowPlatformPreviews] = useState(true);
  const [imgNotice, setImgNotice] = useState(null); // string | null

  const handleImageFiles = async (fileList) => {
    const all = Array.from(fileList);
    // Accept by MIME, but fall back to extension when the browser reports no type
    // (drag from some sources, HEIC, renamed files, etc.).
    const candidates = all.filter(f => f.type.startsWith('image/') || isImageFile(f.name));
    const rejectedType = all.length - candidates.length;
    const additions = [];
    let failed = 0;
    for (const file of candidates) {
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
          naturalW: img.naturalWidth,
          naturalH: img.naturalHeight,
          focal: { x: 0.5, y: 0.5 },
          alt: file.name.replace(/\.[^.]+$/, ''),
        });
      } catch (e) { failed++; }
    }

    // Surface what happened so a drop never silently does nothing.
    if (!additions.length) {
      if (rejectedType && !failed) setImgNotice("Those files aren't recognized as images. Use JPG, PNG, WebP or GIF.");
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

  return (
    <div className="max-w-5xl">
      <SectionHeader
        number="03"
        title="Cover and gallery images"
        subtitle={<>Drop images, set the focal point so every platform's crop keeps what matters in frame.<br />Up to 16 for MakerWorld; most platforms cap at 10-25.</>}
      />

      {imgNotice && (
        <div className="mt-4 p-3 flex items-start gap-3" style={{ background: 'rgba(255,87,34,0.08)', border: '1px solid rgba(255,87,34,0.3)' }}>
          <AlertCircle size={16} style={{ color: '#FF5722' }} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs flex-1" style={{ color: 'rgba(21,23,28,0.7)' }}>{imgNotice}</div>
          <button onClick={() => setImgNotice(null)} className="p-2 -m-1 opacity-50 hover:opacity-100 transition" aria-label="Dismiss notice"><X size={14} /></button>
        </div>
      )}

      {project.images.length === 0 ? (
        <ImageDropZone
          onDrop={handleImageFiles}
          inputRef={fileInputRef}
          onSamples={() => addSamples([
            { label: 'SAMPLE 1', tint: ['#FF5722', '#FFB627', '#1A1A1A'] },
            { label: 'SAMPLE 2', tint: ['#3A86FF', '#4FB286', '#1A1A1A'] },
            { label: 'SAMPLE 3', tint: ['#FF6900', '#F79E2E', '#1A1A1A'] },
          ])}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          <div className="lg:col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="mp-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.55)' }}>
                {project.images.length}/16 images
              </span>
              <button onClick={() => fileInputRef.current?.click()} className="mp-mono text-[12px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition flex items-center gap-1">
                <Plus size={11} /> Add
              </button>
              <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e) => handleImageFiles(e.target.files)} className="hidden" />
            </div>

            <p className="mp-mono text-[11px] uppercase tracking-[0.15em] mb-1" style={{ color: 'rgba(21,23,28,0.4)' }}>
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
                        <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
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

            {project.images.length >= 9 && (
              <div className="mt-3 p-2.5 text-[12px]" style={{ background: 'rgba(255,87,34,0.08)', borderLeft: '2px solid #FF5722' }}>
                <strong>Heads up:</strong> images above #9 only show on MakerWorld (max 16). Others typically display 9-12.
              </div>
            )}
          </div>

          <div className="lg:col-span-9">
            {activeImage && (
              <>
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <span className="mp-mono text-[13px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.55)' }}>
                    Image · {activeImage.naturalW} × {activeImage.naturalH} · drag the dot to set focal point
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

                <FocalPicker
                  image={activeImage}
                  onUpdate={(focal) => updateImageFocal(activeImage.id, focal)}
                />

                <div className="flex items-center justify-between mt-6 mb-3">
                  <span className="mp-mono text-[13px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.55)' }}>
                    Per-platform preview · {showPlatformPreviews ? PLATFORMS.reduce((n, p) => n + p.covers.length, 0) : 0} crops
                  </span>
                  <button onClick={() => setShowPlatformPreviews(s => !s)} className="mp-mono text-[12px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition flex items-center gap-1">
                    {showPlatformPreviews ? <><ChevronDown size={11} /> Hide</> : <><ChevronRight size={11} /> Show</>}
                  </button>
                </div>

                {showPlatformPreviews && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {PLATFORMS.flatMap(p => p.covers.map(c => ({ ...c, p }))).map((co, i) => (
                      <PlatformCropPreview key={i} image={activeImage} platform={co.p} cover={co} />
                    ))}
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

function ImageDropZone({ onDrop, inputRef, onSamples }) {
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
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple accept="image/*" onChange={(e) => onDrop(e.target.files)} className="hidden" />
        <div className="inline-flex items-center justify-center w-14 h-14 mb-4" style={{ background: '#15171C' }}>
          <ImageIcon size={22} strokeWidth={2.5} style={{ color: '#FF5722' }} />
        </div>
        <h2 className="mp-display text-[36px] leading-none mb-2">Load renders &amp; photos</h2>
        <p className="mp-body text-sm mb-3" style={{ color: 'rgba(21,23,28,0.65)' }}>jpg, png, webp · first image becomes the cover</p>
        <p className="mp-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.4)' }}>
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
  useEffect(() => {
    if (!canvasRef.current || !image) return;
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
  }, [image, cover]);
  return (
    <div className="mp-card">
      <div className="overflow-hidden" style={{ background: '#15171C' }}>
        <canvas ref={canvasRef} className="w-full block" />
      </div>
      <div className="p-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-1.5 h-1.5 flex-shrink-0" style={{ background: platform.dot }} />
          <div className="min-w-0">
            <div className="mp-display font-bold text-[13px] leading-tight truncate">
              {platform.name}{cover.label !== 'Cover' ? ` · ${cover.label}` : ''}
            </div>
            <div className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.5)' }}>
              {cover.w}×{cover.h} ({cover.aspect})
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

  const updateProfile = (id, patch) => {
    updateProject({ profiles: project.profiles.map(p => p.id === id ? { ...p, ...patch } : p) });
  };

  if (project.profiles.length === 0) {
    return (
      <div className="max-w-5xl">
        <SectionHeader number="04" title="Print profiles" subtitle="Each 3MF file becomes a print profile here. You haven't added any 3MF files yet, so this step is skipped." />
        <div className="mt-6 p-8 text-center mp-card">
          <Layers size={32} className="mx-auto mb-3 opacity-30" />
          <h3 className="mp-display font-bold text-lg mb-1">No 3MF files yet</h3>
          <p className="text-sm mb-4" style={{ color: 'rgba(21,23,28,0.6)' }}>Add 3MF files in step 01 to define print profiles. STL-only models skip this step.</p>
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

  return (
    <div className="max-w-5xl">
      <SectionHeader
        number="04"
        title="Print profiles"
        subtitle="One profile per 3MF file. Add a name and a per-profile description. Settings below are estimated from the file (preview — full 3MF parsing comes later)."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        <div className="lg:col-span-3 space-y-1.5">
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

        <div className="lg:col-span-9 space-y-5">
          {active && (
            <>
              <div>
                <Label>Profile name</Label>
                <input
                  className="mp-input"
                  value={active.name}
                  onChange={(e) => updateProfile(active.id, { name: e.target.value })}
                />
              </div>

              {active.parsed && (
                <div className="mp-card p-4">
                  <div className="mp-mono text-[12px] uppercase tracking-[0.2em] mb-3" style={{ color: 'rgba(21,23,28,0.55)' }}>
                    Estimated from file (preview)
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Stat label="Printer" value={active.parsed.printer} />
                    <Stat label="Material" value={active.parsed.material} />
                    <Stat label="Layer height" value={active.parsed.layerHeight} />
                    <Stat label="Plates" value={active.parsed.plates} />
                    <Stat label="Print time" value={active.parsed.estimatedTime} />
                    <Stat label="Filament" value={`${active.parsed.filamentGrams}g`} />
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
                      onChange={() => updateProfile(active.id, { useMainCover: false })}
                      style={{ accentColor: '#FF5722' }}
                    />
                    <span className="text-xs">Pick a specific image from the gallery</span>
                  </label>
                  {!active.useMainCover && (
                    <div className="grid grid-cols-4 gap-2 ml-7">
                      {project.images.map(img => (
                        <button
                          key={img.id}
                          onClick={() => updateProfile(active.id, { coverImageId: img.id })}
                          className="aspect-square overflow-hidden transition"
                          style={{
                            border: active.coverImageId === img.id ? '2px solid #FF5722' : '1px solid rgba(21,23,28,0.15)',
                            outline: active.coverImageId === img.id ? '2px solid rgba(255,87,34,0.2)' : 'none',
                            outlineOffset: -2,
                          }}
                        >
                          <img src={img.dataUrl} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
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
                  <div className="grid grid-cols-5 md:grid-cols-6 gap-2">
                    {project.images.map(img => {
                      const ids = active.photoIds || [];
                      const on = ids.includes(img.id);
                      return (
                        <button key={img.id} type="button"
                          onClick={() => updateProfile(active.id, { photoIds: on ? ids.filter(x => x !== img.id) : [...ids, img.id] })}
                          className="relative aspect-square overflow-hidden transition"
                          style={{ outline: on ? '2px solid #FF5722' : '1px solid rgba(21,23,28,0.15)', outlineOffset: -1 }}
                          title={on ? 'Selected as print-profile photo' : 'Use as print-profile photo'}>
                          <img src={img.dataUrl} alt="" className="w-full h-full object-cover" style={{ opacity: on ? 1 : 0.55 }} />
                          {on && <span className="absolute top-1 right-1 rounded-full flex items-center justify-center" style={{ width: 16, height: 16, background: '#FF5722' }}><Check size={10} color="#fff" /></span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {(active.photoIds || []).length === 0 && project.images.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: '#B23A1A' }}>None selected — your cover image will be used. Pick real printed-model photos to avoid takedown.</p>
                )}
              </div>

              <p className="text-[11px] mt-1" style={{ color: 'rgba(21,23,28,0.5)' }}>
                By publishing, you confirm this print profile meets MakerWorld's <a href="https://makerworld.com/en/rules" target="_blank" rel="noopener noreferrer" className="underline">Print Profile Guidelines</a>.
              </p>
            </>
          )}
        </div>
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

function Stat({ label, value }) {
  return (
    <div>
      <div className="mp-mono text-[11px] uppercase tracking-[0.2em] mb-1" style={{ color: 'rgba(21,23,28,0.5)' }}>{label}</div>
      <div className="mp-display font-bold text-sm">{value}</div>
    </div>
  );
}

// =====================================================================
// SECTION: PLATFORMS
// =====================================================================

function PlatformsSection({ project, updateProject, setCurrentSection }) {
  const togglePlatform = (id) => {
    updateProject({
      platforms: { ...project.platforms, [id]: { ...project.platforms[id], enabled: !project.platforms[id].enabled } },
    });
  };
  const updatePlatformField = (id, field, value) => {
    updateProject({
      platforms: { ...project.platforms, [id]: { ...project.platforms[id], [field]: value } },
    });
  };

  const enabledCount = Object.values(project.platforms).filter(p => p.enabled).length;

  return (
    <div className="max-w-5xl">
      <SectionHeader
        number="05"
        title="Choose your platforms"
        subtitle={`Toggle each platform on or off, then expand a card to set its options — MakerWorld (category, visibility, BOM, remix, Laser & Cut…), Cults price/visibility, etc. ${enabledCount} of ${PLATFORMS.length} enabled.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
        {PLATFORMS.map(p => (
          <PlatformCard
            key={p.id}
            platform={p}
            state={project.platforms[p.id]}
            onToggle={() => togglePlatform(p.id)}
            onUpdate={(field, value) => updatePlatformField(p.id, field, value)}
          />
        ))}
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

function PlatformCard({ platform, state, onToggle, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 flex-shrink-0" style={{ background: platform.dot }} />
              <h3 className="mp-display font-bold text-base">{platform.name}</h3>
              {platform.apiSupport === 'oneclick' && (
                <span className="mp-pill" style={{ background: '#4FB286', color: '#fff' }}>API</span>
              )}
              {platform.apiSupport === 'manual' && (
                <span className="mp-pill" style={{ background: 'rgba(21,23,28,0.1)', color: 'rgba(21,23,28,0.6)' }}>manual</span>
              )}
              {platform.apiSupport === 'addon' && (
                <span className="mp-pill" style={{ background: 'rgba(58,134,255,0.15)', color: '#3A86FF' }}>addon</span>
              )}
            </div>
            <button onClick={() => setExpanded(s => !s)} className="p-2 opacity-50 hover:opacity-100 transition flex-shrink-0" aria-label={expanded ? 'Collapse platform options' : 'Expand platform options'} aria-expanded={expanded}>
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
          <div className="mp-mono text-[12px] uppercase tracking-[0.15em] mt-0.5" style={{ color: 'rgba(21,23,28,0.55)' }}>
            {platform.org} · {platform.descFormat}
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'rgba(21,23,28,0.65)' }}>{platform.note}</p>
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 border-t" style={{ borderColor: 'rgba(21,23,28,0.08)' }}>
          <div className="grid grid-cols-3 gap-2 my-3 text-[12px]">
            <Stat label="Max images" value={platform.maxImages} />
            <Stat label="File size cap" value={`${platform.maxFileMb}MB`} />
            <Stat label="Total cap" value={`${platform.maxTotalMb}MB`} />
          </div>

          <div className="mb-3">
            <Label>Accepted formats</Label>
            <div className="flex flex-wrap gap-1">
              {platform.formats.map(f => (
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

          {platform.id === 'makerworld' && state.enabled && (
            <MakerWorldOptions opts={state} onUpdate={onUpdate} />
          )}
          {platform.id === 'cults' && state.enabled && (
            <div className="mt-3">
              <Label>Visibility</Label>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5"><input type="radio" checked={(state.visibility || 'secret') === 'secret'} onChange={() => onUpdate('visibility', 'secret')} style={{ accentColor: '#FF5722' }} /> Secret (unlisted)</label>
                <label className="flex items-center gap-1.5"><input type="radio" checked={state.visibility === 'public'} onChange={() => onUpdate('visibility', 'public')} style={{ accentColor: '#FF5722' }} /> Public</label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// SECTION: PREPARE FOR UPLOAD (real exports, no fake publishing)
// =====================================================================

function PublishSection({ project, allReady, completion, setCurrentSection }) {
  const enabled = PLATFORMS.filter(p => project.platforms[p.id]?.enabled);
  const cover = project.images.find(i => i.id === project.coverImageId);
  // Broadcast signals so the parent can expand/collapse every card at once.
  // Cards keep their own `expanded` state; they just react to a signal change.
  // `allExpanded` tracks the last bulk action so the single toggle button can
  // show "Collapse all" or "Expand all" appropriately.
  const [expandSignal, setExpandSignal] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [allExpanded, setAllExpanded] = useState(true); // cards default to expanded
  const [showZip, setShowZip] = useState(false); // manual .zip fallback — collapsed, at the bottom
  const toggleAll = () => {
    if (allExpanded) { setCollapseSignal(n => n + 1); setAllExpanded(false); }
    else { setExpandSignal(n => n + 1); setAllExpanded(true); }
  };

  if (!allReady) {
    return (
      <div className="max-w-5xl">
        <SectionHeader number="06" title="Prepare upload packages" subtitle="Finish the missing steps below to generate platform-ready exports." />
        <div className="mt-6 space-y-2">
          {SECTIONS.slice(0, -1).map(s => (
            <button key={s.id} onClick={() => setCurrentSection(s.id)} className="w-full p-3.5 mp-card flex items-center gap-3 text-left transition hover:border-[#FF5722]">
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: completion[s.id] ? '#4FB286' : 'rgba(21,23,28,0.08)' }}>
                {completion[s.id] ? <Check size={14} color="#fff" /> : <AlertCircle size={14} style={{ color: '#FF5722' }} />}
              </div>
              <div className="flex-1">
                <div className="mp-display text-[18px] leading-none">{s.label}</div>
                <div className="mp-body text-[13px] mt-1" style={{ color: 'rgba(21,23,28,0.55)' }}>
                  {completion[s.id] ? 'Complete' : 'Missing or incomplete'}
                </div>
              </div>
              <ChevronRight size={14} className="opacity-50" />
            </button>
          ))}
        </div>
        <SectionNav backLabel="Back to Platforms" onBack={() => setCurrentSection('platforms')} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <SectionHeader
        number="06"
        title="Publish"
        subtitle="Publish to each enabled platform. API platforms (MakerWorld, Cults3D) upload directly — sign in and hit Publish. Manual platforms give you a ready-to-paste .zip package."
      />

      {enabled.length > 1 && (
        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
          <span className="mp-mono text-[12px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.55)' }}>
            {enabled.length} platform packages
          </span>
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
        {enabled.map(p => (
          <PlatformPackageCard
            key={p.id}
            platform={p}
            project={project}
            cover={cover}
            platformState={project.platforms[p.id]}
            expandSignal={expandSignal}
            collapseSignal={collapseSignal}
            setCurrentSection={setCurrentSection}
          />
        ))}
      </div>

      {/* Manual .zip packages — kept as a fallback, demoted to the bottom, collapsed by default. */}
      <div className="mt-6 mp-card" style={{ background: 'rgba(21,23,28,0.02)' }}>
        <button onClick={() => setShowZip(s => !s)} className="w-full flex items-center gap-2 p-3 text-left">
          {showZip ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="mp-display text-[15px]">Download .zip packages</span>
          <span className="text-[12px] ml-auto" style={{ color: 'rgba(21,23,28,0.5)' }}>manual fallback</span>
        </button>
        {showZip && (
          <div className="px-3 pb-3 flex flex-col md:flex-row md:items-center gap-3">
            <p className="mp-body text-xs leading-relaxed flex-1" style={{ color: 'rgba(21,23,28,0.7)' }}>
              Packs the cover at exact dimensions, gallery images cropped per platform, your description in each format (md / html / txt), a paste-ready metadata.txt, a README, and a /files folder. For platforms without one-click upload — open their upload page and drop the contents in.
            </p>
            <BatchZipButton enabled={enabled} project={project} cover={cover} />
          </div>
        )}
      </div>

      <SectionNav backLabel="Back to Platforms" onBack={() => setCurrentSection('platforms')} />
    </div>
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

// Top-level batch upload (DEMO). Simulates one-click publishing to every enabled
// platform that has an upload API (Cults3D, MyMiniFactory, Thingiverse).
function BatchUploadPanel({ enabled, project }) {
  const apiPlatforms = enabled.filter(p => p.hasApi);
  const manualPlatforms = enabled.filter(p => !p.hasApi);
  const [status, setStatus] = useState('idle'); // idle | running | done | scheduled
  const [results, setResults] = useState([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const cancelled = useRef(false);
  useEffect(() => { cancelled.current = false; return () => { cancelled.current = true; }; }, []);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const urlFor = (id, slug) => ({
    cults: `https://cults3d.com/en/3d-model/${slug}`,
    mmf: `https://www.myminifactory.com/object/${slug}`,
    thingiverse: `https://www.thingiverse.com/thing:${slug}`,
  }[id] || '#');

  const run = async () => {
    if (!apiPlatforms.length || status === 'running') return;
    // Scheduled: capture intent for every API platform, no upload simulation.
    if (scheduledAt) {
      setResults(apiPlatforms.map(p => ({ id: p.id, name: p.name, state: 'scheduled', url: '' })));
      setStatus('scheduled');
      return;
    }
    setStatus('running');
    setResults(apiPlatforms.map(p => ({ id: p.id, name: p.name, state: 'pending', url: '' })));
    const slug = slugify(project.title) || 'model';
    for (let i = 0; i < apiPlatforms.length; i++) {
      if (cancelled.current) return;
      setResults(rs => rs.map((r, idx) => idx === i ? { ...r, state: 'uploading' } : r));
      await sleep(1200);
      if (cancelled.current) return;
      setResults(rs => rs.map((r, idx) => idx === i ? { ...r, state: 'done', url: urlFor(r.id, slug) } : r));
    }
    if (cancelled.current) return;
    setStatus('done');
  };

  return (
    <div className="mt-3 mp-card p-4" style={{ background: 'rgba(58,134,255,0.05)', border: '1px solid rgba(58,134,255,0.35)' }}>
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="mp-display text-[16px] leading-none">Upload to all API platforms</span>
            <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: '#3A86FF', color: '#fff' }}>Demo</span>
          </div>
          <p className="mp-body text-xs leading-relaxed" style={{ color: 'rgba(21,23,28,0.7)' }}>
            {apiPlatforms.length > 0
              ? <>Publishes to {apiPlatforms.map(p => p.name).join(', ')} in one go via their upload APIs. {manualPlatforms.length > 0 && <>The other {manualPlatforms.length} ({manualPlatforms.map(p => p.name).join(', ')}) have no API — download their .zip and upload manually.</>}</>
              : <>None of your enabled platforms have an upload API. Enable Cults3D, MyMiniFactory or Thingiverse to use one-click upload.</>}
          </p>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="mp-mono text-[11px] uppercase tracking-[0.15em] flex items-center gap-1.5" style={{ color: 'rgba(21,23,28,0.6)' }}>
              <Clock size={12} /> Schedule
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              min={nowLocalMin()}
              onChange={(e) => setScheduledAt(e.target.value)}
              disabled={!apiPlatforms.length}
              aria-label="Schedule publish to all API platforms"
              className="mp-input-sm"
            />
            {scheduledAt && (
              <button onClick={() => setScheduledAt('')} className="mp-mono text-[11px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition" aria-label="Clear schedule">clear</button>
            )}
          </div>
          <button
            onClick={run}
            disabled={!apiPlatforms.length || status === 'running'}
            className="mp-btn text-[13px] py-2.5 px-4 disabled:opacity-40"
            style={apiPlatforms.length ? { background: '#3A86FF', borderColor: '#3A86FF' } : undefined}
          >
            {status === 'running'
              ? <><Loader size={13} className="mp-spin" /> Uploading…</>
              : scheduledAt
                ? <><Clock size={13} /> Save schedule for {formatSchedule(scheduledAt)}</>
                : <><Send size={13} /> Upload to {apiPlatforms.length || 'all'} platform{apiPlatforms.length === 1 ? '' : 's'}</>}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {results.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-xs mp-card p-2" style={{ background: '#FFFFFF' }}>
              {r.state === 'done'
                ? <Check size={13} style={{ color: '#3a8d68' }} className="flex-shrink-0" />
                : r.state === 'scheduled'
                  ? <Clock size={13} style={{ color: '#3a8d68' }} className="flex-shrink-0" />
                  : r.state === 'uploading'
                    ? <Loader size={13} className="mp-spin flex-shrink-0" style={{ color: '#3A86FF' }} />
                    : <div className="w-[13px] h-[13px] rounded-full flex-shrink-0" style={{ border: '1.5px solid rgba(21,23,28,0.2)' }} />}
              <span className="mp-display font-bold flex-shrink-0" style={{ minWidth: 120 }}>{r.name}</span>
              <span className="mp-mono text-[12px] truncate" style={{ color: 'rgba(21,23,28,0.55)' }}>
                {r.state === 'done' ? (r.id === 'mmf' ? 'queued for curation' : r.url)
                  : r.state === 'scheduled' ? `scheduled · ${formatSchedule(scheduledAt)}`
                  : r.state === 'uploading' ? 'uploading…' : 'waiting'}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] mt-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.4)' }}>
        Simulation only — nothing is uploaded yet. Real API upload is the next build phase.
      </p>
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

function PlatformPackageCard({ platform, project, cover, platformState, expandSignal = 0, collapseSignal = 0, setCurrentSection }) {
  const [expanded, setExpanded] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progressMsg, setProgressMsg] = useState(null);
  const [uploadSignal, setUploadSignal] = useState(0);
  // Platforms with a real one-click upload: hide all the manual .zip/copy-paste prep
  // (it's redundant) and show only the live upload flow. Others keep the manual package.
  const hasRealUpload = platform.id === 'cults' || platform.id === 'makerworld';

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
    const limit = Math.min(others.length, platform.maxImages - 1);
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
                <span className="mp-pill" style={{ background: '#4FB286', color: '#fff' }}>API soon</span>
              )}
              {platform.apiSupport === 'manual' && (
                <span className="mp-pill" style={{ background: 'rgba(21,23,28,0.1)', color: 'rgba(21,23,28,0.6)' }}>manual</span>
              )}
              {platform.apiSupport === 'addon' && (
                <span className="mp-pill" style={{ background: 'rgba(58,134,255,0.15)', color: '#3A86FF' }}>addon</span>
              )}
            </div>
            <div className="mp-mono text-[12px] uppercase tracking-[0.15em] mt-1" style={{ color: 'rgba(21,23,28,0.55)' }}>
              {platform.org} · {platform.descFormat} description · {platform.maxImages} img max
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

      {expanded && (
        <div className="p-4 space-y-4">
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
            <div className="mp-card mp-mono text-xs p-2.5" style={{ background: 'rgba(21,23,28,0.03)' }}>{tagString || <span style={{ color: 'rgba(21,23,28,0.4)' }}>(no tags)</span>}</div>
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
                <p className="text-[12px] mt-1.5 leading-snug" style={{ color: 'rgba(21,23,28,0.45)' }}>
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
                  {desc || <span style={{ color: 'rgba(21,23,28,0.4)' }}>(no description)</span>}
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
                hint={`${Math.min(project.images.length - 1, platform.maxImages - 1)} of ${project.images.length - 1} additional (cap ${platform.maxImages})`}
              >
                <button onClick={downloadAllGallery} disabled={downloading} className="mp-mono text-[12px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
                  <Download size={10} /> All gallery
                </button>
              </PackageLabel>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {project.images
                  .filter(i => i.id !== project.coverImageId)
                  .slice(0, platform.maxImages - 1)
                  .map((img, i) => (
                    <GalleryThumb
                      key={img.id}
                      image={img}
                      mainCover={platform.covers[0]}
                      onDownload={() => downloadImage(img, platform.covers[0].w, platform.covers[0].h, `gallery${String(i + 2).padStart(2, '0')}`)}
                    />
                  ))}
              </div>
              {project.images.length - 1 > platform.maxImages - 1 && (
                <div className="mt-2 mp-mono text-[12px]" style={{ color: 'rgba(21,23,28,0.5)' }}>
                  /// {project.images.length - 1 - (platform.maxImages - 1)} image(s) skipped, {platform.name} caps at {platform.maxImages}
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
                      <span className="mp-mono text-[12px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.5)' }}>
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
          {platform.id === 'cults' && <CultsUploadFlow platform={platform} project={project} />}
          {platform.id === 'makerworld' && <MakerWorldUploadFlow platform={platform} project={project} />}
          {platform.hasApi && platform.id !== 'cults' && platform.id !== 'makerworld' && <MockUploadFlow platform={platform} project={project} startSignal={uploadSignal} />}

          {/* Manual workflow hint — only for platforms without a real upload. */}
          {!hasRealUpload && (
            <div className="border-t pt-3 flex items-start gap-2 text-[13px]" style={{ borderColor: 'rgba(21,23,28,0.08)', color: 'rgba(21,23,28,0.6)' }}>
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
        <span className="mp-mono text-[12px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.55)' }}>{label}</span>
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
        <span className="mp-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.5)' }}>{label}</span>
        <button onClick={copy} className="p-1.5 -m-1 opacity-60 hover:opacity-100 transition" aria-label={`Copy ${label}`} title={state === 'fail' ? 'Copy failed — select manually' : `Copy ${label}`}>
          {state === 'ok' ? <Check size={13} style={{ color: '#4FB286' }} /> : state === 'fail' ? <X size={13} style={{ color: '#c83f10' }} /> : <Copy size={13} />}
        </button>
      </div>
      <div className="mp-display text-[15px] leading-tight truncate">{value || <span style={{ color: 'rgba(21,23,28,0.4)' }} className="mp-body">—</span>}</div>
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
          <span className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.45)' }}>{platform.name} has an upload API</span>
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
              <Check size={14} /> Connected as <span className="mp-mono">@your-handle</span> <span style={{ color: 'rgba(21,23,28,0.4)' }}>(demo)</span>
            </div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <label className="mp-mono text-[11px] uppercase tracking-[0.15em] flex items-center gap-1.5" style={{ color: 'rgba(21,23,28,0.6)' }}>
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
            <p className="text-[11px] mb-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.45)' }}>Preview only — won't actually publish at that time yet (timed publishing runs server-side, coming with the backend).</p>
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
            <p className="text-[12px] mb-2 leading-snug" style={{ color: 'rgba(21,23,28,0.55)' }}>
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
            <p className="text-[12px] mb-1.5 leading-snug" style={{ color: 'rgba(21,23,28,0.55)' }}>
              This is what one-click {platform.id === 'mmf' ? 'submit (then MyMiniFactory test-prints before going live)' : 'publish'} will look like. Example URL it would produce:
            </p>
            <div className="mp-card mp-mono text-[13px] p-2 mb-2 break-all" style={{ background: 'rgba(21,23,28,0.04)', color: 'rgba(21,23,28,0.45)', textDecoration: 'line-through' }}>{resultUrl}</div>
            <button onClick={() => { setStatus('connected'); setStepMsg(''); }} className="mp-mono text-[12px] uppercase tracking-[0.2em] hover:text-[#FF5722] transition flex items-center gap-1">
              <ArrowRight size={11} /> Run again
            </button>
          </>
        )}

        <p className="text-[11px] mt-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.4)' }}>
          Simulation only — nothing is uploaded yet. Real API upload to Cults3D, MyMiniFactory & Thingiverse is the next build phase. For now, use the manual steps below.
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// REAL Cults3D publish flow — POSTs files to the Worker's /api/v1/upload
// (multipart → R2 → returns a cdn.makerstats.io URL), then calls /publish
// which forwards createCreation to Cults's GraphQL API. The Worker maps
// our category/license/price/free vocab to Cults-specific values and
// returns a `substituted[]` array listing anything it had to swap
// (e.g. a CC license on a paid listing → cults_cu).
// =====================================================================
// VITE_WORKER_URL is set per-env: .env.local for dev (your local override),
// .env.production for prod builds (committed; points at the deployed Worker).
const WORKER_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WORKER_URL)
  || 'http://localhost:8787';
// Cults credentials now live in the accounts store; lib/accounts.js migrates the
// legacy `modelprep:cults-web-creds` key on first load.

function CultsUploadFlow({ platform, project }) {
  const acc = useAccounts();
  const openConnections = useOpenConnections();
  const cultsAccounts = acc.getAccounts('cults');
  const active = acc.getActive('cults');
  const creds = active?.secret || null; // { email, password } | null — from the accounts store
  const [status, setStatus] = useState(creds ? 'connected' : 'idle'); // connected | publishing | done | error | deactivating | idle
  // Default to 'secret' so the first publish doesn't immediately surface on
  // the user's profile — they can flip to 'public' once they've seen the
  // listing render. Persisted in component state per session, not saved.
  const visibility = project.platforms?.cults?.visibility || 'secret'; // set on the Platforms step
  const [result, setResult] = useState(null); // { designUrl, slug, substituted, uploadedFiles } | null
  const [errorMsg, setErrorMsg] = useState('');
  const [progressMsg, setProgressMsg] = useState('');

  // My Listings panel state — toggled open per-session. Listings load on open;
  // refresh button re-fetches. Per-row pending state lets us disable buttons
  // while a deactivate/delete is in flight without blocking the whole panel.
  const [listingsOpen, setListingsOpen] = useState(false);
  const [listings, setListings] = useState(null);             // CultsWebMyCreation[] | null
  const [listingsError, setListingsError] = useState('');
  const [listingsLoading, setListingsLoading] = useState(false);
  const [pendingRow, setPendingRow] = useState({ slug: null, action: null }); // { slug, 'deactivate'|'delete' }

  // Sign-in is managed centrally in the Connections modal; here we only switch/clear.
  const disconnect = () => { if (active) acc.removeAccount('cults', active.id); setResult(null); setStatus('idle'); };
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

  // The whole web-flow publish is ONE multipart POST. The Worker does
  // login → S3 upload per file → create draft → set price + visibility,
  // then returns { designUrl, slug, substituted, ... }. Per-file progress
  // isn't streamable through a single fetch, so we just show a generic
  // "publishing…" message; full timing shows up in `wrangler tail`.
  const publish = async () => {
    if (!creds) return;
    setStatus('publishing');
    setErrorMsg('');
    setResult(null);
    try {
      // 1. Pick files from project state.
      const coverImg = project.images.find(i => i.id === project.coverImageId) || project.images[0];
      const galleryImgs = project.images.filter(i => i.id !== coverImg?.id);
      const modelFiles = project.files.filter(f => f.isModel && f.blob);
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
      fd.append('visibility', visibility);
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
      for (let i = 0; i < modelFiles.length; i++) {
        fd.append('model', modelFiles[i].blob, modelFiles[i].name);
      }

      setProgressMsg('Uploading + publishing to Cults3D…');

      // 3. One POST does the whole pipeline server-side.
      const res = await fetch(`${WORKER_URL}/api/v1/cults3d/web/publish`, {
        method: 'POST',
        headers: {
          'X-Cults-Email': creds.email,
          'X-Cults-Password': creds.password,
        },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      }
      if (!data.designUrl || !data.slug) {
        throw new Error('Publish completed but response was missing designUrl / slug — check Worker logs.');
      }
      setResult({
        designUrl: data.designUrl,
        slug: data.slug,
        substituted: data.substituted || [],
        uploadedFiles: modelFiles.length + galleryImgs.length + 1,
        visibility, // remember what we published with
      });
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    } finally {
      setProgressMsg('');
    }
  };

  // Deactivate the listing we just published. POST /web/unpublish with the
  // slug returned from publish. Cults's "Deactivate" — not a permanent
  // delete, but it hides the listing from search + profile (logged-in owner
  // can still see it in /en/creations/mine and re-activate).
  const deactivate = async () => {
    if (!creds || !result?.slug) return;
    setStatus('deactivating');
    setErrorMsg('');
    try {
      const res = await fetch(`${WORKER_URL}/api/v1/cults3d/web/unpublish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cults-Email': creds.email,
          'X-Cults-Password': creds.password,
        },
        body: JSON.stringify({ slug: result.slug }),
      });
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
    if (!creds) return;
    setListingsLoading(true);
    setListingsError('');
    try {
      const res = await fetch(`${WORKER_URL}/api/v1/cults3d/web/my-creations`, {
        method: 'GET',
        headers: { 'X-Cults-Email': creds.email, 'X-Cults-Password': creds.password },
      });
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
      const res = await fetch(`${WORKER_URL}/api/v1/cults3d/web/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cults-Email': creds.email,
          'X-Cults-Password': creds.password,
        },
        body: JSON.stringify({ slug }),
      });
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
          <span className="mp-display tracking-wide text-[14px]" style={{ color: '#15171C' }}>LIVE PUBLISH</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.2em] px-1.5 py-0.5" style={{ background: '#c83f10', color: '#fff' }}>Real</span>
          <span className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.55)' }}>web upload</span>
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
              ) : <span className="mp-mono">{creds?.email}</span>}
              <button onClick={openConnections} className="mp-mono text-[11px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition ml-1" style={{ color: 'rgba(21,23,28,0.55)' }}>manage</button>
              <button onClick={disconnect} className="mp-mono text-[11px] uppercase tracking-[0.15em] hover:text-[#c83f10] transition" style={{ color: 'rgba(21,23,28,0.55)' }}>disconnect</button>
            </div>
            {/* Visibility is set on the Platforms step (project.platforms.cults.visibility). */}
            <div className="flex items-center gap-2 mb-2.5 text-[12px] flex-wrap" style={{ color: 'rgba(21,23,28,0.7)' }}>
              <span className="mp-mono uppercase tracking-[0.15em] text-[11px]">visibility</span>
              <strong>{visibility === 'secret' ? 'Secret' : 'Public'}</strong>
              <span className="text-[11px]" style={{ color: 'rgba(21,23,28,0.5)' }}>· change in the Platforms step</span>
            </div>
            <p className="text-[12px] mb-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.6)' }}>
              ⚠️ This publishes a <strong>real listing</strong> on cults3d.com under <span className="mp-mono">{creds?.email}</span>. Files upload directly to Cults's S3. {visibility === 'secret' ? 'Secret listings are reachable only via the URL we return — you can flip to public from Cults later.' : 'Public listings appear on your profile + search immediately.'}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={publish} className="mp-btn text-xs py-2 px-3"><Send size={13} /> Publish to {platform.name} (LIVE)</button>
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
                  <span className="mp-mono uppercase tracking-[0.15em] text-[11px]" style={{ color: 'rgba(21,23,28,0.55)' }}>
                    My listings on cults3d.com{listings !== null && !listingsLoading ? ` · ${listings.length}` : ''}
                  </span>
                  <button onClick={loadListings} disabled={listingsLoading} className="mp-mono text-[11px] uppercase tracking-[0.15em] hover:text-[#FF5722] transition disabled:opacity-40" style={{ color: 'rgba(21,23,28,0.55)' }}>
                    {listingsLoading ? '… refreshing' : '↻ refresh'}
                  </button>
                </div>

                {listingsError && (
                  <div className="text-[12px] p-2 mb-2 break-all" style={{ background: 'rgba(200,63,16,0.06)', border: '1px solid rgba(200,63,16,0.3)', color: 'rgba(21,23,28,0.8)' }}>
                    {listingsError}
                  </div>
                )}

                {listingsLoading && listings === null && (
                  <div className="flex items-center gap-2 text-xs py-2" style={{ color: 'rgba(21,23,28,0.6)' }}>
                    <Loader size={13} className="mp-spin" /> Loading your listings…
                  </div>
                )}

                {listings !== null && listings.length === 0 && !listingsLoading && (
                  <p className="text-[12px] py-1" style={{ color: 'rgba(21,23,28,0.55)' }}>No listings yet — publish one above and they'll appear here.</p>
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
                            <div className="flex items-center gap-1.5 text-[10px] mp-mono uppercase tracking-[0.1em]" style={{ color: 'rgba(21,23,28,0.5)' }}>
                              <span style={{ color: badgeColor }}>{l.status}</span>
                              {l.priceLabel && <span>· {l.priceLabel}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a href={l.editUrl} target="_blank" rel="noopener noreferrer" className="mp-mono text-[10px] uppercase tracking-[0.1em] hover:text-[#FF5722] transition px-1" style={{ color: 'rgba(21,23,28,0.55)' }} title="Open on Cults">
                              open
                            </a>
                            {l.status !== 'offline' && (
                              <button onClick={() => rowAction(l.slug, 'deactivate')} disabled={isPending} className="mp-mono text-[10px] uppercase tracking-[0.1em] hover:text-[#FF5722] transition px-1 disabled:opacity-40" style={{ color: 'rgba(21,23,28,0.55)' }} title="Hide from search + profile (reversible)">
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

                <p className="text-[10px] mt-2 leading-snug" style={{ color: 'rgba(21,23,28,0.45)' }}>
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
                : <>Published to {platform.name} ({result?.visibility === 'secret' ? 'secret' : 'public'}){result?.uploadedFiles ? <span style={{ color: 'rgba(21,23,28,0.55)' }}> · {result.uploadedFiles} file{result.uploadedFiles === 1 ? '' : 's'}</span> : null}</>}
            </div>
            {result?.designUrl && (
              <a href={result.designUrl} target="_blank" rel="noopener noreferrer" className="mp-card mp-mono text-[13px] p-2 mb-2 break-all block hover:text-[#FF5722] transition" style={{ background: 'rgba(21,23,28,0.04)', color: 'rgba(21,23,28,0.85)' }}>
                {result.designUrl}
              </a>
            )}
            {result?.substituted?.length > 0 && (
              <p className="text-[11px] mb-2 leading-snug" style={{ color: 'rgba(21,23,28,0.55)' }}>
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
                  <button onClick={deactivate} className="mp-mono text-[12px] uppercase tracking-[0.15em] hover:text-[#c83f10] transition" style={{ color: 'rgba(21,23,28,0.55)' }}>
                    Deactivate this listing
                  </button>
                </>
              )}
              <span style={{ color: 'rgba(21,23,28,0.25)' }}>·</span>
              <button onClick={disconnect} className="mp-mono text-[12px] uppercase tracking-[0.15em] hover:text-[#c83f10] transition" style={{ color: 'rgba(21,23,28,0.55)' }}>disconnect</button>
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
              <button onClick={publish} className="mp-btn text-xs py-2 px-3"><ArrowRight size={13} /> Retry</button>
              <button onClick={disconnect} className="mp-mono text-[12px] uppercase tracking-[0.15em] hover:text-[#c83f10] transition" style={{ color: 'rgba(21,23,28,0.55)' }}>disconnect</button>
            </div>
          </>
        )}

        <p className="text-[10px] mt-2.5 leading-snug" style={{ color: 'rgba(21,23,28,0.45)' }}>
          Uses the ModelPrep backend at {WORKER_URL}. To run a local backend: <span className="mp-mono">cd backend && npm run dev</span> in the modelprep monorepo.
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// ACCOUNT CONNECTIONS — centralized multi-account sign-in (Settings modal)
// =====================================================================
const ACCT_STATUS = {
  connected: { dot: '#1a7f37', label: 'Connected' },
  reconnect: { dot: '#d97706', label: 'Reconnect needed' },
  error:     { dot: '#dc2626', label: 'Error' },
  unknown:   { dot: 'rgba(21,23,28,0.3)', label: 'Not verified' },
};
function StatusDot({ status }) {
  const s = ACCT_STATUS[status] || ACCT_STATUS.unknown;
  return <span title={s.label} className="inline-block rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: s.dot }} />;
}

// The header "Accounts" button: shows how many platforms have an active connection.
function ConnectionsButton({ onOpen }) {
  useAccounts();
  const connected = CONNECTABLE.filter((id) => getActive(id)).length;
  return (
    <button onClick={onOpen} className="mp-btn mp-btn-ghost text-xs py-2 px-3" title="Manage platform sign-ins">
      <User size={13} /> Accounts
      {connected > 0 && <span className="ml-1 mp-mono text-[12px]" style={{ color: '#1a7f37' }}>{connected}</span>}
    </button>
  );
}

function ConnectionsModal({ open, onClose }) {
  useAccounts();
  if (!open) return null;
  const meta = (id) => PLATFORMS.find((p) => p.id === id) || { id, name: id, dot: '#888' };
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-auto" style={{ background: 'rgba(21,23,28,0.45)' }} onClick={onClose}>
      <div className="mp-card w-full max-w-xl my-8" style={{ background: '#EDE9DE' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10" style={{ borderColor: 'rgba(21,23,28,0.12)', background: '#EDE9DE' }}>
          <div className="flex items-center gap-2"><User size={16} /><span className="mp-display text-[18px]">Connections</span></div>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3 max-h-[72vh] overflow-auto">
          <p className="text-[12px]" style={{ color: 'rgba(21,23,28,0.6)' }}>Sign in to your publishing platforms once. Add multiple accounts per platform and choose which is active — that's the account ModelPrep publishes with. Stored only in this browser.</p>
          {CONNECTABLE.map((id) => <PlatformConnections key={id} platform={meta(id)} />)}
          <div className="mp-card p-3" style={{ background: 'rgba(21,23,28,0.03)' }}>
            <div className="text-[11px] mp-mono uppercase tracking-[0.12em] mb-1.5" style={{ color: 'rgba(21,23,28,0.45)' }}>Coming soon</div>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.filter((p) => !CONNECTABLE.includes(p.id)).map((p) => (
                <span key={p.id} className="mp-pill text-[11px] flex items-center" style={{ background: 'rgba(21,23,28,0.06)', color: 'rgba(21,23,28,0.5)' }}>
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: p.dot }} />{p.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformConnections({ platform }) {
  const acc = useAccounts();
  const accounts = acc.getAccounts(platform.id);
  const active = acc.getActive(platform.id);
  const [adding, setAdding] = useState(false);
  const showForm = adding || accounts.length === 0;
  return (
    <section className="mp-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: platform.dot }} />
        <span className="mp-display text-[15px]">{platform.name}</span>
        {accounts.length > 0 && <span className="mp-mono text-[11px]" style={{ color: 'rgba(21,23,28,0.4)' }}>{accounts.length} account{accounts.length > 1 ? 's' : ''}</span>}
      </div>
      {accounts.map((a) => (
        <div key={a.id} className="flex items-center gap-2 text-[13px] mp-card p-2" style={{ background: a.id === active?.id ? 'rgba(26,127,55,0.06)' : 'rgba(21,23,28,0.03)' }}>
          <StatusDot status={a.status} />
          <span className="flex-1 truncate">{a.label}</span>
          {a.id === active?.id
            ? <span className="mp-pill text-[10px]" style={{ background: 'rgba(26,127,55,0.15)', color: '#1a7f37' }}>Active</span>
            : <button onClick={() => acc.setActive(platform.id, a.id)} className="mp-mono text-[11px] underline" style={{ color: '#FF5722' }}>Use</button>}
          <button onClick={() => acc.removeAccount(platform.id, a.id)} aria-label="Remove account" className="opacity-50 hover:opacity-100"><Trash2 size={13} /></button>
        </div>
      ))}
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
  const desktop = (typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop) ? window.modelprepDesktop : null;
  const inputCls = 'mp-card text-[13px] p-2 w-full';

  const finishMw = async (rawCookie) => {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`${WORKER_URL}/api/v1/makerworld/web/check`, { headers: { 'X-MW-Cookie': rawCookie } });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('Session not valid — sign in again (needs token + cf_clearance).');
      // Auto-label from the MakerWorld profile (handle/name); a typed label overrides it.
      let autoLabel = label.trim();
      if (!autoLabel) {
        try {
          const me = await (await fetch(`${WORKER_URL}/api/v1/makerworld/web/whoami`, { headers: { 'X-MW-Cookie': rawCookie } })).json();
          if (me?.handle) autoLabel = me.name ? `${me.name} (@${me.handle})` : `@${me.handle}`;
        } catch { /* fall back below */ }
      }
      acc.addAccount('makerworld', { label: autoLabel || 'MakerWorld', secret: rawCookie, status: 'connected' });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  if (platform.id === 'cults') {
    return (
      <div className="space-y-1.5">
        <input className={inputCls} placeholder="Cults3D email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls} type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
        {err && <div className="text-[11px]" style={{ color: '#b91c1c' }}>{err}</div>}
        <div className="flex gap-2">
          <button disabled={!email.trim() || !pass} onClick={() => { acc.addAccount('cults', { label: email.trim(), secret: { email: email.trim(), password: pass }, status: 'connected' }); onDone(); }} className="mp-btn text-xs py-1.5 px-3 disabled:opacity-40">Save account</button>
          {canCancel && <button onClick={onDone} className="mp-btn mp-btn-ghost text-xs py-1.5 px-3">Cancel</button>}
        </div>
        <p className="text-[11px]" style={{ color: 'rgba(21,23,28,0.5)' }}>Email + password go to the Worker only to log in; stored only in this browser.</p>
      </div>
    );
  }
  // MakerWorld
  return (
    <div className="space-y-1.5">
      <input className={inputCls} placeholder="Account name (optional — defaults to your @handle)" value={label} onChange={(e) => setLabel(e.target.value)} />
      {desktop ? (
        <button disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { const r = await desktop.connectMakerWorld(); if (!r?.ok || !r.cookie) throw new Error(r?.error || 'Sign-in cancelled.'); await finishMw(r.cookie); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); } }} className="mp-btn text-sm py-2 px-4 disabled:opacity-40">{busy ? 'Waiting for sign-in…' : 'Sign in to MakerWorld'}</button>
      ) : (
        <>
          <div className="text-[11px]" style={{ color: 'rgba(21,23,28,0.6)' }}>One-click sign-in is in the desktop app. On the web, paste your session cookie (DevTools → Application → Cookies on a logged-in MakerWorld tab):</div>
          <textarea className={inputCls} rows={2} placeholder="token=…; cf_clearance=…; refreshToken=…" value={cookie} onChange={(e) => setCookie(e.target.value)} />
          <button disabled={!cookie.trim() || busy} onClick={() => finishMw(cookie.trim())} className="mp-btn text-xs py-1.5 px-3 disabled:opacity-40">{busy ? 'Checking…' : 'Connect'}</button>
        </>
      )}
      {err && <div className="text-[11px]" style={{ color: '#b91c1c' }}>{err}</div>}
      {canCancel && <button onClick={onDone} className="mp-mono text-[11px] underline" style={{ color: 'rgba(21,23,28,0.5)' }}>Cancel</button>}
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
// Curated MakerWorld category IDs (int leaf ids). 401 is confirmed; others follow
// the captured parent+offset pattern. Refine via the categories endpoint later.
const MW_CATEGORIES = [
  { id: 401, label: 'Household' },
  { id: 901, label: '3D Printer · Accessories' },
  { id: 902, label: '3D Printer · Parts' },
  { id: 903, label: '3D Printer · Test Models' },
  { id: 104, label: 'Art · Sculptures' },
  { id: 303, label: 'Hobby & DIY · Music' },
  { id: 800, label: 'Toys & Games' },
  { id: 600, label: 'Miniatures' },
  { id: 700, label: 'Tools' },
  { id: 1000, label: 'Props & Cosplays' },
];

// The bundled BOM catalog (kits/filaments/materials trees) is ~548KB — lazy-load
// it only when the user opens the BOM picker so it stays out of the main bundle.
let _mwCatalogCache = null;
async function loadMwCatalog() {
  if (_mwCatalogCache) return _mwCatalogCache;
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
      const res = await fetch(`${WORKER_URL}/api/v1/makerworld/web/related?type=${type}&keyword=${encodeURIComponent(q)}`, { headers: { 'X-MW-Cookie': cookie } });
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
        {hint && <span className="text-[11px] ml-auto" style={{ color: 'rgba(21,23,28,0.45)' }}>{hint}</span>}
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
function MwMyModels({ cookie }) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const load = async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${WORKER_URL}/api/v1/makerworld/web/my-creations`, { headers: { 'X-MW-Cookie': cookie } });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || data?.error || 'Failed to load');
      setModels(Array.isArray(data.designs) ? data.designs : []);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  };
  useEffect(() => { if (open && models === null) load(); }, [open]); // eslint-disable-line
  return (
    <div className="mp-card" style={{ background: 'rgba(21,23,28,0.02)' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-2.5 text-left">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-[13px] font-medium" style={{ color: '#15171C' }}>My MakerWorld models</span>
        {models && <span className="mp-mono text-[11px]" style={{ color: 'rgba(21,23,28,0.45)' }}>{models.length} live</span>}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          <button onClick={load} disabled={loading} className="mp-btn mp-btn-ghost text-[11px] py-1 px-2 disabled:opacity-40">{loading ? 'Loading…' : 'Refresh'}</button>
          {err && <div className="text-[11px]" style={{ color: '#B91C1C' }}>{err}</div>}
          {models && models.length === 0 && !loading && <div className="text-[11px] opacity-60">No live models found.</div>}
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
function MakerWorldUploadFlow({ platform, project }) {
  const acc = useAccounts();
  const openConnections = useOpenConnections();
  const mwAccounts = acc.getAccounts('makerworld');
  const active = acc.getActive('makerworld');
  const cookie = active?.secret || ''; // the active account's session; '' = not signed in
  const [status, setStatus] = useState('idle'); // idle|publishing|done|error|deleting
  const [errorMsg, setErrorMsg] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const [result, setResult] = useState(null);
  const [liveCheck, setLiveCheck] = useState(null); // post-submit "did it actually go live?"

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
  const modelFiles = project.files.filter(f => f.isModel && f.blob);
  const has3mf = modelFiles.some(f => /\.3mf$/i.test(f.name));
  const bomCount = boms.kits.length + boms.filaments.length + boms.materials.length;

  // The .3mf's print profile (name, photos, guidelines) is configured in the Profiles step.
  const mw3mfFile = modelFiles.find(f => /\.3mf$/i.test(f.name));
  const mwProfile = project.profiles?.find(p => p.fileId === mw3mfFile?.id) || project.profiles?.[0] || null;
  const profileName = mwProfile?.name || 'Print profile';
  const profilePicIds = mwProfile?.photoIds || [];
  const catLabel = MW_CATEGORIES.find(c => String(c.id) === String(categoryId))?.label || categoryId;

  // Sign-in is managed centrally in the Connections modal; here we only switch/clear.
  const disconnect = () => { if (active) acc.removeAccount('makerworld', active.id); setStatus('idle'); setResult(null); };

  const uploadOne = async (fileOrBlob, name) => {
    const fd = new FormData();
    fd.append('file', fileOrBlob, name);
    fd.append('fileName', name);
    const res = await fetch(`${WORKER_URL}/api/v1/makerworld/web/upload`, { method: 'POST', headers: { 'X-MW-Cookie': cookie }, body: fd });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data?.message || data?.error || `Upload of ${name} failed (HTTP ${res.status})`);
    return data; // { url, key, size, cdnPrefix }
  };

  const publish = async () => {
    if (!cookie) return;
    setStatus('publishing'); setErrorMsg(''); setResult(null);
    try {
      const coverImg = project.images.find(i => i.id === project.coverImageId) || project.images[0];
      if (!coverImg) throw new Error('Pick a cover image in step 03 before publishing.');
      if (!modelFiles.length) throw new Error('Add at least one model file in step 01 before publishing.');
      if (modelSource === 'remix' && !remixModel) throw new Error('Remix mode is on — search and select the original model you remixed (or switch Source back to Original).');

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
      const galleryImgs = project.images.filter(i => i.id !== coverImg.id).slice(0, platform.maxImages);
      setProgressMsg('Preparing gallery…');
      const galleryUrls = [];
      for (let i = 0; i < galleryImgs.length; i++) {
        const u = (await uploadOne(await cropImageToBlob(galleryImgs[i], webSpec.w, webSpec.h), `image-${i + 2}.jpg`)).url;
        galleryUrls.push(u); imageUrlById[galleryImgs[i].id] = u;
      }
      // Print-profile photos (.3mf): the user-picked images (already cropped 4:3), fallback to cover.
      const profilePicUrls = (profilePicIds.length ? profilePicIds : [coverImg.id]).map((id) => imageUrlById[id]).filter(Boolean);

      setProgressMsg('Uploading model files…');
      let model3mf = null; const mfList = [];
      for (const mf of modelFiles) {
        const up = await uploadOne(mf.blob, mf.name);
        const type = (mf.name.split('.').pop() || '').toLowerCase();
        if (!isLC && type === '3mf' && !model3mf) model3mf = { name: mf.name, size: up.size, url: up.url };
        else mfList.push({ modelName: mf.name, modelSize: up.size, modelType: type, modelUrl: up.url, thumbnailUrl: cover.url, thumbnailName: coverFile.name, thumbnailSize: cover.size });
      }

      // Documentation uploads (Assembly Guide + Other Files) → {name,url,size} refs.
      const uploadDocs = async (files) => {
        const out = [];
        for (const f of files) { const up = await uploadOne(f, f.name); out.push({ name: f.name, url: up.url, size: up.size }); }
        return out;
      };

      let endpoint, input;
      if (isLC) {
        setProgressMsg('Uploading documentation…');
        const [docGuide, docOther] = [await uploadDocs(docGuides), await uploadDocs(docOthers)];
        endpoint = `${WORKER_URL}/api/v1/makerworld/web/laser-cut/publish`;
        input = {
          title: project.title || 'ModelPrep upload',
          license, visibility, tags: project.tags ?? [],
          modelSource,
          modelFiles: mfList,
          pictures: [cover.url, portraitUrl, ...galleryUrls].filter(Boolean),
          ...(relatedModel ? { relatedModel: { id: relatedModel.id, designType: 0 } } : {}),
          ...(docGuide.length ? { docGuide } : {}),
          ...(docOther.length ? { docOther } : {}),
        };
      } else {
        setProgressMsg('Uploading documentation…');
        const [designGuide, designOther] = [await uploadDocs(docGuides), await uploadDocs(docOthers)];
        const hasBom = bomCount > 0;
        endpoint = `${WORKER_URL}/api/v1/makerworld/web/publish`;
        input = {
          title: project.title || 'ModelPrep upload',
          description: project.description || '<p>Uploaded with ModelPrep.</p>',
          categoryId: Number(categoryId),
          tags: project.tags ?? [],
          license,
          visibility,
          coverUrl: cover.url,
          coverPortraitUrl: portraitUrl,
          galleryUrls,
          modelFiles: mfList,
          ...(modelSource === 'remix' && remixModel ? { modelSource: 'remix', remixOriginalIds: [remixModel.id] } : {}),
          ...(relatedModel ? { relatedModel: { id: relatedModel.id, designType: 1 } } : {}),
          ...(exclusive ? { exclusive: 1 } : {}),
          ...(hasBom ? { boms: { ...boms, ...(otherParts.length ? { otherParts } : {}) } } : {}),
          ...(designGuide.length ? { designGuide } : {}),
          ...(designOther.length ? { designOther } : {}),
          ...(model3mf ? { model3mf, printProfile: { title: profileName, pictureUrls: profilePicUrls.length ? profilePicUrls : [cover.url], isPrinterTested: true } } : {}),
          ...(communityPost ? { communityPost: { content: project.description || '' } } : {}),
        };
      }

      setProgressMsg(isLC ? 'Creating Laser & Cut draft + publishing…' : (has3mf ? 'Creating draft + print profile + publishing…' : 'Creating draft + publishing…'));
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'X-MW-Cookie': cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data?.message || data?.error || `Publish failed (HTTP ${res.status})`);
      setResult({ id: data.id, status: data.status, url: data.url, kind: data.kind || '3d', files: mfList.length + galleryUrls.length + 1 + (model3mf ? 1 : 0), visibility });
      setStatus('done');
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : String(err)); setStatus('error'); }
    finally { setProgressMsg(''); }
  };

  const del = async () => {
    if (!cookie || !result?.id) return;
    setStatus('deleting'); setErrorMsg('');
    try {
      const delPath = result.kind === 'laser-cut' ? 'laser-cut/delete' : 'delete';
      const res = await fetch(`${WORKER_URL}/api/v1/makerworld/web/${delPath}`, { method: 'POST', headers: { 'X-MW-Cookie': cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: result.id }) });
      const data = await res.json();
      if (!res.ok || !data.deleted) throw new Error(data?.message || data?.error || `Delete failed (HTTP ${res.status})`);
      setResult(null); setStatus('connected'); setLiveCheck(null);
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : String(err)); setStatus('done'); }
  };

  // Post-submit verification: a submit returns "verifying" — this confirms whether the
  // model actually became LIVE (appears in the published list) vs. still in review/rejected.
  const checkLive = async () => {
    if (!cookie || !result?.id || result.kind === 'laser-cut') return;
    setLiveCheck({ loading: true });
    try {
      const res = await fetch(`${WORKER_URL}/api/v1/makerworld/web/my-creations`, { headers: { 'X-MW-Cookie': cookie } });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || data?.error || 'Status check failed');
      const found = (data.designs || []).find((m) => m.id === result.id);
      setLiveCheck({ loading: false, live: !!found, model: found });
    } catch (e) { setLiveCheck({ loading: false, error: e instanceof Error ? e.message : String(e) }); }
  };

  return (
    <div className="space-y-3">
      {!cookie ? (
        <div className="mp-card p-3 space-y-2" style={{ background: 'rgba(21,23,28,0.04)' }}>
          <div className="mp-mono text-[11px] uppercase tracking-[0.15em] flex items-center gap-1.5" style={{ color: 'rgba(21,23,28,0.55)' }}><StatusDot status="unknown" /> {platform.name} — not connected</div>
          <p className="text-[13px]" style={{ color: 'rgba(21,23,28,0.7)' }}>Sign in to MakerWorld to publish. Accounts are managed in <strong>Connections</strong>.</p>
          <button onClick={openConnections} className="mp-btn text-sm py-2 px-4">Connect MakerWorld</button>
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
              ) : <strong className="truncate">{active.label}</strong>}
            </span>
            <span className="flex items-center gap-2 flex-shrink-0">
              <button onClick={openConnections} className="mp-mono text-[11px] underline" style={{ color: 'rgba(21,23,28,0.5)' }}>manage</button>
              <button onClick={disconnect} className="mp-mono text-[11px] underline" style={{ color: 'rgba(21,23,28,0.5)' }}>disconnect</button>
            </span>
          </div>

          <div className="mp-card p-2 text-[12px]" style={{ background: 'rgba(21,23,28,0.03)', color: 'rgba(21,23,28,0.7)' }}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Globe size={13} style={{ color: '#FF5722' }} />
              <span>{isLC ? 'Laser & Cut' : '3D model'} · {isLC ? (modelSource === 'remix' ? 'Remix' : 'Original') : catLabel} · <strong>{visibility}</strong>{bomCount ? ` · BOM ${bomCount}` : ''}{!isLC && modelSource === 'remix' ? ' · Remix' : ''}{!isLC && exclusive ? ' · Exclusive' : ''}{relatedModel ? ' · linked' : ''}{communityPost ? ' · community post' : ''}</span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'rgba(21,23,28,0.5)' }}>Edit these in the <strong>Platforms</strong> step → MakerWorld options.</div>
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

          {status !== 'done' && (
            <button onClick={publish} disabled={status === 'publishing'} className="mp-btn text-sm py-2 px-4 disabled:opacity-40">
              {status === 'publishing' ? (progressMsg || 'Publishing…') : `Publish to ${platform.name}`}
            </button>
          )}

          {result && (
            <div className="mp-card p-3 space-y-2" style={{ background: 'rgba(21,23,28,0.04)' }}>
              <div className="text-[13px]" style={{ color: 'rgba(21,23,28,0.85)' }}>
                <Check size={14} className="inline" /> Submitted to MakerWorld — status <span className="mp-mono">{result.status}</span> · {result.files} file(s) · {result.visibility}
              </div>
              {result.url && <a href={result.url} target="_blank" rel="noopener noreferrer" className="mp-mono text-[12px] underline break-all block" style={{ color: '#FF5722' }}>{result.url}</a>}
              {/* Post-submit verification — a 200 submit = "accepted for review", not "live". */}
              {result.kind !== 'laser-cut' && (
                <div className="space-y-1">
                  <button onClick={checkLive} disabled={liveCheck?.loading} className="mp-btn mp-btn-ghost text-xs py-1.5 px-3 disabled:opacity-40">{liveCheck?.loading ? 'Checking…' : 'Check if it went live'}</button>
                  {liveCheck && !liveCheck.loading && (
                    liveCheck.error ? <div className="text-[12px]" style={{ color: '#B91C1C' }}>{liveCheck.error}</div>
                    : liveCheck.live ? <div className="text-[12px]" style={{ color: '#1a7f37' }}>✓ Confirmed live on MakerWorld{liveCheck.model?.offlineInstCnt > 0 ? ` (⚠ ${liveCheck.model.offlineInstCnt} print profile(s) offline)` : ''}.</div>
                    : <div className="text-[12px]" style={{ color: '#B23A1A' }}>Not live yet — it's still in <strong>review</strong>, or it was <strong>rejected</strong>. We can't tell which from here yet; open it on MakerWorld to check.</div>
                  )}
                </div>
              )}
              <button onClick={del} disabled={status === 'deleting'} className="mp-btn text-xs py-1.5 px-3 disabled:opacity-40">{status === 'deleting' ? 'Deleting…' : 'Delete this listing'}</button>
            </div>
          )}

          <MwMyModels cookie={cookie} />
        </>
      )}
      {errorMsg && <div className="text-[12px] p-2 mp-card" style={{ background: 'rgba(220,38,38,0.08)', color: '#B91C1C' }}>{errorMsg}</div>}
    </div>
  );
}

// MakerWorld options form — rendered on the Platforms step; edits project.platforms.makerworld.
function MakerWorldOptions({ opts, onUpdate }) {
  useAccounts();
  const cookie = getActive('makerworld')?.secret || '';
  const o = { ...MW_DEFAULT_OPTS, ...(opts || {}) };
  const isLC = o.productMode === 'laser-cut';
  const boms = o.boms || { kits: [], filaments: [], materials: [] };
  const otherParts = o.otherParts || [];
  const bomCount = boms.kits.length + boms.filaments.length + boms.materials.length;
  const [catalog, setCatalog] = useState(null);
  const [catalogErr, setCatalogErr] = useState('');
  const [skuInput, setSkuInput] = useState('');
  const [docGuides, setDocGuides] = useState(mwRuntimeDocs.docGuides);
  const [docOthers, setDocOthers] = useState(mwRuntimeDocs.docOthers);
  const inputCls = 'mp-card text-[13px] p-2 w-full';

  const ensureCatalog = async () => { if (catalog) return catalog; try { const c = await loadMwCatalog(); setCatalog(c); return c; } catch (e) { setCatalogErr(e instanceof Error ? e.message : String(e)); return null; } };
  const addBom = (kind, item) => onUpdate('boms', { ...boms, [kind]: [...boms[kind], item] });
  const removeBom = (kind, idx) => onUpdate('boms', { ...boms, [kind]: boms[kind].filter((_, i) => i !== idx) });
  const setOtherParts = (next) => onUpdate('otherParts', typeof next === 'function' ? next(otherParts) : next);
  const addBySku = async () => {
    const c = await ensureCatalog(); if (!c) return;
    for (const kind of ['kits', 'filaments', 'materials']) { const hit = mwFindBySku(c[kind], skuInput); if (hit) { addBom(kind, mwCatalogItem(hit.node, hit.parentIds, 1)); setSkuInput(''); setCatalogErr(''); return; } }
    setCatalogErr(`No catalog item with Product ID "${skuInput.trim()}".`);
  };
  const setGuides = (files) => { mwRuntimeDocs.docGuides = files; setDocGuides(files); };
  const setOthers = (files) => { mwRuntimeDocs.docOthers = files; setDocOthers(files); };

  return (
    <div className="space-y-2.5 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
      <div className="mp-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'rgba(21,23,28,0.55)' }}>MakerWorld options</div>
      <div className="flex gap-1 mp-card p-1" style={{ background: 'rgba(21,23,28,0.04)' }}>
        {[['3d', '3D Model'], ['laser-cut', 'Laser & Cut']].map(([m, lbl]) => (
          <button key={m} onClick={() => onUpdate('productMode', m)} className="flex-1 text-[12px] py-1.5 rounded-sm transition"
            style={o.productMode === m ? { background: '#15171C', color: '#fff' } : { color: 'rgba(21,23,28,0.6)' }}>{lbl}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {!isLC ? (
          <label className="text-[12px] space-y-1"><span style={{ color: 'rgba(21,23,28,0.6)' }}>Category</span>
            <select className={inputCls} value={o.categoryId} onChange={(e) => onUpdate('categoryId', e.target.value)}>
              {MW_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        ) : (
          <label className="text-[12px] space-y-1"><span style={{ color: 'rgba(21,23,28,0.6)' }}>Source</span>
            <select className={inputCls} value={o.modelSource} onChange={(e) => onUpdate('modelSource', e.target.value)}>
              <option value="original">Original</option><option value="remix">Remix</option>
            </select>
          </label>
        )}
        <label className="text-[12px] space-y-1"><span style={{ color: 'rgba(21,23,28,0.6)' }}>Visibility</span>
          <select className={inputCls} value={o.visibility} onChange={(e) => onUpdate('visibility', e.target.value)}>
            <option value="private">Private</option><option value="public">Public</option>
          </select>
        </label>
      </div>

      <label className="text-[12px] space-y-1 block"><span style={{ color: 'rgba(21,23,28,0.6)' }}>License</span>
        <select className={inputCls} value={o.license || ''} onChange={(e) => onUpdate('license', e.target.value)}>
          <option value="">Same as Details step</option>
          {MW_LICENSE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <span className="text-[10px] block" style={{ color: 'rgba(21,23,28,0.5)' }}>Defaults to your Details-step license (mapped to MakerWorld). Override for MakerWorld-only licenses (Exclusive, SDFL-PPO…).</span>
      </label>

      {!isLC && (
        <MwSection title="Source & remix" hint="original or remix" badge={o.modelSource === 'remix' ? '1' : 0}>
          <label className="text-[12px] space-y-1 block"><span style={{ color: 'rgba(21,23,28,0.6)' }}>Model source</span>
            <select className={inputCls} value={o.modelSource} onChange={(e) => onUpdate('modelSource', e.target.value)}>
              <option value="original">Original design</option>
              <option value="remix">Remix of another model</option>
            </select>
          </label>
          {o.modelSource === 'remix' && (
            <div className="space-y-1">
              <div className="text-[11px]" style={{ color: 'rgba(21,23,28,0.55)' }}>Link the original model you remixed (search your own designs):</div>
              <MwRelatedSearch cookie={cookie} type={0} selected={o.remixModel} onSelect={(v) => onUpdate('remixModel', v)} label="Search 3D models you remixed…" />
            </div>
          )}
        </MwSection>
      )}
      <MwSection title={isLC ? 'Linked 3D model' : 'Linked Laser & Cut model'} hint="optional" badge={o.relatedModel ? '1' : 0}>
        <div className="text-[11px]" style={{ color: 'rgba(21,23,28,0.55)' }}>{isLC ? 'Link a published 3D model that pairs with this Laser & Cut design.' : 'Link a published Laser & Cut model that pairs with this 3D model.'}</div>
        <MwRelatedSearch cookie={cookie} type={isLC ? 0 : 1} selected={o.relatedModel} onSelect={(v) => onUpdate('relatedModel', v)} label={isLC ? 'Search your 3D models…' : 'Search your Laser & Cut models…'} />
      </MwSection>
      {!isLC && (
        <MwSection title="Bill of Materials" hint="kits · filaments · materials" badge={bomCount + otherParts.length || 0}>
          <div className="text-[11px]" style={{ color: 'rgba(21,23,28,0.55)' }}>Pick Maker's Supply catalog items, or enter a Product ID. (Needs ≥1 kit/filament/material — "other parts" alone won't validate.)</div>
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
                  <div className="mp-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'rgba(21,23,28,0.5)' }}>{lbl}</div>
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
                <div className="mp-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'rgba(21,23,28,0.5)' }}>Other parts (free text)</div>
                {otherParts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] mp-card p-1.5" style={{ background: 'rgba(21,23,28,0.04)' }}>
                    <span className="flex-1 truncate">{p.name} <span className="mp-mono opacity-50">×{p.quantity}</span></span>
                    <button onClick={() => setOtherParts(arr => arr.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100"><X size={13} /></button>
                  </div>
                ))}
                <button onClick={() => setOtherParts(arr => [...arr, { name: 'Part', quantity: 1, note: '' }])} className="mp-btn mp-btn-ghost text-[11px] py-1 px-2"><Plus size={11} /> Add other part</button>
              </div>
            </>
          )}
          {catalogErr && <div className="text-[11px]" style={{ color: '#B91C1C' }}>{catalogErr}</div>}
        </MwSection>
      )}
      <MwSection title="Documentation" hint="assembly guide · other files" badge={docGuides.length + docOthers.length || 0}>
        <label className="text-[12px] space-y-1 block"><span style={{ color: 'rgba(21,23,28,0.6)' }}>Assembly guide (pdf/png/jpg/webp/gif)</span>
          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" className="text-[11px] w-full" onChange={(e) => setGuides(Array.from(e.target.files || []))} />
        </label>
        {docGuides.length > 0 && <div className="text-[11px] opacity-60">{docGuides.map(f => f.name).join(', ')}</div>}
        <label className="text-[12px] space-y-1 block"><span style={{ color: 'rgba(21,23,28,0.6)' }}>Other files (txt/pdf/zip)</span>
          <input type="file" multiple accept=".txt,.pdf,.zip" className="text-[11px] w-full" onChange={(e) => setOthers(Array.from(e.target.files || []))} />
        </label>
        {docOthers.length > 0 && <div className="text-[11px] opacity-60">{docOthers.map(f => f.name).join(', ')}</div>}
        <div className="text-[10px] opacity-50">Docs are kept for this session (not saved with the project).</div>
      </MwSection>
      {!isLC && (
        <label className="flex items-start gap-2 text-[12px]" style={{ color: 'rgba(21,23,28,0.7)' }}>
          <input type="checkbox" checked={!!o.exclusive} onChange={(e) => onUpdate('exclusive', e.target.checked)} className="mt-0.5" />
          <span>Join the <strong>Exclusive Model Program</strong> (this model is published exclusively on MakerWorld).</span>
        </label>
      )}
      {!isLC && (
        <label className="flex items-center gap-2 text-[12px]" style={{ color: 'rgba(21,23,28,0.7)' }}>
          <input type="checkbox" checked={!!o.communityPost} onChange={(e) => onUpdate('communityPost', e.target.checked)} /> Also create a community post
        </label>
      )}
      {isLC && (
        <div className="text-[12px] p-2 mp-card" style={{ background: 'rgba(255,105,0,0.06)', color: 'rgba(21,23,28,0.7)' }}>
          Laser & Cut mode uploads your <span className="mp-mono">.lac/.svg/.dxf</span> files to the separate Laser & Cut product. Print-profile, BOM and community post don't apply.
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
  useEffect(() => {
    if (!canvasRef.current || !image) return;
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
  }, [image, cover]);
  return (
    <div className="relative group">
      <div className="overflow-hidden" style={{ background: '#15171C' }}>
        <canvas ref={canvasRef} className="w-full block" />
      </div>
      <div className="absolute top-2 left-2 mp-mono text-[11px] uppercase tracking-[0.15em] px-1.5 py-0.5" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
        {cover.label} · {cover.w}×{cover.h}
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
        alt=""
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
  const galleryImgs = project.images.filter(i => i.id !== project.coverImageId).slice(0, Math.max(0, platform.maxImages - 1));
  const descHtml = mdToHtml(project.description || '');
  const Edit = ({ to, label = 'edit' }) => <button onClick={() => setCurrentSection?.(to)} className="mp-mono text-[11px] underline" style={{ color: '#FF5722' }}>{label}</button>;
  const lbl = (t) => <span className="text-[11px]" style={{ color: 'rgba(21,23,28,0.6)' }}>{t}</span>;
  return (
    <div className="mp-card" style={{ background: 'rgba(21,23,28,0.02)' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-2.5 text-left">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-[13px] font-medium" style={{ color: '#15171C' }}>Preview listing</span>
        <span className="text-[11px] ml-auto truncate" style={{ color: 'rgba(21,23,28,0.45)', maxWidth: '55%' }}>{project.title || '(no title)'} · {project.images.length} img · {project.tags.length} tags</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {cover ? (
            <div>
              <div className="flex items-center justify-between mb-1">{lbl(`Cover · ${platform.covers.map(c => `${c.w}×${c.h}`).join(' · ')}`)}<Edit to="images" /></div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${platform.covers.length}, minmax(0,1fr))` }}>
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
              <div className="grid grid-cols-6 gap-1.5">{galleryImgs.map(img => <GalleryThumb key={img.id} image={img} mainCover={platform.covers[0]} hideDownload />)}</div></div>
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
    <div className="border-b pb-6" style={{ borderColor: 'rgba(21,23,28,0.15)' }}>
      <div className="flex items-center gap-3 mb-3">
        <span className="mp-mono text-[12px] tracking-[0.3em]" style={{ color: '#FF5722' }}>
          <span className="mp-dimline">STEP {number}</span>
        </span>
        <div className="flex-1 mp-tickrule" />
        <span className="mp-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'rgba(21,23,28,0.4)' }}>
          /// modelprep
        </span>
      </div>
      <h2 className="mp-display text-[32px] sm:text-[44px] leading-[0.95] sm:leading-[0.92] mb-3" style={{ color: '#15171C' }}>{title}</h2>
      <p className="mp-body text-[15px] max-w-2xl leading-relaxed" style={{ color: 'rgba(21,23,28,0.65)' }}>{subtitle}</p>
    </div>
  );
}

function SectionNav({ backLabel, nextLabel, nextDisabled, onBack, onNext, disabledReason }) {
  return (
    <div className="mt-10 pt-5 border-t flex items-center justify-between gap-4" style={{ borderColor: 'rgba(21,23,28,0.1)' }}>
      <div>
        {backLabel && (
          <button onClick={onBack} className="mp-btn mp-btn-ghost text-xs">
            <ChevronRight size={12} className="rotate-180" /> {backLabel}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3 justify-end text-right">
        {nextLabel && nextDisabled && disabledReason && (
          <span className="mp-body text-[13px] leading-snug" style={{ color: 'rgba(21,23,28,0.55)' }}>{disabledReason}</span>
        )}
        {nextLabel && (
          <button onClick={onNext} disabled={nextDisabled} className="mp-btn flex-shrink-0">
            {nextLabel} <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
