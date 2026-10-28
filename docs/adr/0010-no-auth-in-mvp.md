# 0010. No authentication in MVP

Status: Accepted · Date: 2026-10-25

## Context
Tapcue runs in the stand's own local network, usually a dedicated access point. Adding
authentication means login screens, session handling and password storage.

## Decision
The MVP has no authentication. The README and documentation state clearly that the server is
for trusted local networks only. An editor password is planned after the MVP.

## Alternatives considered
- **A single editor password.** Small effort, but it adds a screen, session cookies and
  secure password storage before the core product works.

## Consequences
- Anyone on the stand network can open the editor.
- The public online demo needs its own protection (see [0013](0013-demo-mode.md)).
- Adding a password later touches only the HTTP layer and the editor's entry point.
