# 0021. A library of projects, one of them active

Status: Accepted · Date: 2026-11-21

## Context
One server runs one project, chosen by `--project` when it starts
([spec §8](../spec.md#8-assumptions-and-constraints), PRJ-1). An integrator who starts a new
stand copies the demo stand by hand and restarts the server on the copy. Someone preparing
several stands, or keeping last year's, has to manage folders and restarts. The click-to-run
app already keeps its project in `Documents/Tapcue` ([ADR 0017](0017-click-to-run-app.md)),
a natural home for more of them.

## Decision
The server keeps a **library**: a folder whose subfolders are projects. It runs one of them,
the **active project**, and can switch to another while it runs.

- **The library is a plain folder of project folders,** each in the format as it is today
  ([ADR 0009](0009-filesystem-storage.md)). A project can still be copied, zipped or put in git
  by hand. The only extra file is `tapcue.json`, which names the active project, so it is
  opened again after a restart.
- **Where:** `--projects <dir>` or `TAPCUE_PROJECTS`; by default `Documents/Tapcue` in the
  user's home folder, for `npm start` and the click-to-run app alike.
- **Which project runs:** the one `--project` names, else the one `tapcue.json` names, else the
  default as before (the repository's demo stand, or the app's copy of it). A project opened
  with `--project` may lie outside the library; it is then listed as active with no id.
- **Ids are folder names.** A new project's folder is its name in lowercase letters, digits
  and `-`, made unique with a number (`weplay-2026`, `weplay-2026-2`). Renaming a project does
  not move its folder. Requests can name only folders the library lists.
- **A new project is empty:** a name and a canvas size give one blank page and one station,
  `main`, that starts on it.
- **Opening switches at once,** as an import does (PRJ-4): the project is checked like a load,
  the revision goes up and every station and editor hears `project-updated`. Fader values start
  over from each fader's start. An editor save based on the previous project is refused with
  `409`, so a late autosave cannot write one stand's pages into another.
- **Deleting moves the folder into the library's `.trash/`,** so a mistake can be undone by
  hand. The active project cannot be deleted.
- **The online demo keeps one project:** it neither reads `tapcue.json` nor allows creating,
  opening or deleting, so visitors cannot change the shared instance (spec DEMO-3).

## Alternatives considered
- **Replace the current project with an empty one, keeping one project per server.** Smaller,
  but the previous stand is lost unless exported first, and switching between stands means
  export and import every time.
- **An index file listing projects with their paths,** so projects could live anywhere. Two
  sources of truth to keep in step; a folder moved by hand would leave a dangling entry.
- **Delete for good.** Simpler, but one wrong click loses a stand's artwork and settings.

## Consequences
- A stand laptop can hold several stands and switch between them from the editor.
- `PRJ-1` changes: the server loads the active project at start and can open another later.
- Everything that read the project folder once at start (asset files, uploads, the store)
  now reads the active one on every request.
- Saves carry the revision they are based on; a save from before a switch is refused.
- Emptying `.trash/` is left to the file system.
