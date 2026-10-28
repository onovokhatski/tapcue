# Architecture Decision Records

An ADR records one significant decision: the situation, what was chosen, what else was
considered and what the choice costs. ADRs are never rewritten after acceptance; a changed
decision gets a new ADR that supersedes the old one.

| # | Decision | Status |
|---|---|---|
| [0001](0001-local-server.md) | Local server in the stand network | Accepted |
| [0002](0002-npm-workspaces.md) | npm workspaces with three packages | Accepted |
| [0003](0003-zod-schemas.md) | Zod schemas in `shared` as the single source of truth | Accepted |
| [0004](0004-shared-page-renderer.md) | One page renderer for player and editor | Accepted |
| [0005](0005-player-sends-hotspot-refs.md) | Player sends hotspot references, not commands | Accepted |
| [0006](0006-websocket-and-http.md) | WebSocket for real-time messages, HTTP for documents and files | Accepted |
| [0007](0007-own-osc-encoder.md) | Own OSC encoder instead of a library | Accepted |
| [0008](0008-styling.md) | Tailwind for app UI, CSS variables and keyframes for hotspots | Accepted |
| [0009](0009-filesystem-storage.md) | Filesystem storage, no database | Accepted |
| [0010](0010-no-auth-in-mvp.md) | No authentication in MVP | Accepted |
| [0011](0011-autosave-whole-project.md) | Auto-save with whole-project `PUT` | Accepted |
| [0012](0012-add-hotspot-button.md) | "Add hotspot" button instead of a drawing mode | Accepted |
| [0013](0013-demo-mode.md) | Demo mode as a server flag | Accepted |

## Template

```markdown
# NNNN. Title

Status: Proposed | Accepted | Superseded by NNNN · Date: YYYY-MM-DD

## Context
What situation and forces lead to this decision.

## Decision
What we do.

## Alternatives considered
What else was possible and why it was not chosen.

## Consequences
What becomes easier, what becomes harder, what we accept.
```
