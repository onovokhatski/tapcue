import type { Project } from '@tapcue/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoProject } from '../test/demoProject';
import { createEditorStore } from './editorStore';
import {
  commandKey,
  HistoryNotice,
  historyKey,
  NOTICE_MS,
  UndoButtons,
  useUndoKeys,
} from './UndoControls';
import { EditorStoreContext } from './useEditor';

const rename = (name: string) => (project: Project) => ({ ...project, name });

/** The shortcuts and the buttons, with a text field and a dialog to press keys in. */
function Harness() {
  useUndoKeys();
  return (
    <>
      <UndoButtons />
      <HistoryNotice />
      <input aria-label="Name" />
      <textarea aria-label="Notes" />
      <div contentEditable="true" aria-label="Rich" />
      <div role="dialog" aria-label="Dialog">
        <button type="button">In dialog</button>
      </div>
    </>
  );
}

async function renderHarness() {
  const loads: ((project: Project, revision: number) => void)[] = [];
  const store = createEditorStore({
    load: () =>
      new Promise((resolve) => loads.push((project, revision) => resolve({ revision, project }))),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    importArchive: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    quitServer: () => Promise.resolve(false),
  });
  store.getState().start();
  loads.shift()!(demoProject(), 1);
  await act(() => Promise.resolve());
  render(
    <EditorStoreContext value={store}>
      <Harness />
    </EditorStoreContext>,
  );
  const state = () => store.getState();
  /** This editor's changes reach the server. */
  const saved = () => act(() => state().saveNow());
  /** Another editor saved: its project replaces this one. */
  const savedElsewhere = async () => {
    act(() => state().projectUpdated(9));
    loads.shift()!({ ...demoProject(), name: 'Theirs' }, 9);
    await act(() => Promise.resolve());
  };
  return { state, saved, savedElsewhere };
}

const press = (init: KeyboardEventInit, target: Element | Window = window) =>
  act(() => void fireEvent.keyDown(target, init));
const undoButton = () => screen.getByRole('button', { name: 'Undo' });
const redoButton = () => screen.getByRole('button', { name: 'Redo' });

afterEach(() => {
  vi.useRealTimers();
});

describe('historyKey (spec ED-26)', () => {
  const key = (init: KeyboardEventInit) => historyKey(new KeyboardEvent('keydown', init));

  it('reads Cmd/Ctrl+Z as undo, with Shift as redo, and Ctrl+Y as redo', () => {
    expect(key({ key: 'z', metaKey: true })).toBe('undo');
    expect(key({ key: 'z', ctrlKey: true })).toBe('undo');
    expect(key({ key: 'Z', metaKey: true, shiftKey: true })).toBe('redo');
    expect(key({ key: 'Z', ctrlKey: true, shiftKey: true })).toBe('redo');
    expect(key({ key: 'y', ctrlKey: true })).toBe('redo');
  });

  it('reads nothing else', () => {
    expect(key({ key: 'z' })).toBeNull();
    expect(key({ key: 'z', shiftKey: true })).toBeNull();
    expect(key({ key: 'z', metaKey: true, altKey: true })).toBeNull();
    expect(key({ key: 'y', metaKey: true })).toBeNull(); // Cmd+Y is not redo on a Mac
    expect(key({ key: 'y', ctrlKey: true, shiftKey: true })).toBeNull();
    expect(key({ key: 'x', ctrlKey: true })).toBeNull();
  });
});

describe('commandKey', () => {
  it('is Cmd on Apple keyboards and Ctrl elsewhere', () => {
    expect(commandKey('MacIntel')).toBe('Cmd');
    expect(commandKey('iPad')).toBe('Cmd');
    expect(commandKey('iPhone')).toBe('Cmd');
    expect(commandKey('Win32')).toBe('Ctrl');
    expect(commandKey('Linux x86_64')).toBe('Ctrl');
  });
});

describe('undo and redo in the editor (spec ED-26, ED-27)', () => {
  it('undoes and redoes with the shortcuts', async () => {
    const { state } = await renderHarness();
    act(() => state().change(rename('One')));
    act(() => state().change(rename('Two')));
    press({ key: 'z', metaKey: true });
    expect(state().project?.name).toBe('One');
    press({ key: 'z', ctrlKey: true });
    expect(state().project?.name).toBe('Demo stand');
    press({ key: 'Z', metaKey: true, shiftKey: true });
    expect(state().project?.name).toBe('One');
    press({ key: 'y', ctrlKey: true });
    expect(state().project?.name).toBe('Two');
  });

  it('keeps the browser from acting on the shortcut it handles, and lets others through', async () => {
    await renderHarness();
    expect(fireEvent.keyDown(window, { key: 'z', metaKey: true })).toBe(false);
    expect(fireEvent.keyDown(window, { key: 'x', metaKey: true })).toBe(true);
  });

  it('leaves the project alone while typing in a field or working in a dialog', async () => {
    const { state } = await renderHarness();
    act(() => state().change(rename('One')));
    for (const name of ['Name', 'Notes', 'Rich']) {
      const field = screen.getByLabelText(name);
      // The browser's own text undo is left to run.
      expect(fireEvent.keyDown(field, { key: 'z', metaKey: true })).toBe(true);
    }
    press({ key: 'z', metaKey: true }, screen.getByRole('button', { name: 'In dialog' }));
    expect(state().project?.name).toBe('One');
  });

  it('has buttons that undo and redo, off when there is nothing to move, naming the shortcut', async () => {
    const { state } = await renderHarness();
    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeDisabled();
    expect(undoButton()).toHaveAttribute('title', `Undo (${commandKey()} + Z)`);
    expect(redoButton()).toHaveAttribute('title', `Redo (Shift + ${commandKey()} + Z)`);
    act(() => state().change(rename('One')));
    expect(undoButton()).toBeEnabled();
    fireEvent.click(undoButton());
    expect(state().project?.name).toBe('Demo stand');
    expect(undoButton()).toBeDisabled();
    expect(redoButton()).toBeEnabled();
    fireEvent.click(redoButton());
    expect(state().project?.name).toBe('One');
    expect(redoButton()).toBeDisabled();
  });

  it('says when another editor’s save cleared the history, until the next change', async () => {
    const { state, saved, savedElsewhere } = await renderHarness();
    const notice = 'Changed in another editor: undo starts here';
    act(() => state().change(rename('One')));
    await saved();
    expect(screen.queryByText(notice)).toBeNull();
    await savedElsewhere();
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(undoButton()).toBeDisabled();
    act(() => state().change(rename('Mine')));
    expect(screen.queryByText(notice)).toBeNull();
  });

  it('lets the notice go after a few seconds', async () => {
    const { state, saved, savedElsewhere } = await renderHarness();
    act(() => state().change(rename('One')));
    await saved();
    vi.useFakeTimers();
    await savedElsewhere();
    act(() => void vi.advanceTimersByTime(NOTICE_MS - 1));
    expect(state().historyCleared).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(state().historyCleared).toBe(false);
    expect(screen.queryByText(/undo starts here/)).toBeNull();
  });
});
