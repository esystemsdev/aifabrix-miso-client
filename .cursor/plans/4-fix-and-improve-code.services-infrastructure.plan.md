# Fix and Improve Code - Services - Infrastructure

## Overview
This plan addresses code quality improvements for infrastructure services (`src/services/redis.service.ts` and `src/services/cache.service.ts`). These services handle Redis connectivity and generic caching.

## Modules Analyzed
- `src/services/redis.service.ts` (119 lines)
- `src/services/cache.service.ts` (196 lines)

## Key Issues Identified

### 1. Logging Issues (CRITICAL)
- **Direct Console Usage**: Both services use `console.log()`, `console.error()`, and `console.warn()` directly instead of LoggerService:
  - `redis.service.ts`: 
    - Line 20: `console.log("Redis not configured, using controller fallback")`
    - Line 38: `console.log("Connected to Redis")`
    - Line 41: `console.error("Failed to connect to Redis:", error)`
    - Line 52: `console.log("Disconnected from Redis")`
    - Line 65: `console.error("Redis get error:", error)`
    - Line 80: `console.error("Redis set error:", error)`
    - Line 95: `console.error("Redis delete error:", error)`
    - Line 110: `console.error("Redis rpush error:", error)`
  - `cache.service.ts`: 
    - Line 72: `console.warn("Failed to parse cached data for key ${key}:", error)`
    - Line 131: `console.error("Failed to cache value for key ${key}:", error)`
  - **Impact**: High - violates project rules, missing ISO 27001 compliant structured logging
  - **Total Violations**: 10 console calls across 2 files

- **Missing Structured Logging**: Errors lack correlation IDs, operation context, and structured metadata required for ISO 27001 compliance.

### 2. Error Handling
- **Good Pattern**: Both services return `null` or `false` on errors (following project rules).
- **Silent Failures**: Redis operations fail silently, which is correct for fallback pattern.

### 3. Code Organization
- **Good Structure**: Services follow proper patterns.
- **Redis Connection Check**: Properly checks `isConnected()` before operations.

### 4. Type Safety
- **Good**: Proper TypeScript types are used.
- **CacheEntry Interface**: Well-defined.

### 5. Method Size
- **Acceptable**: Most methods are within guidelines.
- **get() and set() Methods**: Slightly long but acceptable given complexity.

## Implementation Tasks

### Task 1: Replace Console Logging with LoggerService
**Priority**: Medium  
**File**: `src/services/redis.service.ts`, `src/services/cache.service.ts`

**Challenge**: Infrastructure services don't have LoggerService injected. Options:
- **Option A**: Inject LoggerService into constructors (requires refactoring)
- **Option B**: Create shared logger utility (recommended)
- **Option C**: Keep console logging but add structured context

**Recommendation**: Option B - Create `src/utils/service-logger.utils.ts`:
```typescript
/**
 * Service-level logger utility
 * Provides structured logging for services that don't have LoggerService injected
 */
class ServiceLogger {
  private static logger: LoggerService | null = null;

  static setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  static log(message: string, context?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger.info(message, context).catch(() => {});
    } else {
      console.log(`[SERVICE] ${message}`, context || '');
    }
  }

  static error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger.error(message, { ...context, error }).catch(() => {});
    } else {
      console.error(`[SERVICE ERROR] ${message}`, error, context || '');
    }
  }

  static warn(message: string, context?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger.info(message, { level: 'warn', ...context }).catch(() => {});
    } else {
      console.warn(`[SERVICE WARN] ${message}`, context || '');
    }
  }
}
```

**Update**: Replace all console calls in both services with ServiceLogger.

### Task 2: Add Correlation IDs to Error Logging
**Priority**: Low  
**File**: `src/services/redis.service.ts`, `src/services/cache.service.ts`

When logging errors, include correlation IDs and operation context:
```typescript
ServiceLogger.error('Redis get error', error, {
  operation: 'get',
  key,
  correlationId: generateCorrelationId(this.config?.clientId || 'unknown'),
});
```

### Task 3: Extract Cache Cleanup Logic
**Priority**: Low  
**File**: `src/services/cache.service.ts`

Consider extracting cleanup interval management to a separate utility if it grows in complexity.

### Task 4: Improve Error Messages
**Priority**: Low  
**File**: `src/services/redis.service.ts`, `src/services/cache.service.ts`

Make error messages more descriptive:
- Include operation name
- Include key/queue name
- Include connection status

### Task 5: Add JSDoc Comments
**Priority**: Low  
**File**: `src/services/redis.service.ts`, `src/services/cache.service.ts`

Enhance JSDoc comments:
- Add `@param` descriptions
- Add `@returns` descriptions
- Document fallback behavior
- Document TTL behavior

### Task 6: Add Connection Retry Logic
**Priority**: Low  
**File**: `src/services/redis.service.ts`

Consider adding automatic reconnection logic for Redis connection failures (with exponential backoff).

## Testing Requirements

1. **Unit Tests**:
   - Test connection/disconnection
   - Test get/set/delete operations
   - Test error handling
   - Test fallback behavior

2. **Integration Tests**:
   - Test with real Redis connection
   - Test connection failures
   - Test cache expiration
   - Test cleanup interval

3. **Edge Cases**:
   - Null/undefined values
   - Invalid keys
   - Connection timeouts
   - Memory cache fallback

## Priority Recommendations

1. **High Priority**: 
   - Task 1 (Replace Console Logging) - 10 violations, critical for ISO 27001 compliance
   - Task 2 (Add Correlation IDs) - Required for audit trail

2. **Medium Priority**: 
   - Tasks 3-4 (Code organization improvements) - Improves maintainability

3. **Low Priority**: 
   - Tasks 5-6 (Documentation and retry logic) - Nice-to-have improvements

## Notes

- Both services follow proper patterns (return null/false on error)
- Redis connection checks are properly implemented
- Fallback patterns are well-designed
- Cache cleanup interval is properly managed
- Consider adding metrics/monitoring hooks for production use

