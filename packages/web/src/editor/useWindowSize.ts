// The browser window's size, kept up to date: the editor's layout depends on it (spec ED-12).
import { useEffect, useState } from 'react';

export interface WindowSize {
  width: number;
  height: number;
}

const current = (): WindowSize => ({ width: window.innerWidth, height: window.innerHeight });

export function useWindowSize(): WindowSize {
  const [size, setSize] = useState(current);
  useEffect(() => {
    const update = () => setSize(current());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}

/** The editor's layouts (spec ED-12; design: EDITOR_LAYOUT). */
export function editorLayout({ width, height }: WindowSize): 'wide' | 'compact' | 'too-small' {
  if (width < 1280 || height < 720) return 'too-small';
  return width < 1440 ? 'compact' : 'wide';
}
