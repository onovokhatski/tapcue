// ESLint flat config. Formatting is Prettier's job, so only rules that catch bugs live here.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
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
  {
    // Config files at the root are not part of any package tsconfig, so they get untyped rules only.
    files: ['*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
