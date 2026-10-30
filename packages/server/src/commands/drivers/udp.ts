// Plain UDP: the command text as UTF-8 in one datagram, e.g. a projector's "%1INPT 31\r" (spec TGT-2).
import { openDatagramSender } from './datagram';
import type { Driver } from './driver';

export function createUdpDriver(): Driver<'udp'> {
  const sender = openDatagramSender();
  return {
    send: (target, command) =>
      sender.send(new TextEncoder().encode(command.text), target.host, target.port),
    close: () => sender.close(),
  };
}
