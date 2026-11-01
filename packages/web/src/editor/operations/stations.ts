// Station operations: pure functions (project, args) => project (spec ST-1, project format §8).
// An operation that cannot apply returns the same project.
import { type Project, type Station, StationId } from '@tapcue/shared';

/** Adds a station that starts on the first page and returns there after 60 s. Returns its id too. */
export function addStation(project: Project): { project: Project; stationId: string } {
  const ids = new Set(project.stations.map((s) => s.id));
  const names = new Set(project.stations.map((s) => s.name));
  let n = project.stations.length + 1;
  while (ids.has(`station-${n}`) || names.has(`Station ${n}`)) n++;
  const station: Station = {
    id: `station-${n}`,
    name: `Station ${n}`,
    startPageId: project.pages[0]!.id,
    idleTimeoutSeconds: 60,
  };
  return {
    project: { ...project, stations: [...project.stations, station] },
    stationId: station.id,
  };
}

/** Changes a station's name, start page or idle timeout. */
export function updateStation(
  project: Project,
  stationId: string,
  change: Partial<Pick<Station, 'name' | 'startPageId' | 'idleTimeoutSeconds'>>,
): Project {
  const station = project.stations.find((s) => s.id === stationId);
  if (!station) return project;
  if (change.startPageId !== undefined && !project.pages.some((p) => p.id === change.startPageId))
    return project;
  const next = { ...station, ...change };
  if (JSON.stringify(next) === JSON.stringify(station)) return project;
  return { ...project, stations: project.stations.map((s) => (s.id === stationId ? next : s)) };
}

/** Why an id cannot be used for this station, or null (a slug, not "test", unique). */
export function checkStationId(project: Project, stationId: string, id: string): string | null {
  const result = StationId.safeParse(id);
  if (!result.success) return result.error.issues[0]?.message ?? 'Not a valid id';
  if (id !== stationId && project.stations.some((s) => s.id === id))
    return 'Another station has this id';
  return null;
}

/** Changes a station's id, which is part of its URL; refused when the id is not usable. */
export function changeStationId(project: Project, stationId: string, id: string): Project {
  if (id === stationId || checkStationId(project, stationId, id)) return project;
  return {
    ...project,
    stations: project.stations.map((s) => (s.id === stationId ? { ...s, id } : s)),
  };
}

/** Deletes a station; nothing else refers to stations. */
export function deleteStation(project: Project, stationId: string): Project {
  if (!project.stations.some((s) => s.id === stationId)) return project;
  return { ...project, stations: project.stations.filter((s) => s.id !== stationId) };
}
