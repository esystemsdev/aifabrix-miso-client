# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
