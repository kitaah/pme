// ESLint (flat config) front : TypeScript, hooks React, metriques de complexite (memes seuils que les services).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  prettier,
  {
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      complexity: ['error', { max: 10 }],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-params': ['warn', 5],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { files: ['**/*.test.tsx', '**/*.test.ts', 'vite.config.ts'], rules: { 'sonarjs/no-duplicate-string': 'off' } },
);
