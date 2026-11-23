// Hotspot names are unique on their page (spec ED-14): the command log, the demo receiver and the
// editor's lists all show them. Names are compared trimmed and ignoring case; an empty name is the
// optional "Unnamed" and never clashes. The format does not enforce this, so duplicates in older
// projects stay valid until edited.
import type { HotspotId, Page } from '@tapcue/shared';

/** Hotspot names are at most this long (the project format). */
const MAX_NAME = 100;

const key = (name: string) => name.trim().toLowerCase();

/** "Play demo 2" → stem "Play demo"; a name without a number is its own stem. */
const NUMBERED = /^(.*\S)\s+\d+$/;

/**
 * `name` itself when no other hotspot on the page has it; otherwise its stem with the lowest free
 * number from 2: "Play demo" → "Play demo 2", "Play demo 2" → "Play demo 3". A new hotspot asks for
 * "Button 1" and gets the lowest free "Button N".
 */
export function freeName(page: Page, name: string): string {
  const trimmed = name.trim();
  const taken = new Set(page.hotspots.map((h) => key(h.name)));
  if (trimmed === '' || !taken.has(key(trimmed))) return trimmed;
  const stem = NUMBERED.exec(trimmed)?.[1] ?? trimmed;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate = stem.slice(0, MAX_NAME - suffix.length).trimEnd() + suffix;
    if (!taken.has(key(candidate))) return candidate;
  }
}

/**
 * Why `name` cannot be this hotspot's new name, or null. Keeping its current name is always fine,
 * even when an older project has it twice.
 */
export function nameProblem(page: Page, hotspotId: HotspotId, name: string): string | null {
  const hotspot = page.hotspots.find((h) => h.id === hotspotId);
  const wanted = key(name);
  if (wanted === '' || !hotspot || wanted === key(hotspot.name)) return null;
  // Its own name was handled above, so any hotspot with this name is another one.
  const clash = page.hotspots.some((h) => key(h.name) === wanted);
  return clash ? 'Already used on this page by another hotspot' : null;
}
