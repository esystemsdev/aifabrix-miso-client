---
name: Add User Info Caching
overview: Add caching to the `getUserInfo()` method which calls `GET /api/v1/auth/user` endpoint, and add a new `userTTL` configuration option. This is the only auth-related API call not currently cached.
todos:
  - id: add-user-ttl-config
    content: Add `userTTL` option to cache configuration in config.types.ts
    status: completed
  - id: add-user-caching
    content: Add caching logic to `getUserInfo()` method in auth.service.ts
    status: completed
  - id: add-clear-user-cache
    content: Add `clearUserCache()` method and update `logout()` to clear user cache
    status: completed
  - id: add-tests
    content: Add unit tests for user info caching
    status: completed
isProject: false
---

# Add Caching for User Info API

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns - Service Layer](.cursor/rules/project-rules.mdc#service-layer)** - Services receive dependencies via constructor, use `httpClient.config` for configuration access
- **[Architecture Patterns - Redis Caching Pattern](.cursor/rules/project-rules.mdc#redis-caching-pattern)** - Check `redis.isConnected()` before operations, use `{type}:{userId}` cache key format, always fallback to controller
- **[Common Patterns - Service Method Pattern](.cursor/rules/project-rules.mdc#service-method-pattern)** - Extract userId from token, try cache first, fallback to controller, cache result
- **[Code Style - Error Handling](.cursor/rules/project-rules.mdc#error-handling)** - Return `null` on errors for methods returning objects/null, use try-catch for async
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Test cache hits/misses, mock CacheService, aim for 80%+ coverage
- **[Performance Guidelines](.cursor/rules/project-rules.mdc#performance-guidelines)** - Extract userId from JWT to avoid unnecessary validate API calls
- **[Documentation](.cursor/rules/project-rules.mdc#documentation)** - Use JSDoc comments for public methods

**Key Requirements**:

- Always check cache connection before Redis operations (use `CacheService.get/set` which handles this internally)
- Cache key format: `user:{userId}` (consistent with `roles:{userId}` and `permissions:{userId}`)
- Return `null` on errors (not empty array - this method returns `UserInfo | null`)
- Use existing `extractUserIdFromToken()` helper method
- Add JSDoc comments for new `clearUserCache()` method
- Test both cache hit and cache miss scenarios
- Test error handling (return null on failure)

---

## Before Development

- [ ] Read Architecture Patterns - Redis Caching Pattern section from project-rules.mdc
- [ ] Review existing caching implementation in `RoleService.getRoles()` for patterns
- [ ] Review existing `clearTokenCache()` method for cache clearing pattern
- [ ] Understand `CacheService` API (get, set, delete methods)
- [ ] Review existing `getUserInfo` tests in `auth.service.test.ts`

---

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **Code Quality**:

   - Files ≤500 lines, methods ≤20-30 lines
   - All public functions have JSDoc comments
   - Cache key follows pattern: `user:{userId}`
   - Redis connection check via CacheService (handles internally)
   - Return `null` on errors (not empty array)

6. **Tests**:

   - Cache hit scenario (returns cached user info)
   - Cache miss scenario (fetches from API, caches result)
   - Error handling (returns null on failure)
   - `clearUserCache()` method tests
   - Logout clears user cache test

7. **Security**: No sensitive data in cache keys (use userId, not token)
8. All tasks completed

---

## Current Caching Status

**Already cached (no changes needed):**

- Token validation (`POST /api/v1/auth/validate`) - smart TTL: 60s-900s based on token expiry
- Roles (`GET /api/v1/auth/roles`) - 900s (15 minutes)
- Permissions (`GET /api/v1/auth/permissions`) - 900s (15 minutes)

**NOT cached (needs implementation):**

- User info (`GET /api/v1/auth/user`) via `getUserInfo()` method

Note: `getUser()` method reuses the cached validate endpoint, so it already benefits from caching.

---

## Recommended TTL Values

| Data Type | TTL | Rationale |

|-----------|-----|-----------|

| Token validation | 60s-900s (smart) | Should expire before JWT does; current implementation is optimal |

| Roles | 900s (15 min) | Security-sensitive but doesn't change frequently during session |

| Permissions | 900s (15 min) | Same as roles |

| **User info** | **300-600s (5-10 min)** | User profile changes infrequently; 5 minutes is a good balance |

---

## Implementation Changes

### 1. Add `userTTL` to cache configuration

File: [`src/types/config.types.ts`](src/types/config.types.ts)

```typescript
cache?: {
  roleTTL?: number; // Default 15 minutes
  permissionTTL?: number; // Default 15 minutes
  tokenValidationTTL?: number; // Max TTL (default 900s)
  minValidationTTL?: number; // Min TTL (default 60s)
  userTTL?: number; // NEW: Default 300s (5 minutes)
}
```

### 2. Add caching to `getUserInfo()` method

File: [`src/services/auth.service.ts`](src/services/auth.service.ts)

Changes to `AuthService`:

- Add `private userTTL: number;` property (line ~32)
- Initialize in constructor: `this.userTTL = this.config.cache?.userTTL || 300;` (5 minutes default)
- Add cache interface: `interface UserInfoCacheData { user: UserInfo; timestamp: number; }`
- Modify `getUserInfo()` to follow the Service Method Pattern:

  1. Check API key bypass first (existing logic)
  2. Extract userId from token using existing `extractUserIdFromToken()` helper
  3. Build cache key: `user:{userId}` (only if userId exists)
  4. Check cache first using `this.cache.get<UserInfoCacheData>(cacheKey)`
  5. On cache hit: return `cached.user`
  6. On cache miss: fetch from controller via `this.apiClient.auth.getUser()`
  7. Cache result: `this.cache.set<UserInfoCacheData>(cacheKey, { user, timestamp: Date.now() }, this.userTTL)`
  8. Return `null` on errors (existing pattern)

**Note**: `CacheService` internally handles Redis connection checks and in-memory fallback, so no explicit `isConnected()` check needed.

### 3. Add `clearUserCache()` method

Add method to clear user info cache (similar to `clearTokenCache()`):

```typescript
clearUserCache(token: string): void {
  const userId = this.extractUserIdFromToken(token);
  if (userId) {
    void this.cache.delete(`user:${userId}`);
  }
}
```

### 4. Update logout to clear user cache

Modify `logout()` to also call `clearUserCache()` when clearing caches.

---

## Files to Modify

1. [`src/types/config.types.ts`](src/types/config.types.ts) - Add `userTTL` config option
2. [`src/services/auth.service.ts`](src/services/auth.service.ts) - Add caching to `getUserInfo()`, add `clearUserCache()`
3. [`tests/unit/auth.service.test.ts`](tests/unit/auth.service.test.ts) - Add tests for user info caching

---

## Cache Key Pattern

Following existing patterns:

- `token_validation:{sha256_hash}` - token validation
- `roles:{userId}` - user roles
- `permissions:{userId}` - user permissions
- `user:{userId}` - **NEW: user info**

---

## Plan Validation Report

**Date**: 2026-01-26

**Plan**: `.cursor/plans/47_add_user_info_caching_a7f1891c.plan.md`

**Status**: ✅ VALIDATED

### Plan Purpose

Add caching to `getUserInfo()` method in AuthService to reduce controller API calls. This completes auth-related caching coverage (token validation, roles, permissions, and now user info are all cached).

### Applicable Rules

- ✅ [Architecture Patterns - Service Layer](.cursor/rules/project-rules.mdc#service-layer) - Modifying AuthService
- ✅ [Architecture Patterns - Redis Caching Pattern](.cursor/rules/project-rules.mdc#redis-caching-pattern) - Adding caching with `user:{userId}` key format
- ✅ [Common Patterns - Service Method Pattern](.cursor/rules/project-rules.mdc#service-method-pattern) - Following cache-first pattern
- ✅ [Code Style - Error Handling](.cursor/rules/project-rules.mdc#error-handling) - Return null on errors
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) - Plan includes test additions
- ✅ [Performance Guidelines](.cursor/rules/project-rules.mdc#performance-guidelines) - Extracting userId from JWT to avoid extra API calls
- ✅ [Configuration](.cursor/rules/project-rules.mdc#configuration) - Adding `userTTL` config option

### Rule Compliance

- ✅ DoD Requirements: Documented (BUILD → LINT → TEST)
- ✅ Service Layer Pattern: Compliant (using CacheService, httpClient.config)
- ✅ Redis Caching Pattern: Compliant (cache key format, TTL configuration)
- ✅ Error Handling: Compliant (return null on errors)
- ✅ Testing Requirements: Documented (cache hit/miss, error handling tests)
- ✅ Security Guidelines: Compliant (userId in cache key, not token)

### Plan Updates Made

- ✅ Added Rules and Standards section with applicable rule references
- ✅ Added Before Development checklist
- ✅ Added Definition of Done section with validation order
- ✅ Enhanced implementation details with specific line numbers and patterns
- ✅ Added test requirements for cache scenarios

### Recommendations

- Follow existing `RoleService.getRoles()` implementation as reference for caching pattern
- Ensure `clearUserCache()` JSDoc matches `clearTokenCache()` documentation style
- Consider adding cache TTL comment in config.types.ts matching other TTL comments

---

## Implementation Validation

**Date**: 2026-01-26

**Status**: ✅ COMPLETE

### Executive Summary

All implementation tasks completed successfully. User info caching has been added to the `getUserInfo()` method with configurable TTL, cache clearing on logout, and comprehensive test coverage.

### File Existence Validation

- ✅ `src/types/config.types.ts` - `userTTL` config option added (line 88)
- ✅ `src/services/auth.service.ts` - `UserInfoCacheData` interface added (line 26)
- ✅ `src/services/auth.service.ts` - `userTTL` property added (line 38)
- ✅ `src/services/auth.service.ts` - `clearUserCache()` method added (line 417)
- ✅ `src/services/auth.service.ts` - `logout()` clears user cache (lines 449, 457)
- ✅ `tests/unit/auth.service.test.ts` - Caching tests added

### Test Coverage

- ✅ Unit tests exist for `getUserInfo` caching (5 tests)
  - Cache hit returns cached user info
  - Cache miss fetches from API and caches
  - Custom userTTL from config
  - No caching when userId cannot be extracted
  - Returns null on error
- ✅ Unit tests exist for `clearUserCache` (3 tests)
- ✅ Unit tests exist for logout cache clearing (2 tests)
- ✅ All 94 auth service tests pass

### Code Quality Validation

**STEP 1 - BUILD**: ✅ PASSED

**STEP 2 - LINT**: ✅ PASSED (0 errors, 0 warnings)

**STEP 3 - TEST**: ✅ PASSED (94 tests, 0.595s)

### Cursor Rules Compliance

- ✅ Service Layer Pattern: Uses CacheService, httpClient.config for configuration
- ✅ Redis Caching Pattern: Cache key `user:{userId}` follows existing pattern
- ✅ Error Handling: Returns `null` on errors (not empty array)
- ✅ Async Patterns: Uses async/await with try-catch
- ✅ Security: Uses userId in cache key (not token)
- ✅ Documentation: JSDoc comments on `clearUserCache()` method
- ✅ Public API Naming: camelCase for all methods

### Implementation Completeness

- ✅ Config type updated with `userTTL` option
- ✅ `getUserInfo()` caching implemented
- ✅ `clearUserCache()` method added
- ✅ `logout()` clears user cache
- ✅ Tests cover all scenarios

### Final Validation Checklist

- [x] All tasks completed
- [x] All files exist and implemented correctly
- [x] Tests exist and pass (94/94)
- [x] Code quality validation passes (BUILD → LINT → TEST)
- [x] Cursor rules compliance verified
- [x] Implementation complete

**Result**: ✅ **VALIDATION PASSED** - User info caching implementation is complete and all tests pass.