// The properties panel for several selected hotspots (spec ED-16): how many, where their common box
// stands, duplicate and delete them all, and the list of them to pick one.
import type { Hotspot, HotspotId, Page, PageId } from '@tapcue/shared';
import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { NumberField } from '../../ui/NumberField';
import { boundingBox, boxFieldLimits, checkBoxField, type Rect } from '../operations/geometry';
import { deleteHotspots, duplicateHotspots, nudgeHotspots } from '../operations/hotspots';
import { useEditor } from '../useEditor';

export function GroupPanel({ page, hotspots }: { page: Page; hotspots: Hotspot[] }) {
  const project = useEditor((state) => state.project);
  const change = useEditor((state) => state.change);
  const select = useEditor((state) => state.select);
  const copy = useEditor((state) => state.copy);
  const [deleting, setDeleting] = useState(false);
  if (!project) return null;
  const ids = hotspots.map((h) => h.id);
  const count = `${hotspots.length} hotspots`;

  function duplicate() {
    if (!project) return;
    const copied = duplicateHotspots(project, page.id, ids);
    change(() => copied.project);
    select({ pageId: page.id, hotspotIds: copied.hotspotIds });
  }

  return (
    <aside
      aria-label="Hotspot properties"
      className="flex w-[304px] flex-none min-[1440px]:w-[320px] flex-col overflow-y-auto border-l border-default bg-surface"
    >
      <div className="space-y-3 border-b border-default px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-label-m">{count}</h2>
          <div className="-mr-1 flex gap-0.5">
            <Button
              variant="ghost"
              size="s"
              label="Copy"
              title="Copy to paste on any page (Cmd/Ctrl + C)"
              onClick={copy}
            />
            <Button
              variant="ghost"
              size="s"
              icon="copy"
              ariaLabel={`Duplicate ${count}`}
              onClick={duplicate}
            />
            <Button
              variant="ghost"
              size="s"
              icon="trash"
              ariaLabel={`Delete ${count}`}
              onClick={() => setDeleting(true)}
            />
          </div>
        </div>
        <p className="text-body-s text-muted">
          Drag one of them to move them all; the arrow keys nudge them. Shift- or Cmd-click on the
          canvas adds or removes one.
        </p>
      </div>
      <section aria-label="Position" className="space-y-3 border-b border-default px-4 py-4">
        <h3 className="text-overline text-muted uppercase">Position of the group</h3>
        <GroupPosition
          key={ids.join()}
          pageId={page.id}
          ids={ids}
          box={boundingBox(hotspots) ?? { x: 0, y: 0, width: 0, height: 0 }}
          canvas={project.canvas}
        />
      </section>
      <section aria-label="Selected hotspots" className="space-y-2 px-4 py-4">
        <h3 className="text-overline text-muted uppercase">Selected</h3>
        <ul className="-mx-2 space-y-0.5">
          {hotspots.map((hotspot) => (
            <li key={hotspot.id}>
              <button
                type="button"
                className="w-full truncate rounded px-2 py-1.5 text-left text-label-m hover:bg-hover"
                title="Select only this one"
                onClick={() => select({ pageId: page.id, hotspotIds: [hotspot.id] })}
              >
                {hotspot.name || 'Unnamed'}
              </button>
            </li>
          ))}
        </ul>
      </section>
      {deleting && (
        <DeleteHotspotsDialog
          count={hotspots.length}
          onConfirm={() => {
            setDeleting(false);
            change((p) => deleteHotspots(p, page.id, ids));
          }}
          onCancel={() => setDeleting(false)}
        />
      )}
    </aside>
  );
}

/** Asks once before several hotspots go, naming how many (spec ED-16). */
export function DeleteHotspotsDialog({
  count,
  onConfirm,
  onCancel,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      tone="danger"
      title={`Delete ${count} hotspots?`}
      confirmLabel={`Delete ${count} hotspots`}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>Their commands and settings are deleted with them.</p>
    </Dialog>
  );
}

const FIELDS = [
  { key: 'x', prefix: 'X', label: 'Group X' },
  { key: 'y', prefix: 'Y', label: 'Group Y' },
] as const;

/**
 * X and Y of the group's common box in canvas pixels: a valid value moves them all, an invalid one
 * stays with the reason until it is fixed (spec ED-10). The size is shown, not edited.
 */
function GroupPosition({
  pageId,
  ids,
  box,
  canvas,
}: {
  pageId: PageId;
  ids: HotspotId[];
  box: Rect;
  canvas: { width: number; height: number };
}) {
  const change = useEditor((state) => state.change);
  const [texts, setTexts] = useState<Partial<Record<'x' | 'y', string>>>({});
  const errors = FIELDS.flatMap(({ key, label }) => {
    const text = texts[key];
    const error = text === undefined ? null : checkBoxField(key, text, box, canvas);
    return error ? [{ key, message: `${label}: ${error}` }] : [];
  });

  function edit(key: 'x' | 'y', text: string) {
    setTexts((current) => ({ ...current, [key]: text }));
    if (checkBoxField(key, text, box, canvas)) return;
    const delta = Number(text) - box[key];
    change((p) => nudgeHotspots(p, pageId, ids, key === 'x' ? delta : 0, key === 'y' ? delta : 0));
  }

  function leave(key: 'x' | 'y') {
    const text = texts[key];
    if (text !== undefined && !checkBoxField(key, text, box, canvas)) {
      setTexts(({ [key]: _, ...rest }) => rest);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {FIELDS.map(({ key, prefix, label }) => (
          <NumberField
            key={key}
            prefix={prefix}
            ariaLabel={label}
            value={texts[key] ?? String(box[key])}
            {...boxFieldLimits(key, box, canvas)}
            error={errors.some((e) => e.key === key)}
            onChange={(text) => edit(key, text)}
            onBlur={() => leave(key)}
          />
        ))}
      </div>
      <p className="font-mono text-mono-s text-secondary">
        {box.width} × {box.height}
      </p>
      {errors.map((error) => (
        <p key={error.key} className="flex items-start gap-1 text-body-s text-danger-fg">
          <Icon name="alert" className="mt-px h-3.5 w-3.5" />
          <span>{error.message}</span>
        </p>
      ))}
    </>
  );
}
