# 0002. npm workspaces with three packages

Status: Accepted · Date: 2026-10-25

## Context
The server and the web app must agree on the project format and message shapes. They run in
different environments (Node.js and the browser) and must not depend on each other's code.

## Decision
One repository with npm workspaces and three packages: `shared` (schemas and types),
`server` and `web`. `server` and `web` depend only on `shared`, never on each other.

## Alternatives considered
- **One package with folders.** Simpler setup, but nothing stops the browser code from
  importing server code by accident; the boundary would exist only by convention.
- **Nx or Turborepo.** Useful for large monorepos (task caching, many packages); for three
  packages they add configuration without benefit.
- **Separate repositories.** The shared format would need publishing and versioning on every change.

## Consequences
- The package boundary is enforced by the dependency graph, not by discipline.
- A format change shows type errors on both sides at once.
- Slightly more setup: one `package.json` and `tsconfig` per package.
