import type { LogEntry } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { errorEntry, sentEntry } from '../../test/logEntries';
import { addEntry, describeCommand, LOG_ROWS, logRows, sequenceSummary } from './logEntries';

describe('addEntry', () => {
  it('puts the newest entry on top', () => {
    expect(addEntry([sentEntry], errorEntry)).toEqual([errorEntry, sentEntry]);
  });

  it('does not add an entry twice', () => {
    const entries = [sentEntry];
    expect(addEntry(entries, { ...sentEntry })).toBe(entries);
  });

  it('keeps at most 200 rows, dropping the oldest', () => {
    expect(LOG_ROWS).toBe(200);
    let entries: LogEntry[] = [];
    for (let seq = 1; seq <= 201; seq++) entries = addEntry(entries, { ...sentEntry, seq });
    expect(entries).toHaveLength(200);
    expect(entries[0]?.seq).toBe(201);
    expect(entries.at(-1)?.seq).toBe(2);
  });
});

describe('describeCommand', () => {
  it('shows an OSC address with its arguments', () => {
    expect(
      describeCommand({
        type: 'osc-udp',
        targetId: 't_resolm',
        address: '/layer/1/clip',
        args: [
          { type: 'i', value: 1 },
          { type: 'f', value: 0.5 },
          { type: 's', value: 'intro' },
        ],
      }),
    ).toEqual({ text: '/layer/1/clip', args: 'i 1 f 0.5 s "intro"' });
  });

  it('shows the UDP text, and HTTP as method and path', () => {
    expect(describeCommand({ type: 'udp', targetId: 't_proj00', text: 'POWER ON' })).toEqual({
      text: 'POWER ON',
      args: '',
    });
    expect(
      describeCommand({
        type: 'http',
        targetId: 't_demo00',
        method: 'POST',
        path: '/demo/screen-3/call-staff',
        body: null,
      }),
    ).toEqual({
      text: 'POST /demo/screen-3/call-staff',
      args: '',
    });
  });
});

describe('sequences in the log (ADR 0022)', () => {
  const step = (
    seq: number,
    run: number,
    n: number,
    of: number,
    status: 'sent' | 'error' = 'sent',
  ) =>
    ({
      ...(status === 'sent' ? sentEntry : errorEntry),
      seq,
      sequence: { run, step: n, of, delayMs: n === 1 ? 0 : 1000 },
    }) as LogEntry;
  const cancelled = (seq: number, run: number, n: number, of: number): LogEntry => ({
    seq,
    time: sentEntry.time,
    source: sentEntry.source,
    pageId: 'p_home00',
    hotspotId: 'h_carda0',
    sequence: { run, step: n, of, delayMs: 0 },
    status: 'ignored',
    message: `${of - n + 1} steps cancelled: tapped again`,
  });

  it("gathers a sequence's steps into one row, oldest step first, where its newest one is", () => {
    // Newest first: run 7's second step came after the plain entry.
    const entries = [
      step(4, 7, 2, 2),
      { ...sentEntry, seq: 3 },
      step(2, 7, 1, 2),
      { ...errorEntry, seq: 1 },
    ];
    expect(logRows(entries)).toEqual([
      { kind: 'sequence', run: 7, steps: [entries[2], entries[0]] },
      { kind: 'entry', entry: entries[1] },
      { kind: 'entry', entry: entries[3] },
    ]);
  });

  it('keeps a sequence with one entry so far as a plain row, and sequences apart', () => {
    const entries = [step(3, 8, 1, 2), step(2, 7, 2, 2), step(1, 7, 1, 2)];
    expect(logRows(entries).map((row) => row.kind)).toEqual(['entry', 'sequence']);
  });

  it('counts the steps sent, failed and cancelled', () => {
    expect(sequenceSummary([step(1, 7, 1, 3), step(2, 7, 2, 3, 'error')])).toEqual({
      of: 3,
      sent: 1,
      failed: 1,
      cancelled: 0,
    });
    expect(sequenceSummary([step(1, 7, 1, 4), cancelled(2, 7, 2, 4)])).toEqual({
      of: 4,
      sent: 1,
      failed: 0,
      cancelled: 3,
    });
    const notSent = {
      ...cancelled(2, 7, 2, 2),
      message: 'Target "t_x" does not exist',
    } as LogEntry;
    expect(sequenceSummary([step(1, 7, 1, 2), notSent])).toMatchObject({ failed: 1, cancelled: 0 });
  });
});
