# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] - 2025-12-14

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
