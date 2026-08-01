#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="ModelPrep"
BUNDLE_ID="io.makerstats.modelprep"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_BUNDLE="$ROOT_DIR/desktop/dist/mac-arm64/ModelPrep.app"
APP_BINARY="$APP_BUNDLE/Contents/MacOS/$APP_NAME"
APP_LOG="${TMPDIR:-/tmp}/modelprep-desktop.log"
PREVIEW_SERVICE="io.makerstats.modelprep.preview"
APP_SERVICE="io.makerstats.modelprep.local"
INSTALLED_BINARY="/Applications/ModelPrep.app/Contents/MacOS/$APP_NAME"
SIGN_IDENTITY="${MODELPREP_SIGN_IDENTITY:-Developer ID Application: Aleksei Adzhem (UTZ4TVACJS)}"
ENTITLEMENTS="$ROOT_DIR/desktop/build/entitlements.mac.plist"
local_process_pattern="^${APP_BINARY}( |$)"
installed_process_pattern="^${INSTALLED_BINARY}( |$)"

# Remove launch jobs before killing their processes so launchd cannot respawn an
# old bundle during packaging. Both bundles share one identifier, so a stale
# process would otherwise win Electron's single-instance lock after the build.
launchctl remove "$PREVIEW_SERVICE" >/dev/null 2>&1 || true
launchctl remove "$APP_SERVICE" >/dev/null 2>&1 || true
pkill -f "$installed_process_pattern" >/dev/null 2>&1 || true
pkill -f "$local_process_pattern" >/dev/null 2>&1 || true
modelprep_running() {
  pgrep -f "$installed_process_pattern" >/dev/null \
    || pgrep -f "$local_process_pattern" >/dev/null
}
for _ in {1..20}; do
  if ! modelprep_running; then
    break
  fi
  sleep 0.1
done
if modelprep_running; then
  pkill -9 -f "$installed_process_pattern" >/dev/null 2>&1 || true
  pkill -9 -f "$local_process_pattern" >/dev/null 2>&1 || true
  for _ in {1..30}; do
    if ! modelprep_running; then
      break
    fi
    sleep 0.1
  done
fi
if modelprep_running; then
  echo "A stale ModelPrep process did not exit before packaging." >&2
  exit 1
fi

npm --prefix "$ROOT_DIR/desktop" run dist -- --dir --mac --arm64

# electron-builder can leave the unpacked --dir bundle carrying Electron's
# template ad-hoc signature even after logging its signing phase. Seal the
# exact QA bundle explicitly, then fail closed if any nested resource differs.
codesign --force --deep --options runtime --timestamp \
  --entitlements "$ENTITLEMENTS" --sign "$SIGN_IDENTITY" "$APP_BUNDLE"
codesign --verify --deep --strict "$APP_BUNDLE"

open_app() {
  # Ask Launch Services to open this exact bundle as a normal app. Unlike a
  # launchctl submit job this survives the build shell exiting, but it does not
  # install a keepalive that can relaunch a stale QA build after the user quits.
  /usr/bin/open -n "$APP_BUNDLE"
}

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\""
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --verify|verify)
    open_app
    for _ in {1..20}; do
      if pgrep -f "$local_process_pattern" >/dev/null; then
        exit 0
      fi
      sleep 0.1
    done
    echo "Local ModelPrep process did not remain running; see $APP_LOG" >&2
    exit 1
    ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac
