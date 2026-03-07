---
name: Auth Error authMethod Support
overview: Parse and expose the authMethod field from controller 401 responses, with client-side fallback detection. Aligned with controller plan 125_auth_error_specificity.
todos:
  - id: add-authmethod-type
    content: Add AuthMethod type to src/types/errors.types.ts
    status: completed
  - id: update-errors-types
    content: Add authMethod field to ErrorResponse in src/types/errors.types.ts
    status: completed
  - id: update-config-types
    content: Add authMethod field to ErrorResponse in src/types/config.types.ts (import from errors.types)
    status: completed
  - id: update-miso-error
    content: Add authMethod property to MisoClientError class in src/utils/errors.ts
    status: completed
  - id: add-detect-helper
    content: Add detectAuthMethodFromHeaders() helper with JSDoc to src/utils/http-error-handler.ts
    status: completed
  - id: update-parse-error
    content: Update parseErrorResponse() to extract authMethod from response data
    status: completed
  - id: update-create-error
    content: Update createMisoClientError() to detect and pass authMethod for 401 errors
    status: completed
  - id: update-interceptor
    content: Update response interceptor in internal-http-client.ts for auth-specific error messages
    status: completed
  - id: update-format-token-error
    content: Update formatTokenFetchError() to return MisoClientError with authMethod and JSDoc
    status: completed
  - id: export-authmethod
    content: Export AuthMethod type from src/index.ts
    status: completed
  - id: add-unit-tests
    content: Add unit tests for detectAuthMethodFromHeaders, parseErrorResponse, createMisoClientError
    status: completed
  - id: run-validation
    content: Run BUILD -> LINT -> TEST validation sequence
    status: completed
isProject: false
---

# Authentication Error Differentiation (Aligned with Controller)

## Related Plan

This plan is aligned with the controller-side plan:

- **Controller**: `C:\git\esystemsdev\aifabrix-miso\.cursor\plans\125_auth_error_specificity_7c4e022e.plan.md`

The controller adds an `authMethod` field to 401 error responses. This SDK plan parses that field and provides client-side fallback detection.

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Error Handling](.cursor/rules/project-rules.mdc#error-handling)** - RFC 7807 Problem Details format, MisoClientError structure
- **[TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - Interfaces for public APIs, strict mode
- **[Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions)** - camelCase for all public API outputs
- **[HTTP Client Pattern](.cursor/rules/project-rules.mdc#http-client-pattern)** - Token management, interceptors
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest, mock patterns, 80%+ coverage
- **[Code Size Guidelines](.cursor/rules/project-rules.mdc#code-size-guidelines)** - Files under 500 lines, methods under 30 lines
- **[Documentation](.cursor/rules/project-rules.mdc#documentation)** - JSDoc comments for public methods

**Key Requirements:**

- All error responses follow RFC 7807 Problem Details format
- Use interfaces (not types) for public API definitions
- All public API outputs use camelCase (no snake_case)
- Add JSDoc comments for all new public functions
- Mock all external dependencies in tests
- Aim for 80%+ branch coverage

## Before Development

- [ ] Read Error Handling section from project-rules.mdc (RFC 7807, MisoClientError structure)
- [ ] Review existing `MisoClientError` implementation in `src/utils/errors.ts`
- [ ] Review `createMisoClientError()` in `src/utils/http-error-handler.ts`
- [ ] Review response interceptor in `src/utils/internal-http-client.ts`
- [ ] Review existing test patterns in `tests/unit/`
- [ ] Understand `authMethod` values from controller plan

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` AFTER lint (all tests must pass, 80%+ coverage for new code)
4. **Validation Order**: BUILD -> LINT -> TEST (mandatory sequence, never skip steps)
5. All tasks completed
6. All rule requirements met
7. `AuthMethod` type exported from `src/index.ts`
8. `authMethod` property accessible on `MisoClientError`
9. Fallback detection works when controller doesn't return `authMethod`
10. JSDoc comments on all new public functions
11. Unit tests cover all new code paths

## Problem Statement

Currently all 401 authentication errors return the same generic message: `"Authentication failed - token may be invalid"`. This makes it difficult to troubleshoot whether the failure was due to:

- Invalid/expired user token (Bearer)
- Invalid/expired client token (x-client-token)
- Invalid client credentials (x-client-id/x-client-secret)

## Solution

1. **Parse `authMethod` field** from controller 401 responses
2. **Provide fallback detection** when controller doesn't return `authMethod` (client-side header inspection)
3. **Format helpful error messages** based on auth method

## Auth Method Values (aligned with controller)

- `bearer` - OAuth2/Keycloak bearer token
- `api-key` - API key authentication
- `client-token` - x-client-token header
- `client-credentials` - x-client-id/x-client-secret headers

## Files to Modify

### 1. [src/types/errors.types.ts](src/types/errors.types.ts)

Add `AuthMethod` type and `authMethod` field to `ErrorResponse`:

```typescript
/** Authentication method that failed (from controller response) */
export type AuthMethod = 'bearer' | 'api-key' | 'client-token' | 'client-credentials' | null;

export interface ErrorResponse {
  errors: string[];
  type?: string;
  title?: string;
  statusCode: number;
  instance?: string;
  correlationId?: string;
  /** Authentication method that was attempted and failed (401 errors only) */
  authMethod?: AuthMethod;
}
```

### 2. [src/types/config.types.ts](src/types/config.types.ts)

Add `authMethod` to the `ErrorResponse` interface (duplicate definition exists):

```typescript
import { AuthMethod } from "./errors.types";

export interface ErrorResponse {
  errors: string[];
  type: string;
  title: string;
  statusCode: number;
  instance?: string;
  authMethod?: AuthMethod;
}
```

### 3. [src/utils/errors.ts](src/utils/errors.ts)

Update `MisoClientError` to include `authMethod` property:

```typescript
import { AuthMethod } from "../types/errors.types";

export class MisoClientError extends Error {
  public readonly errorResponse?: ErrorResponse;
  public readonly errorBody?: Record<string, unknown>;
  public readonly statusCode?: number;
  /** Authentication method that failed (for 401 errors) */
  public readonly authMethod?: AuthMethod;

  constructor(
    message: string,
    errorResponse?: ErrorResponse,
    errorBody?: Record<string, unknown>,
    statusCode?: number,
    authMethod?: AuthMethod,
  ) {
    // ... existing message logic ...
    super(finalMessage);
    this.name = "MisoClientError";
    this.errorResponse = errorResponse;
    this.errorBody = errorBody;
    this.statusCode = statusCode ?? errorResponse?.statusCode;
    this.authMethod = authMethod ?? errorResponse?.authMethod ?? null;
  }
}
```

### 4. [src/utils/http-error-handler.ts](src/utils/http-error-handler.ts)

Add fallback auth method detection and update functions:

```typescript
import { AuthMethod } from "../types/errors.types";

/**
 * Detect auth method from request headers (fallback when controller doesn't return authMethod)
 * @param headers - Request headers object
 * @returns The detected auth method or null if no auth headers found
 */
export function detectAuthMethodFromHeaders(headers?: Record<string, unknown>): AuthMethod {
  if (!headers) return null;
  if (headers["Authorization"]) return "bearer";
  if (headers["x-client-token"]) return "client-token";
  if (headers["x-client-id"]) return "client-credentials";
  return null;
}
```

**Update `parseErrorResponse()`** to extract `authMethod`:

```typescript
export function parseErrorResponse(
  error: AxiosError,
  requestUrl?: string,
): ErrorResponse | null {
  // ... existing parsing logic ...
  
  if (typeof data === "object" && data !== null && isErrorResponse(data)) {
    return {
      errors: (data as ErrorResponse).errors,
      type: (data as ErrorResponse).type,
      title: (data as ErrorResponse).title,
      statusCode: (data as ErrorResponse).statusCode,
      instance: (data as ErrorResponse).instance || requestUrl,
      authMethod: (data as Record<string, unknown>).authMethod as AuthMethod,
    };
  }
  // ... rest of function
}
```

**Update `createMisoClientError()`**:

```typescript
export function createMisoClientError(
  error: AxiosError,
  requestUrl?: string,
): MisoClientError {
  const statusCode = error.response?.status;
  const errorResponse = parseErrorResponse(error, requestUrl);
  
  // For 401 errors, detect auth method if not in response
  let authMethod: AuthMethod = null;
  if (statusCode === 401) {
    authMethod = errorResponse?.authMethod ?? 
                 detectAuthMethodFromHeaders(error.config?.headers as Record<string, unknown>);
  }
  
  let errorBody: Record<string, unknown> | undefined;
  if (error.response?.data && typeof error.response.data === "object") {
    errorBody = error.response.data as Record<string, unknown>;
  }

  let message = error.message || "Request failed";
  if (error.response) {
    message = error.response.statusText || `Request failed with status code ${statusCode}`;
  }

  return new MisoClientError(message, errorResponse || undefined, errorBody, statusCode, authMethod);
}
```

### 5. [src/utils/internal-http-client.ts](src/utils/internal-http-client.ts)

**Response interceptor (lines 83-94)**: Enhance error messages:

```typescript
this.axios.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const requestHeaders = error.config?.headers;
      const hasUserToken = !!requestHeaders?.["Authorization"];
      const hasClientToken = !!requestHeaders?.["x-client-token"];
      
      if (hasUserToken) {
        error.message = "Bearer token authentication failed - token may be invalid or expired";
      } else if (hasClientToken) {
        error.message = "Client token authentication failed - x-client-token may be invalid or expired";
      }
      this.clientToken = null;
      this.tokenExpiresAt = null;
    }
    return Promise.reject(error);
  },
);
```

**Update `formatTokenFetchError()` (lines 259-265)**: Return `MisoClientError`:

```typescript
import { MisoClientError } from "./errors";
import { ErrorResponse } from "../types/config.types";

/**
 * Format error for client token fetch failure
 * @param error - The original error
 * @param correlationId - Request correlation ID
 * @param clientId - Client ID used in the request
 * @returns MisoClientError with structured error response
 */
private formatTokenFetchError(error: unknown, correlationId: string, clientId: string): MisoClientError {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const statusCode = isAxiosError(error) ? error.response?.status : undefined;
  
  const errorResponse: ErrorResponse = {
    errors: [`Client credential authentication failed: ${errorMessage}`],
    type: "/Errors/Unauthorized",
    title: "Unauthorized",
    statusCode: statusCode || 401,
    instance: "/api/v1/auth/token",
    authMethod: "client-credentials",
  };
  
  return new MisoClientError(
    `Failed to authenticate with client credentials (clientId: ${clientId}) [correlationId: ${correlationId}]`,
    errorResponse,
    undefined,
    statusCode || 401,
    "client-credentials"
  );
}
```

**Update `fetchClientToken()` signature** to throw `MisoClientError` instead of `Error`.

### 6. [src/index.ts](src/index.ts)

Export the `AuthMethod` type:

```typescript
export type { AuthMethod } from "./types/errors.types";
```

## Testing

Add tests to `tests/unit/http-error-handler.test.ts`:

- `detectAuthMethodFromHeaders()` returns `"bearer"` when Authorization header present
- `detectAuthMethodFromHeaders()` returns `"client-token"` when x-client-token header present
- `detectAuthMethodFromHeaders()` returns `"client-credentials"` when x-client-id header present
- `detectAuthMethodFromHeaders()` returns `null` when no auth headers present
- `parseErrorResponse()` extracts `authMethod` from response data
- `createMisoClientError()` sets `authMethod` from response when available
- `createMisoClientError()` uses fallback detection when response has no `authMethod`

Add tests to `tests/unit/internal-http-client.test.ts`:

- `formatTokenFetchError()` returns `MisoClientError` with `authMethod: "client-credentials"`

## Usage Example

```typescript
try {
  await client.validateToken(token);
} catch (error) {
  if (error instanceof MisoClientError && error.statusCode === 401) {
    switch (error.authMethod) {
      case 'bearer':
        console.log('User token expired - run: aifabrix login');
        break;
      case 'client-token':
        console.log('Client token invalid - SDK will auto-refresh');
        break;
      case 'client-credentials':
        console.log('Client credentials invalid - check clientId/clientSecret config');
        break;
      default:
        console.log('Authentication failed - provide valid credentials');
    }
  }
}
```

## Backward Compatibility

- All changes are additive - existing error handling continues to work
- `authMethod` is optional - existing code checking `statusCode === 401` still works
- Error messages are enhanced but format remains RFC 7807 compliant
- SDK works with both old controller (fallback detection) and new controller (parsed authMethod)

---

## Plan Validation Report

**Date**: 2026-01-26

**Plan**: `.cursor/plans/auth_error_authmethod_support_f86956c5.plan.md`

**Status**: VALIDATED

### Plan Purpose

SDK enhancement to parse and expose the `authMethod` field from controller 401 error responses, with client-side fallback detection when controller doesn't return the field.

**Scope**: Type definitions, utilities, error handling, HTTP client, public exports

**Type**: Infrastructure/Error Handling enhancement

### Applicable Rules

- [Error Handling](.cursor/rules/project-rules.mdc#error-handling) - RFC 7807 format, MisoClientError structure
- [TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions) - Interfaces, strict mode
- [Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions) - camelCase for public APIs
- [HTTP Client Pattern](.cursor/rules/project-rules.mdc#http-client-pattern) - Interceptors, token management
- [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) - Jest, mocks, coverage
- [Code Size Guidelines](.cursor/rules/project-rules.mdc#code-size-guidelines) - File/method limits
- [Documentation](.cursor/rules/project-rules.mdc#documentation) - JSDoc comments

### Rule Compliance

- DoD Requirements: Documented (BUILD -> LINT -> TEST)
- RFC 7807 Format: Compliant (uses existing MisoClientError structure)
- camelCase Convention: Compliant (`authMethod`, `errorResponse`)
- Testing Requirements: Documented with specific test cases
- JSDoc Documentation: Required in plan

### Plan Updates Made

- Added Rules and Standards section with applicable rule references
- Added Before Development checklist
- Added Definition of Done section with validation order
- Added JSDoc comment requirements to code examples
- Added Plan Validation Report

### Recommendations

1. Ensure `AuthMethod` type is re-exported through barrel exports correctly
2. Update `docs/reference-errors.md` to document new `authMethod` property
3. Consider adding integration test for end-to-end error flow

---

## Implementation Validation

**Date**: 2026-01-27

**Status**: ✅ COMPLETE

### Executive Summary

All implementation tasks have been completed successfully. The `authMethod` field is now parsed from controller 401 responses and exposed on `MisoClientError`. Client-side fallback detection works when the controller doesn't return `authMethod`. All tests pass with 1845 total tests across 65 test suites.

### File Existence Validation

- ✅ `src/types/errors.types.ts` - Contains `AuthErrorMethod` type and `authMethod` field in `ErrorResponse`
- ✅ `src/types/config.types.ts` - Contains `authMethod` field in `ErrorResponse` interface
- ✅ `src/utils/errors.ts` - `MisoClientError` has `authMethod` property with JSDoc
- ✅ `src/utils/http-error-handler.ts` - Contains `detectAuthMethodFromHeaders()` with JSDoc, updated `parseErrorResponse()` and `createMisoClientError()`
- ✅ `src/utils/internal-http-client.ts` - Updated response interceptor with auth-specific messages, `formatTokenFetchError()` returns `MisoClientError`
- ✅ `src/index.ts` - Exports `AuthErrorMethod` and `detectAuthMethodFromHeaders`
- ✅ `tests/unit/http-error-handler.test.ts` - 20 tests for new functionality

### Test Coverage

- ✅ Unit tests exist for `detectAuthMethodFromHeaders()`
- ✅ Unit tests exist for `parseErrorResponse()` with `authMethod`
- ✅ Unit tests exist for `createMisoClientError()` with `authMethod`
- ✅ Unit tests exist for `isAxiosError()`
- ✅ All existing tests continue to pass

### Code Quality Validation

**STEP 1 - BUILD**: ✅ PASSED

- `npm run build` completed successfully
- TypeScript compilation with zero errors

**STEP 2 - LINT**: ✅ PASSED

- ESLint passed with zero errors and zero warnings

**STEP 3 - TEST**: ✅ PASSED

- Test Suites: 65 passed, 65 total
- Tests: 1845 passed, 1845 total
- Time: 3.852s

### Cursor Rules Compliance

- ✅ Error handling: RFC 7807 format compliant
- ✅ Type safety: TypeScript interfaces used for public APIs
- ✅ Async patterns: Proper async/await usage
- ✅ HTTP client patterns: Proper interceptor and error handling
- ✅ Token management: Proper header detection
- ✅ Public API naming: camelCase (`authMethod`, `detectAuthMethodFromHeaders`)
- ✅ JSDoc documentation: All new public functions documented
- ⚠️ Code size: `internal-http-client.ts` exceeds 500 lines (541 lines) - pre-existing condition

### Implementation Completeness

- ✅ `AuthErrorMethod` type added to `errors.types.ts`
- ✅ `authMethod` field added to `ErrorResponse` interfaces
- ✅ `MisoClientError` has `authMethod` property
- ✅ `detectAuthMethodFromHeaders()` helper implemented with JSDoc
- ✅ `parseErrorResponse()` extracts `authMethod` from response
- ✅ `createMisoClientError()` detects and passes `authMethod` for 401 errors
- ✅ Response interceptor provides auth-specific error messages
- ✅ `formatTokenFetchError()` returns `MisoClientError` with `authMethod: "client-credentials"`
- ✅ `AuthErrorMethod` exported from `src/index.ts`
- ✅ `detectAuthMethodFromHeaders` exported from `src/index.ts`

### Final Validation Checklist

- [x] All tasks completed
- [x] All files exist and are implemented
- [x] Tests exist and pass (1845/1845)
- [x] Build passes
- [x] Lint passes (zero warnings/errors)
- [x] Cursor rules compliance verified
- [x] JSDoc comments on all new public functions
- [x] Backward compatibility maintained

**Result**: ✅ **VALIDATION PASSED** - Implementation is complete and all quality checks pass.