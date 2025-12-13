# Fix and Improve Code - Services - Authorization

## Overview

This plan addresses code quality improvements for the Authorization services (`src/services/role.service.ts` and `src/services/permission.service.ts`). These services handle role and permission management with Redis caching.

## Modules Analyzed

- `src/services/role.service.ts` (207 lines)
- `src/services/permission.service.ts` (243 lines)

## Key Issues Identified

### 1. Code Duplication (CRITICAL)

- **JWT Token Extraction**: `extractUserIdFromToken()` method is **duplicated in 4 locations**:
        - `role.service.ts` (lines 35-48) - private method
        - `permission.service.ts` (lines 35-48) - private method
        - `data-client.ts` (lines 48-58) - standalone function
        - `http-client-metadata.ts` (lines 146-161) - exported function (accepts authHeader, not token)
        - **Impact**: Critical - violates DRY principle, makes maintenance difficult
        - **Solution**: Create shared utility `src/utils/jwt.utils.ts` with unified API

- **Cache Pattern**: Both services use identical cache checking and setting patterns. Could be abstracted but current implementation is acceptable.

### 2. Error Handling

- **Proper Pattern**: Both services correctly return empty arrays `[]` on error (following project rules).
- **Console Logging**: Both services use `console.error()` directly (lines 108, 202 in role.service.ts; lines 109, 208, 239 in permission.service.ts). Should use LoggerService for consistency.

### 3. Method Size

- **Acceptable**: Most methods are within the 20-30 line guideline.
- **getRoles/getPermissions**: These methods are ~50 lines each, slightly over guideline but acceptable given the complexity.

### 4. Type Safety

- **Good**: Proper TypeScript types and interfaces are used.
- **Cache Types**: `RoleCacheData` and `PermissionCacheData` interfaces are identical - could be generic.

### 5. Code Organization

- **Good Structure**: Services follow the proper constructor pattern with `httpClient.config` access.
- **Cache Key Format**: Uses proper format (`roles:{userId}`, `permissions:{userId}`).

## Implementation Tasks

### Task 1: Extract JWT Token Extraction Utility (CRITICAL)

**Priority**: High (affects 4 files)

**File**: `src/utils/jwt.utils.ts` (new file)

Create a shared utility for JWT token extraction that handles both token strings and Authorization headers:

```typescript
import jwt from "jsonwebtoken";

/**
 * Extract userId from JWT token without making API call
 * Tries multiple common JWT claim fields: sub, userId, user_id, id
 * @param tokenOrHeader - JWT token string or Authorization header (e.g., "Bearer <token>")
 * @returns User ID string or null if extraction fails
 */
export function extractUserIdFromToken(tokenOrHeader: string): string | null {
  try {
    // Handle Authorization header format: "Bearer <token>"
    let token = tokenOrHeader;
    if (tokenOrHeader.startsWith("Bearer ")) {
      token = tokenOrHeader.substring(7);
    }

    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    if (!decoded) return null;

    // Try common JWT claim fields for user ID
    return (decoded.sub ||
      decoded.userId ||
      decoded.user_id ||
      decoded.id) as string | null;
  } catch (error) {
    return null;
  }
}
```

**Update**:

- Remove `extractUserIdFromToken()` from `role.service.ts` (lines 35-48)
- Remove `extractUserIdFromToken()` from `permission.service.ts` (lines 35-48)
- Remove `extractUserIdFromToken()` from `data-client.ts` (lines 48-58)
- Update `http-client-metadata.ts` (lines 146-161) to use shared utility instead of its own implementation
- Import and use the shared utility in all 4 files

### Task 2: Replace Console Logging with LoggerService

**Priority**: Medium

**File**: `src/services/role.service.ts`, `src/services/permission.service.ts`

Replace all `console.error()` calls with LoggerService:

```typescript
// Instead of:
console.error("Failed to get roles:", error);

// Use:
// Note: Services don't have direct access to LoggerService
// Options:
// 1. Inject LoggerService into constructor
// 2. Use a shared logger instance
// 3. Create a service-level logger utility
```

**Challenge**: Services don't currently have LoggerService injected. Need to decide on approach:

- **Option A**: Inject LoggerService into constructor (requires refactoring)
- **Option B**: Create a shared logger utility that services can use
- **Option C**: Keep console.error but add eslint-disable comments (not ideal)

**Recommendation**: Option B - Create `src/utils/service-logger.utils.ts` that wraps LoggerService access.

### Task 3: Create Generic Cache Data Interface

**Priority**: Low

**File**: `src/types/cache.types.ts` (new file)

Create a generic cache data interface:

```typescript
export interface CacheData<T> {
  data: T;
  timestamp: number;
}

// Then use:
// RoleCacheData = CacheData<string[]>
// PermissionCacheData = CacheData<string[]>
```

**Update**: Replace `RoleCacheData` and `PermissionCacheData` interfaces with generic `CacheData<string[]>`.

### Task 4: Extract Cache Helper Methods

**Priority**: Low

**File**: `src/utils/cache-helpers.utils.ts` (new file)

Create helper methods for common cache operations:

```typescript
/**
 * Build cache key for user-specific data
 */
export function buildUserCacheKey(type: 'roles' | 'permissions', userId: string): string {
  return `${type}:${userId}`;
}

/**
 * Build cache entry with timestamp
 */
export function buildCacheEntry<T>(data: T): CacheData<T> {
  return {
    data,
    timestamp: Date.now(),
  };
}
```

### Task 5: Add JSDoc Comments

**Priority**: Low

**File**: `src/services/role.service.ts`, `src/services/permission.service.ts`

Enhance JSDoc comments:

- Add `@param` descriptions for all parameters
- Add `@returns` descriptions
- Add `@throws` tags if applicable
- Add examples for complex methods

### Task 6: Improve Error Context

**Priority**: Low

**File**: `src/services/role.service.ts`, `src/services/permission.service.ts`

When logging errors, include more context:

- User ID (if available)
- Operation name
- Cache key (if applicable)
- Auth strategy used

## Testing Requirements

1. **Unit Tests**: 

            - Test JWT extraction with various token formats
            - Test cache hit/miss scenarios
            - Test error handling paths
            - Test refresh methods

2. **Integration Tests**:

            - Test with real Redis connection
            - Test fallback to controller when Redis fails
            - Test cache TTL expiration

3. **Edge Cases**:

            - Null/undefined tokens
            - Invalid JWT tokens
            - Missing userId in token
            - Cache failures

## Priority Recommendations

1. **High Priority**: 

            - Task 1 (Extract JWT Utility) - Critical code duplication violation affecting 4 files
            - Task 2 (Replace Console Logging) - Consistency issue, affects 5 console.error calls

2. **Medium Priority**: 

            - Tasks 3-4 (Code organization improvements) - Improves maintainability

3. **Low Priority**: 

            - Tasks 5-6 (Documentation and error context) - Nice-to-have improvements

## Notes

- Code duplication in JWT extraction is the most critical issue - must be fixed
- Both services follow proper patterns (return empty arrays on error, use CacheService)
- Consider creating a base `AuthorizationService` class if more authorization services are added
- Cache key format follows project rules (`roles:{userId}`, `permissions:{userId}`)
- TTL defaults (900 seconds) follow project rules