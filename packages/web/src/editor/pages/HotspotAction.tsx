// What a tap on the hotspot does — "On tap" in its properties panel: the page to go to and the
// commands to send, one after another, each with its pause, target and fields for the target's
// protocol (spec ACT-1, ACT-5, ACT-6, ACT-9, TGT-2, ED-10, ED-15, ADR 0022; design: hotspotProps(),
// commandFields()). Each command is a card that folds into one line, can be named and switched
// off. A fader keeps one command (ADR 0020).
import {
  activeSteps,
  type Command,
  type FaderSettings,
  formatFaderValue,
  type Hotspot,
  HttpCommand,
  MAX_DELAY_MS,
  MAX_STEPS,
  type OscArgument,
  OscUdpCommand,
  type PageId,
  type Project,
  snapFaderValue,
  type Step,
  type Target,
  UdpCommand,
  VALUE_PLACEHOLDER,
} from '@tapcue/shared';
import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { NumberField } from '../../ui/NumberField';
import { Segmented } from '../../ui/Segmented';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { useDraft } from '../../ui/useDraft';
import {
  addStep,
  moveStep,
  sequenceLength,
  setCommand,
  setCommandTarget,
  setGoTo,
  setStepDelay,
  setStepEnabled,
  setStepName,
} from '../operations/actions';
import { describeCommand } from '../log/logEntries';
import { withPlaceholder } from '../operations/hotspots';
import {
  checkArgument,
  convertArgument,
  parseArgument,
  PROTOCOL_LABEL,
  readControls,
  showControls,
} from '../operations/commandText';
import { useEditor } from '../useEditor';
import { SendTest } from './SendTest';

interface Props {
  project: Project;
  pageId: PageId;
  hotspot: Hotspot;
}

export function OnTapFields({ project, pageId, hotspot }: Props) {
  const change = useEditor((state) => state.change);
  const fader = hotspot.kind === 'fader' ? hotspot.fader : undefined;
  return (
    <>
      {/* A fader changes no page (ADR 0020). */}
      {!fader && (
        <Select
          label="Go to page"
          size="s"
          placeholder="Stay on this page"
          value={hotspot.action.goTo}
          options={project.pages
            .filter((p) => p.id !== pageId)
            .map((p) => ({ value: p.id, label: p.name }))}
          onChange={(value) => change((p) => setGoTo(p, pageId, hotspot.id, value))}
        />
      )}
      {fader ? (
        <FaderCommand project={project} pageId={pageId} hotspot={hotspot} fader={fader} />
      ) : (
        <CommandSteps project={project} pageId={pageId} hotspot={hotspot} />
      )}
    </>
  );
}

const targetOptions = (project: Project) =>
  project.targets.map((t) => ({ value: t.id, label: `${t.name} · ${PROTOCOL_LABEL[t.protocol]}` }));

/** A fader sends one command, at once, with its value (ADR 0020, ADR 0022). */
function FaderCommand({
  project,
  pageId,
  hotspot,
  fader,
}: Props & { fader: FaderSettings | undefined }) {
  const change = useEditor((state) => state.change);
  const step = hotspot.action.commands[0];
  const command = step?.command ?? null;
  const target = command ? project.targets.find((t) => t.id === command.targetId) : undefined;
  const on = step?.enabled !== false;
  return (
    <>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Select
            label="Send command to"
            size="s"
            placeholder="No command"
            value={command?.targetId ?? null}
            options={targetOptions(project)}
            onChange={(value) => change((p) => setCommandTarget(p, pageId, hotspot.id, value))}
            {...(target ? { helper: address(target) } : {})}
          />
        </div>
        {/* A fader's command can be switched off too: a drag then sends nothing (spec ACT-9). */}
        {step && (
          <SendSwitch
            label="Send this command"
            on={on}
            onChange={(next) => change((p) => setStepEnabled(p, pageId, hotspot.id, 0, next))}
          />
        )}
      </div>
      {step && !on && (
        <p className="text-body-s text-muted">Off: dragging the fader sends nothing.</p>
      )}
      {!command || !target ? (
        <p className="text-body-s text-muted">
          This fader sends no command. Choose a target to send one.
        </p>
      ) : (
        <>
          {/* Keyed by the command's type, so a new protocol starts with fresh fields. */}
          <CommandFields
            key={`${hotspot.id}-${command.type}`}
            command={command}
            target={target}
            fader={fader}
            onChange={(next) => change((p) => setCommand(p, pageId, hotspot.id, next))}
          />
          <SendTest
            // A new start value is the new value to test with.
            key={`test-${hotspot.id}-${fader?.start ?? ''}`}
            pageId={pageId}
            hotspotId={hotspot.id}
            fader={fader}
          />
        </>
      )}
    </>
  );
}

/**
 * A button's commands: a list of steps sent in order, each after its pause (spec ACT-5, ACT-6,
 * ADR 0022). Steps are reordered by dragging their handle, or with Alt + ↑ / ↓ on it. Each card
 * folds into one line; from the project, three or more start folded, and a new one is open
 * (spec ED-15).
 */
function CommandSteps({ project, pageId, hotspot }: Props) {
  const change = useEditor((state) => state.change);
  const steps = hotspot.action.commands;
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  /** Where a dragged step would land: before the step at this index (length = at the end). */
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Which cards are open, by place. The panel mounts this afresh for each hotspot (keyed by it):
  // from the project, three or more start folded.
  const [stored, setOpen] = useState(() => steps.map(() => steps.length < 3));
  // A step added here or removed elsewhere (a deleted target) keeps the rest as they were, and a
  // new one is open.
  let open = stored;
  if (open.length !== steps.length) {
    open = steps.map((_, i) => stored[i] ?? true);
    setOpen(open);
  }
  const on = activeSteps(hotspot.action).length;
  const total = sequenceLength(hotspot.action);

  /** Moves a step and its fold with it. */
  function move(from: number, to: number) {
    const target = Math.max(0, Math.min(to, steps.length - 1));
    if (target === from) return;
    const next = [...open];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved!);
    setOpen(next);
    change((p) => moveStep(p, pageId, hotspot.id, from, target));
  }

  function drop() {
    if (dragFrom !== null && dropIndex !== null) {
      move(dragFrom, dropIndex > dragFrom ? dropIndex - 1 : dropIndex);
    }
    setDragFrom(null);
    setDropIndex(null);
  }

  return (
    <div className="space-y-2">
      <p className="text-label-s text-secondary">Commands</p>
      {steps.length === 0 ? (
        <p className="text-body-s text-muted">This hotspot sends no command.</p>
      ) : (
        <ol aria-label="Commands" className="space-y-2" onDragLeave={() => setDropIndex(null)}>
          {steps.map((step, index) => (
            <StepCard
              // Steps have no ids: the place names them. Keyed by the type too, so fields of a new
              // protocol start afresh.
              key={`${hotspot.id}-${index}-${step.command.type}`}
              project={project}
              pageId={pageId}
              hotspot={hotspot}
              step={step}
              index={index}
              count={steps.length}
              open={open[index] ?? true}
              onOpen={(value) => setOpen(open.map((o, i) => (i === index ? value : o)))}
              onRemove={() => {
                setOpen(open.filter((_, i) => i !== index));
                change((p) => setCommandTarget(p, pageId, hotspot.id, null, index));
              }}
              dragging={dragFrom === index}
              dropBefore={dropIndex === index}
              dropAfter={dropIndex === steps.length && index === steps.length - 1}
              onMove={(to) => move(index, to)}
              onDragStart={() => setDragFrom(index)}
              onDragOver={(after) => {
                if (dragFrom !== null) setDropIndex(after ? index + 1 : index);
              }}
              onDrop={drop}
              onDragEnd={() => {
                setDragFrom(null);
                setDropIndex(null);
              }}
            />
          ))}
        </ol>
      )}
      <div className="-ml-2 flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="s"
          icon="plus"
          label="Add command"
          disabled={steps.length >= MAX_STEPS || project.targets.length === 0}
          onClick={() => change((p) => addStep(p, pageId, hotspot.id))}
        />
        {steps.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="s"
              label="Fold all"
              onClick={() => setOpen(steps.map(() => false))}
            />
            <Button
              variant="ghost"
              size="s"
              label="Unfold all"
              onClick={() => setOpen(steps.map(() => true))}
            />
          </>
        )}
      </div>
      {project.targets.length === 0 && (
        <p className="text-body-s text-muted">Add a target on the Targets tab to send commands.</p>
      )}
      {steps.length >= MAX_STEPS && (
        <p className="text-body-s text-muted">At most {MAX_STEPS} commands per tap.</p>
      )}
      {(steps.length > 1 || total > 0) && (
        <p className="text-body-s text-secondary">
          {on < steps.length ? `${on} of ${steps.length}` : steps.length}{' '}
          {steps.length === 1 ? 'command' : 'commands'} over {seconds(total)}
        </p>
      )}
      {steps.length > 0 && (
        <SendTest pageId={pageId} hotspotId={hotspot.id} sequence={on > 1 || total > 0} />
      )}
    </div>
  );
}

/** Milliseconds as seconds with at most one decimal: "2.5 s", "0 s". */
export function seconds(ms: number): string {
  return `${Number((ms / 1000).toFixed(1))} s`;
}

/** "Resolume · /composition/columns/2/connect i 1 · after 1.5 s": a folded card's line. */
function stepSummary(step: Step, target: Target | undefined): string {
  const { text, args } = describeCommand(step.command);
  return [
    target?.name ?? 'Missing target',
    args ? `${text} ${args}` : text,
    ...(step.delayMs ? [`after ${seconds(step.delayMs)}`] : []),
  ].join(' · ');
}

function StepCard({
  project,
  pageId,
  hotspot,
  step,
  index,
  count,
  open,
  onOpen,
  onRemove,
  dragging,
  dropBefore,
  dropAfter,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props & {
  step: Step;
  index: number;
  count: number;
  open: boolean;
  onOpen: (open: boolean) => void;
  onRemove: () => void;
  dragging: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
  onMove: (to: number) => void;
  onDragStart: () => void;
  onDragOver: (after: boolean) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const change = useEditor((state) => state.change);
  // Only the handle starts a drag, so text in the fields can still be selected with the mouse.
  const [armed, setArmed] = useState(false);
  const { command } = step;
  const target = project.targets.find((t) => t.id === command.targetId);
  const n = index + 1;
  const on = step.enabled !== false;
  return (
    <li
      className="relative"
      draggable={armed}
      onDragStart={(event) => {
        event.dataTransfer?.setData('text/plain', String(index));
        onDragStart();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        const box = event.currentTarget.getBoundingClientRect();
        onDragOver(event.clientY > box.top + box.height / 2);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      onDragEnd={() => {
        setArmed(false);
        onDragEnd();
      }}
    >
      {dropBefore && <DropLine edge="top" />}
      <div
        role="group"
        aria-label={`Command ${n}`}
        data-off={on ? undefined : 'true'}
        className={`space-y-2 rounded border border-default p-2 ${on ? '' : 'bg-subtle'} ${
          dragging ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="cursor-grab rounded text-muted hover:text-secondary"
            aria-label={`Reorder command ${n}`}
            title="Drag, or Alt + ↑ / ↓"
            onMouseDown={() => setArmed(true)}
            onMouseUp={() => setArmed(false)}
            onKeyDown={(event) => {
              if (!event.altKey) return;
              if (event.key === 'ArrowUp' && index > 0) {
                event.preventDefault();
                onMove(index - 1);
              } else if (event.key === 'ArrowDown' && index < count - 1) {
                event.preventDefault();
                onMove(index + 1);
              }
            }}
          >
            <Icon name="grip" />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-muted hover:bg-hover hover:text-primary"
            aria-label={`${open ? 'Fold' : 'Unfold'} command ${n}`}
            aria-expanded={open}
            onClick={() => onOpen(!open)}
          >
            <Icon
              name="chevron-down"
              className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
            />
          </button>
          <StepTitle
            n={n}
            name={step.name}
            on={on}
            onRename={(name) => change((p) => setStepName(p, pageId, hotspot.id, index, name))}
          />
          {!on && <span className="text-label-s text-muted">Off</span>}
          <SendSwitch
            label={`Send command ${n}`}
            on={on}
            onChange={(next) => change((p) => setStepEnabled(p, pageId, hotspot.id, index, next))}
          />
          <Button
            variant="ghost"
            size="s"
            icon="trash"
            ariaLabel={`Remove command ${n}`}
            onClick={onRemove}
          />
        </div>
        {!open ? (
          <p
            className={`truncate pl-11 text-body-s text-muted ${on ? '' : 'opacity-60'}`}
            data-testid="step-summary"
          >
            {stepSummary(step, target)}
          </p>
        ) : (
          <div className={`space-y-2 ${on ? '' : 'opacity-60'}`}>
            <DelayField
              label={`Wait before command ${n}`}
              delayMs={step.delayMs ?? 0}
              onChange={(ms) => change((p) => setStepDelay(p, pageId, hotspot.id, index, ms))}
            />
            <Select
              ariaLabel={`Command ${n} target`}
              size="s"
              value={command.targetId}
              options={targetOptions(project)}
              onChange={(value) =>
                change((p) => setCommandTarget(p, pageId, hotspot.id, value, index))
              }
              {...(target ? { helper: address(target) } : {})}
            />
            {target && (
              <CommandFields
                command={command}
                target={target}
                fader={undefined}
                onChange={(next) => change((p) => setCommand(p, pageId, hotspot.id, next, index))}
              />
            )}
          </div>
        )}
      </div>
      {dropAfter && <DropLine edge="bottom" />}
    </li>
  );
}

/**
 * A step's title: its name, or "Command N". A click or F2 renames it in place; Enter or leaving
 * the field keeps the new name, Escape the old one, and an empty name brings back "Command N".
 */
function StepTitle({
  n,
  name,
  on,
  onRename,
}: {
  n: number;
  name: string | undefined;
  on: boolean;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  /** After a rename the focus goes back to the title, not to the page. */
  const [returned, setReturned] = useState(false);
  const [value, setValue] = useState('');
  const fallback = `Command ${n}`;
  const finish = (save: boolean) => {
    if (save) onRename(value);
    setEditing(false);
    setReturned(true);
  };
  if (editing) {
    return (
      <input
        aria-label={`Command ${n} name`}
        className="field h-7 min-w-0 flex-1 rounded border border-strong bg-surface px-2 text-label-s"
        value={value}
        placeholder={fallback}
        maxLength={100}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== 'Escape') return;
          // The focus moves to the title at once; without this, the browser would go on to press
          // it with the same key and open the field again.
          event.preventDefault();
          finish(event.key === 'Enter');
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className={`min-w-0 flex-1 truncate rounded px-1 text-left text-label-s hover:bg-hover ${
        on ? 'text-primary' : 'text-muted'
      }`}
      title="Click or F2 to rename"
      aria-label={`Rename ${name || fallback}`}
      autoFocus={returned}
      onClick={() => {
        setValue(name ?? '');
        setEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'F2') {
          setValue(name ?? '');
          setEditing(true);
        }
      }}
    >
      {name || fallback}
    </button>
  );
}

/** On/off for a command (spec ACT-9): the design system's toggle button, pressed while it sends. */
function SendSwitch({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="s"
      icon="power"
      ariaLabel={label}
      title={on ? `${label}: on` : `${label}: off`}
      pressed={on}
      onClick={() => onChange(!on)}
    />
  );
}

function DropLine({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-x-0 h-0.5 rounded-full bg-accent-strong ${
        edge === 'top' ? '-top-1.5' : '-bottom-1.5'
      }`}
    />
  );
}

/** The pause before a step, in seconds with tenths; stored in milliseconds (ADR 0022). */
function DelayField({
  label,
  delayMs,
  onChange,
}: {
  label: string;
  delayMs: number;
  onChange: (ms: number) => void;
}) {
  const draft = useDraft(
    String(delayMs / 1000),
    (text) =>
      /^\d+(\.\d)?$/.test(text.trim()) && Number(text) * 1000 <= MAX_DELAY_MS
        ? null
        : `Expected 0 to ${MAX_DELAY_MS / 1000} seconds, in tenths`,
    (text) => onChange(Math.round(Number(text) * 10) * 100),
  );
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-body-s text-secondary">Wait</span>
        <div className="w-[96px]">
          <NumberField
            ariaLabel={label}
            suffix="s"
            decimal
            step={0.1}
            min={0}
            max={MAX_DELAY_MS / 1000}
            value={draft.text}
            error={draft.error !== null}
            onChange={draft.onChange}
            onBlur={draft.onBlur}
          />
        </div>
        <span className="text-body-s text-muted">then send</span>
      </div>
      {draft.error && <p className="text-body-s text-danger-fg">{draft.error}</p>}
    </div>
  );
}

function address(target: Target): string {
  return target.protocol === 'http' ? target.baseUrl : `${target.host}:${target.port}`;
}

function CommandFields({
  command,
  target,
  fader,
  onChange,
}: {
  command: Command;
  target: Target;
  fader: FaderSettings | undefined;
  onChange: (command: Command) => void;
}) {
  switch (command.type) {
    case 'osc-udp':
      return <OscFields command={command} onChange={onChange} />;
    case 'udp':
      return <UdpFields command={command} fader={fader} onChange={onChange} />;
    case 'http':
      return (
        <HttpFields
          command={command}
          baseUrl={target.protocol === 'http' ? target.baseUrl : ''}
          fader={fader}
          onChange={onChange}
        />
      );
  }
}

/**
 * For a fader's UDP or HTTP command: what {value} becomes, shown with the value halfway along
 * the fader, written as it will be sent (ADR 0020).
 */
function ValueHint({ fader, where }: { fader: FaderSettings; where: string }) {
  const example = formatFaderValue(snapFaderValue((fader.min + fader.max) / 2, fader), fader);
  return (
    <p className="text-body-s text-muted">
      {`${VALUE_PLACEHOLDER} in the ${where} is replaced by the fader's value, such as ${example}.`}
    </p>
  );
}

const NO_PLACE = `needs ${VALUE_PLACEHOLDER}, where the fader's value goes`;

/** The first problem the shared schema finds at `path` of a command, or null (spec ED-10). */
function problem(
  schema: {
    safeParse: (value: unknown) => {
      success: boolean;
      error?: { issues: { path: PropertyKey[]; message: string }[] };
    };
  },
  command: unknown,
  path: string,
): string | null {
  const result = schema.safeParse(command);
  if (result.success) return null;
  return result.error?.issues.find((issue) => issue.path.join('.') === path)?.message ?? null;
}

type Osc = Extract<Command, { type: 'osc-udp' }>;

function OscFields({ command, onChange }: { command: Osc; onChange: (command: Command) => void }) {
  const addressDraft = useDraft(
    command.address,
    (text) => problem(OscUdpCommand, { ...command, address: text }, 'address'),
    (text) => onChange({ ...command, address: text }),
  );
  const setArgs = (args: OscArgument[]) => onChange({ ...command, args });
  return (
    <>
      <TextField
        label="OSC address"
        size="s"
        mono
        value={addressDraft.text}
        error={addressDraft.error}
        onChange={addressDraft.onChange}
        onBlur={addressDraft.onBlur}
      />
      <div className="space-y-1.5">
        <p className="text-label-s text-secondary">Arguments</p>
        {command.args.length > 0 && (
          <ul className="space-y-1.5">
            {command.args.map((argument, index) => (
              <ArgumentRow
                // Arguments have no ids; the position names them, as in the OSC message.
                key={index}
                index={index}
                argument={argument}
                onChange={(next) => setArgs(command.args.map((a, i) => (i === index ? next : a)))}
                onRemove={() => setArgs(command.args.filter((_, i) => i !== index))}
              />
            ))}
          </ul>
        )}
        <Button
          variant="ghost"
          size="s"
          icon="plus"
          label="Add argument"
          className="-ml-2"
          onClick={() => setArgs([...command.args, { type: 'i', value: 1 }])}
        />
      </div>
    </>
  );
}

const ARGUMENT_TYPES = [
  { value: 'i', label: 'Integer' },
  { value: 'f', label: 'Float' },
  { value: 's', label: 'String' },
];

function ArgumentRow({
  index,
  argument,
  onChange,
  onRemove,
}: {
  index: number;
  argument: OscArgument;
  onChange: (argument: OscArgument) => void;
  onRemove: () => void;
}) {
  const value = useDraft(
    String(argument.value),
    (text) => checkArgument(argument.type, text),
    (text) => onChange(parseArgument(argument.type, text)),
  );
  return (
    <li className="space-y-1">
      <div className="grid grid-cols-[96px_minmax(0,1fr)_28px] items-center gap-2">
        <Select
          ariaLabel={`Argument ${index + 1} type`}
          size="s"
          value={argument.type}
          options={ARGUMENT_TYPES}
          onChange={(type) => {
            if (type) onChange(convertArgument(argument, type as OscArgument['type']));
          }}
        />
        <TextField
          ariaLabel={`Argument ${index + 1} value`}
          size="s"
          mono
          value={value.text}
          error={value.error}
          onChange={value.onChange}
          onBlur={value.onBlur}
        />
        <Button
          variant="ghost"
          size="s"
          icon="trash"
          ariaLabel={`Remove argument ${index + 1}`}
          onClick={onRemove}
        />
      </div>
    </li>
  );
}

type Udp = Extract<Command, { type: 'udp' }>;

function UdpFields({
  command,
  fader,
  onChange,
}: {
  command: Udp;
  fader: FaderSettings | undefined;
  onChange: (command: Command) => void;
}) {
  const text = useDraft(
    showControls(command.text),
    (shown) =>
      problem(UdpCommand, { ...command, text: readControls(shown) }, 'text') ??
      (fader && !shown.includes(VALUE_PLACEHOLDER) ? `Text ${NO_PLACE}` : null),
    (shown) => onChange({ ...command, text: readControls(shown) }),
  );
  return (
    <>
      <TextField
        label="Text"
        size="s"
        mono
        value={text.text}
        error={text.error}
        helper="Sent as UTF-8. Write \r or \n for line endings."
        onChange={text.onChange}
        onBlur={text.onBlur}
      />
      {fader && <ValueHint fader={fader} where="text" />}
    </>
  );
}

type Http = Extract<Command, { type: 'http' }>;

function HttpFields({
  command,
  baseUrl,
  fader,
  onChange,
}: {
  command: Http;
  baseUrl: string;
  fader: FaderSettings | undefined;
  onChange: (command: Command) => void;
}) {
  const canHaveBody = command.method !== 'GET';
  // Path and body are edited as a pair (spec ED-10): a fader's value goes in one of them, so each
  // field is checked with the text in the other, also while that is still being edited, and a
  // change that makes the pair valid saves both. {value} typed in the body makes a path that was
  // waiting for it valid, and saves it too.
  const [drafts, setDrafts] = useState<{ path?: string; body?: string }>({});
  const text = { path: drafts.path ?? command.path, body: drafts.body ?? command.body ?? '' };
  const pathProblem = (path: string) => problem(HttpCommand, { ...command, path }, 'path');
  /** What would be saved: a path with its own problem stays as it was. */
  const pairOf = ({ path, body }: typeof text) => ({
    path: pathProblem(path) ? command.path : path,
    body: canHaveBody && body !== '' ? body : null,
  });
  const noPlace = ({ path, body }: { path: string; body: string | null }) =>
    fader && !path.includes(VALUE_PLACEHOLDER) && !(body ?? '').includes(VALUE_PLACEHOLDER)
      ? `The path or the body ${NO_PLACE}`
      : null;
  const errors = {
    path: drafts.path === undefined ? null : (pathProblem(text.path) ?? noPlace(pairOf(text))),
    body: drafts.body === undefined ? null : noPlace(pairOf(text)),
  };
  const edit = (field: 'path' | 'body') => (value: string) => {
    const next = { ...text, [field]: value };
    setDrafts((current) => ({ ...current, [field]: value }));
    if (field === 'path' && pathProblem(value)) return;
    if (!noPlace(pairOf(next))) onChange({ ...command, ...pairOf(next) });
  };
  // A valid field goes back to showing the saved value; an invalid one keeps its text and error.
  const leave = (field: 'path' | 'body') => () => {
    if (!errors[field]) setDrafts(({ [field]: _, ...rest }) => rest);
  };
  return (
    <>
      <div className="space-y-1">
        <p className="text-label-s text-secondary">Method</p>
        <Segmented
          label="HTTP method"
          options={[
            { value: 'GET', label: 'GET' },
            { value: 'POST', label: 'POST' },
            { value: 'PUT', label: 'PUT' },
          ]}
          value={command.method}
          // A GET request has no body (project format).
          onChange={(method) => {
            setDrafts({});
            const next = { ...command, method, body: method === 'GET' ? null : command.body };
            // A fader whose value was only in the body gets it back in the path.
            onChange(fader ? withPlaceholder(next) : next);
          }}
        />
      </div>
      <TextField
        label="Path"
        size="s"
        mono
        value={text.path}
        error={errors.path}
        helper={`Appended to ${baseUrl}`}
        onChange={edit('path')}
        onBlur={leave('path')}
      />
      <TextField
        label="Body"
        multiline
        mono
        rows={2}
        placeholder={canHaveBody ? 'Empty' : 'A GET request has no body'}
        disabled={!canHaveBody}
        value={text.body}
        error={errors.body}
        helper="Sent as-is: as JSON when it is valid JSON, as text otherwise. Times out after 2 s."
        onChange={edit('body')}
        onBlur={leave('body')}
      />
      {fader && <ValueHint fader={fader} where="path or body" />}
    </>
  );
}
