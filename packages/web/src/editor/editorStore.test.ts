import type { Project } from '@tapcue/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Loaded, ProjectApi, Saved } from '../lib/projectApi';
import { demoProject } from '../test/demoProject';
import { errorEntry, sentEntry } from '../test/logEntries';
import { createEditorStore, SAVE_DELAY_MS } from './editorStore';

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
  const saves: { project: Project; answer: ReturnType<typeof deferred<Saved>> }[] = [];
  const api: ProjectApi = {
    load: () => {
      const d = deferred<Loaded>();
      loads.push(d);
      return d.promise;
    },
    save: (project) => {
      const answer = deferred<Saved>();
      saves.push({ project, answer });
      return answer.promise;
    },
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
  return { store, server, state: () => store.getState() };
}

describe('editor store', () => {
  describe('loading', () => {
    it('loads the project and selects its first page', async () => {
      const { state } = await loaded();
      expect(state().load).toBe('ready');
      expect(state().project?.name).toBe('Demo stand');
      expect(state().revision).toBe(1);
      expect(state().selection).toEqual({ pageId: 'p_home00', hotspotId: null });
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
      state().select({ pageId: 'p_about0', hotspotId: null });
      state().change((project) => ({
        ...project,
        pages: project.pages.filter((page) => page.id !== 'p_about0'),
      }));
      expect(state().selection).toEqual({ pageId: 'p_home00', hotspotId: null });
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

  describe('saves by others (architecture §6)', () => {
    it('loads a project another editor saved, and keeps the selection when it still exists', async () => {
      const { state, server } = await loaded();
      state().select({ pageId: 'p_proda0', hotspotId: 'h_anext0' });
      state().projectUpdated(2);
      server.loads[1]!.resolve({
        revision: 2,
        project: { ...demoProject(), name: 'From elsewhere' },
      });
      await settle();
      expect(state().project?.name).toBe('From elsewhere');
      expect(state().revision).toBe(2);
      expect(state().selection).toEqual({ pageId: 'p_proda0', hotspotId: 'h_anext0' });
    });

    it('selects the first page when the selected one was deleted elsewhere', async () => {
      const { state, server } = await loaded();
      state().select({ pageId: 'p_about0', hotspotId: null });
      state().projectUpdated(2);
      const project = demoProject();
      project.pages = project.pages.filter((page) => page.id !== 'p_about0');
      server.loads[1]!.resolve({ revision: 2, project });
      await settle();
      expect(state().selection).toEqual({ pageId: 'p_home00', hotspotId: null });
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
});
