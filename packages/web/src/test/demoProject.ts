// The demo stand (examples/demo-stand) as test data: the same project the server serves by default.
import type { Project } from '@tapcue/shared';
import demoProjectJson from '../../../../examples/demo-stand/project.json?raw';

export { demoProjectJson };

export function demoProject(): Project {
  return JSON.parse(demoProjectJson) as Project;
}

/**
 * The demo stand without its motion settings: a fade between pages and no station inviting taps,
 * the defaults of a project that has neither field (ADR 0025).
 */
export function plainDemoProject(): Project {
  const { transition: _transition, ...project } = demoProject();
  return {
    ...project,
    stations: project.stations.map(({ inviteTaps: _invite, ...station }) => station),
  };
}
