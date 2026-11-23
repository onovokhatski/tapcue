// The one interface every protocol implements (spec TGT-3, architecture §3). Adding a protocol
// means one driver file and one line in the dispatcher's map of drivers.
import type { Command, LogSource, Protocol, Target } from '@tapcue/shared';

export type TargetOf<P extends Protocol> = Extract<Target, { protocol: P }>;
export type CommandOf<P extends Protocol> = Extract<Command, { type: P }>;

/** Where a command comes from; HTTP passes it on in headers (spec TGT-6), UDP has no room for it. */
export interface SendContext {
  source: LogSource;
  hotspotName: string;
  /** For a fader: the value sent and its range, so a receiver can show a level (ADR 0020). */
  fader?: FaderLevel;
  /** For a step of a sequence: which tap and which step, so a receiver can tell them apart (ADR 0022). */
  sequence?: SequencePlace;
}

export interface SequencePlace {
  run: number;
  step: number;
  of: number;
}

export interface FaderLevel {
  value: number;
  min: number;
  max: number;
}

export interface Driver<P extends Protocol> {
  /** Resolves once the command is delivered as far as the protocol can tell; throws on a delivery error (spec TGT-5). */
  send(target: TargetOf<P>, command: CommandOf<P>, context: SendContext): Promise<void>;
  /** Releases sockets and timers when the server stops. */
  close(): Promise<void>;
}
