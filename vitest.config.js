// One Vitest run for the whole repository: every package is a separate test project.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
