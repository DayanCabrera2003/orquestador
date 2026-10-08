import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ENTORNO = ['node:*', 'fs', 'path', 'os', 'child_process', 'electron', 'react', 'react-dom'];

/** Reglas de dependencia entre paquetes. Ver la arquitectura del proyecto. */
const limites = (prohibidos) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: prohibidos,
          message: 'Esta importación rompe las reglas de dependencia entre paquetes.',
        },
      ],
    },
  ],
});

export default defineConfig(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/release/**', '**/out/**'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.mjs', 'apps/*/*.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['*.mjs', 'apps/*/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/core/**'],
    rules: limites(['@orquestador/*', ...ENTORNO]),
  },
  {
    files: ['packages/protocol/**'],
    rules: limites(['@orquestador/server', '@orquestador/web', '@orquestador/desktop', ...ENTORNO]),
  },
  {
    files: ['packages/server/**'],
    rules: limites(['@orquestador/web', '@orquestador/desktop', 'electron', 'react', 'react-dom']),
  },
  {
    files: ['apps/web/**'],
    rules: limites(['@orquestador/server', '@orquestador/desktop', 'electron', 'node:*']),
  },
);
