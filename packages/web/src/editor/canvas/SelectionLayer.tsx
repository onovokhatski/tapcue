// The layer over the page on the editor canvas: one outline per hotspot, to find, select, move and
// resize it (spec ED-2, HS-2; design: hotspotOverlay(), ADR 0012).
import type { Hotspot, HotspotId } from '@tapcue/shared';
import { type PointerEvent, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import { type Handle, moveRect, type Rect, resizeRect, type Size } from '../operations/geometry';

interface SelectionLayerProps {
  hotspots: Hotspot[];
  /** Screen pixels per canvas pixel. */
  scale: number;
  canvas: Size;
  selectedId: HotspotId | null;
  onSelect: (hotspotId: HotspotId | null) => void;
  /** A hotspot's new box while it is dragged or resized, in canvas pixels. */
  onPlace: (hotspotId: HotspotId, rect: Rect) => void;
  /** Whether `fill` mode crops part of the hotspot on the reference screen (spec ED-3). */
  isCropped?: (hotspot: Hotspot) => boolean;
}

/** A chip above a hotspot this close to the canvas top would be cut off; it goes below instead. */
const CHIP_ROOM_PX = 28;

/** The eight handles: which edges each moves, and where it sits in percent of the hotspot. */
const HANDLES: { handle: Handle; left: number; top: number; cursor: string }[] = [
  { handle: 'nw', left: 0, top: 0, cursor: 'nwse-resize' },
  { handle: 'n', left: 50, top: 0, cursor: 'ns-resize' },
  { handle: 'ne', left: 100, top: 0, cursor: 'nesw-resize' },
  { handle: 'e', left: 100, top: 50, cursor: 'ew-resize' },
  { handle: 'se', left: 100, top: 100, cursor: 'nwse-resize' },
  { handle: 's', left: 50, top: 100, cursor: 'ns-resize' },
  { handle: 'sw', left: 0, top: 100, cursor: 'nesw-resize' },
  { handle: 'w', left: 0, top: 50, cursor: 'ew-resize' },
];

/** A drag in progress: what it does, where the pointer started and the box it started from. */
interface Drag {
  hotspotId: HotspotId;
  mode: 'move' | Handle;
  startX: number;
  startY: number;
  start: Rect;
}

export function SelectionLayer({
  hotspots,
  scale,
  canvas,
  selectedId,
  onSelect,
  onPlace,
  isCropped = () => false,
}: SelectionLayerProps) {
  const [hoverId, setHoverId] = useState<HotspotId | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const px = (canvasPixels: number) => Math.round(canvasPixels * scale);

  function startDrag(event: PointerEvent, hotspot: Hotspot, mode: Drag['mode']) {
    event.stopPropagation();
    onSelect(hotspot.id);
    const { x, y, width, height } = hotspot;
    drag.current = {
      hotspotId: hotspot.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      start: { x, y, width, height },
    };
    // Moves outside the hotspot, or outside the canvas, still belong to this drag.
    layer.current?.setPointerCapture?.(event.pointerId);
  }

  function continueDrag(event: PointerEvent) {
    const current = drag.current;
    if (!current) return;
    // The pointer moves in screen pixels; the hotspot lives in canvas pixels.
    const dx = (event.clientX - current.startX) / scale;
    const dy = (event.clientY - current.startY) / scale;
    const rect =
      current.mode === 'move'
        ? moveRect(current.start, dx, dy, canvas)
        : resizeRect(current.start, current.mode, dx, dy, canvas);
    onPlace(current.hotspotId, rect);
  }

  return (
    // A press on the artwork outside every hotspot clears the selection.
    <div
      ref={layer}
      className="absolute inset-0"
      data-testid="selection-layer"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onSelect(null);
      }}
      onPointerMove={continueDrag}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      {/* Project order is stacking order: a later hotspot lies on top, as in the player. */}
      {hotspots.map((hotspot) => {
        const state =
          hotspot.id === selectedId ? 'selected' : hotspot.id === hoverId ? 'hover' : 'idle';
        const top = px(hotspot.y);
        return (
          <button
            key={hotspot.id}
            type="button"
            className={`hs-target absolute ${state === 'selected' ? 'cursor-move' : ''}`}
            style={{
              left: px(hotspot.x),
              top,
              width: px(hotspot.width),
              height: px(hotspot.height),
            }}
            data-overlay={hotspot.id}
            data-state={state}
            aria-label={hotspot.name || 'Unnamed hotspot'}
            aria-pressed={state === 'selected'}
            onPointerDown={(event) => startDrag(event, hotspot, 'move')}
            // Keyboard: Tab reaches each hotspot, Enter or Space selects it.
            onClick={() => onSelect(hotspot.id)}
            onPointerEnter={() => setHoverId(hotspot.id)}
            onPointerLeave={() => setHoverId((id) => (id === hotspot.id ? null : id))}
          >
            <Outline hotspot={hotspot} scale={scale} state={state} />
            <Chip
              state={state}
              name={hotspot.name}
              cropped={isCropped(hotspot)}
              below={top < CHIP_ROOM_PX}
            />
            {state === 'selected' &&
              HANDLES.map(({ handle, left, top: handleTop, cursor }) => (
                <span
                  key={handle}
                  className="hs-handle hs-handle-active"
                  data-handle={handle}
                  style={{ left: `${left}%`, top: `${handleTop}%`, cursor }}
                  onPointerDown={(event) => startDrag(event, hotspot, handle)}
                />
              ))}
          </button>
        );
      })}
    </div>
  );
}

/** Selected and hovered hotspots show their name; a cropped one always shows a warning. */
function Chip({
  state,
  name,
  cropped,
  below,
}: {
  state: 'idle' | 'hover' | 'selected';
  name: string;
  cropped: boolean;
  below: boolean;
}) {
  if (state === 'idle' && !cropped) return null;
  const look = cropped ? 'hs-chip-warn' : state === 'hover' ? 'hs-chip-idle' : '';
  return (
    <span
      className={`hs-chip ${look}`}
      data-below={below || undefined}
      data-cropped={cropped || undefined}
    >
      {cropped && <Icon name="alert" className="h-3 w-3" />}
      {state === 'idle' ? <span className="sr-only">{name} is partly cropped</span> : name}
    </span>
  );
}

function Outline({ hotspot, scale, state }: { hotspot: Hotspot; scale: number; state: string }) {
  const { shape: kind } = hotspot;
  const radius = kind.type === 'rect' ? Math.round(kind.cornerRadius * scale) : 0;
  const shape = (className: string) =>
    kind.type === 'ellipse' ? (
      <ellipse className={className} cx="50%" cy="50%" rx="50%" ry="50%" />
    ) : (
      <rect className={className} x="0" y="0" width="100%" height="100%" rx={radius} />
    );
  return (
    <svg className="hs" data-state={state} width="100%" height="100%" aria-hidden="true">
      {shape('hs-fill')}
      {shape('hs-under')}
      {shape('hs-line')}
    </svg>
  );
}
