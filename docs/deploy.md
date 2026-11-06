# Deploying the online demo

The public online demo runs on Railway, built from the repository's `Dockerfile`
([ADR 0018](adr/0018-online-demo-on-railway.md)). The image starts Tapcue in demo mode
(`TAPCUE_DEMO=1`) on the port Railway gives in `PORT`, with the demo stand: nothing is saved, and
every command is shown on the demo page instead of being sent ([spec DEMO-3](spec.md#510-demo-receiver)).
CI builds and runs the same image on every pull request (the `docker` job).

## Set up once

In the Railway dashboard, with the maintainer's account:

1. **New Project → Deploy from GitHub repo**, and choose `onovokhatski/tapcue`. Railway finds the
   `Dockerfile` and builds from it; no build or start command is needed.
2. **Settings → Deploy:**
   - Healthcheck path: `/api/health`.
   - One replica, and no app sleeping (serverless): the demo must answer at once, and its command
     log and connections live in one process.
   - If offered, wait for CI before deploying, so only a green `main` goes live.
3. **Settings → Networking → Generate Domain.** No environment variables are needed: demo mode is
   set in the image, and Railway provides `PORT`.

From then on every merge into `main` deploys again.

## Check after a deploy

On the public URL:

- `/` opens the editor, with "Demo mode · not saved" in the top bar.
- `/play/main` shows the demo stand's Home page; a tap on "Call our team" appears on `/demo`.
- A change in the editor is not saved: after a reload the original demo stand is back.
- Uploads and Import are turned off with their reason.

## Run the image locally

```bash
docker build -t tapcue-demo .
```

```bash
docker run --rm -e PORT=8080 -p 8080:8080 tapcue-demo
```

Then open `http://localhost:8080`.
