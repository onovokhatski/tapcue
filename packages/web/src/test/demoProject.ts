// The demo stand (examples/demo-stand) as test data: the same project the server serves by default.
import type { Project } from '@tapcue/shared';
import demoProjectJson from '../../../../examples/demo-stand/project.json?raw';

export { demoProjectJson };

export function demoProject(): Project {
  return JSON.parse(demoProjectJson) as Project;
}
