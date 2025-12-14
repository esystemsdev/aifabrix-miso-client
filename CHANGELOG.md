# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2025-12-14

### Added

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

- **DataClient configuration** - Added `logoutUrl` option to `DataClientConfig` interface
  - New optional property: `logoutUrl?: string`
  - Follows same pattern as `loginUrl` configuration

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
