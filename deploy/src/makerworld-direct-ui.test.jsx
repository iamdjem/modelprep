// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App.jsx';
import { addAccount } from './lib/accounts.js';
import { DESKTOP_MAKERWORLD_SECRET } from './lib/makerworld-auth.js';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    set fillStyle(_value) {},
    set font(_value) {},
    set textAlign(_value) {},
    set textBaseline(_value) {},
  }));
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ZGVtbw==');
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no web transport in desktop test'))));
});

describe('MakerWorld desktop real upload test', () => {
  it('loads real-capable sample data but keeps upload behind the explicit batch button', async () => {
    window.modelprepDesktop = {
      isDesktop: true,
      requestMakerWorld: vi.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok: true, rcUpload: false, uploadAllowed: true }),
      }),
      disconnectMakerWorld: vi.fn(),
    };
    addAccount('makerworld', {
      label: '@direct-test',
      secret: DESKTOP_MAKERWORLD_SECRET,
      status: 'connected',
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try demo/i }));
    await user.click(screen.getByRole('button', { name: /step 6: publish/i }));

    expect(screen.getAllByText('@direct-test').length).toBeGreaterThan(0);
    expect(screen.queryByText(/simulation only/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload sample to 1 ready destination/i })).toBeEnabled();
  });
});
