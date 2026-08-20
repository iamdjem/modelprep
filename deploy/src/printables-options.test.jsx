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
    // NSFW and the AI answer are shared fields in Details now; Printables'
    // political-content flag has no shared equivalent and stays here.
    expect(screen.queryByLabelText('NSFW')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/AI used/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Political content/i)).not.toBeChecked();
    expect(screen.getByText(/Connect Printables to check account-specific paid and Club eligibility/i)).toBeInTheDocument();

    rerender(<PrintablesOptions
      opts={{ summary: 'Poseable dragon', categoryId: '36', licenseId: '3', authorship: 'remix', remixParents: [], remixDescription: '', aiGenerated: true, zipMode: 'archive' }}
      onUpdate={onUpdate}
    />);
    // The Printables parent must be a Printables model, so it stays local.
    // "What did you change" is written once in Details.
    expect(screen.getByText(/Original model URL or Printables ID/i)).toBeInTheDocument();
    expect(screen.queryByText(/What did you change/i)).not.toBeInTheDocument();
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
    const note = within(settings).getByPlaceholderText(/Print this part twice/i);
    expect(note).toHaveAttribute('maxlength', '95');
    expect(within(settings).getByText(/folder names up to 60/i)).toBeInTheDocument();
    await user.type(note, 'Two copies');
    expect(onUpdatePrintables).toHaveBeenCalledWith({ folder: expect.any(String) });
    expect(onUpdatePrintables).toHaveBeenCalledWith({ note: expect.any(String) });
  });

  it('offers specialist metadata overrides for Printables G-code files', async () => {
    const user = userEvent.setup();
    const onUpdatePrintables = vi.fn();
    render(<FileRow
      file={{
        id: 'gcode-1', name: 'dragon.gcode', size: 100, type: 'text/plain',
        isProfile: false, isImage: false, printables: { folder: '', note: '' },
      }}
      onRemove={vi.fn()}
      onRename={vi.fn()}
      onUpdateMakerWorld={vi.fn()}
      onUpdatePrintables={onUpdatePrintables}
    />);

    const settings = screen.getByText(/Printables file settings/i).closest('details');
    await user.click(within(settings).getByText(/Printables file settings/i));
    await user.type(within(settings).getByLabelText(/Layer height/i), '0.2');
    await user.type(within(settings).getByLabelText(/Nozzle diameter/i), '0.4');
    await user.type(within(settings).getByLabelText(/Print duration/i), '1.5');
    await user.type(within(settings).getByLabelText(/Printed weight/i), '13');
    await user.click(within(settings).getByLabelText(/Exclude this G-code/i));

    expect(onUpdatePrintables).toHaveBeenCalledWith({ layerHeight: expect.any(String) });
    expect(onUpdatePrintables).toHaveBeenCalledWith({ nozzleDiameter: expect.any(String) });
    expect(onUpdatePrintables).toHaveBeenCalledWith({ printDuration: expect.any(String) });
    expect(onUpdatePrintables).toHaveBeenCalledWith({ weight: expect.any(String) });
    expect(onUpdatePrintables).toHaveBeenCalledWith({ excludeFromTotalSum: true });
  });
});
