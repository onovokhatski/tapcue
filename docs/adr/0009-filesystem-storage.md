# 0009. Filesystem storage, no database

Status: Accepted · Date: 2026-10-25

## Context
A project is a few kilobytes of JSON plus media files, edited by one integrator at a time.
It must be easy to copy, back up and inspect.

## Decision
The project is a folder: `project.json` and `assets/`. Saves are atomic (write a temporary
file, then rename). The command log is kept in memory only.

## Alternatives considered
- **SQLite.** Transactions and queries are not needed for one small document; media would
  still live on disk; the project would no longer be a folder a person can open.
- **A database server.** Extra installation on the stand computer for no benefit.

## Consequences
- Moving a project is copying a folder or a zip.
- `project.json` is human-readable and diff-friendly.
- No concurrent editing support beyond "last save wins".
