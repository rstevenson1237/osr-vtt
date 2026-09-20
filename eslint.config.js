// Flat ESLint config shared by all workspace packages.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      // The local build's output (SPEC-041 §6, `pnpm build:local`).
      '**/dist-local/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.firebase/**',
      'apps/web/public/assets/**',
      'apps/web/.svelte-kit/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        extraFileExtensions: ['.svelte'],
      },
    },
  },
  {
    files: ['**/*.svelte', 'apps/web/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: [
      'packages/**/*.ts',
      '*.config.ts',
      '*.config.js',
      'scripts/**/*.mjs',
      // The WI-122 render-cost harness's driver — Node, like `scripts/`.
      'apps/web/bench/*.mjs',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // The local-release launcher's SEA entry (WI-147, SPEC-042 §2): plain
    // CommonJS Node, not part of the app bundle `apps/web/**/*.ts`'s browser
    // globals rule above covers.
    files: ['apps/web/scripts/launcher/*.cjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // The launcher's whole UX is these two lines printed to the terminal
      // window it runs in — not debug logging.
      'no-console': 'off',
    },
  },
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
