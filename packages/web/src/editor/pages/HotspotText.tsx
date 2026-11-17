// The hotspot's text label in its properties panel (spec HS-10): the words, size, weight, colour,
// alignment and padding, or a button to add one. Each valid change applies at once (spec ED-10).
import type { Hotspot, HotspotText as Text, PageId } from '@tapcue/shared';
import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';
import { ColorField } from '../../ui/ColorField';
import { NumberField } from '../../ui/NumberField';
import { Segmented } from '../../ui/Segmented';
import { TextField } from '../../ui/TextField';
import { useDraft } from '../../ui/useDraft';
import { setHotspotText } from '../operations/hotspots';
import { useEditor } from '../useEditor';

interface Props {
  pageId: PageId;
  hotspot: Hotspot;
}

export function HotspotTextFields({ pageId, hotspot }: Props) {
  const change = useEditor((state) => state.change);
  const edit = (patch: Partial<Text> | null) =>
    change((p) => setHotspotText(p, pageId, hotspot.id, patch));

  if (!hotspot.text) {
    return (
      <div className="flex items-center gap-2">
        <Button size="s" icon="plus" label="Add text" onClick={() => edit({})} />
        <span className="text-body-s text-muted">A label drawn on the hotspot</span>
      </div>
    );
  }
  return <TextFields text={hotspot.text} edit={edit} />;
}

const whole = (min: number, max: number) => (text: string) => {
  if (!/^\d+$/.test(text.trim())) return 'expected a whole number';
  const value = Number(text);
  return value < min || value > max ? `${min} to ${max}` : null;
};

function TextFields({ text, edit }: { text: Text; edit: (patch: Partial<Text> | null) => void }) {
  const content = useDraft(
    text.content,
    (value) =>
      value.trim() === ''
        ? 'Type some text, or remove the label'
        : value.length > 500
          ? 'At most 500 characters'
          : null,
    (value) => edit({ content: value }),
  );
  const size = useDraft(String(text.size), whole(8, 400), (value) => edit({ size: Number(value) }));
  const padding = useDraft(String(text.padding), whole(0, 500), (value) =>
    edit({ padding: Number(value) }),
  );
  const errors = [
    size.error && `Size: ${size.error}`,
    padding.error && `Padding: ${padding.error}`,
  ].filter(Boolean);

  return (
    <>
      <TextField
        ariaLabel="Text"
        multiline
        rows={2}
        value={content.text}
        error={content.error}
        onChange={content.onChange}
        onBlur={content.onBlur}
      />
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Size</p>
          <NumberField
            suffix="px"
            ariaLabel="Text size"
            min={8}
            max={400}
            value={size.text}
            error={size.error !== null}
            onChange={size.onChange}
            onBlur={size.onBlur}
          />
        </div>
        <div className="space-y-1">
          <p className="text-label-s text-secondary">Colour</p>
          <ColorField
            ariaLabel="text"
            value={text.color}
            onChange={(color) => color && edit({ color })}
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
          value={text.weight}
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
          value={text.align}
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
          value={text.verticalAlign}
          onChange={(verticalAlign) => edit({ verticalAlign })}
        />
      </Row>
      <Button
        variant="ghost"
        size="s"
        icon="trash"
        label="Remove text"
        onClick={() => edit(null)}
      />
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
