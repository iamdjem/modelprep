// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { chooseOption, expectFieldValue, optionLabels } from './select-harness.js';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CrealityOptions } from './App.jsx';

describe('Creality-specific upload options', () => {
  it('exposes the captured action, source, category, license, and maturity fields', () => {
    render(<CrealityOptions
      opts={{ publication: 'private', modelSource: 1, categoryId: '1575', license: 'CC BY-NC', nsfw: false }}
      project={{ license: 'ccbync' }}
      onUpdate={vi.fn()}
    />);

    expectFieldValue(screen.getByLabelText(/batch action/i), 'private');
    expectFieldValue(screen.getByLabelText(/model source/i), '1');
    expectFieldValue(screen.getByLabelText(/category/i), '1575');
    expectFieldValue(screen.getByLabelText(/license/i), 'CC BY-NC');
    // The taxonomy is behind the trigger now, so open it to check the whole tree
    // reached the list: the selected leaf, a group from the far end of it, and
    // a child that only exists under its parent.
    const categories = optionLabels('Creality category').join('|');
    expect(categories).toMatch(/Board Games & Card Games/i);
    expect(categories).toMatch(/Medical & Health Equipment/i);
    expect(categories).toMatch(/SignForge/i);
    // The maturity rating is the shared NSFW toggle in Details now.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/up to 9 gallery images/i)).toBeInTheDocument();
  });
});
