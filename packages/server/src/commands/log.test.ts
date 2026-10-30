import { describe, expect, it } from 'vitest';
import { createCommandLog, LOG_LIMIT, type NewLogEntry } from './log';

function ignored(message: string): NewLogEntry {
  return {
    time: '2026-10-30T14:05:09.123Z',
    source: { type: 'station', stationId: 'main' },
    pageId: 'p_home00',
    hotspotId: 'h_carda0',
    status: 'ignored',
    message,
  };
}

describe('command log', () => {
  it('numbers entries from 0 and keeps them oldest first', () => {
    const log = createCommandLog();
    expect(log.add(ignored('a')).seq).toBe(0);
    expect(log.add(ignored('b')).seq).toBe(1);
    expect(
      log.entries().map((entry) => [entry.seq, entry.status === 'ignored' && entry.message]),
    ).toEqual([
      [0, 'a'],
      [1, 'b'],
    ]);
  });

  it('keeps the last 500 entries by default', () => {
    expect(LOG_LIMIT).toBe(500);
  });

  it('drops the oldest entry once full, and keeps numbering', () => {
    const log = createCommandLog(3);
    for (const message of ['a', 'b', 'c', 'd']) log.add(ignored(message));
    expect(log.entries().map((entry) => entry.seq)).toEqual([1, 2, 3]);
  });

  it('returns a copy, so a caller cannot change the log', () => {
    const log = createCommandLog();
    log.add(ignored('a'));
    log.entries().pop();
    expect(log.entries()).toHaveLength(1);
  });

  it('tells subscribers about each new entry until they unsubscribe', () => {
    const log = createCommandLog();
    const heard: number[] = [];
    const stop = log.subscribe((entry) => heard.push(entry.seq));
    log.add(ignored('a'));
    log.add(ignored('b'));
    stop();
    log.add(ignored('c'));
    expect(heard).toEqual([0, 1]);
  });
});
