# 0013. Demo mode as a server flag

Status: Accepted · Date: 2026-10-25

## Context
A public online demo lets reviewers try Tapcue without installing anything. But the editor
has no authentication ([0010](0010-no-auth-in-mvp.md)): on the internet anyone could delete
the demo, upload offensive images, fill the disk, or create targets that make the server
send traffic to third-party hosts.

## Decision
A server start flag enables demo mode ([spec DEMO-3](../spec.md#510-demo-receiver)): the
editor works fully but changes stay in the visitor's browser tab; the server rejects saving,
uploads and import; every command is delivered to the demo receiver regardless of its target.

## Alternatives considered
- **No online demo, video only.** Safe, but most reviewers will never try the product.
- **Read-only editor.** Safe, but the reviewer cannot feel how editing works.
- **Periodic reset.** Everything works, but vandalism and abuse remain possible between resets.

## Consequences
- Every visitor starts from the original demo project; nothing they do affects others.
- Uploading own images and seeing editor changes in a separate player tab are not available in the demo.
- Implementation is a few checks in the server and one flag in the editor, not a separate build.
