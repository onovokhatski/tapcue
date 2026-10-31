// The centre of the Pages tab: the selected page drawn by the player's own PageView, always scaled
// to fit, with the selection layer on top (spec ED-2, ED-8; design: canvasToolbar(), canvasStage()).
import type { Canvas, HotspotId, Page } from '@tapcue/shared';
import { PageView } from '../../stage/PageView';
import { stageGeometry } from '../../stage/geometry';
import { useElementSize } from '../../stage/useElementSize';
import { Icon } from '../../ui/Icon';
import { useEditor } from '../useEditor';
import { SelectionLayer } from './SelectionLayer';
import './canvas.css';

/** Room around the page, so its edges and the chips above them stay visible. */
const STAGE_PADDING_PX = 24;

export function EditorCanvas() {
  const project = useEditor((state) => state.project);
  const selection = useEditor((state) => state.selection);
  const select = useEditor((state) => state.select);
  const page = project?.pages.find((p) => p.id === selection.pageId);
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  if (!project || !page) return null;

  const { canvas } = project;
  // Always fit, whatever the project's own scale mode: the whole page must be editable (ED-8).
  const { scale } = stageGeometry(
    canvas,
    { width: stage.width - 2 * STAGE_PADDING_PX, height: stage.height - 2 * STAGE_PADDING_PX },
    'fit',
  );

  return (
    <section aria-label="Canvas" className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-11 flex-none items-center gap-2 border-b border-default bg-surface px-3">
        {/* "Add hotspot" (#76) and "Show safe area" (#78) join here. */}
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
}

function Stage({ page, canvas, scale, selectedId, onSelect }: StageProps) {
  return (
    <div
      className="relative shadow-2"
      style={{ width: canvas.width * scale, height: canvas.height * scale }}
      data-testid="canvas-page"
    >
      {/* The page box has the canvas's exact aspect ratio, so `fit` leaves no bars inside it. */}
      <PageView page={page} canvas={{ ...canvas, scaleMode: 'fit' }} />
      {!page.background && <EmptyCanvas />}
      <SelectionLayer
        hotspots={page.hotspots}
        scale={scale}
        selectedId={selectedId}
        onSelect={onSelect}
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
