// Which backgrounds the player prepares before they are needed (spec PG-5, ADR 0014).
import type { PageId, Project, Station } from '@tapcue/shared';
import { assetUrl } from '../stage/assetUrl';

/**
 * How many video pages stay loaded and playing under the current page. Each costs memory and
 * decoding power on the tablet; 2 is the starting value until it is measured on an iPad (#30).
 */
export const WARM_VIDEO_LIMIT = 2;

/**
 * The video pages the visitor can reach next from `pageId` — its hotspots' goTo targets in
 * stacking order, then the station's start page (the idle return) — at most `limit` of them.
 * Image pages are not listed: all images are decoded at start (see imageUrls).
 */
export function warmPages(
  project: Project,
  station: Station,
  pageId: PageId,
  limit = WARM_VIDEO_LIMIT,
): PageId[] {
  const page = project.pages.find((p) => p.id === pageId);
  const targets = [
    ...(page?.hotspots ?? []).map((hotspot) => hotspot.action.goTo),
    station.startPageId,
  ];

  const warm: PageId[] = [];
  for (const target of targets) {
    if (warm.length >= limit) break;
    if (target === null || target === pageId || warm.includes(target)) continue;
    const background = project.pages.find((p) => p.id === target)?.background;
    if (background?.type === 'video') warm.push(target);
  }
  return warm;
}

/** The URL of every image background in the project, once each. */
export function imageUrls(project: Project): string[] {
  const urls = project.pages.flatMap((page) =>
    page.background?.type === 'image' ? [assetUrl(page.background.asset)] : [],
  );
  return [...new Set(urls)];
}
