// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { FileRow, PrintablesOptions } from './App.jsx';

beforeEach(() => {
  cleanup();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    ok: true,
    categories: [{ id: '36', name: 'Action Figures & Statues', level: 2, path: [{ name: '3D Models' }] }],
    licenses: [{ id: '3', name: 'CC BY-NC', isSelectable: true, freeModels: true }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
});

describe('Printables-specific options', () => {
  it('exposes summary, live taxonomy, authorship, flags, and both ZIP modes', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const { rerender } = render(<PrintablesOptions
      opts={{ summary: '', categoryId: '', licenseId: '', authorship: 'author', aiGenerated: null, zipMode: 'unzip' }}
      onUpdate={onUpdate}
    />);

    expect(await screen.findByRole('option', { name: /Action Figures/i })).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/short listing summary/i), 'Poseable dragon');
    expect(onUpdate).toHaveBeenCalledWith('summary', expect.any(String));
    expect(screen.getByLabelText(/Unpack into model files/i)).toBeChecked();
    expect(screen.getByLabelText(/Keep ZIP as Other file/i)).not.toBeChecked();
    expect(screen.getByLabelText('NSFW')).not.toBeChecked();
    expect(screen.getByLabelText(/Political content/i)).not.toBeChecked();

    rerender(<PrintablesOptions
      opts={{ summary: 'Poseable dragon', categoryId: '36', licenseId: '3', authorship: 'remix', remixParents: [], remixDescription: '', aiGenerated: true, zipMode: 'archive' }}
      onUpdate={onUpdate}
    />);
    expect(screen.getByText(/Original model URL or Printables ID/i)).toBeInTheDocument();
    expect(screen.getByText(/What did you change/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Keep ZIP as Other file/i)).toBeChecked();
  });

  it('offers folder and note controls for every Printables-supported file', async () => {
    const user = userEvent.setup();
    const onUpdatePrintables = vi.fn();
    render(<FileRow
      file={{
        id: 'file-1', name: 'source.step', size: 100, type: 'application/octet-stream',
        isProfile: false, isImage: false, printables: { folder: '', note: '' },
      }}
      onRemove={vi.fn()}
      onRename={vi.fn()}
      onUpdateMakerWorld={vi.fn()}
      onUpdatePrintables={onUpdatePrintables}
    />);

    const settings = screen.getByText(/Printables file settings/i).closest('details');
    await user.click(within(settings).getByText(/Printables file settings/i));
    await user.type(within(settings).getByPlaceholderText('parts/large'), 'parts');
    await user.type(within(settings).getByPlaceholderText(/Print this part twice/i), 'Two copies');
    expect(onUpdatePrintables).toHaveBeenCalledWith({ folder: expect.any(String) });
    expect(onUpdatePrintables).toHaveBeenCalledWith({ note: expect.any(String) });
  });
});
