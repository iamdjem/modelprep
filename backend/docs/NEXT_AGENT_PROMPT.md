# Copy-paste prompt for the next ModelPrep agent

```text
Continue ModelPrep from the canonical handoff at:
/Users/alex/modelprep/backend/docs/modelprep-current-handoff-2026-08-01.md

Repository:
/Users/alex/modelprep

Before doing anything:
1. Run `git status --short` and preserve the deliberately dirty worktree. Do not reset, clean, restore, broadly stage, commit, push, deploy, delete, upload, or publish unless I explicitly authorize that action.
2. Read the canonical handoff completely, then read:
   - backend/docs/platform-live-certification-audit-2026-08-01.md
   - backend/docs/platform-upload-requirements-live.md
   - backend/docs/platform-specs.md
   - backend/docs/desktop-live-upload-testing.md
   - the relevant backend/docs/<platform>-web-flow.md
3. Establish current truth from source, tests, the exact packaged runtime, and current platform evidence. Do not rely on stale July continuation text.

What we are building:
ModelPrep is an Electron desktop app that imports 3D model files/media/profiles once, propagates shared metadata, adapts it to ten platforms, and performs direct private/draft-first uploads through isolated encrypted platform sessions. The ten implemented direct targets are MakerWorld, Printables, Cults3D, MyMiniFactory, Nexprint, Creality Cloud, MakerOnline, MakerRoad, Thangs, and Thingiverse.

Current state:
- All ten accounts passed authenticated identity checks in the latest signed packaged build.
- All ten safe core private/draft/secret upload paths are implemented and live-certified from the exact packaged app. The latest four-at-a-time batch finished 10 succeeded and 0 failed with readback receipts for every platform.
- Latest retained results: MakerWorld `9053658`, Printables `1797292`, Cults3D slug ending `6f02ba1cd366b9cb06a5`, MyMiniFactory `829056`, Thingiverse `7390480`, Thangs `1583272`, Nexprint `2083625532272496640`, Creality `6a6e3f28753b84f6aab190a8`, MakerOnline `316221`, and MakerRoad `M2134222528`.
- MyMiniFactory object `829056` also passed independent signed-in editor verification for private state, categories `[60,462]`, ten ordered images, three files, title, tags and full description. Sanitized submit diagnostics are now present for any future HTTP failure.
- Batch concurrency is four. Each platform keeps its internal request order. If a completed batch has failures, `Retry N failed only` preserves successful receipts and reruns only failed destinations.
- No platform is fully certified: public, paid, remix, membership/plan, specialist file/media, large-file, video and other account-gated branches remain individual certification work. MakerRoad's native video contract is still unknown.
- Current automated baseline: renderer 37 files/160 tests, desktop 88 tests, backend 25 tests, backend typecheck pass, production renderer build pass, strict codesign pass.
- Known minor issue: one non-blocking React missing-key warning in NexprintOptions.

Safest next implementation/certification order:
1. Re-verify the exact packaged app at `/Users/alex/modelprep/desktop/dist/mac-arm64/ModelPrep.app`; do not use stale `/Applications/ModelPrep.app` copies and never use launchctl keepalive jobs.
2. Read the `Per-platform remaining work` table in the canonical handoff. Do not rewrite a safe core that is already certified.
3. Choose one optional branch with explicit action-time authorization and certify it independently. Public, paid and agreement/terms actions require their own authorization.
4. Prefer private or draft equivalents when a branch can be exercised safely; verify persisted edit/readback state and retain the receipt.
5. Fix the minor Nexprint React key warning and add resource telemetry before considering concurrency above four.
6. Re-audit current DOM/bundles/request contracts before public release or whenever a platform breaks.

For every change or certification:
- Separate mapped, implemented, locally verified, connected, browser-proven, live-certified, and fully certified evidence.
- Keep credentials/tokens/cookies in Electron main only and never print them.
- Preserve private/draft/secret defaults and require explicit public actions.
- Verify persisted edit/readback state, not only a successful submit response.
- Record artifact ids/URLs and whether they are retained; never delete without explicit permission.
- Use current DOM/bundles/network requests or official documentation for limits; keep unknown values unknown and do not restore guessed crops/counts.
- Run focused tests, then proportional full tests/build, `git diff --check`, and packaged runtime QA.
- Leave the worktree unstaged and uncommitted unless I explicitly request source-control actions.

At the end, report:
- what changed;
- exact files;
- tests/build/runtime evidence;
- any live artifacts created and their visibility;
- remaining blockers and the next smallest safe step.
```
