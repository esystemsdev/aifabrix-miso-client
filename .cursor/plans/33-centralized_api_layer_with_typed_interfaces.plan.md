# Centralized API Layer with Typed Interfaces

## Overview

Create a centralized API layer in `src/api/` that provides typed interfaces for all controller API calls. The layer wraps `HttpClient` internally and organizes APIs by domain (auth, roles, permissions, logs). This is an internal improvement - services can gradually migrate to use the new API layer.

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns - HTTP Client Pattern](.cursor/rules/project-rules.mdc#http-client-pattern)** - ApiClient wraps HttpClient, uses authenticatedRequest() and request() methods correctly
- **[Architecture Patterns - API Endpoints](.cursor/rules/project-rules.mdc#api-endpoints)** - All endpoints use `/api` prefix, centralized endpoint management
- **[Architecture Patterns - Token Management](.cursor/rules/project-rules.mdc#token-management)** - Proper handling of client tokens and user tokens via HttpClient
- **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - Use interfaces for public APIs, strict mode, private methods for internal logic
- **[Code Style - Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions)** - camelCase for all public API outputs (types, interfaces, return values), PascalCase for classes
- **[Code Style - Error Handling](.cursor/rules/project-rules.mdc#error-handling)** - Use try-catch for async operations, handle errors gracefully
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits, documentation requirements, JSDoc for public methods (MANDATORY)
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, mock HttpClient, 80%+ coverage (MANDATORY)
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Never expose clientId/clientSecret, proper token handling (MANDATORY)
- **[File Organization](.cursor/rules/project-rules.mdc#file-organization)** - New src/api/ structure, proper import order, export strategy
- **[Code Size Guidelines](.cursor/rules/project-rules.mdc#code-size-guidelines)** - Files ≤500 lines, methods ≤20-30 lines
- **[Documentation](.cursor/rules/project-rules.mdc#documentation)** - JSDoc comments for all public methods with parameter types and return types

**Key Requirements:**

- ApiClient wraps HttpClient internally (dependency injection pattern)
- All API functions use HttpClient's authenticatedRequest() or request() methods
- All endpoint URLs centralized as constants in each API class
- All public API types/interfaces use camelCase (no snake_case)
- Use interfaces (not types) for public API definitions
- Add JSDoc comments for all public API methods
- Keep each API class file under 500 lines
- Keep methods under 20-30 lines
- Use try-catch for all async operations
- Mock HttpClient in tests: `const mockHttpClient = { authenticatedRequest: jest.fn(), request: jest.fn() } as any;`
- Never expose clientId or clientSecret (HttpClient handles this internally)
- All return types use camelCase properties (statusCode, not status_code)

## Structure

```javascript
src/api/
  ├── index.ts                    # Main API client class
  ├── types/
  │   ├── auth.types.ts          # Auth API request/response types
  │   ├── roles.types.ts         # Roles API request/response types
  │   ├── permissions.types.ts   # Permissions API request/response types
  │   └── logs.types.ts           # Logs API request/response types
  ├── auth.api.ts                # Auth API functions
  ├── roles.api.ts               # Roles API functions
  ├── permissions.api.ts         # Permissions API functions
  └── logs.api.ts                # Logs API functions
```



## Implementation Details

### 1. Type Definitions (`src/api/types/`)

Create typed interfaces for all API requests and responses:**auth.types.ts:**

- `LoginRequest` - { redirect: string, state?: string }
- `LoginResponse` - { loginUrl: string, state: string }
- `ValidateTokenRequest` - { token: string }
- `ValidateTokenResponse` - { authenticated: boolean, user?: UserInfo }
- `GetUserResponse` - UserInfo
- `LogoutRequest` - { token: string }
- `LogoutResponse` - { success: boolean, message: string, timestamp: string }
- `RefreshTokenRequest` - { refreshToken: string }
- `RefreshTokenResponse` - { accessToken: string, refreshToken: string, expiresIn: number }

**roles.types.ts:**

- `GetRolesResponse` - { roles: string[] }
- `RefreshRolesResponse` - { roles: string[] }

**permissions.types.ts:**

- `GetPermissionsResponse` - { permissions: string[] }
- `RefreshPermissionsResponse` - { permissions: string[] }

**logs.types.ts:**

- `LogEntry` - (reuse from existing types)
- `LogRequest` - { ...logEntry fields }
- `BatchLogRequest` - { logs: LogEntry[] }
- `LogResponse` - { success: boolean }

### 2. API Client Class (`src/api/index.ts`)

Create `ApiClient` class that wraps `HttpClient`:

```typescript
export class ApiClient {
  constructor(private httpClient: HttpClient) {}
  
  // Expose domain-specific APIs
  readonly auth = new AuthApi(this.httpClient);
  readonly roles = new RolesApi(this.httpClient);
  readonly permissions = new PermissionsApi(this.httpClient);
  readonly logs = new LogsApi(this.httpClient);
}
```



### 3. Domain API Classes (`src/api/*.api.ts`)

Each domain API class provides typed functions:**auth.api.ts:**

- `login(params: LoginRequest, authStrategy?: AuthStrategy): Promise<LoginResponse>`
- `validateToken(token: string, authStrategy?: AuthStrategy): Promise<ValidateTokenResponse>`
- `getUser(token: string, authStrategy?: AuthStrategy): Promise<GetUserResponse>`
- `getUserInfo(token: string, authStrategy?: AuthStrategy): Promise<GetUserResponse>`
- `logout(params: LogoutRequest): Promise<LogoutResponse>`
- `refreshToken(params: RefreshTokenRequest, authStrategy?: AuthStrategy): Promise<RefreshTokenResponse>`

**roles.api.ts:**

- `getRoles(token: string, authStrategy?: AuthStrategy): Promise<GetRolesResponse>`
- `refreshRoles(token: string, authStrategy?: AuthStrategy): Promise<RefreshRolesResponse>`

**permissions.api.ts:**

- `getPermissions(token: string, authStrategy?: AuthStrategy): Promise<GetPermissionsResponse>`
- `refreshPermissions(token: string, authStrategy?: AuthStrategy): Promise<RefreshPermissionsResponse>`

**logs.api.ts:**

- `sendLog(logEntry: LogRequest): Promise<LogResponse>`
- `sendBatchLogs(logs: BatchLogRequest): Promise<LogResponse>`

### 4. Integration Points

- API client will be created in `MisoClient` constructor alongside `HttpClient`
- Services can optionally use `ApiClient` instead of direct `HttpClient` calls
- All API functions use `HttpClient` internally (wrapping pattern)
- Endpoints are centralized as constants in each API class

## Benefits

1. **Type Safety**: All API calls have typed inputs/outputs
2. **Centralized Management**: All endpoints in one place per domain
3. **Easier Refactoring**: Change endpoint URLs in one place
4. **Better Documentation**: Types serve as API documentation
5. **Gradual Migration**: Services can adopt new API layer incrementally
6. **Internal Only**: No breaking changes to public API

## Before Development

- [ ] Read Architecture Patterns - HTTP Client Pattern section from project-rules.mdc
- [ ] Review existing HttpClient usage patterns in services (AuthService, RoleService, PermissionService, LoggerService)
- [ ] Review existing type definitions in src/types/config.types.ts for reference
- [ ] Review error handling patterns in existing services
- [ ] Understand testing requirements and mock patterns (mock HttpClient)
- [ ] Review JSDoc documentation patterns in existing services
- [ ] Review endpoint URL patterns (all use /api prefix)
- [ ] Review camelCase naming conventions for public API outputs
- [ ] Review file organization patterns (src/services/, src/utils/, src/types/)

## Migration Strategy

1. Create API layer alongside existing code
2. Services continue using `HttpClient` directly (no breaking changes)
3. Gradually refactor services to use `ApiClient` when convenient
4. Eventually deprecate direct `HttpClient` usage in services

## Files to Create

- `src/api/index.ts` - Main ApiClient class
- `src/api/types/auth.types.ts` - Auth API types
- `src/api/types/roles.types.ts` - Roles API types
- `src/api/types/permissions.types.ts` - Permissions API types
- `src/api/types/logs.types.ts` - Logs API types
- `src/api/auth.api.ts` - Auth API implementation
- `src/api/roles.api.ts` - Roles API implementation
- `src/api/permissions.api.ts` - Permissions API implementation
- `src/api/logs.api.ts` - Logs API implementation

## Files to Modify (Future)

- `src/index.ts` - Add ApiClient to MisoClient (optional, for gradual adoption)
- Services can gradually migrate to use ApiClient instead of HttpClient

## Endpoints to Centralize

**Auth:**

- `POST /api/v1/auth/token` - Client token
- `GET /api/v1/auth/login` - Login
- `POST /api/v1/auth/validate` - Validate token
- `GET /api/v1/auth/user` - Get user info
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh token

**Roles:**

- `GET /api/v1/auth/roles` - Get roles
- `GET /api/v1/auth/roles/refresh` - Refresh roles

**Permissions:**

- `GET /api/v1/auth/permissions` - Get permissions
- `GET /api/v1/auth/permissions/refresh` - Refresh permissions

**Logs:**

- `POST /api/v1/logs` - Send log
- `POST /api/v1/logs/batch` - Send batch logs

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs TypeScript compilation)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Each API class file ≤500 lines, methods ≤20-30 lines
6. **JSDoc Documentation**: All public API methods have JSDoc comments with parameter types and return types
7. **Code Quality**: All rule requirements met
8. **Security**: No hardcoded secrets, proper token handling via HttpClient (never expose clientId/clientSecret)
9. **Type Safety**: All API calls have typed inputs/outputs using interfaces (not types)
10. **Naming Conventions**: All public API types/interfaces use camelCase (no snake_case)
11. **Error Handling**: Use try-catch for all async operations, handle errors gracefully
12. **Testing**: Write tests for all API classes, mock HttpClient, achieve ≥80% coverage
13. **Endpoint Management**: All endpoint URLs centralized as constants in each API class
14. **HttpClient Usage**: All API functions use HttpClient's authenticatedRequest() or request() methods correctly
15. **Documentation**: Update documentation as needed (README, API docs, usage examples)
16. All tasks completed
17. All API classes follow Architecture Patterns - HTTP Client Pattern
18. All types/interfaces follow Code Style - Naming Conventions (camelCase)
19. All files follow File Organization structure (src/api/ with types/ subdirectory)

---

## Plan Validation Report

**Date**: 2024-12-19

**Plan**: `.cursor/plans/centralized_api_layer_with_typed_interfaces.plan.md`

**Status**: ✅ VALIDATED

### Plan Purpose

Create a centralized API layer (`src/api/`) that provides typed interfaces for all controller API calls. The layer wraps `HttpClient` internally and organizes APIs by domain (auth, roles, permissions, logs). This is an internal improvement that allows services to gradually migrate from direct `HttpClient` usage to the new typed API layer.**Plan Type**: Architecture/Refactoring

**Affected Areas**: HTTP Client (wrapping), Type Definitions (new API types), File Organization (new src/api/ structure), Services (future migration)

### Applicable Rules

- ✅ **[Architecture Patterns - HTTP Client Pattern](.cursor/rules/project-rules.mdc#http-client-pattern)** - ApiClient wraps HttpClient, uses authenticatedRequest() and request() methods correctly
- ✅ **[Architecture Patterns - API Endpoints](.cursor/rules/project-rules.mdc#api-endpoints)** - All endpoints use `/api` prefix, centralized endpoint management
- ✅ **[Architecture Patterns - Token Management](.cursor/rules/project-rules.mdc#token-management)** - Proper handling of client tokens and user tokens via HttpClient
- ✅ **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - Use interfaces for public APIs, strict mode, private methods
- ✅ **[Code Style - Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions)** - camelCase for all public API outputs, PascalCase for classes
- ✅ **[Code Style - Error Handling](.cursor/rules/project-rules.mdc#error-handling)** - Use try-catch for async operations, handle errors gracefully
- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits, documentation requirements, JSDoc for public methods (MANDATORY)
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, mock HttpClient, 80%+ coverage (MANDATORY)
- ✅ **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Never expose clientId/clientSecret, proper token handling (MANDATORY)
- ✅ **[File Organization](.cursor/rules/project-rules.mdc#file-organization)** - New src/api/ structure, proper import order, export strategy
- ✅ **[Code Size Guidelines](.cursor/rules/project-rules.mdc#code-size-guidelines)** - Files ≤500 lines, methods ≤20-30 lines
- ✅ **[Documentation](.cursor/rules/project-rules.mdc#documentation)** - JSDoc comments for all public methods

### Rule Compliance

- ✅ **DoD Requirements**: Fully documented with BUILD → LINT → TEST sequence
- ✅ **Architecture Patterns**: Plan addresses HTTP Client Pattern, API Endpoints, Token Management
- ✅ **Code Style**: Plan addresses TypeScript Conventions, Naming Conventions (camelCase), Error Handling
- ✅ **Code Quality Standards**: File size limits and JSDoc requirements documented
- ✅ **Testing Conventions**: Testing requirements and mock patterns documented
- ✅ **Security Guidelines**: Security requirements (no clientId/clientSecret exposure) documented
- ✅ **File Organization**: New src/api/ structure documented
- ✅ **Code Size Guidelines**: File and method size limits documented
- ✅ **Documentation**: JSDoc requirements documented

### Plan Updates Made

- ✅ Added **Rules and Standards** section with 11 applicable rule sections
- ✅ Added **Key Requirements** subsection with specific implementation requirements
- ✅ Added **Before Development** checklist with 9 preparation steps
- ✅ Added **Definition of Done** section with 19 comprehensive requirements
- ✅ Added rule references with anchor links to project-rules.mdc
- ✅ Documented mandatory validation sequence: BUILD → LINT → TEST
- ✅ Documented file size limits (≤500 lines for files, ≤20-30 lines for methods)
- ✅ Documented testing requirements (≥80% coverage, mock HttpClient)
- ✅ Documented security requirements (no clientId/clientSecret exposure)
- ✅ Documented naming conventions (camelCase for public API outputs)
- ✅ Documented JSDoc requirements for all public methods

### Recommendations

1. **Consider Adding Tests Section**: While testing requirements are documented in DoD, consider adding a dedicated "Testing Strategy" section outlining test file structure and specific test cases to cover.
2. **Endpoint Constants**: Consider documenting the exact constant naming convention for endpoint URLs (e.g., `AUTH_LOGIN_ENDPOINT = '/api/v1/auth/login'`).
3. **Error Response Types**: Consider adding error response types to the type definitions (e.g., `ApiErrorResponse`) for consistent error handling.
4. **Migration Examples**: Consider adding examples of how services would migrate from HttpClient to ApiClient (before/after code snippets).
5. **Documentation Updates**: Plan mentions updating documentation but could specify which files (README.md, docs/api.md, etc.).

### Validation Summary

The plan is **VALIDATED** and ready for production implementation. All mandatory DoD requirements are documented, all applicable rule sections are referenced, and the plan structure follows best practices. The plan provides clear guidance for implementation while maintaining backward compatibility with existing services.**Next Steps**:

1. Review the plan with the team
2. Begin implementation following the "Before Development" checklist
3. Follow the Definition of Done requirements during implementation