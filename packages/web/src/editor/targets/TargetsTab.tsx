// The Targets tab: the devices that receive commands — a list on the left, the selected target's
// form in the middle, its recent commands on the right (spec TGT-1, TGT-2, ED-4, ED-10;
// design: targetsScreen(), targetForm(), recentCard()).
import {
  HttpTarget,
  type LogEntry,
  OscUdpTarget,
  type Project,
  type Protocol,
  type Target,
  type TargetId,
} from '@tapcue/shared';
import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import { clock } from '../../lib/clock';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { Segmented } from '../../ui/Segmented';
import { TextField } from '../../ui/TextField';
import { useDraft } from '../../ui/useDraft';
import { describeCommand } from '../log/logEntries';
import { PROTOCOL_LABEL } from '../operations/commandText';
import {
  addTarget,
  changeProtocol,
  deleteTarget,
  targetUsage,
  updateTarget,
} from '../operations/targets';
import { useEditor } from '../useEditor';

const PROTOCOL_HELP: Record<Protocol, string> = {
  'osc-udp':
    'OSC 1.0 messages over UDP. For media servers and consoles such as Resolume, QLab or MagicQ.',
  udp: 'Plain text over UDP, for projectors and controllers that accept simple strings.',
  http: 'An HTTP request to a URL, for web hooks and devices with an HTTP API. Times out after 2 s.',
};

const address = (target: Target) =>
  target.protocol === 'http' ? target.baseUrl : `${target.host}:${target.port}`;

export function TargetsTab() {
  const project = useEditor((state) => state.project);
  const change = useEditor((state) => state.change);
  const [selectedId, setSelectedId] = useState<TargetId | null>(null);
  if (!project) return null;
  const { targets } = project;
  const selected = targets.find((t) => t.id === selectedId) ?? targets[0];

  function add() {
    if (!project) return;
    const added = addTarget(project);
    change(() => added.project);
    setSelectedId(added.targetId);
  }

  return (
    <>
      <aside
        aria-label="Targets"
        className="flex w-[264px] flex-none flex-col border-r border-default bg-surface"
      >
        <div className="flex h-11 flex-none items-center justify-between border-b border-default pr-2 pl-4">
          <h2 className="text-label-m">
            Targets <span className="text-body-s text-muted">{targets.length}</span>
          </h2>
          <Button variant="ghost" size="s" icon="plus" label="Add target" onClick={add} />
        </div>
        {targets.length === 0 ? (
          <p className="p-4 text-body-s text-muted">No targets yet.</p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {targets.map((target) => {
              const isSelected = target.id === selected?.id;
              return (
                <li key={target.id}>
                  <button
                    type="button"
                    aria-current={isSelected || undefined}
                    onClick={() => setSelectedId(target.id)}
                    className={`block w-full rounded border px-3 py-2 text-left ${
                      isSelected
                        ? 'border-selection-border bg-selection'
                        : 'border-transparent hover:bg-hover'
                    }`}
                  >
                    <span className="block text-label-m">{target.name}</span>
                    <span
                      className={`block truncate text-body-s ${isSelected ? 'text-secondary' : 'text-muted'}`}
                    >
                      {PROTOCOL_LABEL[target.protocol]} ·{' '}
                      <span className="font-mono text-mono-s">{address(target)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
      {selected ? (
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="grid max-w-[1080px] grid-cols-[minmax(0,600px)_minmax(0,1fr)] items-start gap-6 p-6">
            {/* Keyed, so every field starts afresh for another target. */}
            <TargetForm key={selected.id} project={project} target={selected} />
            <RecentCommands target={selected} />
          </div>
        </main>
      ) : (
        <main className="flex min-w-0 flex-1 items-center justify-center p-6">
          <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent-strong">
              <Icon name="arrow-right" className="h-6 w-6" />
            </span>
            <h2 className="text-heading-l">Add your first target</h2>
            <p className="text-body-m text-secondary">
              A target is a device that receives commands: a media server, a projector, a lighting
              console. Hotspots send their commands to targets.
            </p>
            <Button variant="primary" icon="plus" label="Add target" onClick={add} />
          </div>
        </main>
      )}
    </>
  );
}

/** The first message the shared schema gives for a value, or null when it is valid (spec ED-10). */
function check(
  schema: {
    safeParse: (value: unknown) => { success: boolean; error?: { issues: { message: string }[] } };
  },
  value: unknown,
) {
  const result = schema.safeParse(value);
  return result.success ? null : (result.error?.issues[0]?.message ?? 'Not valid');
}

const checkName = (text: string) =>
  text.trim().length === 0
    ? 'Expected a name'
    : text.trim().length > 100
      ? 'Expected at most 100 characters'
      : null;
const checkHost = (text: string) => check(OscUdpTarget.shape.host, text.trim());
const checkPort = (text: string) =>
  /^\d+$/.test(text.trim())
    ? check(OscUdpTarget.shape.port, Number(text))
    : 'Expected a whole number';
const checkUrl = (text: string) => check(HttpTarget.shape.baseUrl, text.trim());

function TargetForm({ project, target }: { project: Project; target: Target }) {
  const change = useEditor((state) => state.change);
  const select = useEditor((state) => state.select);
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<
    { kind: 'delete' } | { kind: 'protocol'; protocol: Protocol } | null
  >(null);
  const update = (patch: Parameters<typeof updateTarget>[2]) =>
    change((p) => updateTarget(p, target.id, patch));
  const usage = targetUsage(project, target.id);

  const name = useDraft(target.name, checkName, (text) => update({ name: text.trim() }));
  const host = useDraft(target.protocol === 'http' ? '' : target.host, checkHost, (text) =>
    update({ host: text.trim() }),
  );
  const port = useDraft(target.protocol === 'http' ? '' : String(target.port), checkPort, (text) =>
    update({ port: Number(text) }),
  );
  const url = useDraft(target.protocol === 'http' ? target.baseUrl : '', checkUrl, (text) =>
    update({ baseUrl: text.trim() }),
  );
  const invalid = [name, ...(target.protocol === 'http' ? [url] : [host, port])].filter(
    (d) => d.error,
  ).length;

  function chooseProtocol(protocol: Protocol) {
    // Commands must match their target's protocol, so switching clears them: ask first.
    if (usage.length > 0) setDialog({ kind: 'protocol', protocol });
    else change((p) => changeProtocol(p, target.id, protocol));
  }

  const hotspotNames = usage.map((u) => u.hotspot.name || 'Unnamed').join(', ');

  return (
    <section aria-label={target.name} className="rounded-lg border border-default bg-surface">
      <div className="flex h-12 items-center justify-between border-b border-default px-5">
        <h2 className="text-heading-m">{target.name}</h2>
        <Button
          variant="ghost"
          size="s"
          icon="trash"
          label="Delete target"
          onClick={() => setDialog({ kind: 'delete' })}
        />
      </div>
      <div className="space-y-5 p-5">
        <TextField
          label="Name"
          value={name.text}
          error={name.error}
          maxLength={100}
          onChange={name.onChange}
          onBlur={name.onBlur}
        />
        <div className="space-y-1.5">
          <p className="text-label-s text-secondary">Protocol</p>
          <Segmented
            label="Protocol"
            options={(['osc-udp', 'udp', 'http'] as const).map((value) => ({
              value,
              label: PROTOCOL_LABEL[value],
            }))}
            value={target.protocol}
            onChange={chooseProtocol}
          />
          <p className="text-body-s text-muted">{PROTOCOL_HELP[target.protocol]}</p>
        </div>
        {target.protocol === 'http' ? (
          <TextField
            label="Base URL"
            mono
            value={url.text}
            error={url.error}
            helper="Hotspot paths are added to this, e.g. /demo/screen-1/product-a."
            onChange={url.onChange}
            onBlur={url.onBlur}
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3">
            <TextField
              label="Host"
              mono
              value={host.text}
              error={host.error}
              helper="IP address or hostname on the stand network."
              onChange={host.onChange}
              onBlur={host.onBlur}
            />
            <TextField
              label="Port"
              mono
              value={port.text}
              error={port.error}
              helper="1–65535"
              onChange={port.onChange}
              onBlur={port.onBlur}
            />
          </div>
        )}
        {invalid > 0 ? (
          <p className="flex items-start gap-1.5 text-body-s text-secondary">
            <Icon name="alert" className="mt-px h-3.5 w-3.5 text-danger-fg" />
            <span>
              {invalid === 1 ? '1 field needs' : `${invalid} fields need`} fixing. Hotspots keep
              sending to the last valid address,{' '}
              <span className="font-mono text-mono-s">{address(target)}</span>, until then.
            </span>
          </p>
        ) : (
          <p className="text-body-s text-muted">Changes save automatically.</p>
        )}
        <div className="border-t border-default pt-5">
          {usage.length === 0 ? (
            <p className="text-body-m text-muted">No hotspot sends to this target yet.</p>
          ) : (
            <div className="space-y-2">
              <h3 className="text-label-m">
                Used by {usage.length} hotspot{usage.length === 1 ? '' : 's'}
              </h3>
              <ul className="-mx-2 space-y-0.5">
                {usage.map(({ page, hotspot }) => (
                  <li key={hotspot.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-hover"
                      // Opens the hotspot on the Pages tab, selected, to change its command.
                      onClick={() => {
                        select({ pageId: page.id, hotspotId: hotspot.id });
                        void navigate('/edit/pages');
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate text-label-m">
                        {hotspot.name || 'Unnamed'}
                      </span>
                      <span className="flex-none text-body-s text-muted">on {page.name}</span>
                      <span className="flex-none text-label-s text-link">Open</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {dialog?.kind === 'delete' && (
        <Dialog
          tone="danger"
          title={`Delete target “${target.name}”?`}
          confirmLabel="Delete target"
          onConfirm={() => {
            change((p) => deleteTarget(p, target.id));
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        >
          <Usage count={usage.length} names={hotspotNames} />
        </Dialog>
      )}
      {dialog?.kind === 'protocol' && (
        <Dialog
          tone="danger"
          title={`Change “${target.name}” to ${PROTOCOL_LABEL[dialog.protocol]}?`}
          confirmLabel="Change protocol"
          onConfirm={() => {
            change((p) => changeProtocol(p, target.id, dialog.protocol));
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        >
          <Usage count={usage.length} names={hotspotNames} />
          <p>A command must use its target&apos;s protocol, so set them again after the change.</p>
        </Dialog>
      )}
    </section>
  );
}

function Usage({ count, names }: { count: number; names: string }): ReactNode {
  if (count === 0) return <p>No hotspot sends commands to it.</p>;
  return (
    <p>
      {count} hotspot{count === 1 ? ' sends' : 's send'} commands to it: {names}. Their commands
      will be cleared. Page links on those hotspots stay.
    </p>
  );
}

/** The latest commands that went to this target, newest first (design: recentCard()). */
function RecentCommands({ target }: { target: Target }) {
  const log = useEditor((state) => state.log);
  const rows = log
    .filter(
      (entry): entry is Exclude<LogEntry, { status: 'ignored' }> =>
        entry.status !== 'ignored' && entry.targetName === target.name,
    )
    .slice(0, 8);
  return (
    <section aria-label="Recent commands" className="rounded-lg border border-default bg-surface">
      <div className="flex h-12 items-center border-b border-default px-5">
        <h2 className="text-heading-m">Recent commands</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-body-s text-muted">Nothing sent to this target yet.</p>
      ) : (
        <ul className="divide-y divide-default">
          {rows.map((entry) => (
            <li key={entry.seq} className="flex items-center gap-2 px-5 py-2 text-body-s">
              <span className="font-mono text-mono-s text-muted tabular-nums">
                {clock(entry.time).slice(0, 8)}
              </span>
              <span className={entry.status === 'sent' ? 'text-success-fg' : 'text-danger-fg'}>
                {entry.status === 'sent' ? 'Sent' : 'Error'}
              </span>
              <span className="min-w-0 flex-1 truncate">{entry.hotspotName || 'Unnamed'}</span>
              <span className="truncate font-mono text-mono-s text-muted">
                {describeCommand(entry.command).text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
