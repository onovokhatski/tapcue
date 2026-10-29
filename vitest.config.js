// One Vitest run for the whole repository: every package is a separate test project.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
    // Temporary: no package has tests yet. Removed with the first schema tests (#6).
    passWithNoTests: true,
  },
});
