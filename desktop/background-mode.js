'use strict';
// Background mode: stay signed in while the window is closed.
//
// Platform sessions live inside this app's cookie partitions and encrypted
// blobs, so only this app can refresh them. The keep-alive loop already does
// that every few hours, but it only runs while the app runs, and a session can
// age out while the app sits closed (MyMiniFactory and MakerRoad rotate a
// 7-day cookie). Background mode keeps the app resident after the last window
// closes, as a menu bar item with no Dock icon, and starts it hidden at login,
// so the loop keeps touching every platform and sign-ins last as long as the
// platforms allow.
//
// Pure decisions live here and are unit-tested; main.js wires them to Electron.

const HOUR = 60 * 60 * 1000;

const DEFAULT_PREFS = Object.freeze({ enabled: true });

function readBackgroundPrefs(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PREFS };
    return { enabled: parsed.enabled !== false };
  } catch { return { ...DEFAULT_PREFS }; }
}

/** Start without a window: background mode is on and this launch was the login item's hidden one, or asked for it. */
function shouldStartHidden({ argv = [], loginItem = {}, enabled = true } = {}) {
  if (!enabled) return false;
  if (argv.includes('--hidden') || argv.includes('--background')) return true;
  return !!loginItem.wasOpenedAsHidden;
}

/** The keep-alive cadence. In the background the first pass comes sooner and passes come more often. */
function keepAliveSchedule({ enabled = true, hidden = false } = {}) {
  if (!enabled) return { intervalMs: 6 * HOUR, initialDelayMs: 10 * 60 * 1000 };
  return { intervalMs: 4 * HOUR, initialDelayMs: hidden ? 60 * 1000 : 10 * 60 * 1000 };
}

function describeAgo(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** What the menu bar item says about the last pass. */
function keepAliveSummary(results, now = Date.now()) {
  const entries = [...(results instanceof Map ? results.values() : Object.values(results || {}))];
  if (!entries.length) return 'Sessions not refreshed yet';
  const latest = Math.max(...entries.map((entry) => entry.at || 0));
  const ok = entries.filter((entry) => entry.ok).length;
  return `Sessions refreshed ${describeAgo(now - latest)} · ${ok} of ${entries.length} ok`;
}

/** Menu items for the tray, as plain data so main.js only maps them to Electron. */
function trayMenuModel({ results, now = Date.now(), enabled = true, running = false } = {}) {
  return [
    { id: 'open', label: 'Open ModelPrep' },
    { id: 'status', label: running ? 'Refreshing sessions…' : keepAliveSummary(results, now), enabled: false },
    { id: 'refresh', label: 'Refresh sessions now', enabled: !running },
    { type: 'separator' },
    { id: 'toggle', label: 'Keep me signed in in the background', type: 'checkbox', checked: !!enabled },
    { type: 'separator' },
    { id: 'quit', label: 'Quit ModelPrep' },
  ];
}

// The LaunchAgent that opens the app hidden at login. Electron's "open as
// hidden" login item is the old LaunchServices flag and macOS 13+ ignores it,
// so the window would come up at every login; a LaunchAgent passes --hidden
// and the app decides. KeepAlive is off: Quit means quit.
const LAUNCH_AGENT_LABEL = 'com.modelprep.desktop.keepalive';
function xml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function launchAgentPlist({ execPath, label = LAUNCH_AGENT_LABEL } = {}) {
  if (!execPath) throw new Error('launchAgentPlist needs execPath');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `  <key>Label</key><string>${xml(label)}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${xml(execPath)}</string>`,
    '    <string>--hidden</string>',
    '  </array>',
    '  <key>RunAtLoad</key><true/>',
    '  <key>KeepAlive</key><false/>',
    '  <key>ProcessType</key><string>Background</string>',
    '  <key>LimitLoadToSessionType</key><string>Aqua</string>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

module.exports = { readBackgroundPrefs, shouldStartHidden, keepAliveSchedule, keepAliveSummary, trayMenuModel, describeAgo, launchAgentPlist, LAUNCH_AGENT_LABEL, DEFAULT_PREFS };
