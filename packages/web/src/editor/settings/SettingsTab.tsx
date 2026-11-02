// The Settings tab: the canvas every page is drawn on — its size, background colour and scale mode,
// with diagrams of each mode on the reference screens — and the project's export and import
// (spec CNV-1, CNV-2, ED-4, ED-10, PRJ-3, PRJ-4; design: settingsScreen(), frames G1–G3).
import type { Canvas, Project, ScaleMode } from '@tapcue/shared';
import { ColorField } from '../../ui/ColorField';
import { Icon } from '../../ui/Icon';
import { NumberField } from '../../ui/NumberField';
import { Segmented } from '../../ui/Segmented';
import { useDraft } from '../../ui/useDraft';
import type { ReferenceScreen } from '../canvas/safeArea';
import { checkCanvasSize, updateCanvas } from '../operations/canvas';
import { useEditor } from '../useEditor';
import { ProjectCard } from './ProjectCard';
import { ScaleDiagram } from './ScaleDiagram';

const MODES: { value: ScaleMode; label: string }[] = [
  { value: 'fit', label: 'Fit' },
  { value: 'fill', label: 'Fill' },
];
const REFERENCES: ReferenceScreen[] = ['16:10', '16:9'];

export function SettingsTab() {
  const project = useEditor((state) => state.project);
  if (!project) return null;
  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)_340px] items-start gap-6 p-6">
        <CanvasCard project={project} />
        <ProjectCard />
      </div>
    </main>
  );
}

function CanvasCard({ project }: { project: Project }) {
  const change = useEditor((state) => state.change);
  const { canvas } = project;
  const update = (patch: Partial<Canvas>) => change((p) => updateCanvas(p, patch));

  return (
    <section aria-label="Canvas" className="rounded-lg border border-default bg-surface">
      <div className="flex h-12 items-center border-b border-default px-5">
        <h2 className="text-heading-m">Canvas</h2>
      </div>
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-start gap-3">
          <SizeField project={project} dimension="width" label="Width" />
          <SizeField project={project} dimension="height" label="Height" />
          <div className="w-[200px] space-y-1">
            <p className="text-label-s text-secondary">Background colour</p>
            <ColorField
              ariaLabel="background colour"
              value={canvas.backgroundColor}
              onChange={(color) => {
                if (color) update({ backgroundColor: color });
              }}
            />
          </div>
        </div>
        <p className="text-body-s text-muted">
          Every page is drawn at this size. The background colour shows behind artwork and in the
          bars of Fit mode.
        </p>
        <div className="space-y-2 border-t border-default pt-5">
          <p className="text-label-s text-secondary">Scale mode</p>
          <Segmented
            label="Scale mode"
            options={MODES}
            value={canvas.scaleMode}
            onChange={(scaleMode) => update({ scaleMode })}
          />
          <dl className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 gap-y-1 text-body-m">
            <dt className="font-medium">Fit</dt>
            <dd className="text-secondary">
              The whole page is visible. Bars fill the space where aspect ratios differ.
            </dd>
            <dt className="font-medium">Fill</dt>
            <dd className="text-secondary">
              The screen is covered. Edges of the page may be cropped; check hotspots with “Show
              safe area” on the Pages tab.
            </dd>
          </dl>
        </div>
        <ScaleDiagrams canvas={canvas} />
      </div>
    </section>
  );
}

function SizeField({
  project,
  dimension,
  label,
}: {
  project: Project;
  dimension: 'width' | 'height';
  label: string;
}) {
  const change = useEditor((state) => state.change);
  const check = (text: string) =>
    /^\d+$/.test(text.trim())
      ? checkCanvasSize(project, dimension, Number(text))
      : 'Expected a whole number of pixels';
  const draft = useDraft(String(project.canvas[dimension]), check, (text) =>
    change((p) => updateCanvas(p, { [dimension]: Number(text) })),
  );
  return (
    <div className="w-[132px] space-y-1">
      <p className="text-label-s text-secondary">{label}</p>
      <NumberField
        suffix="px"
        ariaLabel={label}
        value={draft.text}
        error={draft.error !== null}
        onChange={draft.onChange}
        onBlur={draft.onBlur}
      />
      {draft.error && (
        // Wider than the field: the message names a hotspot.
        <p className="flex w-[280px] items-start gap-1 text-body-s text-danger-fg">
          <Icon name="alert" className="mt-px h-3.5 w-3.5 flex-none" />
          <span>{draft.error}</span>
        </p>
      )}
    </div>
  );
}

/** Both modes on both reference screens; the canvas's own mode is marked "Current". */
function ScaleDiagrams({ canvas }: { canvas: Canvas }) {
  return (
    <div className="rounded-lg border border-default bg-subtle p-4">
      <div className="grid grid-cols-2 gap-4">
        {MODES.map(({ value, label }) => {
          const current = value === canvas.scaleMode;
          return (
            <section
              key={value}
              aria-label={`${label} diagrams`}
              aria-current={current || undefined}
            >
              <h3
                className={`border-b pb-1 text-center text-label-m ${
                  current ? 'border-accent-strong text-primary' : 'border-default text-muted'
                }`}
              >
                {label}
                {current && <span className="text-body-s text-secondary"> · Current</span>}
              </h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {REFERENCES.map((reference) => (
                  <ScaleDiagram
                    key={reference}
                    canvas={canvas}
                    mode={value}
                    reference={reference}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-3 text-body-s text-secondary">{aspectNote(canvas)}</p>
    </div>
  );
}

/** The page's aspect ratio, and what it means for the iPad (1024 × 768, 4:3). */
export function aspectNote({ width, height }: Pick<Canvas, 'width' | 'height'>): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  const ratio = `${width / d}:${height / d}`;
  const page = `The ${width} × ${height} page is ${ratio}`;
  return ratio === '4:3'
    ? `${page}, like the iPad (1024 × 768), so on the iPad both modes show the whole page.`
    : `${page}.`;
}
