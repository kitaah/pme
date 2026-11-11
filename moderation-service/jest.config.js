// Deux projets Jest : tests unitaires (src, fichiers .spec.ts) et e2e (test/integration, fichiers .integration-spec.ts, Docker requis).
const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: true }] },
};

module.exports = {
  // Couverture (tests unitaires) : rapport lcov lu par Sonar, seuils = garde-fou de la porte qualite
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/migrations/**',
    '!src/**/*.module.ts',
    '!src/**/*.spec.ts',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: { global: { statements: 100, branches: 100, functions: 100, lines: 100 } },
  projects: [
    { ...base, displayName: 'unit', rootDir: '.', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'integration',
      rootDir: '.',
      setupFilesAfterEnv: ['<rootDir>/test/support/jest-setup.ts'],
      testMatch: ['<rootDir>/test/integration/**/*.integration-spec.ts'],
    },
  ],
};
