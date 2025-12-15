# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
