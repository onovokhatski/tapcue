# 0005. Player sends hotspot references, not commands

Status: Accepted · Date: 2026-10-25

## Context
When a visitor taps a hotspot, the server must send its command. The player could send the
command itself, or only say which hotspot was tapped.

## Decision
The player sends `{ pageId, hotspotId }`. The server looks up the action in its own copy of
the project and sends the command.

## Alternatives considered
- **Player sends the full command.** Slightly simpler server, but a player with an outdated
  project sends outdated commands, and any browser on the network can make the server send
  arbitrary packets to arbitrary hosts.

## Consequences
- The server's project is the single source of truth for what a tap does.
- The server cannot be used as an open packet relay through the WebSocket.
- A tap on a hotspot that no longer exists is ignored and logged.
