// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MakerOnlineOptions } from './App.jsx';
import { CONNECTABLE, getAccounts, removeAccount } from './lib/accounts.js';

beforeEach(() => {
  cleanup();
  for (const platform of CONNECTABLE) {
    for (const account of getAccounts(platform)) removeAccount(platform, account.id);
  }
  localStorage.clear();
  delete window.modelprepDesktop;
});

describe('MakerOnline-specific upload options', () => {
  it('exposes every captured conditional upload branch', () => {
    render(<MakerOnlineOptions
      opts={{
        publication: 'draft', source: 2, originalUrl: 'https://example.com/original',
        categoryId: '104', license: 4, permission: 2, printMethod: 3,
        aiHelp: true, nsfw: false, includePrintProfile: true,
        printTitle: 'A1 profile', printDescription: '0.2 mm PLA',
        relatedKits: true, storeKitIds: [], syncChina: false, exclusive: false,
      }}
      project={{ title: 'Dragon', license: 'ccbync', profiles: [] }}
      onUpdate={vi.fn()}
    />);

    expect(screen.getByLabelText(/batch action/i)).toHaveValue('draft');
    expect(screen.getByLabelText(/model source/i)).toHaveValue('2');
    expect(screen.getByLabelText(/original work URL/i)).toHaveValue('https://example.com/original');
    expect(screen.getByLabelText(/category/i)).toHaveValue('104');
    expect(screen.getByLabelText(/license/i)).toHaveValue('4');
    expect(screen.getByLabelText(/print profile title/i)).toHaveValue('A1 profile');
    expect(screen.getByLabelText(/print profile description/i)).toHaveValue('0.2 mm PLA');
    // AI assistance and NSFW are answered once in Details now.
    expect(screen.queryByText(/Created with AI assistance/i)).not.toBeInTheDocument();
    expect(screen.getByText(/This model uses MakerOnline Creative Kits/i)).toBeInTheDocument();
    expect(screen.getByText(/Sync to MakerOnline China/i)).toBeInTheDocument();
    expect(screen.getByText(/Exclusive model/i)).toBeInTheDocument();
    expect(screen.getByText(/Paid pricing is dormant/i)).toBeInTheDocument();
  });
});
