// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App, {
  PLATFORMS,
  buildDemoProject,
  destinationEvidenceState,
  fileDestinationUsage,
  nativeCategoryLabel,
  nativeLicenseLabel,
} from './App.jsx';

function demoProject() {
  const images = [0, 1, 2].map((index) => ({
    id: `image-${index}`,
    dataUrl: 'data:image/png;base64,ZGVtbw==',
    naturalW: 1200,
    naturalH: 900,
    focal: { x: 0.5, y: 0.5 },
    alt: `Image ${index + 1}`,
  }));
  return buildDemoProject(images);
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  delete window.modelprepDesktop;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillText: vi.fn(), drawImage: vi.fn(),
    set fillStyle(_value) {}, set font(_value) {}, set textAlign(_value) {}, set textBaseline(_value) {},
  }));
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ZGVtbw==');
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline comparison test'))));
});

describe('platform comparison data', () => {
  it('shows the saved native category and licence instead of shared placeholders', () => {
    const project = demoProject();
    const printables = PLATFORMS.find((platform) => platform.id === 'printables');
    const creality = PLATFORMS.find((platform) => platform.id === 'creality');

    expect(nativeCategoryLabel(printables, project)).toBe('3D Printers › Test Models');
    expect(nativeLicenseLabel(printables, project)).toBe('CC BY-NC');
    expect(nativeCategoryLabel(creality, project)).toBe('3D Printers › Test Models');
    expect(nativeLicenseLabel(creality, project)).toMatch(/^CC BY-NC/);
  });

  it('keeps evidence separate from publish readiness', () => {
    const project = demoProject();
    const makerworld = PLATFORMS.find((platform) => platform.id === 'makerworld');
    const nexprint = PLATFORMS.find((platform) => platform.id === 'nexprint');

    expect(destinationEvidenceState(makerworld, project, true).label).toBe('Verified');
    expect(destinationEvidenceState(makerworld, project, false).label).toBe('Needs account');
    expect(destinationEvidenceState(nexprint, project, true).label).toBe('Unknown');
    expect(destinationEvidenceState(nexprint, { ...project, files: [] }, true).label).toBe('Needs file');
  });

  it('derives the file dependency view from the current platform routing', () => {
    const project = demoProject();
    const stl = project.files.find((file) => file.name.endsWith('.stl'));
    const usage = fileDestinationUsage(stl, project);

    expect(usage.map(({ platform }) => platform.id)).toEqual(expect.arrayContaining(['makerworld', 'printables', 'cults', 'creality', 'makeroad']));
    expect(usage.every(({ role }) => role !== 'not-sent')).toBe(true);
  });
});

describe('platform comparison workflow', () => {
  it('shows all ten mappings and expands the selected platform editor', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try demo/i }));
    await user.click(screen.getByRole('button', { name: /step 4: platforms/i }));

    const table = screen.getByRole('table', { name: /platform mapping comparison/i });
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(document.querySelector('[data-destination-row="nexprint"]')).toHaveTextContent(/Unknown/);
    expect(document.querySelector('[data-destination-row="creality"]')).toHaveTextContent(/Unknown/);

    await user.click(document.querySelector('[data-destination-row="printables"]'));
    expect(screen.getByTestId('selected-platform-editor')).toHaveAttribute('data-testid', 'selected-platform-editor');
    expect(within(screen.getByTestId('selected-platform-editor')).getByRole('heading', { name: 'Printables' })).toBeInTheDocument();
  });

  it('offers a read-only destination dependency view in Files', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try demo/i }));
    await user.click(screen.getByRole('button', { name: /step 1: files/i }));
    await user.click(screen.getByRole('button', { name: /used by destinations/i }));

    const view = screen.getByTestId('file-destination-view');
    expect(within(view).getAllByText('Used by destinations')).toHaveLength(2);
    expect(within(view).getAllByText('MakerWorld').length).toBeGreaterThan(0);
    expect(within(view).getByText(/modelprep-calibration-puck-S\.stl/i)).toBeInTheDocument();
  });

  it('uses five-step copy on Images, Platforms and Publish', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try demo/i }));

    await user.click(screen.getByRole('button', { name: /step 3: images/i }));
    expect(screen.getByRole('button', { name: /continue to platforms/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue to profiles/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: /step 4: platforms/i }));
    expect(screen.getByTestId('section-header')).toHaveTextContent('Step 4');

    await user.click(screen.getByRole('button', { name: /step 5: publish/i }));
    expect(screen.getByTestId('section-header')).toHaveTextContent('Step 5');
  }, 20_000);
});
