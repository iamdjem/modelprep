import {
  mwCheckSession,
  mwCreateDraft,
  mwCreateLaserCutDraft,
  mwDelete,
  mwDeleteLaserCut,
  mwDraftStatus,
  mwFetchCatalogStandalone,
  mwLaserCutDraftStatus,
  mwListMyDesigns,
  mwLogin,
  mwLoginWithCode,
  mwPresignUpload,
  mwPublish,
  mwPublishLaserCut,
  mwRefreshToken,
  mwSearchRelatedDesigns,
  mwSuggestTags,
  mwUploadCapabilities,
  mwUploadFile,
  mwWhoami,
  type LaserCutPublishInput,
  type MakerWorldPublishInput,
  type MakerWorldSession,
} from '../backend/src/adapters/makerworld-web.ts';
import {
  resolveMakerWorldRemix,
  validateLaserCutPublish,
  validateMakerWorldPublish,
} from '../backend/src/makerworld-validation.ts';

const MAX_MW_DIRECT_UPLOAD_BYTES = 200 * 1024 * 1024;
const loginAttempts = new Map<string, number[]>();

function json(body: unknown, status = 200) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseJsonBody(request: { bodyType?: string; body?: unknown }) {
  if (request.bodyType === 'none' || request.body == null) return {};
  if (request.bodyType !== 'text') throw new Error('MakerWorld desktop request requires a JSON body.');
  return JSON.parse(String(request.body));
}

function parseFormBody(request: { bodyType?: string; body?: unknown }) {
  if (request.bodyType !== 'form-data' || !Array.isArray(request.body)) {
    throw new Error('MakerWorld desktop upload requires multipart form data.');
  }
  const text = new Map<string, string>();
  const files = new Map<string, { name: string; type: string; bytes: ArrayBuffer | Uint8Array }>();
  for (const entry of request.body as Array<Record<string, unknown>>) {
    const name = String(entry.name || '');
    if (!name) continue;
    if (entry.kind === 'text') text.set(name, String(entry.value ?? ''));
    if (entry.kind === 'file') {
      files.set(name, {
        name: String(entry.fileName || 'upload.bin'),
        type: String(entry.mimeType || 'application/octet-stream'),
        bytes: entry.bytes as ArrayBuffer | Uint8Array,
      });
    }
  }
  return { text, files };
}

function allowLogin(account: string) {
  const key = account.trim().toLowerCase();
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 5) return false;
  recent.push(now);
  loginAttempts.set(key, recent);
  return true;
}

export async function makerWorldLoginDirect(payload: {
  account?: string;
  password?: string;
  code?: string;
  tfaKey?: string;
}) {
  const account = String(payload.account || '').trim();
  if (!account || (!payload.password && !payload.code)) {
    return { status: 400, data: { ok: false, error: 'MakerWorld account and password or verification code are required.' } };
  }
  if (!allowLogin(account)) {
    return { status: 429, data: { ok: false, error: 'Too many sign-in attempts. Wait a minute or use the MakerWorld window.' } };
  }
  try {
    const result = payload.code
      ? await mwLoginWithCode(account, String(payload.code), payload.tfaKey)
      : await mwLogin(account, String(payload.password));
    if (!result.ok) {
      return {
        status: 200,
        data: { ok: false, needCode: true, ...(result.tfaKey ? { tfaKey: result.tfaKey } : {}) },
      };
    }
    const cookie = `token=${result.token}` + (result.refreshToken ? `; refreshToken=${result.refreshToken}` : '');
    return {
      status: 200,
      data: { ok: true, cookie, userId: result.userId, expireIn: result.expireIn },
    };
  } catch (error) {
    return { status: 401, data: { ok: false, error: message(error) } };
  }
}

export async function handleMakerWorldRequest(
  request: {
    url: string;
    method?: string;
    bodyType?: string;
    body?: unknown;
  },
  cookie: string,
) {
  const session: MakerWorldSession = { cookie };
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/v1/makerworld/web/', '');
  const method = request.method || 'GET';

  try {
    if (path === 'check' && method === 'GET') {
      return json({ ok: await mwCheckSession(session) });
    }
    if (path === 'whoami' && method === 'GET') {
      const identity = await mwWhoami(session);
      return json({ ok: !!identity, ...(identity || {}) });
    }
    if (path === 'capabilities' && method === 'GET') {
      return json({ ok: true, ...(await mwUploadCapabilities(session)) });
    }
    if (path === 'my-creations' && method === 'GET') {
      return json({ ok: true, designs: await mwListMyDesigns(session) });
    }
    if (path === 'draft-status' && method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'missing_id' }, 400);
      const status = await mwDraftStatus(session, id);
      return status ? json({ ok: true, ...status }) : json({ ok: false, error: 'not_found' }, 404);
    }
    if (path === 'bom-catalog' && method === 'GET') {
      try {
        return json({ ok: true, source: 'direct', catalog: await mwFetchCatalogStandalone(session) });
      } catch (error) {
        return json({ ok: false, error: 'no_catalog', message: message(error) }, 404);
      }
    }
    if (path === 'suggest-tags' && method === 'GET') {
      return json({
        ok: true,
        suggestions: await mwSuggestTags(session, url.searchParams.get('keyword') || ''),
      });
    }
    if (path === 'upload/presign' && method === 'POST') {
      const body = parseJsonBody(request) as { fileName?: string; size?: number; useType?: string };
      const fileName = String(body.fileName || '').trim();
      const size = Number(body.size || 0);
      if (!fileName) return json({ error: 'missing_file_name' }, 400);
      if (!Number.isFinite(size) || size < 0) return json({ error: 'invalid_file_size' }, 400);
      const useType = body.useType || 'makerworld/model';
      if (useType !== 'makerworld/model') return json({ error: 'invalid_use_type' }, 400);
      const maxBytes = /\.3mf$/i.test(fileName) ? 200 * 1024 * 1024 : MAX_MW_DIRECT_UPLOAD_BYTES;
      if (size > maxBytes) return json({ error: 'file_too_large', maxBytes, gotBytes: size }, 413);
      return json({ ok: true, size, ...(await mwPresignUpload(session, fileName, useType)) });
    }
    if (path === 'upload' && method === 'POST') {
      const form = parseFormBody(request);
      const file = form.files.get('file');
      if (!file) return json({ error: 'no_file' }, 400);
      const fileName = form.text.get('fileName') || file.name;
      const useType = form.text.get('useType') || 'makerworld/model';
      if (useType !== 'makerworld/model') return json({ error: 'invalid_use_type' }, 400);
      const size = file.bytes.byteLength;
      const maxBytes = /\.3mf$/i.test(fileName) ? 200 * 1024 * 1024 : MAX_MW_DIRECT_UPLOAD_BYTES;
      if (size > maxBytes) return json({ error: 'file_too_large', maxBytes, gotBytes: size }, 413);
      return json({ ok: true, ...(await mwUploadFile(session, fileName, file.bytes, useType)) });
    }
    if (path === 'publish' && method === 'POST') {
      const input = parseJsonBody(request) as MakerWorldPublishInput & { draftOnly?: boolean };
      const issues = input.draftOnly
        ? [
          !input?.title?.trim() ? 'title is required' : '',
          !input?.coverUrl ? 'coverUrl is required' : '',
        ].filter(Boolean)
        : validateMakerWorldPublish(input);
      issues.push(...await resolveMakerWorldRemix(session, input));
      if (input.cyberBrick) {
        const capabilities = await mwUploadCapabilities(session);
        if (!capabilities.rcUpload) issues.push('CyberBrick upload is not enabled for this MakerWorld account');
      }
      if (issues.length) return json({ error: 'invalid_publish', issues }, 400);
      let id = 0;
      try {
        id = await mwCreateDraft(session, input);
        if (input.draftOnly) {
          return json({ ok: true, id, status: 'draft', url: `https://makerworld.com/en/my/models/drafts/${id}/edit` });
        }
        await mwPublish(session, id, input);
        return json({ ok: true, id, status: 'verifying', url: `https://makerworld.com/en/my/models/drafts/${id}/edit` });
      } catch (error) {
        let cleanedUp = false;
        if (id) {
          try { await mwDelete(session, id); cleanedUp = true; } catch { /* best effort */ }
        }
        return json({ error: 'mw_publish_failed', message: message(error), draftId: id || undefined, cleanedUp }, 502);
      }
    }
    if (path === 'delete' && method === 'POST') {
      const id = Number((parseJsonBody(request) as { id?: number }).id || 0);
      if (!id) return json({ error: 'missing_id' }, 400);
      await mwDelete(session, id);
      return json({ ok: true, id, deleted: true });
    }
    if (path === 'related' && method === 'GET') {
      const type = url.searchParams.get('type') === '1' ? 1 : 0;
      return json({
        ok: true,
        designs: await mwSearchRelatedDesigns(session, type, url.searchParams.get('keyword') || ''),
      });
    }
    if (path === 'refresh' && method === 'POST') {
      const refreshed = await mwRefreshToken(session);
      if (!refreshed) return json({ ok: false, error: 'no_refresh_token' }, 400);
      const existing = /(?:^|;\s*)refreshToken=([^;]+)/.exec(cookie)?.[1];
      const refreshToken = refreshed.refreshToken || existing;
      const nextCookie = `token=${refreshed.token}` + (refreshToken ? `; refreshToken=${refreshToken}` : '');
      return json({ ok: true, refreshed: true, cookie: nextCookie, expiresIn: refreshed.expiresIn });
    }
    if (path === 'laser-cut/draft-status' && method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'missing_id' }, 400);
      const status = await mwLaserCutDraftStatus(session, id);
      return status ? json({ ok: true, ...status }) : json({ ok: false, error: 'not_found' }, 404);
    }
    if (path === 'laser-cut/publish' && method === 'POST') {
      const input = parseJsonBody(request) as LaserCutPublishInput & { draftOnly?: boolean };
      const issues = input.draftOnly
        ? [
          !input?.title?.trim() ? 'title is required' : '',
          !input?.lacFile && !input?.modelFiles?.length ? 'a .lac or raw model file is required' : '',
        ].filter(Boolean)
        : validateLaserCutPublish(input);
      issues.push(...await resolveMakerWorldRemix(session, input));
      if (input.cyberBrick) {
        const capabilities = await mwUploadCapabilities(session);
        if (!capabilities.rcUpload) issues.push('CyberBrick upload is not enabled for this MakerWorld account');
      }
      if (issues.length) return json({ error: 'invalid_publish', issues }, 400);
      let id = 0;
      try {
        id = await mwCreateLaserCutDraft(session, input);
        if (input.draftOnly) {
          return json({
            ok: true,
            id,
            status: 'draft',
            kind: 'laser-cut',
            url: `https://makerworld.com/en/my/laser-and-cut-models/drafts/${id}/edit`,
          });
        }
        await mwPublishLaserCut(session, id, input);
        return json({ ok: true, id, status: 'verifying', kind: 'laser-cut' });
      } catch (error) {
        let cleanedUp = false;
        if (id) {
          try { await mwDeleteLaserCut(session, id); cleanedUp = true; } catch { /* best effort */ }
        }
        return json({ error: 'mw_publish_failed', message: message(error), draftId: id || undefined, cleanedUp }, 502);
      }
    }
    if (path === 'laser-cut/delete' && method === 'POST') {
      const id = Number((parseJsonBody(request) as { id?: number }).id || 0);
      if (!id) return json({ error: 'missing_id' }, 400);
      await mwDeleteLaserCut(session, id);
      return json({ ok: true, id, deleted: true, kind: 'laser-cut' });
    }
    return json({ error: 'unsupported_makerworld_desktop_route' }, 404);
  } catch (error) {
    return json({ error: 'mw_failed', message: message(error) }, 502);
  }
}
