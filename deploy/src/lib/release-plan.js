// Per-platform release plans: "remind me to publish here on <date>" and
// "publish here automatically on <date>". Plans persist in localStorage so
// they survive restarts, and are keyed by project title + platform so a
// staggered rollout (e.g. Thangs premium first, Cults two weeks later)
// survives closing the app in between.
//
// Scheduled plans only run while ModelPrep is open: publishing is a real
// mutation through the platform flows, so there is no background daemon.
// When a scheduled plan comes due the app notifies, navigates to Publish,
// and starts a normal single-target batch through the existing pipeline.

export const RELEASE_PLAN_STORAGE_KEY = 'modelprep:release-plans:v1';
export const RELEASE_PLAN_MODES = ['remind', 'scheduled'];

export function loadReleasePlans(storage) {
  try {
    const raw = storage?.getItem?.(RELEASE_PLAN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((plan) => plan && plan.id) : [];
  } catch {
    return [];
  }
}

export function saveReleasePlans(storage, plans) {
  try {
    storage?.setItem?.(RELEASE_PLAN_STORAGE_KEY, JSON.stringify(plans));
    return true;
  } catch {
    return false;
  }
}

export function releasePlanIssues(plan, now = 0) {
  const issues = [];
  if (!RELEASE_PLAN_MODES.includes(plan?.mode)) issues.push('Choose remind or scheduled.');
  if (!plan?.platformId) issues.push('A release plan needs a platform.');
  const due = Date.parse(plan?.dueAt || '');
  if (!Number.isFinite(due)) issues.push('Choose a date and time.');
  else if (now && due <= now) issues.push('Choose a future date and time.');
  return issues;
}

export function planKey(projectTitle, platformId) {
  return `${String(projectTitle || 'Untitled Project').trim().toLowerCase()}::${platformId}`;
}

export function planForProjectPlatform(plans, projectTitle, platformId) {
  const key = planKey(projectTitle, platformId);
  return plans.find((plan) => plan.status === 'pending' && planKey(plan.projectTitle, plan.platformId) === key) || null;
}

export function upsertReleasePlan(plans, entry) {
  const key = planKey(entry.projectTitle, entry.platformId);
  const kept = plans.filter((plan) => !(plan.status === 'pending' && planKey(plan.projectTitle, plan.platformId) === key));
  return [...kept, entry];
}

export function removeReleasePlan(plans, id) {
  return plans.filter((plan) => plan.id !== id);
}

export function patchReleasePlan(plans, id, patch) {
  return plans.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan));
}

export function pendingReleasePlans(plans) {
  return plans
    .filter((plan) => plan.status === 'pending')
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export function dueReleasePlans(plans, now) {
  return pendingReleasePlans(plans).filter((plan) => Date.parse(plan.dueAt) <= now);
}

// Newly due plans that have not yet produced a notification.
export function unnotifiedDuePlans(plans, now) {
  return dueReleasePlans(plans, now).filter((plan) => !plan.notifiedAt);
}

// Due `scheduled` plans for the currently open project that map onto a ready
// publish target. These are safe to auto-start through the normal batch path.
export function dueScheduledTargets(plans, projectTitle, targets, now) {
  return dueReleasePlans(plans, now)
    .filter((plan) => plan.mode === 'scheduled'
      && planKey(plan.projectTitle, plan.platformId) === planKey(projectTitle, plan.platformId))
    .map((plan) => ({ plan, target: targets.find((target) => target.id === plan.platformId) || null }))
    .filter(({ target }) => target && target.mode !== 'missing' && target.issues?.errors?.length === 0);
}

export function describeDue(plan, now) {
  const due = Date.parse(plan.dueAt);
  if (!Number.isFinite(due)) return '';
  const deltaMinutes = Math.round((due - now) / 60000);
  if (deltaMinutes <= 0) {
    const overdue = -deltaMinutes;
    if (overdue < 60) return 'due now';
    if (overdue < 60 * 48) return `${Math.round(overdue / 60)}h overdue`;
    return `${Math.round(overdue / (60 * 24))}d overdue`;
  }
  if (deltaMinutes < 60) return `in ${deltaMinutes}min`;
  if (deltaMinutes < 60 * 48) return `in ${Math.round(deltaMinutes / 60)}h`;
  return `in ${Math.round(deltaMinutes / (60 * 24))}d`;
}
