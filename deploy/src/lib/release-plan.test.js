import { describe, expect, it } from 'vitest';
import {
  RELEASE_PLAN_STORAGE_KEY,
  describeDue,
  dueReleasePlans,
  dueScheduledTargets,
  loadReleasePlans,
  patchReleasePlan,
  pendingReleasePlans,
  planForProjectPlatform,
  releasePlanIssues,
  removeReleasePlan,
  saveReleasePlans,
  unnotifiedDuePlans,
  upsertReleasePlan,
} from './release-plan.js';

const NOW = Date.parse('2026-08-04T12:00:00Z');
const plan = (over = {}) => ({
  id: over.id || 'p1',
  projectTitle: 'Desk Dragon',
  platformId: 'cults',
  platformName: 'Cults3D',
  mode: 'remind',
  dueAt: '2026-08-18T12:00:00Z',
  note: 'after Thangs exclusivity',
  createdAt: NOW,
  status: 'pending',
  ...over,
});

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
}

describe('release plans', () => {
  it('round-trips through storage and survives corrupt data', () => {
    const storage = memoryStorage();
    expect(loadReleasePlans(storage)).toEqual([]);
    saveReleasePlans(storage, [plan()]);
    expect(loadReleasePlans(storage)).toHaveLength(1);
    storage.setItem(RELEASE_PLAN_STORAGE_KEY, '{corrupt');
    expect(loadReleasePlans(storage)).toEqual([]);
  });

  it('validates mode and future due date', () => {
    expect(releasePlanIssues(plan(), NOW)).toEqual([]);
    expect(releasePlanIssues(plan({ mode: 'nope' }), NOW).join(' ')).toMatch(/remind or scheduled/);
    expect(releasePlanIssues(plan({ dueAt: '' }), NOW).join(' ')).toMatch(/date and time/);
    expect(releasePlanIssues(plan({ dueAt: '2026-08-01T00:00:00Z' }), NOW).join(' ')).toMatch(/future/);
  });

  it('keeps one pending plan per project+platform on upsert', () => {
    let plans = upsertReleasePlan([], plan());
    plans = upsertReleasePlan(plans, plan({ id: 'p2', dueAt: '2026-08-20T12:00:00Z' }));
    expect(pendingReleasePlans(plans)).toHaveLength(1);
    expect(planForProjectPlatform(plans, 'desk dragon', 'cults').id).toBe('p2');
    // a done plan for the same key is preserved as history
    plans = upsertReleasePlan([plan({ id: 'old', status: 'done' })], plan({ id: 'new' }));
    expect(plans).toHaveLength(2);
  });

  it('computes due, unnotified and human labels', () => {
    const plans = [
      plan({ id: 'due', dueAt: '2026-08-04T11:00:00Z' }),
      plan({ id: 'later', platformId: 'thangs', dueAt: '2026-08-06T12:00:00Z' }),
      plan({ id: 'seen', platformId: 'mmf', dueAt: '2026-08-04T10:00:00Z', notifiedAt: NOW - 1000 }),
    ];
    expect(dueReleasePlans(plans, NOW).map((p) => p.id)).toEqual(['seen', 'due']);
    expect(unnotifiedDuePlans(plans, NOW).map((p) => p.id)).toEqual(['due']);
    expect(describeDue(plans[0], NOW)).toBe('1h overdue');
    expect(describeDue(plan({ dueAt: '2026-08-04T11:30:00Z' }), NOW)).toBe('due now');
    expect(describeDue(plans[1], NOW)).toBe('in 2d');
  });

  it('maps due scheduled plans onto ready publish targets for the open project only', () => {
    const plans = [
      plan({ id: 's1', mode: 'scheduled', dueAt: '2026-08-04T11:00:00Z' }),
      plan({ id: 's2', mode: 'scheduled', platformId: 'thangs', dueAt: '2026-08-04T11:00:00Z' }),
      plan({ id: 'other', mode: 'scheduled', projectTitle: 'Other Model', platformId: 'mmf', dueAt: '2026-08-04T11:00:00Z' }),
      plan({ id: 'remindOnly', dueAt: '2026-08-04T11:00:00Z', platformId: 'printables' }),
    ];
    const targets = [
      { id: 'cults', mode: 'real', issues: { errors: [] } },
      { id: 'thangs', mode: 'missing', issues: { errors: [] } },
      { id: 'mmf', mode: 'real', issues: { errors: [] } },
      { id: 'printables', mode: 'real', issues: { errors: [] } },
    ];
    const due = dueScheduledTargets(plans, 'Desk Dragon', targets, NOW);
    expect(due.map(({ plan: p }) => p.id)).toEqual(['s1']); // thangs not connected, other project skipped, reminders never auto-start
  });

  it('patches and removes by id', () => {
    let plans = [plan()];
    plans = patchReleasePlan(plans, 'p1', { status: 'done' });
    expect(plans[0].status).toBe('done');
    expect(removeReleasePlan(plans, 'p1')).toEqual([]);
  });
});
