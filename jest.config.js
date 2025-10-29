module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  // Collect coverage by default - shows summary in terminal
  collectCoverage: true,
  // Show coverage summary after tests
  coverageReporters: [
    'text-summary',   // Brief summary in terminal
    'text',           // Detailed per-file coverage
    'lcov',          // For CI/CD
    'html'           // HTML report in coverage/index.html
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true
        }
      }
    ]
  }
};
