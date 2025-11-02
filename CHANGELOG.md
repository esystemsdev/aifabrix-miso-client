# Changelog

All notable changes to the MisoClient SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2025-02-11

### Added

- **Pagination Utilities**: Complete pagination support for list responses
  - `Meta` and `PaginatedListResponse<T>` TypeScript interfaces for standardized paginated responses
  - `parse_pagination_params()` function to parse `page` and `page_size` query parameters
  - `create_meta_object()` function to construct pagination metadata objects
  - `apply_pagination_to_array()` function for local pagination in tests/mocks
  - `create_paginated_list_response()` function to wrap data with pagination metadata
  - Support for snake_case fields (`total_items`, `current_page`, `page_size`) matching Miso/Dataplane API conventions
  - Full type safety with TypeScript generics and interfaces

- **Filtering Utilities**: Comprehensive filtering support for API queries
  - `FilterOption`, `FilterQuery`, and `FilterBuilder` classes for building filter queries
  - `FilterOperator` type supporting: `eq`, `neq`, `in`, `nin`, `gt`, `lt`, `gte`, `lte`, `contains`, `like`
  - `parse_filter_params()` function to parse `filter=field:op:value` query parameters
  - `build_query_string()` function to convert `FilterQuery` objects to URL query strings
  - `apply_filters()` function for local filtering in tests/mocks
  - `FilterBuilder` class with fluent API for method chaining (e.g., `FilterBuilder().add('status', 'eq', 'active').add('region', 'in', ['eu', 'us'])`)
  - URL encoding support for field names and values (comma separators preserved for array values)
  - Integration with `/metadata/filter` endpoint through `FilterBuilder` compatibility

- **Sorting Utilities**: Sort parameter parsing and building
  - `SortOption` TypeScript interface with `field` and `order` (asc/desc) properties
  - `parse_sort_params()` function to parse `sort=-field` query parameters
  - `build_sort_string()` function to convert `SortOption` arrays to query string format
  - Support for multiple sort fields with ascending/descending order
  - URL encoding for field names with special characters

- **Error Handling Utilities**: Enhanced error response transformation and handling
  - `transform_error_to_snake_case()` function for converting errors to `ErrorResponseSnakeCase` objects
  - `handle_api_error_snake_case()` function for creating `ApiErrorException` from API error responses
  - `ApiErrorException` class extending `Error` with snake_case properties matching Miso/Dataplane API conventions
  - Support for both camelCase and snake_case field names in error responses (backward compatible)
  - Automatic parameter handling with graceful fallbacks for missing optional fields

- **HTTP Client Enhancements**: New helper methods for filtered and paginated requests
  - `getWithFilters()` method for making GET requests with `FilterBuilder` support
  - `getPaginated()` method for making GET requests with pagination parameters
  - Automatic query string building from filter/sort/pagination options
  - Flexible response parsing with TypeScript generics

- **ErrorResponse Type Enhancements**:
  - Added `ErrorResponseSnakeCase` interface with `request_key` field for error tracking
  - Added `ErrorEnvelope` interface for wrapping error responses
  - Made `title` field optional for graceful handling of missing titles
  - Full support for snake_case (`status_code`, `request_key`) matching Miso/Dataplane API conventions

- **Module Exports**: All new types and utilities exported from main module
  - Pagination: `Meta`, `PaginatedListResponse`, `parse_pagination_params`, `create_meta_object`, `apply_pagination_to_array`, `create_paginated_list_response`
  - Filtering: `FilterOperator`, `FilterOption`, `FilterQuery`, `FilterBuilder`, `parse_filter_params`, `build_query_string`, `apply_filters`
  - Sorting: `SortOption`, `parse_sort_params`, `build_sort_string`
  - Error: `ErrorResponseSnakeCase`, `ErrorEnvelope`, `ApiErrorException`, `transform_error_to_snake_case`, `handle_api_error_snake_case`
  - All utilities follow snake_case naming convention matching Miso/Dataplane API conventions

### Changed

- **ErrorResponse Handling**: Enhanced to support snake_case error responses alongside existing camelCase format
  - New `ErrorResponseSnakeCase` interface for snake_case API responses
  - `transform_error_to_snake_case()` handles both formats for backward compatibility
  - `ApiErrorException` uses snake_case properties (`status_code`, `request_key`) matching API conventions

### Technical Improvements

- **Type Safety**: Full TypeScript typing throughout all new utilities and interfaces
- **Strict Type Checking**: All new code uses strict TypeScript configuration
- **URL Encoding**: Smart encoding that preserves comma delimiters in array filter values
- **Comprehensive Tests**: Full test coverage for all new utilities with 95%+ coverage
- **Documentation**: Complete JSDoc comments and type definitions for all public APIs
- **Snake_case Convention**: All new utilities follow snake_case naming to match Miso/Dataplane API conventions

### Documentation

- Added comprehensive README section for pagination, filtering, and sorting utilities
- Usage examples for all utilities including combined usage patterns
- Integration examples with filtering and pagination
- Type definitions and JSDoc comments for all public APIs

---

## [1.4.0] - 2025-01-11

### Added

- **ISO 27001 Compliant HTTP Client with Automatic Audit and Debug Logging**: Enhanced public `HttpClient` class with automatic ISO 27001 compliant audit and debug logging
  - Automatic audit logging for all HTTP requests (`http.request.{METHOD}` format)
  - Debug logging when `log_level === 'debug'` with detailed request/response information
  - Automatic data masking using `DataMasker` before logging (ISO 27001 compliant)
  - All request headers are masked (Authorization, x-client-token, Cookie, etc.)
  - All request bodies are recursively masked for sensitive fields (password, token, secret, SSN, etc.)
  - All response bodies are masked (limited to first 1000 characters)
  - Query parameters are automatically masked
  - Error messages are masked if they contain sensitive data
  - Sensitive endpoints (`/api/logs`, `/api/auth/token`) are excluded from audit logging to prevent infinite loops
  - JWT user ID extraction from Authorization headers for audit context
  - Request duration tracking for performance monitoring
  - Request/response size tracking for observability

- **JSON Configuration Support for DataMasker**: Enhanced `DataMasker` with JSON configuration file support for sensitive fields
  - New `sensitive_fields_config.json` file with default ISO 27001 compliant sensitive fields
  - Categories: authentication, pii, security
  - Support for custom configuration path via `MISO_SENSITIVE_FIELDS_CONFIG` environment variable
  - `DataMasker.setConfigPath()` method for programmatic configuration
  - Automatic merging of JSON fields with hardcoded defaults (fallback if JSON cannot be loaded)
  - Backward compatible - existing hardcoded fields still work as fallback

- **New InternalHttpClient Class**: Separated core HTTP functionality into `InternalHttpClient` class
  - Pure HTTP functionality with automatic client token management (no logging)
  - Used internally by public `HttpClient` for actual HTTP requests
  - Used by `LoggerService` for sending logs to prevent circular dependencies
  - Not exported in public API (internal use only)
  - Comprehensive test coverage (95.7% coverage)

- **New sensitive_fields_loader Module**: Utility module for loading and merging sensitive fields configuration
  - `loadSensitiveFieldsConfig()` function for loading JSON configuration
  - `getSensitiveFieldsArray()` function for flattened sensitive fields list
  - `getFieldPatterns()` function for pattern matching rules
  - Support for custom configuration paths via environment variables

### Changed

- **HttpClient Architecture**: Public `HttpClient` now wraps `InternalHttpClient` with logging
  - `HttpClient` delegates HTTP requests to `InternalHttpClient`
  - `HttpClient` adds audit and debug logging layer
  - All services continue to use `HttpClient` with automatic logging
  - No breaking changes to public API

- **LoggerService Architecture**: `LoggerService` now uses `InternalHttpClient` instead of `HttpClient`
  - Prevents circular dependency (LoggerService uses InternalHttpClient for log sending)
  - Handled automatically by `MisoClient` constructor - no changes needed for typical usage

- **MisoClient Architecture**: Updated `MisoClient` constructor to use new HttpClient architecture
  - Creates `InternalHttpClient` first (pure HTTP functionality)
  - Creates `LoggerService` with `InternalHttpClient` (prevents circular dependency)
  - Creates public `HttpClient` wrapping `InternalHttpClient` with logger (adds audit/debug logging)
  - All services now use public `HttpClient` with automatic audit logging

- **DataMasker Enhancement**: Updated `DataMasker` to load sensitive fields from JSON configuration
  - Maintains backward compatibility with hardcoded fields as fallback
  - Automatic loading on first use with caching
  - Support for custom configuration paths

### ISO 27001 Compliance Features

- **Automatic Data Masking**: All sensitive data is automatically masked before logging
  - Request headers: Authorization, x-client-token, Cookie, Set-Cookie, and any header containing sensitive keywords
  - Request bodies: Recursively masks password, token, secret, SSN, creditcard, CVV, PIN, OTP, API keys, etc.
  - Response bodies: Especially important for error responses that might contain sensitive data
  - Query parameters: Automatically extracted and masked
  - Error messages: Masked if containing sensitive data

- **Audit Log Structure**: Standardized audit log format for all HTTP requests
  - Action: `http.request.{METHOD}` (e.g., `http.request.GET`, `http.request.POST`)
  - Resource: Request URL path
  - Context: method, url, statusCode, duration, userId, requestSize, responseSize, error (all sensitive data masked)

- **Debug Log Structure**: Detailed debug logging when `log_level === 'debug'`
  - All audit context fields plus: requestHeaders, responseHeaders, requestBody, responseBody (all masked)
  - Additional context: baseURL, timeout, queryParams (all sensitive data masked)

### Technical Improvements

- Improved error handling: Logging errors never break HTTP requests (all errors caught and swallowed)
- Performance: Async logging that doesn't block request/response flow
- Safety: Sensitive endpoints excluded from audit logging to prevent infinite loops
- Flexibility: Configurable sensitive fields via JSON configuration file
- Test Coverage: Comprehensive test coverage for `InternalHttpClient` (95.7% coverage)

---

## [1.3.0] - 2025-17-10

### Added

- **Structured Error Response Interface**: Added generic `ErrorResponse` interface following RFC 7807-style format for consistent error handling across applications
  - `ErrorResponse` TypeScript interface with fields: `errors`, `type`, `title`, `statusCode`, `instance`
  - Automatic parsing of structured error responses from HTTP responses in `HttpClient`
  - Support for both camelCase (`statusCode`) and snake_case (`status_code`) field names
  - `MisoClientError` now includes optional `errorResponse` field with structured error information
  - Enhanced error messages automatically generated from structured error responses
  - Instance URI automatically extracted from request URL when not provided in response
  - Backward compatible - falls back to traditional `errorBody` object when structured format is not available
  - Export `ErrorResponse` from main module for reuse in other applications
  - Comprehensive test coverage for error response parsing and fallback behavior
  - Full type safety with TypeScript interfaces

### Changed

- **Error Handling**: `MisoClientError` now prioritizes structured error information when available
  - Error messages are automatically enhanced from structured error responses
  - Status codes are extracted from structured responses when provided

---

## [1.2.5] - 2025-16-10

### Added

- **API_KEY Support for Testing**: Added optional `API_KEY` environment variable that allows bypassing OAuth2 authentication for testing purposes
  - When `API_KEY` is set in environment, bearer tokens matching the key will automatically validate without OAuth2
  - `validateToken()` returns `true` for matching API_KEY tokens without calling controller
  - `getUser()` and `getUserInfo()` return `null` when using API_KEY (by design for testing scenarios)
  - Configuration supports `apiKey` field in `MisoClientConfig`
  - Comprehensive test coverage for API_KEY authentication flows
  - Useful for testing without requiring Keycloak setup

### Changed

- **Development Workflow**: Improved development experience with better tooling
  - Enhanced npm scripts for testing and validation
  - Improved TypeScript compilation with strict type checking

### Testing

- Added comprehensive test suite for API_KEY functionality
  - Tests for `validateToken()` with API_KEY matching and non-matching scenarios
  - Tests for `getUser()` and `getUserInfo()` with API_KEY
  - Tests for config loader API_KEY loading
  - All tests verify OAuth2 fallback behavior when API_KEY doesn't match

---

## [1.2.0] - 2025-15-10

### Added

- **Automatic Client Token Management in HttpClient**: Client tokens are now automatically fetched, cached, and refreshed by the HttpClient
  - Proactive token refresh when < 60 seconds until expiry (30 second buffer before actual expiration)
  - Automatic `x-client-token` header injection for all requests
  - Concurrent token fetch prevention using async locks
  - Automatic token clearing on 401 responses to force refresh

- **New Data Models**:
  - `ClientTokenResponse`: Response interface for client token requests with expiration tracking
  - `PerformanceMetrics`: Performance metrics interface for logging (start time, end time, duration, memory usage)
  - `ClientLoggingOptions`: Advanced logging options with JWT context extraction, correlation IDs, data masking, and performance metrics support

- **RedisConfig Enhancement**:
  - Added `db` field to specify Redis database number (default: 0)
  - Supports multi-database Redis deployments

### Changed

- **HttpClient Improvements**:
  - Client token management is now fully automatic - no manual token handling required
  - Better error handling with automatic token refresh on authentication failures
  - All HTTP methods (GET, POST, PUT, DELETE) now automatically include client token header

### Technical Improvements

- Improved token expiration handling with proactive refresh mechanism
- Reduced API calls through intelligent token caching
- Better concurrency handling with async locks for token operations
- Enhanced error recovery with automatic token clearing on 401 responses

---

## [1.1.0] - 2005-01-10

### Added

- **Initial Release**: Complete MisoClient SDK implementation
- **Authentication**: JWT token validation and user management
- **Authorization**: Role-based access control (RBAC) with Redis caching
- **Permissions**: Fine-grained permission management with caching
- **Logging**: Structured logging with Redis queuing and HTTP fallback
- **Redis Integration**: Optional Redis caching for improved performance
- **TypeScript Support**: Full TypeScript support with type definitions
- **Type Safety**: Complete TypeScript interfaces and strict type checking
- **Graceful Degradation**: Works with or without Redis
- **Comprehensive Documentation**: Complete API reference and integration guides
- **Unit Tests**: Full test coverage mirroring Python implementation

### Features

#### Core Client
- `MisoClient` main class with initialization and lifecycle management
- Configuration management with `MisoClientConfig` and `RedisConfig`
- Connection state tracking and graceful fallback

#### Authentication Service
- Token validation with controller integration
- User information retrieval
- Login URL generation for web applications
- Logout functionality

#### Role Service
- Role retrieval with Redis caching (15-minute TTL)
- Role checking methods: `hasRole`, `hasAnyRole`, `hasAllRoles`
- Role refresh functionality to bypass cache
- Cache key management with user/environment/application scoping

#### Permission Service
- Permission retrieval with Redis caching (15-minute TTL)
- Permission checking methods: `hasPermission`, `hasAnyPermission`, `hasAllPermissions`
- Permission refresh functionality to bypass cache
- Cache clearing functionality
- Cache key management with user/environment/application scoping

#### Logger Service
- Structured logging with multiple levels: `info`, `error`, `audit`, `debug`
- Redis queue integration for log batching
- HTTP fallback when Redis is unavailable
- Context-aware logging with metadata support
- Fluent API for method chaining

#### HTTP Client
- HTTP client wrapper using Axios
- Automatic header injection (X-Environment, X-Application)
- Authenticated request support with Bearer token
- Error handling and status code management
- Automatic client token management

#### Redis Service
- Redis integration using ioredis
- Graceful degradation when Redis is unavailable
- Connection state tracking
- Key prefix support for multi-tenant environments

#### Encryption Service
- AES-256-GCM encryption/decryption
- Secure key management
- Integration with Redis caching

#### Cache Service
- High-level caching abstraction
- Redis-backed caching with fallback
- TTL support and cache invalidation

### Data Models

- `UserInfo`: User information from token validation
- `AuthResult`: Authentication result structure
- `LogEntry`: Structured log entry format
- `RoleResult`: Role query result
- `PermissionResult`: Permission query result
- `MisoClientConfig`: Main client configuration
- `RedisConfig`: Redis connection configuration

### Integration Examples

- **Express**: Complete integration with middleware and route handlers
- **Next.js**: Server-side and API route integration
- **Custom Applications**: Dependency injection and service patterns

### Documentation

- **README.md**: Comprehensive SDK documentation with quick start guide
- **API Reference**: Detailed method signatures and parameter descriptions
- **Integration Guide**: Framework-specific integration examples
- **Changelog**: Version history and feature tracking

### Testing

- **Unit Tests**: Comprehensive test coverage for all services
- **Mock Support**: Mock implementations for testing
- **Error Handling**: Test coverage for error scenarios and edge cases
- **Performance Tests**: Concurrent operation testing

### Package Management

- **package.json**: Standard npm package configuration
- **TypeScript Configuration**: Strict type checking with tsconfig.json
- **Dependencies**: axios, ioredis, jsonwebtoken, dotenv
- **Development Dependencies**: jest, typescript, eslint, prettier
- **Node.js Support**: Node.js 14+ compatibility

### Security

- **Token Handling**: Secure JWT token processing
- **Redis Security**: Password and key prefix support
- **Logging Security**: Careful handling of sensitive information
- **Error Handling**: Graceful error handling without information leakage
- **Data Masking**: Automatic masking of sensitive data in logs

### Performance

- **Caching**: Redis-based caching for roles and permissions
- **Connection Pooling**: Efficient HTTP and Redis connection management
- **Async Operations**: Non-blocking async/await throughout
- **Batch Operations**: Support for concurrent operations

### Compatibility

- **Node.js Versions**: 14, 16, 18, 20+
- **Framework Support**: Express, Next.js, and custom applications
- **Redis Versions**: Compatible with Redis 5.0+
- **HTTP Clients**: Uses Axios for modern HTTP support

### Migration

- **From Keycloak**: Seamless migration from direct Keycloak integration
- **Backward Compatibility**: Maintains existing API patterns
- **Configuration**: Simple configuration migration
- **Testing**: Comprehensive migration testing support

---

## Future Releases

### Planned Features

- **WebSocket Support**: Real-time authentication updates
- **Metrics Integration**: Prometheus and OpenTelemetry support
- **Advanced Caching**: Cache invalidation strategies
- **Multi-Controller Support**: Load balancing across multiple controllers
- **SDK Extensions**: Framework-specific SDK extensions

### Roadmap

- **v1.7.0**: Enhanced filtering and search capabilities
- **v1.8.0**: WebSocket support and real-time updates
- **v2.0.0**: Multi-controller support and load balancing
- **v2.1.0**: Framework-specific SDK extensions

---

For more information about the MisoClient SDK, visit:
- [Documentation](https://docs.aifabrix.ai/miso-client-typescript)
- [GitHub Repository](https://github.com/esystemsdev/aifabrix-miso-client)
- [Issue Tracker](https://github.com/esystemsdev/aifabrix-miso-client/issues)
- [npm Package](https://www.npmjs.com/package/@aifabrix/miso-client)

