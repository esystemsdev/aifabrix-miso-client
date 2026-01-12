# Unified Application Context Service

Create a centralized service to extract `application`, `applicationId`, and `environment` with consistent fallback logic across RoleService, PermissionService, and LoggerService.

## Architecture

The new `ApplicationContextService` will:

1. Extract from client token first (if available)
2. Fall back to parsing MISO_CLIENTID format: `miso-controller-{environment}-{application}`
3. Provide a consistent API for all services

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns - Service Layer](.cursor/rules/project-rules.mdc#service-layer)** - Service structure, dependency injection, configuration access via `httpClient.config`
- **[Architecture Patterns - Token Management](.cursor/rules/project-rules.mdc#token-management)** - Client token extraction, token handling patterns
- **[Architecture Patterns - JWT Token Handling](.cursor/rules/project-rules.mdc#jwt-token-handling)** - JWT decoding patterns, extracting fields from tokens
- **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - Strict mode, interfaces over types, public readonly config
- **[Code Style - Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions)** - camelCase for public APIs, PascalCase for classes
- **[Error Handling - Service Layer](.cursor/rules/project-rules.mdc#service-layer-error-handling)** - Return empty arrays on errors, use try-catch for async operations
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, mock external dependencies, 80%+ coverage
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-size-guidelines)** - File size ≤500 lines, methods ≤20-30 lines, JSDoc documentation
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Token handling, no hardcoded secrets, proper credential protection
- **[Performance Guidelines](.cursor/rules/project-rules.mdc#performance-guidelines)** - Cache results to avoid repeated parsing/extraction
- **[File Organization](.cursor/rules/project-rules.mdc#file-organization)** - Service structure, import order, export strategy

**Key Requirements**:

- Services receive `HttpClient` as dependency and use `httpClient.config` (public readonly property) for configuration access
- Always use try-catch for async operations, return empty string `""` or null on errors (don't throw)
- Use `jsonwebtoken.decode()` (not verify) for token extraction
- Handle null/undefined decoded tokens gracefully
- Cache results to avoid repeated parsing/extraction
- All public API outputs use camelCase (no snake_case)
- Add JSDoc comments for all public methods with parameter types and return types
- Keep files ≤500 lines and methods ≤20-30 lines
- Never expose `clientId` or `clientSecret` in client code
- Mock all external dependencies in tests (HttpClient, JWT decode)
- Test both success and error paths, edge cases (null tokens, invalid formats)

## Before Development

- [ ] Read Architecture Patterns - Service Layer section from project-rules.mdc
- [ ] Review existing services for patterns (RoleService, PermissionService, LoggerService)
- [ ] Review token extraction patterns (`extractClientTokenInfo`, `extractJwtContext`)
- [ ] Understand error handling patterns (return empty strings, try-catch for async)
- [ ] Review testing requirements and mock patterns
- [ ] Review JSDoc documentation patterns
- [ ] Review caching patterns (in-memory cache for parsed results)
- [ ] Review clientId format parsing requirements

## Implementation Steps

### 1. Create Application Context Service

**File**: `src/services/application-context.service.ts`

- Create `ApplicationContextService` class that accepts `HttpClient` and `MisoClientConfig`
- Implement `getApplicationContext()` method that returns:
  ```typescript
  {
    application: string;      // From clientId format: {app} part
    applicationId: string;   // From client token (if available), else ""
    environment: string;      // From clientId format: {env} part
  }
  ```

- Extract from client token using `extractClientTokenInfo()` (same pattern as RoleService)
- Parse clientId format: `miso-controller-{environment}-{application}`
  - Example: `miso-controller-miso-miso-test` → `environment: "miso"`, `application: "miso-test"`
  - Handle cases where format doesn't match (return null/empty)
- Cache results to avoid repeated parsing/extraction

### 2. Update RoleService

**File**: `src/services/role.service.ts`

- Replace `getEnvironmentFromClientToken()` with `ApplicationContextService`
- Use `applicationContextService.getApplicationContext().environment` for environment extraction
- Update all calls to use the new service

### 3. Update PermissionService

**File**: `src/services/permission.service.ts`

- Replace `getEnvironmentFromClientToken()` with `ApplicationContextService`
- Use `applicationContextService.getApplicationContext().environment` for environment extraction
- Update all calls to use the new service

### 4. Update LoggerService

**File**: `src/services/logger/logger.service.ts`

- Add `ApplicationContextService` instance in constructor
- Update `log()` method to use `applicationContextService.getApplicationContext()`:
  - Set `application` from context service
  - Set `environment` from context service
  - Keep `applicationId` extraction from options/user JWT (as it's different from application key)

### 5. Update UnifiedLoggerService

**File**: `src/services/logger/unified-logger.service.ts`

- Access `ApplicationContextService` through `LoggerService` (add getter method)
- Update `buildLoggingOptions()` to:
  - First try client token for `applicationId`
  - Then try user JWT token for `applicationId`
  - Use context service for `application` and `environment` (via LoggerService)

### 6. Update Logger Context Utilities

**File**: `src/services/logger/logger-context.ts`

- Update `getLogWithRequest()`, `getWithContext()`, and `getWithToken()` to accept and use `ApplicationContextService`
- Replace hardcoded `environment: "unknown"` and `application: config.clientId` with context service values

### 7. Update Browser Services (MANDATORY)

**Files**: `src/services/browser-role.service.ts`, `src/services/browser-permission.service.ts`

- Replace `getEnvironmentFromClientToken()` with `ApplicationContextService`
- Use `applicationContextService.getApplicationContext().environment` for environment extraction
- Update all calls to use the new service
- ApplicationContextService must support browser localStorage token extraction

## ClientId Format Parsing

Parse format: `miso-controller-{environment}-{application}`

- Split by `-` delimiter
- Expect pattern: `["miso", "controller", "{env}", "{app}"]`
- Extract `environment` from index 2
- Extract `application` from remaining parts (index 3+), joined with `-`
- Handle edge cases:
  - Invalid format → return null/empty
  - Missing parts → return null/empty
  - Non-standard clientId → return null/empty (don't throw errors)

## Testing

- Unit tests for `ApplicationContextService`:
  - Client token extraction (with/without token)
  - ClientId format parsing (valid/invalid formats)
  - Fallback logic
  - Edge cases (null tokens, invalid formats, missing parts)
  - Caching behavior
- Update existing tests for RoleService, PermissionService, LoggerService
- Test browser vs server-side scenarios
- Mock HttpClient, JWT decode, and token extraction utilities
- Aim for 80%+ branch coverage

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs TypeScript compilation)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, methods ≤20-30 lines
6. **JSDoc Documentation**: All public functions have JSDoc comments with parameter types and return types
7. **Code Quality**: All rule requirements met
8. **Security**: No hardcoded secrets, proper token handling, never expose clientId/clientSecret
9. **Error Handling**: Return empty strings `""` or null on errors, use try-catch for all async operations
10. **Token Handling**: Use `jsonwebtoken.decode()` (not verify), handle null/undefined tokens gracefully
11. **Caching**: Cache parsed results to avoid repeated extraction
12. **Naming**: All public API outputs use camelCase (no snake_case)
13. **Service Pattern**: Service uses `httpClient.config` (public readonly property) for configuration access
14. **Testing**: All tests pass, proper mocking of HttpClient and JWT decode, edge cases covered
15. **Documentation**: Update documentation as needed (README, API docs, guides, usage examples)
16. All tasks completed
17. ApplicationContextService follows all standards from Architecture Patterns section
18. All services updated to use ApplicationContextService consistently

## Files to Modify

1. `src/services/application-context.service.ts` (NEW)
2. `src/services/role.service.ts`
3. `src/services/permission.service.ts`
4. `src/services/logger/logger.service.ts`
5. `src/services/logger/unified-logger.service.ts`
6. `src/services/logger/logger-context.ts`
7. `src/services/browser-role.service.ts` (MANDATORY)
8. `src/services/browser-permission.service.ts` (MANDATORY)
9. `tests/unit/application-context.service.test.ts` (NEW)

---

## Plan Validation Report

**Date**: 2026-01-10

**Plan**: `.cursor/plans/43-unified_application_context_service.plan.md`

**Status**: ✅ VALIDATED

### Plan Purpose

Create a unified `ApplicationContextService` to extract `application`, `applicationId`, and `environment` with consistent fallback logic (client token → clientId parsing) across RoleService, PermissionService, and LoggerService. This refactoring centralizes token extraction and clientId parsing logic to ensure consistency and reduce code duplication.

**Scope**: Services (RoleService, PermissionService, LoggerService, UnifiedLoggerService, BrowserRoleService, BrowserPermissionService), token extraction utilities, clientId format parsing, logger context utilities, browser services (MANDATORY)

**Type**: Service Development + Refactoring

### Applicable Rules

- ✅ **[Architecture Patterns - Service Layer](.cursor/rules/project-rules.mdc#service-layer)** - Creating new service, dependency injection pattern, configuration access
- ✅ **[Architecture Patterns - Token Management](.cursor/rules/project-rules.mdc#token-management)** - Client token extraction, token handling patterns
- ✅ **[Architecture Patterns - JWT Token Handling](.cursor/rules/project-rules.mdc#jwt-token-handling)** - Extracting applicationId from user JWT tokens
- ✅ **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - New service implementation, interfaces over types
- ✅ **[Code Style - Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions)** - camelCase for public APIs, PascalCase for classes
- ✅ **[Error Handling - Service Layer](.cursor/rules/project-rules.mdc#service-layer-error-handling)** - Return empty strings on errors, try-catch for async
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, mocking, 80%+ coverage
- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-size-guidelines)** - File size limits, method size limits, JSDoc requirements
- ✅ **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Token handling, credential protection
- ✅ **[Performance Guidelines](.cursor/rules/project-rules.mdc#performance-guidelines)** - Caching parsed results

### Rule Compliance

- ✅ DoD Requirements: Documented with BUILD → LINT → TEST sequence
- ✅ Service Layer: Plan follows service pattern with HttpClient dependency
- ✅ Token Management: Plan addresses client token extraction correctly
- ✅ Error Handling: Plan mentions try-catch and error handling patterns
- ✅ Testing: Plan includes comprehensive test requirements
- ✅ Code Quality: Plan mentions file size limits and JSDoc requirements
- ✅ Security: Plan addresses token handling and credential protection
- ✅ Performance: Plan mentions caching results

### Plan Updates Made

- ✅ Added Rules and Standards section with all applicable rule references
- ✅ Added Before Development checklist with rule compliance items
- ✅ Updated Definition of Done section with complete DoD requirements
- ✅ Added rule references: Architecture Patterns (Service Layer, Token Management, JWT Handling), Code Style, Error Handling, Testing Conventions, Code Quality Standards, Security Guidelines, Performance Guidelines
- ✅ Added validation order: BUILD → LINT → TEST
- ✅ Added file size limits and JSDoc requirements
- ✅ Added security requirements (token handling, credential protection)
- ✅ Added error handling requirements (try-catch, return empty strings)
- ✅ Added testing requirements (80%+ coverage, mocking patterns)

### Recommendations

- ✅ Plan is production-ready and follows all applicable rules
- ✅ Consider adding browser-specific token extraction patterns if browser services need updates
- ✅ Ensure caching implementation uses in-memory cache with appropriate invalidation strategy
- ✅ Consider adding unit tests for edge cases (empty clientId, malformed clientId, token expiration scenarios)
- ✅ Review existing RoleService and PermissionService tests to ensure they properly mock ApplicationContextService