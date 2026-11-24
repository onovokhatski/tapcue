// The text label of the selected hotspots in the properties panel (spec HS-10, ED-19): the words,
// size, weight, colour, alignment and padding, or a button to add one. For several hotspots only
// the style is shared, and only among those that have a label; the words stay each one's own.
// Each valid change applies at once (spec ED-10).
import type { Hotspot, HotspotText as Text, PageId } from '@tapcue/shared';
import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';
import { ColorField } from '../../ui/ColorField';
import { NumberField } from '../../ui/NumberField';
import { Segmented } from '../../ui/Segmented';
import { TextField } from '../../ui/TextField';
import { useDraft } from '../../ui/useDraft';
import { forEachHotspot, setHotspotText } from '../operations/hotspots';
import { useEditor } from '../useEditor';
import { MIXED, type Shared, shared, sharedText } from './mixed';

interface Props {
  pageId: PageId;
  /** The selected hotspots, in page order: one, or several (spec ED-19). */
  hotspots: Hotspot[];
}

export function HotspotTextFields({ pageId, hotspots }: Props) {
  const change = useEditor((state) => state.change);
  const labelled = hotspots.filter((h) => h.text);
  const ids = labelled.map((h) => h.id);
  /** A change to the labels there are; a hotspot without one does not get one. */
  const edit = (patch: Partial<Text> | null) =>
    change((p) =>
      forEachHotspot(p, pageId, ids, (next, h) => setHotspotText(next, pageId, h.id, patch)),
    );
  const single = hotspots.length === 1 ? hotspots[0] : undefined;

  if (single && !single.text) {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="s"
          icon="plus"
          label="Add text"
          onClick={() => change((p) => setHotspotText(p, pageId, single.id, {}))}
        />
        <span className="text-body-s text-muted">A label drawn on the hotspot</span>
      </div>
    );
  }
  if (labelled.length === 0) {
    return <p className="text-body-s text-muted">None of them has a text label.</p>;
  }
  return (
    <>
      {!single && labelled.length < hotspots.length && (
        <p className="text-body-s text-muted">
          Applies to the {labelled.length} with a text label; the words stay each one&apos;s own.
        </p>
      )}
      <TextFields texts={labelled.map((h) => h.text!)} single={single !== undefined} edit={edit} />
    </>
  );
}

const whole = (min: number, max: number) => (text: string) => {
  if (!/^\d+$/.test(text.trim())) return 'expected a whole number';
  const value = Number(text);
  return value < min || value > max ? `${min} to ${max}` : null;
};

/** A shared choice, or none chosen when they differ. */
const chosen = <T extends string>(value: Shared<T>): T | null => (value === MIXED ? null : value);

function TextFields({
  texts,
  single,
  edit,
}: {
  texts: Text[];
  /** One hotspot: its words can be edited and its label removed. */
  single: boolean;
  edit: (patch: Partial<Text> | null) => void;
}) {
  const content = useDraft(
    texts[0]!.content,
    (value) =>
      value.trim() === ''
        ? 'Type some text, or remove the label'
        : value.length > 500
          ? 'At most 500 characters'
          : null,
    (value) => edit({ content: value }),
  );
  const size = useDraft(
    sharedText(shared(texts.map((t) => t.size)), String),
    whole(8, 400),
    (value) => edit({ size: Number(value) }),
  );
  const padding = useDraft(
    sharedText(shared(texts.map((t) => t.padding)), String),
    whole(0, 500),
    (value) => edit({ padding: Number(value) }),
  );
  const color = shared(texts.map((t) => t.color));
  const errors = [
    size.error && `Size: ${size.error}`,
    padding.error && `Padding: ${padding.error}`,
  ].filter(Boolean);

  return (
    <>
      {single && (
        <TextField
          ariaLabel="Text"
          multiline
          rows={2}
          value={content.text}
          error={content.error}
          onChange={content.onChange}
          onBlur={content.onBlur}
        />
      )}
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Size</p>
          <NumberField
            suffix="px"
            ariaLabel="Text size"
            min={8}
            max={400}
            value={size.text}
            placeholder="Mixed"
            error={size.error !== null}
            onChange={size.onChange}
            onBlur={size.onBlur}
          />
        </div>
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Colour</p>
          <ColorField
            ariaLabel="text"
            value={color === MIXED ? null : color}
            mixed={color === MIXED}
            onChange={(next) => next && edit({ color: next })}
          />
        </div>
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Padding</p>
          <NumberField
            suffix="px"
            ariaLabel="Text padding"
            min={0}
            max={500}
            value={padding.text}
            placeholder="Mixed"
            error={padding.error !== null}
            onChange={padding.onChange}
            onBlur={padding.onBlur}
          />
        </div>
      </div>
      {errors.map((error) => (
        <p key={error} className="text-body-s text-danger-fg">
          {error}
        </p>
      ))}
      <Row label="Weight">
        <Segmented
          label="Text weight"
          options={[
            { value: 'regular', label: 'Regular' },
            { value: 'medium', label: 'Medium' },
            { value: 'bold', label: 'Bold' },
          ]}
          value={chosen(shared(texts.map((t) => t.weight)))}
          onChange={(weight) => edit({ weight })}
        />
      </Row>
      <Row label="Align">
        <Segmented
          label="Text alignment"
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          value={chosen(shared(texts.map((t) => t.align)))}
          onChange={(align) => edit({ align })}
        />
      </Row>
      <Row label="Position">
        <Segmented
          label="Text position"
          options={[
            { value: 'top', label: 'Top' },
            { value: 'middle', label: 'Middle' },
            { value: 'bottom', label: 'Bottom' },
          ]}
          value={chosen(shared(texts.map((t) => t.verticalAlign)))}
          onChange={(verticalAlign) => edit({ verticalAlign })}
        />
      </Row>
      {single && (
        <Button
          variant="ghost"
          size="s"
          icon="trash"
          label="Remove text"
          onClick={() => edit(null)}
        />
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-label-s text-secondary">{label}</p>
      {children}
    </div>
  );
}
