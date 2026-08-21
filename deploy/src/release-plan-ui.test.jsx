// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReleasePlanControls, releasePlanStore } from './App.jsx';
import { RELEASE_PLAN_STORAGE_KEY, loadReleasePlans } from './lib/release-plan.js';
import { chooseOption } from './select-harness.js';

afterEach(cleanup);
beforeEach(() => { localStorage.removeItem(RELEASE_PLAN_STORAGE_KEY); releasePlanStore.set([]); });

const platform = { id: 'cults', name: 'Cults3D' };
const project = { title: 'Desk Dragon' };

describe('release plan controls', () => {
  it('creates a persisted reminder once mode and a future date are set', () => {
    render(<ReleasePlanControls platform={platform} project={project} />);
    chooseOption('Cults3D release plan', 'Remind me to publish');
    const future = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 16);
    fireEvent.change(screen.getByLabelText('Cults3D release date'), { target: { value: future } });
    fireEvent.change(screen.getByLabelText('Cults3D release note'), { target: { value: 'after Thangs exclusivity' } });
    const plans = loadReleasePlans(localStorage);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      platformId: 'cults', projectTitle: 'Desk Dragon', mode: 'remind',
      note: 'after Thangs exclusivity', status: 'pending',
    });
  });

  it('rejects a past date with a visible message and stores nothing', () => {
    render(<ReleasePlanControls platform={platform} project={project} />);
    chooseOption('Cults3D release plan', 'Publish automatically');
    fireEvent.change(screen.getByLabelText('Cults3D release date'), { target: { value: '2020-01-01T00:00' } });
    expect(screen.getByText(/future date and time/i)).toBeInTheDocument();
    expect(loadReleasePlans(localStorage)).toHaveLength(0);
  });

  it('marks a scheduled plan unattended and clears the flag when reverted to reminder', () => {
    window.modelprepDesktop = { isDesktop: true, syncReleasePlans: () => {} };
    try {
      render(<ReleasePlanControls platform={platform} project={project} />);
      chooseOption('Cults3D release plan', 'Publish automatically');
      const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);
      fireEvent.change(screen.getByLabelText('Cults3D release date'), { target: { value: future } });
      fireEvent.click(screen.getByLabelText('Cults3D unattended publish'));
      expect(loadReleasePlans(localStorage)[0].unattended).toBe(true);
      // switching to a reminder drops the unattended flag
      chooseOption('Cults3D release plan', 'Remind me to publish');
      expect(loadReleasePlans(localStorage)[0].unattended).toBe(false);
    } finally {
      delete window.modelprepDesktop;
    }
  });

  it('clears the stored plan when switched back to no plan', () => {
    render(<ReleasePlanControls platform={platform} project={project} />);
    chooseOption('Cults3D release plan', 'Remind me to publish');
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);
    fireEvent.change(screen.getByLabelText('Cults3D release date'), { target: { value: future } });
    expect(loadReleasePlans(localStorage)).toHaveLength(1);
    chooseOption('Cults3D release plan', 'No plan');
    expect(loadReleasePlans(localStorage)).toHaveLength(0);
  });
});
