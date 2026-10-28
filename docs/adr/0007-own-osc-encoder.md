# 0007. Own OSC encoder instead of a library

Status: Accepted · Date: 2026-10-25

## Context
Tapcue only sends OSC messages with integer, float and string arguments. It never receives
OSC and does not need bundles or time tags.

## Decision
Write a small pure function that encodes an OSC message into bytes, covered by byte-exact
tests against known packets.

## Alternatives considered
- **An OSC library** (e.g. osc.js, node-osc). Full protocol support, but far more than needed,
  with extra dependencies and their maintenance status to watch.

## Consequences
- About 50 lines of code that are easy to read, test and explain.
- New argument types (blob, true/false, etc.) are ours to add when needed.
- Shows understanding of the protocol rather than only of a library's API.
