// Pure formatting / file helpers — no React, no DOM. Extracted from App.jsx so
// they can be unit-tested in isolation (see format.test.js) and reused.

export function escapeHtml(s) {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function inlineFormat(t) {
  // Images first so the link rule can't match inside ![alt](url) and orphan the bang.
  return t.replace(/!\[(.*?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/~~(.+?)~~/g, '<del>$1</del>')
          .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
          .replace(/`(.+?)`/g, '<code>$1</code>');
}

// opts.maxHeading: per-platform heading-depth ceiling (deeper #s clamp to it).
export function mdToHtml(md, opts = {}) {
  if (!md) return '';
  const maxHeading = opts.maxHeading || 6;
  const lines = md.split('\n'); const out = []; let listTag = null, inCode = false;
  let codeBuf = [], paraBuf = [], quoteBuf = [];
  // Single newlines inside a block are hard breaks: joining with a space
  // collapsed multi-line blocks (e.g. print settings) into one run-on paragraph.
  const flushPara = () => { if (paraBuf.length) { const t = paraBuf.map(l => l.trim()).join('<br>').trim(); if (t) out.push(`<p>${inlineFormat(t)}</p>`); paraBuf = []; } };
  const closeList = () => { if (listTag) { out.push(`</${listTag}>`); listTag = null; } };
  const flushQuote = () => { if (quoteBuf.length) { out.push(`<blockquote><p>${inlineFormat(quoteBuf.map(l => l.trim()).join('<br>').trim())}</p></blockquote>`); quoteBuf = []; } };
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) { out.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`); codeBuf = []; inCode = false; }
      else { flushPara(); flushQuote(); closeList(); inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(escapeHtml(line)); continue; }
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) { flushPara(); flushQuote(); closeList(); const lvl = Math.min(h[1].length, maxHeading); out.push(`<h${lvl}>${inlineFormat(h[2])}</h${lvl}>`); continue; }
    const q = line.match(/^>\s?(.*)$/);
    if (q) { flushPara(); closeList(); quoteBuf.push(q[1]); continue; }
    flushQuote();
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ol || ul) {
      flushPara();
      const want = ol ? 'ol' : 'ul';
      if (listTag !== want) { closeList(); out.push(`<${want}>`); listTag = want; }
      out.push(`<li>${inlineFormat((ol || ul)[1])}</li>`);
      continue;
    }
    if (line.trim() === '') { flushPara(); closeList(); continue; }
    closeList(); paraBuf.push(line);
  }
  flushPara(); flushQuote(); closeList();
  return out.join('\n');
}

// MakerWorld's description editor is CKEditor with a fixed schema (verified live 2026-06-22):
//   #/##/### → <h2>/<h3>/<h4> (it remaps H1→H2), *italic* → <i> (not <em>), links carry
//   target/rel, ordered + unordered lists, blockquotes. Inline code, strikethrough, <pre>
//   and <hr> are NOT supported (stripped) — so we render their text as plain.
function inlineFormatMW(t) {
  // Images first so the link rule can't match inside ![alt](url) and orphan the bang.
  return t.replace(/!\[(.*?)\]\((.+?)\)/g, '<a target="_blank" rel="noopener noreferrer" href="$2">$1</a>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<i>$1</i>')
          .replace(/~~(.+?)~~/g, '$1') // strikethrough unsupported → keep text only
          .replace(/\[(.+?)\]\((.+?)\)/g, '<a target="_blank" rel="noopener noreferrer" href="$2">$1</a>')
          .replace(/`(.+?)`/g, '$1'); // inline code unsupported → keep text only
}

export function mdToMakerWorldHtml(md) {
  if (!md) return '';
  const lines = md.split('\n'); const out = [];
  let listTag = null;       // 'ul' | 'ol' | null
  let quoteBuf = [], paraBuf = [];
  // Single newlines inside a block are hard breaks (CKEditor <br>): joining with
  // a space collapsed multi-line blocks into one run-on paragraph.
  const flushPara = () => { if (paraBuf.length) { const t = paraBuf.map(l => l.trim()).join('<br>').trim(); if (t) out.push(`<p>${inlineFormatMW(t)}</p>`); paraBuf = []; } };
  const closeList = () => { if (listTag) { out.push(`</${listTag}>`); listTag = null; } };
  const flushQuote = () => { if (quoteBuf.length) { out.push(`<blockquote><p>${inlineFormatMW(quoteBuf.map(l => l.trim()).join('<br>').trim())}</p></blockquote>`); quoteBuf = []; } };
  for (const raw of lines) {
    const line = raw.replace(/^```.*$/, ''); // drop code fences; keep any content as plain
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    // Documented MakerWorld CKEditor schema is h2-h4 only: clamp deeper headings to h4.
    if (h) { flushPara(); flushQuote(); closeList(); const lvl = Math.min(h[1].length + 1, 4); out.push(`<h${lvl}>${inlineFormatMW(h[2])}</h${lvl}>`); continue; }
    const q = line.match(/^>\s?(.*)$/);
    if (q) { flushPara(); closeList(); quoteBuf.push(q[1]); continue; }
    flushQuote();
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ol || ul) {
      flushPara();
      const want = ol ? 'ol' : 'ul';
      if (listTag !== want) { closeList(); out.push(`<${want}>`); listTag = want; }
      out.push(`<li>${inlineFormatMW((ol || ul)[1])}</li>`);
      continue;
    }
    if (line.trim() === '') { flushPara(); closeList(); continue; }
    closeList(); paraBuf.push(line);
  }
  flushPara(); flushQuote(); closeList();
  return out.join('');
}

export function mdToPlain(md) {
  if (!md) return '';
  return md
    .replace(/```[\s\S]*?```/g, m => m.replace(/```/g, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/!\[(.*?)\]\((.+?)\)/g, '$1 ($2)')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^[-*]\s+/gm, '• ');
}

export function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
  return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

export function fileExt(name) { return (name.split('.').pop() || '').toLowerCase(); }

export function isModelFile(name) {
  return [
    '3ds', '3mf', 'amf', 'blend', 'dwg', 'dxf', 'f3d', 'factory', 'fbx',
    'fcstd', 'gcode', 'glb', 'iges', 'ipt', 'obj', 'ply', 'rsdoc', 'scad',
    'shape', 'shapr', 'skp', 'sldasm', 'sldprt', 'slvs', 'step', 'stl',
    'studio3', 'stp', 'stpz', 'svg', 'x3d',
  ].includes(fileExt(name));
}

export function isProfile(name) { return fileExt(name) === '3mf'; }

export function isImageFile(name) {
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif'].includes(fileExt(name));
}

export function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

// Make `name` unique against a Set of taken (lowercased) names by suffixing
// "-2", "-3", … before the extension. Prevents silent collisions in the zip.
export function uniqueFileName(name, taken) {
  if (!taken.has(name.toLowerCase())) return name;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const base = ext ? name.slice(0, -ext.length) : name;
  let n = 2;
  let candidate;
  do { candidate = `${base}-${n}${ext}`; n++; } while (taken.has(candidate.toLowerCase()));
  return candidate;
}
