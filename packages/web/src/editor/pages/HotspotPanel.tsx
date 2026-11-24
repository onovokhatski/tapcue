// The properties panel of the selected hotspot: name, exact position and size, shape, style and
// press effect, what a tap does, duplicate, delete and stacking order (spec HS-2–HS-7, ACT-1,
// ED-10; design: hotspotProps()).
import type { Canvas, Hotspot, Page, PageId } from '@tapcue/shared';
import { useState } from 'react';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { NumberField } from '../../ui/NumberField';
import { TextField } from '../../ui/TextField';
import {
  deleteHotspot,
  duplicateHotspot,
  placeHotspot,
  renameHotspot,
  restackHotspot,
} from '../operations/hotspots';
import { croppedBy } from '../canvas/safeArea';
import { nameProblem } from '../operations/hotspotNames';
import { type BoxKey, checkBoxField, boxFieldLimits } from '../operations/geometry';
import { useEditor } from '../useEditor';
import { ArrangeTools } from './ArrangeTools';
import { GroupPanel } from './GroupPanel';
import { PanelSection } from './PanelSection';
import {
  nameSummary,
  onTapSummary,
  positionSummary,
  stackingSummary,
  styleSummary,
  textSummary,
  typeSummary,
} from './summaries';
import { OnTapFields } from './HotspotAction';
import { ShapeRow, StyleFields } from './HotspotStyle';
import { KindFields } from './HotspotFader';
import { HotspotTextFields } from './HotspotText';

export function HotspotPanel() {
  const project = useEditor((state) => state.project);
  const selection = useEditor((state) => state.selection);
  const change = useEditor((state) => state.change);
  const select = useEditor((state) => state.select);
  const copy = useEditor((state) => state.copy);
  const reference = useEditor((state) => state.safeArea.reference);
  const page = project?.pages.find((p) => p.id === selection.pageId);
  const selected = page?.hotspots.filter((h) => selection.hotspotIds.includes(h.id)) ?? [];
  if (page && selected.length > 1) return <GroupPanel page={page} hotspots={selected} />;
  const hotspot = selected[0];
  if (!project || !page || !hotspot) return null;
  const index = page.hotspots.indexOf(hotspot);
  const cropped = croppedBy(hotspot, project.canvas, reference);

  function duplicate() {
    if (!project || !page || !hotspot) return;
    const copy = duplicateHotspot(project, page.id, hotspot.id);
    if (!copy.hotspotId) return;
    change(() => copy.project);
    select({ pageId: page.id, hotspotIds: [copy.hotspotId] });
  }

  return (
    <aside
      aria-label="Hotspot properties"
      className="flex w-[304px] flex-none min-[1440px]:w-[320px] flex-col overflow-y-auto border-l border-default bg-surface"
    >
      <div className="space-y-3 border-b border-default px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-overline text-muted uppercase">Hotspot</h2>
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
        {cropped && (
          // Shown whether or not the safe area is drawn on the canvas (spec ED-3).
          <Banner tone="warning" title="Partly outside the safe area">
            Its {cropped.edge} {cropped.pixels} px {cropped.pixels === 1 ? 'is' : 'are'} cropped on{' '}
            {reference} screens in Fill mode. Move it {AWAY[cropped.edge]} {cropped.pixels} px, or
            use Fit in Settings.
          </Banner>
        )}
      </div>
      {/* From how the hotspot looks to what it does (spec ED-21); each section folds (ED-20). */}
      <PanelSection id="name" title="Name" summary={nameSummary(hotspot)}>
        {/* Keyed, so the fields start afresh for another hotspot. */}
        <NameField key={hotspot.id} page={page} hotspot={hotspot} />
      </PanelSection>
      <PanelSection id="type" title="Type" summary={typeSummary(hotspot)}>
        <KindFields key={`kind-${hotspot.id}`} pageId={page.id} hotspot={hotspot} />
      </PanelSection>
      <PanelSection id="position" title="Position and size" summary={positionSummary([hotspot])}>
        {/* Aligning is about position, so its tools sit next to X and Y (spec ED-18, ED-21). */}
        <ArrangeTools pageId={page.id} hotspots={[hotspot]} />
        <GeometryFields
          key={hotspot.id}
          pageId={page.id}
          hotspot={hotspot}
          canvas={project.canvas}
        />
      </PanelSection>
      <PanelSection id="style" title="Style" summary={styleSummary([hotspot])}>
        <ShapeRow key={`shape-${hotspot.id}`} pageId={page.id} hotspots={[hotspot]} />
        <StyleFields key={`style-${hotspot.id}`} pageId={page.id} hotspots={[hotspot]} />
      </PanelSection>
      <PanelSection id="text" title="Text" summary={textSummary([hotspot])}>
        <HotspotTextFields key={`text-${hotspot.id}`} pageId={page.id} hotspots={[hotspot]} />
      </PanelSection>
      <PanelSection
        id="tap"
        title={hotspot.kind === 'fader' ? 'While dragged' : 'On tap'}
        summary={onTapSummary(hotspot, project)}
      >
        <OnTapFields
          key={`tap-${hotspot.id}`}
          project={project}
          pageId={page.id}
          hotspot={hotspot}
        />
      </PanelSection>
      <PanelSection
        id="stacking"
        title="Stacking"
        summary={stackingSummary(index, page.hotspots.length)}
      >
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
          {stackingSummary(index, page.hotspots.length)}. Where hotspots overlap, the one on top
          gets the tap.
        </p>
      </PanelSection>
    </aside>
  );
}

/** Which way to move a hotspot out of the band at an edge. */
const AWAY = { top: 'down', bottom: 'up', left: 'right', right: 'left' } as const;

/**
 * A name another hotspot on the page has is refused: it stays in the field with the hint until it
 * is changed, and the hotspot keeps its name (spec ED-10, ED-14). A name changed elsewhere (a
 * new kind renames "Button 3" to "Fader 1") replaces the text.
 */
function NameField({ page, hotspot }: { page: Page; hotspot: Hotspot }) {
  const change = useEditor((state) => state.change);
  const [value, setValue] = useState(hotspot.name);
  const [shown, setShown] = useState(hotspot.name);
  if (hotspot.name !== shown) {
    setShown(hotspot.name);
    setValue(hotspot.name);
  }
  const error = nameProblem(page, hotspot.id, value);
  const commit = () => change((p) => renameHotspot(p, page.id, hotspot.id, value));
  return (
    <TextField
      // The section's header already says "Name"; the field keeps it as its accessible name.
      ariaLabel="Name"
      size="s"
      value={value}
      maxLength={100}
      placeholder="Unnamed"
      error={error}
      onChange={setValue}
      onBlur={commit}
      onEnter={commit}
    />
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
      {/* Two by two: a 2048 × 1536 canvas has four-digit values, which one row of four cuts off
          (spec ED-23). */}
      <div className="grid grid-cols-2 gap-1.5">
        {FIELDS.map(({ key, prefix, label }) => (
          <NumberField
            key={key}
            prefix={prefix}
            ariaLabel={label}
            value={texts[key] ?? String(hotspot[key])}
            {...boxFieldLimits(key, hotspot, canvas)}
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
