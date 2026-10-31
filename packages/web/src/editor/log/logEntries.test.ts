import type { LogEntry } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { errorEntry, sentEntry } from '../../test/logEntries';
import { addEntry, describeCommand, LOG_ROWS } from './logEntries';

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
