// The command log as the editor keeps it: newest first, a bounded number of rows, and each entry's
// command in short readable form (spec TGT-4, ED-6, ED-9).
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
