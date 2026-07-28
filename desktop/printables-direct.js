const PRINTABLES_BASE = 'https://www.printables.com';
const PRINTABLES_GRAPHQL = 'https://api.printables.com/graphql/';
const GRAPHQL_CLIENT_VERSION = 'v4.8.4';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

const ERROR_FRAGMENT = `
  fragment ModelPrepError on ErrorType {
    field
    messages
  }
`;

function response(body, status = 200) {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function errorResponse(error) {
  const message = error instanceof Error ? error.message : String(error);
  return response({ error: 'printables_failed', message }, 502);
}

function parseBody(request) {
  if (request.bodyType === 'none' || request.body == null) return {};
  if (request.bodyType !== 'text') throw new Error('Printables desktop requests must use JSON.');
  return JSON.parse(String(request.body));
}

async function graphQl(cookie, query, variables = {}, fetchImpl = fetch) {
  const result = await fetchImpl(PRINTABLES_GRAPHQL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/json',
      'Graphql-Client-Version': GRAPHQL_CLIENT_VERSION,
      Origin: PRINTABLES_BASE,
      Referer: `${PRINTABLES_BASE}/model/create`,
      'User-Agent': USER_AGENT,
      Cookie: cookie,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await result.text();
  if (result.status === 429) {
    throw new Error('Printables rate limit reached. Wait a moment and try again.');
  }
  if (!result.ok) {
    throw new Error(`Printables GraphQL HTTP ${result.status}: ${text.slice(0, 400)}`);
  }
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error(`Printables GraphQL returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (envelope.errors?.length) {
    const message = envelope.errors.map((item) => item.message).join('; ');
    if (/auth|permission|login|credential/i.test(message)) {
      throw new Error(`Printables session is no longer authorized: ${message}`);
    }
    throw new Error(`Printables GraphQL: ${message}`);
  }
  if (!envelope.data) throw new Error('Printables GraphQL returned no data.');
  return envelope.data;
}

async function printablesWhoamiDirect(cookie, fetchImpl = fetch) {
  const data = await graphQl(cookie, `query ModelPrepPrintablesMe {
    me {
      id
      handle
      publicUsername
      avatarFilePath
    }
  }`, {}, fetchImpl);
  return data.me ?? null;
}

async function presign(cookie, input, fetchImpl) {
  const data = await graphQl(cookie, `mutation ModelPrepUploadModel(
    $fileName: String!,
    $folder: String!,
    $unzip: Boolean!,
    $imageHash: String,
    $imageHeight: Int,
    $imageWidth: Int
  ) {
    upload: printFileUpload2(
      fileName: $fileName
      folder: $folder
      unzip: $unzip
      imageHash: $imageHash
      imageHeight: $imageHeight
      imageWidth: $imageWidth
    ) {
      ok
      errors { ...ModelPrepError }
      uploadData { url fields }
      fileUpload { id }
    }
  }
  ${ERROR_FRAGMENT}`, {
    fileName: input.fileName,
    folder: input.folder ?? '',
    unzip: input.unzip ?? !String(input.fileName).toLowerCase().endsWith('.zip'),
    imageHash: input.imageHash ?? null,
    imageHeight: input.imageHeight ?? null,
    imageWidth: input.imageWidth ?? null,
  }, fetchImpl);
  return data.upload;
}

async function finishUpload(cookie, input, fetchImpl) {
  const data = await graphQl(cookie, `mutation ModelPrepUploadModelFinished(
    $fileUploadId: ID!,
    $crc32c: String
  ) {
    uploadFinished: printFileUploadFinished(
      fileUploadId: $fileUploadId
      crc32c: $crc32c
    ) {
      ok
      errors { ...ModelPrepError }
      output { id filePath }
    }
  }
  ${ERROR_FRAGMENT}`, {
    fileUploadId: input.fileUploadId,
    crc32c: input.crc32c ?? null,
  }, fetchImpl);
  return data.uploadFinished;
}

async function pollUploads(cookie, ids, fetchImpl) {
  return graphQl(cookie, `query ModelPrepPollFileUploads($ids: [ID!]!) {
    fileUploads: modelFileUploads(ids: $ids) {
      id
      notInspectedFiles
      isUploadFinished
      isProcessed
      gcodes {
        id name folder note weight layerHeight nozzleDiameter printDuration excludeFromTotalSum order
        material { id name }
        printer { id name }
      }
      stls { id name folder note order }
      slas { id name folder note layerHeight printDuration order }
      otherFiles { id name folder note order }
      images { id filePath order }
    }
  }`, { ids }, fetchImpl);
}

function normalizeTagName(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function canonicalPrintablesTags(tags) {
  return [...new Set(
    (Array.isArray(tags) ? tags : []).map(normalizeTagName).filter(Boolean),
  )];
}

async function updateModel(cookie, input, fetchImpl) {
  const variables = {
    ...input,
    tags: canonicalPrintablesTags(input.tags),
  };
  const data = await graphQl(cookie, `mutation ModelPrepModelUpdate(
    $tags: [ID], $id: ID, $description: String, $category: ID, $license: ID,
    $mainImage: ID, $name: String, $draft: Boolean, $summary: String,
    $remixParents: [ID], $nsfw: Boolean, $aiGenerated: Boolean,
    $politicalContent: Boolean, $authorship: PrintAuthorshipEnum,
    $remixDescription: String, $slas: [SLAFileInputType],
    $gcodes: [GcodeFileInputType], $stls: [STLFileInputType],
    $otherFiles: [OtherFileInputType], $images: [PrintImageInputType]
  ) {
    modelUpdate(
      tags: $tags, id: $id, description: $description, category: $category,
      license: $license, mainImage: $mainImage, name: $name, draft: $draft,
      summary: $summary, remixParents: $remixParents, nsfw: $nsfw,
      aiGenerated: $aiGenerated, politicalContent: $politicalContent,
      authorship: $authorship, remixDescription: $remixDescription,
      slas: $slas, gcodes: $gcodes, stls: $stls,
      otherFiles: $otherFiles, images: $images
    ) {
      ok
      errors { ...ModelPrepError }
      output { id slug name datePublished }
    }
  }
  ${ERROR_FRAGMENT}`, variables, fetchImpl);
  return data.modelUpdate;
}

async function publishModel(cookie, id, fetchImpl) {
  const data = await graphQl(cookie, `mutation ModelPrepPrintPublishRequest($printId: ID!) {
    printPublishRequest(printId: $printId) {
      ok
      errors { ...ModelPrepError }
      output { id status created }
    }
  }
  ${ERROR_FRAGMENT}`, { printId: id }, fetchImpl);
  return data.printPublishRequest;
}

async function modelStatus(cookie, id, fetchImpl) {
  const data = await graphQl(cookie, `query ModelPrepModelStatus($id: ID!) {
    model: print(id: $id) {
      id slug name datePublished draftReason publishApprovalRequired
      publishRequests { id status created }
    }
  }`, { id }, fetchImpl);
  return data.model ?? null;
}

async function myModels(cookie, fetchImpl) {
  const me = await printablesWhoamiDirect(cookie, fetchImpl);
  if (!me?.id) throw new Error('Printables did not return an authenticated user id.');
  return graphQl(cookie, `query ModelPrepMyModels($userId: ID!) {
    drafts {
      id name slug datePublished draftReason
      image { filePath }
    }
    published: userModels(userId: $userId, limit: 100) {
      items {
        id name slug datePublished
        image { filePath }
      }
      cursor
    }
  }`, { userId: me.id }, fetchImpl);
}

async function deleteModel(cookie, id, fetchImpl) {
  const data = await graphQl(cookie, `mutation ModelPrepPrintDelete($id: ID!) {
    printDelete(id: $id) {
      ok
      errors { ...ModelPrepError }
    }
  }
  ${ERROR_FRAGMENT}`, { id }, fetchImpl);
  return data.printDelete;
}

async function resolveRemix(cookie, value, fetchImpl) {
  if (/^\d+$/.test(value.trim())) {
    return graphQl(
      cookie,
      `query ModelPrepRemixById($id: ID!) {
        model: print(id: $id) { id name slug }
      }`,
      { id: value.trim() },
      fetchImpl,
    );
  }
  return graphQl(cookie, `query ModelPrepRemixByUrl($url: String!) {
    remixUrlInfo(url: $url) {
      url author image title
      license { id name disallowRemixing }
    }
  }`, { url: value }, fetchImpl);
}

function uploadValidation(input) {
  const issues = [];
  const fileName = String(input.fileName || '').trim();
  if (!fileName) issues.push('File name is required.');
  if (fileName.length > 150) issues.push('File name must be at most 150 characters.');
  if (typeof input.size === 'number') {
    const cap = fileName.toLowerCase().endsWith('.zip') && input.unzip === false
      ? 256 * 1024 * 1024
      : 1024 * 1024 * 1024;
    if (!Number.isFinite(input.size) || input.size < 0) issues.push('File size is invalid.');
    else if (input.size > cap) {
      issues.push(`File is larger than the ${Math.round(cap / 1024 / 1024)} MiB Printables limit.`);
    }
  }
  return issues;
}

async function handlePrintablesRequest(request, cookie, fetchImpl = fetch) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const body = parseBody(request);

    if (path.endsWith('/check') || path.endsWith('/whoami')) {
      const user = await printablesWhoamiDirect(cookie, fetchImpl);
      if (!user) return response({ ok: false, error: 'not_authenticated' }, 401);
      return path.endsWith('/check')
        ? response({ ok: true, user })
        : response({ ok: true, ...user });
    }

    if (path.endsWith('/upload/presign')) {
      const issues = uploadValidation(body);
      if (issues.length) return response({ error: 'invalid_upload', issues }, 400);
      const upload = await presign(cookie, body, fetchImpl);
      if (!upload.ok || !upload.fileUpload?.id || !upload.uploadData?.url) {
        return response({ error: 'printables_upload_rejected', issues: upload.errors }, 400);
      }
      return response({ ...upload, ok: true });
    }

    if (path.endsWith('/upload/finish')) {
      if (!body.fileUploadId) return response({ error: 'missing_file_upload_id' }, 400);
      const finished = await finishUpload(cookie, body, fetchImpl);
      if (!finished.ok) {
        return response({ error: 'printables_finish_rejected', issues: finished.errors }, 400);
      }
      return response({ ...finished, ok: true });
    }

    if (path.endsWith('/upload/status')) {
      const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string' && id) : [];
      if (!ids.length) return response({ error: 'missing_ids' }, 400);
      return response({ ok: true, ...(await pollUploads(cookie, ids, fetchImpl)) });
    }

    if (path.endsWith('/model')) {
      const updated = await updateModel(cookie, body, fetchImpl);
      if (!updated.ok || !updated.output?.id) {
        return response({ error: 'printables_model_rejected', issues: updated.errors }, 400);
      }
      return response({ ...updated, ok: true });
    }

    if (path.endsWith('/publish')) {
      if (!body.id) return response({ error: 'missing_id' }, 400);
      const published = await publishModel(cookie, body.id, fetchImpl);
      if (!published.ok) {
        return response({ error: 'printables_publish_rejected', issues: published.errors }, 400);
      }
      return response({ ...published, ok: true });
    }

    if (path.endsWith('/status')) {
      const id = url.searchParams.get('id');
      if (!id) return response({ error: 'missing_id' }, 400);
      const model = await modelStatus(cookie, id, fetchImpl);
      if (!model) return response({ ok: false, error: 'not_found' }, 404);
      const state = model.datePublished
        ? 'live'
        : model.publishRequests?.some((item) => /pending|requested/i.test(item.status))
          ? 'pending'
          : 'draft';
      return response({ ok: true, state, model });
    }

    if (path.endsWith('/my-models')) {
      const models = await myModels(cookie, fetchImpl);
      return response({
        ok: true,
        drafts: models.drafts,
        published: models.published.items,
        cursor: models.published.cursor ?? null,
      });
    }

    if (path.endsWith('/delete')) {
      if (!body.id) return response({ error: 'missing_id' }, 400);
      const deleted = await deleteModel(cookie, body.id, fetchImpl);
      if (!deleted.ok) {
        return response({ error: 'printables_delete_rejected', issues: deleted.errors }, 400);
      }
      return response({ ...deleted, ok: true });
    }

    if (path.endsWith('/remix/resolve')) {
      if (!String(body.value || '').trim()) return response({ error: 'missing_value' }, 400);
      return response({ ok: true, ...(await resolveRemix(cookie, String(body.value).trim(), fetchImpl)) });
    }

    return response({ error: 'not_found' }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}

module.exports = {
  GRAPHQL_CLIENT_VERSION,
  canonicalPrintablesTags,
  handlePrintablesRequest,
  printablesWhoamiDirect,
};
