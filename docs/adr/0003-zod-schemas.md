# 0003. Zod schemas in `shared` as the single source of truth

Status: Accepted · Date: 2026-10-25

## Context
`project.json` comes from disk, uploads and the editor; WebSocket messages come from the
network. Their shape must be checked at runtime, and the same shape is needed as TypeScript
types at compile time. Writing both by hand lets them drift apart.

## Decision
Define the project format and all messages as Zod schemas in `shared`. TypeScript types are
inferred from the schemas (`z.infer`). Cross-references (e.g. `goTo` points to an existing
page) are checked with a refinement over the whole project.

## Alternatives considered
- **TypeScript types only.** No runtime validation; a broken file would crash deep in the code.
- **JSON Schema + Ajv.** Language-neutral, but types need a generation step and refinements
  across the document are awkward.
- **Valibot, io-ts.** Similar ideas; Zod is the most widely known, which matters for a portfolio.

## Consequences
- One definition gives both validation and types; they cannot disagree.
- Readable error paths (`pages[2].hotspots[0].action.goTo`) come for free.
- Zod is part of the browser bundle (a few tens of kB).
