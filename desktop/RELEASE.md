# ModelPrep desktop — release & beta distribution

This covers the two things beta needs that require **your** credentials:
notarized macOS builds and published auto-update releases. The app-side wiring
(auto-update client, crash/error diagnostics) is already implemented.

## macOS notarization (removes the "unidentified developer" wall)

The build is already Developer-ID signed with hardened runtime + entitlements,
and `build.mac.notarize.teamId` is set. Notarization only needs Apple
credentials in the environment **and** a real installer target (not `--dir`).

Set one of these credential sets before building:

```bash
# Option A — Apple ID + app-specific password
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # appleid.apple.com → App-Specific Passwords
export APPLE_TEAM_ID="UTZ4TVACJS"

# Option B — App Store Connect API key (better for CI)
export APPLE_API_KEY="/path/to/AuthKey_XXXX.p8"
export APPLE_API_KEY_ID="XXXXXXХХХХ"
export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Then build a notarized DMG (the `--dir` fast path used by `script/build_and_run.sh`
intentionally skips notarization):

```bash
npm --prefix desktop run dist -- --mac --arm64
```

electron-builder will staple the notarization ticket to `dist/ModelPrep-*.dmg`.
Verify: `spctl -a -vvv -t install "dist/mac-arm64/ModelPrep.app"` should say
`source=Notarized Developer ID`.

## Windows signing (removes SmartScreen "unknown publisher")

Currently unsigned (fine for a few trusted testers who click "More info → Run
anyway"). To sign, provide an Authenticode cert (or Azure Trusted Signing) via
`CSC_LINK` + `CSC_KEY_PASSWORD` and rebuild `--win`.

## Auto-update releases (so testers get fixes automatically)

The client is wired (`electron-updater`, GitHub provider `iamdjem/modelprep`).
For updates to exist, publish each release to GitHub Releases **with** the
generated `latest-mac.yml` / `latest.yml` metadata:

```bash
export GH_TOKEN="ghp_…"                      # repo scope
npm --prefix desktop run dist -- --mac --arm64 --publish always
# then the same for Windows on a Windows runner:  --win --x64 --publish always
```

- Bump `desktop/package.json` `version` for each release (auto-update compares it).
- macOS auto-update requires the artifacts to be **signed + notarized**, so do
  the notarization step above first.
- On launch the packaged app checks the feed, downloads in the background, and
  the About tab offers **Restart to update** when ready.

## Beta feedback (already in the app, no backend)

Settings → About → Diagnostics: a sanitized local error log (no cookies/tokens/
signed URLs), **Export diagnostics** (save the JSON), and **Report a problem**
(opens a prefilled GitHub issue). Ask testers to use these.
