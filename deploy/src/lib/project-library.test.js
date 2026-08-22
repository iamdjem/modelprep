import { describe, expect, it } from 'vitest';
import {
  CURRENT_PROJECT_KEY, LEGACY_AUTOSAVE_HANDLED_KEY, LEGACY_AUTOSAVE_KEY, LIBRARY_KEY,
  autoProjectName, duePlansForOtherProjects, duplicateName, entryFromProject, entryHasContent,
  formatProjectDate, loadLibrary, migrateLegacyAutosave, newProjectId, readCurrentId, removeEntry,
  saveLibrary, upsertEntry, writeCurrentId,
} from './project-library.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

const AUG_21 = Date.UTC(2026, 7, 21, 12);

describe('naming', () => {
  it('uses a typed name, then the title, then the start date', () => {
    expect(autoProjectName({ name: 'Dragon v2', nameLocked: true, title: 'Desk Dragon' })).toBe('Dragon v2');
    expect(autoProjectName({ name: 'ignored', nameLocked: false, title: 'Desk Dragon' })).toBe('Desk Dragon');
    expect(autoProjectName({ title: '', createdAt: AUG_21 })).toBe(`Project ${formatProjectDate(AUG_21)}`);
  });

  it('formats the date day first', () => {
    expect(formatProjectDate(new Date(2026, 7, 21).getTime())).toBe('21 Aug 2026');
  });

  it('never hands out a duplicate name twice', () => {
    expect(duplicateName('Desk Dragon', [])).toBe('Copy of Desk Dragon');
    expect(duplicateName('Desk Dragon', ['Copy of Desk Dragon'])).toBe('Copy of Desk Dragon (2)');
    expect(duplicateName('Desk Dragon', ['copy of desk dragon', 'Copy of Desk Dragon (2)'])).toBe('Copy of Desk Dragon (3)');
  });

  it('gives every project a distinct id', () => {
    expect(newProjectId(1)).not.toBe(newProjectId(1));
  });
});

describe('library storage', () => {
  it('round-trips entries newest first and tracks the open one', () => {
    const storage = memoryStorage();
    const older = entryFromProject({ id: 'a', title: 'Older', files: [], images: [] }, { title: 'Older' }, {}, 100);
    const newer = entryFromProject({ id: 'b', title: 'Newer', files: [{}, {}], images: [{}] }, { title: 'Newer' }, { stepsDone: 2, stepCount: 5 }, 200);
    saveLibrary(storage, upsertEntry(upsertEntry([], older), newer));
    expect(loadLibrary(storage).map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(loadLibrary(storage)[0].summary).toEqual({ files: 2, images: 1, stepsDone: 2, stepCount: 5 });

    writeCurrentId(storage, 'b');
    expect(readCurrentId(storage)).toBe('b');
    saveLibrary(storage, removeEntry(loadLibrary(storage), 'b'));
    expect(loadLibrary(storage).map((entry) => entry.id)).toEqual(['a']);
  });

  it('replaces an entry with the same id instead of adding a second', () => {
    const first = entryFromProject({ id: 'a', title: 'One' }, {}, {}, 1);
    const second = entryFromProject({ id: 'a', title: 'Two' }, {}, {}, 2);
    const entries = upsertEntry(upsertEntry([], first), second);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Two');
  });

  it('survives garbage in storage', () => {
    const storage = memoryStorage();
    storage.setItem(LIBRARY_KEY, '{not json');
    expect(loadLibrary(storage)).toEqual([]);
    expect(loadLibrary(null)).toEqual([]);
  });

  it('knows an empty entry from one worth listing', () => {
    expect(entryHasContent(entryFromProject({ id: 'a' }, {}, {}, 1))).toBe(false);
    expect(entryHasContent(entryFromProject({ id: 'a', title: 'T' }, { title: 'T' }, {}, 1))).toBe(true);
    expect(entryHasContent(entryFromProject({ id: 'a', files: [{}] }, {}, {}, 1))).toBe(true);
  });
});

describe('legacy autosave migration', () => {
  it('moves the single slot into the library once and opens it', () => {
    const storage = memoryStorage();
    storage.setItem(LEGACY_AUTOSAVE_KEY, JSON.stringify({ name: 'Untitled Project', title: 'Night Release', description: 'd', tags: ['x'], platforms: {}, savedAt: AUG_21 }));
    storage.setItem(LEGACY_AUTOSAVE_HANDLED_KEY, 'whatever');

    const entry = migrateLegacyAutosave(storage, { id: 'migrated' });
    expect(entry.name).toBe('Night Release');
    expect(entry.nameLocked).toBe(false);
    expect(entry.legacyBinaryKey).toEqual({ name: 'Untitled Project', title: 'Night Release' });
    expect(readCurrentId(storage)).toBe('migrated');
    expect(storage.getItem(LEGACY_AUTOSAVE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_AUTOSAVE_HANDLED_KEY)).toBeNull();

    // Running again finds nothing: a deleted project cannot come back.
    expect(migrateLegacyAutosave(storage)).toBeNull();
    expect(loadLibrary(storage)).toHaveLength(1);
  });

  it('keeps a name the user had typed', () => {
    const storage = memoryStorage();
    storage.setItem(LEGACY_AUTOSAVE_KEY, JSON.stringify({ name: 'Client job', title: 'Bracket', savedAt: 1 }));
    const entry = migrateLegacyAutosave(storage, { id: 'm' });
    expect(entry.name).toBe('Client job');
    expect(entry.nameLocked).toBe(true);
  });

  it('ignores an empty slot but still clears it', () => {
    const storage = memoryStorage();
    storage.setItem(LEGACY_AUTOSAVE_KEY, JSON.stringify({ name: 'Untitled Project', title: '', platforms: {} }));
    expect(migrateLegacyAutosave(storage)).toBeNull();
    expect(storage.getItem(LEGACY_AUTOSAVE_KEY)).toBeNull();
    expect(storage.getItem(CURRENT_PROJECT_KEY)).toBeNull();
  });
});

describe('due schedules for other projects', () => {
  const entries = [
    { id: 'open', name: 'Open one', title: 'Open one' },
    { id: 'other', name: 'Other', title: 'Other' },
  ];
  const plan = (overrides) => ({ id: 'p', status: 'pending', mode: 'scheduled', dueAt: new Date(1000).toISOString(), platformId: 'printables', ...overrides });

  it('matches by project id, and by title for plans from before the library', () => {
    expect(duePlansForOtherProjects([plan({ projectId: 'other' })], entries, 'open', 2000)).toHaveLength(1);
    expect(duePlansForOtherProjects([plan({ projectTitle: 'Other' })], entries, 'open', 2000)[0].entry.id).toBe('other');
  });

  it('leaves the open project, reminders, future and finished plans alone', () => {
    expect(duePlansForOtherProjects([plan({ projectId: 'open' })], entries, 'open', 2000)).toEqual([]);
    expect(duePlansForOtherProjects([plan({ projectId: 'other', mode: 'remind' })], entries, 'open', 2000)).toEqual([]);
    expect(duePlansForOtherProjects([plan({ projectId: 'other' })], entries, 'open', 500)).toEqual([]);
    expect(duePlansForOtherProjects([plan({ projectId: 'other', status: 'done' })], entries, 'open', 2000)).toEqual([]);
    expect(duePlansForOtherProjects([plan({ projectId: 'deleted' })], entries, 'open', 2000)).toEqual([]);
  });
});
