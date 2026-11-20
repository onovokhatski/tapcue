// "Type" in a hotspot's properties panel (ADR 0020): a button or a fader, and for a fader its
// direction, range, step, start value and where the value goes in its OSC command (spec FD-1).
// Every field applies only a value that fits the others (spec ED-10): the editor never saves a
// fader the server would refuse.
import type { FaderSettings, Hotspot, PageId } from '@tapcue/shared';
import { useState, type ReactNode } from 'react';
import { NumberField } from '../../ui/NumberField';
import { Segmented } from '../../ui/Segmented';
import { useDraft } from '../../ui/useDraft';
import { setFader, setKind } from '../operations/hotspots';
import { useEditor } from '../useEditor';

interface Props {
  pageId: PageId;
  hotspot: Hotspot;
}

export function KindFields({ pageId, hotspot }: Props) {
  const change = useEditor((state) => state.change);
  const fader = hotspot.kind === 'fader' ? hotspot.fader : undefined;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Segmented
          label="Hotspot type"
          options={[
            { value: 'button', label: 'Button' },
            { value: 'fader', label: 'Fader' },
          ]}
          value={fader ? 'fader' : 'button'}
          onChange={(kind) => change((p) => setKind(p, pageId, hotspot.id, kind))}
        />
      </div>
      <p className="text-body-s text-muted">
        {fader
          ? 'Dragging it sends its command with the value. It changes no page.'
          : 'A tap sends its command and can change the page.'}
      </p>
      {fader && <FaderFields pageId={pageId} hotspot={hotspot} fader={fader} />}
    </>
  );
}

const NUMBER = /^-?\d+(\.\d+)?$/;
const whole = (text: string) => /^\d+$/.test(text.trim());

/** Each field checks its text against the other settings as they are now. */
function FaderFields({ pageId, hotspot, fader }: Props & { fader: FaderSettings }) {
  const change = useEditor((state) => state.change);
  const update = (patch: Partial<FaderSettings>) =>
    change((p) => setFader(p, pageId, hotspot.id, patch));
  const command = hotspot.action.command;
  const argCount = command?.type === 'osc-udp' ? command.args.length : 0;
  const [asError, setAsError] = useState<string | null>(null);

  const number = (text: string) => (NUMBER.test(text.trim()) ? null : 'expected a number');
  const min = useDraft(
    String(fader.min),
    (text) =>
      number(text) ??
      (Number(text) >= fader.max ? `less than max (${fader.max})` : null) ??
      (Number(text) > fader.start ? `at most the start value (${fader.start})` : null),
    (text) => update({ min: Number(text) }),
  );
  const max = useDraft(
    String(fader.max),
    (text) =>
      number(text) ??
      (Number(text) <= fader.min ? `more than min (${fader.min})` : null) ??
      (Number(text) < fader.start ? `at least the start value (${fader.start})` : null),
    (text) => update({ max: Number(text) }),
  );
  const step = useDraft(
    String(fader.step),
    (text) =>
      number(text) ??
      (Number(text) <= 0 ? 'more than 0' : null) ??
      (Number(text) > fader.max - fader.min
        ? `at most the range, ${fader.max - fader.min}`
        : null) ??
      (fader.value.as === 'i' && !Number.isInteger(Number(text))
        ? 'a whole number, since the value is sent as one'
        : null),
    (text) => update({ step: Number(text) }),
  );
  const start = useDraft(
    String(fader.start),
    (text) =>
      number(text) ??
      (Number(text) < fader.min || Number(text) > fader.max
        ? `${fader.min} to ${fader.max}`
        : null),
    (text) => update({ start: Number(text) }),
  );
  const at = useDraft(
    String(fader.value.at),
    (text) =>
      !whole(text) || Number(text) > argCount ? `0 to ${argCount}, the number of arguments` : null,
    (text) => update({ value: { ...fader.value, at: Number(text) } }),
  );
  const errors = [
    min.error && `Min: ${min.error}`,
    max.error && `Max: ${max.error}`,
    step.error && `Step: ${step.error}`,
    start.error && `Start: ${start.error}`,
    at.error && `Value position: ${at.error}`,
    asError,
  ].filter(Boolean);
  // Dragging and arrow keys in these fields move by the fader's own step.
  const numberProps = { decimal: true, step: fader.step } as const;

  return (
    <>
      <Row label="Direction">
        <Segmented
          label="Fader direction"
          options={[
            { value: 'vertical', label: 'Vertical' },
            { value: 'horizontal', label: 'Horizontal' },
          ]}
          value={fader.orientation}
          onChange={(orientation) => update({ orientation })}
        />
      </Row>
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        <Field label="Min">
          <NumberField
            ariaLabel="Fader min"
            {...numberProps}
            max={fader.max - fader.step}
            value={min.text}
            error={min.error !== null}
            onChange={min.onChange}
            onBlur={min.onBlur}
          />
        </Field>
        <Field label="Max">
          <NumberField
            ariaLabel="Fader max"
            {...numberProps}
            min={fader.min + fader.step}
            value={max.text}
            error={max.error !== null}
            onChange={max.onChange}
            onBlur={max.onBlur}
          />
        </Field>
        <Field label="Step">
          <NumberField
            ariaLabel="Fader step"
            decimal
            value={step.text}
            error={step.error !== null}
            onChange={step.onChange}
            onBlur={step.onBlur}
          />
        </Field>
        <Field label="Start">
          <NumberField
            ariaLabel="Fader start"
            {...numberProps}
            min={fader.min}
            max={fader.max}
            value={start.text}
            error={start.error !== null}
            onChange={start.onChange}
            onBlur={start.onBlur}
          />
        </Field>
      </div>
      <Row label="Value sent as">
        <Segmented
          label="Value sent as"
          options={[
            { value: 'f', label: 'Float' },
            { value: 'i', label: 'Whole' },
          ]}
          value={fader.value.as}
          onChange={(as) => {
            // A whole-number value needs a whole step, or most positions could not be sent.
            if (as === 'i' && !Number.isInteger(fader.step)) {
              setAsError('Whole needs a whole-number step: change the step first.');
              return;
            }
            setAsError(null);
            update({ value: { ...fader.value, as } });
          }}
        />
      </Row>
      <Field label="Value position in the OSC arguments">
        <div className="w-[120px]">
          <NumberField
            prefix="#"
            ariaLabel="Value position"
            min={0}
            max={argCount}
            value={at.text}
            error={at.error !== null}
            onChange={at.onChange}
            onBlur={at.onBlur}
          />
        </div>
      </Field>
      <p className="text-body-s text-muted">
        {argCount === 0
          ? 'The value is the command’s only argument.'
          : `0 puts it first, ${argCount} after the last of the ${argCount} argument${argCount === 1 ? '' : 's'} below.`}
      </p>
      {errors.map((error) => (
        <p key={error} className="text-body-s text-danger-fg">
          {error}
        </p>
      ))}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-label-s text-secondary">{label}</p>
      {children}
    </div>
  );
}
