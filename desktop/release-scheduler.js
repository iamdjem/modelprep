'use strict';

// Main-process release scheduler.
//
// The renderer already fires reminders and auto-publishes scheduled plans while
// the app window is open. This adds the part that survives the window being
// closed: the Electron main process keeps a persisted copy of the plans (synced
// from the renderer) and, on a timer that outlives any window, fires native
// notifications and — for plans the user explicitly opted into unattended
// publishing — reopens the app so its normal, session-checked publish path runs.
//
// This module is pure: no electron, no fs. main.js injects getPlans/savePlans/
// notify/openWindowForPublish/now so the decision logic is fully unit-testable.

function markPlan(plans, id, patch) {
  return plans.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan));
}

// Which plans need action right now. `notifiedByMain` / `firedByMain` are marks
// this scheduler writes so it never notifies or publishes the same plan twice.
function computeSchedulerActions(plans, now) {
  const reminders = [];
  const unattended = [];
  for (const plan of Array.isArray(plans) ? plans : []) {
    if (plan?.status !== 'pending') continue;
    const due = Date.parse(plan.dueAt || '');
    if (!Number.isFinite(due) || due > now) continue;
    // Unattended scheduled plans live on the unattended track only; they must
    // never also become a reminder once fired.
    if (plan.mode === 'scheduled' && plan.unattended) {
      if (!plan.firedByMain) unattended.push(plan);
    } else if (!plan.notifiedByMain) {
      reminders.push(plan);
    }
  }
  return { reminders, unattended };
}

// True while any unattended plan is still pending — main uses this to stay alive
// after the last window closes instead of quitting.
function hasPendingUnattended(plans, now) {
  return (Array.isArray(plans) ? plans : []).some((plan) => plan?.status === 'pending'
    && plan.mode === 'scheduled' && plan.unattended && !plan.firedByMain
    && (!plan.dueAt || Number.isFinite(Date.parse(plan.dueAt))));
}

function createReleaseScheduler(deps = {}) {
  const getPlans = deps.getPlans || (() => []);
  const savePlans = deps.savePlans || (() => {});
  const notify = deps.notify || (() => {});
  const openWindowForPublish = deps.openWindowForPublish || (() => {});
  const now = deps.now || Date.now;
  const intervalMs = deps.intervalMs || 30_000;
  let timer = null;

  function tick() {
    const plans = getPlans();
    const { reminders, unattended } = computeSchedulerActions(plans, now());
    if (!reminders.length && !unattended.length) return { reminders: 0, unattended: 0 };
    let next = plans;
    for (const plan of reminders) {
      try { notify(plan); } catch { /* notifications are best-effort */ }
      next = markPlan(next, plan.id, { notifiedByMain: now() });
    }
    for (const plan of unattended) {
      // Announce, then reopen the app so the renderer's session-checked publish
      // path runs. If the session is unusable the renderer leaves it pending and
      // the visible overdue queue tells the user — we never publish blind.
      try { notify(plan, { unattended: true }); } catch { /* best effort */ }
      try { openWindowForPublish(plan); } catch { /* window will retry next tick if it failed */ }
      next = markPlan(next, plan.id, { firedByMain: now(), notifiedByMain: now() });
    }
    savePlans(next);
    return { reminders: reminders.length, unattended: unattended.length };
  }

  return {
    tick,
    start() { if (!timer) { timer = setInterval(tick, intervalMs); } tick(); return this; },
    stop() { if (timer) { clearInterval(timer); timer = null; } },
    isRunning: () => !!timer,
  };
}

// Merge renderer-synced plans with the marks main has already written, so a sync
// from the renderer can't resurrect an already-notified/fired plan.
function mergeSyncedPlans(previous, incoming) {
  const prevById = new Map((Array.isArray(previous) ? previous : []).map((plan) => [plan.id, plan]));
  return (Array.isArray(incoming) ? incoming : []).map((plan) => {
    const old = prevById.get(plan.id);
    if (!old) return plan;
    return {
      ...plan,
      notifiedByMain: plan.notifiedByMain || old.notifiedByMain,
      firedByMain: plan.firedByMain || old.firedByMain,
    };
  });
}

module.exports = {
  computeSchedulerActions,
  hasPendingUnattended,
  createReleaseScheduler,
  mergeSyncedPlans,
  markPlan,
};
