// ESLint (flat config) : regles TypeScript + metriques de maintenabilite.
// - complexity : complexite cyclomatique max 10 par fonction (seuil usuel McCabe)
// - sonarjs/cognitive-complexity : complexite cognitive max 15 (seuil par defaut de Sonar)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'jest.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  prettier,
  {
    rules: {
      complexity: ['error', { max: 10 }],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', 5],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Les tests ont droit a des fonctions longues (blocs describe) et a quelques facilites.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-hardcoded-passwords': 'off',
    },
  },
);
