// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App, { MakerWorldOptions, CultsOptions } from './App.jsx';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))));
});

describe('clearing a subsection', () => {
  it('offers Clear only once a section holds a choice, and empties it in one patch', () => {
    const onUpdate = vi.fn();
    const base = { productMode: '3d', modelSource: 'original', boms: { kits: [], filaments: [], materials: [] }, otherParts: [] };
    const { rerender } = render(<MakerWorldOptions opts={base} project={{ files: [], images: [] }} onUpdate={onUpdate} />);
    expect(screen.queryByRole('button', { name: /^clear$/i })).toBeNull();

    rerender(<MakerWorldOptions opts={{ ...base, otherParts: [{ name: 'M3 screw', quantity: 4, note: '' }] }} project={{ files: [], images: [] }} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(onUpdate).toHaveBeenCalledWith({ boms: { kits: [], filaments: [], materials: [] }, otherParts: [] });
  });
});

describe('required marks', () => {
  it('stars the fields a platform rejects without, inside that platform only', () => {
    render(<App />);
    // Outside any platform panel a bare options component has no scope, so no marks.
    cleanup();
    render(<CultsOptions opts={{}} onUpdate={() => {}} />);
    expect(screen.queryByLabelText('required')).toBeNull();
    // The literal "(required)" suffix is still stripped, so the label reads clean.
    expect(screen.getByText('Cults3D category')).toBeInTheDocument();
  });

  it('stars Title and Category on Details without overstating Description', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /step 2: details/i }));
    const marks = screen.getAllByLabelText('required').map((mark) => mark.parentElement.textContent.replace('*', '').trim());
    expect(marks).toEqual(expect.arrayContaining(['Title', 'Category']));
    expect(marks).not.toContain('Description');
  });
});

describe('Cults audited options', () => {
  it('shows open pricing and offline visibility', () => {
    render(<CultsOptions opts={{ pricing: 'open_priced', free: false, openPrice: 2.5, visibility: 'offline' }} onUpdate={() => {}} />);
    expect(screen.getByLabelText('Cults3D open price minimum')).toHaveValue(2.5);
    expect(screen.getByRole('radio', { name: 'Offline' })).toBeChecked();
  });
});

describe('clearing Details', () => {
  it('needs two presses and then empties the listing', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /step 2: details/i }));
    const title = screen.getByPlaceholderText(/articulating desk dragon/i);
    expect(screen.getByRole('button', { name: /clear details/i })).toBeDisabled();
    await user.type(title, 'Bracket');
    const clear = screen.getByRole('button', { name: /clear details/i });
    await user.click(clear);
    expect(title).toHaveValue('Bracket');
    await user.click(screen.getByRole('button', { name: /press again to clear/i }));
    expect(title).toHaveValue('');
  });
});
