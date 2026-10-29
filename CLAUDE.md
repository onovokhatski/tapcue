# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

Tapcue — touch interfaces for exhibition stands: designer artwork as pages, hotspots on top,
taps send OSC/UDP/HTTP commands to a media server. A portfolio project: code must be simple,
readable, and every module justified. Docs: `docs/spec.md` (requirements with IDs),
`docs/architecture.md`, `docs/project-format.md`, `docs/roadmap.md`, `docs/adr/`, `docs/design/`.

## Commands

```bash
npm run dev          # server (4000) + web (http://localhost:5173)
npm run typecheck    # all packages
npm run lint         # ESLint, type-aware
npm run format:check # Prettier (npm run format to fix)
npm test             # Vitest, all packages
npm run build        # web production build
```

## Layout

- `packages/shared` — Zod schemas of the project format and `validateProject()`. No DOM or Node APIs.
- `packages/server` — Fastify, run with `tsx`. Node APIs allowed.
- `packages/web` — Vite + React + React Router + Tailwind v4. Design tokens in
  `src/styles/tokens.css` (source of truth), Tailwind mapping in `src/styles/theme.css`.
  Tests in happy-dom with React Testing Library.
- `examples/demo-stand` — the demo project used by tests and the server default.
- `server` and `web` import only `@tapcue/shared`, never each other.

## How work is done

- Phases are done in order; current phase: implementation, milestone M1 (player). Issues and
  milestones on GitHub (`onovokhatski/tapcue`) are the plan.
- One issue → one branch `<type>/<issue>-<name>` → one PR with What / Why / Decisions /
  How it was checked / Definition of Done, `Closes #N`, labels and milestone. Squash merge.
- `main` is protected: PR + green `check` required, also for admins.
- **Merge only on an explicit command from the user** ("merge", "Merge when green").
  Before deleting a branch, confirm `merged: true` via `gh api .../pulls/N`.
- Small steps, each decision explained; the user reviews every PR.
- Do not poll CI in a loop: read its state once when asked.
- Tests prove behaviour: check exact paths/messages, mutation-check important rules.
- Everything in git (code, docs, commits, PRs) is in English; chat with the user is in Russian.
- No emoji anywhere in the app UI.
