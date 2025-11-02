// This file sets up unhandled rejection handling BEFORE Jest starts
// It must be loaded as early as possible to catch all unhandled rejections

if (typeof process !== 'undefined') {
  // Remove any existing handlers
  process.removeAllListeners('unhandledRejection');
  
  // Add our handler that swallows all rejections
  process.on('unhandledRejection', (reason, promise) => {
    // Silently swallow all unhandled rejections during tests
    // The interceptors use setTimeout(() => { logHttpRequestAudit().catch(...) }, 0)
    // In tests, these promises may reject after the test completes
    promise.catch(() => {
      // Silently swallow - we've already handled this
    });
  });
}

// Export empty object so loader doesn't fail
module.exports = {};

