import { type Project, validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import {
  addStation,
  changeStationId,
  checkStationId,
  deleteStation,
  updateStation,
} from './stations';

const expectValid = (project: Project) =>
  expect(validateProject(project)).toMatchObject({ ok: true });
const station = (project: Project, id: string) => project.stations.find((s) => s.id === id);

describe('station operations (spec ST-1)', () => {
  it('adds a station on the first page with a 60 s idle return, with a free id and name', () => {
    const before = demoProject();
    // Two stations, so "station-3" comes next — but that id is taken already.
    before.stations[1] = {
      id: 'station-3',
      name: 'Lobby',
      startPageId: 'p_home00',
      idleTimeoutSeconds: null,
    };
    const { project, stationId } = addStation(before);
    expect(stationId).toBe('station-4');
    expect(station(project, 'station-4')).toEqual({
      id: 'station-4',
      name: 'Station 4',
      startPageId: 'p_home00',
      idleTimeoutSeconds: 60,
    });
    expectValid(project);
  });

  it('changes the name, start page and idle timeout, also to "never"', () => {
    const project = updateStation(demoProject(), 'main', {
      name: 'Entrance',
      startPageId: 'p_about0',
      idleTimeoutSeconds: null,
    });
    expect(station(project, 'main')).toEqual({
      id: 'main',
      name: 'Entrance',
      startPageId: 'p_about0',
      idleTimeoutSeconds: null,
    });
    expectValid(project);
  });

  it('refuses a start page that is not there, and keeps the project when nothing changes', () => {
    const before = demoProject();
    expect(updateStation(before, 'main', { startPageId: 'p_zzzzzz' })).toBe(before);
    expect(updateStation(before, 'main', { name: 'Main catalog' })).toBe(before);
    expect(updateStation(before, 'kiosk', { name: 'X' })).toBe(before);
  });

  describe('ids', () => {
    it.each([
      ['entrance-2', null],
      ['main', null], // its own id
      ['small', 'Another station has this id'],
      ['test', '"test" is reserved for test sends from the editor'],
      ['Main', 'Expected 1–40 characters: lowercase letters, digits and "-"'],
      ['', 'Expected 1–40 characters: lowercase letters, digits and "-"'],
    ])('checks "%s"', (id, expected) => {
      expect(checkStationId(demoProject(), 'main', id)).toBe(expected);
    });

    it('changes the id, and refuses one that is not usable', () => {
      const project = changeStationId(demoProject(), 'main', 'entrance');
      expect(station(project, 'entrance')).toMatchObject({ name: 'Main catalog' });
      expect(station(project, 'main')).toBeUndefined();
      expectValid(project);
      const before = demoProject();
      expect(changeStationId(before, 'main', 'small')).toBe(before);
      expect(changeStationId(before, 'main', 'main')).toBe(before);
    });
  });

  it('deletes a station; a project may have none', () => {
    let project = deleteStation(demoProject(), 'main');
    expect(project.stations.map((s) => s.id)).toEqual(['small']);
    project = deleteStation(project, 'small');
    expect(project.stations).toEqual([]);
    expectValid(project);
    expect(deleteStation(project, 'small')).toBe(project);
  });
});
