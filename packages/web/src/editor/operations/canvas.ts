// Canvas and project settings: pure functions (project, args) => project (spec CNV-1, CNV-2, ED-10,
// PG-4, PG-10, project format §2, §3). An operation that cannot apply returns the same project.
import { type Canvas, pageTransition, type Project, type Transition } from '@tapcue/shared';

type Dimension = 'width' | 'height';

/**
 * Why the canvas cannot have this width or height, or null. A size that would leave a hotspot
 * outside the canvas names the hotspot that reaches furthest: hotspots are never moved silently.
 */
export function checkCanvasSize(
  project: Project,
  dimension: Dimension,
  pixels: number,
): string | null {
  if (!Number.isInteger(pixels)) return 'Expected a whole number of pixels';
  if (pixels < 1 || pixels > 8192) return 'Expected 1 to 8192 px';
  const furthest = project.pages
    .flatMap((page) =>
      page.hotspots.map((hotspot) => ({
        page,
        hotspot,
        edge: dimension === 'width' ? hotspot.x + hotspot.width : hotspot.y + hotspot.height,
      })),
    )
    .reduce<{ edge: number; label: string } | null>(
      (worst, { page, hotspot, edge }) =>
        edge > pixels && (!worst || edge > worst.edge)
          ? {
              edge,
              label: `${hotspot.name ? `“${hotspot.name}”` : 'An unnamed hotspot'} on ${page.name}`,
            }
          : worst,
      null,
    );
  if (!furthest) return null;
  return `${furthest.label} would be outside. Expected at least ${Math.ceil(furthest.edge)} px, or move the hotspot first`;
}

/** Changes the canvas size, scale mode or background colour; a size that does not fit is refused. */
export function updateCanvas(project: Project, change: Partial<Canvas>): Project {
  const next = { ...project.canvas, ...change };
  if (
    checkCanvasSize(project, 'width', next.width) ||
    checkCanvasSize(project, 'height', next.height)
  )
    return project;
  if (JSON.stringify(next) === JSON.stringify(project.canvas)) return project;
  return { ...project, canvas: next };
}

/**
 * Sets how long a page with a web background stays before the idle return, 10 s to 1 h in whole
 * seconds (spec PG-10). Anything else changes nothing.
 */
export function setWebPageSeconds(project: Project, seconds: number): Project {
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 3600) return project;
  if (project.webPageSeconds === seconds) return project;
  return { ...project, webPageSeconds: seconds };
}

/**
 * Sets how every page change looks (spec PG-4). Fade, the default, is written as no field, so a
 * project that keeps it still opens in apps from before page transitions.
 */
export function setTransition(project: Project, transition: Transition): Project {
  if (pageTransition(project) === transition) return project;
  const { transition: _old, ...rest } = project;
  return transition === 'fade' ? rest : { ...rest, transition };
}
