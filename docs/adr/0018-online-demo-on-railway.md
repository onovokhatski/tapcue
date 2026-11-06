# 0018. Online demo on Railway, built from a Dockerfile

Status: Accepted · Date: 2026-11-05

## Context
The public online demo lets reviewers try Tapcue without installing anything
([spec DEMO-3](../spec.md#510-demo-receiver), ADR [0013](0013-demo-mode.md)). The roadmap left the
host open until M5. The demo needs one Node.js server that keeps WebSocket connections open, runs
as a single instance (the command log and the connections live in memory), stores nothing (demo
mode refuses every write), and should answer at once: the first visitor usually comes from the
README and should not wait for a sleeping server to wake.

## Decision
- The demo runs on **Railway**, on the Hobby plan of the account the maintainer already has: one
  service, one instance, always on, deployed from `main` of the GitHub repository on every merge.
- It is built from a **`Dockerfile`** in the repository: Node.js 22, `npm ci`, `npm run build`,
  then the server started with `TAPCUE_DEMO=1` on the port Railway gives in `PORT`. Railway builds
  a repository's `Dockerfile` by itself; the health check is `GET /api/health`.
- Account, project, domain and any secrets are set in Railway's dashboard by the maintainer; the
  repository holds only the `Dockerfile` and a short deploy note.

## Alternatives considered
- **Fly.io, always on.** About the same price and also Docker-based, but a new account and a
  GitHub Action with a deploy token; Railway's account already exists and deploys from GitHub
  itself.
- **Render, free.** No cost, but the service sleeps after 15 minutes and the next visitor waits
  about a minute.
- **Koyeb, free.** Sleeps after an hour, and WebSockets on its free instance are not documented.
- **Railway's own config file instead of a Dockerfile.** `railway.json` is deprecated for new
  services and its successor is still changing; a Dockerfile works the same on any host.

## Consequences
- The demo answers immediately, and stays up to date with `main` without manual steps.
- It costs the Hobby plan's monthly fee; a demo server uses a fraction of the usage it includes.
- Moving to another host means pointing it at the same `Dockerfile`.
- The demo shares nothing between visitors and writes nothing, so a restart or redeploy loses
  nothing but the demo page's recent requests.
