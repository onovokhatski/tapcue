// The command log at the bottom of every editor tab: what the stations' taps and the editor's test
// sends delivered, failed or ignored, newest first. Collapsed, it still shows the latest entry
// (spec TGT-4, ED-6, ED-9; design: logPanel(), logRow()).
import type { LogEntry, Project } from '@tapcue/shared';
import { useState } from 'react';
import { clock } from '../../lib/clock';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useEditor } from '../useEditor';
import { describeCommand } from './logEntries';

export function CommandLog() {
  const log = useEditor((state) => state.log);
  const clearLog = useEditor((state) => state.clearLog);
  const project = useEditor((state) => state.project);
  const [expanded, setExpanded] = useState(true);
  const count = `${log.length} ${log.length === 1 ? 'command' : 'commands'}`;
  const latest = log[0];

  if (!expanded) {
    return (
      <section
        aria-label="Command log"
        className="flex h-9 flex-none items-center gap-3 border-t border-default bg-surface pr-3 pl-2"
      >
        <Button
          variant="ghost"
          size="s"
          icon="chevron-down"
          ariaLabel="Expand command log"
          className="rotate-180"
          onClick={() => setExpanded(true)}
        />
        <h2 className="flex-none text-label-m">Command log</h2>
        <span className="h-4 w-px flex-none bg-pressed" aria-hidden="true" />
        <div
          className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden whitespace-nowrap"
          aria-live="polite"
        >
          {latest ? (
            <>
              <span className="font-mono text-mono-s text-muted tabular-nums">
                {clock(latest.time)}
              </span>
              <Result entry={latest} />
              <Source entry={latest} project={project} />
              <span className="text-body-s">{hotspotName(latest)}</span>
              <span className="min-w-0 truncate">
                <CommandText entry={latest} />
              </span>
            </>
          ) : (
            <span className="text-body-s text-muted">No commands yet</span>
          )}
        </div>
        <span className="flex-none text-body-s text-muted">{count}</span>
      </section>
    );
  }

  return (
    <section
      aria-label="Command log"
      className="flex h-[176px] flex-none flex-col border-t border-default bg-surface"
    >
      <div className="flex h-9 flex-none items-center gap-3 border-b border-default pr-3 pl-2">
        <Button
          variant="ghost"
          size="s"
          icon="chevron-down"
          ariaLabel="Collapse command log"
          onClick={() => setExpanded(false)}
        />
        <h2 className="text-label-m">Command log</h2>
        <span className="inline-flex items-center gap-1.5 text-body-s text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success-solid" aria-hidden="true" />
          Live from all stations
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-body-s text-muted">{count}</span>
          <Button
            variant="ghost"
            size="s"
            label="Clear"
            disabled={log.length === 0}
            onClick={clearLog}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-left">
          <caption className="sr-only">Latest commands, newest first</caption>
          <thead className="sticky top-0 bg-subtle">
            <tr className="text-overline text-muted uppercase">
              <th scope="col" className="w-[120px] py-1 pr-2 pl-4 font-semibold">
                Time
              </th>
              <th scope="col" className="w-[96px] px-2 py-1 font-semibold">
                Result
              </th>
              <th scope="col" className="w-[128px] px-2 py-1 font-semibold">
                Source
              </th>
              <th scope="col" className="w-[150px] px-2 py-1 font-semibold">
                Hotspot
              </th>
              <th scope="col" className="px-2 py-1 pr-4 font-semibold">
                Command
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {log.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-body-s text-muted">
                  No commands yet. Taps from every station and test sends appear here.
                </td>
              </tr>
            ) : (
              log.map((entry) => (
                <tr
                  key={entry.seq}
                  data-status={entry.status}
                  className={entry.status === 'error' ? 'bg-danger-bg' : 'hover:bg-hover'}
                >
                  <td className="py-1 pr-2 pl-4 font-mono text-mono-s whitespace-nowrap text-muted tabular-nums">
                    {clock(entry.time)}
                  </td>
                  <td className="px-2 py-1">
                    <Result entry={entry} />
                  </td>
                  <td className="px-2 py-1">
                    <Source entry={entry} project={project} />
                  </td>
                  <td className="px-2 py-1 text-body-s">{hotspotName(entry)}</td>
                  <td className="px-2 py-1 pr-4">
                    <CommandText entry={entry} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A word with an icon, never colour alone (design-system.md). */
function Result({ entry }: { entry: LogEntry }) {
  const look = {
    sent: { icon: 'check', text: 'Sent', className: 'text-success-fg' },
    error: { icon: 'alert', text: 'Error', className: 'text-danger-fg' },
    ignored: { icon: 'info', text: 'Ignored', className: 'text-secondary' },
  } as const;
  const { icon, text, className } = look[entry.status];
  return (
    <span className={`inline-flex items-center gap-1 text-label-s ${className}`}>
      <Icon name={icon} className="h-3.5 w-3.5" />
      {text}
    </span>
  );
}

/** The station's name, or the Test tag for a send from the editor (spec TGT-6). */
function Source({ entry, project }: { entry: LogEntry; project: Project | null }) {
  if (entry.source.type === 'test') {
    return (
      <span className="inline-flex h-5 items-center rounded-sm border border-strong px-1.5 text-label-s text-secondary">
        Test
      </span>
    );
  }
  const { stationId } = entry.source;
  const name = project?.stations.find((s) => s.id === stationId)?.name ?? stationId;
  return <span className="text-body-s text-secondary">{name}</span>;
}

function hotspotName(entry: LogEntry): string {
  if (entry.status === 'ignored') return entry.hotspotId;
  return entry.hotspotName || 'Unnamed';
}

/** Target and command names are copied into the entry at send time, so a rename never changes old rows. */
function CommandText({ entry }: { entry: LogEntry }) {
  if (entry.status === 'ignored') {
    return <span className="text-body-s text-secondary">{entry.message}</span>;
  }
  const { text, args } = describeCommand(entry.command);
  return (
    <>
      <span className="text-body-s text-muted">{entry.targetName}</span>{' '}
      <span className="font-mono text-mono-s text-primary">{text}</span>
      {args && <span className="font-mono text-mono-s text-muted"> {args}</span>}
      {entry.status === 'error' && (
        <span className="text-body-s text-danger-fg"> · {entry.message}</span>
      )}
    </>
  );
}
