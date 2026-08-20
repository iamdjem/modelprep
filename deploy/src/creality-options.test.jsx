// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
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

    expect(screen.getByLabelText(/batch action/i)).toHaveValue('private');
    expect(screen.getByLabelText(/model source/i)).toHaveValue('1');
    expect(screen.getByLabelText(/category/i)).toHaveValue('1575');
    expect(screen.getByText(/Board Games & Card Games/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/license/i)).toHaveValue('CC BY-NC');
    expect(screen.getByText(/Medical & Health Equipment/i)).toBeInTheDocument();
    expect(screen.getByText(/SignForge/i)).toBeInTheDocument();
    // The maturity rating is the shared NSFW toggle in Details now.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/up to 9 gallery images/i)).toBeInTheDocument();
  });
});
