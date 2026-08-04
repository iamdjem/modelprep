# ModelPrep

Multi-platform upload prep tool for 3D-printing creators. Drop model files and
photos, enter shared metadata once, review each platform's adapted package, and
publish through the desktop app.

**Live demo**: https://iamdjem.github.io/modelprep/

---

## Monorepo layout

Four runtime pieces, one repo:

```
modelprep/
├── ARCHITECTURE.md      ← READ FIRST. Single source of truth for the whole system.
├── deploy/              ← React + Vite frontend, deploys to iamdjem.github.io/modelprep/
├── backend/             ← Cloudflare Worker, deploys to modelprep-backend.iamdjem.workers.dev
├── desktop/             ← Electron app; isolated sign-ins and direct on-device uploads
└── cdn/                 ← Cloudflare Pages, serves staged files at cdn.makerstats.io
```

Each subdir has its own README with deploy + dev instructions for that piece.
Start with [`HANDOFF.md`](./HANDOFF.md) for the current pickup point and
[`ARCHITECTURE.md`](./ARCHITECTURE.md) for the system boundary.

---

## Quick local dev

Three terminals (or panes):

```bash
# Terminal 1 — frontend at http://localhost:5173
cd deploy && npm install && npm run dev

# Terminal 2 — backend Worker at http://localhost:8787
cd backend && npm install && npm run dev

# Terminal 3 — live logs from the deployed Worker (optional)
cd backend && npx wrangler tail --format pretty
```

Frontend's `.env.local` (NOT committed) controls which Worker it talks to:
```
# deploy/.env.local
VITE_WORKER_URL=http://localhost:8787      # local dev Worker
# or
VITE_WORKER_URL=https://modelprep-backend.iamdjem.workers.dev   # hit production Worker from local UI
```

Backend's `.dev.vars` (NOT committed) holds secrets only for local fallback
testing. The supported desktop product keeps platform credentials in Electron
main and encrypted platform-isolated sessions; never place them in renderer
configuration.

---

## Deploys

| Piece | Trigger | Where |
|---|---|---|
| Frontend | `git push origin main` (touching `deploy/**`) | GitHub Actions → GitHub Pages |
| Worker | `cd backend && npx wrangler deploy` | Cloudflare Workers |
| CDN | `cd cdn && npx wrangler pages deploy public --project-name=modelprep-cdn --branch=main` | Cloudflare Pages |

Backend + CDN deploys do NOT auto-trigger from git — you run them manually. (Adding a GH Actions workflow that uses `CF_API_TOKEN` is a future thing if it becomes annoying.)

---

## Status

Ten direct desktop publishing paths are implemented:

- **MakerWorld** — direct Electron flow; latest private safe-core receipt
  `9053658`, with earlier deep 3MF and Laser & Cut evidence. Video remains a
  separately deferred manual certification.
- **Printables** — draft-first GraphQL/storage flow with native HEIC conversion,
  G-code/SLA/retained-ZIP controls and readback. Specialist draft `1797772` and
  normal-public model `1797774` are exact-app live-certified; the public model
  remains live pending explicit deletion confirmation.
- **Cults3D** — signed-storage and two-page listing flow; latest exact-app secret
  slug ends `6f02ba1cd366b9cb06a5`. Typed video is implemented but not live-certified.
- **Nexprint** — first-party REST/presigned upload; latest exact-app unpublished
  draft `2083625532272496640` passed core readback.
- **Creality Cloud** — first-party JSON/Aliyun upload; latest exact-app
  Original/private model `6a6e3f28753b84f6aab190a8` passed readback.
- **MakerOnline** — first-party multipart upload; latest exact-app unpublished
  draft `316221` passed ordered file/media and metadata readback.
- **MyMiniFactory** — passwordless isolated session and hierarchical category,
  image/file, metadata and private/public mapping. Private object `829056` passed
  exact-app and independent hydrated-editor readback.
- **MakerRoad** — authenticated `X-Token`, dynamic taxonomy, four upload roles,
  private Save/review flow and `uploadType=1` readback. Private draft
  `M2134222528` is exact-app live-certified; native video remains unknown.
- **Thangs** — encrypted bearer-token session, signed uploads, validation,
  structures/assets and three-part readback. Private single-part model `1583272`
  is exact-app live-certified.
- **Thingiverse** — enabled draft-first/publish adapter with same-page token
  recovery. Unpublished draft `7390480` is exact-app live-certified; public and
  optional editor branches remain separate.

No platform is fully certified across every optional/public/paid branch. Start
continuation work at
[`backend/docs/modelprep-current-handoff-2026-08-01.md`](./backend/docs/modelprep-current-handoff-2026-08-01.md).
The compact status/limit matrix is
[`backend/docs/platform-specs.md`](./backend/docs/platform-specs.md), and the
repeatable one-platform method is
[`backend/docs/platform-one-by-one-implementation-playbook.md`](./backend/docs/platform-one-by-one-implementation-playbook.md).
The copy-paste prompt is
[`backend/docs/NEXT_AGENT_PROMPT.md`](./backend/docs/NEXT_AGENT_PROMPT.md).
