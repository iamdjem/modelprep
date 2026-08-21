// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { optionLabels } from './select-harness.js';
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Nexprint-specific upload options', () => {
  it('exposes the live originality, license, disclosure, BOM, and category fields', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
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

    // The live taxonomy offers the leaf, and only the leaf: a parent on its own
    // is not a category you can publish into.
    await waitFor(() => expect(optionLabels(/category/i)).toContain('Home & Decoration › Storage'));
    expect(optionLabels(/category/i)).not.toContain('Home & Decoration');
    // The source URL moved to the shared provenance block in Details; only
    // the Nexprint-only model ID is still asked for here.
    expect(screen.queryByText('Original URL')).not.toBeInTheDocument();
    expect(screen.getByText('Nexprint model ID (instead of the source URL)')).toBeInTheDocument();
    const licences = optionLabels(/license/i);
    for (const license of [
      'CC BY', 'CC BY-SA', 'CC BY-NC', 'CC BY-NC-SA',
      'CC BY-ND', 'CC BY-NC-ND', 'CC0', 'Standard Digital File License',
    ]) {
      expect(licences).toContain(license);
    }
    // AI disclosure and NSFW are answered once in Details now.
    expect(screen.queryByRole('checkbox', { name: /AI-generated content/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^NSFW$/i })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('PLA')).toBeInTheDocument();
    expect(screen.getByText(/at least two images, including one real printed photo/i)).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
