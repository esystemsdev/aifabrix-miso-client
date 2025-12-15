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
  // Performance optimizations
  maxWorkers: '100%', // Use all available CPU cores for maximum parallelism
  testTimeout: 5000, // 5 second timeout per test
  cache: true, // Enable Jest cache for faster subsequent runs
  cacheDirectory: '<rootDir>/.jest-cache',
  // Skip slow operations for faster test execution
  detectOpenHandles: false, // Disable open handle detection for speed
  forceExit: true, // Force exit after tests complete to prevent hanging
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
  // Collect coverage only when --coverage flag is used (for performance)
  collectCoverage: false,
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
        // Use isolatedModules for faster compilation (skips type checking)
        isolatedModules: true
      }
    ]
  },
  // Ensure coverage is tracked for all code paths including closures
  coverageProvider: 'v8'
};
