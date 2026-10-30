// A stand-in for the browser's WebSocket: tests open, feed and close it by hand.
// Install with vi.stubGlobal('WebSocket', FakeWebSocket); FakeWebSocket.all lists every socket made.
export class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static all: FakeWebSocket[] = [];

  /** The latest socket made. */
  static get last(): FakeWebSocket {
    const socket = FakeWebSocket.all.at(-1);
    if (!socket) throw new Error('No WebSocket was opened');
    return socket;
  }

  readyState = FakeWebSocket.CONNECTING;
  /** Every text frame the code under test sent, parsed. */
  sent: unknown[] = [];

  constructor(readonly url: string) {
    super();
    FakeWebSocket.all.push(this);
  }

  send(data: string) {
    if (this.readyState !== FakeWebSocket.OPEN)
      throw new Error('Sent on a socket that is not open');
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }

  // ---------- The server's side ----------

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  receive(message: unknown) {
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.dispatchEvent(new MessageEvent('message', { data }));
  }

  /** The connection drops without the page asking for it. */
  drop() {
    this.close();
  }
}
