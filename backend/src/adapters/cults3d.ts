// Cults3D GraphQL client.
//
// Single endpoint, single method: POST https://cults3d.com/graphql
// Auth: HTTP Basic with username:api_key
// Wire format per the official docs is application/x-www-form-urlencoded
// with a single `query` (and optionally `variables`) field.

import type { PublishPayload } from '../types';

const CULTS_GRAPHQL_URL = 'https://cults3d.com/graphql';

export interface CultsCreds {
  username: string;
  apiKey: string;
}

/** Build a Basic Auth header. base64 of `username:apiKey`. */
function authHeader({ username, apiKey }: CultsCreds): string {
  // btoa exists in Worker runtime.
  return 'Basic ' + btoa(`${username}:${apiKey}`);
}

/** Low-level helper. Posts a GraphQL query (and optional variables) and returns parsed JSON.
 *  Throws on HTTP error; GraphQL `errors` are returned in the body and surfaced to the caller. */
export async function postGraphQL<T>(
  creds: CultsCreds,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data?: T; errors?: Array<{ message: string; [k: string]: unknown }> }> {
  const body = new URLSearchParams();
  body.set('query', query);
  if (variables) body.set('variables', JSON.stringify(variables));

  const res = await fetch(CULTS_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(creds),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      // Be a good citizen and identify our requests.
      'User-Agent': 'ModelPrep-dev/0.1 (+https://github.com/iamdjem/modelprep-prototype)',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cults GraphQL HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// READ queries — safe, no side effects. We start here to prove auth + wiring.
// ---------------------------------------------------------------------------

/** Verify auth works and return the authenticated user's public profile. */
export async function cultsMe(creds: CultsCreds) {
  const q = `{
    myself {
      user {
        nick
        shortUrl
        bio
        imageUrl
        creationsCount
      }
    }
  }`;
  return postGraphQL<{ myself: { user: { nick: string; shortUrl: string; bio: string | null; imageUrl: string | null; creationsCount: number } } }>(creds, q);
}

/** Full category tree. Used to map our generic CATEGORIES list onto Cults's
 *  Relay-style base64 category IDs. Cache this client-side. */
export async function cultsCategories(creds: CultsCreds) {
  const q = `{
    categories {
      id
      name(locale: EN)
      children {
        id
        name(locale: EN)
      }
    }
  }`;
  return postGraphQL<{ categories: Array<{ id: string; name: string; children: Array<{ id: string; name: string }> }> }>(creds, q);
}

/** Available licenses + which apply to free vs priced designs. */
export async function cultsLicenses(creds: CultsCreds) {
  const q = `{
    licenses {
      code
      name(locale: EN)
      url(locale: EN)
      availableOnFreeDesigns
      availableOnPricedDesigns
    }
  }`;
  return postGraphQL<{ licenses: Array<{ code: string; name: string; url: string; availableOnFreeDesigns: boolean; availableOnPricedDesigns: boolean }> }>(creds, q);
}

/** List the authenticated user's own creations. Useful for showing a catalog
 *  in the React app and for verifying writes by reading back after publish. */
export async function cultsMyCreations(creds: CultsCreds, limit = 10, offset = 0) {
  const q = `query ($limit: Int!, $offset: Int!) {
    myself {
      creationsBatch(limit: $limit, offset: $offset) {
        total
        results {
          name(locale: EN)
          url(locale: EN)
          illustrationImageUrl
          downloadsCount
          viewsCount
        }
      }
    }
  }`;
  return postGraphQL<{ myself: { creationsBatch: { total: number; results: Array<{ name: string; url: string; illustrationImageUrl: string | null; downloadsCount: number; viewsCount: number }> } } }>(creds, q, { limit, offset });
}

/** Probe whether a single extra argument is accepted by `createCreation`.
 *  Sends a mutation that declares the candidate field as a typed variable,
 *  uses it in the call, and supplies an unreachable file URL so the mutation
 *  CANNOT publish even if validation passes.
 *
 *  Returns one of:
 *    'accepted'     — field exists, schema validated (download then failed)
 *    'wrong-type'   — field exists but our type guess was wrong; error hints
 *    'absent'       — field does not exist on createCreation
 *    'unknown'      — something else happened; raw error attached
 */
export async function cultsProbeField(
  creds: CultsCreds,
  fieldName: string,
  fieldType: string,
  value: unknown,
) {
  const q = `mutation Probe(
    $name: String!,
    $description: String!,
    $imageUrls: [String!]!,
    $fileUrls: [String!]!,
    $locale: LocaleEnum!,
    $categoryId: ID!,
    $${fieldName}: ${fieldType}
  ) {
    createCreation(
      name: $name,
      description: $description,
      imageUrls: $imageUrls,
      fileUrls: $fileUrls,
      locale: $locale,
      categoryId: $categoryId,
      ${fieldName}: $${fieldName}
    ) {
      creation { url(locale: EN) }
      errors
    }
  }`;
  const variables: Record<string, unknown> = {
    name: 'modelprep-probe',
    description: 'probe',
    imageUrls: ['https://probe.invalid.modelprep.test/x.jpg'],
    fileUrls: ['https://probe.invalid.modelprep.test/x.stl'],
    locale: 'EN',
    categoryId: 'Q2F0ZWdvcnkvMjM',
    [fieldName]: value,
  };
  const res = await postGraphQL<{ createCreation?: CreateCreationResult }>(creds, q, variables);

  // Classify.
  const schemaErrs = res.errors ?? [];
  const schemaErrStr = JSON.stringify(schemaErrs).toLowerCase();
  const dataErrs = res.data?.createCreation?.errors ?? [];
  const created = !!res.data?.createCreation?.creation;

  let verdict: 'accepted' | 'wrong-type' | 'absent' | 'PUBLISHED' | 'unknown' = 'unknown';
  if (created) {
    // The mutation ACTUALLY PUBLISHED despite our invalid URL guard — shouldn't happen
    // but worth surfacing loudly so we can delete the listing.
    verdict = 'PUBLISHED';
  } else if (dataErrs.length > 0) {
    // Schema validated; execution ran and returned an in-band error — field exists.
    verdict = 'accepted';
  } else if (schemaErrStr.includes("doesn't accept argument") || schemaErrStr.includes('no field')) {
    verdict = 'absent';
  } else if (schemaErrStr.includes("isn't a defined input type") || schemaErrStr.includes('type mismatch') || schemaErrStr.includes('invalid value')) {
    verdict = 'wrong-type';
  }
  return { field: fieldName, attemptedType: fieldType, verdict, raw: res };
}

/** Introspection of the createCreation mutation. We call this BEFORE wiring
 *  the upload flow so we can confirm:
 *    1. The exact argument list (in case the docs example is incomplete).
 *    2. Whether there's an undocumented `draft` / `published` / `visibility`
 *       flag that lets us test safely without publishing live to the user's
 *       real profile. */
export async function cultsIntrospectCreate(creds: CultsCreds) {
  const q = `{
    __type(name: "Mutation") {
      fields {
        name
        args {
          name
          type {
            name
            kind
            ofType { name kind }
          }
          defaultValue
        }
      }
    }
  }`;
  return postGraphQL<{
    __type: {
      fields: Array<{
        name: string;
        args: Array<{
          name: string;
          type: { name: string | null; kind: string; ofType: { name: string | null; kind: string } | null };
          defaultValue: string | null;
        }>;
      }>;
    };
  }>(creds, q);
}

// ---------------------------------------------------------------------------
// WRITE mutation — createCreation.
// IMPORTANT: this publishes a live listing to the authenticated user's Cults
// profile. Do NOT call this until you've reviewed the payload and decided
// you're OK with it appearing on your profile (and you can manually delete
// it afterwards from cults3d.com). No exposed Worker route fires this yet.
// ---------------------------------------------------------------------------

export interface CreateCreationResult {
  creation: { url: string } | null;
  errors: string[];
}

export async function cultsCreateCreation(creds: CultsCreds, payload: PublishPayload) {
  // metaTags is `[String!]` per the probe-fields run (CreationUsageEnum etc.
  // were all rejected, but [String!] was accepted). Cults internally validates
  // each tag against a dictionary — unknown tags trigger a `metaTags` error in
  // the response, which we surface in `errors` so the caller can show it.
  const q = `mutation CreateCreation(
    $name: String!,
    $description: String!,
    $imageUrls: [String!]!,
    $fileUrls: [String!]!,
    $locale: LocaleEnum!,
    $categoryId: ID!,
    $subCategoryIds: [ID!],
    $downloadPrice: Float,
    $currency: CurrencyEnum,
    $licenseCode: String,
    $metaTags: [String!]
  ) {
    createCreation(
      name: $name,
      description: $description,
      imageUrls: $imageUrls,
      fileUrls: $fileUrls,
      locale: $locale,
      categoryId: $categoryId,
      subCategoryIds: $subCategoryIds,
      downloadPrice: $downloadPrice,
      currency: $currency,
      licenseCode: $licenseCode,
      metaTags: $metaTags
    ) {
      creation {
        url(locale: EN)
      }
      errors
    }
  }`;
  // Omit optional fields entirely when not provided — some GraphQL servers
  // reject explicit `null` on optional args.
  const variables: Record<string, unknown> = {
    name: payload.title,
    description: payload.description,
    imageUrls: [payload.coverImageUrl, ...(payload.galleryImageUrls ?? [])],
    fileUrls: payload.modelFileUrls,
    locale: payload.locale ?? 'EN',
    categoryId: payload.categoryId,
  };
  if (payload.subCategoryIds?.length) variables.subCategoryIds = payload.subCategoryIds;
  if (payload.downloadPrice !== undefined) variables.downloadPrice = payload.downloadPrice;
  if (payload.currency) variables.currency = payload.currency;
  if (payload.licenseCode) variables.licenseCode = payload.licenseCode;
  if (payload.metaTags?.length) variables.metaTags = payload.metaTags;
  return postGraphQL<{ createCreation: CreateCreationResult }>(creds, q, variables);
}
