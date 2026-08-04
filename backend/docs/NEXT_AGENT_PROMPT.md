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
   - backend/docs/platform-one-by-one-implementation-playbook.md
   - the relevant backend/docs/<platform>-web-flow.md
3. Establish current truth from source, tests, the exact packaged runtime, and current platform evidence. Do not rely on stale July continuation text.

What we are building:
ModelPrep is an Electron desktop app that imports 3D model files/media/profiles once, propagates shared metadata, adapts it to ten platforms, and performs direct private/draft-first uploads through isolated encrypted platform sessions. The ten implemented direct targets are MakerWorld, Printables, Cults3D, MyMiniFactory, Nexprint, Creality Cloud, MakerOnline, MakerRoad, Thangs, and Thingiverse.

Core operating rule for platform work:
- Work on exactly one platform at a time. Do not treat one known gap or one optional branch as a complete platform investigation.
- Before implementing another isolated fix, comprehensively map the selected platform's entire current signed-in upload experience and first-party request contract. Stay on that platform until every safely investigable screen, field, conditional state, validation rule, request and readback surface has been examined and documented.
- Do not move to another platform merely because one branch was implemented. Move on only after every remaining item for the selected platform is explicitly classified as one of: implemented and verified; mapped but live-action-gated; account/plan-gated; manually deferred by the user; unavailable in the current first-party UI/contract; or genuinely unknown after documented investigation.
- Existing safe-core certification proves only the retained private/draft/secret path. It does not prove that the platform has been comprehensively mapped or fully certified.

Current state:
- All ten accounts passed authenticated identity checks in the latest signed packaged build.
- All ten safe core private/draft/secret upload paths are implemented and live-certified from the exact packaged app. The latest four-at-a-time batch finished 10 succeeded and 0 failed with readback receipts for every platform.
- Latest safe-core batch results: MakerWorld `9053658`, Printables `1797292`, Cults3D slug ending `6f02ba1cd366b9cb06a5`, MyMiniFactory `829056`, Thingiverse `7390480`, Thangs `1583272`, Nexprint `2083625532272496640`, Creality `6a6e3f28753b84f6aab190a8`, MakerOnline `316221`, and MakerRoad `M2134222528`.
- Printables is additionally live-certified for specialist draft `1797772`: eleven ordered images including a native-selected HEIC converted to JPEG, G-code, SLA/SL1, retained ZIP and full persisted metadata. Public model `1797774` passed verified-draft, publish and live-state readback and remains public at `https://www.printables.com/model/1797774-articulating-desk-dragon-print-in-place`; do not delete it without exact action-time confirmation. Diagnostic drafts `1797764` and `1797758` may also remain.
- MyMiniFactory object `829056` also passed independent signed-in editor verification for private state, categories `[60,462]`, ten ordered images, three files, title, tags and full description. Retained private specialist `829284` was created by the exact package and independently browser-proved for 10 images, 3 files, advanced print fields, CC BY-NC-SA and remix parent `829056`. On 2026-08-03 the corrected exact package re-read `829284` read-only and the receipt succeeded (`private · 10 images · 3 files · categories 60/462 · remix of 829056`), so that branch is now exact-app live-certified. MyMiniFactory is comprehensively mapped as of 2026-08-03; its remaining branches are public review, account-gated ZIP/premium modes (`can_use_zip_mode` and `isPremiumCreator` are false on this account), file/extension extremes and deletion. Use the GET-only `Verify existing object` control—never `Retry N failed only`—to re-read a MyMiniFactory object. Sanitized submit diagnostics are present for HTTP failure.
- Batch concurrency is four. Each platform keeps its internal request order. If a completed batch has failures, `Retry N failed only` preserves successful receipts and reruns only failed destinations.
- No platform is fully certified: public, paid, remix, membership/plan, specialist file/media, large-file, video and other account-gated branches remain individual certification work. MakerRoad's current native form has no video input, upload role, or serializer, so video is explicitly unsupported until a future contract appears.
- Current automated baseline (2026-08-04, afternoon): renderer 38 files/225 tests, desktop 144 tests, backend 31 tests, backend typecheck pass, production renderer build pass, and strict codesign verification of the QA bundle now signed with Developer ID Application: Aleksei Adzhem (UTZ4TVACJS). Notarization is still skipped (`APPLE_TEAM_ID` unset).
- The Nexprint React missing-key warning is fixed. Privacy-safe aggregate resource telemetry is implemented and displayed in the exact packaged app. Completed batches retain the latest 10 doubly sanitized aggregate reports locally and expose a JSON download. The idle fixture baseline is runtime-proven, but no live four-publisher telemetry sample or completed packaged report has been authorized or captured yet.
- MakerWorld's one-video MP4/MOV branch now fails closed unless returned `designVideo` metadata matches the submitted filename and storage path. It is implemented and locally verified, but no video upload has been authorized or live-certified.
- A temporary 3.0-second 1280x720 MP4 fixture was generated from the demo image and passed rendered input/duration/preflight QA with no console errors. The exact packaged app's native chooser still requires manual file selection; the user deferred the account-backed run for later manual verification.
- Cults3D's current signed-in edit form exposes ordered persisted blueprint/illustration IDs and filenames. Both desktop and Worker paths now fail closed on title, visibility, ID/order, or filename readback mismatches while retaining the artifact receipt. Their preflight accepts JPEG/PNG/WebP/GIF/MP4/WebM, requires an image first, and rejects every media item above 10 MiB. Tests cover GIF acceptance, invalid/oversized/video-first media and MP4 persistence failure, but no new Cults listing was created and video remains not live-certified.
- The 2026-08-02 exhaustive read-only Cults audit also mapped the current create/price/edit/My Creations surfaces and uploader bundle. Manufacturing settings, the 12 currently visible fixed meta tags, AI disclosure and comments now propagate through both transports with allow-listed local tests. Subcategories/non-3DP usages and all paid/public/video branches remain action-gated for persisted readback.
- The 2026-08-02 exhaustive read-only MakerRoad audit reconfirmed all six upload sections, current bundle serializer and the absence of native video. Its renderer now rejects a save when edit readback changes title, privacy, plan, price type or a present upload-role count. The existing private core artifact remains the only live-certified MakerRoad branch.
- Printables now has native gallery selection for HEIC/HEIF and per-G-code controls for layer height, nozzle diameter, print duration hours, integer weight grams and exclude-from-total. Current mutation evidence requires decimal strings for decimal fields, integer weight, stripping the display-only processed `printer` object, and basic id/folder/name/note SLA input. The active rich-description image cap is 8 MiB; exact gallery count, per-gallery-image bytes and fixed aspect ratio remain unknown. Store/Club is unavailable on the current free-only account, and approval publishing needs an eligible account.

Safest next implementation/certification order:
1. Re-verify the exact packaged app at `/Users/alex/modelprep/desktop/dist/mac-arm64/ModelPrep.app`; do not use stale `/Applications/ModelPrep.app` copies and never use launchctl keepalive jobs.
2. MyMiniFactory's `829284` re-read is done and passed on 2026-08-03; its core and advanced branches are both exact-app live-certified and the platform is comprehensively mapped. Do not redo it and do not create another object. Select the next platform: Cults3D still has an open signed-in comprehensive-audit gate, because its last pass reached only signed-out public assets.
3. Read the `Per-platform remaining work` table and `platform-one-by-one-implementation-playbook.md`. Select one platform, state why it is next, and do not switch platforms during the investigation merely because a smaller or easier gap appears elsewhere. Do not rewrite a safe core that is already certified.
4. Before implementation, perform and persist a comprehensive signed-in, read-only audit of the selected platform. Inspect every reachable upload/create/edit/preview screen and step, including defaults, disabled controls, conditional sections, validation messages and account-gated states. Inspect current production DOM, loaded bundles and first-party requests/responses without printing secrets. Use official documentation only as supporting evidence; the current signed-in product is the source of truth for its actual flow.
5. For the selected platform, inventory all of the following even when the value is unknown or the feature is absent:
   - upload modes and complete step order;
   - model, source, archive, print-profile, G-code/SLA, document and specialist file roles;
   - file extensions, MIME types, per-file/total sizes, counts, filename rules, ordering and folder behavior;
   - cover/gallery/video formats, counts, dimensions, aspect ratios, cropping, ordering and persistence;
   - title, summary, description editor, formatting, embedded media, tags and character/count limits;
   - categories/subcategories, printer/process/material/filament/color/BOM and other platform-specific taxonomies;
   - licenses, originality/remix/source attribution, AI/NSFW and legal declarations;
   - draft/private/secret/public/review/scheduled states, pricing, memberships, plans, Store/Club/exclusive controls and eligibility gates;
   - create, upload, save, preview, publish, edit and readback endpoints, request ordering, payload fields, response identifiers and failure states.
6. Update the platform web-flow document and shared requirements/spec/audit/handoff documents with an evidence matrix before claiming the mapping is complete. For every field or branch, label the strongest evidence: visible DOM, current bundle, observed request, official documentation, local implementation/test, exact packaged runtime, retained live artifact/readback, account-gated, action-gated, absent, or unknown. Do not copy a stronger evidence label from another platform or from stale continuation text.
7. Only after the comprehensive mapping is current, compare it with ModelPrep's shared schema, platform options UI, preflight validation, desktop adapter/Worker fallback and readback verification. Implement all safely supportable missing mappings for that platform together where practical. Preserve consolidated shared inputs, but expose platform-specific overrides wherever automatic mapping would lose meaning or user control.
8. Treat Printables normal-public and specialist branches as complete. Delete public `1797774` only after exact confirmation; Store/Club and approval are blocked on account eligibility. MakerWorld video is deferred for manual verification. Cults typed media is implemented but still needs an explicitly authorized retained-secret live readback; MakerRoad's Aug. 2 audit confirms that its current native form does not support video. These classifications do not waive the comprehensive-audit gate for whichever platform is selected next.
9. Ask for action-time authorization only when the next evidence step would mutate the platform. Public, paid, agreement/terms, upload, publication and deletion actions require their own exact authorization. Continue all remaining read-only investigation and local implementation without waiting for mutation authority.
10. Prefer private or draft equivalents when a branch can be exercised safely; verify persisted edit/readback state and retain the receipt. A successful submit response alone is not certification.
11. Do not call the selected platform fully mapped until all safely reachable first-party states and contracts are documented. Do not call it fully certified while any mapped branch still lacks required live persisted readback. If an account-gated branch cannot be investigated with the current account, record the exact visible gate and required eligibility instead of silently skipping it.
12. During the next explicitly authorized private/draft/secret batch, download the retained aggregate report and compare idle, four-active and completion peaks. Do not consider concurrency above four until that load evidence exists.
13. Re-audit current DOM/bundles/request contracts before public release, whenever a platform breaks, and whenever stored bundle fingerprints or visible flow structure change.

For every change or certification:
- Separate mapped, implemented, locally verified, connected, browser-proven, live-certified, and fully certified evidence.
- Keep a per-platform coverage matrix. A single fixed branch does not satisfy the platform audit unless every other reachable branch is classified with evidence.
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
- the selected platform's complete coverage matrix, including every mapped, implemented, package-proven, live-certified, action-gated, account-gated, manually deferred, absent and unknown item;
- why the platform is or is not comprehensively mapped;
- why the platform is or is not fully certified;
- remaining blockers and the next smallest safe step on the same platform. Do not recommend switching platforms while safely investigable work remains on the selected one.
```
