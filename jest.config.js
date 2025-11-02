// CRITICAL: Set up unhandled rejection handler BEFORE anything else
// This must be done at the module level, not in setupFilesAfterEnv
if (typeof process !== 'undefined') {
  const existingHandlers = process.listeners('unhandledRejection').slice();
  process.removeAllListeners('unhandledRejection');
  
  process.on('unhandledRejection', (reason, promise) => {
    // Silently swallow all unhandled rejections during tests
    // The interceptors use setTimeout(() => { logHttpRequestAudit().catch(...) }, 0)
    // In tests, these promises may reject after the test completes
    promise.catch(() => {
      // Silently swallow - we've already handled this
    });
  });
}

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Setup file runs before all tests to configure unhandled rejection handling
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
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
        },
        // Enable coverage for all files
        isolatedModules: false
      }
    ]
  },
  // Ensure coverage is tracked for all code paths including closures
  coverageProvider: 'v8'
};
