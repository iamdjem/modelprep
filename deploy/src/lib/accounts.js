// Centralized multi-account store for platform sign-ins (MakerWorld, Cults, …).
//
// Shape in localStorage under `modelprep:accounts`:
//   { [platform]: { accounts: [{ id, label, secret, status, addedAt }], activeId } }
//
// - `secret` is whatever that platform needs to act as the user: MakerWorld web →
//   the session cookie string; MakerWorld desktop → an opaque main-process marker;
//   Cults web → { email, password }; Cults desktop → opaque encrypted-account id.
//   Web secrets are stored only in this browser; desktop credentials live in
//   Electron safeStorage and never persist in renderer storage.
// - `status`: 'connected' | 'reconnect' | 'error' | 'unknown'.
// - One account per platform is "active" (activeId) — that's what the publish step uses.
// Multiple accounts per platform are supported (add/switch/remove), with isolation:
// each account keeps its own secret + status under its own id.
import { useSyncExternalStore } from 'react';

const KEY = 'modelprep:accounts';
// Platforms with a real sign-in today; everything else is "coming soon" in the UI.
export const CONNECTABLE = ['makerworld', 'printables', 'cults', 'nexprint', 'creality', 'makeronline', 'mmf', 'makeroad', 'thangs', 'thingiverse'];

const uid = () => 'a_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

function readRaw() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}

// One-time migration of the old single-account keys so existing sign-ins survive.
function migrate(s) {
  let changed = false;
  if (s.makerworld === undefined) {
    try {
      const mw = localStorage.getItem('modelprep:makerworld-cookie');
      if (mw) { s.makerworld = wrap({ id: uid(), label: 'MakerWorld', secret: mw, status: 'connected', addedAt: Date.now() }); changed = true; }
      // Drop the legacy key once migrated so a later disconnect can't resurrect it.
      localStorage.removeItem('modelprep:makerworld-cookie');
    } catch { /* ignore */ }
  }
  if (s.cults === undefined) {
    try {
      const p = JSON.parse(localStorage.getItem('modelprep:cults-web-creds') || 'null');
      if (p?.email && p?.password) { s.cults = wrap({ id: uid(), label: p.email, secret: p, status: 'connected', addedAt: Date.now() }); changed = true; }
      localStorage.removeItem('modelprep:cults-web-creds');
    } catch { /* ignore */ }
  }
  return changed;
}
const wrap = (acct) => ({ accounts: [acct], activeId: acct.id });

let state = readRaw();
if (migrate(state)) persist();

function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
const listeners = new Set();
function emit() { state = { ...state }; persist(); listeners.forEach((l) => l()); }

export function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }
export function snapshot() { return state; }

export function getAccounts(platform) { return state[platform]?.accounts ?? []; }
export function getActive(platform) {
  const p = state[platform]; if (!p) return null;
  return p.accounts.find((a) => a.id === p.activeId) || p.accounts[0] || null;
}

/** Add (or, if same label exists, update) an account and make it active. Returns the account. */
export function addAccount(platform, { label, secret, status = 'connected' }) {
  const p = state[platform] || { accounts: [], activeId: null };
  const name = label || platform;
  const existing = p.accounts.find((a) => a.label === name);
  if (existing) {
    state[platform] = { accounts: p.accounts.map((a) => a.id === existing.id ? { ...a, secret, status } : a), activeId: existing.id };
    emit(); return { ...existing, secret, status };
  }
  const acct = { id: uid(), label: name, secret, status, addedAt: Date.now() };
  state[platform] = { accounts: [...p.accounts, acct], activeId: acct.id };
  emit(); return acct;
}
export function updateAccount(platform, id, patch) {
  const p = state[platform]; if (!p) return;
  state[platform] = { ...p, accounts: p.accounts.map((a) => a.id === id ? { ...a, ...patch } : a) };
  emit();
}
export function setStatus(platform, id, status) { updateAccount(platform, id, { status }); }
export function setActive(platform, id) { const p = state[platform]; if (!p) return; state[platform] = { ...p, activeId: id }; emit(); }
export function removeAccount(platform, id) {
  const p = state[platform]; if (!p) return;
  const accounts = p.accounts.filter((a) => a.id !== id);
  state[platform] = { accounts, activeId: p.activeId === id ? (accounts[0]?.id || null) : p.activeId };
  emit();
}

/** Add or refresh an opaque desktop account marker without duplicating it. */
export function rehydrateDesktopAccount(platform, { label, secret }) {
  const existing = getAccounts(platform).find((account) => account.secret === secret);
  if (!existing) return addAccount(platform, { label, secret, status: 'connected' });
  updateAccount(platform, existing.id, { label: label || existing.label, status: 'connected' });
  setActive(platform, existing.id);
  return { ...existing, label: label || existing.label, status: 'connected' };
}

/** Subscribe a component to the store; returns the action helpers (which read live state). */
export function useAccounts() {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return { getAccounts, getActive, addAccount, updateAccount, removeAccount, setActive, setStatus };
}
