// The command log as the editor keeps it: newest first, a bounded number of rows, each entry's
// command in short readable form, and the steps of one tap's sequence gathered into one row
// (spec TGT-4, ED-6, ED-9, ADR 0022).
import type { Command, LogEntry, OscArgument } from '@tapcue/shared';

/** Rows kept in the panel; the server keeps its own log too. */
export const LOG_ROWS = 200;

/** Adds an entry on top; an entry seen before (same seq) is not added twice. */
export function addEntry(entries: LogEntry[], entry: LogEntry): LogEntry[] {
  if (entries.some((e) => e.seq === entry.seq)) return entries;
  return [entry, ...entries].slice(0, LOG_ROWS);
}

/** "/composition/columns/2/connect" with "i 1", "POST /demo/screen-3/call-staff", or the UDP text. */
export function describeCommand(command: Command): { text: string; args: string } {
  switch (command.type) {
    case 'osc-udp':
      return { text: command.address, args: command.args.map(oscArgument).join(' ') };
    case 'udp':
      return { text: command.text, args: '' };
    case 'http':
      return { text: `${command.method} ${command.path}`, args: '' };
  }
}

function oscArgument(argument: OscArgument): string {
  return argument.type === 's' ? `s "${argument.value}"` : `${argument.type} ${argument.value}`;
}

/** A row of the log: one entry, or the steps of one tap's sequence, oldest step first. */
export type LogRow =
  { kind: 'entry'; entry: LogEntry } | { kind: 'sequence'; run: number; steps: LogEntry[] };

/**
 * The entries (newest first) as rows: the entries of one sequence become one row, placed where
 * its newest entry is, so a sequence still running moves to the top as its steps arrive. A
 * sequence with one entry so far stays a plain row.
 */
export function logRows(entries: LogEntry[]): LogRow[] {
  const runs = new Map<number, LogEntry[]>();
  for (const entry of entries) {
    if (entry.sequence)
      runs.set(entry.sequence.run, [entry, ...(runs.get(entry.sequence.run) ?? [])]);
  }
  const placed = new Set<number>();
  const rows: LogRow[] = [];
  for (const entry of entries) {
    const run = entry.sequence?.run;
    if (run === undefined) {
      rows.push({ kind: 'entry', entry });
    } else if (!placed.has(run)) {
      placed.add(run);
      const steps = runs.get(run)!;
      rows.push(steps.length === 1 ? { kind: 'entry', entry } : { kind: 'sequence', run, steps });
    }
  }
  return rows;
}

/** How a sequence went: how many steps it had, and how many were sent, failed or cancelled. */
export function sequenceSummary(steps: LogEntry[]): {
  of: number;
  sent: number;
  failed: number;
  cancelled: number;
} {
  const of = steps.at(-1)?.sequence?.of ?? steps.length;
  let sent = 0;
  let failed = 0;
  let cancelled = 0;
  for (const step of steps) {
    if (step.status === 'sent') sent += 1;
    // A cancellation is one entry for every step from its own to the last one; any other step
    // that was not sent counts as failed.
    else if (step.status === 'ignored' && step.sequence && /cancelled/.test(step.message)) {
      cancelled += step.sequence.of - step.sequence.step + 1;
    } else failed += 1;
  }
  return { of, sent, failed, cancelled };
}
