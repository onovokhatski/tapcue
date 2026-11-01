// A hotspot's shape, style and press effect in its properties panel (spec HS-3, HS-4, HS-5, ED-10;
// design: hotspotProps(), "Position and size" and "Style").
import type { Hotspot, PageId, PressEffect } from '@tapcue/shared';
import type { ReactNode } from 'react';
import { ColorField } from '../../ui/ColorField';
import { Icon } from '../../ui/Icon';
import { NumberField } from '../../ui/NumberField';
import { Segmented } from '../../ui/Segmented';
import { Select } from '../../ui/Select';
import { useDraft } from '../../ui/useDraft';
import { setPressEffect, setShape, setStyle } from '../operations/hotspots';
import { useEditor } from '../useEditor';

interface Props {
  pageId: PageId;
  hotspot: Hotspot;
}

/** A whole number from min to max, or the reason it is not one. */
const wholeNumber = (min: number, max: number) => (text: string) => {
  if (!/^\d+$/.test(text.trim())) return 'expected a whole number';
  const value = Number(text);
  return value < min || value > max ? `${min} to ${max}` : null;
};

/** Rectangle or ellipse, and the rectangle's corner radius in canvas pixels (spec HS-3). */
export function ShapeRow({ pageId, hotspot }: Props) {
  const change = useEditor((state) => state.change);
  const { shape } = hotspot;
  const radius = useDraft(
    shape.type === 'rect' ? String(shape.cornerRadius) : '',
    wholeNumber(0, 10_000),
    (text) =>
      change((p) => setShape(p, pageId, hotspot.id, { type: 'rect', cornerRadius: Number(text) })),
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
          value={shape.type}
          onChange={(type) =>
            change((p) =>
              setShape(
                p,
                pageId,
                hotspot.id,
                type === 'ellipse' ? { type } : { type, cornerRadius: 0 },
              ),
            )
          }
        />
        <div className="w-[96px]">
          <NumberField
            prefix="R"
            suffix="px"
            ariaLabel="Corner radius"
            // An ellipse fills its box, so it has no corners.
            value={shape.type === 'ellipse' ? '–' : radius.text}
            disabled={shape.type === 'ellipse'}
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

/** Fill, opacity, border and press effect (spec HS-4, HS-5). */
export function StyleFields({ pageId, hotspot }: Props) {
  const change = useEditor((state) => state.change);
  const { style } = hotspot;
  const restyle = (patch: Parameters<typeof setStyle>[3]) =>
    change((p) => setStyle(p, pageId, hotspot.id, patch));
  const opacity = useDraft(String(Math.round(style.opacity * 100)), wholeNumber(0, 100), (text) =>
    restyle({ opacity: Number(text) / 100 }),
  );
  const borderWidth = useDraft(
    style.border ? String(style.border.width) : '',
    wholeNumber(1, 100),
    (text) => {
      if (style.border) restyle({ border: { ...style.border, width: Number(text) } });
    },
  );
  const errors = [
    opacity.error && `Opacity: ${opacity.error}`,
    borderWidth.error && `Border width: ${borderWidth.error}`,
  ].filter(Boolean);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Fill</p>
          <ColorField
            ariaLabel="fill"
            allowNone
            value={style.fill}
            onChange={(fill) => restyle({ fill })}
          />
        </div>
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Opacity</p>
          <NumberField
            suffix="%"
            ariaLabel="Opacity"
            value={opacity.text}
            error={opacity.error !== null}
            onChange={opacity.onChange}
            onBlur={opacity.onBlur}
          />
        </div>
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Border</p>
          <ColorField
            ariaLabel="border"
            allowNone
            value={style.border?.color ?? null}
            // A border keeps its width when its colour changes; a new one starts at 2 px.
            onChange={(color) =>
              restyle({ border: color ? { color, width: style.border?.width ?? 2 } : null })
            }
          />
        </div>
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Border width</p>
          <NumberField
            suffix="px"
            ariaLabel="Border width"
            value={style.border ? borderWidth.text : '–'}
            disabled={!style.border}
            error={borderWidth.error !== null}
            onChange={borderWidth.onChange}
            onBlur={borderWidth.onBlur}
          />
        </div>
      </div>
      {errors.map((error) => (
        <FieldError key={error}>{error}</FieldError>
      ))}
      {!style.fill && !style.border && (
        <p className="text-body-s text-muted">
          No fill and no border: visitors see only the artwork.
        </p>
      )}
      <Select
        label="Press effect"
        size="s"
        value={hotspot.pressEffect}
        options={EFFECTS}
        onChange={(effect) => {
          if (effect) change((p) => setPressEffect(p, pageId, hotspot.id, effect as PressEffect));
        }}
      />
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
