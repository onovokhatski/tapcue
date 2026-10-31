// The layer over the page on the editor canvas: one outline per hotspot, to find and select it
// (spec ED-2; design: hotspotOverlay()). Moving and resizing come with #76.
import type { Hotspot, HotspotId } from '@tapcue/shared';
import { useState } from 'react';

interface SelectionLayerProps {
  hotspots: Hotspot[];
  /** Screen pixels per canvas pixel. */
  scale: number;
  selectedId: HotspotId | null;
  onSelect: (hotspotId: HotspotId | null) => void;
}

/** A chip above a hotspot this close to the canvas top would be cut off; it goes below instead. */
const CHIP_ROOM_PX = 28;

/** The eight handles: corners and edge midpoints, in percent of the hotspot. */
const HANDLES = [
  [0, 0],
  [50, 0],
  [100, 0],
  [100, 50],
  [100, 100],
  [50, 100],
  [0, 100],
  [0, 50],
] as const;

export function SelectionLayer({ hotspots, scale, selectedId, onSelect }: SelectionLayerProps) {
  const [hoverId, setHoverId] = useState<HotspotId | null>(null);
  const px = (canvasPixels: number) => Math.round(canvasPixels * scale);

  return (
    // A press on the artwork outside every hotspot clears the selection.
    <div
      className="absolute inset-0"
      data-testid="selection-layer"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onSelect(null);
      }}
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
            className="hs-target absolute"
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
            onPointerDown={() => onSelect(hotspot.id)}
            // Keyboard: Tab reaches each hotspot, Enter or Space selects it.
            onClick={() => onSelect(hotspot.id)}
            onPointerEnter={() => setHoverId(hotspot.id)}
            onPointerLeave={() => setHoverId((id) => (id === hotspot.id ? null : id))}
          >
            <Outline hotspot={hotspot} scale={scale} state={state} />
            {state !== 'idle' && (
              <span
                className={`hs-chip ${state === 'hover' ? 'hs-chip-idle' : ''}`}
                data-below={top < CHIP_ROOM_PX || undefined}
              >
                {hotspot.name}
              </span>
            )}
            {state === 'selected' &&
              HANDLES.map(([x, y]) => (
                <span
                  key={`${x}-${y}`}
                  className="hs-handle"
                  style={{ left: `${x}%`, top: `${y}%` }}
                />
              ))}
          </button>
        );
      })}
    </div>
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
