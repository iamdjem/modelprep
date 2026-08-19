// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App, { FILE_SORTS, duplicateFileIds, filterProjectFiles, findDuplicateGroups, groupProjectFiles, sortProjectFiles } from './App.jsx';

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

    expect(screen.getByTestId('top-header-layout')).toHaveClass('flex', 'flex-wrap', 'items-center', 'justify-between');
    expect(screen.getByTestId('top-header-brand')).toHaveClass('flex', 'items-center', 'min-w-0');
    expect(screen.getByTestId('top-header-actions')).toHaveClass('flex', 'flex-wrap', 'items-center');
    expect(screen.getByTestId('modelprep-logo')).toHaveAttribute('src', '/modelprep-logo.svg');
    expect(screen.getByText(/^v0\.3$/i)).toHaveClass('whitespace-nowrap');
    expect(screen.queryByTestId('visible-build-stamp')).not.toBeInTheDocument();
  });

  it('keeps the build stamp available in Settings → About', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /about/i }));

    expect(screen.getByTestId('visible-build-stamp')).toHaveTextContent(/^Build [0-9a-f]{7} · .+$/i);
  });

  it('fills the workspace and anchors Platforms navigation above the status bar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /step 5: platforms/i }));

    expect(screen.getByTestId('workspace-main')).toHaveClass('flex', 'flex-col');
    expect(screen.getByTestId('workspace-main')).toHaveClass('pt-4', 'sm:pt-5', 'lg:pt-5');
    expect(screen.getByTestId('workspace-main')).toHaveStyle({ paddingBottom: '0px' });
    expect(screen.getByTestId('section-content')).toHaveClass('flex-1', 'flex', 'flex-col');
    expect(screen.getByTestId('section-nav')).toHaveClass('sticky', 'bottom-0', 'mt-auto');
    // The old fixed bottom bar moved into the sidebar footer.
    expect(screen.getByTestId('status-bar')).toHaveClass('border-t');
    expect(screen.getByTestId('project-sidebar').contains(screen.getByTestId('status-bar'))).toBe(true);
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
    await user.click(screen.getByRole('button', { name: /try demo/i }));

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
    await user.click(screen.getByRole('button', { name: /try demo/i }));

    for (const step of ['files', 'details', 'images', 'profiles', 'platforms', 'publish']) {
      await user.click(screen.getByRole('button', { name: new RegExp(`step \\d: ${step}`, 'i') }));
      const header = screen.getByTestId('section-header');
      const layout = header.lastElementChild;
      const title = layout.firstElementChild;
      const subtitle = layout.lastElementChild;

      expect(header).toHaveClass('pb-4', 'sm:pb-5');
      expect(layout).toHaveClass('flex', 'flex-col', 'gap-1');
      expect(layout).not.toHaveClass('2xl:flex-row');
      expect(title).toHaveClass('text-[22px]', 'sm:text-[26px]');
      expect(title).not.toHaveClass('mb-3');
      expect(subtitle).toHaveClass('w-full', 'text-sm', 'leading-5');
      expect(subtitle).not.toHaveClass('max-w-2xl');
      expect(subtitle).not.toHaveClass('whitespace-nowrap', 'truncate');
      expect(subtitle.textContent.length).toBeLessThanOrEqual(100);
    }
  });

  it('keeps the toggle, name and status on one row with the description beneath', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try demo/i }));
    await user.click(screen.getByRole('button', { name: /step 5: platforms/i }));

    const heading = screen.getByRole('heading', { name: 'MakerWorld' });
    const header = screen.getAllByTestId('platform-card-header')[0];
    const toggle = screen.getByRole('switch', { name: /disable makerworld/i });

    // Toggle, mark, name and status pill share one centred row.
    expect(header).toHaveClass('flex', 'items-center');
    expect(header.contains(toggle)).toBe(true);
    expect(header.contains(heading)).toBe(true);
    const pills = header.querySelectorAll('.mp-pill');
    expect(pills).toHaveLength(1);
    pills.forEach((pill) => expect(pill).toHaveClass('flex-shrink-0', 'whitespace-nowrap'));

    // The description sits after the row, not indented inside the name column.
    const description = header.nextElementSibling;
    expect(description.tagName).toBe('P');
    expect(description).toHaveTextContent(/Bambu Lab/);
    // The internal description format is no longer surfaced to creators.
    expect(description).not.toHaveTextContent(/\bhtml\b/i);
  });

  it('stacks platform cards at compact desktop widths before adding wider columns', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try demo/i }));
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

describe('file list grouping', () => {
  const f = (id, props) => ({ id, name: `${id}`, ...props });

  it('groups files by role and drops empty groups', () => {
    const groups = groupProjectFiles([
      f('a.stl', { isModel: true }),
      f('b.3mf', { isModel: true, isProfile: true }),
      f('c.jpg', { isImage: true }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['models', 'profiles', 'media']);
    expect(groups[0].files.map((x) => x.id)).toEqual(['a.stl']);
    expect(groups[1].files.map((x) => x.id)).toEqual(['b.3mf']);
  });

  it('never lists a file twice and never loses one', () => {
    const files = [
      f('a.stl', { isModel: true }),
      f('b.3mf', { isModel: true, isProfile: true }),
      f('c.jpg', { isImage: true }),
      f('readme.md', {}),
    ];
    const groups = groupProjectFiles(files);
    const flat = groups.flatMap((g) => g.files.map((x) => x.id));
    expect(new Set(flat).size).toBe(flat.length);
    expect(flat.sort()).toEqual(files.map((x) => x.id).sort());
  });

  it('puts anything unrecognised in its own group rather than hiding it', () => {
    const groups = groupProjectFiles([f('notes.txt', {})]);
    expect(groups.map((g) => g.key)).toEqual(['other']);
  });

  it('returns nothing for an empty project', () => {
    expect(groupProjectFiles([])).toEqual([]);
    expect(groupProjectFiles(undefined)).toEqual([]);
  });
});

describe('file search', () => {
  const f = (name, props = {}) => ({ id: name, name, ...props });
  const files = [
    f('Ram.stl', { isModel: true }),
    f('ram test app CC.3mf', { isModel: true, isProfile: true, threemf: { slicer: 'crealityprint' } }),
    f('ram test app.3mf', { isModel: true, isProfile: true, threemf: { slicer: 'bambu' } }),
    f('8.JPG', { isImage: true }),
  ];
  const names = (q) => filterProjectFiles(files, q).map((x) => x.name);

  it('returns the original list untouched for a blank query', () => {
    expect(filterProjectFiles(files, '')).toBe(files);
    expect(filterProjectFiles(files, '   ')).toBe(files);
  });

  it('matches on name and extension, case-insensitively', () => {
    expect(names('ram')).toHaveLength(3);
    expect(names('.stl')).toEqual(['Ram.stl']);
    expect(names('JPG')).toEqual(['8.JPG']);
    expect(names('jpg')).toEqual(['8.JPG']);
  });

  it('matches on the detected slicer, which is not in the filename', () => {
    expect(names('bambu')).toEqual(['ram test app.3mf']);
    expect(names('creality')).toEqual(['ram test app CC.3mf']);
  });

  it('returns nothing rather than everything when there is no match', () => {
    expect(names('nothing-matches-this')).toEqual([]);
  });

  it('survives a missing or malformed file list', () => {
    expect(filterProjectFiles(undefined, 'ram')).toEqual([]);
    expect(filterProjectFiles([{}], 'ram')).toEqual([]);
  });
});

describe('duplicate detection', () => {
  const f = (id, name, size) => ({ id, name, size });

  it('groups files that share a type and a byte size', () => {
    const groups = findDuplicateGroups([
      f('a', 'dragon.stl', 1000),
      f('b', 'dragon-copy.stl', 1000),
      f('c', 'other.stl', 2000),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('does not call different types duplicates just because sizes match', () => {
    expect(findDuplicateGroups([f('a', 'x.stl', 1000), f('b', 'x.3mf', 1000)])).toEqual([]);
  });

  it('ignores files with no size rather than grouping them all together', () => {
    expect(findDuplicateGroups([f('a', 'x.stl', 0), f('b', 'y.stl', 0)])).toEqual([]);
    expect(findDuplicateGroups([f('a', 'x.stl'), f('b', 'y.stl')])).toEqual([]);
  });

  it('reports every id in a duplicate set, so each row can be marked', () => {
    const ids = duplicateFileIds([f('a', 'x.stl', 5), f('b', 'y.stl', 5), f('c', 'z.stl', 9)]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('finds nothing in a clean project', () => {
    expect(findDuplicateGroups([f('a', 'x.stl', 1), f('b', 'y.stl', 2)])).toEqual([]);
    expect(findDuplicateGroups([])).toEqual([]);
    expect(duplicateFileIds(undefined).size).toBe(0);
  });
});

describe('file sorting', () => {
  const f = (name, size) => ({ id: name, name, size });
  const files = [f('b.stl', 300), f('a10.stl', 100), f('a2.3mf', 200)];

  it('leaves import order alone by default, without copying the array', () => {
    expect(sortProjectFiles(files, 'added')).toBe(files);
  });

  it('sorts names the way a file manager does, so a10 follows a2', () => {
    expect(sortProjectFiles(files, 'name').map((x) => x.name)).toEqual(['a2.3mf', 'a10.stl', 'b.stl']);
  });

  it('sorts by size, largest first, which is what you look for when trimming', () => {
    expect(sortProjectFiles(files, 'size').map((x) => x.size)).toEqual([300, 200, 100]);
  });

  it('groups by type so profiles sit together', () => {
    expect(sortProjectFiles(files, 'type').map((x) => x.name)).toEqual(['a2.3mf', 'a10.stl', 'b.stl']);
  });

  it('never mutates the caller array', () => {
    const original = [...files];
    sortProjectFiles(files, 'size');
    expect(files).toEqual(original);
  });

  it('falls back to the given order for an unknown sort key', () => {
    expect(sortProjectFiles(files, 'nonsense')).toBe(files);
    expect(Object.keys(FILE_SORTS)).toContain('added');
  });
});
