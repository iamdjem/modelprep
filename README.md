# ModelPrep

Multi-platform upload prep tool for 3D-printing creators. Drop your STL/3MF files + photos, fill in title/description/category/license/price, click **Publish** — and the listing appears on Cults3D (more platforms coming).

**Live demo**: https://iamdjem.github.io/modelprep/

---

## Monorepo layout

Three deployed pieces, one repo:

```
modelprep/
├── ARCHITECTURE.md      ← READ FIRST. Single source of truth for the whole system.
├── deploy/              ← React + Vite frontend, deploys to iamdjem.github.io/modelprep/
├── backend/             ← Cloudflare Worker, deploys to modelprep-backend.iamdjem.workers.dev
└── cdn/                 ← Cloudflare Pages, serves staged files at cdn.makerstats.io
```

Each subdir has its own README with deploy + dev instructions for that piece. Start with [`ARCHITECTURE.md`](./ARCHITECTURE.md) to see how they fit together.

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

✅ **Cults3D**: end-to-end one-click publish working (cover + gallery + STL/3MF + category + license + price). Real test listing: https://cults3d.com/en/3d-model/game/modelprep-final-end-to-end.

🟡 **Tags**: Cults's tag vocabulary is undocumented; user tags show locally only.
🟡 **Cleanup**: no `deleteCreation` mutation on Cults; deletions are web-UI only.
⏳ **MakerWorld, Thingiverse, Printables, MMF, Thangs**: deferred — each platform plugs in behind the same prep UI.

See `ARCHITECTURE.md` for the full "non-obvious things that broke during build-out" list — useful when adding new platforms.
