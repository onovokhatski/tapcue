# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

Tapcue — touch interfaces for exhibition stands: designer artwork as pages, hotspots on top,
taps send OSC/UDP/HTTP commands to a media server. A portfolio project: code must be simple,
readable, and every module justified. Docs: `docs/spec.md` (requirements with IDs),
`docs/architecture.md`, `docs/project-format.md`, `docs/roadmap.md`, `docs/adr/`, `docs/design/`.

## Commands

```bash
npm start            # build web + server serving everything on 4000 (as on a stand)
npm run dev          # server (4000) + web (http://localhost:5173)
npm run typecheck    # all packages
npm run lint         # ESLint, type-aware
npm run format:check # Prettier (npm run format to fix)
npm test             # Vitest, all packages
npm run test:e2e     # Playwright: player → server → demo receiver in Chromium
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

- Phases are done in order: implementation, milestones M0–M5 (`docs/roadmap.md`). Issues and
  milestones on GitHub (`onovokhatski/tapcue`) are the plan; the current milestone is the earliest
  one with open issues, and its open issues are the next steps, in number order.
- One issue → one branch `<type>/<issue>-<name>` → one PR with What / Why / Decisions /
  How it was checked / Definition of Done, `Closes #N`, labels and milestone. Squash merge.
- `main` is protected: PR + green `check` required, also for admins.
- **Merge only on an explicit command from the user** ("merge", "Merge when green").
  Before deleting a branch, confirm `merged: true` via `gh api .../pulls/N`.
- Small steps, each decision explained; the user reviews every PR.
- Do not poll CI in a loop: read its state once when asked.
- Tests prove behaviour: check exact paths/messages, mutation-check important rules.
- Stage files by name, never a whole folder: local, untracked helpers must not reach a commit.
- Everything in git (code, docs, commits, PRs) is in English; chat with the user is in Russian.
- No emoji anywhere in the app UI.
