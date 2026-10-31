// The editor store for the components inside the editor (architecture §4.2).
import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { createEditorStore, EditorStore } from './editorStore';

export const EditorStoreContext = createContext<ReturnType<typeof createEditorStore> | null>(null);

/** Reads from the editor store; the component re-renders only when the selected value changes. */
export function useEditor<T>(selector: (state: EditorStore) => T): T {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error('useEditor is used outside the editor');
  return useStore(store, selector);
}
