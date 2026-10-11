// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App.jsx';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  delete window.modelprepDesktop;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillText: vi.fn(),
    set fillStyle(_value) {}, set font(_value) {}, set textAlign(_value) {}, set textBaseline(_value) {},
  }));
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ZGVtbw==');
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline files workspace test'))));
});

describe('Files publishing package workspace', () => {
  it('keeps selection, batch actions, preview, properties, and destination routing in one workspace', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Try demo' }));
    expect(await screen.findByRole('heading', { name: 'Publishing package' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Package contents' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /Inspector for/i })).toBeInTheDocument();

    const firstFile = screen.getAllByRole('checkbox', { name: /Select modelprep-calibration-puck/i })[0];
    await user.click(firstFile);
    expect(screen.getByRole('region', { name: 'Batch file actions' })).toHaveTextContent('1 selected');

    await user.click(screen.getByRole('tab', { name: 'Properties' }));
    expect(screen.getByText('Duplicate check')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Destinations' }));
    expect(screen.getByText(/Automatic routing follows the file type/i)).toBeInTheDocument();
    expect(screen.getAllByText('MakerWorld', { selector: 'span' }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Grid view' }));
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
  });
});
