// OSC over UDP: one OSC message per datagram (spec TGT-2).
import { openDatagramSender } from './datagram';
import type { Driver } from './driver';
import { encodeOsc } from './osc-encode';

export function createOscUdpDriver(): Driver<'osc-udp'> {
  const sender = openDatagramSender();
  return {
    send: (target, command) =>
      sender.send(encodeOsc(command.address, command.args), target.host, target.port),
    close: () => sender.close(),
  };
}
