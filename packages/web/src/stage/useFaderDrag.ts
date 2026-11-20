// The fader gesture (spec FD-2): a finger that goes down on the fader sets the value where it
// touches, drags it while it moves, and lets go with a final value. Other fingers are left alone,
// so a button can be tapped while a fader is held.
import type { FaderSettings } from '@tapcue/shared';
import { faderValueAt } from '@tapcue/shared';
import { useRef, useState, type PointerEvent } from 'react';

/** `onValue` gets every new value while dragging, then the last one again with `final` true. */
export function useFaderDrag(
  fader: FaderSettings | undefined,
  onValue: (value: number, final: boolean) => void,
) {
  // The one pointer that holds this fader; others are ignored until it is lifted.
  const pointerId = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  // While dragging, the knob follows the finger, not values coming back from the server.
  const [dragValue, setDragValue] = useState<number | null>(null);

  const valueAt = (event: PointerEvent<HTMLElement>) =>
    faderValueAt(
      { x: event.clientX, y: event.clientY },
      event.currentTarget.getBoundingClientRect(),
      fader!,
    );

  function end(event: PointerEvent<HTMLElement>) {
    if (event.pointerId !== pointerId.current) return;
    pointerId.current = null;
    setDragValue(null);
    if (last.current !== null) onValue(last.current, true);
  }

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!fader || pointerId.current !== null || event.button !== 0) return;
      pointerId.current = event.pointerId;
      // Kept captured, so the drag goes on when the finger leaves the fader's box.
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const value = valueAt(event);
      last.current = value;
      setDragValue(value);
      onValue(value, false);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (event.pointerId !== pointerId.current) return;
      const value = valueAt(event);
      if (value === last.current) return; // the same step: nothing new to send
      last.current = value;
      setDragValue(value);
      onValue(value, false);
    },
    onPointerUp: end,
    // The browser took the pointer over: the value stays where the finger left it.
    onPointerCancel: end,
  };

  return { dragValue, handlers };
}
