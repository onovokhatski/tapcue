// The tap gesture: pressed on touch-down, tap on release inside, cancelled by sliding off (spec ACT-2).
import { useRef, useState, type PointerEvent } from 'react';

export function usePress(onTap: () => void, onPress?: (event: PointerEvent<HTMLElement>) => void) {
  // The one pointer that pressed this hotspot. Other fingers on it are ignored until it is lifted.
  const pointerId = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);

  function end(event: PointerEvent<HTMLElement>) {
    if (event.pointerId !== pointerId.current) return false;
    pointerId.current = null;
    setPressed(false);
    return true;
  }

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      // button 0: a finger, a pen, or the main mouse button.
      if (pointerId.current !== null || event.button !== 0) return;
      pointerId.current = event.pointerId;
      // Touch captures the pointer to the element it went down on, so pointerleave would only
      // come after the finger is lifted. Releasing the capture lets a slide-off cancel at once.
      const element = event.currentTarget;
      if (element.hasPointerCapture(event.pointerId))
        element.releasePointerCapture(event.pointerId);
      setPressed(true);
      onPress?.(event);
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      if (end(event)) onTap();
    },
    onPointerLeave: end,
    // The browser took the pointer over, e.g. for a system gesture.
    onPointerCancel: end,
  };

  return { pressed, handlers };
}
