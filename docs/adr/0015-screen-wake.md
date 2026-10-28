# 0015. Screen wake is part of stand setup, not a player guarantee

Status: Accepted · Date: 2026-10-27

## Context
A stand's tablet must stay on all day ([spec PLY-4](../spec.md#58-player)). The
[iPad spike](../spike-ipad.md) showed that the Screen Wake Lock API is unavailable on plain
`http://` pages, which is how Tapcue is served in a local network, and that whether the iPad
sleeps is decided by its own settings, not by the page.

## Decision
- The player **requests a wake lock where the browser offers one** (secure contexts, other
  platforms), and re-requests it when the page becomes visible again.
- Keeping the tablet awake is a **documented stand-setup step**: Auto-Lock set to Never and
  Guided Access enabled. A stand setup guide is part of the documentation.

## Alternatives considered
- **Serve Tapcue over HTTPS in the local network.** Enables Wake Lock, but needs a certificate
  every tablet trusts — a manual profile install on each iPad, harder than one setting.
- **Hidden playing video trick** (as used by NoSleep.js). The spike could not show that it
  helps (the device's settings decided in every mode), and it relies on undocumented browser
  behaviour.

## Consequences
- No fragile workaround in the code.
- Reliability depends on the integrator following the setup guide; the guide must be short and
  impossible to miss.
