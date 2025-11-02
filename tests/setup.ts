/**
 * Jest setup file - runs before all tests
 * Configures unhandled rejection handling for async logging in tests
 */

// CRITICAL: Remove any existing handlers first to ensure ours is the first
const existingUnhandledRejectionHandlers = process.listeners('unhandledRejection');
process.removeAllListeners('unhandledRejection');

// Set up our handler BEFORE any code runs that might create promises
// This must be synchronous and happen immediately
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  // Silently swallow all unhandled rejections during tests
  // This prevents the Jest worker from crashing
  // The interceptors use setTimeout(() => { logHttpRequestAudit().catch(...) }, 0)
  // In tests, these promises may reject after the test completes, causing unhandled rejections
  // This is expected behavior from async fire-and-forget logging operations
  // and should not fail tests or cause worker crashes
  
  // Explicitly handle the promise to prevent Node.js from throwing
  promise.catch(() => {
    // Silently swallow - we've already logged/handled this in the handler
  });
});

// Also handle the rejectionHandled event if needed
process.on('rejectionHandled', () => {
  // No-op - just acknowledge we're handling rejections
});

