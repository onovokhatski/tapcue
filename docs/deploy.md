# Deploying the online demo

The public online demo runs on Railway, built from the repository's `Dockerfile`
([ADR 0018](adr/0018-online-demo-on-railway.md)). The image starts Tapcue in demo mode
(`TAPCUE_DEMO=1`) on the port Railway gives in `PORT`, with the demo stand: nothing is saved, and
every command is shown on the demo page instead of being sent ([spec DEMO-3](spec.md#510-demo-receiver)).
CI builds and runs the same image on every pull request (the `docker` job).

GitHub sends each deploy to Railway: after CI passes on `main`, the `Deploy demo` workflow runs
`railway up` with a Railway project token. The Railway account therefore does not need access to
this repository, which may belong to another GitHub account.

## Set up once

In the Railway dashboard:

1. **New Project → Empty Project**, then in it **Create → Empty Service**, named `tapcue-demo`.
2. In the service's **Settings**:
   - Healthcheck path: `/api/health`.
   - One replica, and no app sleeping (serverless): the demo must answer at once, and its command
     log and connections live in one process.
   - **Networking → Generate Domain.** No environment variables are needed: demo mode is set in
     the image, and Railway provides `PORT`.
3. In the **project's** Settings → **Tokens**, create a token for the `production` environment.

On GitHub, in this repository's **Settings → Secrets and variables → Actions**, add it as the
secret `RAILWAY_TOKEN`.

From then on every merge into `main` deploys again. To deploy without a merge, run the
`Deploy demo` workflow by hand (Actions → Deploy demo → Run workflow).

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
