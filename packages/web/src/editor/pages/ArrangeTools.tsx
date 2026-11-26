// The row of align, distribute and size buttons at the top of the panel for a selection
// (spec ED-18). One hotspot aligns to the canvas; several align to their common box, spread with
// equal gaps when there are three or more, and take the size of the first one listed.
import type { Hotspot, PageId } from '@tapcue/shared';
import { Button } from '../../ui/Button';
import type { IconName } from '../../ui/Icon';
import {
  type Alignment,
  alignHotspots,
  type Axis,
  type Dimension,
  distributeHotspots,
  matchSize,
} from '../operations/align';
import { useEditor } from '../useEditor';

const ALIGN: { alignment: Alignment; icon: IconName; label: string }[] = [
  { alignment: 'left', icon: 'align-left', label: 'Align left' },
  { alignment: 'center', icon: 'align-center', label: 'Align centre' },
  { alignment: 'right', icon: 'align-right', label: 'Align right' },
  { alignment: 'top', icon: 'align-top', label: 'Align top' },
  { alignment: 'middle', icon: 'align-middle', label: 'Align middle' },
  { alignment: 'bottom', icon: 'align-bottom', label: 'Align bottom' },
];

const DISTRIBUTE: { axis: Axis; icon: IconName; label: string }[] = [
  { axis: 'horizontal', icon: 'distribute-h', label: 'Distribute horizontally' },
  { axis: 'vertical', icon: 'distribute-v', label: 'Distribute vertically' },
];

const SIZE: { dimension: Dimension; icon: IconName; label: string }[] = [
  { dimension: 'width', icon: 'same-width', label: 'Same width' },
  { dimension: 'height', icon: 'same-height', label: 'Same height' },
  { dimension: 'both', icon: 'same-size', label: 'Same size' },
];

/** `hotspots` are the selected ones in page order; the first is the model for "same size". */
export function ArrangeTools({ pageId, hotspots }: { pageId: PageId; hotspots: Hotspot[] }) {
  const change = useEditor((state) => state.change);
  const ids = hotspots.map((h) => h.id);
  const group = hotspots.length > 1;
  const first = hotspots[0]?.name || 'the first one';
  const to = group ? 'their common box' : 'the canvas';
  return (
    <div role="toolbar" aria-label="Arrange" className="-mx-1 flex flex-wrap items-center gap-y-1">
      {ALIGN.map(({ alignment, icon, label }) => (
        <Button
          key={alignment}
          variant="ghost"
          size="s"
          icon={icon}
          ariaLabel={label}
          title={`${label}, to ${to}`}
          onClick={() => change((p) => alignHotspots(p, pageId, ids, alignment))}
        />
      ))}
      {group && (
        <>
          <span className="mx-1 h-5 w-px bg-pressed" aria-hidden="true" />
          {DISTRIBUTE.map(({ axis, icon, label }) => (
            <Button
              key={axis}
              variant="ghost"
              size="s"
              icon={icon}
              ariaLabel={label}
              title={
                hotspots.length < 3
                  ? `${label}: select three or more`
                  : `${label}, with equal gaps; the outermost stay`
              }
              disabled={hotspots.length < 3}
              onClick={() => change((p) => distributeHotspots(p, pageId, ids, axis))}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-pressed" aria-hidden="true" />
          {SIZE.map(({ dimension, icon, label }) => (
            <Button
              key={dimension}
              variant="ghost"
              size="s"
              icon={icon}
              ariaLabel={label}
              title={`${label} as ${first}`}
              onClick={() => change((p) => matchSize(p, pageId, ids, dimension))}
            />
          ))}
        </>
      )}
    </div>
  );
}
