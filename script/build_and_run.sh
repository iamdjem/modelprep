#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="ModelPrep"
BUNDLE_ID="io.makerstats.modelprep"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_BUNDLE="$ROOT_DIR/desktop/dist/mac-arm64/ModelPrep.app"
APP_BINARY="$APP_BUNDLE/Contents/MacOS/$APP_NAME"
PREVIEW_HOST="localhost"
PREVIEW_PORT="4173"
PREVIEW_URL="http://$PREVIEW_HOST:$PREVIEW_PORT"
PREVIEW_LOG="${TMPDIR:-/tmp}/modelprep-vite-preview.log"
APP_LOG="${TMPDIR:-/tmp}/modelprep-desktop.log"
PREVIEW_SERVICE="io.makerstats.modelprep.preview"
APP_SERVICE="io.makerstats.modelprep.local"
NODE_BIN="$(command -v node)"
VITE_CLI="$ROOT_DIR/deploy/node_modules/vite/bin/vite.js"

# Both the installed release and this local bundle use the same bundle ID. Kill
# either exact main executable so LaunchServices cannot focus the stale copy.
pkill -f "^(/Applications/ModelPrep.app|$APP_BUNDLE)/Contents/MacOS/$APP_NAME$" >/dev/null 2>&1 || true
launchctl remove "$PREVIEW_SERVICE" >/dev/null 2>&1 || true
launchctl remove "$APP_SERVICE" >/dev/null 2>&1 || true

npm --prefix "$ROOT_DIR/deploy" run build
npm --prefix "$ROOT_DIR/desktop" run dist -- --dir --mac --arm64

launchctl submit -l "$PREVIEW_SERVICE" -o "$PREVIEW_LOG" -e "$PREVIEW_LOG" -- \
  "$NODE_BIN" "$VITE_CLI" preview "$ROOT_DIR/deploy" --host "$PREVIEW_HOST" --port "$PREVIEW_PORT"

for _ in {1..50}; do
  if /usr/bin/curl --silent --fail "$PREVIEW_URL/version.json" >/dev/null; then
    break
  fi
  sleep 0.1
done
/usr/bin/curl --silent --fail "$PREVIEW_URL/version.json" >/dev/null

open_app() {
  # LaunchServices may substitute /Applications/ModelPrep.app because both bundles share
  # an identifier. Execute the exact local binary so QA cannot focus or relaunch a stale copy.
  launchctl submit -l "$APP_SERVICE" -o "$APP_LOG" -e "$APP_LOG" -- \
    /usr/bin/env MODELPREP_URL="$PREVIEW_URL" "$APP_BINARY"
}

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    env MODELPREP_URL="$PREVIEW_URL" lldb -- "$APP_BINARY"
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
      if pgrep -f "^$APP_BINARY$" >/dev/null; then
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
