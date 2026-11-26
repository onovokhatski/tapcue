import type { Project } from '@tapcue/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Loaded, ProjectApi, Saved } from '../lib/projectApi';
import { demoProject } from '../test/demoProject';
import { errorEntry, sentEntry } from '../test/logEntries';
import {
  canRedo,
  canUndo,
  createEditorStore,
  GROUP_QUIET_MS,
  HISTORY_LIMIT,
  SAVE_DELAY_MS,
} from './editorStore';

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** The server's side: every load and save waits until the test answers it. */
function fakeServer() {
  const loads: ReturnType<typeof deferred<Loaded>>[] = [];
  const saves: {
    project: Project;
    basedOn: number | null;
    answer: ReturnType<typeof deferred<Saved>>;
  }[] = [];
  const api: ProjectApi = {
    load: () => {
      const d = deferred<Loaded>();
      loads.push(d);
      return d.promise;
    },
    save: (project, basedOn) => {
      const answer = deferred<Saved>();
      saves.push({ project, basedOn, answer });
      return answer.promise;
    },
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    importArchive: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    quitServer: () => Promise.resolve(false),
  };
  return { api, loads, saves };
}

/** Lets promise callbacks run, without moving the clock. */
const settle = () => vi.advanceTimersByTimeAsync(0);
const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const rename = (name: string) => (project: Project) => ({ ...project, name });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** A store with the demo stand loaded at revision 1. */
async function loaded() {
  const server = fakeServer();
  const store = createEditorStore(server.api);
  store.getState().start();
  server.loads[0]!.resolve({ revision: 1, project: demoProject() });
  await settle();
  return { store, server, api: server.api, state: () => store.getState() };
}

describe('editor store', () => {
  describe('loading', () => {
    it('loads the project and selects its first page', async () => {
      const { state } = await loaded();
      expect(state().load).toBe('ready');
      expect(state().project?.name).toBe('Demo stand');
      expect(state().revision).toBe(1);
      expect(state().selection).toEqual({ pageId: 'p_home00', hotspotIds: [] });
      expect(state().save).toEqual({ state: 'saved' });
    });

    it('says when the first load fails, and tries again once connected', async () => {
      const server = fakeServer();
      const store = createEditorStore(server.api);
      store.getState().start();
      server.loads[0]!.reject(new TypeError('Failed to fetch'));
      await settle();
      expect(store.getState().load).toBe('failed');

      store.getState().connected();
      server.loads[1]!.resolve({ revision: 1, project: demoProject() });
      await settle();
      expect(store.getState().load).toBe('ready');
    });
  });

  describe('changes and auto-save (spec ED-5, ADR 0011)', () => {
    it('applies a change at once and saves it after the quiet time', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      expect(state().project?.name).toBe('One');
      expect(state().save).toEqual({ state: 'saving' });
      await wait(SAVE_DELAY_MS - 1);
      expect(server.saves).toHaveLength(0);
      await wait(1);
      expect(server.saves.map((s) => s.project.name)).toEqual(['One']);
    });

    it('waits 500 ms after the last change', () => {
      expect(SAVE_DELAY_MS).toBe(500);
    });

    it('saves several quick changes once, with the newest project', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(300);
      state().change(rename('Two'));
      await wait(300);
      state().change(rename('Three'));
      await wait(SAVE_DELAY_MS);
      expect(server.saves.map((s) => s.project.name)).toEqual(['Three']);
    });

    it('says Saved and takes the new revision when the server has it', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await settle();
      expect(state().save).toEqual({ state: 'saved' });
      expect(state().revision).toBe(2);
    });

    it('sends one save at a time; a change during a save is sent right after it', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      state().change(rename('Two'));
      await wait(SAVE_DELAY_MS); // the quiet time is over, but the first save is still out
      expect(server.saves).toHaveLength(1);

      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await settle();
      expect(server.saves.map((s) => s.project.name)).toEqual(['One', 'Two']);
      expect(state().save).toEqual({ state: 'saving' });

      server.saves[1]!.answer.resolve({ ok: true, revision: 3 });
      await settle();
      expect(state().save).toEqual({ state: 'saved' });
      expect(state().revision).toBe(3);
      expect(server.saves).toHaveLength(2);
    });

    it('does not say Saved while a newer change still waits for its quiet time', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      state().change(rename('Two'));
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await settle();
      expect(state().save).toEqual({ state: 'saving' });
      expect(server.saves).toHaveLength(1);
      await wait(SAVE_DELAY_MS);
      expect(server.saves.map((s) => s.project.name)).toEqual(['One', 'Two']);
    });

    it('saves nothing when an operation changes nothing', async () => {
      const { state, server } = await loaded();
      state().change((project) => project);
      expect(state().save).toEqual({ state: 'saved' });
      await wait(SAVE_DELAY_MS);
      expect(server.saves).toHaveLength(0);
    });

    it('moves the selection off a page the change deleted', async () => {
      const { state } = await loaded();
      state().select({ pageId: 'p_about0', hotspotIds: [] });
      state().change((project) => ({
        ...project,
        pages: project.pages.filter((page) => page.id !== 'p_about0'),
      }));
      expect(state().selection).toEqual({ pageId: 'p_home00', hotspotIds: [] });
    });

    it('never changes the project it was given: an operation returns a new one', async () => {
      const { state } = await loaded();
      const before = state().project;
      const copy = JSON.stringify(before);
      state().change(rename('One'));
      expect(state().project).not.toBe(before);
      expect(JSON.stringify(before)).toBe(copy);
    });
  });

  describe('when another project was opened on the server (ADR 0021)', () => {
    it('names the revision each save is based on', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await settle();
      state().change(rename('Two'));
      await wait(SAVE_DELAY_MS);
      expect(server.saves.map((s) => s.basedOn)).toEqual([1, 2]);
    });

    it('drops a refused stale copy and the changes made since, and shows the open project', async () => {
      const { state, server } = await loaded();
      state().change(rename('Old stand edit'));
      await wait(SAVE_DELAY_MS);
      state().change(rename('Made during the save'));
      server.saves[0]!.answer.resolve({
        ok: false,
        reason: 'Another project was opened on the server.',
        errors: [],
        stale: true,
      });
      await settle();
      server.loads[1]!.resolve({ revision: 5, project: { ...demoProject(), name: 'Hall B' } });
      await settle();

      expect(state().project?.name).toBe('Hall B');
      expect(state().revision).toBe(5);
      expect(state().save).toEqual({ state: 'saved' });
      await wait(SAVE_DELAY_MS * 2);
      expect(server.saves).toHaveLength(1); // nothing of the old stand is sent again
    });
  });

  describe('when a save does not go through (spec ED-7, frames E2, E3)', () => {
    it('shows the server refusal with its field errors, and saves again on the next change', async () => {
      const { state, server } = await loaded();
      state().change(rename(''));
      await wait(SAVE_DELAY_MS);
      const errors = [{ path: 'name', message: 'Expected a name' }];
      server.saves[0]!.answer.resolve({
        ok: false,
        reason: 'The project has invalid values.',
        errors,
      });
      await settle();
      expect(state().save).toEqual({
        state: 'error',
        reason: 'The project has invalid values.',
        errors,
      });
      expect(state().project?.name).toBe(''); // kept in the editor, to be fixed

      state().change(rename('Fixed'));
      await wait(SAVE_DELAY_MS);
      expect(server.saves.map((s) => s.project.name)).toEqual(['', 'Fixed']);
    });

    it('saves again at once on "Retry now"', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({ ok: false, reason: 'Disk full', errors: [] });
      await settle();
      state().retry();
      await settle();
      expect(server.saves).toHaveLength(2);
    });

    it('keeps the changes as unsaved when the server cannot be reached, and saves on reconnect', async () => {
      const { state, server } = await loaded();
      state().change(rename('Offline edit'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.reject(new TypeError('Failed to fetch'));
      await settle();
      expect(state().save).toEqual({ state: 'unsaved' });
      expect(state().project?.name).toBe('Offline edit');

      state().connected();
      await settle();
      expect(server.saves.map((s) => s.project.name)).toEqual(['Offline edit', 'Offline edit']);
    });

    it('also saves a refused project again on reconnect', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({ ok: false, reason: 'Disk full', errors: [] });
      await settle();
      state().connected();
      await settle();
      expect(server.saves).toHaveLength(2);
    });
  });

  describe('the clipboard (spec ED-17)', () => {
    const hotspotsOf = (project: Project | null, pageId: string) =>
      project!.pages.find((p) => p.id === pageId)!.hotspots;

    it('copies the selection as it is, and pastes it on another page, selecting the copies', async () => {
      const { state } = await loaded();
      expect(state().clipboard).toBeNull();
      state().copy(); // nothing selected: nothing copied
      expect(state().clipboard).toBeNull();
      state().select({ pageId: 'p_proda0', hotspotIds: ['h_aback0'] });
      state().copy();
      expect(state().clipboard?.pageId).toBe('p_proda0');
      // Later edits to the original do not change what is pasted.
      state().change((p) => ({
        ...p,
        pages: p.pages.map((page) => ({
          ...page,
          hotspots: page.hotspots.map((h) => (h.id === 'h_aback0' ? { ...h, x: 999 } : h)),
        })),
      }));
      state().select({ pageId: 'p_about0', hotspotIds: [] });
      state().paste();
      const pasted = hotspotsOf(state().project, 'p_about0').at(-1)!;
      expect(pasted.name).toBe('Back 2');
      expect(pasted.x).toBe(120); // where Back was when copied, not 999
      expect(state().selection).toEqual({ pageId: 'p_about0', hotspotIds: [pasted.id] });
      expect(state().save).toEqual({ state: 'saving' });
      // The clipboard stays for more pastes.
      state().paste();
      expect(hotspotsOf(state().project, 'p_about0').at(-1)!.name).toBe('Back 3');
    });

    it('pastes nothing without a clipboard', async () => {
      const { state } = await loaded();
      const project = state().project;
      state().paste();
      expect(state().project).toBe(project);
    });

    it('is cleared when this editor opens another project', async () => {
      const { state } = await loaded();
      state().select({ pageId: 'p_home00', hotspotIds: ['h_carda0'] });
      state().copy();
      state().projectOpened(7);
      expect(state().clipboard).toBeNull();
    });

    it('is cleared when a save finds another project open on the server', async () => {
      const { state, server } = await loaded();
      state().select({ pageId: 'p_home00', hotspotIds: ['h_carda0'] });
      state().copy();
      state().change(rename('Old stand edit'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({
        ok: false,
        reason: 'Another project was opened on the server.',
        errors: [],
        stale: true,
      });
      await settle();
      expect(state().clipboard).toBeNull();
    });
  });

  describe('the selection (spec ED-16)', () => {
    it('keeps several hotspots in page order, and only those on the page', async () => {
      const { state } = await loaded();
      state().select({ pageId: 'p_home00', hotspotIds: ['h_cardc0', 'h_aplay0', 'h_carda0'] });
      expect(state().selection).toEqual({
        pageId: 'p_home00',
        hotspotIds: ['h_carda0', 'h_cardc0'],
      });
    });

    it('lets a deleted hotspot go and keeps the rest selected', async () => {
      const { state } = await loaded();
      state().select({ pageId: 'p_home00', hotspotIds: ['h_carda0', 'h_cardb0'] });
      const selection = state().selection;
      state().change((p) => ({ ...p, name: 'Renamed' }));
      // Nothing about the selection changed: the same object, so nothing draws again for it.
      expect(state().selection).toBe(selection);
      state().change((p) => ({
        ...p,
        pages: p.pages.map((page, i) =>
          i === 0 ? { ...page, hotspots: page.hotspots.filter((h) => h.id !== 'h_carda0') } : page,
        ),
      }));
      expect(state().selection).toEqual({ pageId: 'p_home00', hotspotIds: ['h_cardb0'] });
    });
  });

  describe('saves by others (architecture §6)', () => {
    it('loads a project another editor saved, and keeps the selection when it still exists', async () => {
      const { state, server } = await loaded();
      state().select({ pageId: 'p_proda0', hotspotIds: ['h_anext0'] });
      state().projectUpdated(2);
      server.loads[1]!.resolve({
        revision: 2,
        project: { ...demoProject(), name: 'From elsewhere' },
      });
      await settle();
      expect(state().project?.name).toBe('From elsewhere');
      expect(state().revision).toBe(2);
      expect(state().selection).toEqual({ pageId: 'p_proda0', hotspotIds: ['h_anext0'] });
    });

    it('selects the first page when the selected one was deleted elsewhere', async () => {
      const { state, server } = await loaded();
      state().select({ pageId: 'p_about0', hotspotIds: [] });
      state().projectUpdated(2);
      const project = demoProject();
      project.pages = project.pages.filter((page) => page.id !== 'p_about0');
      server.loads[1]!.resolve({ revision: 2, project });
      await settle();
      expect(state().selection).toEqual({ pageId: 'p_home00', hotspotIds: [] });
    });

    it('ignores the message about its own save', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      // The server announces the save before its answer arrives.
      state().projectUpdated(2);
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await settle();
      state().projectUpdated(2); // or after it
      expect(server.loads).toHaveLength(1);
      expect(state().project?.name).toBe('One');
    });

    it('keeps its own changes when another save is announced: the last save wins', async () => {
      const { state, server } = await loaded();
      state().change(rename('Mine'));
      state().projectUpdated(5);
      expect(server.loads).toHaveLength(1);
    });

    it('drops a loaded project when a change was made while it was loading', async () => {
      const { state, server } = await loaded();
      state().projectUpdated(2);
      state().change(rename('Mine'));
      server.loads[1]!.resolve({ revision: 2, project: { ...demoProject(), name: 'Theirs' } });
      await settle();
      expect(state().project?.name).toBe('Mine');
    });

    it('checks for saves made while it was disconnected, and keeps its copy if there were none', async () => {
      const { state, server } = await loaded();
      const before = state().project;
      state().connected();
      server.loads[1]!.resolve({ revision: 1, project: demoProject() });
      await settle();
      expect(state().project).toBe(before);
    });
  });

  describe('command log (spec ED-6)', () => {
    it('keeps the entries the server sends, newest first, and clears them', async () => {
      const { state } = await loaded();
      state().logged(sentEntry);
      state().logged(errorEntry);
      state().logged(sentEntry); // the same entry again is not shown twice
      expect(state().log.map((e) => e.seq)).toEqual([2, 1]);
      state().clearLog();
      expect(state().log).toEqual([]);
    });
  });

  describe('connection and test sends (spec ED-7, ACT-4)', () => {
    it('keeps the connection status', async () => {
      const { state } = await loaded();
      expect(state().connection).toBe('connecting');
      state().setConnection('open');
      expect(state().connection).toBe('open');
    });

    it('has nothing to save now when nothing is waiting', async () => {
      const { state, server } = await loaded();
      await expect(state().saveNow()).resolves.toBe(true);
      expect(server.saves).toHaveLength(0);
    });

    it('saves a waiting change at once, without the quiet time, and says whether it worked', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      const saved = state().saveNow();
      await settle();
      expect(server.saves).toHaveLength(1); // no 500 ms wait
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await wait(40);
      await expect(saved).resolves.toBe(true);

      state().change(rename('Two'));
      const failed = state().saveNow();
      await settle();
      server.saves[1]!.answer.resolve({ ok: false, reason: 'Disk full', errors: [] });
      await wait(40);
      await expect(failed).resolves.toBe(false);
    });

    it('saves first, then sends the test from the server', async () => {
      const { state, server, api } = await loaded();
      const testSend = vi.spyOn(api, 'testSend').mockResolvedValue({ ok: true, entry: sentEntry });
      state().change(rename('One'));
      const answer = state().testSend('p_home00', 'h_carda0');
      await settle();
      expect(testSend).not.toHaveBeenCalled(); // not before the save is done
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await wait(40);
      await expect(answer).resolves.toEqual({ ok: true, entry: sentEntry });
      expect(testSend).toHaveBeenCalledWith('p_home00', 'h_carda0');
    });

    it('sends nothing when the save fails, and says why', async () => {
      const { state, server, api } = await loaded();
      const testSend = vi.spyOn(api, 'testSend');
      state().change(rename('One'));
      const answer = state().testSend('p_home00', 'h_carda0');
      await settle();
      server.saves[0]!.answer.reject(new TypeError('Failed to fetch'));
      await wait(40);
      await expect(answer).resolves.toEqual({
        ok: false,
        reason: 'Not sent: the latest changes are not saved yet.',
      });
      expect(testSend).not.toHaveBeenCalled();
    });

    it('says so when the server cannot be reached for the test', async () => {
      const { state, api } = await loaded();
      vi.spyOn(api, 'testSend').mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(state().testSend('p_home00', 'h_carda0')).resolves.toEqual({
        ok: false,
        reason: 'Cannot reach the server.',
      });
    });
  });

  describe('demo mode (spec DEMO-3)', () => {
    async function loadedInDemo() {
      const server = fakeServer();
      const store = createEditorStore(server.api);
      store.getState().start();
      server.loads[0]!.resolve({ revision: 1, project: demoProject(), demo: true });
      await settle();
      return { server, state: () => store.getState() };
    }

    it('learns the mode from the server', async () => {
      const { state } = await loadedInDemo();
      expect(state().demo).toBe(true);
      const { state: normal } = await loaded();
      expect(normal().demo).toBe(false);
    });

    it('keeps changes in this tab and never saves them', async () => {
      const { server, state } = await loadedInDemo();
      state().change(rename('Visitor stand'));
      await wait(SAVE_DELAY_MS * 4);
      expect(server.saves).toHaveLength(0);
      expect(state().project?.name).toBe('Visitor stand');
      expect(state().save).toEqual({ state: 'saved' });
    });

    it('keeps the visitor’s changes when the connection comes back', async () => {
      const { server, state } = await loadedInDemo();
      state().change(rename('Visitor stand'));
      state().connected();
      server.loads[1]!.resolve({ revision: 1, project: demoProject(), demo: true });
      await settle();
      expect(state().project?.name).toBe('Visitor stand');
      expect(server.saves).toHaveLength(0);
    });
  });

  describe('quit (ADR 0017)', () => {
    it('learns from the server whether it can quit it', async () => {
      const server = fakeServer();
      const store = createEditorStore(server.api);
      store.getState().start();
      server.loads[0]!.resolve({ revision: 1, project: demoProject(), quit: true });
      await settle();
      expect(store.getState().canQuit).toBe(true);
      const { state } = await loaded();
      expect(state().canQuit).toBe(false);
    });

    it('saves what waits, then quits, and is stopped', async () => {
      const { state, server, api } = await loaded();
      const quitServer = vi.spyOn(api, 'quitServer').mockResolvedValue(true);
      state().change(rename('Last change'));
      const answer = state().quit();
      await settle();
      expect(quitServer).not.toHaveBeenCalled(); // not before the save is done
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await wait(40);
      await expect(answer).resolves.toBe(true);
      expect(quitServer).toHaveBeenCalledOnce();
      expect(state().stopped).toBe(true);
    });

    it('is not stopped when the server did not agree or cannot be reached', async () => {
      const { state, api } = await loaded();
      vi.spyOn(api, 'quitServer').mockResolvedValueOnce(false);
      await expect(state().quit()).resolves.toBe(false);
      vi.spyOn(api, 'quitServer').mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await expect(state().quit()).resolves.toBe(false);
      expect(state().stopped).toBe(false);
    });
  });

  describe('import (spec PRJ-4)', () => {
    const file = new Blob(['zip']);

    it('saves a waiting change first, then imports, then loads the imported project', async () => {
      const { state, server, api } = await loaded();
      const importArchive = vi
        .spyOn(api, 'importArchive')
        .mockResolvedValue({ ok: true, revision: 3 });
      state().change(rename('One'));
      const answer = state().importArchive(file);
      await settle();
      expect(importArchive).not.toHaveBeenCalled(); // not before the save is done
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await wait(40);
      expect(importArchive).toHaveBeenCalledWith(file);
      server.loads[1]!.resolve({ revision: 3, project: { ...demoProject(), name: 'Imported' } });
      await expect(answer).resolves.toEqual({ ok: true, revision: 3 });
      expect(state().project?.name).toBe('Imported');
      expect(state().revision).toBe(3);
    });

    it('keeps the project when the import is refused', async () => {
      const { state, server, api } = await loaded();
      vi.spyOn(api, 'importArchive').mockResolvedValue({ ok: false, reason: 'was refused: x.' });
      await expect(state().importArchive(file)).resolves.toEqual({
        ok: false,
        reason: 'was refused: x.',
      });
      expect(server.loads).toHaveLength(1);
      expect(state().project?.name).toBe('Demo stand');
    });

    it('says so when the server cannot be reached', async () => {
      const { state, api } = await loaded();
      vi.spyOn(api, 'importArchive').mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(state().importArchive(file)).resolves.toEqual({
        ok: false,
        reason: 'could not be sent: cannot reach the server.',
      });
    });
  });
  describe('undo and redo (spec ED-24 to ED-27, ADR 0023)', () => {
    const names = (projects: { project: Project }[]) => projects.map((s) => s.project.name);
    /** Removes a hotspot from the home page. */
    const removeHotspot = (id: string) => (project: Project) => ({
      ...project,
      pages: project.pages.map((page) =>
        page.id === 'p_home00'
          ? { ...page, hotspots: page.hotspots.filter((h) => h.id !== id) }
          : page,
      ),
    });

    it('goes back and forward through the changes in order', async () => {
      const { state } = await loaded();
      expect(canUndo(state())).toBe(false);
      for (const name of ['One', 'Two', 'Three']) state().change(rename(name));
      expect(names(state().past)).toEqual(['Demo stand', 'One', 'Two']);
      state().undo();
      state().undo();
      expect(state().project?.name).toBe('One');
      expect(names(state().future)).toEqual(['Three', 'Two']);
      expect(canRedo(state())).toBe(true);
      state().redo();
      expect(state().project?.name).toBe('Two');
      expect(names(state().past)).toEqual(['Demo stand', 'One']);
      expect(names(state().future)).toEqual(['Three']);
      state().undo();
      state().undo();
      expect(state().project?.name).toBe('Demo stand');
      expect(canUndo(state())).toBe(false);
    });

    it('drops what could be redone when a new change is made', async () => {
      const { state } = await loaded();
      state().change(rename('One'));
      state().change(rename('Two'));
      state().undo();
      state().change(rename('Other'));
      expect(canRedo(state())).toBe(false);
      expect(names(state().past)).toEqual(['Demo stand', 'One']);
    });

    it(`keeps the last ${HISTORY_LIMIT} steps and drops the oldest`, async () => {
      const { state } = await loaded();
      for (let i = 1; i <= HISTORY_LIMIT; i++) state().change(rename(`Name ${i}`));
      expect(state().past).toHaveLength(HISTORY_LIMIT);
      expect(state().past[0]!.project.name).toBe('Demo stand'); // exactly the limit: all kept
      state().change(rename('One more'));
      expect(state().past).toHaveLength(HISTORY_LIMIT);
      expect(state().past[0]!.project.name).toBe('Name 1');
      // A redo goes back onto the history under the same limit.
      state().undo();
      state().change(rename('Again'));
      state().undo();
      state().redo();
      expect(state().past).toHaveLength(HISTORY_LIMIT);
      expect(state().past[0]!.project.name).toBe('Name 1');
    });

    it('records nothing for a change that changes nothing, and undoes nothing without history', async () => {
      const { state, server } = await loaded();
      const before = state().project;
      state().change((project) => project);
      expect(state().past).toEqual([]);
      state().undo();
      state().redo();
      expect(state().project).toBe(before);
      await wait(SAVE_DELAY_MS * 2);
      expect(server.saves).toHaveLength(0);
    });

    it('makes one step of the changes of one group within the quiet time', async () => {
      const { state } = await loaded();
      state().change(rename('T'), { group: 'name' });
      await wait(GROUP_QUIET_MS); // exactly the quiet time still merges
      state().change(rename('Ty'), { group: 'name' });
      await wait(GROUP_QUIET_MS - 1);
      state().change(rename('Typed'), { group: 'name' });
      expect(names(state().past)).toEqual(['Demo stand']);
      state().undo();
      expect(state().project?.name).toBe('Demo stand');
    });

    it('starts a new step after the quiet time, with another group, or after a change without one', async () => {
      const { state } = await loaded();
      state().change(rename('A'), { group: 'name' });
      await wait(GROUP_QUIET_MS + 1);
      state().change(rename('B'), { group: 'name' });
      state().change(rename('C'), { group: 'title' });
      state().change(rename('D'));
      state().change(rename('E'));
      state().change(rename('F'), { group: 'title' });
      expect(names(state().past)).toEqual(['Demo stand', 'A', 'B', 'C', 'D', 'E']);
    });

    it('starts a new step after an undo, even in the same group', async () => {
      const { state } = await loaded();
      state().change(rename('A'), { group: 'name' });
      state().undo();
      state().change(rename('B'), { group: 'name' });
      expect(names(state().past)).toEqual(['Demo stand']);
      state().undo();
      state().redo();
      state().change(rename('C'), { group: 'name' });
      expect(names(state().past)).toEqual(['Demo stand', 'B']);
    });

    it('brings back the selection of each moment', async () => {
      const { state } = await loaded();
      state().select({ pageId: 'p_home00', hotspotIds: ['h_carda0'] });
      state().change(removeHotspot('h_carda0'));
      expect(state().selection).toEqual({ pageId: 'p_home00', hotspotIds: [] });
      state().select({ pageId: 'p_about0', hotspotIds: [] });
      state().undo();
      expect(state().selection).toEqual({ pageId: 'p_home00', hotspotIds: ['h_carda0'] });
      expect(state().project?.pages[0]?.hotspots.some((h) => h.id === 'h_carda0')).toBe(true);
      state().redo();
      expect(state().selection).toEqual({ pageId: 'p_about0', hotspotIds: [] });
    });

    it('keeps the selection valid for the project it brings back', async () => {
      const { state } = await loaded();
      state().select({ pageId: 'p_home00', hotspotIds: ['h_carda0'] });
      state().change(removeHotspot('h_carda0'));
      state().undo();
      // Redo brings back the project without the hotspot; the hotspot selected now goes.
      state().redo();
      expect(state().selection).toEqual({ pageId: 'p_home00', hotspotIds: [] });
    });

    it('saves an undo and a redo as any change is saved', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await settle();
      state().undo();
      expect(state().save).toEqual({ state: 'saving' });
      await wait(SAVE_DELAY_MS);
      expect(server.saves[1]!.project.name).toBe('Demo stand');
      expect(server.saves[1]!.basedOn).toBe(2);
      server.saves[1]!.answer.resolve({ ok: true, revision: 3 });
      await settle();
      state().redo();
      await wait(SAVE_DELAY_MS);
      expect(server.saves[2]!.project.name).toBe('One');
    });

    it('keeps undo in the tab in demo mode, without saving', async () => {
      const server = fakeServer();
      const store = createEditorStore(server.api);
      store.getState().start();
      server.loads[0]!.resolve({ revision: 1, project: demoProject(), demo: true });
      await settle();
      store.getState().change(rename('Visitor'));
      store.getState().undo();
      expect(store.getState().project?.name).toBe('Demo stand');
      await wait(SAVE_DELAY_MS * 2);
      expect(server.saves).toHaveLength(0);
      expect(store.getState().save).toEqual({ state: 'saved' });
    });

    it('is cleared when another editor saves, and says so once', async () => {
      const { state, server } = await loaded();
      expect(state().historyCleared).toBe(false); // the first load cleared nothing
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await settle();
      state().undo();
      await wait(SAVE_DELAY_MS);
      server.saves[1]!.answer.resolve({ ok: true, revision: 3 });
      await settle();
      state().projectUpdated(4);
      server.loads[1]!.resolve({ revision: 4, project: { ...demoProject(), name: 'Theirs' } });
      await settle();
      expect(state().past).toEqual([]);
      expect(state().future).toEqual([]);
      expect(state().historyCleared).toBe(true);
      state().dismissHistoryCleared();
      expect(state().historyCleared).toBe(false);
    });

    it('does not say so when there was nothing to clear', async () => {
      const { state, server } = await loaded();
      state().projectUpdated(2);
      server.loads[1]!.resolve({ revision: 2, project: { ...demoProject(), name: 'Theirs' } });
      await settle();
      expect(state().historyCleared).toBe(false);
    });

    it('keeps the history when a check after reconnecting finds no other save', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await settle();
      state().connected();
      server.loads[1]!.resolve({ revision: 2, project: { ...demoProject(), name: 'One' } });
      await settle();
      expect(names(state().past)).toEqual(['Demo stand']);
      expect(state().historyCleared).toBe(false);
    });

    it('is cleared without a notice when this editor opens another project', async () => {
      const { state } = await loaded();
      state().change(rename('One'));
      state().undo();
      state().projectOpened(7);
      expect(state().future).toEqual([]);
      expect(state().historyCleared).toBe(false);
    });

    it('keeps a notice not yet shown when this editor then opens another project', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await settle();
      state().projectUpdated(3);
      server.loads[1]!.resolve({ revision: 3, project: demoProject() });
      await settle();
      state().projectOpened(8);
      expect(state().historyCleared).toBe(true);
    });

    it('is cleared without a notice after this editor imports a project', async () => {
      const { state, server, api } = await loaded();
      vi.spyOn(api, 'importArchive').mockResolvedValue({ ok: true, revision: 3 });
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await settle();
      const answer = state().importArchive(new Blob(['zip']));
      await wait(40);
      expect(state().past).toEqual([]); // at once, before the imported project arrives
      server.loads[1]!.resolve({ revision: 3, project: { ...demoProject(), name: 'Imported' } });
      await answer;
      expect(state().historyCleared).toBe(false);
    });

    it('keeps the history when an import is refused', async () => {
      const { state, server, api } = await loaded();
      vi.spyOn(api, 'importArchive').mockResolvedValue({ ok: false, reason: 'not a zip' });
      state().change(rename('One'));
      state().change(rename('Two'));
      const answer = state().importArchive(new Blob(['zip']));
      await settle();
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await wait(40);
      await answer;
      expect(names(state().past)).toEqual(['Demo stand', 'One']);
    });

    it('ends the notice with the next change of this editor', async () => {
      const { state, server } = await loaded();
      state().change(rename('One'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({ ok: true, revision: 2 });
      await settle();
      state().projectUpdated(3);
      server.loads[1]!.resolve({ revision: 3, project: demoProject() });
      await settle();
      expect(state().historyCleared).toBe(true);
      state().change(rename('Mine'));
      expect(state().historyCleared).toBe(false);
    });

    it('is cleared when a save finds another project open on the server', async () => {
      const { state, server } = await loaded();
      state().change(rename('Old stand edit'));
      await wait(SAVE_DELAY_MS);
      server.saves[0]!.answer.resolve({
        ok: false,
        reason: 'Another project was opened on the server.',
        errors: [],
        stale: true,
      });
      await settle();
      // Cleared at once, even before the open project arrives.
      expect(state().past).toEqual([]);
      expect(state().historyCleared).toBe(true);
    });

    it('makes a gesture one step however long it pauses', async () => {
      const { state } = await loaded();
      state().change(rename('A'), { group: 'drag 1', gesture: true });
      await wait(GROUP_QUIET_MS * 5);
      state().change(rename('B'), { group: 'drag 1', gesture: true });
      expect(names(state().past)).toEqual(['Demo stand']);
    });

    it('groups changes while typing in a field, by the field, unless a change has its own group', async () => {
      const { state } = await loaded();
      state().setTypingIn('field 1');
      state().change(rename('H'));
      state().change(rename('Ha'));
      state().change(rename('Moved'), { group: 'nudge' });
      state().change(rename('Hal'));
      expect(names(state().past)).toEqual(['Demo stand', 'Ha', 'Moved']);
      state().setTypingIn(null);
      state().change(rename('One'));
      state().change(rename('Two'));
      expect(names(state().past)).toEqual(['Demo stand', 'Ha', 'Moved', 'Hal', 'One']);
    });

    it('starts a new step after the history was cleared, even in the same group', async () => {
      const { state } = await loaded();
      state().change(rename('A'), { group: 'name' });
      state().projectOpened(7);
      state().change(rename('B'), { group: 'name' });
      expect(names(state().past)).toEqual(['A']);
    });
  });
});
