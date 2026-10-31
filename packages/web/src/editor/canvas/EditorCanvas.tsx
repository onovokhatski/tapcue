// The centre of the Pages tab: the selected page drawn by the player's own PageView, always scaled
// to fit, with the selection layer on top, "Add hotspot" and the safe area of `fill` mode
// (spec ED-2, ED-3, ED-8, HS-1, HS-2; design: canvasToolbar(), canvasStage()).
import type { Canvas, HotspotId, Page, PageId } from '@tapcue/shared';
import { useEffect } from 'react';
import { PageView } from '../../stage/PageView';
import { stageGeometry } from '../../stage/geometry';
import { useElementSize } from '../../stage/useElementSize';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import type { Rect } from '../operations/geometry';
import { addHotspot, deleteHotspot, nudgeHotspot, placeHotspot } from '../operations/hotspots';
import { useEditor } from '../useEditor';
import { SafeAreaOverlay } from './SafeAreaOverlay';
import { cropBands, croppedBy, REFERENCE_SCREENS, type ReferenceScreen } from './safeArea';
import { SelectionLayer } from './SelectionLayer';
import './canvas.css';

/** Room around the page, so its edges and the chips above them stay visible. */
const STAGE_PADDING_PX = 24;

export function EditorCanvas() {
  const project = useEditor((state) => state.project);
  const selection = useEditor((state) => state.selection);
  const select = useEditor((state) => state.select);
  const change = useEditor((state) => state.change);
  const safeArea = useEditor((state) => state.safeArea);
  const setSafeArea = useEditor((state) => state.setSafeArea);
  const page = project?.pages.find((p) => p.id === selection.pageId);
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const selected = page?.hotspots.find((h) => h.id === selection.hotspotId);
  const place = (hotspotId: HotspotId, rect: Rect) => {
    if (page) change((p) => placeHotspot(p, page.id, hotspotId, rect));
  };
  useArrowNudge(page && selected ? { pageId: page.id, hotspotId: selected.id } : null);
  if (!project || !page) return null;

  const { canvas } = project;
  const fill = canvas.scaleMode === 'fill';
  // Always fit, whatever the project's own scale mode: the whole page must be editable (ED-8).
  const { scale } = stageGeometry(
    canvas,
    { width: stage.width - 2 * STAGE_PADDING_PX, height: stage.height - 2 * STAGE_PADDING_PX },
    'fit',
  );

  return (
    <section aria-label="Canvas" className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-11 flex-none items-center gap-2 border-b border-default bg-surface px-3">
        <Button
          variant="primary"
          icon="plus"
          label="Add hotspot"
          onClick={() => {
            const added = addHotspot(project, page.id);
            if (!added.hotspotId) return;
            change(() => added.project);
            select({ pageId: page.id, hotspotId: added.hotspotId });
          }}
        />
        <span className="mx-1 h-5 w-px bg-pressed" aria-hidden="true" />
        <Button
          icon="crop"
          label="Show safe area"
          pressed={fill && safeArea.show}
          disabled={!fill}
          title={
            fill
              ? undefined
              : 'Nothing is cropped in Fit. Use Fill in Settings to see the safe area.'
          }
          onClick={() => setSafeArea({ show: !safeArea.show })}
        />
        {fill && (
          <label className="ml-2 flex items-center gap-2 text-label-s text-secondary">
            Reference screen
            <select
              className="field h-7 rounded border border-strong bg-surface px-2 text-body-m text-primary"
              value={safeArea.reference}
              onChange={(event) =>
                setSafeArea({ reference: event.target.value as ReferenceScreen })
              }
            >
              {Object.entries(REFERENCE_SCREENS).map(([key, screen]) => (
                <option key={key} value={key}>
                  {screen.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <span
          className="ml-auto inline-flex h-8 flex-none items-center rounded bg-subtle px-2.5 text-body-s text-secondary tabular-nums"
          aria-label={`Canvas scale ${Math.round(scale * 100)} percent`}
        >
          Fit · {Math.round(scale * 100)}%
        </span>
      </div>
      <div
        ref={stageRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-canvas"
      >
        {scale > 0 && (
          <Stage
            page={page}
            canvas={canvas}
            scale={scale}
            selectedId={selection.hotspotId}
            onSelect={(hotspotId) => select({ pageId: page.id, hotspotId })}
            onPlace={place}
            reference={safeArea.reference}
            showSafeArea={fill && safeArea.show}
          />
        )}
        <span className="absolute right-3 bottom-2 font-mono text-mono-s text-secondary">
          {canvas.width} × {canvas.height}
        </span>
      </div>
    </section>
  );
}

interface StageProps {
  page: Page;
  canvas: Canvas;
  scale: number;
  selectedId: HotspotId | null;
  onSelect: (hotspotId: HotspotId | null) => void;
  onPlace: (hotspotId: HotspotId, rect: Rect) => void;
  reference: ReferenceScreen;
  showSafeArea: boolean;
}

function Stage(props: StageProps) {
  const { page, canvas, scale, selectedId, onSelect, onPlace, reference, showSafeArea } = props;
  return (
    <div
      className="relative shadow-2"
      style={{ width: canvas.width * scale, height: canvas.height * scale }}
      data-testid="canvas-page"
    >
      {/* The page box has the canvas's exact aspect ratio, so `fit` leaves no bars inside it. */}
      <PageView page={page} canvas={{ ...canvas, scaleMode: 'fit' }} />
      {!page.background && <EmptyCanvas />}
      {showSafeArea && (
        <SafeAreaOverlay bands={cropBands(canvas, reference)} reference={reference} scale={scale} />
      )}
      {/* Cropped hotspots are flagged even with the bands hidden (spec ED-3). */}
      <SelectionLayer
        hotspots={page.hotspots}
        scale={scale}
        canvas={canvas}
        selectedId={selectedId}
        onSelect={onSelect}
        onPlace={onPlace}
        isCropped={(hotspot) => croppedBy(hotspot, canvas, reference) !== null}
      />
    </div>
  );
}

function EmptyCanvas() {
  return (
    <div className="canvas-empty pointer-events-none absolute inset-4 flex flex-col items-center justify-center gap-2 rounded-lg text-center">
      <Icon name="upload" className="h-6 w-6" />
      <p className="text-label-m">No background yet</p>
      <p className="max-w-[300px] text-body-s opacity-80">
        Choose an image or video in the page panel. Hotspots stay where they are.
      </p>
    </div>
  );
}

const NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Keys for the selected hotspot, unless the focus is in a field, where they edit text. The arrows
 * move it by 1 canvas pixel, with Shift by 10; each step starts from the hotspot as the store has
 * it at that moment, so fast repeats never undo one another. Delete and Backspace delete it.
 */
function useArrowNudge(target: { pageId: PageId; hotspotId: HotspotId } | null) {
  const change = useEditor((state) => state.change);
  const pageId = target?.pageId;
  const hotspotId = target?.hotspotId;
  useEffect(() => {
    if (!pageId || !hotspotId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) {
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        change((project) => deleteHotspot(project, pageId, hotspotId));
        return;
      }
      const step = NUDGE[event.key];
      if (!step || event.altKey || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      const distance = event.shiftKey ? 10 : 1;
      change((project) =>
        nudgeHotspot(project, pageId, hotspotId, step[0] * distance, step[1] * distance),
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [change, pageId, hotspotId]);
}
