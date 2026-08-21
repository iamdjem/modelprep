// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseOption, expectFieldValue } from './select-harness.js';
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

    expectFieldValue(screen.getByLabelText(/batch action/i), 'draft');
    expectFieldValue(screen.getByLabelText(/model source/i), '2');
    expectFieldValue(screen.getByLabelText(/original work URL/i), 'https://example.com/original');
    expectFieldValue(screen.getByLabelText(/category/i), '104');
    expectFieldValue(screen.getByLabelText(/license/i), '4');
    expectFieldValue(screen.getByLabelText(/print profile title/i), 'A1 profile');
    expectFieldValue(screen.getByLabelText(/print profile description/i), '0.2 mm PLA');
    // AI assistance and NSFW are answered once in Details now.
    expect(screen.queryByText(/Created with AI assistance/i)).not.toBeInTheDocument();
    expect(screen.getByText(/This model uses MakerOnline Creative Kits/i)).toBeInTheDocument();
    expect(screen.getByText(/Sync to MakerOnline China/i)).toBeInTheDocument();
    expect(screen.getByText(/Exclusive model/i)).toBeInTheDocument();
    expect(screen.getByText(/Paid pricing is dormant/i)).toBeInTheDocument();
  });
});
