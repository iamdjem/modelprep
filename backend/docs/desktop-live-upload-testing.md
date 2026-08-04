# Desktop account persistence and live-upload testing

Last audited: 2026-08-02

This runbook separates three states that look similar in the UI but prove very
different things:

1. **Demo simulation** checks ModelPrep's orchestration and receipts. It never
   sends files or metadata, even when real accounts are connected.
2. **Local adapter verification** checks request ordering, payloads, limits,
   readback logic, and rendered controls with mocks or safe metadata reads.
3. **Account-backed certification** creates a real private, secret, or
   unpublished artifact on the platform and reads it back. This is the only
   state that proves the current production service accepted the integration.

## Always run the matching desktop and renderer

Packaged ModelPrep now ships its renderer in the same `.app`. This prevents a
new hosted page from running against an old Electron preload/IPC bridge. The
local QA command remains:

```bash
./script/build_and_run.sh run
```

The header must show the current build time and ten platform targets. If
Settings says **Desktop app update required**, quit every ModelPrep process and
launch the newly built app. The app also holds a single-instance lock so two
copies cannot intentionally share the same desktop profile after this build.

## How desktop sign-ins persist

| Platform | Desktop sign-in storage | Relaunch behavior |
|---|---|---|
| MakerWorld | `persist:makerworld` plus encrypted cookie fallback | Rediscovered and validated on launch |
| Printables | `persist:printables` plus encrypted cookie fallback | Rediscovered and validated; Prusa may expire the OAuth session and require login again |
| Cults3D | Credentials encrypted with Electron `safeStorage`, renderer keeps only an opaque account id | Revalidated on launch |
| Nexprint | `persist:nexprint` plus encrypted token/cookie fallback | Rediscovered and validated on launch |
| Creality Cloud | `persist:creality` plus encrypted token/user/cookie fallback | Rediscovered and validated on launch |
| MakerOnline | `persist:makeronline` plus encrypted token/cookie fallback | Rediscovered and validated on launch |
| MyMiniFactory | `persist:myminifactory` plus encrypted cookie fallback | Rediscovered and validated on launch |
| MakerRoad | `persist:makeroad` plus encrypted `X-Token`/cookie fallback | Rediscovered and validated through authenticated `/api/user`; recheck availability after service outages |
| Thangs | `persist:thangs` plus encrypted local-storage bearer token and cookie fallback | Rediscovered and validated through production `users/current`; never use cookie-only validation |
| Thingiverse | `persist:thingiverse` plus encrypted cookie fallback | Rediscovered and validated on launch; direct draft-first upload enabled after written clearance on 2026-08-01 |

The renderer never stores raw desktop tokens or cookies. It stores opaque
markers only. `accounts:discover` recreates those markers after an origin or
renderer change. A persisted session can still become invalid when the platform
expires or revokes it; that must be displayed as **Reconnect needed**, not as a
lost local credential.

### Recovery behavior

On startup, ModelPrep validates each opaque desktop account marker without
exposing its session to the renderer. If normal discovery does not find the
account, the desktop bridge performs a silent recovery attempt: it validates
the encrypted fallback, loads a read-only first-party page in the platform's
persistent isolated partition so sliding cookies can rotate, and validates the
result again. MakerWorld also uses its refresh token when available. Successful
rotated state is mirrored back into Electron `safeStorage`.

While that check runs, the account is **Checking saved session** and cannot be
used for upload. If the platform rejects the recovered state, the account is
**Reconnect needed**. Settings, Platforms, and Publish all expose the same
Reconnect action. It repeats silent recovery first and opens the existing
isolated platform sign-in window only when interactive authentication is truly
required. ModelPrep cannot override a platform's server-side revocation or
maximum session lifetime.

## Safest real-upload sequence

1. Open **Settings → Accounts** in the current desktop app and connect every
   intended platform. Resolve every **Reconnect needed** state.
2. Either import a real project, or enter Demo and choose **Create real test
   copy**. That confirmation only removes Demo safety; it does not upload yet.
3. In **Platforms**, test one destination at a time first. Select the safest
   non-public action available:
   - MakerWorld: private
   - Printables: unpublished draft
   - Cults3D: secret/unlisted
   - Nexprint: unpublished draft
   - Creality Cloud: private (the new-model page cannot create a draft)
   - MakerOnline: unpublished draft
   - MyMiniFactory: private
   - MakerRoad: private Save after authenticated availability is confirmed
   - Thangs: private
   - Thingiverse: Save as Draft
4. Supply a real cover, ordered gallery, compatible raw model, and the metadata
   required by that platform. Add `.3mf`, documentation, or videos only in a
   dedicated capability test.
5. Open the Pre-flight panel. Errors block the batch; warnings should be
   reviewed but do not necessarily prevent a safe draft.
6. Use the individual platform action first. Confirm the returned platform URL,
   status/visibility, media order, model files, metadata, and adapter readback.
7. After every platform passes individually with the same fixture, enable the
   intended set and use the one-click batch action. ModelPrep runs up to four
   desktop flows at a time, preserves each platform's internal request order, and
   continues other destinations after an isolated failure. A completed partial
   failure can retry failed destinations only without replaying successes.
8. Record every created id and whether the test artifact is intentionally kept
   or removed. Never test public publication as part of a private/draft
   certification unless it is explicitly authorized.

## Current parity and certification boundary

| Platform | Direct connect/upload | Safest real action | Current account-backed evidence | Important remaining gaps |
|---|---|---|---|---|
| MakerWorld | Implemented | Private | Latest exact-app private receipt `9053658`; earlier deep 3MF and Laser & Cut evidence | Model video; genuine `.lac` final submit; CyberBrick combinations |
| Printables | Implemented | Draft by default; explicit public branch | Core draft, specialist G-code/SLA/retained-ZIP/converted-HEIC draft `1797772`, and public model `1797774` have exact-app readback evidence | Delete `1797774` only after confirmation; Store/Club and approval need eligible accounts; unpacked ZIP/remix/reupload/rich-image round trips remain |
| Cults3D | Implemented | Secret | Latest exact-app secret slug ends `6f02ba1cd366b9cb06a5`; ordered media/file and metadata readback passed | Live typed video; paid/open price, multi-usage and more category/license combinations |
| Nexprint | Implemented | Draft | Latest exact-app unpublished draft `2083625532272496640` passed complete core readback | Public, activity eligibility, broad extension/attachment matrix |
| Creality Cloud | Implemented | Private | Latest exact-app Original/private model `6a6e3f28753b84f6aab190a8` passed file/cover/metadata readback | Existing-draft edit, public and other media/files; non-original structured attribution; paid/account-gated branches |
| MakerOnline | Implemented | Draft | Latest exact-app unpublished draft `316221` passed ordered image/file, metadata, taxonomy/license and visibility readback | 3MF/profile, docs, remix/public/Creative Kit/China/exclusive branches |
| MyMiniFactory | Implemented and core-certified | Private default | Exact-app object `829056` plus independent hydrated-editor readback verified categories, ordered images/files, metadata and private state | Public review, declarations/remix/advanced fields and optional combinations |
| MakerRoad | Implemented and core-certified | Private Save | Exact-app draft `M2134222528` passed authenticated Save and required `uploadType=1` edit readback | Video contract unknown; public/review, paid, remix, schedule and optional combinations |
| Thangs | Implemented and core-certified | Private | Exact-app model `1583272` passed single-part details/attachments/license and metadata readback | Multipart/bulk/assembly, versions, plans/membership/paid/public and optional branches |
| Thingiverse | Implemented and core-certified | Save as Draft | Exact-app draft `7390480` passed upload/create/finalize and unpublished readback | Public, remix, rich sections, education/app associations and optional branches |

“Implemented” does not mean every optional combination has been live-certified.
The canonical field maps and per-platform evidence remain in the ten
`*-web-flow.md` documents and `platform-upload-requirements-live.md`.

For the current implementation ledger, continuation order, critical lessons,
and copy-paste next-agent prompt, read
`modelprep-current-handoff-2026-08-01.md` and `NEXT_AGENT_PROMPT.md` before
touching a platform adapter.

For the repeatable screen/bundle/request mapping and three-layer implementation
method, also read `platform-one-by-one-implementation-playbook.md`.
