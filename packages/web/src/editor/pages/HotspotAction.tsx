// What a tap on the hotspot does — "On tap" in its properties panel: the page to go to, the target
// to send a command to, and that command's fields for the target's protocol (spec ACT-1, TGT-2,
// ED-10; design: hotspotProps(), commandFields()).
import {
  type Command,
  type Hotspot,
  HttpCommand,
  type OscArgument,
  OscUdpCommand,
  type PageId,
  type Project,
  type Target,
  UdpCommand,
} from '@tapcue/shared';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { useDraft } from '../../ui/useDraft';
import { setCommand, setCommandTarget, setGoTo } from '../operations/actions';
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
  const { goTo, command } = hotspot.action;
  const target = command ? project.targets.find((t) => t.id === command.targetId) : undefined;
  const save = (next: Command) => change((p) => setCommand(p, pageId, hotspot.id, next));

  return (
    <>
      <Select
        label="Go to page"
        size="s"
        placeholder="Stay on this page"
        value={goTo}
        options={project.pages
          .filter((p) => p.id !== pageId)
          .map((p) => ({ value: p.id, label: p.name }))}
        onChange={(value) => change((p) => setGoTo(p, pageId, hotspot.id, value))}
      />
      <Select
        label="Send command to"
        size="s"
        placeholder="No command"
        value={command?.targetId ?? null}
        options={project.targets.map((t) => ({
          value: t.id,
          label: `${t.name} · ${PROTOCOL_LABEL[t.protocol]}`,
        }))}
        onChange={(value) => change((p) => setCommandTarget(p, pageId, hotspot.id, value))}
        {...(target ? { helper: address(target) } : {})}
      />
      {!command || !target ? (
        <p className="text-body-s text-muted">
          This hotspot sends no command. Choose a target to send one.
        </p>
      ) : (
        // Keyed by the command's type, so a new protocol starts with fresh fields.
        <>
          <CommandFields
            key={`${hotspot.id}-${command.type}`}
            command={command}
            target={target}
            onChange={save}
          />
          <SendTest key={`test-${hotspot.id}`} pageId={pageId} hotspotId={hotspot.id} />
        </>
      )}
    </>
  );
}

function address(target: Target): string {
  return target.protocol === 'http' ? target.baseUrl : `${target.host}:${target.port}`;
}

function CommandFields({
  command,
  target,
  onChange,
}: {
  command: Command;
  target: Target;
  onChange: (command: Command) => void;
}) {
  switch (command.type) {
    case 'osc-udp':
      return <OscFields command={command} onChange={onChange} />;
    case 'udp':
      return <UdpFields command={command} onChange={onChange} />;
    case 'http':
      return (
        <HttpFields
          command={command}
          baseUrl={target.protocol === 'http' ? target.baseUrl : ''}
          onChange={onChange}
        />
      );
  }
}

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

function UdpFields({ command, onChange }: { command: Udp; onChange: (command: Command) => void }) {
  const text = useDraft(
    showControls(command.text),
    (shown) => problem(UdpCommand, { ...command, text: readControls(shown) }, 'text'),
    (shown) => onChange({ ...command, text: readControls(shown) }),
  );
  return (
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
  );
}

type Http = Extract<Command, { type: 'http' }>;

function HttpFields({
  command,
  baseUrl,
  onChange,
}: {
  command: Http;
  baseUrl: string;
  onChange: (command: Command) => void;
}) {
  const path = useDraft(
    command.path,
    (text) => problem(HttpCommand, { ...command, path: text }, 'path'),
    (text) => onChange({ ...command, path: text }),
  );
  const canHaveBody = command.method !== 'GET';
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
          onChange={(method) =>
            onChange({ ...command, method, body: method === 'GET' ? null : command.body })
          }
        />
      </div>
      <TextField
        label="Path"
        size="s"
        mono
        value={path.text}
        error={path.error}
        helper={`Appended to ${baseUrl}`}
        onChange={path.onChange}
        onBlur={path.onBlur}
      />
      <TextField
        label="Body"
        multiline
        mono
        rows={2}
        placeholder={canHaveBody ? 'Empty' : 'A GET request has no body'}
        disabled={!canHaveBody}
        value={command.body ?? ''}
        helper="Sent as-is: as JSON when it is valid JSON, as text otherwise. Times out after 2 s."
        onChange={(body) => onChange({ ...command, body: body === '' ? null : body })}
      />
    </>
  );
}
