// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NexprintOptions } from './App.jsx';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  delete window.modelprepDesktop;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    code: 0,
    data: [{
      id: 'home',
      name: 'Home & Decoration',
      children: [{ id: 'storage', name: 'Storage' }],
    }],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })));
});

describe('Nexprint-specific upload options', () => {
  it('exposes the live originality, license, disclosure, BOM, and category fields', async () => {
    render(<NexprintOptions
      opts={{
        publication: 'draft',
        originalityType: 2,
        sourceUrl: '',
        sourceModelId: '',
        categoryId: '',
        licenseType: 3,
        nsfw: false,
        aiGenerated: true,
        hasBom: true,
        bom: [{ materialName: 'PLA', materialNum: 1, materialRemark: 'Red' }],
        collectionIds: [],
        activityIds: [],
      }}
      project={{ license: 'ccbync' }}
      onUpdate={vi.fn()}
    />);

    expect(await screen.findByRole('option', { name: 'Home & Decoration › Storage' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Home & Decoration' })).not.toBeInTheDocument();
    expect(screen.getByText('Original URL')).toBeInTheDocument();
    expect(screen.getByText('Nexprint model ID (alternative)')).toBeInTheDocument();
    for (const license of [
      'CC BY', 'CC BY-SA', 'CC BY-NC', 'CC BY-NC-SA',
      'CC BY-ND', 'CC BY-NC-ND', 'CC0', 'Standard Digital File License',
    ]) {
      expect(screen.getByRole('option', { name: license })).toBeInTheDocument();
    }
    expect(screen.getByRole('checkbox', { name: /AI-generated content/i })).toBeChecked();
    expect(screen.getByDisplayValue('PLA')).toBeInTheDocument();
    expect(screen.getByText(/at least two images, including one real printed photo/i)).toBeInTheDocument();
  });
});
