// The bands `fill` mode crops on the reference screen, drawn over the page, with dashed safe lines
// and a chip naming the screen and the size (spec ED-3; design: crop-zone, safe-line, canvas-chip).
import { Icon } from '../../ui/Icon';
import type { CropBands, ReferenceScreen } from './safeArea';

interface SafeAreaOverlayProps {
  bands: CropBands;
  reference: ReferenceScreen;
  /** Screen pixels per canvas pixel. */
  scale: number;
}

export function SafeAreaOverlay({ bands, reference, scale }: SafeAreaOverlayProps) {
  const top = Math.round(bands.top * scale);
  const side = Math.round(bands.side * scale);
  if (top === 0 && side === 0) return null;
  const label = `Cropped on ${reference} in Fill · ${bands.top || bands.side} px`;
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="safe-area">
      {top > 0 && (
        <>
          <div className="crop-zone inset-x-0 top-0" style={{ height: top }} data-band="top" />
          <div
            className="crop-zone inset-x-0 bottom-0"
            style={{ height: top }}
            data-band="bottom"
          />
          <div className="safe-line inset-x-0 h-0.5" style={{ top: top - 1 }} />
          <div className="safe-line inset-x-0 h-0.5" style={{ bottom: top - 1 }} />
        </>
      )}
      {side > 0 && (
        <>
          <div className="crop-zone inset-y-0 left-0" style={{ width: side }} data-band="left" />
          <div className="crop-zone inset-y-0 right-0" style={{ width: side }} data-band="right" />
          <div className="safe-line inset-y-0 w-0.5" style={{ left: side - 1 }} />
          <div className="safe-line inset-y-0 w-0.5" style={{ right: side - 1 }} />
        </>
      )}
      <span className="canvas-chip absolute top-2 left-2">
        <Icon name="crop" className="h-3 w-3" />
        {label}
      </span>
    </div>
  );
}
