# 0017. Click-to-run app as a single executable

Status: Accepted · Date: 2026-11-02

## Context
Tapcue starts with `npm start` (#123), which needs Node.js, a copy of the repository and
`npm install` on the stand computer. Integrators expect to click an icon and start working
([spec NFR-6](../spec.md#7-non-functional-requirements)). ADR [0001](0001-local-server.md)
left a desktop app open as later packaging around the same server. What runs the editor, a
browser or an app window, does not matter; tablets open the player in their browser either way.

## Decision
Tapcue is also shipped as one executable per platform, built with Node's single executable
application feature: `Tapcue.app` for macOS and `Tapcue.exe` for Windows.

- The executable contains Node.js, the server bundled into one JavaScript file, the web app's
  production build and the demo stand.
- A click starts the server on port 4000 and opens `http://localhost:4000/edit` in the default
  browser.
- Projects live in a normal folder, `Documents/Tapcue`; on first start the demo stand is copied
  there.
- CI builds both files on macOS and Windows; they are attached to each GitHub release.
- `npm start` and `npm run dev` stay as they are for people who work from the repository.

## Alternatives considered
- **Electron.** Its own window, dock icon and menus, but a separate shell to maintain and a
  larger download (about 150 MB against about 100 MB). Only the editor would use the window:
  players run in the tablets' browsers anyway.
- **A launcher script** (`.command` on macOS, `.bat` on Windows) running `npm start`. Clickable,
  but still needs Node.js and `npm install`.
- **No packaging, `npm start` only.** Simplest to build, but not what an integrator expects.

## Consequences
- An integrator downloads one file and clicks it; no Node.js, no terminal.
- The server must run without `tsx` and find everything it serves inside the package, which
  adds a bundle step and a folder for the user's projects.
- The apps are not code-signed at first: macOS warns about an unidentified developer (open with
  right-click → Open) and Windows SmartScreen warns too. Signing needs an Apple Developer
  account and a Windows certificate; it can be added later without changing the app.
- Two more CI jobs build the files for every release.
