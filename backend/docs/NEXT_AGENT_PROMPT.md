# Copy-paste prompt for the next ModelPrep agent

```text
Continue the ModelPrep platform certification work in /Users/alex/modelprep.

Your immediate task is MakerOnline. Independently inspect the current code and
evidence before acting; do not trust this handoff alone.

Safety boundaries:
1. Start with `git status --short`. The worktree is deliberately very dirty and
   contains the user's work. Do not reset, clean, restore, broadly stage,
   commit, push, deploy, publish, delete, retry, or modify retained objects
   without explicit authorization.
2. Read, in order:
   - backend/docs/platform-current-state-2026-08-08.md
   - backend/docs/modelprep-current-handoff-2026-08-01.md
   - backend/docs/makeronline-web-flow.md
   - backend/docs/demo-upload-live-verification-2026-08-08.md
   - backend/docs/platform-one-by-one-implementation-playbook.md
3. Use `/Users/alex/modelprep/desktop/dist/mac-arm64/ModelPrep.app` for packaged
   QA. Launch it normally and detached; never use `launchctl submit`. Cleanly
   quit it and verify no ModelPrep process/helper/job remains.
4. Never expose cookies, tokens, credentials, private verification phrases, or
   signed URLs. Repository scans should show only the synthetic signed-URL
   redaction test.

Current evidence boundary:
- **2026-08-09 update:** the authorized MakerOnline package attempt stopped
  before save because parse-info omitted printers, nozzle, layer, plates and
  parseType. No draft was created and there was no retry. Local ZIP inspection
  proves the bundled Bambu project is unsliced (`printer_model` and G-code
  reference empty; no slice-info plate). The demo now keeps it raw-only and no
  longer fabricates parser metadata. A dual-role attempt requires a genuinely
  sliced truthful 3MF and new action-time authorization.
- Thingiverse `7393174` is rendered-confirmed with one remaining 0x0 resize
  thumbnail; its original asset exists. The correct category is `3D Printing ›
  3D Printing Tests`, selected locally but not saved pending final browser
  confirmation. Cults design `4759509` is rendered-certified. MMF `831756` now
  has a fresh successful isolated-session owner re-read (private, 10 ordered
  images, expected cover, 3 files, categories `60/462`), but native MMF DOM is
  still blocked by normal-Chrome login. Thangs `1586259` remains unverified: a
  fresh isolated-session GET ended with `net::ERR_CONNECTION_CLOSED` and was not
  retried; normal Chrome still shows not-found.
- All ten normal upload flows have been explored, but optional/public/paid/
  account-gated combinations are not fully certified.
- Printables draft `1803724` is retained-certified: all three files including
  the Bambu 3MF persisted byte-for-byte under ordinary `stls`, with ten images,
  Test Models category and unpublished metadata.
- Nexprint draft `2086143258366976000` is retained-certified for its safe core:
  all three files persisted in `modelFileList` at 36,084 / 54,084 / 30,787
  bytes; its separate `settingInfoList` profile branch remains empty.
- Creality object `6a777ac80389871f0cd5e0c0` is API-certified once settled:
  all three files retained with exact bytes and parsed geometry. The 3MF is an
  ordinary `modelList` entry, Print Configuration stays empty, and Creality
  masks `bambu` to `*****`. Bounded polling and MD5-first/mask-tolerant checks
  are implemented. Rendered UI/DOM is still unmet.
- MakerOnline existing draft `317477` proves the older no-profile safe core
  only. It contains two STLs and an empty profile branch; it does not prove the
  new dual-role 3MF path.
- MakerWorld and MakerRoad certification remain blocked on truthful physical-
  print photos. Cults retained evidence is strong but automatic readback was
  Cloudflare-limited. MMF and Thangs still need independent rendered UI/DOM.
  Thingiverse's local fixture category and product link are corrected. The
  existing draft still needs one explicitly authorized category save; its
  isolated resize-derivative defect remains platform-side.

MakerOnline implementation now present:
- `deploy/src/lib/makeronline-verify.js` and tests implement fail-closed
  verification from upload records, not readback-derived expectations.
- Raw files compare ordered storage key, native filename/extension, native
  bytes and parsed geometry. Geometry is exact only when MakerOnline's upload
  response supplied authoritative `model_size`; otherwise only positive parsed
  geometry is claimed.
- Listing images compare ordered keys and exactly one first-image `is_main`.
- Profile verification distinguishes absent/empty/populated state and compares
  ordered key/name/bytes, `print_file_type`, title, description, images, and
  structural `printers`, `nozzle`, `layer`, `plates`, `parse_type` values from
  `/api/file/parse-info`.
- Title, HTML description, category, tags, licence, permissions, source,
  `print_types`, AI/NSFW flags, docs, `is_offline`, and live-confirmed draft
  `status: 3` are checked. FDM/Resin/Both mapping mirrors the adapter (`3` ->
  `[1,2]`).
- `desktop/makeronline-direct.js` carries `nativeFileName` and
  `nativeFileSize` separately from source fallbacks. Certification requires
  native key/name/positive size/URL.
- An incomplete parser expectation stops before `save-draft`; no object is
  created. A valid save happens exactly once, its id/state/URL are captured
  immediately, and bounded polling checks only that saved id (3 s / 120 s).
- Latest recorded evidence: deploy 452/452, desktop 208/208, backend 31/31,
  TypeScript clean, production build/package rebuilt, strict codesign and
  designated requirement valid, `git diff --check` clean. Re-run proportionally
  and do not merely repeat these claims.

- Final exact-package UI QA shows the unsliced Bambu project under Model files
  and reports zero print profiles. The former extension-only auto-profile record
  was removed; do not regress it.

First task:
1. Review the final MakerOnline implementation and focused tests for any
   remaining correctness gap. Confirm the App uses
   `buildMakerOnlineExpectation`, the pre-save parser gate runs before submit,
   native response provenance cannot be replaced by source fallbacks, receipt
   data survives failure, and no polling path resubmits.
2. If the user has not explicitly authorized the live action in the current
   conversation, stop and request action-time authorization for exactly one
   private MakerOnline draft. Do not infer authorization from this prompt.
3. If explicitly authorized, use the exact signed package and its own UI:
   load the demo through TRY DEMO, disable the other nine platforms, confirm
   all three raw files are selected. Enable a 3MF as a print profile only when
   its real scan proves an embedded printer and sliced plate; the current
   bundled project deliberately does not qualify. Use the per-platform draft
   button exactly once.
4. Expected safe action: one `POST /api/mold/save-draft`, never `/create`;
   permissions 2/private, free, FDM `print_types [1]`, Original/source 1,
   licence 3/CC BY-NC, category 36/Test Models, no Exclusive, kits, China sync,
   paid state or agreements. Keep the filename unchanged.
5. Do not retry if upload, parse-info, save, polling, or verification fails.
   Preserve and report any retained id/URL. If parse-info is incomplete, the
   pre-save gate should stop with no object created.
6. Verify retained state from MakerOnline's own edit-info:
   - `files`: ordered S STL 36,084, M STL 54,084, Bambu 3MF 30,787 by native
     key/name/bytes and parsed geometry;
   - `print_files`: the same physical 3MF by key with parser values matching
     parse-info structurally;
   - `print_file_type: 1`, profile title/description/images;
   - ten ordered listing images and exactly one first-image cover;
   - title, structured description, category 36/category path, six tags,
     licence 3, permission 2, source 1, FDM `[1]`, flags 0, docs empty,
     draft status 3 and `is_offline: 0`.
7. Report separately whether MakerOnline masks `bambu`, whether upload supplied
   `model_size` (exact versus positive-only geometry proof), and whether the
   same 3MF retained successfully in both roles. Do not generalize Creality's
   masking behavior.
8. Attempt rendered edit UI/DOM inspection only through an already authorized,
   authenticated surface. Do not sign in, publish, edit, or discover endpoints
   by guessing. Clearly label API-certified versus rendered-certified.
9. Update makeronline-web-flow.md, platform-current-state-2026-08-08.md,
   modelprep-current-handoff-2026-08-01.md and this prompt with the exact result,
   retained ID/visibility, evidence boundary, tests and next smallest step.

After MakerOnline, the remaining planned order is:
1. Thingiverse one-time category save with explicit authorization; the
   zero-sized thumbnail is already bounded to an anomalous platform resize URL.
2. MMF and Thangs rendered UI/DOM verification through their isolated sessions.
3. Existing Cults editor/readback recheck after normal Cloudflare clearance;
   create nothing new.
4. MakerWorld and MakerRoad retained certification after the user supplies real
   physical-print photos and separately authorizes each mutation.
5. Pairwise optional-branch coverage rather than every combination: populated
   profiles, docs/attachments, remix/originality, one authorized public/review
   lifecycle, and paid/store only if the user wants it.

At handoff, distinguish local, package, retained API, rendered UI/DOM, blocked,
and uncertified evidence. Leave the worktree unstaged and uncommitted unless the
user explicitly requests otherwise.
```
