// The New project dialog: a name and a canvas size, from a common screen or typed in (spec PRJ-6).
// The values are checked here with the same schema the server uses, so most mistakes are shown
// before anything is sent; whatever the server still refuses is shown on its field.
import { NewProject, type ValidationError } from '@tapcue/shared';
import { useState } from 'react';
import type { LibraryApi } from '../../lib/libraryApi';
import { Dialog } from '../../ui/Dialog';
import { NumberField } from '../../ui/NumberField';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';

/** Common stand screens; the first is the size of the demo stand. */
export const SIZE_PRESETS = [
  { label: 'iPad, 4:3 (2048 × 1536)', width: 2048, height: 1536 },
  { label: 'iPad Pro 12.9″, 4:3 (2732 × 2048)', width: 2732, height: 2048 },
  { label: 'Full HD, 16:9 (1920 × 1080)', width: 1920, height: 1080 },
  { label: '16:10 (2560 × 1600)', width: 2560, height: 1600 },
] as const;

const CUSTOM = 'custom';
const presetValue = (width: string, height: string) =>
  SIZE_PRESETS.find((p) => String(p.width) === width && String(p.height) === height)
    ? `${width}x${height}`
    : CUSTOM;

type Field = 'name' | 'width' | 'height';
type FieldErrors = { [K in Field]?: string | undefined };

export function NewProjectDialog({
  api,
  onCreated,
  onCancel,
}: {
  api: LibraryApi;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [width, setWidth] = useState(String(SIZE_PRESETS[0].width));
  const [height, setHeight] = useState(String(SIZE_PRESETS[0].height));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    const parsed = NewProject.safeParse({
      name: name.trim(),
      width: Number(width),
      height: Number(height),
    });
    if (!parsed.success) {
      setErrors(
        byField(parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))),
      );
      return;
    }
    setBusy(true);
    setFailure(null);
    const created = await api.create(parsed.data).catch(() => null);
    setBusy(false);
    if (created === null) return setFailure('The server could not be reached.');
    if (created.ok) return onCreated(created.id);
    setErrors(byField(created.errors));
    if (created.errors.length === 0) setFailure(created.reason);
  }

  const typed = (field: Field, set: (text: string) => void) => (text: string) => {
    set(text);
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  return (
    <Dialog
      title="New project"
      confirmLabel={busy ? 'Creating…' : 'Create and open'}
      confirmDisabled={busy}
      focusButton={false}
      onConfirm={() => void create()}
      onCancel={onCancel}
    >
      <p>An empty project with one page and one station, “Main”. It opens on every station.</p>
      <div className="space-y-4 pt-2">
        <TextField
          label="Name"
          value={name}
          placeholder="e.g. WePlay 2026"
          maxLength={100}
          autoFocus
          error={errors.name ?? null}
          onChange={typed('name', setName)}
          onEnter={() => void create()}
        />
        <Select
          label="Canvas size"
          value={presetValue(width, height)}
          options={[
            ...SIZE_PRESETS.map((p) => ({ value: `${p.width}x${p.height}`, label: p.label })),
            { value: CUSTOM, label: 'Custom' },
          ]}
          onChange={(value) => {
            const preset = SIZE_PRESETS.find((p) => `${p.width}x${p.height}` === value);
            if (!preset) return;
            setWidth(String(preset.width));
            setHeight(String(preset.height));
            setErrors((current) => ({ ...current, width: undefined, height: undefined }));
          }}
        />
        <div className="flex gap-3">
          <SizeInput
            label="Width"
            value={width}
            error={errors.width}
            onChange={typed('width', setWidth)}
          />
          <SizeInput
            label="Height"
            value={height}
            error={errors.height}
            onChange={typed('height', setHeight)}
          />
        </div>
        <p className="text-body-s text-muted">
          Every page is drawn at this size; it can be changed later in Settings.
        </p>
        {failure && (
          <p role="alert" className="text-body-s text-danger-fg">
            {failure}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function SizeInput({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error: string | undefined;
  onChange: (text: string) => void;
}) {
  return (
    <div className="w-[160px] space-y-1">
      <p className="text-label-s text-secondary">{label}</p>
      <NumberField
        ariaLabel={label}
        suffix="px"
        min={1}
        max={8192}
        value={value}
        error={error !== undefined}
        onChange={onChange}
      />
      {error && <p className="text-body-s text-danger-fg">{error}</p>}
    </div>
  );
}

/** The first message for each field. */
function byField(errors: ValidationError[]): FieldErrors {
  const fields: FieldErrors = {};
  for (const { path, message } of errors) {
    if ((path === 'name' || path === 'width' || path === 'height') && !fields[path]) {
      fields[path] = message;
    }
  }
  return fields;
}
