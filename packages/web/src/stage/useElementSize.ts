// The current size of an element, kept up to date as the window or the surrounding layout changes.
import { useEffect, useRef, useState } from 'react';
import type { Size } from './geometry';

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  // 0 × 0 until the first measurement; stageGeometry draws nothing for an empty size.
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}
