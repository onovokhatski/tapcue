// Page operations: pure functions (project, args) => project, never changing their input
// (spec PG-1, project format §10, architecture §4.2). An operation that cannot apply returns the
// same project, so the store saves nothing.
import type { Background, PageId, Project } from '@tapcue/shared';
import { newId } from './ids';

/** Adds an empty page at the end, named "Page N" with the first free N. Returns its id too. */
export function addPage(
  project: Project,
  random?: () => number,
): { project: Project; pageId: PageId } {
  const pageId = newId(
    'p',
    project.pages.map((page) => page.id),
    random,
  );
  const names = new Set(project.pages.map((page) => page.name));
  let n = project.pages.length + 1;
  while (names.has(`Page ${n}`)) n++;
  const page = { id: pageId, name: `Page ${n}`, background: null, hotspots: [] };
  return { project: { ...project, pages: [...project.pages, page] }, pageId };
}

/** A name of 1–100 characters after trimming; anything else leaves the page as it is. */
export function renamePage(project: Project, pageId: PageId, name: string): Project {
  const trimmed = name.trim();
  const page = project.pages.find((p) => p.id === pageId);
  if (!page || trimmed.length === 0 || trimmed.length > 100 || trimmed === page.name)
    return project;
  return {
    ...project,
    pages: project.pages.map((p) => (p.id === pageId ? { ...p, name: trimmed } : p)),
  };
}

/** Moves a page to a position in the list, clamped to the list. */
export function movePage(project: Project, pageId: PageId, toIndex: number): Project {
  const from = project.pages.findIndex((p) => p.id === pageId);
  const to = Math.max(0, Math.min(toIndex, project.pages.length - 1));
  if (from === -1 || from === to) return project;
  const pages = [...project.pages];
  const [page] = pages.splice(from, 1);
  pages.splice(to, 0, page!);
  return { ...project, pages };
}

/**
 * Deletes a page and every reference to it (project format §10): links to it are cleared, and a
 * station that started on it starts on the first remaining page. The last page cannot be deleted:
 * a project always has one.
 */
export function deletePage(project: Project, pageId: PageId): Project {
  const pages = project.pages.filter((p) => p.id !== pageId);
  const first = pages[0];
  if (!first || pages.length === project.pages.length) return project;
  return {
    ...project,
    pages: pages.map((page) =>
      page.hotspots.some((h) => h.action.goTo === pageId)
        ? {
            ...page,
            hotspots: page.hotspots.map((h) =>
              h.action.goTo === pageId ? { ...h, action: { ...h.action, goTo: null } } : h,
            ),
          }
        : page,
    ),
    stations: project.stations.map((station) =>
      station.startPageId === pageId ? { ...station, startPageId: first.id } : station,
    ),
  };
}

/** Sets or removes a page's background. Hotspots stay where they are (design: empty canvas). */
export function setBackground(
  project: Project,
  pageId: PageId,
  background: Background | null,
): Project {
  const page = project.pages.find((p) => p.id === pageId);
  if (!page) return project;
  const same =
    page.background?.asset === background?.asset && page.background?.type === background?.type;
  if (same) return project;
  return {
    ...project,
    pages: project.pages.map((p) => (p.id === pageId ? { ...p, background } : p)),
  };
}

/** What deleting a page would change, for the confirmation dialog. */
export function pageUsage(project: Project, pageId: PageId) {
  const links = project.pages.flatMap((page) =>
    page.hotspots.filter((h) => h.action.goTo === pageId && page.id !== pageId),
  );
  const stations = project.stations.filter((s) => s.startPageId === pageId);
  return { links, stations };
}
