const THINGIVERSE_ORIGIN = 'https://www.thingiverse.com';
const UPLOAD_URL = `${THINGIVERSE_ORIGIN}/thing:0/edit`;
const FORMATS = new Set(['stl', 'obj', '3mf', 'scad', 'jpg', 'jpeg', 'txt', 'amf', 'dae', '3ds', 'x3d', 'blend', 'ply', 'fcstd', 'dxf', 'ai', 'svg', 'cdr', 'ps', 'eps', 'epsi', 'sch', 'brd', 'png', 'gif', 'doc', 'docx']);
const LICENSES = new Set(['cc', 'cc-sa', 'cc-nd', 'cc-nc', 'cc-nc-sa', 'cc-nc-nd', 'pd0', 'gpl', 'lgpl', 'bsd', 'cern-ohl-s', 'cern-ohl-w', 'cern-ohl-p']);
// No default apps: 1127 was sent on every Thing without any doc evidence and
// produced no visible effect (Customizer stays SCAD-gated regardless).
const DEFAULT_INCLUDED_APPS = [];
const DEFAULT_EDU_DETAIL_TYPES = ['skills', 'duration', 'overview', 'plan', 'materials', 'prep', 'assessment', 'references', 'grades', 'subjects', 'standards'];
const jsonResponse = (body, status = 200) => ({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const errorResponse = (error, status = 502) => jsonResponse({ error: 'thingiverse_failed', message: error instanceof Error ? error.message : String(error) }, status);
const ext = (name) => String(name || '').split('.').pop().toLowerCase();
// Cloudflare's interstitial is an HTML page returned with 403. It means the
// request never reached Thingiverse, so it says nothing about the session.
// Reporting it as "not authenticated" told people to sign in again over a
// session that was working, and pasted a page of HTML into the UI to do it.
function isCloudflareChallenge(body) { return /just a moment|cf-browser-verification|challenge-platform|__cf_chl|Attention Required/i.test(String(body || '')); }
function assertEnabled(enabled) { if (!enabled) { const error = new Error('Thingiverse upload is disabled pending written API-license approval.'); error.code = 'legal_gate'; throw error; } }
function parseJson(request) { if (request.bodyType !== 'text') throw new Error('Thingiverse action requires JSON.'); return JSON.parse(String(request.body)); }
function parseUpload(request) { if (request.bodyType !== 'form-data') throw new Error('Thingiverse upload requires multipart input.'); let role = ''; let file; for (const item of request.body || []) { if (item.name === 'role' && item.kind === 'text') role = String(item.value); if (item.name === 'file' && item.kind === 'file') file = { name: String(item.fileName), mimeType: String(item.mimeType || ''), bytes: Buffer.from(item.bytes) }; } if (!file) throw new Error('Thingiverse upload is missing its file.'); return { role, file }; }
function validateUpload(role, file) { if (!['model', 'image', 'attachment'].includes(role)) throw new Error('Unsupported Thingiverse upload role.'); if (!FORMATS.has(ext(file.name))) throw new Error(`Thingiverse does not accept .${ext(file.name)}.`); if (role === 'image' && file.bytes.byteLength > 5 * 1024 * 1024) throw new Error(`${file.name} exceeds Thingiverse's 5 MB image limit.`); }
function validateSubmit(input) { const issues = []; if (!String(input.name || '').trim()) issues.push('name is required'); if (!String(input.summary || '').trim()) issues.push('summary is required'); if (!String(input.categoryName || '').trim()) issues.push('category name is required'); if (!LICENSES.has(input.license)) issues.push('license is required'); if (!(input.files || []).some((file) => file.role === 'model')) issues.push('at least one model file is required'); if (input.customizable && !(input.files || []).some((file) => file.role === 'model' && ext(file.name) === 'scad')) issues.push('Customizer requires at least one .SCAD model file'); if (input.publish && !input.termsAccepted) issues.push('current terms must be accepted to publish'); if (input.remix && !String(input.sourceThingId || '').trim()) issues.push('remixes require a source Thing ID'); return issues; }
function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '' && item != null)); }
function textSection(title, content) { return { title: String(title || ''), content: String(content || '') }; }
function buildThingPayload(input) {
  const issues = validateSubmit(input); if (issues.length) throw new Error(`Thingiverse validation failed: ${issues.join('; ')}.`);
  const print = compact({
    'printer brand': input.printSettings?.printerBrand,
    printer: input.printSettings?.printer || input.printSettings?.printerModel,
    rafts: input.printSettings?.rafts,
    supports: input.printSettings?.supports,
    resolution: input.printSettings?.resolution,
    infill: input.printSettings?.infill,
    filament_material: input.printSettings?.material || input.printSettings?.filamentType,
    filament_brand: input.printSettings?.filamentBrand,
    filament_color: input.printSettings?.color || input.printSettings?.filamentColor,
    notes: input.printSettings?.notes || input.printSettings?.printNotes,
  });
  // The Thing body IS the summary part (Markdown-capable). Sending only the
  // one-line summary shipped Things with no description at all, so the full
  // Markdown description rides in the body after the summary line.
  const body = [String(input.summary || '').trim(), String(input.description || '').trim()].filter(Boolean).join('\n\n');
  const details = [
    { type: 'summary', data: [{ content: body }] },
  ];
  if (Object.keys(print).length) details.push({ type: 'settings', data: [print] });
  for (const section of input.sections || []) {
    if (section?.type && ['tips', 'design', 'custom'].includes(section.type)) details.push(section);
    else details.push({ type: 'custom', name: String(section?.title || 'Details'), data: Array.isArray(section?.content) ? section.content : [textSection('', section?.content || '')] });
  }
  const tags = [...new Set([...(input.tags || []).map(String), ...(input.nsfw ? ['NSFW'] : [])])];
  return {
    name: String(input.name).trim(),
    category: String(input.categoryName).trim(),
    files: (input.files || []).filter((file) => file.role !== 'image').map((file) => ({ id: file.id, type: 'pending' })),
    images: [],
    description: body,
    is_customizer: !!input.customizable,
    is_wip: !!input.wip,
    is_ai: !!input.aiGenerated,
    tags,
    license: input.license,
    thing_groups: input.groupIds || [],
    thing_programs: input.programIds || [],
    is_remix: !!input.remix,
    ancestors: input.remix ? [Number(input.sourceThingId)] : [],
    details_parts: details,
    included_apps: input.appIds || DEFAULT_INCLUDED_APPS,
    is_edu: !!input.education,
    education: input.education ? { grades: input.education.gradeIds || [], subjects: input.education.subjectIds || [], standards: input.education.standardIds || [] } : { grades: [], subjects: [], standards: [] },
    edu_details_parts: input.education?.detailsParts || DEFAULT_EDU_DETAIL_TYPES.map((type) => ({ type })),
  };
}
// Written clearance for ModelPrep's multi-platform Thingiverse workflow was
// recorded by the product owner on 2026-08-01. Keep the injectable override for
// fail-closed tests and emergency builds, but production is now enabled.
function createThingiverseDirectClient({ fetchImpl = fetch, legalApproved = true } = {}) {
  function apiToken(context) { const token = String(context?.apiToken || ''); if (!token) throw new Error('Thingiverse API token is missing. Reconnect Thingiverse.'); return token; }
  async function api(context, path, { method = 'GET', body, form, label = path } = {}) { const headers = { Accept: 'application/json', Authorization: `Bearer ${apiToken(context)}`, ...(context.cookie ? { Cookie: context.cookie } : {}), Origin: THINGIVERSE_ORIGIN, Referer: UPLOAD_URL }; if (body !== undefined) headers['Content-Type'] = 'application/json'; const response = await fetchImpl(`${THINGIVERSE_ORIGIN}${path}`, { method, headers, body: form || (body === undefined ? undefined : JSON.stringify(body)), redirect: 'manual' }); const data = await response.json().catch(() => ({})); if (!response.ok) { const detail = String(data?.message || data?.error || '').trim(); throw new Error(`Thingiverse ${label} failed (HTTP ${response.status})${detail ? `: ${detail}` : '.'}`); } return data?.data ?? data; }
  async function whoami(context) { const accessToken = String(context?.accessToken || ''); if (!accessToken) throw new Error('Thingiverse access token is missing. Reconnect Thingiverse.'); const response = await fetchImpl(`${THINGIVERSE_ORIGIN}/api/v2/users/me`, { headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` }, credentials: 'include', redirect: 'manual' }); const raw = await response.text().catch(() => ''); let data = {}; try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; } if (!response.ok || response.status >= 300) { if (isCloudflareChallenge(raw)) { const error = new Error('Thingiverse answered with a Cloudflare check instead of the API. The session was not tested, so it has been kept.'); error.code = 'cloudflare_challenge'; throw error; } const detail = String(data?.error || data?.message || raw || '').trim().slice(0, 200); const location = response.headers?.get?.('location'); throw new Error(`Thingiverse session is not authenticated (HTTP ${response.status}${location ? ` → ${location}` : ''}${detail ? `: ${detail}` : ''}).`); } const user = data?.data ?? data; return { id: String(user?.id || 'authenticated-session'), nickname: String(user?.name || user?.username || 'Thingiverse'), legalApproved }; }
  async function upload(context, role, file) { assertEnabled(legalApproved); validateUpload(role, file); const form = new FormData(); form.append('file', new Blob([file.bytes], { type: file.mimeType || 'application/octet-stream' }), file.name); form.append('type', role); const data = await api(context, '/api/files/0/uploadFile', { method: 'POST', form, label: `${role} upload` }); const id = data?.id ?? data?.upload_id ?? data?.pending_upload_id; if (!id) throw new Error('Thingiverse returned no pending upload id.'); return { id, role, name: file.name, size: file.bytes.byteLength }; }
  async function save(context, input) { assertEnabled(legalApproved); const payload = buildThingPayload(input); const created = await api(context, '/api/things', { method: 'POST', body: payload, label: 'draft creation' }); const id = created?.id ?? created?.thing_id; if (!id) throw new Error('Thingiverse created no Thing id.'); const pending = input.files.map((file, rank) => ({ id: file.id, rank })); if (pending.length) await api(context, '/api/files/0/FinalizeFiles', { method: 'POST', body: { target_id: String(id), target_type: 'thing', pending_uploads: pending }, label: 'file finalization' }); if (input.publish) await api(context, `/api/things/${id}/publish`, { method: 'POST', body: {}, label: 'publish' }); return { id: String(id), state: input.publish ? 'public' : 'draft', url: `${THINGIVERSE_ORIGIN}/thing:${id}` }; }
  async function status(context, id) { assertEnabled(legalApproved); const [edit, files, images] = await Promise.all([api(context, `/api/things/${id}/edit`, { label: 'metadata read-back' }), api(context, `/api/things/${id}/files`, { label: 'file read-back' }), api(context, `/api/things/${id}/images`, { label: 'image read-back' })]); return { edit, files, images }; }
  async function handleRequest(request, context) { try { const url = new URL(request.url); const route = url.pathname.split('/api/v1/thingiverse/web/')[1] || ''; if (route === 'gate') return jsonResponse({ ok: true, legalApproved }); if (route === 'whoami') return jsonResponse({ ok: true, user: await whoami(context), legalApproved }); if (route === 'upload' && request.method === 'POST') { const { role, file } = parseUpload(request); return jsonResponse({ ok: true, file: await upload(context, role, file) }); } if (route === 'submit' && request.method === 'POST') return jsonResponse({ ok: true, ...(await save(context, parseJson(request))) }); if (route === 'status') return jsonResponse({ ok: true, thing: await status(context, url.searchParams.get('id')) }); return jsonResponse({ error: 'not_found' }, 404); } catch (error) { return errorResponse(error, error.code === 'legal_gate' ? 451 : 502); } }
  return { handleRequest, save, status, upload, whoami };
}
module.exports = { FORMATS, LICENSES, THINGIVERSE_ORIGIN, isCloudflareChallenge, UPLOAD_URL, buildThingPayload, createThingiverseDirectClient, validateSubmit, validateUpload };
