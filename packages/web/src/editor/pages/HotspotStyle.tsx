// The shape, style and press effect of the selected hotspots in the properties panel (spec HS-3,
// HS-4, HS-5, ED-10, ED-19; design: hotspotProps(), "Position and size" and "Style"). One hotspot
// or several: a setting they share shows its value, one that differs shows as "Mixed", and a
// change applies to all of them.
import type { Hotspot, PageId, PressEffect, Project, Style } from '@tapcue/shared';
import type { ReactNode } from 'react';
import { ColorField } from '../../ui/ColorField';
import { Icon } from '../../ui/Icon';
import { NumberField } from '../../ui/NumberField';
import { Segmented } from '../../ui/Segmented';
import { Select } from '../../ui/Select';
import { useDraft } from '../../ui/useDraft';
import { forEachHotspot, setPressEffect, setShape, setStyle } from '../operations/hotspots';
import { useEditor } from '../useEditor';
import { HotspotImage } from './HotspotImage';
import { MIXED, shared, sharedText } from './mixed';

interface Props {
  pageId: PageId;
  /** The selected hotspots, in page order: one, or several (spec ED-19). */
  hotspots: Hotspot[];
}

/** A whole number from min to max, or the reason it is not one. */
const wholeNumber = (min: number, max: number) => (text: string) => {
  if (!/^\d+$/.test(text.trim())) return 'expected a whole number';
  const value = Number(text);
  return value < min || value > max ? `${min} to ${max}` : null;
};

/** Applies `operation` to every selected hotspot as one change. */
function useEach(pageId: PageId, hotspots: Hotspot[]) {
  const change = useEditor((state) => state.change);
  const ids = hotspots.map((h) => h.id);
  return (operation: (project: Project, hotspot: Hotspot) => Project) =>
    change((p) => forEachHotspot(p, pageId, ids, operation));
}

/** Rectangle or ellipse, and the rectangle's corner radius in canvas pixels (spec HS-3). */
export function ShapeRow({ pageId, hotspots }: Props) {
  const each = useEach(pageId, hotspots);
  const type = shared(hotspots.map((h) => h.shape.type));
  const rects = hotspots.filter((h) => h.shape.type === 'rect');
  const radiusValue = shared(
    rects.map((h) => (h.shape.type === 'rect' ? h.shape.cornerRadius : 0)),
  );
  // A radius is given to the rectangles; an ellipse fills its box, so it has no corners.
  const radius = useDraft(sharedText(radiusValue, String), wholeNumber(0, 10_000), (text) =>
    each((p, h) =>
      h.shape.type === 'rect'
        ? setShape(p, pageId, h.id, { type: 'rect', cornerRadius: Number(text) })
        : p,
    ),
  );
  return (
    <>
      <div className="flex items-center gap-2">
        <Segmented
          label="Shape"
          options={[
            { value: 'rect', label: 'Rectangle' },
            { value: 'ellipse', label: 'Ellipse' },
          ]}
          value={type === MIXED ? null : type}
          onChange={(next) =>
            each((p, h) =>
              setShape(
                p,
                pageId,
                h.id,
                next === 'ellipse'
                  ? { type: next }
                  : // A rectangle keeps its own radius; one made from an ellipse starts square.
                    {
                      type: next,
                      cornerRadius: h.shape.type === 'rect' ? h.shape.cornerRadius : 0,
                    },
              ),
            )
          }
        />
        <div className="w-[96px]">
          <NumberField
            prefix="R"
            suffix="px"
            ariaLabel="Corner radius"
            min={0}
            max={10_000}
            value={rects.length === 0 ? '–' : radius.text}
            placeholder="Mixed"
            disabled={rects.length === 0}
            error={radius.error !== null}
            onChange={radius.onChange}
            onBlur={radius.onBlur}
          />
        </div>
      </div>
      {radius.error && <FieldError>Corner radius: {radius.error}</FieldError>}
    </>
  );
}

const EFFECTS: { value: PressEffect; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'press', label: 'Press-in' },
  { value: 'ripple', label: 'Ripple' },
];

/**
 * Fill and its opacity, border, opacity, frost, and the press effect (spec HS-4, HS-5, HS-8); for
 * one hotspot its image too (HS-9), which is its own and not shared.
 */
export function StyleFields({ pageId, hotspots }: Props) {
  const each = useEach(pageId, hotspots);
  /** A style change per hotspot; null leaves that hotspot as it is. */
  const restyle = (patch: (style: Style) => Partial<Style> | null) =>
    each((p, h) => {
      const next = patch(h.style);
      return next ? setStyle(p, pageId, h.id, next) : p;
    });
  const styles = hotspots.map((h) => h.style);
  const fill = shared(styles.map((s) => s.fill));
  const border = shared(styles.map((s) => s.border?.color ?? null));
  const filled = styles.filter((s) => s.fill);
  const bordered = styles.filter((s) => s.border);
  const percent = (value: number) => String(Math.round(value * 100));

  const opacity = useDraft(
    sharedText(shared(styles.map((s) => s.opacity)), percent),
    wholeNumber(0, 100),
    (text) => restyle(() => ({ opacity: Number(text) / 100 })),
  );
  // A width is given to the hotspots that have a border.
  const borderWidth = useDraft(
    sharedText(shared(bordered.map((s) => s.border?.width ?? 0)), String),
    wholeNumber(1, 100),
    (text) =>
      restyle((style) =>
        style.border ? { border: { ...style.border, width: Number(text) } } : null,
      ),
  );
  // The fill's own opacity in percent (spec HS-4); 100 % is stored as no field. Given to the
  // hotspots that have a fill.
  const fillOpacity = useDraft(
    sharedText(shared(filled.map((s) => s.fillOpacity ?? 1)), percent),
    wholeNumber(0, 100),
    (text) => restyle((style) => (style.fill ? { fillOpacity: Number(text) / 100 } : null)),
  );
  // Frost (spec HS-8): 0 is no blur, stored as no field.
  const frost = useDraft(
    sharedText(shared(styles.map((s) => s.backdropBlur ?? 0)), String),
    wholeNumber(0, 100),
    (text) => restyle(() => ({ backdropBlur: Number(text) })),
  );
  const errors = [
    fillOpacity.error && `Fill opacity: ${fillOpacity.error}`,
    opacity.error && `Opacity: ${opacity.error}`,
    borderWidth.error && `Border width: ${borderWidth.error}`,
    frost.error && `Frost: ${frost.error}`,
  ].filter(Boolean);
  const single = hotspots.length === 1 ? hotspots[0] : undefined;
  const buttons = hotspots.filter((h) => h.kind !== 'fader');
  const effect = shared(buttons.map((h) => h.pressEffect));

  return (
    <>
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Fill</p>
          <ColorField
            ariaLabel="fill"
            allowNone
            value={fill === MIXED ? null : fill}
            mixed={fill === MIXED}
            onChange={(next) => restyle(() => ({ fill: next }))}
          />
        </div>
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Fill opacity</p>
          <NumberField
            suffix="%"
            ariaLabel="Fill opacity"
            min={0}
            max={100}
            value={filled.length > 0 ? fillOpacity.text : '–'}
            placeholder="Mixed"
            disabled={filled.length === 0}
            error={fillOpacity.error !== null}
            onChange={fillOpacity.onChange}
            onBlur={fillOpacity.onBlur}
          />
        </div>
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Border</p>
          <ColorField
            ariaLabel="border"
            allowNone
            value={border === MIXED ? null : border}
            mixed={border === MIXED}
            // A border keeps its width when its colour changes; a new one starts at 2 px.
            onChange={(color) =>
              restyle((style) => ({
                border: color ? { color, width: style.border?.width ?? 2 } : null,
              }))
            }
          />
        </div>
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Border width</p>
          <NumberField
            suffix="px"
            ariaLabel="Border width"
            min={1}
            max={100}
            value={bordered.length > 0 ? borderWidth.text : '–'}
            placeholder="Mixed"
            disabled={bordered.length === 0}
            error={borderWidth.error !== null}
            onChange={borderWidth.onChange}
            onBlur={borderWidth.onBlur}
          />
        </div>
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Opacity</p>
          <NumberField
            suffix="%"
            ariaLabel="Opacity"
            min={0}
            max={100}
            value={opacity.text}
            placeholder="Mixed"
            error={opacity.error !== null}
            onChange={opacity.onChange}
            onBlur={opacity.onBlur}
          />
        </div>
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Frost</p>
          <NumberField
            suffix="px"
            ariaLabel="Frost"
            min={0}
            max={100}
            value={frost.text}
            placeholder="Mixed"
            error={frost.error !== null}
            onChange={frost.onChange}
            onBlur={frost.onBlur}
          />
        </div>
      </div>
      {errors.map((error) => (
        <FieldError key={error}>{error}</FieldError>
      ))}
      {single && <HotspotImage pageId={pageId} hotspot={single} />}
      {single &&
        !single.style.fill &&
        !single.style.border &&
        !single.style.backdropBlur &&
        !single.style.image &&
        !single.text && (
          <p className="text-body-s text-muted">
            No fill and no border: visitors see only the artwork.
          </p>
        )}
      {/* A fader is dragged, not pressed (ADR 0020): it keeps no press effect. */}
      {buttons.length > 0 && (
        <Select
          label="Press effect"
          size="s"
          {...(effect === MIXED ? { placeholder: 'Mixed' } : {})}
          value={effect === MIXED ? null : effect}
          options={EFFECTS}
          onChange={(next) => {
            if (!next) return;
            each((p, h) =>
              h.kind === 'fader' ? p : setPressEffect(p, pageId, h.id, next as PressEffect),
            );
          }}
        />
      )}
      {buttons.length > 0 && buttons.length < hotspots.length && (
        <p className="text-body-s text-muted">
          Faders have no press effect: it applies to the {buttons.length}{' '}
          {buttons.length === 1 ? 'button' : 'buttons'}.
        </p>
      )}
    </>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1 text-body-s text-danger-fg">
      <Icon name="alert" className="mt-px h-3.5 w-3.5" />
      <span>{children}</span>
    </p>
  );
}
