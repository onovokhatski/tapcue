// The layer over the page on the editor canvas: one outline per hotspot, to find, select, move and
// resize it (spec ED-2, HS-2, ED-16; design: hotspotOverlay(), ADR 0012). Shift- or Cmd/Ctrl-click
// adds or removes a hotspot, a rectangle dragged on the empty page selects what it touches, and
// dragging one of several selected moves them all; only a single hotspot shows resize handles.
import type { Hotspot, HotspotId } from '@tapcue/shared';
import { type MouseEvent, type PointerEvent, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';
import {
  type Handle,
  moveGroup,
  overlaps,
  type Rect,
  rectBetween,
  resizeRect,
  type Size,
} from '../operations/geometry';

interface SelectionLayerProps {
  hotspots: Hotspot[];
  /** Screen pixels per canvas pixel. */
  scale: number;
  canvas: Size;
  selectedIds: HotspotId[];
  onSelect: (hotspotIds: HotspotId[]) => void;
  /** The hotspots' new boxes while they are dragged or resized, in canvas pixels. */
  onPlace: (rects: Record<HotspotId, Rect>) => void;
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

/** A drag in progress: what it does, where the pointer started and the boxes it started from. */
interface Drag {
  /** The hotspot pressed; a press that does not move selects only it (spec ED-16). */
  hotspotId: HotspotId;
  mode: 'move' | Handle;
  startX: number;
  startY: number;
  starts: Record<HotspotId, Rect>;
  moved: boolean;
}

/** A selection rectangle in progress, in canvas pixels from where the press started. */
interface Marquee {
  start: { x: number; y: number };
  rect: Rect;
  /** The selection it adds to: with Shift or Cmd/Ctrl, the one before; otherwise none. */
  base: HotspotId[];
}

/** Shift, Cmd or Ctrl held: the press adds or removes instead of replacing the selection. */
const additive = (event: PointerEvent | MouseEvent) =>
  event.shiftKey || event.metaKey || event.ctrlKey;

/** The hotspots a selection rectangle touches, in page order (spec ED-16). */
export function hotspotsInRect(hotspots: Hotspot[], rect: Rect): HotspotId[] {
  return hotspots.filter((h) => overlaps(h, rect)).map((h) => h.id);
}

/** The selection with `id` added, or taken out if it was in. */
export function toggled(selection: HotspotId[], id: HotspotId): HotspotId[] {
  return selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
}

export function SelectionLayer({
  hotspots,
  scale,
  canvas,
  selectedIds,
  onSelect,
  onPlace,
  isCropped = () => false,
}: SelectionLayerProps) {
  const [hoverId, setHoverId] = useState<HotspotId | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const px = (canvasPixels: number) => Math.round(canvasPixels * scale);
  const single = selectedIds.length === 1;

  /** Where the pointer is, in canvas pixels. */
  function canvasPoint(event: PointerEvent) {
    const box = layer.current?.getBoundingClientRect();
    return {
      x: (event.clientX - (box?.left ?? 0)) / scale,
      y: (event.clientY - (box?.top ?? 0)) / scale,
    };
  }

  function startDrag(event: PointerEvent, hotspot: Hotspot, mode: Drag['mode']) {
    event.stopPropagation();
    if (mode === 'move' && additive(event)) {
      onSelect(toggled(selectedIds, hotspot.id));
      return;
    }
    // Pressing one of the selected keeps the group, to move it; any other is selected alone.
    const group = mode === 'move' && selectedIds.includes(hotspot.id) ? selectedIds : [hotspot.id];
    onSelect(group);
    const starts: Record<HotspotId, Rect> = {};
    for (const h of hotspots) {
      if (group.includes(h.id)) starts[h.id] = { x: h.x, y: h.y, width: h.width, height: h.height };
    }
    drag.current = {
      hotspotId: hotspot.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      starts,
      moved: false,
    };
    // Moves outside the hotspot, or outside the canvas, still belong to this drag.
    layer.current?.setPointerCapture?.(event.pointerId);
  }

  function startMarquee(event: PointerEvent) {
    const start = canvasPoint(event);
    const base = additive(event) ? selectedIds : [];
    // A press on the empty page clears the selection at once, unless it adds to it.
    onSelect(base);
    setMarquee({ start, rect: { ...start, width: 0, height: 0 }, base });
    layer.current?.setPointerCapture?.(event.pointerId);
  }

  function continueDrag(event: PointerEvent) {
    if (marquee) {
      const rect = rectBetween(marquee.start, canvasPoint(event));
      setMarquee({ ...marquee, rect });
      // The store keeps each hotspot once, in page order.
      onSelect([...marquee.base, ...hotspotsInRect(hotspots, rect)]);
      return;
    }
    const current = drag.current;
    if (!current) return;
    // The pointer moves in screen pixels; the hotspots live in canvas pixels.
    const dx = (event.clientX - current.startX) / scale;
    const dy = (event.clientY - current.startY) / scale;
    if (dx !== 0 || dy !== 0) current.moved = true;
    if (current.mode === 'move') {
      onPlace(moveGroup(current.starts, dx, dy, canvas));
    } else {
      const start = current.starts[current.hotspotId]!;
      onPlace({ [current.hotspotId]: resizeRect(start, current.mode, dx, dy, canvas) });
    }
  }

  function endDrag() {
    const current = drag.current;
    drag.current = null;
    // A press on one of several that did not move it: that one alone is selected.
    if (current && !current.moved && Object.keys(current.starts).length > 1) {
      onSelect([current.hotspotId]);
    }
    setMarquee(null);
  }

  return (
    // A press on the artwork outside every hotspot starts a selection rectangle.
    <div
      ref={layer}
      className="absolute inset-0"
      data-testid="selection-layer"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) startMarquee(event);
      }}
      onPointerMove={continueDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Project order is stacking order: a later hotspot lies on top, as in the player. */}
      {hotspots.map((hotspot) => {
        const state = selectedIds.includes(hotspot.id)
          ? 'selected'
          : hotspot.id === hoverId
            ? 'hover'
            : 'idle';
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
            // Keyboard: Tab reaches each hotspot, Enter or Space selects it, with Shift adds it.
            // A mouse click was handled on the press (detail > 0).
            onClick={(event) => {
              if (event.detail > 0) return;
              onSelect(additive(event) ? toggled(selectedIds, hotspot.id) : [hotspot.id]);
            }}
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
              single &&
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
      {marquee && (
        <span
          className="pointer-events-none absolute border border-accent-strong bg-selection opacity-60"
          data-testid="marquee"
          style={{
            left: px(marquee.rect.x),
            top: px(marquee.rect.y),
            width: px(marquee.rect.width),
            height: px(marquee.rect.height),
          }}
        />
      )}
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
