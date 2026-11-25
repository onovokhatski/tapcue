// The editor's state: the project being edited, the selection, the save status and the undo history.
// Every change is a pure operation (project) => project, and the project is saved shortly after the
// last one (spec ED-5, ED-7, ED-24, architecture §4.2, ADR 0011, ADR 0023).
import type {
  Hotspot,
  HotspotId,
  LogEntry,
  PageId,
  Project,
  ValidationError,
} from '@tapcue/shared';
import { createStore } from 'zustand/vanilla';
import { type ProjectApi, projectApi, type TestSent } from '../lib/projectApi';
import type { Imported } from '../lib/projectArchive';
import type { SocketStatus } from '../lib/serverSocket';
import { readSafeArea, type SafeAreaPreference, writeSafeArea } from './canvas/safeAreaPreference';
import { addEntry } from './log/logEntries';
import { pasteHotspots } from './operations/hotspots';

/** Quiet time after the last change before the project is saved. */
export const SAVE_DELAY_MS = 500;
/** Steps the editor can undo; the oldest is dropped past this (spec ED-24). */
export const HISTORY_LIMIT = 100;
/** Changes of one group closer than this to each other are one step (spec ED-25). */
export const GROUP_QUIET_MS = 1000;

/**
 * The page shown and the hotspots selected on it, in page order (spec ED-16). One selected works as
 * a single selection always has; none shows the page's own panel.
 */
export interface Selection {
  pageId: PageId | null;
  hotspotIds: HotspotId[];
}

export type SaveStatus =
  | { state: 'saved' }
  /** A change waits for the quiet time, or is on its way to the server. */
  | { state: 'saving' }
  /** The server could not be reached; the changes stay here and are saved on reconnect. */
  | { state: 'unsaved' }
  /** The server refused the save; `errors` lists the fields when the project was invalid. */
  | { state: 'error'; reason: string; errors: ValidationError[] };

/**
 * The project at one moment, with what was selected then. The project is never changed in place,
 * so a snapshot holds only references (ADR 0023).
 */
export interface Snapshot {
  project: Project;
  selection: Selection;
}

export interface EditorState {
  load: 'loading' | 'failed' | 'ready';
  project: Project | null;
  /** The server's revision of the project last loaded or saved. */
  revision: number | null;
  selection: Selection;
  save: SaveStatus;
  /** Editor preference, not part of the project (spec ED-3). */
  safeArea: SafeAreaPreference;
  /** Commands sent since the editor opened, newest first (spec ED-6). */
  log: LogEntry[];
  /** The editor's own connection to the server (spec ED-7). */
  connection: SocketStatus;
  /** Demo mode: changes stay in this tab and are never saved (spec DEMO-3). */
  demo: boolean;
  /** The click-to-run app, which this editor can stop (ADR 0017). */
  canQuit: boolean;
  /** Quit from this editor: the server is gone and will not come back by itself. */
  stopped: boolean;
  /**
   * Hotspots copied in this editor, as they were, and the page they came from (spec ED-17). Kept
   * while the tab is open; another project clears it, since its targets and images differ.
   */
  clipboard: { pageId: PageId; hotspots: Hotspot[] } | null;
  /** The projects before each change, oldest first, at most HISTORY_LIMIT (spec ED-24). */
  past: Snapshot[];
  /** The projects undone, the next one to redo last. */
  future: Snapshot[];
  /**
   * The history was dropped because the project was replaced from outside: saved by another
   * editor, another project opened, or a stale save (spec ED-27). The editor says so once.
   */
  historyCleared: boolean;
}

/** Options of a change: changes with the same `group` in quick succession are one step (ED-25). */
export interface ChangeOptions {
  group?: string;
}

export interface EditorActions {
  /** Loads the project from the server. */
  start: () => void;
  /**
   * Applies an operation to the project, records the project before it for undo, and saves it
   * after the quiet time.
   */
  change: (operation: (project: Project) => Project, options?: ChangeOptions) => void;
  /** Goes back one step, with the selection of that moment, and saves it (spec ED-24). */
  undo: () => void;
  /** Goes forward again one step undone, and saves it. */
  redo: () => void;
  /** The editor has said that the history was cleared. */
  dismissHistoryCleared: () => void;
  select: (selection: Selection) => void;
  /** Copies the selected hotspots into the editor's clipboard (spec ED-17). */
  copy: () => void;
  /** Pastes the clipboard onto the page shown and selects the copies (spec ED-17). */
  paste: () => void;
  setSafeArea: (change: Partial<SafeAreaPreference>) => void;
  /** The server sent or failed to send a command. */
  logged: (entry: LogEntry) => void;
  clearLog: () => void;
  /** Saves now, e.g. after a save error. */
  retry: () => void;
  /** The editor's connection opened, the first time or after a drop. */
  connected: () => void;
  setConnection: (status: SocketStatus) => void;
  /**
   * Saves now if a change is waiting, and resolves once nothing is left to save: true when the
   * server has the project as it is on screen. "Send test" uses it, so the command sent is the one
   * shown (spec ACT-4).
   */
  saveNow: () => Promise<boolean>;
  /** Saves what is waiting, then sends the hotspot's command from the source "test" (ACT-4). */
  testSend: (pageId: PageId, hotspotId: HotspotId, value?: number) => Promise<TestSent>;
  /** The server says the project was saved, by this editor or another one. */
  projectUpdated: (revision: number) => void;
  /** This editor opened another project of the library: loads it and clears the clipboard. */
  projectOpened: (revision: number) => void;
  /**
   * Replaces the project with a .zip (spec PRJ-4). A change still waiting is saved first, so no
   * save after the import puts the old project back; then the imported project is loaded.
   */
  importArchive: (file: Blob) => Promise<Imported>;
  /**
   * Stops the click-to-run app (ADR 0017): what waits is saved first, so quitting loses nothing.
   * Resolves with whether the server stopped.
   */
  quit: () => Promise<boolean>;
}

export type EditorStore = EditorState & EditorActions;

const NOTHING_SELECTED: Selection = { pageId: null, hotspotIds: [] };

export const canUndo = (state: EditorState) => state.past.length > 0;
export const canRedo = (state: EditorState) => state.future.length > 0;

export function createEditorStore(api: ProjectApi = projectApi) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  /** A change the server has not been sent yet. */
  let pending = false;
  /** The group of the last change and when it was made, while its steps may still merge. */
  let lastGroup: { key: string; at: number } | undefined;

  return createStore<EditorStore>()((set, get) => {
    /**
     * The history emptied, for a project replaced from outside: its steps belong to another copy
     * and undoing them would bring that copy back over the new one (ADR 0023). The editor says so
     * when steps were lost to someone else's change; with `quietly`, this editor replaced the
     * project itself and knows.
     */
    function clearedHistory(
      quietly = false,
    ): Pick<EditorState, 'past' | 'future' | 'historyCleared'> {
      lastGroup = undefined;
      const { past, future, historyCleared } = get();
      const lost = !quietly && (past.length > 0 || future.length > 0);
      return { past: [], future: [], historyCleared: historyCleared || lost };
    }

    /** Shows a new project, then saves it after the quiet time; demo mode keeps it in this tab. */
    function apply(project: Project, selection: Selection, history: Partial<EditorState>) {
      // The selection follows: a deleted page or hotspot is no longer selected.
      const kept = keepSelection(selection, project);
      // A change of this editor's own ends the notice that the history was cleared (spec ED-27).
      const state = { project, selection: kept, ...history, historyCleared: false };
      // In demo mode the change stays in this tab; the server would refuse it anyway.
      if (get().demo) return void set(state);
      set({ ...state, save: { state: 'saving' } });
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), SAVE_DELAY_MS);
    }

    /** Loads the project; with `onlyIfNew`, keeps the current one when the revision is the same. */
    async function load(onlyIfNew: boolean) {
      try {
        const { revision, project, demo = false, quit = false } = await api.load();
        // A change made while loading wins: the editor never drops the integrator's work.
        if (pending || inFlight || (onlyIfNew && revision === get().revision)) return;
        set({
          load: 'ready',
          project,
          revision,
          selection: keepSelection(get().selection, project),
          demo,
          canQuit: quit,
          ...clearedHistory(),
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
      let stale = false;
      try {
        const result = await api.save(project, get().revision);
        if (result.ok) {
          set({ revision: result.revision });
          if (!pending) set({ save: { state: 'saved' } });
        } else if (result.stale) {
          stale = true;
        } else {
          set({ save: { state: 'error', reason: result.reason, errors: result.errors } });
        }
      } catch {
        set({ save: { state: 'unsaved' } });
      } finally {
        inFlight = false;
      }
      // Another project was opened on the server: this copy, and any change made since, belong to
      // the one open before. They are dropped and the open project is shown (ADR 0021).
      if (stale) {
        pending = false;
        clearTimeout(timer);
        timer = undefined;
        set({ save: { state: 'saved' }, clipboard: null, ...clearedHistory() });
        await load(false);
        return;
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
      safeArea: readSafeArea(),
      log: [],
      connection: 'connecting',
      demo: false,
      canQuit: false,
      stopped: false,
      clipboard: null,
      past: [],
      future: [],
      historyCleared: false,

      start() {
        set({ load: 'loading' });
        void load(false);
      },

      change(operation, { group } = {}) {
        const { project, selection, past } = get();
        if (!project) return;
        const next = operation(project);
        if (next === project) return; // nothing changed: nothing to save or undo
        const now = Date.now();
        // A drag or typing in a field is one step: the project before its first change is kept.
        const merges =
          group !== undefined && lastGroup?.key === group && now - lastGroup.at <= GROUP_QUIET_MS;
        lastGroup = group === undefined ? undefined : { key: group, at: now };
        // A new change ends what could be redone.
        const history = merges
          ? {}
          : { past: [...past, { project, selection }].slice(-HISTORY_LIMIT), future: [] };
        apply(next, selection, history);
      },

      undo() {
        const { project, selection, past, future } = get();
        const step = past.at(-1);
        if (!project || !step) return;
        lastGroup = undefined; // what comes after an undo is a step of its own
        apply(step.project, step.selection, {
          past: past.slice(0, -1),
          future: [...future, { project, selection }],
        });
      },

      redo() {
        const { project, selection, past, future } = get();
        const step = future.at(-1);
        // No group to end: an undo came first, and nothing changed since, or this would be empty.
        if (!project || !step) return;
        // Undo and redo only move steps between the stacks, so together they stay within the limit.
        apply(step.project, step.selection, {
          past: [...past, { project, selection }],
          future: future.slice(0, -1),
        });
      },

      dismissHistoryCleared() {
        set({ historyCleared: false });
      },

      select(selection) {
        const { project } = get();
        set({ selection: project ? keepSelection(selection, project) : selection });
      },

      copy() {
        const { project, selection } = get();
        const page = project?.pages.find((p) => p.id === selection.pageId);
        const hotspots = page?.hotspots.filter((h) => selection.hotspotIds.includes(h.id)) ?? [];
        if (!page || hotspots.length === 0) return;
        // The hotspots as they are now: every change makes new objects, so later edits to the
        // originals do not reach the clipboard.
        set({ clipboard: { pageId: page.id, hotspots } });
      },

      paste() {
        const { project, selection, clipboard } = get();
        if (!project || !clipboard || !selection.pageId) return;
        const pasted = pasteHotspots(project, selection.pageId, clipboard);
        get().change(() => pasted.project);
        get().select({ pageId: selection.pageId, hotspotIds: pasted.hotspotIds });
      },

      logged(entry) {
        set({ log: addEntry(get().log, entry) });
      },

      clearLog() {
        set({ log: [] });
      },

      setSafeArea(change) {
        const safeArea = { ...get().safeArea, ...change };
        writeSafeArea(safeArea);
        set({ safeArea });
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

      setConnection(connection) {
        set({ connection });
      },

      async saveNow() {
        if (pending && !inFlight) {
          clearTimeout(timer);
          void flush();
        }
        // Wait out the save in flight, and the one a change during it starts.
        while (pending || inFlight) await new Promise((resolve) => setTimeout(resolve, 20));
        return get().save.state === 'saved';
      },

      async testSend(pageId, hotspotId, value) {
        // The server sends the command it has, so a change still waiting is saved first.
        if (!(await get().saveNow())) {
          return { ok: false, reason: 'Not sent: the latest changes are not saved yet.' };
        }
        try {
          // A button's test sends no value; only a fader's does (spec FD-2).
          return value === undefined
            ? await api.testSend(pageId, hotspotId)
            : await api.testSend(pageId, hotspotId, value);
        } catch {
          return { ok: false, reason: 'Cannot reach the server.' };
        }
      },

      projectOpened(revision) {
        set({ clipboard: null, ...clearedHistory(true) });
        get().projectUpdated(revision);
      },

      projectUpdated(revision) {
        // While this editor saves, the message is about its own save, or about one it will
        // replace: the last save wins (architecture §6).
        if (pending || inFlight || revision === get().revision) return;
        void load(true);
      },

      async importArchive(file) {
        await get().saveNow();
        let result: Imported;
        try {
          result = await api.importArchive(file);
        } catch {
          return { ok: false, reason: 'could not be sent: cannot reach the server.' };
        }
        if (!result.ok) return result;
        // This editor replaced the project: no notice. A load started by the server's message
        // about the import may still come first and show it; that is rare and harmless.
        set(clearedHistory(true));
        await load(true);
        return result;
      },

      async quit() {
        await get().saveNow();
        try {
          if (!(await api.quitServer())) return false;
        } catch {
          return false;
        }
        set({ stopped: true });
        return true;
      },
    };
  });
}

/** The selection still pointing at things in the project, or the first page. */
function keepSelection(selection: Selection, project: Project): Selection {
  const page = project.pages.find((p) => p.id === selection.pageId) ?? project.pages[0];
  if (!page) return NOTHING_SELECTED;
  // Kept in page order, so a group reads the same way however it was selected.
  const hotspotIds = page.hotspots
    .filter((h) => selection.hotspotIds.includes(h.id))
    .map((h) => h.id);
  const same =
    page.id === selection.pageId &&
    hotspotIds.length === selection.hotspotIds.length &&
    hotspotIds.every((id, i) => id === selection.hotspotIds[i]);
  return same ? selection : { pageId: page.id, hotspotIds };
}
