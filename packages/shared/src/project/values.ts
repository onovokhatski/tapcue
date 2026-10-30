// Small value types used across the project format (docs/project-format.md §9).
import { z } from 'zod';

/** Generated id: a one-letter kind prefix, "_", then six lowercase letters or digits. */
function generatedId(prefix: string, kind: string) {
  return z
    .string()
    .regex(new RegExp(`^${prefix}_[a-z0-9]{6}$`), `Expected a ${kind} id like "${prefix}_a1b2c3"`);
}

export const PageId = generatedId('p', 'page');
export type PageId = z.infer<typeof PageId>;

export const HotspotId = generatedId('h', 'hotspot');
export type HotspotId = z.infer<typeof HotspotId>;

export const TargetId = generatedId('t', 'target');
export type TargetId = z.infer<typeof TargetId>;

/** Station ids are human-readable because they are part of the player URL /play/<id>. */
export const StationId = z
  .string()
  .regex(/^[a-z0-9-]{1,40}$/, 'Expected 1–40 characters: lowercase letters, digits and "-"')
  // A send from the editor is marked "test" in the X-Tapcue-Station header (spec TGT-6).
  .refine((id) => id !== 'test', '"test" is reserved for test sends from the editor');
export type StationId = z.infer<typeof StationId>;

/** Opaque colour; transparency is a separate field, so there is one way to express it. */
export const Color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Expected a colour like "#3A7BFF"');
export type Color = z.infer<typeof Color>;

/** A file directly inside the project's assets/ folder: no subfolders, no way out of it. */
export const AssetPath = z
  .string()
  .regex(
    /^assets\/[A-Za-z0-9._-]+$/,
    'Expected "assets/<file name>" using only A–Z, a–z, 0–9, ".", "_" and "-"',
  )
  .refine(
    (path) => path !== 'assets/.' && path !== 'assets/..',
    'Expected a file name, not "." or ".."',
  );
export type AssetPath = z.infer<typeof AssetPath>;

/** Display name of a project, page, target or station. */
export const Name = z
  .string()
  .min(1, 'Expected a name')
  .max(100, 'Expected at most 100 characters');
export type Name = z.infer<typeof Name>;
