# Per-platform listing specs (text + image limits)

Consolidates what we know about each marketplace's listing limits. Confidence:
**HIGH** = read from the platform's own form/API; **MED** = help doc / empirical; **UNKNOWN** =
not verified (we deliberately do NOT enforce a guessed number). Mirrored in
`deploy/src/App.jsx` → `PLATFORMS[].limits` / `.covers`; enforced on the Details + Images steps.

## Text limits (title / tags / description)

| Platform | Title max | Tags (count) | Per-tag chars | Tag format | Desc max | Confidence |
|---|---|---|---|---|---|---|
| **MakerWorld** | 50 | 50 | 100 | free text | none (HTML `summary`) | HIGH (live form) |
| **Printables** | 255 | UNKNOWN | 25 | lowercase a–z0–9, **no spaces/punctuation** | no client cap | HIGH title/tag-format; tagMax UNKNOWN |
| **Nexprint** | 80 | 10 | 50 | free text, trimmed, dedup | 10000 | HIGH (prod bundle) |
| **Cults3D** | UNKNOWN | ~10–20 *(recommended only)* | UNKNOWN | space/comma list, lowercased | UNKNOWN | API fields are bare strings |
| **MyMiniFactory** | UNKNOWN | UNKNOWN | UNKNOWN | comma-separated | UNKNOWN | OpenAPI = bare strings |
| **Thingiverse** | UNKNOWN | UNKNOWN | UNKNOWN | whitespace→`_`, strip non-alnum/`_`/`-` | UNKNOWN | tag rule HIGH; rest UNKNOWN |
| **Thangs** | UNKNOWN | UNKNOWN | UNKNOWN | colon `:` separated, spaces allowed | UNKNOWN | sep MED; rest UNKNOWN |
| **Creality Cloud** | UNKNOWN | UNKNOWN | UNKNOWN | comma entry, no `#` | UNKNOWN | LOW |

Notes:
- Printables also has a separate **summary** field = 120 chars (HIGH).
- MakerWorld text limits are **UI-only** (the PUT accepts over-limit values). See `makerworld-web-flow.md`.
- The five UNKNOWN platforms expose no documented caps — verify from each authenticated upload
  form's `maxlength` (same approach as the MakerWorld capture) before enforcing numbers.

## Image / cover specs

| Platform | Cover aspect(s) | Gallery max | Per-file size | Formats | Confidence |
|---|---|---|---|---|---|
| **MakerWorld** | web 4:3 (1920×1440) + app 3:4 (1500×2000) | 16 | ≤30 MB (20 MB CN) | jpg/png/webp/gif | HIGH |
| **Printables** | 4:3 (1920×1440) | 25 | UNKNOWN | jpg/png/webp/gif | aspect assumed |
| **Cults3D** | 1:1 (1500×1500) | 20 | ≤10 MB / 8000×8000 px | jpg/png/webp + webm/mp4 video | MED (May 2026 form) |
| **MyMiniFactory** | 4:3 (1920×1440) | 20 | UNKNOWN | assumed | assumed |
| **Thingiverse** | 4:3 (1600×1200) | 20 | UNKNOWN | assumed | assumed |
| **Thangs** | 4:3 (1920×1440) | 15 | UNKNOWN | assumed | assumed |
| **Nexprint** | 4:3 (1920×1440) | 12 | UNKNOWN | assumed | assumed |
| **Creality Cloud** | 4:3 (1600×1200) | 15 | UNKNOWN | assumed | assumed |

⚠️ Only **MakerWorld** image specs are verified. The rest are reasonable defaults in
`PLATFORMS[].covers` / `.maxImages` — the crop engine (`cropImageToBlob`) applies them, but the
exact aspect/size/format per platform still needs a capture pass to confirm.

## MakerWorld documentation uploads (verified 2026-06-22)

- **Assembly Guide** → `designGuide[]`: pdf/png/jpg/webp/gif; images ≤30 MB, pdf ≤50 MB; **max 25**.
- **Other Files** → `designOther[]`: txt/pdf/zip; txt ≤2 MB, pdf ≤50 MB, zip ≤100 MB; **max 10**.
- Enforced client-side in `MakerWorldOptions.validateDocs`.

## Status of real-publish integrations

| Platform | Publish | Notes |
|---|---|---|
| MakerWorld | ✅ real (web-flow replay) | fully specced; STL + Bambu-3mf paths |
| Cults3D | ✅ real (web-flow replay) | image crop to 1:1 still TODO |
| MMF / Thingiverse | ⏳ have APIs, not wired | OAuth REST |
| Printables / Thangs / Nexprint / Creality | 📦 manual `.zip` fallback | no API / addon-only |
