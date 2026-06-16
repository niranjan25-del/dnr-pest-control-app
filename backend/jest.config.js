// jest.config.js
// Unit + integration config (test:cov runs this). E2E uses test/jest-e2e.json.
// Pure-logic unit specs need no DB; integration specs require a Prisma test database
// (DATABASE_URL pointing at a disposable schema) — see test/support/setup-integration.ts.

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '(test/(unit|integration)/.*|\\.(spec))\\.ts$',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/support/setup-unit.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts}',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/dto/**',
    '!src/**/interfaces/**',
    '!src/main.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: { branches: 70, functions: 80, lines: 80, statements: 80 },
  },
  // Keep external SDKs from loading real network clients during unit tests.
  clearMocks: true,
  restoreMocks: true,
};
