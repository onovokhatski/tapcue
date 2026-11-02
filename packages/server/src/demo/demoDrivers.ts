// In demo mode every command goes to the demo receiver, whatever its target says, so a public
// server never sends traffic to other hosts (spec DEMO-3, ADR 0013). Nothing leaves the server: each
// command becomes the request the demo page would have shown, under a screen named after its target.
import type { DemoRequest, LogSource } from '@tapcue/shared';
import type { Drivers } from '../commands/dispatcher';
import type { CommandOf, Driver, SendContext, TargetOf } from '../commands/drivers/driver';

/** An HTTP command written for the demo receiver keeps its own screen and content. */
const DEMO_PATH = /^\/demo\/([^/?]+)\/([^/?]+)/;

export function createDemoDrivers(
  onRequest: (request: DemoRequest) => void,
  now: () => Date = () => new Date(),
): Drivers {
  const deliver = (
    screen: string,
    content: string,
    method: string,
    body: string | null,
    context: SendContext,
    path = `/demo/${screen}/${encodeURIComponent(content)}`,
  ) => {
    onRequest({
      time: now().toISOString(),
      method,
      path,
      screen,
      content,
      body,
      station: station(context.source),
      hotspot: context.hotspotName,
    });
    return Promise.resolve();
  };
  const close = () => Promise.resolve();

  const osc: Driver<'osc-udp'> = {
    send: (target: TargetOf<'osc-udp'>, command: CommandOf<'osc-udp'>, context) => {
      const args = command.args.map((arg) => ` ${arg.value}`).join('');
      return deliver(screenOf(target.name), `${command.address}${args}`, 'OSC', null, context);
    },
    close,
  };
  const udp: Driver<'udp'> = {
    send: (target, command, context) =>
      deliver(screenOf(target.name), command.text.trim() || command.text, 'UDP', null, context),
    close,
  };
  const http: Driver<'http'> = {
    send: (target, command, context) => {
      const demo = DEMO_PATH.exec(command.path);
      if (demo) {
        const path = command.path.split('?')[0]!;
        return deliver(demo[1]!, demo[2]!, command.method, command.body, context, path);
      }
      const content = `${command.method} ${command.path}`;
      return deliver(screenOf(target.name), content, command.method, command.body, context);
    },
    close,
  };
  return { 'osc-udp': osc, udp, http };
}

/** "Resolume Arena" → "resolume-arena": the demo page's tile for that target. */
export function screenOf(targetName: string): string {
  const slug = targetName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'target';
}

/** The same as the HTTP driver's X-Tapcue-Station header (spec TGT-6). */
function station(source: LogSource): string {
  return source.type === 'test' ? 'test' : source.stationId;
}
