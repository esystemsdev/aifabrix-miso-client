# Fix and Improve Code - Utils - HTTP Client

## Overview
This plan addresses code quality improvements for HTTP client utilities (`src/utils/http-client.ts` and `src/utils/internal-http-client.ts`). These utilities handle HTTP communication with the Miso Controller.

## Modules Analyzed
- `src/utils/http-client.ts` (277 lines)
- `src/utils/internal-http-client.ts` (583 lines - **EXCEEDS 500 LINE LIMIT**)

## Key Issues Identified

### 1. File Size Violation (CRITICAL)
- **internal-http-client.ts**: 583 lines exceeds the 500 line limit. Must be split into smaller files.

### 2. Code Duplication
- **Correlation ID Generation**: `generateCorrelationId()` is duplicated in 3 locations:
  - `internal-http-client.ts` (lines 178-183) - basic version
  - `auth.service.ts` (lines 39-44) - basic version
  - `logger.service.ts` (lines 77-84) - enhanced version with counter
  - **Impact**: High - violates DRY principle
  - **Solution**: Use shared utility from Task 1 of Services - Authentication plan

- **Error Response Parsing**: Complex error parsing logic (~50 lines) could be extracted to a utility for reuse across services.

### 3. Method Size
- **Large Methods**: Several methods exceed 20-30 line guideline:
  - `fetchClientToken()`: ~85 lines (internal-http-client.ts lines 188-273)
  - `parseErrorResponse()`: ~50 lines (internal-http-client.ts lines 297-349)
  - `createMisoClientError()`: ~30 lines (acceptable but could be smaller)

### 4. Code Organization
- **Good Structure**: Both clients follow proper patterns.
- **Client Token Management**: Properly implemented with expiration tracking.

### 5. Error Handling
- **Good**: Proper error conversion to MisoClientError.
- **Error Parsing**: Complex but necessary for structured error responses.

## Implementation Tasks

### Task 1: Split internal-http-client.ts (CRITICAL)
**Priority**: High  
**File**: Split into multiple files

**Proposed Structure**:
1. `src/utils/internal-http-client.ts` (main class, ~200 lines)
   - Constructor
   - Public methods (get, post, put, delete, request, authenticatedRequest, requestWithAuthStrategy)
   - getAxiosInstance()

2. `src/utils/client-token-manager.ts` (new file, ~150 lines)
   - Client token fetching logic
   - Token expiration tracking
   - Token refresh logic
   - getClientToken() method

3. `src/utils/error-parser.utils.ts` (new file, ~100 lines)
   - parseErrorResponse() method
   - createMisoClientError() method
   - Error response building utilities

4. `src/utils/axios-interceptors.utils.ts` (new file, ~100 lines)
   - Request interceptor setup
   - Response interceptor setup
   - Interceptor configuration

**Update**: Refactor InternalHttpClient to use these utilities.

### Task 2: Extract Correlation ID Generation Utility
**Priority**: Medium  
**File**: `src/utils/correlation-id.utils.ts` (use shared utility)

Replace `generateCorrelationId()` method (lines 178-183) with shared utility.

### Task 3: Refactor Large Methods
**Priority**: High  
**File**: `src/utils/client-token-manager.ts` (after split)

Break down `fetchClientToken()` into smaller methods:
- Extract `buildTokenRequest()` helper
- Extract `parseTokenResponse()` helper
- Extract `handleTokenError()` helper

### Task 4: Extract Error Parsing Logic
**Priority**: Medium  
**File**: `src/utils/error-parser.utils.ts` (after split)

Extract error parsing methods:
- `parseErrorResponse()` - already identified for extraction
- `createMisoClientError()` - already identified for extraction
- `isAxiosError()` - could be moved to error-parser.utils.ts

### Task 5: Improve Type Safety
**Priority**: Low  
**File**: `src/utils/internal-http-client.ts`, `src/utils/http-client.ts`

Add more specific type guards and type assertions where needed.

### Task 6: Add JSDoc Comments
**Priority**: Low  
**File**: All HTTP client files

Enhance JSDoc comments:
- Add `@param` descriptions
- Add `@returns` descriptions
- Add `@throws` tags
- Document authentication strategy behavior

### Task 7: Extract Interceptor Setup
**Priority**: Low  
**File**: `src/utils/axios-interceptors.utils.ts` (after split)

Extract interceptor setup logic to separate utility for better testability.

## Testing Requirements

1. **Unit Tests**:
   - Test client token fetching
   - Test token expiration
   - Test error parsing
   - Test interceptor behavior
   - Test authentication strategies

2. **Integration Tests**:
   - Test with real HTTP requests
   - Test token refresh on 401
   - Test error response handling
   - Test request/response interceptors

3. **Edge Cases**:
   - Token expiration
   - Network errors
   - Invalid responses
   - Concurrent token refresh

## Priority Recommendations

1. **High Priority**: Task 1 (Split internal-http-client.ts) - **CRITICAL FILE SIZE VIOLATION**
2. **High Priority**: Task 3 (Refactor Large Methods)
3. **Medium Priority**: Task 2 (Extract Correlation ID), Task 4 (Extract Error Parsing)
4. **Low Priority**: Tasks 5-7 (Code organization improvements)

## Notes

- File size violation must be addressed immediately
- Client token management is complex but well-implemented
- Error parsing logic is necessary for structured error responses
- Consider creating a base HTTP client class if more HTTP clients are added
- Authentication strategy handling is well-designed

