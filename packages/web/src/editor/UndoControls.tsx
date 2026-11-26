// Undo and redo where people reach for them: the usual shortcuts, two buttons in the top bar, and a
// short notice when the history was cleared by a change from outside (spec ED-26, ED-27, ADR 0023).
import { useEffect } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { canRedo, canUndo } from './editorStore';
import { useEditor } from './useEditor';

/** How long the notice that the history was cleared stays, unless a change comes first. */
export const NOTICE_MS = 5000;

/** Cmd on a Mac, iPhone or iPad keyboard; Ctrl elsewhere. */
export const commandKey = (platform = navigator.platform) =>
  /Mac|iPhone|iPad/.test(platform) ? 'Cmd' : 'Ctrl';

/** Fields where typing is text, not a single choice: what is typed there is one step per visit. */
const TYPED =
  'textarea, input:not([type="checkbox"], [type="radio"], [type="file"], [type="button"])';

let visits = 0;

/**
 * Tells the store which text field is being typed in, as a key new for each visit, so typing into
 * one field is one undo step until the focus leaves it or a pause (spec ED-25).
 */
export function useTypingGroups() {
  const setTypingIn = useEditor((state) => state.setTypingIn);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const typed = event.target instanceof Element && event.target.matches(TYPED);
      setTypingIn(typed ? `field ${++visits}` : null);
    };
    const onFocusOut = () => setTypingIn(null);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      setTypingIn(null);
    };
  }, [setTypingIn]);
}

/**
 * What a key press asks of the history, or null. Cmd/Ctrl+Z undoes; Shift+Cmd/Ctrl+Z and Ctrl+Y
 * redo. With Alt it is some other shortcut.
 */
export function historyKey(event: KeyboardEvent): 'undo' | 'redo' | null {
  if (event.altKey || !(event.metaKey || event.ctrlKey)) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && event.ctrlKey && !event.shiftKey) return 'redo';
  return null;
}

/**
 * The shortcuts, on every editor tab. In a text field the browser's own text undo applies, and in
 * a dialog the project is not what is being edited, so neither is touched there.
 */
export function useUndoKeys() {
  const undo = useEditor((state) => state.undo);
  const redo = useEditor((state) => state.redo);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = historyKey(event);
      if (!action) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"]',
        )
      ) {
        return;
      }
      event.preventDefault();
      if (action === 'undo') undo();
      else redo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);
}

/** Undo and Redo in the top bar, off when there is nothing to move; the tooltips name the keys. */
export function UndoButtons() {
  const undo = useEditor((state) => state.undo);
  const redo = useEditor((state) => state.redo);
  const undoable = useEditor(canUndo);
  const redoable = useEditor(canRedo);
  const command = commandKey();
  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="s"
        icon="undo"
        ariaLabel="Undo"
        title={`Undo (${command} + Z)`}
        disabled={!undoable}
        onClick={undo}
      />
      <Button
        variant="ghost"
        size="s"
        icon="redo"
        ariaLabel="Redo"
        title={`Redo (Shift + ${command} + Z)`}
        disabled={!redoable}
        onClick={redo}
      />
    </div>
  );
}

/**
 * Says that the history starts again here, after another editor's change replaced the project.
 * It goes after NOTICE_MS; the next change ends it sooner (the store clears the flag).
 */
export function HistoryNotice() {
  const cleared = useEditor((state) => state.historyCleared);
  const dismiss = useEditor((state) => state.dismissHistoryCleared);
  // Counted from when the notice appears; with no notice, ending it changes nothing.
  useEffect(() => {
    const timer = setTimeout(dismiss, NOTICE_MS);
    return () => clearTimeout(timer);
  }, [cleared, dismiss]);
  return (
    <p aria-live="polite" className="flex items-center gap-1.5 text-body-s text-secondary">
      {cleared && (
        <>
          <Icon name="info" className="h-3.5 w-3.5" />
          Changed in another editor: undo starts here
        </>
      )}
    </p>
  );
}
