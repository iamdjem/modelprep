// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MakerWorldOptions } from './App.jsx';
import { addAccount, getActive, removeAccount } from './lib/accounts.js';

const project = (fileName) => ({
  files: [{ id: 'file-1', name: fileName }],
  images: [{ id: 'cover', dataUrl: 'data:image/png;base64,eA==' }],
  coverImageId: 'cover',
});

beforeEach(() => { cleanup(); localStorage.clear(); });

describe('MakerWorld mode-specific options', () => {
  it('only offers CyberBrick on the regular 3MF path', () => {
    const { rerender } = render(<MakerWorldOptions opts={{ productMode: '3d' }} project={project('source.stl')} onUpdate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /CyberBrick/i })).not.toBeInTheDocument();
    rerender(<MakerWorldOptions opts={{ productMode: '3d' }} project={project('profile.3mf')} onUpdate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /CyberBrick/i })).toBeInTheDocument();
  });

  it('renders dedicated .lac profile controls and writes the profile name', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<MakerWorldOptions opts={{ productMode: 'laser-cut', laserMode: 'lac' }} project={project('project.lac')} onUpdate={onUpdate} />);
    expect(screen.getByText('Laser & Cut profile')).toBeInTheDocument();
    expect(screen.getByText('Primary Bambu Suite profile package')).toBeInTheDocument();
    const name = screen.getByPlaceholderText(/3mm plywood/i);
    await user.type(name, 'Birch profile');
    expect(onUpdate).toHaveBeenCalledWith('laserProfile', expect.objectContaining({ title: expect.stringContaining('e') }));
    expect(screen.getByRole('button', { name: /CyberBrick/i })).toBeInTheDocument();
  });

  it('hides CyberBrick when the connected MakerWorld account is not eligible', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, rcUpload: false, uploadAllowed: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const account = addAccount('makerworld', { label: 'ineligible-test', secret: 'token=test' });
    try {
      render(<MakerWorldOptions opts={{ productMode: '3d' }} project={project('profile.3mf')} onUpdate={vi.fn()} />);
      expect(await screen.findByText('CyberBrick upload is not enabled for this MakerWorld account.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /CyberBrick/i })).not.toBeInTheDocument();
    } finally {
      cleanup();
      removeAccount('makerworld', account.id || getActive('makerworld')?.id);
      globalThis.fetch = originalFetch;
    }
  });
});
