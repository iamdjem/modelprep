# ModelPrep backend

Cloudflare Worker fallback and shared adapter package for ModelPrep.

For the current product/continuation state, start with
[`docs/modelprep-current-handoff-2026-08-01.md`](docs/modelprep-current-handoff-2026-08-01.md).
For the system boundary, read [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Current role

The packaged Electron app performs all ten platform uploads directly from the
user's computer. Platform credentials and files do not pass through this Worker
for those desktop flows.

The Worker still provides:

- hosted-web fallback routes;
- shared MakerWorld/Printables/Cults adapter and validation code;
- health and metadata endpoints;
- legacy R2 staging/CDN support for older GraphQL/web paths;
- a production-shaped contract mirrored by Electron's local virtual routes.

Do not describe the Worker as the primary transport for the desktop app. Do not
add a platform credential to the renderer or Worker merely because an older
Cults route used that shape.

## Development

```bash
cd /Users/alex/modelprep/backend
npm install
npm test
npm run typecheck
npm run dev
```

Local Wrangler normally listens on `http://localhost:8787`. Secrets for local
fallback testing belong in `.dev.vars`, which is gitignored. Never commit or log
account credentials, cookies, bearer tokens, signed URLs, CSRF values, or
verification phrases.

Current automated baseline on 2026-08-02: 28 tests pass and `tsc --noEmit`
passes.

## Deployment

```bash
cd /Users/alex/modelprep/backend
npx wrangler deploy
```

Production endpoint: `https://modelprep-backend.iamdjem.workers.dev`.

Worker deployment is a separate external mutation. A source change, test pass,
commit, or desktop build does not imply deployment authority. There is no
automatic backend deployment on git push.

## Source map

- `src/index.ts`: route dispatch, CORS, orchestration and error normalization.
- `src/types.ts`: Worker environment and payload types.
- `src/r2.ts`: legacy/fallback R2 staging and serving.
- `src/adapters/`: shared MakerWorld, Printables, Cults3D and related adapters.
- `docs/*-web-flow.md`: dated first-party request maps and platform gotchas.
- `docs/platform-upload-requirements-live.md`: complete cross-platform field and
  limit evidence.
- `docs/platform-one-by-one-implementation-playbook.md`: required mapping,
  implementation, packaged-QA and live-certification sequence.

The definitive current route list is the route dispatch in `src/index.ts` and
its tests. Older README route inventories are intentionally not repeated here;
they became misleading as the desktop app moved transport on-device.

## Change rules

- Preserve the renderer/main-process credential boundary.
- Keep virtual route prefixes platform-specific and allow-listed.
- Keep unknown limits unknown; do not restore guessed crops, counts, or sizes.
- Validate failures as failures, not empty success.
- Update the relevant platform flow map and current handoff when a production
  contract changes.
- Run `npm test`, `npm run typecheck`, and `git diff --check` before handoff.
