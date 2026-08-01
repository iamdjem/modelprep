// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App.jsx';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  delete window.modelprepDesktop;
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
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline layout test'))));
});

describe('shared section navigation layout', () => {
  it('keeps the brand compact and desktop actions on one intentional row', () => {
    render(<App />);

    expect(screen.getByTestId('top-header-layout')).toHaveClass('flex-col', 'xl:flex-row', 'xl:flex-nowrap');
    expect(screen.getByTestId('top-header-brand')).toHaveClass('xl:max-w-[360px]', '2xl:max-w-[520px]');
    expect(screen.getByTestId('top-header-actions')).toHaveClass('grid-cols-2', 'sm:flex', 'xl:flex-nowrap', 'xl:justify-end');
    expect(screen.getByTestId('modelprep-logo')).toHaveAttribute('src', '/modelprep-logo.svg');
    expect(screen.getByText(/^v0\.3$/i)).toHaveClass('whitespace-nowrap');
    expect(screen.getByTestId('visible-build-stamp')).toHaveTextContent(/Build f8b1e49 ·/i);
    expect(screen.getByTestId('visible-build-stamp')).toHaveClass('whitespace-nowrap');
  });

  it('fills the workspace and anchors Platforms navigation above the status bar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /step 5: platforms/i }));

    expect(screen.getByTestId('workspace-main')).toHaveClass('flex', 'flex-col');
    expect(screen.getByTestId('workspace-main')).toHaveClass('pt-4', 'sm:pt-5', 'lg:pt-5');
    expect(screen.getByTestId('workspace-main')).toHaveStyle({ paddingBottom: '0px' });
    expect(screen.getByTestId('section-content')).toHaveClass('flex-1', 'flex', 'flex-col');
    expect(screen.getByTestId('section-nav')).toHaveClass('sticky', 'bottom-8', 'mt-auto');
    expect(screen.getByTestId('status-bar')).toHaveClass('fixed', 'bottom-0');
    expect(screen.getByRole('button', { name: /continue to publish/i })).toBeInTheDocument();
  });

  it('restores the workspace to the top whenever the user changes steps', async () => {
    const user = userEvent.setup();
    render(<App />);
    const workspace = screen.getByTestId('workspace-main');
    workspace.scrollTop = 900;
    document.documentElement.scrollTop = 900;
    document.body.scrollTop = 900;

    await user.click(screen.getByRole('button', { name: /step 2: details/i }));

    expect(workspace.scrollTop).toBe(0);
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
    expect(workspace).toHaveFocus();
  });

  it('keeps every workflow section fluid instead of restoring the old 1280px cap', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /real upload test/i }));

    for (const step of ['files', 'details', 'images', 'profiles', 'platforms', 'publish']) {
      await user.click(screen.getByRole('button', { name: new RegExp(`step \\d: ${step}`, 'i') }));
      const shell = screen.getByTestId('section-content').firstElementChild;
      expect(shell).toHaveClass('w-full', 'min-w-0');
      expect(shell).not.toHaveClass('max-w-7xl');
    }
  });

  it('uses the compact responsive header on every workflow step', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /real upload test/i }));

    for (const step of ['files', 'details', 'images', 'profiles', 'platforms', 'publish']) {
      await user.click(screen.getByRole('button', { name: new RegExp(`step \\d: ${step}`, 'i') }));
      const header = screen.getByTestId('section-header');
      const layout = header.lastElementChild;
      const title = layout.firstElementChild;
      const subtitle = layout.lastElementChild;

      expect(header).toHaveClass('pb-3', 'sm:pb-4');
      expect(layout).toHaveClass('flex', 'flex-col', 'gap-1');
      expect(layout).not.toHaveClass('2xl:flex-row');
      expect(title).toHaveClass('text-[30px]', 'sm:text-[36px]', 'leading-none');
      expect(title).not.toHaveClass('mb-3');
      expect(subtitle).toHaveClass('w-full', 'text-[14px]', 'leading-5');
      expect(subtitle).not.toHaveClass('max-w-2xl');
      expect(subtitle).not.toHaveClass('whitespace-nowrap', 'truncate');
      expect(subtitle.textContent.length).toBeLessThanOrEqual(100);
    }
  });

  it('wraps platform card badges without squeezing them into the expand control', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /real upload test/i }));
    await user.click(screen.getByRole('button', { name: /step 5: platforms/i }));

    const metadata = screen.getByRole('heading', { name: 'MakerWorld' }).parentElement;
    const header = metadata.parentElement;
    const pills = metadata.querySelectorAll('.mp-pill');

    expect(header).toHaveClass('items-start', 'justify-between');
    expect(metadata).toHaveClass('flex-1', 'flex-wrap', 'gap-x-2', 'gap-y-1', 'min-w-0');
    expect(pills).toHaveLength(2);
    pills.forEach((pill) => expect(pill).toHaveClass('flex-shrink-0', 'whitespace-nowrap'));
  });

  it('stacks platform cards at compact desktop widths before adding wider columns', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /real upload test/i }));
    await user.click(screen.getByRole('button', { name: /step 5: platforms/i }));

    for (const heading of ['Direct publishing', 'Export & future connections']) {
      const grid = screen.getByRole('heading', { name: heading }).parentElement.parentElement.nextElementSibling;
      expect(grid).toHaveClass('grid-cols-1', 'xl:grid-cols-2', '2xl:grid-cols-3');
      expect(grid).not.toHaveClass('md:grid-cols-2', 'xl:grid-cols-3');
    }
  });

  it('collapses and restores the desktop project sidebar', async () => {
    const user = userEvent.setup();
    render(<App />);
    const sidebar = screen.getByTestId('project-sidebar');

    expect(sidebar).toHaveClass('lg:w-64');
    await user.click(screen.getByRole('button', { name: /collapse project steps/i }));
    expect(sidebar).toHaveClass('lg:w-20');
    expect(screen.getByRole('button', { name: /expand project steps/i })).toBeInTheDocument();
    expect(localStorage.getItem('modelprep.sidebarCollapsed')).toBe('true');

    await user.click(screen.getByRole('button', { name: /expand project steps/i }));
    expect(sidebar).toHaveClass('lg:w-64');
    expect(localStorage.getItem('modelprep.sidebarCollapsed')).toBe('false');
  });
});
