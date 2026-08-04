// Printables web-flow adapter.
//
// Printables does not expose a supported third-party "create model" API. The
// current upload form uses its first-party GraphQL endpoint plus direct,
// presigned object-storage uploads. Keep the operations in this file aligned
// with backend/docs/printables-web-flow.md and re-audit the live create page
// before changing their shapes.

const PRINTABLES_BASE = 'https://www.printables.com';
const PRINTABLES_GRAPHQL = 'https://api.printables.com/graphql/';
export const GRAPHQL_CLIENT_VERSION = 'v4.8.10';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

export interface PrintablesSession {
  cookie: string;
}

export interface PrintablesError {
  field?: string;
  messages?: string[];
}

export interface PrintablesFileInput {
  id: string;
  folder?: string;
  name: string;
  note?: string;
  weight?: number | null;
  material?: string | { id: string; name?: string } | null;
  printer?: string | { id: string; name?: string } | null;
  nozzleDiameter?: number | null;
  layerHeight?: number | null;
  printDuration?: number | null;
  excludeFromTotalSum?: boolean;
}

export interface PrintablesModelUpdateInput {
  id?: string;
  name?: string;
  summary?: string;
  description?: string;
  category?: string;
  license?: string;
  tags?: string[];
  draft?: boolean;
  mainImage?: string;
  authorship?: 'author' | 'remix' | 'reupload';
  remixParents?: string[];
  remixDescription?: string;
  nsfw?: boolean;
  aiGenerated?: boolean;
  politicalContent?: boolean;
  club?: boolean;
  price?: number;
  excludeCommercialUsage?: boolean;
  images?: Array<{ id: string }>;
  stls?: PrintablesFileInput[];
  slas?: PrintablesFileInput[];
  gcodes?: PrintablesFileInput[];
  otherFiles?: PrintablesFileInput[];
}

export interface PrintablesUploadRequest {
  fileName: string;
  folder?: string;
  unzip?: boolean;
  imageHash?: string;
  imageHeight?: number;
  imageWidth?: number;
}

function headers(session?: PrintablesSession): Record<string, string> {
  return {
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Content-Type': 'application/json',
    'Graphql-Client-Version': GRAPHQL_CLIENT_VERSION,
    Origin: PRINTABLES_BASE,
    Referer: `${PRINTABLES_BASE}/model/create`,
    'User-Agent': USER_AGENT,
    ...(session?.cookie ? { Cookie: session.cookie } : {}),
  };
}

interface GraphQlEnvelope<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

async function graphQl<T>(
  query: string,
  variables: Record<string, unknown> = {},
  session?: PrintablesSession,
): Promise<T> {
  const response = await fetch(PRINTABLES_GRAPHQL, {
    method: 'POST',
    headers: headers(session),
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  if (response.status === 429) {
    throw new Error('Printables rate limit reached. Wait a moment and try again.');
  }
  if (!response.ok) {
    throw new Error(`Printables GraphQL HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  let body: GraphQlEnvelope<T>;
  try { body = JSON.parse(text) as GraphQlEnvelope<T>; }
  catch {
    if (/user_is_not_authenticated|not authenticated/i.test(text)) {
      throw new Error('Printables session is no longer authorized. Reconnect Printables in the desktop app.');
    }
    throw new Error(`Printables GraphQL returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (body.errors?.length) {
    const message = body.errors.map((error) => error.message).join('; ');
    if (/auth|permission|login|credential/i.test(message)) {
      throw new Error(`Printables session is no longer authorized: ${message}`);
    }
    throw new Error(`Printables GraphQL: ${message}`);
  }
  if (!body.data) throw new Error('Printables GraphQL returned no data.');
  return body.data;
}

const ERROR_FRAGMENT = `
  fragment ModelPrepError on ErrorType {
    field
    messages
  }
`;

export async function printablesMeta() {
  const data = await graphQl<{
    categories: Array<{
      id: string;
      name: string;
      nameEn?: string;
      level?: number;
      path?: Array<{ id: string; name: string; nameEn?: string }>;
    }>;
    licenses: Array<{
      id: string;
      name: string;
      disallowRemixing?: boolean;
      freeModels?: boolean;
      storeModels?: boolean;
      isSelectable?: boolean;
    }>;
  }>(`query ModelPrepPrintablesMeta {
    categories {
      id
      name
      nameEn
      level
      path { id name nameEn }
    }
    licenses {
      id
      name
      disallowRemixing
      freeModels
      storeModels
      isSelectable
    }
  }`);
  return data;
}

/** A read-only auth probe. `currentUser` is null for anonymous requests. */
export async function printablesWhoami(session: PrintablesSession) {
  const data = await graphQl<{
    me?: {
      id: string;
      designerStatus?: string | null;
      storeActive?: boolean;
      storeFee?: number | null;
      maxStoreModels?: number | null;
      user?: {
        id: string;
        handle?: string;
        publicUsername?: string;
        avatarFilePath?: string;
        storeModelsCount?: number;
      } | null;
    } | null;
  }>(`query ModelPrepPrintablesMe {
    me {
      id
      designerStatus
      storeActive
      storeFee
      maxStoreModels: maxPaidModels
      user {
        id
        handle
        publicUsername
        avatarFilePath
        storeModelsCount: paidModelsCount
      }
    }
  }`, {}, session);
  if (!data.me) return null;
  const { user, ...capabilities } = data.me;
  return {
    ...capabilities,
    ...user,
    id: user?.id ?? data.me.id,
    tiers: [] as Array<{ id: string; name?: string }>,
  };
}

export async function printablesPresignUpload(session: PrintablesSession, input: PrintablesUploadRequest) {
  const data = await graphQl<{
    upload: {
      ok: boolean;
      errors: PrintablesError[];
      uploadData?: { url: string; fields: Record<string, string> };
      fileUpload?: { id: string };
    };
  }>(`mutation ModelPrepUploadModel(
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
    unzip: input.unzip ?? !input.fileName.toLowerCase().endsWith('.zip'),
    imageHash: input.imageHash ?? null,
    imageHeight: input.imageHeight ?? null,
    imageWidth: input.imageWidth ?? null,
  }, session);
  return data.upload;
}

export async function printablesFinishUpload(
  session: PrintablesSession,
  fileUploadId: string,
  crc32c?: string,
) {
  const data = await graphQl<{
    uploadFinished: {
      ok: boolean;
      errors: PrintablesError[];
      output?: { id: string; filePath?: string };
    };
  }>(`mutation ModelPrepUploadModelFinished($fileUploadId: ID!, $crc32c: String) {
    uploadFinished: printFileUploadFinished(fileUploadId: $fileUploadId, crc32c: $crc32c) {
      ok
      errors { ...ModelPrepError }
      output { id filePath }
    }
  }
  ${ERROR_FRAGMENT}`, { fileUploadId, crc32c: crc32c ?? null }, session);
  return data.uploadFinished;
}

export async function printablesPollUploads(session: PrintablesSession, ids: string[]) {
  return graphQl<{
    fileUploads: Array<{
      id: string;
      notInspectedFiles?: string[];
      isUploadFinished: boolean;
      isProcessed: boolean;
      gcodes: PrintablesFileInput[];
      stls: PrintablesFileInput[];
      slas: PrintablesFileInput[];
      otherFiles: PrintablesFileInput[];
      images: Array<{ id: string; filePath?: string; order?: number }>;
    }>;
  }>(`query ModelPrepPollFileUploads($ids: [ID!]!) {
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
  }`, { ids }, session);
}

function normalizeTagName(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function canonicalPrintablesTags(tags: string[] = []) {
  return Array.from(new Set(
    tags.map(normalizeTagName).filter(Boolean),
  ));
}

export async function printablesUpdateModel(session: PrintablesSession, input: PrintablesModelUpdateInput) {
  const variables = {
    ...input,
    tags: canonicalPrintablesTags(input.tags),
    // Processing readback includes a display-only printer object, but the
    // active GcodeFileInputType rejects that field on model updates.
    gcodes: input.gcodes?.map(({ printer: _printer, ...gcode }) => gcode),
  };
  const data = await graphQl<{
    modelUpdate: {
      ok: boolean;
      errors: PrintablesError[];
      output?: { id: string; slug?: string; name?: string; datePublished?: string | null };
    };
  }>(`mutation ModelPrepModelUpdate(
    $tags: [ID], $id: ID, $description: String, $category: ID, $license: ID,
    $mainImage: ID, $name: String, $draft: Boolean, $summary: String,
    $remixParents: [ID], $nsfw: Boolean, $aiGenerated: Boolean,
    $politicalContent: Boolean, $authorship: PrintAuthorshipEnum,
    $remixDescription: String, $club: Boolean, $price: Int,
    $excludeCommercialUsage: Boolean, $slas: [SLAFileInputType],
    $gcodes: [GcodeFileInputType], $stls: [STLFileInputType],
    $otherFiles: [OtherFileInputType], $images: [PrintImageInputType]
  ) {
    modelUpdate(
      tags: $tags, id: $id, description: $description, category: $category,
      license: $license, mainImage: $mainImage, name: $name, draft: $draft,
      summary: $summary, remixParents: $remixParents, nsfw: $nsfw,
      aiGenerated: $aiGenerated, politicalContent: $politicalContent,
      authorship: $authorship, remixDescription: $remixDescription,
      premium: $club, price: $price,
      excludeCommercialUsage: $excludeCommercialUsage,
      slas: $slas, gcodes: $gcodes, stls: $stls,
      otherFiles: $otherFiles, images: $images
    ) {
      ok
      errors { ...ModelPrepError }
      output { id slug name datePublished }
    }
  }
  ${ERROR_FRAGMENT}`, variables as Record<string, unknown>, session);
  return data.modelUpdate;
}

export async function printablesRequestPublish(session: PrintablesSession, printId: string) {
  const data = await graphQl<{
    printPublishRequest: {
      ok: boolean;
      errors: PrintablesError[];
      output?: { id: string; status: string; created: string };
    };
  }>(`mutation ModelPrepPrintPublishRequest($printId: ID!) {
    printPublishRequest(printId: $printId) {
      ok
      errors { ...ModelPrepError }
      output { id status created }
    }
  }
  ${ERROR_FRAGMENT}`, { printId }, session);
  return data.printPublishRequest;
}

export async function printablesModelStatus(session: PrintablesSession, id: string) {
  const data = await graphQl<{
    model?: {
      id: string;
      slug?: string;
      name?: string;
      summary?: string;
      description?: string;
      authorship?: string;
      nsfw?: boolean;
      aiGenerated?: boolean;
      politicalContent?: boolean;
      club?: boolean;
      price?: number;
      excludeCommercialUsage?: boolean;
      category?: { id: string; name?: string } | null;
      license?: { id: string; name?: string; disallowRemixing?: boolean | string } | null;
      tags?: Array<{ id: string; name: string }>;
      image?: { id: string; filePath?: string; order?: number } | null;
      images?: Array<{ id: string; filePath?: string; order?: number }>;
      stls?: PrintablesFileInput[];
      slas?: PrintablesFileInput[];
      gcodes?: PrintablesFileInput[];
      otherFiles?: PrintablesFileInput[];
      remixParents?: Array<{ id: string; parentPrintId?: string; url?: string }>;
      remixDescription?: string | null;
      datePublished?: string | null;
      draftReason?: string | null;
      publishApprovalRequired?: boolean;
      publishRequests?: Array<{ id: string; status: string; created: string }>;
    } | null;
  }>(`query ModelPrepModelStatus($id: ID!) {
    model: print(id: $id) {
      id slug name summary description authorship club: premium price excludeCommercialUsage
      nsfw aiGenerated politicalContent datePublished draftReason publishApprovalRequired
      category { id name }
      license { id name disallowRemixing }
      tags { id name }
      image { id filePath order }
      images { id filePath order }
      stls { id name folder note order }
      slas { id name folder note order layerHeight printDuration }
      gcodes {
        id name folder note order weight layerHeight nozzleDiameter printDuration excludeFromTotalSum
        material { id name }
        printer { id name }
      }
      otherFiles { id name folder note order }
      remixParents { id parentPrintId url }
      remixDescription
      publishRequests { id status created }
    }
  }`, { id }, session);
  return data.model ?? null;
}

export async function printablesListMyModels(session: PrintablesSession) {
  const me = await printablesWhoami(session);
  if (!me?.id) throw new Error('Printables did not return an authenticated user id.');
  return graphQl<{
    drafts: Array<{
      id: string;
      name?: string;
      slug?: string;
      datePublished?: string | null;
      draftReason?: string | null;
      image?: { filePath?: string } | null;
    }>;
    published: {
      items: Array<{
        id: string;
        name?: string;
        slug?: string;
        datePublished?: string | null;
        image?: { filePath?: string } | null;
      }>;
      cursor?: string | null;
    };
  }>(`query ModelPrepMyModels($userId: ID!) {
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
  }`, { userId: me.id }, session);
}

export async function printablesDeleteModel(session: PrintablesSession, id: string) {
  const data = await graphQl<{
    printDelete: { ok: boolean; errors: PrintablesError[] };
  }>(`mutation ModelPrepPrintDelete($id: ID!) {
    printDelete(id: $id) {
      ok
      errors { ...ModelPrepError }
    }
  }
  ${ERROR_FRAGMENT}`, { id }, session);
  return data.printDelete;
}

export async function printablesResolveRemix(session: PrintablesSession, value: string) {
  const trimmed = value.trim();
  const modelUrl = trimmed.match(/^https:\/\/(?:www\.)?printables\.com\/(?:model|education)\/(\d+)(?:[/?#-]|$)/i);
  const printId = /^\d+$/.test(trimmed) ? trimmed : modelUrl?.[1];
  if (printId) {
    return graphQl<{
      model?: {
        id: string;
        name?: string;
        slug?: string;
        license?: { id?: string; name?: string; disallowRemixing?: boolean | string };
      } | null;
    }>(
      `query ModelPrepRemixById($id: ID!) {
        model: print(id: $id) {
          id name slug
          license { id name disallowRemixing }
        }
      }`,
      { id: printId },
      session,
    );
  }
  return graphQl<{
    remixUrlInfo?: {
      url: string;
      author?: string;
      image?: string;
      title?: string;
      license?: { id?: string; name?: string; disallowRemixing?: boolean | string };
    } | null;
  }>(`query ModelPrepRemixByUrl($url: String!) {
    remixUrlInfo(url: $url) {
      url author image title
      license { id name disallowRemixing }
    }
  }`, { url: trimmed }, session);
}

export const PRINTABLES_LIMITS = {
  modelName: 255,
  summary: 120,
  fileName: 150,
  fileNote: 95,
  folderName: 60,
  fileBytes: 1024 * 1024 * 1024,
  zipBytes: 256 * 1024 * 1024,
  richTextImageBytes: 8 * 1024 * 1024,
  tagLength: 25,
} as const;

export function validatePrintablesUploadRequest(input: PrintablesUploadRequest, size?: number): string[] {
  const errors: string[] = [];
  const fileName = input.fileName.trim();
  if (!fileName) errors.push('File name is required.');
  if (fileName.length > PRINTABLES_LIMITS.fileName) errors.push('File name must be at most 150 characters.');
  if (typeof size === 'number') {
    const cap = fileName.toLowerCase().endsWith('.zip') && input.unzip === false
      ? PRINTABLES_LIMITS.zipBytes
      : PRINTABLES_LIMITS.fileBytes;
    if (!Number.isFinite(size) || size < 0) errors.push('File size is invalid.');
    else if (size > cap) errors.push(`File is larger than the ${Math.round(cap / 1024 / 1024)} MiB Printables limit.`);
  }
  return errors;
}
