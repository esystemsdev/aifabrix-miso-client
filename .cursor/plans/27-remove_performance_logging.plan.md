---
name: Remove Performance Logging
overview: Remove all performance logging functionality from the codebase since it's been replaced with OpenTelemetry. This includes removing the PerformanceMetrics interface, performance tracking methods, withPerformance() chain methods, related tests, and any performance metrics logic in the logging code.
todos:
  - id: remove-performance-code
    content: Remove PerformanceMetrics interface, performanceMetrics property, startPerformanceTracking(), endPerformanceTracking(), and withPerformance() methods from logger.service.ts
    status: pending
  - id: remove-performance-logic
    content: Remove performance metrics logic from the log() method in logger.service.ts
    status: pending
  - id: remove-performance-tests
    content: Remove all performance tracking tests from logger.service.test.ts
    status: pending
---

