// Messages over the WebSocket /ws between browsers and the server (architecture §5.2, ADR 0006).
// Every message is a JSON object whose `type` decides the other fields.
import { z, type ZodType } from 'zod';
import { formatPath } from '../project/validate';
import { Command } from '../project/targets';
import { HotspotId, Name, PageId, StationId } from '../project/values';

/** Where a command came from: a tap on a station, or the editor's "Send test" (spec TGT-4, ACT-4). */
export const LogSource = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('station'), stationId: StationId }),
  // Not a station id: a station may well be called "test".
  z.strictObject({ type: z.literal('test') }),
]);
export type LogSource = z.infer<typeof LogSource>;

const logEntryBase = {
  /** Increases by one per entry, so a client can order entries and spot ones it missed. */
  seq: z.int().min(0),
  /** When the server handled the tap, ISO 8601 in UTC. */
  time: z.iso.datetime(),
  source: LogSource,
  pageId: PageId,
  hotspotId: HotspotId,
};

/** Names are copied at send time, so the log still reads right after a target or hotspot is renamed. */
const delivery = {
  hotspotName: z.string().max(100),
  targetName: Name,
  command: Command,
};

/** One line of the command log (spec TGT-4, TGT-5). */
export const LogEntry = z.discriminatedUnion('status', [
  /** OSC and UDP: the packet left the server. HTTP: the target answered 2xx. */
  z.strictObject({ ...logEntryBase, ...delivery, status: z.literal('sent') }),
  z.strictObject({ ...logEntryBase, ...delivery, status: z.literal('error'), message: z.string() }),
  /** The tap named a page or hotspot the server's project does not have (ADR 0005). */
  z.strictObject({ ...logEntryBase, status: z.literal('ignored'), message: z.string() }),
]);
export type LogEntry = z.infer<typeof LogEntry>;

/** An HTTP request the demo receiver got on /demo/<screen>/<content> (spec DEMO-1). */
export const DemoRequest = z.strictObject({
  time: z.iso.datetime(),
  method: z.string().min(1),
  path: z.string().startsWith('/demo/'),
  screen: z.string().min(1),
  content: z.string().min(1),
  body: z.string().nullable(),
});
export type DemoRequest = z.infer<typeof DemoRequest>;

// A dead connection is noticed by a ping without a pong, from either side (architecture §7).
const Ping = z.strictObject({ type: z.literal('ping') });
const Pong = z.strictObject({ type: z.literal('pong') });

/** From a browser (player, editor or demo page) to the server. */
export const ClientMessage = z.discriminatedUnion('type', [
  /** A player names its station after each (re)connect. */
  z.strictObject({ type: z.literal('hello'), stationId: StationId }),
  /** Which hotspot was tapped, not what to send: the server looks the command up (ADR 0005). */
  z.strictObject({ type: z.literal('tap'), pageId: PageId, hotspotId: HotspotId }),
  Ping,
  Pong,
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

/** From the server to browsers. */
export const ServerMessage = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('log-entry'), entry: LogEntry }),
  z.strictObject({ type: z.literal('demo-received'), request: DemoRequest }),
  Ping,
  Pong,
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

export type ParseResult<T> = { ok: true; message: T } | { ok: false; error: string };

/**
 * Reads one WebSocket text frame. Never throws: a broken or outdated client is an expected case,
 * and one bad message must not close the connection or crash the server.
 */
export function parseMessage<T>(schema: ZodType<T>, text: string): ParseResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON' };
  }
  const result = schema.safeParse(json);
  if (result.success) return { ok: true, message: result.data };
  const issue = result.error.issues[0];
  const path = issue ? formatPath(issue.path) : '';
  const message = issue?.message ?? 'Invalid message';
  return { ok: false, error: path ? `${path}: ${message}` : message };
}
