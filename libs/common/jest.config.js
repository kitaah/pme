// Tests unitaires du module commun. Couverture : rapport lcov lu par Sonar, seuils = garde-fou de la porte qualite.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: true }] },
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts'],
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: { global: { statements: 100, branches: 100, functions: 100, lines: 100 } },
};
