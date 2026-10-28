# 0006. WebSocket for real-time messages, HTTP for documents and files

Status: Accepted · Date: 2026-10-25

## Context
Players send taps and must be told when the project changes; editors must see the command
log live; the server must notice dead tablet connections. The project document and media
files are also transferred.

## Decision
One WebSocket endpoint for small real-time messages in both directions (taps, update
notifications, log entries, ping/pong). Plain HTTP for the project document, uploads,
media files and zip import/export.

## Alternatives considered
- **HTTP polling.** Adds latency and constant traffic from every tablet.
- **Server-Sent Events + HTTP POST for taps.** Viable; but two mechanisms instead of one,
  and no built-in way to detect a dead connection from the server side.
- **Socket.IO.** Adds its own protocol and library on both ends; reconnect and ping are
  small enough to write and test ourselves.
- **Everything over WebSocket.** Files and large documents fit HTTP's caching, range requests
  and upload handling much better.

## Consequences
- Taps arrive with minimal latency over an already open connection.
- Reconnect and heartbeat logic is ours to write and test.
- Each protocol is used for what it is good at.
