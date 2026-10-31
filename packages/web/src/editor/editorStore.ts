// The editor's state: the project being edited, the selection and the save status. Every change is
// a pure operation (project) => project, and the project is saved shortly after the last one
// (spec ED-5, ED-7, architecture §4.2, ADR 0011).
import type { HotspotId, PageId, Project, ValidationError } from '@tapcue/shared';
import { createStore } from 'zustand/vanilla';
import { type ProjectApi, projectApi } from '../lib/projectApi';

/** Quiet time after the last change before the project is saved. */
export const SAVE_DELAY_MS = 500;

export interface Selection {
  pageId: PageId | null;
  hotspotId: HotspotId | null;
}

export type SaveStatus =
  | { state: 'saved' }
  /** A change waits for the quiet time, or is on its way to the server. */
  | { state: 'saving' }
  /** The server could not be reached; the changes stay here and are saved on reconnect. */
  | { state: 'unsaved' }
  /** The server refused the save; `errors` lists the fields when the project was invalid. */
  | { state: 'error'; reason: string; errors: ValidationError[] };

export interface EditorState {
  load: 'loading' | 'failed' | 'ready';
  project: Project | null;
  /** The server's revision of the project last loaded or saved. */
  revision: number | null;
  selection: Selection;
  save: SaveStatus;
}

export interface EditorActions {
  /** Loads the project from the server. */
  start: () => void;
  /** Applies an operation to the project and saves it after the quiet time. */
  change: (operation: (project: Project) => Project) => void;
  select: (selection: Selection) => void;
  /** Saves now, e.g. after a save error. */
  retry: () => void;
  /** The editor's connection opened, the first time or after a drop. */
  connected: () => void;
  /** The server says the project was saved, by this editor or another one. */
  projectUpdated: (revision: number) => void;
}

export type EditorStore = EditorState & EditorActions;

const NOTHING_SELECTED: Selection = { pageId: null, hotspotId: null };

export function createEditorStore(api: ProjectApi = projectApi) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  /** A change the server has not been sent yet. */
  let pending = false;

  return createStore<EditorStore>()((set, get) => {
    /** Loads the project; with `onlyIfNew`, keeps the current one when the revision is the same. */
    async function load(onlyIfNew: boolean) {
      try {
        const { revision, project } = await api.load();
        // A change made while loading wins: the editor never drops the integrator's work.
        if (pending || inFlight || (onlyIfNew && revision === get().revision)) return;
        set({
          load: 'ready',
          project,
          revision,
          selection: keepSelection(get().selection, project),
        });
      } catch {
        if (get().load !== 'ready') set({ load: 'failed' });
      }
    }

    async function flush() {
      timer = undefined;
      // One save at a time; the one in flight sends the newest project when it is done.
      if (inFlight) return;
      const { project } = get();
      if (!project) return;
      inFlight = true;
      pending = false;
      set({ save: { state: 'saving' } });
      try {
        const result = await api.save(project);
        if (result.ok) {
          set({ revision: result.revision });
          if (!pending) set({ save: { state: 'saved' } });
        } else {
          set({ save: { state: 'error', reason: result.reason, errors: result.errors } });
        }
      } catch {
        set({ save: { state: 'unsaved' } });
      } finally {
        inFlight = false;
      }
      // Changed during the save, and its quiet time is over: send the newest project now.
      if (pending && timer === undefined) void flush();
    }

    return {
      load: 'loading',
      project: null,
      revision: null,
      selection: NOTHING_SELECTED,
      save: { state: 'saved' },

      start() {
        set({ load: 'loading' });
        void load(false);
      },

      change(operation) {
        const { project } = get();
        if (!project) return;
        const next = operation(project);
        if (next === project) return; // nothing changed: nothing to save
        // The selection follows: a deleted page or hotspot is no longer selected.
        set({
          project: next,
          selection: keepSelection(get().selection, next),
          save: { state: 'saving' },
        });
        pending = true;
        clearTimeout(timer);
        timer = setTimeout(() => void flush(), SAVE_DELAY_MS);
      },

      select(selection) {
        set({ selection });
      },

      retry() {
        clearTimeout(timer);
        void flush();
      },

      connected() {
        if (get().load !== 'ready') return void load(false);
        // Changes that did not reach the server are sent now; otherwise another editor may have
        // saved meanwhile.
        const { state } = get().save;
        if (state === 'unsaved' || state === 'error') return void flush();
        if (!pending && !inFlight) void load(true);
      },

      projectUpdated(revision) {
        // While this editor saves, the message is about its own save, or about one it will
        // replace: the last save wins (architecture §6).
        if (pending || inFlight || revision === get().revision) return;
        void load(true);
      },
    };
  });
}

/** The selection still pointing at things in the project, or the first page. */
function keepSelection(selection: Selection, project: Project): Selection {
  const page = project.pages.find((p) => p.id === selection.pageId) ?? project.pages[0];
  if (!page) return NOTHING_SELECTED;
  const hotspot = page.hotspots.find((h) => h.id === selection.hotspotId);
  return { pageId: page.id, hotspotId: hotspot?.id ?? null };
}
