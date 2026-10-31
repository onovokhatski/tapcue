// The properties panel of the selected hotspot: name, exact position and size, duplicate, delete
// and stacking order (spec HS-2, HS-6, HS-7, ED-10; design: hotspotProps()). Its action and style
// come with M4.
import type { Canvas, Hotspot, PageId } from '@tapcue/shared';
import { type ReactNode, useState } from 'react';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { NumberField } from '../../ui/NumberField';
import {
  deleteHotspot,
  duplicateHotspot,
  placeHotspot,
  renameHotspot,
  restackHotspot,
} from '../operations/hotspots';
import { type BoxKey, checkBoxField } from '../operations/geometry';
import { useEditor } from '../useEditor';

export function HotspotPanel() {
  const project = useEditor((state) => state.project);
  const selection = useEditor((state) => state.selection);
  const change = useEditor((state) => state.change);
  const select = useEditor((state) => state.select);
  const page = project?.pages.find((p) => p.id === selection.pageId);
  const hotspot = page?.hotspots.find((h) => h.id === selection.hotspotId);
  if (!project || !page || !hotspot) return null;
  const index = page.hotspots.indexOf(hotspot);

  function duplicate() {
    if (!project || !page || !hotspot) return;
    const copy = duplicateHotspot(project, page.id, hotspot.id);
    if (!copy.hotspotId) return;
    change(() => copy.project);
    select({ pageId: page.id, hotspotId: copy.hotspotId });
  }

  return (
    <aside
      aria-label="Hotspot properties"
      className="flex w-[320px] flex-none flex-col overflow-y-auto border-l border-default bg-surface"
    >
      <div className="space-y-3 border-b border-default px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-overline text-muted uppercase">Hotspot</h2>
          <div className="-mr-1 flex gap-0.5">
            <Button
              variant="ghost"
              size="s"
              icon="copy"
              ariaLabel="Duplicate hotspot"
              onClick={duplicate}
            />
            <Button
              variant="ghost"
              size="s"
              icon="trash"
              ariaLabel="Delete hotspot"
              onClick={() => change((p) => deleteHotspot(p, page.id, hotspot.id))}
            />
          </div>
        </div>
        {/* Keyed, so the fields start afresh for another hotspot. */}
        <NameField key={hotspot.id} pageId={page.id} hotspot={hotspot} />
      </div>
      <Section title="Position and size">
        <GeometryFields
          key={hotspot.id}
          pageId={page.id}
          hotspot={hotspot}
          canvas={project.canvas}
        />
      </Section>
      <Section title="Stacking">
        <div className="flex gap-2">
          <Button
            size="s"
            label="Bring forward"
            disabled={index === page.hotspots.length - 1}
            onClick={() => change((p) => restackHotspot(p, page.id, hotspot.id, 'forward'))}
          />
          <Button
            size="s"
            label="Send backward"
            disabled={index === 0}
            onClick={() => change((p) => restackHotspot(p, page.id, hotspot.id, 'backward'))}
          />
        </div>
        <p className="text-body-s text-muted">
          {index + 1} of {page.hotspots.length} from the bottom. Where hotspots overlap, the one on
          top gets the tap.
        </p>
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 border-b border-default px-4 py-4">
      <h3 className="text-overline text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

function NameField({ pageId, hotspot }: { pageId: PageId; hotspot: Hotspot }) {
  const change = useEditor((state) => state.change);
  const [value, setValue] = useState(hotspot.name);
  const commit = () => change((p) => renameHotspot(p, pageId, hotspot.id, value));
  return (
    <label className="block space-y-1">
      <span className="block text-label-s text-secondary">Name</span>
      <input
        className="field h-7 w-full rounded border border-strong bg-surface px-2 text-body-m"
        value={value}
        maxLength={100}
        placeholder="Unnamed"
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
    </label>
  );
}

type Key = BoxKey;
const FIELDS: { key: Key; prefix: string; label: string }[] = [
  { key: 'x', prefix: 'X', label: 'X' },
  { key: 'y', prefix: 'Y', label: 'Y' },
  { key: 'width', prefix: 'W', label: 'Width' },
  { key: 'height', prefix: 'H', label: 'Height' },
];

/**
 * X, Y, W, H in canvas pixels. A valid value applies as it is typed; an invalid one stays in its
 * field with the reason and changes nothing until it is fixed (spec ED-10). A field that is not
 * being edited follows the hotspot, e.g. while it is dragged on the canvas.
 */
function GeometryFields({
  pageId,
  hotspot,
  canvas,
}: {
  pageId: PageId;
  hotspot: Hotspot;
  canvas: Canvas;
}) {
  const change = useEditor((state) => state.change);
  /** Texts the integrator is typing or has left invalid; the rest show the hotspot's values. */
  const [texts, setTexts] = useState<Partial<Record<Key, string>>>({});

  const errors = FIELDS.flatMap(({ key, label }) => {
    const text = texts[key];
    const error = text === undefined ? null : checkBoxField(key, text, hotspot, canvas);
    return error ? [{ key, message: `${label}: ${error}` }] : [];
  });

  function edit(key: Key, text: string) {
    setTexts((current) => ({ ...current, [key]: text }));
    if (checkBoxField(key, text, hotspot, canvas)) return;
    const { x, y, width, height } = hotspot;
    change((p) =>
      placeHotspot(p, pageId, hotspot.id, { x, y, width, height, [key]: Number(text) }),
    );
  }

  function leave(key: Key) {
    const text = texts[key];
    // A valid field goes back to following the hotspot; an invalid one keeps its text and error.
    if (text !== undefined && !checkBoxField(key, text, hotspot, canvas)) {
      setTexts(({ [key]: _, ...rest }) => rest);
    }
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-1.5">
        {FIELDS.map(({ key, prefix, label }) => (
          <NumberField
            key={key}
            prefix={prefix}
            ariaLabel={label}
            value={texts[key] ?? String(hotspot[key])}
            error={errors.some((e) => e.key === key)}
            onChange={(text) => edit(key, text)}
            onBlur={() => leave(key)}
          />
        ))}
      </div>
      {errors.map((error) => (
        <p key={error.key} className="flex items-start gap-1 text-body-s text-danger-fg">
          <Icon name="alert" className="mt-px h-3.5 w-3.5" />
          <span>{error.message}</span>
        </p>
      ))}
    </>
  );
}
