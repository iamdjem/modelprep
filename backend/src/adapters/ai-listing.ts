// AI listing generation — looks at the user's print photos (and an optional one-line
// hint) and writes a Title, Description (Markdown), Tags, and a Category pick. The model
// is told the exact constraints the app already tracks (per-platform char/tag limits and
// the fixed category list), so the output drops straight into the wizard without trimming.
//
// Vision is the whole point: a real photo of a printed model tells the model far more than
// a filename. We send the images inline as base64 image blocks to the Anthropic Messages API.

export interface ListingImage {
  base64: string;      // raw base64 (no data: prefix)
  mediaType: string;   // 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
}

export interface GenerateListingInput {
  images: ListingImage[];
  hint?: string;                 // optional one-line nudge ("articulating desk dragon, PLA")
  categories: string[];          // the app's fixed category list — model must pick one verbatim
  limits?: {                     // strictest targeted-platform limits (optional)
    titleMax?: number;
    tagMax?: number;
    tagCharMax?: number;
    descMax?: number;
  };
}

export interface GeneratedListing {
  title: string;
  description: string;           // Markdown
  tags: string[];
  category: string;              // one of `categories`, or '' if unsure
  realPhotoDetected: boolean;    // false ⇒ looks like a render, not a real print photo
  notes?: string;                // anything the model wants to flag to the user
}

// OpenAI-compatible providers — one request shape covers all of them. Users bring their
// own key; we never store it. Base URLs are resolved here so the frontend only sends a
// provider id (or a custom baseUrl). Free/cheap options: OpenRouter (free `:free` models +
// cheap DeepSeek/Qwen/GLM), Gemini (free tier), Groq (free tier). Local Ollama is NOT here —
// the Worker can't reach a user's localhost, so the frontend calls it directly.
export const OPENAI_COMPAT_BASE: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  groq: 'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1', // text strong; vision support varies by model
};

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
// Sonnet 4.6 — strong vision + writing at a sane cost. Override per call if needed.
const MODEL = 'claude-sonnet-4-6';
const MAX_IMAGES = 8; // cap payload size + cost; the first few photos carry the signal.

function buildSystemPrompt(input: GenerateListingInput): string {
  const lim = input.limits ?? {};
  const rules: string[] = [];
  if (lim.titleMax) rules.push(`- Title: at most ${lim.titleMax} characters.`);
  if (lim.descMax) rules.push(`- Description: at most ${lim.descMax} characters.`);
  if (lim.tagMax) rules.push(`- Tags: at most ${lim.tagMax} tags.`);
  if (lim.tagCharMax) rules.push(`- Each tag: at most ${lim.tagCharMax} characters.`);

  return [
    'You write listings for 3D-printable models on marketplaces like MakerWorld, Printables and Cults3D.',
    'You are given real photographs of a printed model (and possibly a one-line hint from the maker).',
    'Look carefully at the photos and write an accurate, appealing listing. Do not invent features you cannot see or that the hint does not support.',
    '',
    'Return STRICT JSON only (no prose, no code fences) with exactly these keys:',
    '{"title": string, "description": string (Markdown), "tags": string[], "category": string, "realPhotoDetected": boolean, "notes": string}',
    '',
    'Guidance:',
    '- Title: specific and searchable, not clickbait. No quotes around it.',
    '- Description: Markdown. A short hook, then a few helpful lines (what it is, why it is good, any visible print details). Honest and concise.',
    '- Tags: lowercase, relevant search terms. No "#", no duplicates.',
    `- Category: choose EXACTLY ONE from this list, copied verbatim, or "" if none fit: ${JSON.stringify(input.categories)}.`,
    '- realPhotoDetected: true only if at least one image is a real photograph of a physical print (not a CAD render or screenshot).',
    '- notes: one short sentence to the maker if something is ambiguous or missing (else "").',
    ...(rules.length ? ['', 'Hard limits (obey exactly):', ...rules] : []),
  ].join('\n');
}

/** Parse the model's text into a GeneratedListing, tolerating stray prose / code fences. */
function parseListing(text: string, categories: string[], limits?: GenerateListingInput['limits']): GeneratedListing {
  let raw = text.trim();
  // Strip ```json fences if present.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  // Otherwise grab the first {...} block.
  if (raw[0] !== '{') { const i = raw.indexOf('{'); const j = raw.lastIndexOf('}'); if (i >= 0 && j > i) raw = raw.slice(i, j + 1); }

  const obj = JSON.parse(raw) as Record<string, unknown>;
  const lim = limits ?? {};
  let title = String(obj.title ?? '').trim();
  if (lim.titleMax && title.length > lim.titleMax) title = title.slice(0, lim.titleMax).trim();
  let description = String(obj.description ?? '').trim();
  if (lim.descMax && description.length > lim.descMax) description = description.slice(0, lim.descMax).trim();

  let tags = Array.isArray(obj.tags)
    ? [...new Set(obj.tags.map((t) => String(t).trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')).filter(Boolean))]
    : [];
  if (lim.tagCharMax) tags = tags.filter((t) => t.length <= lim.tagCharMax!);
  if (lim.tagMax) tags = tags.slice(0, lim.tagMax);

  let category = String(obj.category ?? '').trim();
  if (category && !categories.includes(category)) {
    // Be forgiving about case / minor variants; else drop it.
    const hit = categories.find((c) => c.toLowerCase() === category.toLowerCase());
    category = hit ?? '';
  }

  return {
    title,
    description,
    tags,
    category,
    realPhotoDetected: obj.realPhotoDetected === true,
    notes: String(obj.notes ?? '').trim() || undefined,
  };
}

/** Call Claude with the photos + constraints. Throws on transport/auth/parse errors so the
 *  route can map them (e.g. 503 → frontend falls back to the on-device heuristic). */
export async function generateListing(apiKey: string, input: GenerateListingInput): Promise<GeneratedListing> {
  const images = input.images.slice(0, MAX_IMAGES);
  if (!images.length) throw new Error('no images supplied');

  const content: unknown[] = images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
  }));
  content.push({
    type: 'text',
    text: input.hint?.trim()
      ? `Maker's one-line hint: "${input.hint.trim()}". Write the listing for the model in these photos.`
      : 'Write the listing for the model in these photos.',
  });

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: buildSystemPrompt(input),
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`anthropic ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim();
  if (!text) throw new Error('empty model response');
  return parseListing(text, input.categories, input.limits);
}

/** Call any OpenAI-compatible chat endpoint (OpenRouter, Gemini, Groq, DeepSeek, custom)
 *  with the user's own key + chosen model. Vision uses the standard `image_url` content
 *  block with an inline data URL. Throws so the route can surface a clear error. */
export async function generateListingOpenAICompat(opts: {
  baseUrl: string; apiKey: string; model: string; input: GenerateListingInput;
}): Promise<GeneratedListing> {
  const { baseUrl, apiKey, model, input } = opts;
  const images = input.images.slice(0, MAX_IMAGES);
  if (!images.length) throw new Error('no images supplied');

  const userContent: unknown[] = images.map((img) => ({
    type: 'image_url',
    image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
  }));
  userContent.push({
    type: 'text',
    text: input.hint?.trim()
      ? `Maker's one-line hint: "${input.hint.trim()}". Write the listing for the model in these photos.`
      : 'Write the listing for the model in these photos.',
  });

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: buildSystemPrompt(input) },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`provider ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = (data.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('empty model response');
  return parseListing(text, input.categories, input.limits);
}
