// "Send test" for the selected hotspot: its commands go through the server exactly as a tap would
// send them, from the source "test", and the result shows next to the button (spec ACT-4; design:
// hotspotProps(), test row). For a sequence, each step's result shows as it arrives (ADR 0022).
import type { FaderSettings, HotspotId, LogEntry, PageId } from '@tapcue/shared';
import { useState } from 'react';
import { clock } from '../../lib/clock';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { NumberField } from '../../ui/NumberField';
import { useEditor } from '../useEditor';

type Result =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent'; time: string }
  /** The first command waits for its delay; the log shows each step as it goes (ADR 0022). */
  | { state: 'started' }
  /** A sequence: its steps are the log entries after `afterSeq` from this test (ADR 0022). */
  | { state: 'running'; afterSeq: number }
  | { state: 'failed'; message: string };

/** For a fader, the test sends a value chosen here, from its start value (spec FD-2). */
export function SendTest({
  pageId,
  hotspotId,
  fader,
  sequence = false,
}: {
  pageId: PageId;
  hotspotId: HotspotId;
  fader?: FaderSettings | undefined;
  /** Several commands, or one after a pause: show each step's result. */
  sequence?: boolean;
}) {
  const connected = useEditor((state) => state.connection === 'open');
  const testSend = useEditor((state) => state.testSend);
  const log = useEditor((state) => state.log);
  const [result, setResult] = useState<Result>({ state: 'idle' });
  const [value, setValue] = useState(String(fader?.start ?? ''));
  const valid = !fader || /^-?\d+(\.\d+)?$/.test(value.trim());

  async function send() {
    // Entries of this test come after the newest one so far; the first may arrive before the answer.
    const afterSeq = Math.max(-1, ...log.map((entry) => entry.seq));
    setResult({ state: 'sending' });
    const answer = fader
      ? await testSend(pageId, hotspotId, Number(value))
      : await testSend(pageId, hotspotId);
    if (!answer.ok) setResult({ state: 'failed', message: answer.reason });
    else if (sequence) setResult({ state: 'running', afterSeq });
    else if (answer.entry === null) setResult({ state: 'started' });
    else if (answer.entry.status === 'sent') setResult({ state: 'sent', time: answer.entry.time });
    else setResult({ state: 'failed', message: answer.entry.message });
  }

  return (
    <div className="space-y-1.5 border-t border-default pt-3">
      <div className="flex items-center gap-3">
        {fader && (
          <div className="w-[96px]">
            <NumberField
              prefix="="
              ariaLabel="Test value"
              decimal
              step={fader.step}
              min={fader.min}
              max={fader.max}
              value={value}
              error={!valid}
              onChange={setValue}
            />
          </div>
        )}
        <Button
          icon="arrow-right"
          label="Send test"
          disabled={!connected || !valid || result.state === 'sending'}
          onClick={() => void send()}
        />
        {result.state === 'sent' && (
          <span
            role="status"
            className="inline-flex items-center gap-1 text-body-s text-success-fg"
          >
            <Icon name="check" className="h-3.5 w-3.5" />
            Sent at <span className="font-mono text-mono-s">{clock(result.time).slice(0, 8)}</span>
          </span>
        )}
        {result.state === 'started' && (
          <span role="status" className="text-body-s text-secondary">
            Started: the first command waits for its delay. See the command log.
          </span>
        )}
        {result.state === 'sending' && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 text-body-s text-secondary"
          >
            <span className="spinner" aria-hidden="true" />
            Sending…
          </span>
        )}
      </div>
      {result.state === 'running' && (
        <StepResults
          entries={log.filter(
            (e) => e.seq > result.afterSeq && e.source.type === 'test' && e.hotspotId === hotspotId,
          )}
        />
      )}
      {result.state === 'failed' && (
        <p role="alert" className="flex items-start gap-1 text-body-s text-danger-fg">
          <Icon name="alert" className="mt-px h-3.5 w-3.5" />
          <span>{result.message}</span>
        </p>
      )}
      <p className="text-body-s text-muted">
        {connected
          ? fader
            ? 'Sends the command with this value through the server, as a drag would.'
            : sequence
              ? 'Sends the commands through the server like a real tap, with their pauses. Does not change page.'
              : 'Sends the command through the server like a real tap. Does not change page.'
          : 'Available when the connection to the server is back.'}
      </p>
    </div>
  );
}

/** Each step of the test as the server reports it, oldest first. */
function StepResults({ entries }: { entries: LogEntry[] }) {
  const rows = [...entries].sort((a, b) => a.seq - b.seq);
  if (rows.length === 0) {
    return <p className="text-body-s text-secondary">Waiting for the first command…</p>;
  }
  return (
    <ol aria-label="Test results" className="space-y-0.5">
      {rows.map((entry) => (
        <li
          key={entry.seq}
          className={`flex items-start gap-1 text-body-s ${
            entry.status === 'sent' ? 'text-success-fg' : 'text-danger-fg'
          }`}
        >
          <Icon name={entry.status === 'sent' ? 'check' : 'alert'} className="mt-px h-3.5 w-3.5" />
          <span>{describe(entry)}</span>
        </li>
      ))}
    </ol>
  );
}

function describe(entry: LogEntry): string {
  // A named step says its name, as in the log (spec ACT-9).
  const step = entry.sequence ? `${entry.sequence.name ?? `Command ${entry.sequence.step}`}: ` : '';
  if (entry.status === 'sent') return `${step}sent at ${clock(entry.time).slice(0, 8)}`;
  // A cancellation names its own count, so it needs no step in front.
  if (entry.status === 'ignored') return entry.message;
  return `${step}${entry.message}`;
}
