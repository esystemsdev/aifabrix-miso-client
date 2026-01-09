# Validate and Clean Auth & Logs API Calls Against OpenAPI Specs

## Overview

Validate all controller API calls against:

- `/workspace/aifabrix-miso/packages/miso-controller/openapi/auth.openapi.yaml` (24 auth endpoints)
- `/workspace/aifabrix-miso/packages/miso-controller/openapi/logs.openapi.yaml` (15 logs endpoints)

Remove duplicate code, fix code issues, create comprehensive real integration tests, and clean up unnecessary code and tests.

## Analysis Summary

### Auth Endpoints in OpenAPI Spec (24 total)

1. `GET /api/v1/auth/user` - Get user info
2. `GET /api/v1/auth/login` - Initiate login flow
3. `POST /api/v1/auth/login` - Device code flow
4. `POST /api/v1/auth/login/device/token` - Poll device code token
5. `POST /api/v1/auth/login/device/refresh` - Refresh device code token
6. `GET /api/v1/auth/login/diagnostics` - Login diagnostics
7. `POST /api/v1/auth/token` - Generate x-client-token (legacy, x-client-id/x-client-secret)
8. `GET /api/v1/auth/client-token` - Generate x-client-token (frontend, origin validation)
9. `POST /api/v1/auth/client-token` - Generate x-client-token (frontend, primary method)
10. `GET /api/ide/auth/client-token` - IDE client token (GET)
11. `POST /api/ide/auth/client-token` - IDE client token (POST)
12. `POST /api/v1/auth/validate` - Validate token
13. `POST /api/v1/auth/logout` - Logout
14. `GET /api/v1/auth/callback` - OAuth2 callback
15. `POST /api/v1/auth/refresh` - Refresh user token
16. `GET /api/v1/auth/roles` - Get roles
17. `GET /api/v1/auth/roles/refresh` - Refresh roles
18. `GET /api/v1/auth/permissions` - Get permissions
19. `GET /api/v1/auth/permissions/refresh` - Refresh permissions
20. `GET /api/v1/auth/cache/stats` - Cache stats
21. `GET /api/v1/auth/cache/performance` - Cache performance
22. `GET /api/v1/auth/cache/efficiency` - Cache efficiency
23. `POST /api/v1/auth/cache/clear` - Clear cache
24. `POST /api/v1/auth/cache/invalidate` - Invalidate cache

### Logs Endpoints in OpenAPI Spec (15 total)

1. `POST /api/v1/logs` - Create log entry (unified endpoint for error/general/audit)
2. `POST /api/v1/logs/batch` - Create multiple log entries in batch (1-100 logs)
3. `GET /api/v1/logs/general` - List general logs (paginated, with filtering)
4. `GET /api/v1/logs/general/{id}` - Get general log by ID (501 Not Implemented)
5. `GET /api/v1/logs/audit` - List audit logs (paginated, with filtering)
6. `GET /api/v1/logs/audit/{id}` - Get audit log by ID (501 Not Implemented)
7. `GET /api/v1/logs/jobs` - List job logs (paginated, with filtering)
8. `GET /api/v1/logs/jobs/{id}` - Get job log by ID
9. `GET /api/v1/logs/stats/summary` - Get log statistics summary
10. `GET /api/v1/logs/stats/errors` - Get error statistics
11. `GET /api/v1/logs/stats/users` - Get user activity statistics
12. `GET /api/v1/logs/stats/applications` - Get application statistics
13. `GET /api/v1/logs/export` - Export logs (CSV or JSON format)

### Current Implementation Status

**✅ All endpoints are implemented correctly:**

- Endpoints match OpenAPI spec paths and HTTP methods
- Request/response structures align with spec
- Authentication strategies are properly handled

**❌ Issues Found:**

1. **Duplicate code**: `AuthApi` has `getRoles()`, `refreshRoles()`, `getPermissions()`, `refreshPermissions()` methods that duplicate `RolesApi` and `PermissionsApi` functionality
2. **Duplicate throw statements**: Multiple files have `throw error;` statements appearing twice:

   - `src/api/auth.api.ts` - Line 285
   - `src/api/roles.api.ts` - Lines 102-103
   - `src/api/permissions.api.ts` - Lines 101-102
   - `src/api/logs-create.api.ts` - Lines 69, 114
   - `src/api/logs-list.api.ts` - Multiple duplicate throws

3. **Code size violation**: `src/services/logger.service.ts` is 866 lines, exceeding the 500-line limit per project rules
4. **IDE endpoints not implemented**: `/api/ide/auth/client-token` endpoints are in spec but not implemented (may be intentional if not needed)
5. **Missing real integration tests**: No comprehensive integration tests that call real controller endpoints with actual credentials
6. **Logs endpoint validation**: Need to validate all logs endpoints against logs OpenAPI spec

## Implementation Plan

### Task 1: Validate Auth Endpoint Compliance

**Files to check:**

- `src/api/auth.api.ts` - Main auth API
- `src/api/auth-login.api.ts` - Login endpoints
- `src/api/auth-token.api.ts` - Token endpoints
- `src/api/auth-user.api.ts` - User endpoints
- `src/api/auth-cache.api.ts` - Cache endpoints
- `src/api/roles.api.ts` - Roles endpoints
- `src/api/permissions.api.ts` - Permissions endpoints
- `src/utils/internal-http-client.ts` - Client token fetching

**Validation checklist:**

- [ ] All endpoint paths match OpenAPI spec exactly
- [ ] HTTP methods match spec (GET/POST)
- [ ] Request body structures match spec (for POST endpoints)
- [ ] Query parameters match spec (for GET endpoints)
- [ ] Response types match spec structure
- [ ] Authentication headers match spec (x-client-token, Authorization: Bearer, etc.)

### Task 1b: Validate Logs Endpoint Compliance

**Files to check:**

- `src/api/logs.api.ts` - Main logs API
- `src/api/logs-create.api.ts` - Log creation endpoints
- `src/api/logs-list.api.ts` - Log listing endpoints
- `src/api/logs-stats.api.ts` - Log statistics endpoints
- `src/api/logs-export.api.ts` - Log export endpoints
- `src/services/logger.service.ts` - Logger service (verify audit log structure)

**Validation checklist:**

- [ ] All endpoint paths match OpenAPI spec exactly
- [ ] HTTP methods match spec (GET/POST)
- [ ] Request body structures match spec (audit logs require entityType, entityId, action in data object)
- [ ] Query parameters match spec (pagination, filtering, etc.)
- [ ] Response types match spec structure (paginated responses, stats responses)
- [ ] Audit log structure matches spec (entityType, entityId, action required in data object)
- [ ] Batch logs endpoint accepts 1-100 logs

### Task 2: Remove Duplicate Code from AuthApi

**File:** `src/api/auth.api.ts`

**Action:** Remove duplicate roles/permissions methods (lines 185-319)

**Reason:**

- Services use `apiClient.roles.getRoles()` and `apiClient.permissions.getPermissions()` (verified via grep)
- `MisoClient` uses separate `roles` and `permissions` services, not `auth` methods
- Duplicate code violates DRY principle and creates maintenance burden

**Changes:**

- Remove `getRoles()` method (lines 186-219)
- Remove `refreshRoles()` method (lines 221-251)
- Remove `getPermissions()` method (lines 253-287)
- Remove `refreshPermissions()` method (lines 289-319)
- Remove endpoint constants `ROLES_ENDPOINT`, `ROLES_REFRESH_ENDPOINT`, `PERMISSIONS_ENDPOINT`, `PERMISSIONS_REFRESH_ENDPOINT` (lines 55-58)
- Remove unused imports: `GetRolesQueryParams`, `GetRolesResponse`, `RefreshRolesResponse`, `GetPermissionsQueryParams`, `GetPermissionsResponse`, `RefreshPermissionsResponse` from `auth.types`

### Task 3: Fix Duplicate Throw Statements

**Files with duplicate throws:**

- `src/api/auth.api.ts` - Line 285 (duplicate `throw error;`)
- `src/api/roles.api.ts` - Lines 102-103 (duplicate `throw error;`)
- `src/api/permissions.api.ts` - Lines 101-102 (duplicate `throw error;`)
- `src/api/logs-create.api.ts` - Lines 69, 114 (duplicate `throw error;`)
- `src/api/logs-list.api.ts` - Multiple duplicate throws (check all methods)

**Action:** Remove duplicate `throw error;` statements (keep only one per catch block)

### Task 4: Verify Client Token Endpoint Usage

**File:** `src/utils/internal-http-client.ts`

**Check:** Line 222 uses `POST /api/v1/auth/token` which matches OpenAPI spec for legacy endpoint

**Verify:**

- Client token fetching uses correct endpoint (`/api/v1/auth/token` for legacy with x-client-id/x-client-secret)
- Frontend client token uses `/api/v1/auth/client-token` (POST method, primary)
- Both endpoints are correctly implemented

### Task 5: Clean Up Tests

**Files to check:**

- `tests/unit/auth.service.test.ts` - Verify no tests reference removed `auth.getRoles()` methods
- Any other test files that might test duplicate methods

**Action:**

- Remove tests for `auth.getRoles()`, `auth.refreshRoles()`, `auth.getPermissions()`, `auth.refreshPermissions()` if they exist
- Ensure all tests use `roles.getRoles()` and `permissions.getPermissions()` instead

### Task 6: Create Comprehensive Real Integration Tests

**New file:** `tests/integration/api-endpoints.integration.test.ts`

**Purpose:** Test all auth and logs endpoints against real controller using credentials from `.env`

**Environment variables required (from `.env`):**

- Lines 19-21: `MISO_CLIENTID`, `MISO_CLIENTSECRET`, `MISO_CONTROLLER_URL`
- Lines 37-38: User token for authenticated requests (e.g., `TEST_USER_TOKEN` or similar)

**Test structure:**

- Use Jest test framework
- Load config from `.env` using `loadConfig()` or `dotenv`
- Initialize `MisoClient` with real credentials
- Test all 24 auth endpoints + 15 logs endpoints
- Use client token for unauthenticated endpoints
- Use user token (Bearer) for authenticated endpoints
- Verify response structures match OpenAPI spec
- Test error cases (invalid tokens, missing params, etc.)

**Test groups:**

1. **Auth Endpoints (24 tests)**

   - Client token endpoints (legacy and frontend)
   - User endpoints (getUser, validate, logout, callback)
   - Login endpoints (OAuth flow, device code flow, diagnostics)
   - Token endpoints (validate, refresh)
   - Roles endpoints (getRoles, refreshRoles)
   - Permissions endpoints (getPermissions, refreshPermissions)
   - Cache endpoints (stats, performance, efficiency, clear, invalidate)

2. **Logs Endpoints (15 tests)**

   - Create log (error, general, audit with required fields)
   - Batch logs (1-100 logs)
   - List logs (general, audit, jobs with pagination)
   - Get log by ID (general, audit - expect 501, jobs)
   - Stats endpoints (summary, errors, users, applications)
   - Export logs (CSV and JSON formats)

**Implementation notes:**

- Skip tests if controller is not available (graceful failure)
- Use descriptive test names matching endpoint paths
- Verify response status codes match OpenAPI spec
- Verify response structure matches OpenAPI schema
- Test audit log creation with required fields (entityType, entityId, action)
- Test pagination parameters (page, pageSize, sort, filter)
- Test error responses (400, 401, 403, 404, 500)

### Task 7: Add npm Script for Integration Tests

**File:** `package.json`

**Action:** Add script to run integration tests:

```json
"test:integration:api": "node --unhandled-rejections=warn -r dotenv/config node_modules/jest/bin/jest.js tests/integration/api-endpoints.integration.test.ts --maxWorkers=1"
```

**Note:** Use `dotenv/config` to load `.env` file, `--maxWorkers=1` to avoid parallel test conflicts

### Task 8: Fix Code Size Violation in LoggerService

**File:** `src/services/logger.service.ts`

**Issue:** File is 866 lines, exceeding the 500-line limit per project code size guidelines.

**Action:** Split `LoggerService` into smaller modules following the API layer pattern:

**Proposed structure:**

- `src/services/logger/logger.service.ts` - Core LoggerService class (main logging methods)
- `src/services/logger/logger-chain.ts` - LoggerChain class (method chaining support)
- `src/services/logger/logger-context.ts` - Context extraction utilities (JWT, metadata, request)
- `src/services/logger/logger-helpers.ts` - Helper functions (correlation ID generation, etc.)

**Refactoring approach:**

1. Extract `LoggerChain` class to separate file (`logger-chain.ts`)
2. Extract context extraction methods to `logger-context.ts`:

   - `extractJWTContext()` → `extractJwtContext()`
   - `extractMetadata()` → `extractEnvironmentMetadata()`
   - `getLogWithRequest()` → Move to context utilities
   - `getWithContext()` → Move to context utilities
   - `getWithToken()` → Move to context utilities
   - `getForRequest()` → Move to context utilities

3. Extract helper methods to `logger-helpers.ts`:

   - `generateCorrelationId()` → Keep public, but move implementation details

4. Keep core logging methods in main `logger.service.ts`:

   - `error()`, `info()`, `debug()`, `audit()`
   - `log()` (private core method)
   - `setApiClient()`, `setMasking()`
   - `forRequest()` (delegates to LoggerChain)

**Benefits:**

- Reduces main file size to under 500 lines
- Improves maintainability and testability
- Follows same pattern as API layer (split into sub-modules)
- Keeps public API unchanged (backward compatible)

**Files to create:**

- `src/services/logger/logger-chain.ts` - LoggerChain class
- `src/services/logger/logger-context.ts` - Context extraction utilities
- `src/services/logger/logger-helpers.ts` - Helper functions (if needed)
- `src/services/logger/index.ts` - Barrel export (export LoggerService, LoggerChain)

**Files to modify:**

- `src/services/logger.service.ts` - Refactor to use extracted modules, reduce to <500 lines
- `src/index.ts` - Update imports if needed (should remain backward compatible)

**Verification:**

- [ ] Main `logger.service.ts` file is under 500 lines
- [ ] All tests pass (no breaking changes)
- [ ] Public API remains unchanged (backward compatible)
- [ ] Code follows project conventions

### Task 9: Update Documentation/Comments

**Files:**

- `src/api/auth.api.ts` - Update class JSDoc to remove mention of roles/permissions
- Verify no documentation references removed methods
- Add JSDoc comments to integration test file explaining test structure
- Update logger service documentation if structure changes

## Validation Checklist

After implementation, verify:

- [ ] All 24 auth OpenAPI endpoints are correctly implemented
- [ ] All 15 logs OpenAPI endpoints are correctly implemented
- [ ] No duplicate code exists (roles/permissions only in separate API classes)
- [ ] No duplicate throw statements
- [ ] Audit logs include required fields (entityType, entityId, action) in data object
- [ ] Logger service file size is under 500 lines (code size compliance)
- [ ] Integration tests cover all endpoints with real controller
- [ ] Integration tests use credentials from `.env` file
- [ ] npm script `test:integration:api` runs successfully
- [ ] All tests pass (unit + integration)
- [ ] No broken imports or references
- [ ] Code follows project conventions (camelCase, error handling, file size limits, etc.)

## Files to Modify

1. `src/api/auth.api.ts` - Remove duplicate methods and imports, fix duplicate throw
2. `src/api/roles.api.ts` - Fix duplicate throw
3. `src/api/permissions.api.ts` - Fix duplicate throw
4. `src/api/logs-create.api.ts` - Fix duplicate throws (lines 69, 114)
5. `src/api/logs-list.api.ts` - Fix all duplicate throws
6. `src/services/logger.service.ts` - **REFACTOR** - Split into smaller modules (<500 lines)
7. `src/services/logger/logger-chain.ts` - **NEW FILE** - LoggerChain class
8. `src/services/logger/logger-context.ts` - **NEW FILE** - Context extraction utilities
9. `src/services/logger/index.ts` - **NEW FILE** - Barrel export
10. `tests/integration/api-endpoints.integration.test.ts` - **NEW FILE** - Comprehensive integration tests
11. `package.json` - Add `test:integration:api` script
12. Test files (if any reference removed methods)

## Notes

- IDE endpoints (`/api/ide/auth/client-token`) are not implemented - this is acceptable if not needed for SDK usage
- Client token endpoint `/api/v1/auth/token` is correctly used for legacy server-side authentication
- Client token endpoint `/api/v1/auth/client-token` is correctly used for frontend origin validation
- All endpoint paths use `/api/v1/auth/*` or `/api/v1/logs/*` prefix as required by OpenAPI specs
- Audit logs require `entityType`, `entityId`, and `action` in the `data` object (not in `context`) per logs OpenAPI spec
- Logger service was already fixed to include required audit log fields - verify implementation matches spec
- Logger service violates code size rules (866 lines > 500 limit) - must be refactored into smaller modules
- Integration tests should gracefully skip if controller is unavailable (don't fail CI/CD)
- Use `dotenv` package to load `.env` file in integration tests (already in dependencies)
- Logger service refactoring should maintain backward compatibility (no breaking changes to public API)