# Fix and Improve Code - Express - Middleware

## Overview
This plan addresses code quality improvements for Express middleware utilities (`src/express/error-handler.ts`, `src/express/async-handler.ts`, and related files). These utilities provide error handling and async route handler support for Express.js applications.

## Modules Analyzed
- `src/express/error-handler.ts` (196 lines)
- `src/express/async-handler.ts` (68 lines)
- `src/express/response-middleware.ts`
- `src/express/validation-helper.ts`
- Other Express utilities

## Key Issues Identified

### 1. Code Organization
- **Good Structure**: Middleware utilities are well-organized.
- **Error Handling Pattern**: Properly implements RFC 7807 error responses.

### 2. Method Size
- **Acceptable**: Methods are within guidelines.
- **handleRouteError()**: ~60 lines, slightly long but acceptable for error handling.

### Task 1: Extract Error Mapping Logic
**Priority**: Low  
**File**: `src/express/error-handler.ts`

Extract `mapErrorToStatusCode()` function (lines 36-94) to a separate utility file for better testability:
```typescript
// src/express/error-mapper.utils.ts
export function mapErrorToStatusCode(error: unknown): number {
  // Extract error mapping logic
}
```

### Task 2: Extract Error Message Extraction
**Priority**: Low  
**File**: `src/express/error-handler.ts`

Extract `extractErrorMessage()` function (lines 99-107) to error-mapper.utils.ts.

### Task 3: Add JSDoc Comments
**Priority**: Low  
**File**: All Express middleware files

Enhance JSDoc comments:
- Add `@param` descriptions
- Add `@returns` descriptions
- Add `@throws` tags
- Add Express.js usage examples

### Task 4: Improve Type Safety
**Priority**: Low  
**File**: `src/express/error-handler.ts`

Add more specific type guards for error types (Prisma errors, etc.).

### Task 5: Add Error Context
**Priority**: Low  
**File**: `src/express/error-handler.ts`

Enhance error logging with more context:
- Request method
- Request path
- User ID (if available)
- Request body (masked)

## Testing Requirements

1. **Unit Tests**:
   - Test error mapping
   - Test error message extraction
   - Test async handler wrapping
   - Test error response creation

2. **Integration Tests**:
   - Test with Express.js routes
   - Test error handling flow
   - Test correlation ID propagation

3. **Edge Cases**:
   - Unknown error types
   - Missing correlation IDs
   - Prisma errors
   - Network errors

## Priority Recommendations

1. **Low Priority**: All tasks are low priority - Express utilities are well-implemented

## Notes

- Express utilities follow proper Express.js patterns
- Error handling is RFC 7807 compliant
- Async handler pattern is well-implemented
- Consider adding more error types as needed
- Type augmentation is properly implemented

