import type { Project } from '@tapcue/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoProject } from '../test/demoProject';
import { NumberField } from '../ui/NumberField';
import { createEditorStore, GROUP_QUIET_MS } from './editorStore';
import {
  commandKey,
  HistoryNotice,
  historyKey,
  NOTICE_MS,
  UndoButtons,
  useTypingGroups,
  useUndoKeys,
} from './UndoControls';
import { EditorStoreContext as Context, useEditor } from './useEditor';
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

/** Fields that change the project at every keystroke, as the panels do, with typing grouped. */
function TypingFields() {
  useTypingGroups();
  const name = useEditor((state) => state.project?.name ?? '');
  const width = useEditor((state) => String(state.project?.canvas.width ?? ''));
  const change = useEditor((state) => state.change);
  const setWidth = (text: string) =>
    change((p) => ({ ...p, canvas: { ...p.canvas, width: Number(text) } }));
  return (
    <>
      <input aria-label="Name" value={name} onChange={(e) => change(rename(e.target.value))} />
      <NumberField prefix="W" ariaLabel="Width" value={width} onChange={setWidth} />
      <input
        type="checkbox"
        aria-label="Loud"
        onChange={(e) => change(rename(e.target.checked ? 'Loud' : 'Quiet'))}
      />
    </>
  );
}

async function renderTyping() {
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project: demoProject() }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    importArchive: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    quitServer: () => Promise.resolve(false),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  const view = render(
    <Context value={store}>
      <TypingFields />
    </Context>,
  );
  const state = () => store.getState();
  const field = (name: string) => screen.getByLabelText(name);
  /** Focuses a field and types into it, one character at a time. */
  const type = (name: string, text: string) => {
    act(() => field(name).focus());
    let value = '';
    for (const char of text) fireEvent.change(field(name), { target: { value: (value += char) } });
  };
  return { state, field, type, view };
}

describe('typing is one undo step (spec ED-25)', () => {
  it('makes a name typed letter by letter one step', async () => {
    const { state, type } = await renderTyping();
    type('Name', 'Hall B');
    expect(state().project?.name).toBe('Hall B');
    expect(state().past).toHaveLength(1);
    act(() => state().undo());
    expect(state().project?.name).toBe('Demo stand');
  });

  it('makes a number typed into a field one step', async () => {
    const { state, type } = await renderTyping();
    type('Width', '1920');
    expect(state().project?.canvas.width).toBe(1920);
    expect(state().past).toHaveLength(1);
  });

  it('ends the step when the focus leaves the field', async () => {
    const { state, field, type } = await renderTyping();
    type('Name', 'Hall');
    act(() => field('Name').blur());
    type('Name', 'Hall B');
    expect(state().past).toHaveLength(2);
    // Another field is another visit, so another step.
    type('Width', '1920');
    expect(state().past).toHaveLength(3);
    // Out of every field, changes are steps of their own again.
    act(() => field('Width').blur());
    act(() => state().change(rename('One')));
    act(() => state().change(rename('Two')));
    expect(state().past).toHaveLength(5);
  });

  it('ends the step after a pause in typing', async () => {
    const { state, field, type } = await renderTyping();
    vi.useFakeTimers();
    type('Name', 'Hall');
    act(() => void vi.advanceTimersByTime(GROUP_QUIET_MS + 1));
    fireEvent.change(field('Name'), { target: { value: 'Hall B' } });
    expect(state().past).toHaveLength(2);
  });

  it('keeps each switch of a checkbox a step of its own', async () => {
    const { state, field } = await renderTyping();
    act(() => field('Loud').focus());
    fireEvent.click(field('Loud'));
    fireEvent.click(field('Loud'));
    expect(state().past).toHaveLength(2);
  });

  it('makes a drag of a number field’s handle one step, and leaves the field after it', async () => {
    const { state, field } = await renderTyping();
    const handle = screen.getByText('W');
    fireEvent.pointerDown(handle, { button: 0, clientX: 100 });
    expect(field('Width')).toHaveFocus(); // the drag is a visit to the field
    fireEvent.pointerMove(handle, { clientX: 110 });
    fireEvent.pointerMove(handle, { clientX: 130 });
    fireEvent.pointerUp(handle);
    expect(field('Width')).not.toHaveFocus();
    expect(state().project?.canvas.width).toBe(2078);
    expect(state().past).toHaveLength(1);
    // The next drag, at once, is another step.
    fireEvent.pointerDown(handle, { button: 0, clientX: 100 });
    fireEvent.pointerMove(handle, { clientX: 101 });
    fireEvent.pointerUp(handle);
    expect(state().past).toHaveLength(2);
  });

  it('stops grouping once the fields are gone', async () => {
    const { state, type, view } = await renderTyping();
    type('Name', 'Hall');
    view.unmount();
    act(() => state().change(rename('One')));
    act(() => state().change(rename('Two')));
    expect(state().past).toHaveLength(3);
  });
});
