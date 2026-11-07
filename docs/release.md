# Releasing

A release is a version tag. CI does the rest: on a pushed `v*` tag it runs every job on the tagged
commit and, when all pass, creates the GitHub release. The release notes are that version's
section of [CHANGELOG.md](../CHANGELOG.md). Attached are `Tapcue-macos.zip` and
`Tapcue-windows.zip`, the click-to-run apps built and started by the `app` job
([ADR 0017](adr/0017-click-to-run-app.md)).

1. In a pull request, add the version's section to `CHANGELOG.md` and set the version in every
   `package.json`:

```bash
npm version 0.2.0 --no-git-tag-version --workspaces --include-workspace-root
```

2. After it is merged, tag `main` and push the tag:

```bash
git switch main && git pull
```

```bash
git tag -a v0.2.0 -m "Tapcue v0.2.0" && git push origin v0.2.0
```

3. Watch the CI run for the tag. The `release` job checks that the tag matches `package.json` and
   that `CHANGELOG.md` has the section; if either is missing, no release is made. Fix it, delete
   the tag (`git push origin :v0.2.0`, `git tag -d v0.2.0`) and tag again.

The release is not code-signed (see the README for the first start). The online demo is not
affected: it deploys from `main` ([deploying the online demo](deploy.md)).
