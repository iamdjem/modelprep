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

Backend's `.dev.vars` (NOT committed) holds the Cults credentials for curl tests / fallback auth — but for browser use, users enter their own Cults API key in the Cults Connect form.

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

- **MakerWorld** — direct Electron flow; core private 3D and Laser & Cut paths have live evidence.
- **Printables** — draft-first GraphQL/storage flow; private author and remix drafts have live evidence.
- **Cults3D** — signed-storage and two-page listing flow; secret/unlisted creation has live evidence.
- **Nexprint** — first-party REST/presigned upload; browser and Electron unpublished drafts are certified.
- **Creality Cloud** — first-party JSON/Aliyun upload; new uploads are private-first and the Original/private path is certified.
- **MakerOnline** — first-party multipart upload; the core unpublished image + STL draft/readback path is certified, with retained drafts documented in the live audit.
- **MyMiniFactory** — isolated passwordless first-party form integration with hierarchical categories, full metadata/license/file mapping, private/public controls, encrypted session handling, and object read-back. A duplicate-free private retry remains to certify the corrected category/readback path end to end.
- **MakerRoad** — isolated authenticated `X-Token` session, dynamic taxonomy, four upload roles, private-save/review-submit, and edit read-back; locally tested, but fresh navigation is currently blocked by an externally parked domain.
- **Thangs** — isolated encrypted bearer-token session, signed uploads, validation, single/bulk/multipart/assembly metadata, assets, and details/attachment/license read-back; connected and locally tested, with one private desktop upload/readback still pending.
- **Thingiverse** — complete draft-first/publish adapter and read-back tests; written clearance was recorded on 2026-08-01 and production mutation is enabled. Live draft certification remains pending.

No platform is fully certified across every optional/public/paid branch. Start
continuation work at
[`backend/docs/modelprep-current-handoff-2026-08-01.md`](./backend/docs/modelprep-current-handoff-2026-08-01.md).
The compact status/limit matrix is
[`backend/docs/platform-specs.md`](./backend/docs/platform-specs.md), and the
copy-paste prompt is
[`backend/docs/NEXT_AGENT_PROMPT.md`](./backend/docs/NEXT_AGENT_PROMPT.md).
