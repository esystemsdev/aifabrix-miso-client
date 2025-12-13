# Fix and Improve Code - Services - Authentication

## Overview

This plan addresses code quality improvements for the Authentication service (`src/services/auth.service.ts`). The AuthService handles user authentication, token validation, login/logout flows, and user information retrieval.

## Modules Analyzed

- `src/services/auth.service.ts` (461 lines)

## Key Issues Identified

### 1. Code Duplication

- **Correlation ID Generation**: `generateCorrelationId()` method is duplicated in 3 locations:
                                - `auth.service.ts` (lines 39-44) - basic version
                                - `internal-http-client.ts` (lines 178-183) - basic version
                                - `logger.service.ts` (lines 77-84) - enhanced version with counter
                                - **Impact**: High - violates DRY principle, makes maintenance difficult
                                - **Solution**: Create shared utility `src/utils/correlation-id.utils.ts` with optional counter support

- **Error Handling Pattern**: Complex error handling logic is duplicated across multiple methods (`getEnvironmentToken`, `login`, `logout`). Each method has 30-50 lines of error handling code that follows the same pattern:
                                - Check for MisoClientError
                                - Check for AxiosError
                                - Build error details array
                                - Format error message with correlationId and clientId
                                - **Impact**: High - code duplication, difficult to maintain
                                - **Solution**: Extract to shared error handling utility

### 2. Error Handling Violations

- **Service Pattern Violation**: `getEnvironmentToken()`, `login()`, and `logout()` throw errors instead of returning null/empty values. According to project rules, service methods should return empty arrays `[]` or `null` on error, not throw.
- **Exception**: `getEnvironmentToken()` may legitimately throw since it's a critical infrastructure method, but error messages should be more descriptive.

### 3. Logging Issues

- **Direct Console Usage**: Uses `console.warn()` directly instead of LoggerService:
                                - Line 361: `console.warn()` for 400 Bad Request in logout
                                - Line 400: `console.warn()` for 400 Bad Request in logout (AxiosError path)
                                - **Impact**: Medium - inconsistent logging, missing structured context
                                - **Solution**: Inject LoggerService or use shared logger utility

- **Missing Error Context**: Error messages include correlationId and clientId, but could benefit from structured logging via LoggerService for better traceability and ISO 27001 compliance.

### 4. Method Size

- **Large Methods**: `getEnvironmentToken()` (84 lines), `login()` (88 lines), and `logout()` (112 lines) exceed the 20-30 line guideline. Should be broken down into smaller helper methods.

### 5. Type Safety

- **Missing Return Type Annotations**: All methods have proper return types, but some error handling could use better type guards.

### 6. Code Organization

- **Error Response Building**: Complex error response building logic is duplicated. Should extract to helper methods.

## Implementation Tasks

### Task 1: Extract Correlation ID Generation Utility

**Priority**: High (affects 3 files)

**File**: `src/utils/correlation-id.utils.ts` (new file)

Create a shared utility for correlation ID generation with support for optional counter:

```typescript
/**
 * Correlation ID utility for request tracking
 * Used across AuthService, InternalHttpClient, and LoggerService
 */
export function generateCorrelationId(
  clientId: string,
  options?: { useCounter?: boolean; counter?: number }
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const clientPrefix = clientId.substring(0, 10);
  
  if (options?.useCounter && options.counter !== undefined) {
    return `${clientPrefix}-${timestamp}-${options.counter}-${random}`;
  }
  
  return `${clientPrefix}-${timestamp}-${random}`;
}
```

**Update**:

- Replace `generateCorrelationId()` in `auth.service.ts` (lines 39-44)
- Replace `generateCorrelationId()` in `internal-http-client.ts` (lines 178-183)
- Replace `generateCorrelationId()` in `logger.service.ts` (lines 77-84) - use counter option

### Task 2: Extract Error Response Builder Utility

**Priority**: High (reduces ~150 lines of duplicated code)

**File**: `src/utils/error-response-builder.utils.ts` (new file)

Create a utility to build detailed error responses from AxiosError, MisoClientError, or generic Error:

```typescript
import { AxiosError } from "axios";
import { MisoClientError } from "./errors";

/**
 * Build detailed error response for logging and error messages
 * Handles AxiosError, MisoClientError, and generic Error types
 */
export function buildErrorResponse(
  error: unknown,
  operation: string,
  correlationId: string,
  clientId: string,
): {
  message: string;
  details: string[];
  correlationId: string;
  clientId: string;
} {
  const details: string[] = [];
  let message = "Unknown error";

  // Handle MisoClientError
  if (error instanceof MisoClientError) {
    message = `${operation} failed: ${error.message}`;
    if (error.statusCode) details.push(`status: ${error.statusCode}`);
    if (error.errorResponse) {
      details.push(`data: ${JSON.stringify(error.errorResponse)}`);
    }
    if (error.errorBody) {
      details.push(`errorBody: ${JSON.stringify(error.errorBody)}`);
    }
    return { message, details, correlationId, clientId };
  }

  // Handle AxiosError
  if (error && typeof error === "object" && "isAxiosError" in error) {
    const axiosError = error as AxiosError;
    message = `${operation} failed: ${axiosError.message}`;
    
    if (axiosError.response) {
      details.push(`status: ${axiosError.response.status}`);
      details.push(`statusText: ${axiosError.response.statusText}`);
      details.push(`data: ${JSON.stringify(axiosError.response.data)}`);
      if (axiosError.response.headers) {
        details.push(`headers: ${JSON.stringify(axiosError.response.headers)}`);
      }
    } else if (axiosError.request) {
      details.push(`request: ${JSON.stringify(axiosError.request)}`);
      details.push(`message: ${axiosError.message}`);
    } else {
      details.push(`message: ${axiosError.message}`);
    }
    
    return { message, details, correlationId, clientId };
  }

  // Handle generic Error
  if (error instanceof Error) {
    message = `${operation} failed: ${error.message}`;
    details.push(`message: ${error.message}`);
  } else {
    message = `${operation} failed: ${String(error)}`;
    details.push(`error: ${String(error)}`);
  }

  return { message, details, correlationId, clientId };
}

/**
 * Format error message with full details
 */
export function formatErrorMessage(
  error: unknown,
  operation: string,
  correlationId: string,
  clientId: string,
): string {
  const response = buildErrorResponse(error, operation, correlationId, clientId);
  return `${response.message}. Full response: {${response.details.join(", ")}} [correlationId: ${correlationId}, clientId: ${clientId}]`;
}
```

**Update**:

- Replace error handling in `getEnvironmentToken()` (lines 89-132)
- Replace error handling in `login()` (lines 177-234)
- Replace error handling in `logout()` (lines 349-446)

### Task 3: Refactor Large Methods

**Priority**: High

**File**: `src/services/auth.service.ts`

Break down large methods into smaller helper methods:

- Extract `handleAxiosError()` helper
- Extract `buildErrorDetails()` helper
- Extract `validateResponseFormat()` helper

### Task 4: Replace Console Logging with LoggerService

**Priority**: Medium

**File**: `src/services/auth.service.ts`

Replace `console.warn()` calls (lines 361, 400) with LoggerService calls:

```typescript
// Instead of:
console.warn(`Logout: No active session...`);

// Use:
await this.logger.warn(`Logout: No active session...`, {
  correlationId,
  clientId,
  statusCode: 400,
});
```

**Note**: AuthService needs access to LoggerService. Consider dependency injection or using a shared logger instance.

### Task 5: Improve Error Handling Consistency

**Priority**: High

**File**: `src/services/auth.service.ts`

Review error handling patterns:

- `getEnvironmentToken()`: Keep throwing (critical infrastructure method)
- `login()`: Consider returning null/error response instead of throwing
- `logout()`: Already handles 400 gracefully, but other errors throw

**Decision Needed**: Should `login()` return `{ success: false, error: string }` instead of throwing?

### Task 6: Add JSDoc Comments

**Priority**: Low

**File**: `src/services/auth.service.ts`

Enhance JSDoc comments with:

- `@throws` tags for methods that throw errors
- `@param` descriptions for all parameters
- `@returns` descriptions for return values
- Examples for complex methods

### Task 7: Extract API Key Token Check

**Priority**: Low

**File**: `src/services/auth.service.ts`

The `isApiKeyToken()` method is fine, but consider moving to a shared utility if other services need it.

## Testing Requirements

1. **Unit Tests**: Ensure all error paths are tested
2. **Integration Tests**: Test error handling with real HTTP errors
3. **Edge Cases**: Test with null/undefined tokens, invalid responses, network errors

## Priority Recommendations

1. **High Priority**: 

                                                - Task 1 (Extract Correlation ID Utility) - affects 3 files, high impact
                                                - Task 2 (Extract Error Response Builder) - reduces ~150 lines of duplication
                                                - Task 3 (Refactor Large Methods) - improves maintainability
                                                - Task 5 (Improve Error Handling) - aligns with project patterns

2. **Medium Priority**: 

                                                - Task 4 (Replace Console Logging) - improves consistency and ISO 27001 compliance

3. **Low Priority**: 

                                                - Task 6 (JSDoc) - documentation improvement
                                                - Task 7 (Extract API Key Check) - future optimization

## Notes

- AuthService is a critical service - changes must be backward compatible
- Error handling patterns should align with project rules (services return empty arrays/null on error)
- Consider adding a shared error handling utility module for all services
- LoggerService dependency injection may require refactoring constructor pattern