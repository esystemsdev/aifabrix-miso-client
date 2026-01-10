# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.8.0] - 2026-01-10

### Added

- **Unified Logging Interface**: New minimal API with automatic context extraction
  - `getLogger()` factory function for automatic context detection from AsyncLocalStorage
  - `setLoggerContext()` and `clearLoggerContext()` for manual context management
  - `loggerContextMiddleware` Express middleware helper for automatic request context extraction
  - AsyncLocalStorage-based context propagation across async boundaries
  - Simplified API: `logger.info(message)`, `logger.error(message, error?)`, `logger.audit(action, resource, entityId?, oldValues?, newValues?)`
  - Automatic context extraction from AsyncLocalStorage (set by Express middleware or manually)
  - Works seamlessly in Express routes, service layers, and background jobs
  - Zero configuration required when middleware is used

### Documentation

- Added unified logging examples and guides (`docs/examples/unified-logging.md`)
- Updated Express middleware examples with unified logging pattern
- Added background job logging examples with unified interface
- Comprehensive API reference for UnifiedLogger interface in `docs/reference-services.md`

## [3.7.2] - 2026-01-10

### Added

- **Comprehensive Integration Tests** - Full end-to-end integration tests for Auth and Logs API endpoints
  - New `tests/integration/api-endpoints.integration.test.ts` with comprehensive endpoint coverage
  - Tests all Auth and Logs endpoints against real controller using credentials from `.env`
  - Validates endpoint paths, HTTP methods, request bodies, and response structures against OpenAPI specs
  - Tests error cases (invalid tokens, missing params, etc.) with proper status code verification
  - Gracefully skips tests if controller is unavailable (CI/CD friendly)
  - New npm script `test:integration:api` for running integration tests

### Changed

- **Logger Service Refactoring** - Improved code organization and maintainability
  - Moved logger service to modular structure in `src/services/logger/` directory
  - Split `LoggerService` into focused modules: `logger-chain.ts`, `logger-context.ts`, `logger.service.ts`
  - New barrel export `src/services/logger/index.ts` for cleaner imports
  - Maintains backward compatibility (no breaking changes to public API)

- **Error Handling Improvements** - Enhanced error handling across API layer
  - Updated error handling in integration tests to gracefully skip unavailable controllers
  - Improved error reporting and logging throughout API files
  - Enhanced user information retrieval functionality

- **Code Quality Improvements** - Refactoring for better readability and maintainability
  - Updated various components for improved logging and error reporting
  - Enhanced API response handling and validation
  - Improved code organization and structure

### Fixed

- **Linting Issues** - Fixed ESLint errors in internal HTTP client
  - Converted `require()` statements to use ESLint disable comments for Node.js-only code
  - Fixed `@typescript-eslint/no-var-requires` errors in `src/utils/internal-http-client.ts`

### Technical

- **New test infrastructure**:
  - Comprehensive integration test suite (`tests/integration/api-endpoints.integration.test.ts` - 554 lines)
  - New npm script: `test:integration:api` for running integration tests
  - Enhanced validation plans and summaries for API calls

- **Code organization**:
  - Logger service modularized into `src/services/logger/` directory structure
  - Improved separation of concerns with focused modules
  - Better code maintainability and testability

- **Documentation**:
  - Added endpoint validation summary documentation
  - Updated validation plans for API calls

## [3.7.1] - 2026-01-09

### Added

- **Enhanced Error Logging with Correlation IDs** - Comprehensive error logging system with structured error extraction
  - New `extractErrorInfo()` utility in `src/utils/error-extractor.ts` for structured error information extraction
  - New `logErrorWithContext()` utility in `src/utils/console-logger.ts` for enhanced console logging with correlation ID prefixes
  - Supports all error types: `MisoClientError`, `ApiError`, `AuthenticationError`, `NetworkError`, `TimeoutError`, and generic `Error`
  - Automatic correlation ID extraction from error responses or auto-generation when missing
  - Enhanced error context includes endpoint, method, status codes, response bodies, and stack traces
  - All API files updated with structured error logging (11 API files enhanced)
  - DataClient and Express error handlers updated with enhanced logging

- **Logger Service Getter Methods** - Public methods for external logger integration
  - New `getLogWithRequest()` method - Extracts IP, method, path, userAgent, correlationId, userId from Express Request
  - New `getWithContext()` method - Returns LogEntry with provided context and auto-generated correlation ID
  - New `getWithToken()` method - Extracts userId, sessionId, applicationId from JWT token
  - New `getForRequest()` method - Alias for `getLogWithRequest()` for consistency
  - All methods return complete `LogEntry` objects for integration with external logger tables
  - `generateCorrelationId()` method made public for consistent correlation ID generation

- **Unified JSON Filter Model** - Standardized JSON format for all filter representations
  - New filter operators: `isNull` and `isNotNull` for null/undefined checks
  - JSON format parser supports multiple input formats: direct object, JSON string, URL-encoded JSON, array of filters
  - Operator normalization (e.g., `equals` → `eq`, `>` → `gt`)
  - Comprehensive validation with clear error messages and examples
  - Filter conversion utilities: `filterQueryToJson()` and `jsonToFilterQuery()`
  - Query string builder outputs URL-encoded JSON format
  - Local filtering supports null checks with `isNull` and `isNotNull` operators

- **Server Code Improvements** - Enhanced Express server error handling and logging
  - Replaced all `console.log/error/warn` with MisoClient logger service
  - All route handlers wrapped with `asyncHandler()` wrapper for automatic error handling
  - Error middleware uses `handleRouteError()` from SDK for RFC 7807 compliance
  - Error logger configured with MisoClient logger via `setErrorLogger()`
  - All business logic errors use `AppError` for consistent error formatting
  - Automatic correlation ID extraction and error logging with full context

- **Frontend Code Improvements** - Enhanced React application error handling and code quality
  - Centralized error handling utilities (`src/utils/error-handler.ts`)
  - Centralized type definitions (`src/types/errors.ts`, `src/types/api.ts`)
  - Input validation utilities (`src/utils/validation.ts`) for role names, permission names, endpoints
  - Component refactoring: ApiTestingPage reduced from 589 to 79 lines (87% reduction)
  - New custom hooks: `useApiTesting` for API testing logic, `useLoadingState` for loading state management
  - Improved DataClientContext with retry logic and exponential backoff
  - Simplified ErrorDetailsDialog component (115 lines, reduced from 193)

- **Comprehensive Integration Tests** - Real integration tests for all auth and logs endpoints
  - New `tests/integration/api-endpoints.integration.test.ts` with comprehensive endpoint coverage
  - Tests all 24 auth endpoints against real controller using credentials from `.env`
  - Tests all 15 logs endpoints with proper request/response validation
  - Validates endpoint paths, HTTP methods, request bodies, and response structures against OpenAPI specs
  - Tests error cases (invalid tokens, missing params, etc.) with proper status code verification
  - Gracefully skips tests if controller is unavailable (CI/CD friendly)
  - New npm script `test:integration:api` for running integration tests

- **Logger Service Refactoring** - Improved code organization and maintainability
  - Split `LoggerService` into modular structure following API layer pattern
  - New `src/services/logger/logger-chain.ts` - LoggerChain class for method chaining
  - New `src/services/logger/logger-context.ts` - Context extraction utilities (JWT, metadata, request)
  - New `src/services/logger/index.ts` - Barrel export for logger modules
  - Reduced main `logger.service.ts` from 866 lines to under 500 lines (code size compliance)
  - Maintains backward compatibility (no breaking changes to public API)

### Changed

- **Error Logging** - Enhanced error logging across all API layer files
  - All API files now use `extractErrorInfo()` and `logErrorWithContext()` for structured error logging
  - Error logs include correlation ID prefixes: `[MisoClient] [correlation-id] Error details`
  - Authentication errors have special handling with detailed context (authFlow: 'token_validation_failed')
  - Enhanced audit logs include structured error info (errorType, errorCategory, httpStatusCategory)

- **Filter Parsing** - Unified JSON format replaces colon-separated format
  - Filter parser now accepts JSON format only: `{"field": {"op": value}}`
  - Supports 12 operators: `eq`, `neq`, `in`, `nin`, `gt`, `lt`, `gte`, `lte`, `contains`, `like`, `isNull`, `isNotNull`
  - FilterBuilder outputs JSON format (URL-encoded) in query strings
  - Comprehensive validation with helpful error messages including examples

- **Server Error Handling** - Standardized error handling patterns
  - All route handlers use `asyncHandler()` wrapper (no manual try-catch needed)
  - All errors automatically formatted as RFC 7807 Problem Details
  - Error logger uses MisoClient logger with `forRequest()` for automatic context extraction
  - Consistent error responses across all routes with correlation IDs

- **Frontend Error Handling** - Centralized error handling patterns
  - All components use shared error handling utilities
  - RFC 7807 compliant error parsing with `parseError()` utility
  - Consistent error message extraction with `getErrorMessage()` and `getErrorStatus()`
  - Input validation integrated into authorization testing hooks

- **API Layer Cleanup** - Removed duplicate code and improved code quality
  - Removed duplicate roles/permissions methods from `AuthApi` class
  - Removed `getRoles()`, `refreshRoles()`, `getPermissions()`, `refreshPermissions()` from `AuthApi`
  - Services now use dedicated `RolesApi` and `PermissionsApi` classes (DRY principle)
  - Removed unused endpoint constants and type imports from `AuthApi`
  - Updated class JSDoc to reflect removed methods

- **Error Handling Improvements** - Fixed duplicate throw statements across API layer
  - Removed duplicate `throw error;` statements from `auth.api.ts`, `roles.api.ts`, `permissions.api.ts`
  - Fixed duplicate throws in `logs-create.api.ts` and `logs-list.api.ts`
  - Improved error handling consistency across all API files

### Fixed

- **Server Error Handling** - Fixed logic bug in server.ts (dead code removed)
- **Server Logging** - Fixed inconsistent logging format (now uses MisoClient logger)
- **Server Error Responses** - Fixed non-RFC 7807 error responses (now uses `handleRouteError()`)
- **Frontend Component Size** - Fixed large component files exceeding 500-line limit
  - ApiTestingPage: 589 → 79 lines (87% reduction)
  - ConfigurationPage: 382 → 283 lines (26% reduction)
- **Frontend Error Handling** - Fixed duplicate error handling logic across components
- **Frontend Type Safety** - Fixed loose error typing with centralized type definitions
- **Code Size Compliance** - Fixed logger service file size violation
  - Refactored `LoggerService` from 866 lines to under 500 lines
  - Split into focused modules: logger-chain.ts, logger-context.ts, index.ts
  - Maintains all functionality while improving maintainability
- **API Endpoint Validation** - Validated all endpoints against OpenAPI specifications
  - Verified all 24 auth endpoints match OpenAPI spec paths and HTTP methods
  - Verified all 15 logs endpoints match OpenAPI spec with proper request/response structures
  - Confirmed audit logs include required fields (entityType, entityId, action) in data object
  - Validated client token endpoints use correct paths (`/api/v1/auth/token` for legacy, `/api/v1/auth/client-token` for frontend)

### Technical

- **New utility files**:
  - `src/utils/error-extractor.ts` - Error extraction utility (172 lines)
  - `src/utils/console-logger.ts` - Enhanced console logger (72 lines)
  - `src/utils/error-handler.ts` - Frontend error handling utilities (175 lines)
  - `src/utils/validation.ts` - Frontend input validation utilities (139 lines)
  - `src/types/errors.ts` - Frontend error type definitions (25 lines)
  - `src/types/api.ts` - Frontend API type definitions (63 lines)

- **Test coverage**:
  - Error extraction utility: 18 tests (`tests/unit/utils/error-extractor.test.ts`)
  - Console logger utility: 12 tests (`tests/unit/utils/console-logger.test.ts`)
  - Logger getter methods: 31 tests (`tests/unit/services/logger-getter-methods.test.ts`)
  - Filter utilities: 68 tests (`tests/unit/filter.utils.test.ts`)
  - Frontend error handler: 21 tests (`server/frontend/src/utils/__tests__/error-handler.test.ts`)
  - Frontend validation: 43 tests (`server/frontend/src/utils/__tests__/validation.test.ts`)
  - Integration tests: Comprehensive tests for all 39 endpoints (`tests/integration/api-endpoints.integration.test.ts`)
  - Total: 193+ new tests added, all passing

- **New logger module structure**:
  - `src/services/logger/logger-chain.ts` - LoggerChain class (method chaining support)
  - `src/services/logger/logger-context.ts` - Context extraction utilities
  - `src/services/logger/index.ts` - Barrel export
  - `src/services/logger.service.ts` - Core LoggerService class (reduced to <500 lines)

- **Code quality**:
  - All new utilities follow camelCase naming convention
  - All public methods have JSDoc comments with parameter types, return types, and examples
  - File sizes within limits (all files ≤500 lines)
  - Method sizes within limits (all methods ≤30 lines)
  - Zero linting errors or warnings
  - Proper error handling with try-catch for all async operations
  - Removed duplicate code (roles/permissions methods from AuthApi)
  - Fixed duplicate throw statements across API layer
  - All endpoints validated against OpenAPI specs

- **Documentation**:
  - Updated `docs/reference-services.md` with logger getter methods documentation
  - Updated `docs/reference-utilities.md` with filter JSON format examples
  - Updated `server/README.md` with factory function pattern and error logger configuration
  - Updated `docs/examples/express-middleware.md` with error logger configuration examples
  - Updated `AuthApi` class JSDoc to remove references to removed methods
  - Added integration test documentation explaining test structure and requirements

## [3.6.0] - 2024-12-31

### Added

- **API Response Validation** - Runtime validation for API response structures
  - New `validateSuccessResponse<T>()` type guard for standard success responses
  - New `validatePaginatedResponse<T>()` type guard for paginated responses
  - New `validateErrorResponse()` type guard for error responses (re-exports existing validation)
  - New `getResponseType()` utility to determine response type (success, paginated, error)
  - Response validation utilities in `src/utils/response-validator.ts` with comprehensive type guards
  - All validation functions use TypeScript type guards for proper type narrowing
  - Detailed validation error messages for debugging response structure mismatches

- **Response Validation Configuration** - Configurable validation control
  - New `validateResponses?: boolean` configuration option in `MisoClientConfig`
  - Environment variable support: `MISO_VALIDATE_RESPONSES` (defaults to `true` in development, `false` in production)
  - Validation is opt-in and backward compatible (doesn't break existing code)
  - Non-breaking validation failures (logs warnings instead of throwing errors)

### Changed

- **HTTP Client Response Validation** - Enhanced HTTP client with response structure validation
  - `InternalHttpClient` now validates all API responses when `validateResponses` is enabled
  - All HTTP methods (`get`, `post`, `put`, `delete`, `request`, `authenticatedRequest`) validate responses
  - Validation checks for standard success response format: `{ success: boolean, data?: T, message?: string, timestamp: string }`
  - Validation checks for paginated response format: `{ data: T[], meta: {...}, links: {...} }`
  - Validation handles both nested and flat response formats (backward compatibility)
  - Validation failures log warnings with endpoint URL, expected structure, and actual response
  - Graceful error handling - validation failures don't break existing functionality

### Fixed

- **Circuit breaker priority** - Fixed critical ordering issue where circuit breaker check now occurs before cache check
  - Circuit breaker check moved before cache and pending request checks to prevent requests to failing endpoints
  - Ensures failed endpoints are blocked even if cache is cleared, preventing unnecessary API calls during failures
  - Improved error consistency by using `throw` instead of `Promise.reject()` for circuit breaker errors

- **Cache key generation** - Fixed cache key generation to ensure HTTP method is always included
  - Cache key now explicitly includes HTTP method from method parameter to ensure consistency
  - Prevents potential cache key collisions when method might be undefined in options
  - Ensures proper cache key generation for all HTTP methods (GET, POST, PUT, DELETE, etc.)

### Technical

- **New utility file**: `src/utils/response-validator.ts` - Response validation utilities (174 lines)
  - Type guard functions for runtime type checking
  - Support for success, paginated, and error response formats
  - Comprehensive JSDoc documentation for all public functions
  - Proper TypeScript type narrowing with type guards

- **Test coverage**:
  - Comprehensive tests in `tests/unit/utils/response-validator.test.ts` (413 lines)
  - 36 test cases covering valid/invalid responses, edge cases, and backward compatibility
  - Test coverage: **96.53%** (exceeds ≥80% requirement)
    - Statements: 96.53% (167/173)
    - Branches: 91.83% (45/49)
    - Functions: 100% (4/4)
    - Lines: 96.53% (167/173)
  - All tests passing with execution time < 0.5 seconds

- **Configuration updates**:
  - Added `validateResponses?: boolean` to `MisoClientConfig` interface
  - Added `MISO_VALIDATE_RESPONSES` environment variable support in config loader
  - Defaults to `true` in development, `false` in production for performance

- **Code quality**:
  - All validation functions follow camelCase naming convention
  - All public functions have JSDoc comments with parameter types and return types
  - File size: 174 lines (≤500 lines requirement met)
  - Method sizes: ≤30 lines (≤20-30 lines requirement met)
  - Zero linting errors or warnings
  - Proper error handling with try-catch for all async operations

## [3.4.1] - 2025-12-30

### Fixed

- **Token validation caching** - Improved caching strategy for token validation
  - Enhanced cache key generation using SHA-256 hash of token for security
  - Smart TTL calculation based on token expiration with safety buffer
  - Minimum TTL enforcement to prevent excessive API calls
  - Better cache invalidation handling

### Changed

- **Error handling** - Enhanced error handling and logging for token retrieval
  - Added detailed error responses for timeout scenarios in client token endpoint
  - Updated AuthService to use shorter timeout for axios requests (aligns with handler timeout)
  - Improved logging for token retrieval processes with controller URL details
  - Integrated controller URL resolution in environment token utility for consistent URL handling

### Technical

- **Dependencies** - Updated dependencies and improved linting configuration
  - Removed unnecessary "peer" flags from package-lock.json
  - Updated linting scripts to ignore declaration files for better efficiency
  - Updated package dependencies for improved functionality and performance

## [3.4.0] - 2025-12-24

### Added

- **Local Token Validation** - JWKS-based JWT validation without API calls
  - New `validateTokenLocal()` method for local JWT signature verification
  - Supports Keycloak tokens and delegated OAuth provider tokens
  - Dual-layer caching: JWKS keys (1 hour) + validation results (1 minute)
  - `skipResultCache` option for high-security scenarios
  - Auto-detection of token type based on issuer claim
  - New `TokenValidationService` exported for advanced usage

- **Keycloak Configuration** - Native Keycloak integration
  - New `keycloak` config option in `MisoClientConfig`
  - `setKeycloakConfig()` method for runtime configuration
  - Audience validation support (opt-in via `verifyAudience`)

- **Cache Management** - Fine-grained cache control
  - `clearJwksCache(uri?)` - Clear JWKS key cache
  - `clearValidationCache()` - Clear validation result cache
  - `clearAllTokenCaches()` - Clear all caches

### Changed

- **Package Distribution** - Added CHANGELOG.md to npm package files

### Dependencies

- Added `jose` ^5.9.6 for JWT/JWKS operations

## [3.3.0] - 2025-12-23

### Added

- **Centralized API layer** - Typed interfaces for all controller API calls
  - New API layer in `src/api/` with domain-specific API classes (`AuthApi`, `RolesApi`, `PermissionsApi`, `LogsApi`)
  - `ApiClient` class wraps `HttpClient` and organizes APIs by domain
  - Centralized endpoint URLs as constants in each API class for maintainability
  - All API request/response types use interfaces (not types) with camelCase naming convention
  - Services can optionally use `ApiClient` instead of direct `HttpClient` calls (gradual migration pattern)
  - Improved type safety and code organization for controller API interactions
  - API classes are composed from specialized sub-modules to keep file sizes manageable

### Changed

- **Token validation enhancements** - Improved token acceptance criteria
  - Updated token validation logic to accept both JWT and non-JWT token formats
  - Enhanced validation to ensure tokens are non-empty and of reasonable length
  - Improved error handling for token validation failures
  - Updated unit tests to reflect changes in token acceptance criteria

- **OAuth callback handling** - Enhanced error feedback
  - Updated error handling in `handleOAuthCallback()` to provide clearer feedback on token validation failures
  - Improved documentation for token validation and OAuth handling

- **Service dependencies** - Optional API client support
  - Services can now optionally include `ApiClient` for typed API access
  - Allows for gradual migration from direct `HttpClient` usage to typed API layer
  - Maintains backward compatibility with existing service implementations

### Technical

- **New API layer structure**:
  - `src/api/index.ts` - Main `ApiClient` class
  - `src/api/auth.api.ts` - Authentication API (composed from sub-modules)
  - `src/api/roles.api.ts` - Roles API
  - `src/api/permissions.api.ts` - Permissions API
  - `src/api/logs.api.ts` - Logs API
  - `src/api/types/` - API request/response type definitions

- **Test coverage**:
  - Updated mock patterns to include `ApiClient` for testing purposes
  - Enhanced unit tests for token validation with new acceptance criteria

- **Documentation**:
  - Added API layer pattern documentation to project rules
  - Updated usage examples to demonstrate API layer pattern
  - Enhanced documentation for token validation and OAuth handling

## [3.2.5] - 2025-12-22

### Added

- **Indexed logging fields** - Standardized indexed fields for improved query performance and observability
  - New `extractLoggingContext()` utility function in `src/utils/logging-helpers.ts`
  - Added indexed context fields to `LogEntry` interface: `sourceKey`, `sourceDisplayName`, `externalSystemKey`, `externalSystemDisplayName`, `recordKey`, `recordDisplayName`
  - Added credential context fields: `credentialId`, `credentialType`
  - Added request/response metrics: `requestSize`, `responseSize`, `durationMs`
  - Added error classification fields: `errorCategory`, `httpStatusCategory`
  - New `LoggerChain` methods: `withIndexedContext()`, `withCredentialContext()`, `withRequestMetrics()`
  - Exported types: `IndexedLoggingContext`, `HasKey`, `HasExternalSystem`
  - Improves query performance and root-cause analysis for audit logs

- **Request context auto-extraction** - Automatic extraction of logging context from Express Request objects
  - New `extractRequestContext()` utility function in `src/utils/request-context.ts`
  - New `withRequest()` method on `LoggerChain` for automatic context extraction
  - New `forRequest()` method on `LoggerService` for request-based logging
  - Automatically extracts: IP address, HTTP method, path, user-agent, correlation ID, user from JWT, session ID, request ID
  - Handles proxy IPs via `x-forwarded-for` header
  - Reduces logging code from 10-15 lines to 2-3 lines per log call
  - Exported `RequestContext` interface and `extractRequestContext` function

- **Token validation caching** - Caching for token validation to reduce API calls
  - Cache validation results by userId with 15-minute TTL (configurable via `config.cache?.tokenValidationTTL`)
  - Cache key format: `token:${userId}` (consistent with roles/permissions caching)
  - Automatic cache invalidation on logout (clears cache even if logout returns 400)
  - New `clearTokenCache()` method in `AuthService` for manual cache clearing
  - Extracts userId from JWT token before API call (avoids unnecessary validate API call)
  - Graceful fallback to API call on cache failures
  - Uses `CacheService` instead of `RedisService` for consistency

- **User token refresh** - Token refresh functionality for secure token renewal
  - New `refreshToken()` method in `AuthService` for backend applications
  - New `onTokenRefresh` callback support in `DataClient` for frontend applications
  - Automatic token refresh on 401 errors in DataClient with retry logic
  - New `RefreshTokenResponse` interface with `accessToken`, `refreshToken`, `expiresIn`, `expiresAt`
  - Exposed `refreshToken()` method in `MisoClient` class
  - Prevents infinite retry loops with `tokenRefreshAttempted` flag
  - Refresh tokens never stored in browser localStorage (security requirement)

- **OAuth callback handler** - ISO 27001 compliant OAuth callback handling with hash fragments
  - New `handleOAuthCallback()` function in `src/utils/data-client-auth.ts`
  - New `handleOAuthCallback()` method in `DataClient` class
  - Extracts tokens from URL hash fragments (`#token=...`) instead of query parameters
  - Immediate hash cleanup (< 100ms) to prevent token exposure
  - Token format validation (JWT format check)
  - HTTPS enforcement in production environments
  - Supports multiple parameter names: `token`, `access_token`, `accessToken`
  - Auto-calls on DataClient initialization in browser environments
  - Secure error handling without exposing tokens

### Changed

- **LoggerService enhancements** - Enhanced logging capabilities with indexed fields
  - Updated `ClientLoggingOptions` interface with indexed context fields
  - Updated `LogEntry` interface with indexed fields for fast queries
  - Enhanced `LoggerChain` fluent API with new context methods
  - Improved developer experience with automatic request context extraction

- **AuthService improvements** - Enhanced authentication service with caching
  - Updated constructor to accept `CacheService` instead of `RedisService`
  - Added `extractUserIdFromToken()` private method for JWT extraction
  - Enhanced `validateToken()` method with caching logic
  - Updated `logout()` method to clear token cache on logout

- **DataClient enhancements** - Improved token refresh and OAuth handling
  - Added `refreshUserToken()` private method for token refresh
  - Enhanced 401 error handling with automatic token refresh and retry
  - Updated `redirectToLogin()` documentation for hash fragment flow
  - Improved OAuth callback handling with security measures

### Fixed

- **Token validation performance** - Reduced API calls through caching
  - Token validation now uses cache to avoid unnecessary controller API calls
  - Cache hit significantly improves performance for repeated validations

- **OAuth security** - Improved security for OAuth callback flow
  - Tokens extracted from hash fragments (not sent to server, not in logs)
  - Immediate cleanup prevents token exposure in address bar
  - HTTPS enforcement prevents token transmission over HTTP in production

### Technical

- **New utility files**:
  - `src/utils/logging-helpers.ts` - Logging context extraction utility (91 lines)
  - `src/utils/request-context.ts` - Request context extraction utility (102 lines)

- **Test coverage**:
  - Comprehensive tests for logging helpers (15 tests)
  - Comprehensive tests for request context extraction (33 tests)
  - Enhanced tests for token caching (80 tests total in auth.service.test.ts)
  - Comprehensive tests for token refresh (17 AuthService + 15 DataClient tests)
  - Comprehensive tests for OAuth callback handler (34 tests)

- **Type definitions**:
  - Added `RefreshTokenResponse` interface to `src/types/config.types.ts`
  - Added `tokenValidationTTL?: number` to cache config type
  - Added `onTokenRefresh` callback to `DataClientConfig` interface

- **Exports updated**:
  - `src/index.ts` - Exports `extractLoggingContext`, `IndexedLoggingContext`, `HasKey`, `HasExternalSystem`
  - `src/index.ts` - Exports `extractRequestContext`, `RequestContext`
  - `src/index.ts` - Exports `refreshToken()` method in `MisoClient`

## [3.2.0] - 2025-12-22

### Added

- **Circuit breaker for HTTP logging** - Prevents infinite retry loops when logging service is unavailable
  - Added circuit breaker pattern to `LoggerService` and `AuditLogQueue`
  - Automatically disables HTTP logging after 3 consecutive failures
  - Circuit breaker opens for 60 seconds after failures, then resets
  - Prevents performance degradation when controller logging endpoint is unavailable
  - Gracefully handles network errors and server unavailability

- **DataClient redirect utilities** - Comprehensive redirect handling for login flows
  - New `data-client-redirect.ts` utility module with robust redirect logic
  - Enhanced `redirectToLogin()` with comprehensive error handling
  - URL validation prevents dangerous redirects (javascript:, data:, etc.)
  - User-friendly error messages for network, CORS, and authentication errors
  - Proper timeout handling (30 seconds) to prevent hanging requests
  - Only redirects when controller returns valid login URL (no fallback redirects on error)
  - Supports both nested (`data.loginUrl`) and flat (`loginUrl`) response formats

- **Client token expiration checking** - Enhanced token validation with JWT expiration support
  - Improved `getClientToken()` to check JWT expiration claims when expiration timestamp is missing
  - Decodes JWT tokens to extract `exp` claim for expiration validation
  - Better logging for debugging token expiration issues
  - Handles missing expiration timestamps gracefully
  - Automatically removes expired tokens from cache

- **Auto-initialization improvements** - New utility for accessing cached configuration
  - New `getCachedDataClientConfig()` function exported from `src/index.ts`
  - Allows reading cached DataClient configuration without re-initializing
  - Useful for accessing configuration values in application code
  - Returns cached config or null if not found or expired

- **Controller URL validation utility** - Exported URL validation function
  - `validateUrl()` function now exported from `controller-url-resolver.ts`
  - Validates HTTP/HTTPS URLs with comprehensive JSDoc documentation
  - Useful for validating URLs before use in application code
  - Exported from `src/index.ts` for public use

### Changed

- **Documentation restructure** - Improved documentation organization and clarity
  - New reference documentation structure with dedicated files for each major component
  - Added `docs/reference-authentication.md` - Comprehensive authentication guide
  - Added `docs/reference-authorization.md` - RBAC and permissions documentation
  - Added `docs/reference-dataclient.md` - Complete DataClient API reference
  - Added `docs/reference-errors.md` - Error handling and troubleshooting guide
  - Added `docs/reference-misoclient.md` - MisoClient API reference
  - Added `docs/reference-services.md` - Service layer documentation
  - Added `docs/reference-types.md` - TypeScript type definitions reference
  - Added `docs/reference-utilities.md` - Utility functions documentation
  - Enhanced examples with improved clarity and error handling
  - Updated all example files with corrected import paths

- **DataClient enhancements** - Improved robustness and developer experience
  - Enhanced DataClient configuration and performance optimizations
  - Improved authorization examples and documentation
  - Better error handling in example code

- **Audit logging error handling** - Improved handling of network errors in audit logging
  - Enhanced error detection for network errors (ECONNREFUSED, ENOTFOUND, ERR_CONNECTION_REFUSED)
  - Silently skips audit logging for expected network errors (server unavailable, misconfigured)
  - Prevents error noise in development and demo environments
  - Better error classification and handling

### Fixed

- **DataClient metrics** - Fixed handling of missing response times in metrics
  - Modified `getMetrics()` method to handle cases where `responseTimes` may be undefined
  - Ensures robust performance metrics retrieval without errors

- **Example imports** - Fixed import paths in all example files
  - Updated example imports for clarity and proper error handling
  - Corrected script source references in demo applications

- **Cache service test handling** - Fixed cleanup interval keeping process alive in tests
  - Added `unref()` to cleanup interval in `CacheService` to prevent tests from hanging
  - Ensures Node.js process can exit cleanly after tests complete
  - Important for CI/CD environments and test suites

### Removed

- **Performance logging** - Removed deprecated performance logging functionality
  - Eliminated all performance logging code from the codebase
  - Removed PerformanceMetrics interface and related methods
  - Removed performance tracking logic from logger service
  - Functionality replaced by OpenTelemetry integration

### Technical

- **Code quality improvements** - Enhanced development workflow and configuration
  - Updated ESLint and Jest configurations for improved testing and code quality
  - Enhanced configuration files and scripts for better development workflow
  - Improved .gitignore patterns
  - Updated package.json for testing enhancements

- **New utility file**: `src/utils/data-client-redirect.ts` - Comprehensive redirect handling
  - Extracted redirect logic from DataClient into dedicated utility module
  - 424 lines of robust redirect handling with comprehensive error handling
  - URL validation, timeout handling, and user-friendly error messages
  - Proper separation of concerns for better maintainability

## [3.1.2] - 2025-12-15

### Changed

- **DataClient refactoring** - Improved code organization and maintainability
  - Extracted request execution logic into separate utility modules
  - Split DataClient into focused utility files: `data-client-request.ts`, `data-client-auth.ts`, `data-client-cache.ts`, `data-client-utils.ts`
  - Improved code organization and separation of concerns
  - Reduced code complexity in main DataClient class

### Fixed

- **TypeScript error handling** - Fixed TypeScript error in retry logic
  - Fixed type checking for error constructor name in authentication error detection
  - Improved error type safety in retry logic

### Technical

- **Code quality improvements** - Significant refactoring for better maintainability
  - Reduced DataClient.ts from ~1600 lines to ~500 lines through modularization
  - Improved test coverage and organization
  - Better separation of concerns between authentication, caching, and request execution

## [3.1.1] - 2025-12-15

### Fixed

- **DataClient retry logic** - Improved handling of 401 authentication errors in retry logic
  - Enhanced error type detection to prevent retries on authentication errors
  - Added explicit checks for AuthenticationError instances to ensure 401/403 errors are not retried
  - Improved statusCode extraction from error objects for more reliable retry decisions

## [3.1.0] - 2025-12-15

### Added

- **Public and Private Controller URL Support** - Separate URLs for browser and server environments
  - New `controllerPublicUrl` configuration option for browser/Vite environments (accessible from internet)
  - New `controllerPrivateUrl` configuration option for server environments (internal network access)
  - New `resolveControllerUrl()` utility function that automatically detects environment and selects appropriate URL
  - New `isBrowser()` utility function for environment detection (checks for window, localStorage, fetch globals)
  - Environment variable support: `MISO_WEB_SERVER_URL` (maps to `controllerPublicUrl` for browser)
  - Environment variable support: `MISO_CONTROLLER_URL` (maps to `controllerPrivateUrl` for server, maintains backward compatibility)
  - Automatic URL resolution based on environment:
    - Browser environment: Uses `controllerPublicUrl` → falls back to `controllerUrl`
    - Server environment: Uses `controllerPrivateUrl` → falls back to `controllerUrl`
  - URL validation ensures resolved URLs are valid HTTP/HTTPS URLs
  - Clear error messages when no URL is configured

### Changed

- **InternalHttpClient** - Now uses `resolveControllerUrl()` for automatic URL resolution
  - Constructor uses resolved URL instead of hardcoded `config.controllerUrl`
  - Client token fetch uses resolved URL for temporary axios instance
  - Maintains backward compatibility with existing `controllerUrl` configuration

- **AuthService** - Now uses `resolveControllerUrl()` for axios instance creation
  - Automatically selects appropriate URL based on environment
  - Maintains backward compatibility with existing configurations

- **Config Loader** - Enhanced environment variable parsing
  - `MISO_WEB_SERVER_URL` loads into `controllerPublicUrl` (browser/public)
  - `MISO_CONTROLLER_URL` loads into `controllerPrivateUrl` (server/private) and `controllerUrl` (backward compatibility)
  - Maintains existing behavior for applications using `MISO_CONTROLLER_URL`

- **Documentation** - Updated configuration documentation
  - Added sections for public/private URL configuration in `docs/configuration.md`
  - Added examples for browser and server setup patterns
  - Updated `docs/api-reference.md` with new utility functions and configuration options
  - Includes migration guide and usage examples

### Technical

- **New utility file**: `src/utils/controller-url-resolver.ts` - URL resolution with environment detection
  - `resolveControllerUrl()` function (35 lines, comprehensive JSDoc)
  - `isBrowser()` helper function (7 lines)
  - `validateUrl()` private helper function (7 lines)
  - 100% test coverage (28 tests in `tests/unit/controller-url-resolver.test.ts`)

- **Test coverage** - Comprehensive tests for URL resolution
  - Browser environment detection tests (mocked window, localStorage, fetch)
  - Server environment detection tests (no browser globals)
  - URL resolution priority tests (public → private → controllerUrl → error)
  - Backward compatibility tests (existing `controllerUrl` still works)
  - Environment variable parsing tests (`MISO_WEB_SERVER_URL`, `MISO_CONTROLLER_URL`)
  - URL validation tests (invalid URLs throw errors)
  - Updated `tests/unit/config-loader.test.ts` with 52 new test lines
  - Updated `tests/unit/http-client.test.ts` and `tests/unit/client.test.ts` with URL resolution tests

- **Exports updated**:
  - `src/index.ts` - Exports `resolveControllerUrl` and `isBrowser` utilities
  - Public API maintains camelCase naming convention

## [3.0.1] - 2025-12-14

### Fixed

- **DataClient audit logging bug** - Fixed 401 Unauthorized errors when audit logging unauthenticated requests
  - Added `hasClientToken()` and `hasAnyToken()` helper methods to check authentication status
  - `logAuditEvent()` now skips audit logging when no authentication token is available (user token OR client token)
  - Prevents circular dependency where login requests trigger audit logging that requires authentication
  - Gracefully handles audit logging errors without breaking main requests
  - Improved error handling for 401 errors in audit logging (silently skipped for unauthenticated requests)

### Changed

- **Documentation improvements** - Updated documentation files to match project style and improve clarity
  - `docs/api-reference.md` - Streamlined API documentation
  - `docs/configuration.md` - Reduced verbosity, focused on practical examples (reduced from ~1522 to ~785 lines)
  - `docs/data-client.md` - Improved clarity and consistency (reduced from ~1497 to ~926 lines)
  - `docs/examples.md` - Consolidated examples, removed redundancy (reduced from ~1014 to ~991 lines)
  - `docs/troubleshooting.md` - More action-oriented format, clearer solutions (reduced from ~965 to ~707 lines)
  - All documentation now follows consistent "You need to:" / "Here's how:" patterns
  - Removed jargon and technical verbosity
  - Added consistent "✅ Use standard .env parameters" patterns throughout

### Technical

- **Test coverage** - Added tests for audit logging skip behavior
  - Updated `tests/unit/data-client.test.ts` with 69 new lines of test coverage
  - Tests verify audit logging is skipped for unauthenticated requests
  - Tests verify audit logging still works for authenticated requests

## [3.0.0] - 2025-12-14

### Added

- **Configurable client token endpoint** - Customizable client token URI for authentication
  - New `clientTokenUri` configuration option in `MisoClientConfig` (defaults to `/api/v1/auth/token`)
  - Environment variable support: `MISO_CLIENT_TOKEN_URI`
  - Backward compatible with existing implementations
  - Used by `AuthService.getEnvironmentToken()` method

- **Origin validation for security** - CORS origin validation with wildcard port support
  - New `allowedOrigins` configuration option in `MisoClientConfig`
  - Environment variable support: `MISO_ALLOWED_ORIGINS` (comma-separated list)
  - Supports wildcard ports: `http://localhost:*` (matches any port)
  - New `validateOrigin()` utility function exported for use in miso-controller backend
  - Checks `origin` header first, falls back to `referer` header
  - Security-first approach: validates origin before calling controller

- **Server-side environment token wrapper** - Secure token fetching with origin validation
  - New `getEnvironmentToken()` server-side wrapper function
  - Validates request origin before calling controller
  - ISO 27001 compliant audit logging with masked client credentials
  - Logs error and audit events on validation failures
  - Exported from `src/index.ts` and `src/express/index.ts`

- **Client token decoding utility** - Extract application and environment info from tokens
  - New `extractClientTokenInfo()` utility function
  - Decodes JWT client tokens without verification (no secret available)
  - Supports multiple field name variations:
    - `application` or `app`
    - `environment` or `env`
    - `applicationId` or `app_id`
    - `clientId` or `client_id`
  - Returns `ClientTokenInfo` interface with optional fields
  - Exported from `src/index.ts` and `src/express/index.ts`

- **DataClient `getEnvironmentToken()` method** - Browser-side token fetching with caching
  - New public method for browser applications
  - Checks localStorage cache first (`miso:client-token` and `miso:client-token-expires-at`)
  - Fetches from backend endpoint if cache miss or expired
  - Uses `clientTokenUri` from config or defaults to `/api/v1/auth/client-token`
  - Supports absolute URLs and relative paths
  - Handles nested and flat response formats
  - ISO 27001 audit logging integration
  - Automatic cache expiration handling

- **DataClient `getClientTokenInfo()` method** - Extract token metadata in browser
  - New public method to extract application/environment info from client token
  - Checks cached token first, then config token
  - Returns `ClientTokenInfo` object or `null` if no token available
  - Useful for displaying current application/environment in UI
  - Handles decode errors gracefully

- **DataClient `logout()` method** - Logout functionality for browser applications
  - Calls controller logout API to invalidate server-side session
  - Clears authentication tokens from localStorage (all configured token keys)
  - Clears HTTP response cache
  - Redirects to logout URL or login page
  - Supports optional `redirectUrl` parameter for custom redirect after logout
  - Gracefully handles API failures (always clears local state)
  - SSR compatible (no-op in non-browser environments)

- **DataClient `logoutUrl` configuration** - Custom logout redirect URL
  - Optional `logoutUrl` property in `DataClientConfig`
  - Falls back to `loginUrl` config if not provided
  - Supports both relative paths and absolute URLs
  - Defaults to `/login` if neither `logoutUrl` nor `loginUrl` is configured

### Changed

- **AuthService `getEnvironmentToken()`** - Now uses configurable `clientTokenUri`
  - Changed from hardcoded `/api/v1/auth/token` to `this.config.clientTokenUri || '/api/v1/auth/token'`
  - Maintains backward compatibility (defaults to existing endpoint)
  - Existing error handling and correlation ID generation preserved

- **MisoClientConfig interface** - Added new configuration options
  - New optional property: `clientTokenUri?: string`
  - New optional property: `allowedOrigins?: string[]`

- **DataClient configuration** - Added `logoutUrl` option to `DataClientConfig` interface
  - New optional property: `logoutUrl?: string`
  - Follows same pattern as `loginUrl` configuration

### Technical

- **New utility files**:
  - `src/utils/origin-validator.ts` - Origin validation with wildcard port support
  - `src/utils/environment-token.ts` - Server-side wrapper with audit logging
  - `src/utils/token-utils.ts` - Client token decoding utility

- **New test files**:
  - `tests/unit/origin-validator.test.ts` - 22 tests covering origin validation
  - `tests/unit/token-utils.test.ts` - 20 tests covering token decoding
  - `tests/unit/environment-token.test.ts` - 10 tests covering server-side wrapper
  - Updated `tests/unit/data-client.test.ts` - Added 22 new tests
  - Updated `tests/unit/config-loader.test.ts` - Added 7 new tests
  - Updated `tests/unit/auth.service.test.ts` - Added 4 new tests

- **Exports updated**:
  - `src/index.ts` - Exports `validateOrigin`, `getEnvironmentToken`, `extractClientTokenInfo`, and types
  - `src/express/index.ts` - Exports same utilities for Express applications

- **Documentation updated**:
  - `docs/data-client.md` - Added sections for `getEnvironmentToken()` and `getClientTokenInfo()`
  - Includes browser usage examples, server-side route examples, configuration examples, and security best practices

## [2.2.1] - 2025-12-13

### Fixed

- **DataClient `redirectToLogin()`** - Fixed redirect to use controller login endpoint
  - Now calls controller's `/api/v1/auth/login` endpoint with redirect parameter
  - Properly constructs full redirect URL instead of relative path
  - Falls back to static loginUrl when misoClient is unavailable or controller call fails

### Changed

- **DataClient `redirectToLogin()`** - Enhanced with optional redirect URL parameter
  - Made method async to support controller API calls
  - Added optional `redirectUrl` parameter (defaults to current page URL)
  - Returns controller's login URL for proper OAuth flow handling

## [2.2.0] - 2025-12-13

### Added

- **DataClient Browser Wrapper** - Browser-compatible HTTP client wrapper around MisoClient
  - Enhanced HTTP client capabilities for React/front-end applications
  - ISO 27001 compliant audit logging with configurable levels (minimal, standard, detailed, full)
  - Automatic sensitive data masking using DataMasker before audit logging
  - Request/response interceptors for custom request/response transformation
  - Response caching with configurable TTL and cache size limits
  - Automatic retry logic with exponential backoff for retryable errors
  - Request deduplication for concurrent duplicate requests
  - Request metrics tracking (response times, error rates, cache hit rates)
  - Custom error types (NetworkError, TimeoutError, AuthenticationError)
  - Browser compatibility checks with SSR support
  - Token management from localStorage with multiple key support
  - Automatic login redirect on authentication errors
  - Support for all HTTP methods (GET, POST, PUT, PATCH, DELETE)
  - Request cancellation via AbortController
  - Per-request timeout support
  - Integration with MisoClient for authentication and audit logging
  - **Client Token Pattern** - Secure browser usage without exposing clientSecret
    - Support for server-provided client tokens (`clientToken`, `clientTokenExpiresAt`)
    - Token refresh callback pattern (`onClientTokenRefresh`) for browser applications
    - Automatic token refresh with proactive expiration handling (60s buffer)
    - Memory-only token storage (never persisted to localStorage)

### Changed

- **MisoClientConfig** - `clientSecret` is now optional when using client token pattern
  - Added `clientToken?: string` - Pre-obtained client token for browser usage
  - Added `clientTokenExpiresAt?: Date | string` - Token expiration tracking
  - Added `onClientTokenRefresh?: () => Promise<{ token: string; expiresIn: number }>` - Refresh callback
  - `InternalHttpClient` now supports both clientSecret (server-side) and clientToken (browser) patterns

## [2.1.2] - 2025-12-11

### Added

- **Express.js Utilities** - Complete set of utilities for building Express.js REST APIs
  - `ResponseHelper` - Standardized API response formatting (success, created, paginated, noContent, accepted)
  - `injectResponseHelpers` - Middleware to inject response helpers into Express Response
  - `asyncHandler` and `asyncHandlerNamed` - Automatic error handling for async route handlers
  - `ValidationHelper` - Common validation patterns (findOrFail, ensureNotExists, ensureOwnershipOrAdmin, etc.)
  - `AppError` - Application error class with RFC 7807 support
  - `handleRouteError` - Centralized error handling for Express routes
  - `setErrorLogger` - Injectable error logger for custom logging
  - `EncryptionUtil` - AES-256-GCM encryption utility (replaces EncryptionService)
  - Express Response type augmentation for TypeScript

- **Sort Utilities** - Client-side sorting helpers
  - `applySorting()` - Apply sorting to in-memory data arrays
  - `parseSortParams()` - Parse sort query parameters (already existed)

- **GitHub Workflows** - Manual release management
  - Manual Version Bump workflow - Bump version, create git tags, and GitHub Releases
  - Manual Publish to NPM workflow - Publish to npm with validation and verification

- **Package Configuration**
  - Express as optional peer dependency (^4.18.0 || ^5.0.0)
  - @types/express as dev dependency

- **Authentication API Updates**
  - `LoginResponse` and `LogoutResponse` types for standardized authentication responses
  - Updated `login()` method to make API call to `/api/v1/auth/login` with query parameters (redirect, state)
  - Updated `logout()` method to accept token parameter and make API call to `/api/v1/auth/logout`
  - Comprehensive test coverage for `response-middleware.ts` (100% coverage)

### Changed

- **Package Description** - Updated to include Express.js utilities
- **EncryptionService** - Replaced instance-based EncryptionService with static EncryptionUtil class
- **Workflow Strategy** - Removed automatic publish on push, added manual workflows for better control
- **Authentication Methods** - Breaking changes:
  - `login()` - Changed from synchronous method returning URL string to async method returning `LoginResponse` object
  - `logout()` - Now requires `{ token: string }` parameter and returns `LogoutResponse` object

### Removed

- Old automatic npm-publish workflow (replaced by manual workflows)
- EncryptionService class (replaced by EncryptionUtil)

## [2.0.0] - Previous Release

See git history for previous changes.
