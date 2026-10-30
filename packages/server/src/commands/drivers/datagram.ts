// One UDP socket shared by the OSC and UDP drivers: both send a single datagram per command.
import { createSocket } from 'node:dgram';

export interface DatagramSender {
  /**
   * Resolves when the datagram has left the server. UDP cannot confirm arrival, so the only
   * errors are local ones, such as a host name that does not resolve (spec TGT-5).
   */
  send(bytes: Uint8Array, host: string, port: number): Promise<void>;
  close(): Promise<void>;
}

export function openDatagramSender(): DatagramSender {
  const socket = createSocket('udp4');
  // Without a listener an asynchronous socket error would crash the server; errors of a send
  // are reported through its callback instead.
  socket.on('error', () => undefined);

  return {
    send: (bytes, host, port) =>
      new Promise((resolve, reject) => {
        socket.send(bytes, port, host, (error) => {
          if (error) reject(new Error(`Could not send to ${host}:${port}: ${error.message}`));
          else resolve();
        });
      }),
    close: () => new Promise((resolve) => socket.close(() => resolve())),
  };
}
