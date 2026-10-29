// ESLint flat config. Formatting is Prettier's job, so only rules that catch bugs live here.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/node_modules/', 'packages/*/dist/', 'coverage/', 'docs/']),
  js.configs.recommended,
  // Type-aware rules (e.g. no-floating-promises) need type information from each package's tsconfig.
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // `const { field: _, ...rest } = obj` is the idiomatic way to copy an object without a field.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  // Rules of hooks (call order, effect dependencies) for the React app.
  {
    files: ['packages/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
  },
  {
    // Root config files and example scripts are not part of any package tsconfig, so they get
    // untyped rules only.
    files: ['*.js', 'examples/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
