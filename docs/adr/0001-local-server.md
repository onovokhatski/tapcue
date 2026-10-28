# 0001. Local server in the stand network

Status: Accepted · Date: 2026-10-25

## Context
Tapcue must send OSC/UDP, raw UDP and HTTP to media servers on the stand. Browsers cannot
send UDP. Exhibition venues often have no reliable internet, and a tap must reach the media
server in under 100 ms ([spec NFR-2](../spec.md#7-non-functional-requirements)).
Several tablets must share one project and receive edits live.

## Decision
A Node.js server runs on a computer in the stand's local network. It stores the project,
serves the editor and player as web pages, and delivers commands. Tablets only need a browser.

## Alternatives considered
- **Cloud service.** Needs internet at the venue, adds latency, cannot reach devices in a
  private network without tunnelling, costs money to run.
- **Native tablet app sending UDP directly.** Needs an app per platform and app-store
  distribution; keeping several tablets and an editor in sync would need a server anyway.
- **Desktop app (e.g. Electron) on the stand computer.** Possible later as packaging around
  the same server; it adds nothing the MVP needs.

## Consequences
- Tablets need no installation: open a URL, add to home screen.
- The stand needs a computer running Tapcue, on the same network as the tablets.
- Everything works offline within the local network.
