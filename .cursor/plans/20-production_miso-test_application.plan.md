# Production-Ready Miso-Test Application

## Overview

Build a comprehensive demonstration application in `server/` folder that showcases all DataClient capabilities. The application will be standalone and independent from the builder configuration (builder is only used for deployment via `@aifabrix/builder`).

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns - HTTP Client Pattern](.cursor/rules/project-rules.mdc#http-client-pattern)** - Token management, client token handling, authenticated requests
- **[Architecture Patterns - Token Management](.cursor/rules/project-rules.mdc#token-management)** - Client token vs user token, header formats, security
- **[Architecture Patterns - API Endpoints](.cursor/rules/project-rules.mdc#api-endpoints)** - Controller endpoint patterns, `/api` prefix
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-size-guidelines)** - File size limits (≤500 lines), method size limits (≤20-30 lines), JSDoc documentation
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, coverage requirements (≥80%)
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Never expose clientSecret in browser code, proper CORS, token handling
- **[Code Style - Error Handling](.cursor/rules/project-rules.mdc#error-handling)** - Return empty arrays on errors, use try-catch for async operations
- **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - Strict mode, interfaces over types, naming conventions
- **[Code Style - Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions)** - camelCase for all public API outputs, no snake_case
- **[Configuration](.cursor/rules/project-rules.mdc#configuration)** - Environment variables, config types, `loadConfig()` helper

**Key Requirements**:

- Never expose `clientSecret` in browser/client-side code (use server-provided client token pattern)
- Client token sent as `x-client-token` header (lowercase)
- User token sent as `Authorization: Bearer <token>` header
- Always use try-catch for async operations
- Return empty arrays `[]` on service method errors
- Keep files ≤500 lines and methods ≤20-30 lines
- Add JSDoc comments for all public functions
- Write tests with Jest, mock all external dependencies
- Achieve ≥80% test coverage for new code
- All public API outputs use camelCase (no snake_case)
- Use `/api` prefix for controller endpoints
- Proper CORS configuration with origin validation
- Use `loadConfig()` helper for environment variables

## Before Development

- [ ] Read Architecture Patterns - HTTP Client Pattern and Token Management sections from project-rules.mdc
- [ ] Review Security Guidelines section (critical for browser code)
- [ ] Review existing Express utilities in `src/express/` for patterns
- [ ] Review DataClient implementation in `src/utils/data-client.ts` for browser-safe patterns
- [ ] Review error handling patterns in existing codebase
- [ ] Understand testing requirements and mock patterns
- [ ] Review JSDoc documentation patterns
- [ ] Review CORS and origin validation patterns
- [ ] Understand environment variable loading with `loadConfig()`
- [ ] Review browser bundling approaches (current vs proper bundling)

## Architecture

```text
server/
├── src/
│   ├── server.ts              # Main Express server
│   ├── routes/
│   │   ├── api.ts             # API endpoints for testing DataClient
│   │   └── health.ts          # Health check endpoint
│   ├── middleware/
│   │   ├── cors.ts            # CORS configuration
│   │   └── error-handler.ts   # Error handling middleware
│   └── config/
│       └── env.ts             # Environment configuration loader
├── public/
│   ├── index.html             # Main demo UI page
│   ├── assets/
│   │   └── app.js             # Frontend JavaScript (DataClient demos)
│   └── styles.css             # UI styling
├── tsconfig.json              # TypeScript config (standalone)
├── package.json               # Dependencies (standalone)
└── README.md                  # Application documentation
```

## Implementation Plan

### 1. Server Infrastructure (`server/src/`)

**server/src/server.ts**

- Express server setup with proper middleware
- MisoClient initialization using `loadConfig()` from parent package
- Serve static files from `public/` directory
- Client token endpoint: `POST /api/v1/auth/client-token`
- Health check endpoint: `GET /health`
- Error handling middleware
- Graceful shutdown handling

**server/src/routes/api.ts**

- Mock API endpoints for DataClient testing:
  - `GET /api/users` - List users (demonstrates GET with caching)
  - `GET /api/users/:id` - Get user by ID
  - `POST /api/users` - Create user (demonstrates POST)
  - `PUT /api/users/:id` - Update user (demonstrates PUT)
  - `PATCH /api/users/:id` - Partial update (demonstrates PATCH)
  - `DELETE /api/users/:id` - Delete user (demonstrates DELETE)
  - `GET /api/metrics` - Return mock metrics
  - `GET /api/slow` - Slow endpoint (for timeout/retry testing)
  - `GET /api/error/:code` - Error endpoint (for error handling testing)

**server/src/middleware/cors.ts**

- CORS configuration with proper origin validation (Security Guidelines)
- Support for `MISO_ALLOWED_ORIGINS` environment variable (Configuration section)
- Use `validateOrigin()` utility from `@aifabrix/miso-client` if available
- JSDoc comments for all functions (Code Quality Standards)

**server/src/middleware/error-handler.ts**

- Centralized error handling
- Proper error response formatting

**server/src/config/env.ts**

- Environment variable loader
- Default values for development
- Validation of required variables

### 2. Frontend UI (`server/public/`)

**server/public/index.html**

- Modern, responsive UI demonstrating all DataClient features
- Sections for:
  - **Configuration** - Display and configure DataClient settings
  - **Authentication** - `isAuthenticated()`, `redirectToLogin()`, `logout()`, `getEnvironmentToken()`, `getClientTokenInfo()`
  - **HTTP Methods** - `get()`, `post()`, `put()`, `patch()`, `delete()`
  - **Caching** - Cache configuration and `clearCache()`
  - **Retry Logic** - Retry configuration and testing
  - **Interceptors** - Request/response/error interceptors
  - **Metrics** - `getMetrics()` display
  - **Audit Logging** - Audit configuration and testing
  - **Error Handling** - Network errors, timeouts, API errors

**server/public/assets/app.js**

- DataClient initialization (browser-safe, no clientSecret - Security Guidelines)
- Use server-provided client token pattern (`clientTokenUri` endpoint)
- Never include `clientSecret` in browser code (Security Guidelines)
- UI event handlers for all demo buttons
- Response display and error handling (try-catch for all async operations)
- Code examples shown for each method
- Real-time metrics display
- Proper error handling with user-friendly messages

**server/public/styles.css**

- Modern, clean design
- Responsive layout
- Code syntax highlighting
- Status indicators (success/error/loading)

### 3. DataClient Bundling

**Option A: Use existing dist build**

- Serve DataClient from `dist/utils/data-client.js` (current approach)
- Wrap in IIFE for browser compatibility
- Include fallback if build not available

**Option B: Create browser bundle** (Recommended for production)

- Use esbuild/rollup to create proper browser bundle
- Include all dependencies
- Minified for production
- Source maps for development

### 4. Standalone Configuration

**server/package.json**

- Independent package.json with:
  - Express and required dependencies
  - TypeScript and build tools
  - Scripts: `dev`, `build`, `start`, `test`
  - Reference to parent `@aifabrix/miso-client` package

**server/tsconfig.json**

- Standalone TypeScript configuration
- References parent package types
- Output to `server/dist/`

**server/.env.example**

- Example environment variables
- Documentation for each variable
- Default values for local development

**server/README.md**

- Application documentation
- Setup instructions
- API documentation
- DataClient feature demonstrations
- Troubleshooting guide

### 5. Features to Demonstrate

#### Authentication & Authorization

- `isAuthenticated()` - Check auth status
- `redirectToLogin()` - Redirect to login flow
- `logout()` - Logout and clear tokens
- `getEnvironmentToken()` - Get client token
- `getClientTokenInfo()` - Extract token info

#### HTTP Methods

- `get()` - With caching options
- `post()` - With data and options
- `put()` - Full resource update
- `patch()` - Partial update
- `delete()` - Resource deletion

#### Advanced Features

- **Caching**: Enable/disable, custom TTL, cache keys, `clearCache()`
- **Retry Logic**: Configure retries, test retry scenarios
- **Interceptors**: Request, response, error interceptors
- **Metrics**: `getMetrics()` - request counts, response times, cache hits
- **Audit Logging**: Configure audit levels, test audit events
- **Error Handling**: Network errors, timeouts, API errors

#### Configuration Options

- `baseUrl` - API base URL
- `misoConfig` - Controller URL, client ID, token URI
- `cache` - Cache configuration
- `retry` - Retry configuration
- `audit` - Audit configuration
- `timeout` - Request timeout
- `tokenKeys` - Custom token keys

### 6. Production Considerations

- **Error Handling**: Comprehensive error handling on both server and client
- **Logging**: Proper logging for debugging
- **Security**: No clientSecret in browser code, proper CORS
- **Performance**: Efficient bundling, lazy loading if needed
- **Documentation**: Inline code comments, README, API docs
- **Testing**: Test endpoints for all scenarios

## File Structure

```text
server/
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── api.ts
│   │   └── health.ts
│   ├── middleware/
│   │   ├── cors.ts
│   │   └── error-handler.ts
│   └── config/
│       └── env.ts
├── public/
│   ├── index.html
│   ├── assets/
│   │   └── app.js
│   └── styles.css
├── dist/                    # Compiled output
├── tsconfig.json
├── package.json
├── .env.example
└── README.md
```

## Dependencies

**Runtime:**

- `express` - Web server
- `@aifabrix/miso-client` - Parent package (imported)

**Development:**

- `typescript` - TypeScript compiler
- `ts-node` - TypeScript execution
- `@types/express` - TypeScript types
- `@types/node` - Node.js types

**Build (Optional):**

- `esbuild` or `rollup` - Browser bundling
- `concurrently` - Run multiple scripts

## Environment Variables

- `PORT` - Server port (default: 3083)
- `MISO_CONTROLLER_URL` - Controller URL
- `MISO_CLIENTID` - Client ID
- `MISO_CLIENTSECRET` - Client secret (server-side only)
- `MISO_ALLOWED_ORIGINS` - CORS allowed origins
- `NODE_ENV` - Environment (development/production)

## Implementation Steps

1. Create server infrastructure (Express, routes, middleware)

   - Follow Architecture Patterns for Express utilities
   - Follow Error Handling patterns (try-catch, return empty arrays)
   - Add JSDoc comments for all public functions
   - Keep files ≤500 lines and methods ≤20-30 lines

2. Create mock API endpoints for testing

   - Use `/api` prefix for endpoints (API Endpoints pattern)
   - Follow error handling patterns
   - Add JSDoc comments

3. Build comprehensive HTML/JS UI

   - Browser-safe DataClient initialization (no clientSecret)
   - Use server-provided client token pattern
   - Proper error handling with try-catch

4. Set up DataClient bundling for browser

   - Ensure no clientSecret in bundled code (Security Guidelines)
   - Proper browser compatibility

5. Add standalone configuration (package.json, tsconfig.json)

   - Use `loadConfig()` helper for environment variables
   - Proper TypeScript configuration (strict mode)

6. Create documentation and examples

   - Update `server/README.md` with setup instructions
   - Document all API endpoints
   - Document DataClient feature demonstrations
   - Include troubleshooting guide

7. Test all DataClient features

   - Write tests with Jest (Testing Conventions)
   - Mock all external dependencies
   - Test both success and error paths
   - Achieve ≥80% test coverage

8. Add error handling and logging

   - Follow Error Handling patterns
   - Comprehensive error handling on both server and client
   - Proper logging for debugging

9. Production optimizations

   - Security review (no clientSecret in browser)
   - Performance optimizations
   - Error handling review

10. **Validation**: Run BUILD → LINT → TEST (mandatory sequence)

    - `npm run build` (must complete successfully)
    - `npm run lint` (must pass with zero errors/warnings)
    - `npm test` (all tests must pass, ≥80% coverage)

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs TypeScript compilation)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, methods ≤20-30 lines
6. **JSDoc Documentation**: All public functions have JSDoc comments
7. **Code Quality**: All rule requirements met
8. **Security**:

   - No `clientSecret` in browser/client-side code
   - Proper CORS configuration with origin validation
   - Client token sent as `x-client-token` header (lowercase)
   - User token sent as `Authorization: Bearer <token>` header

9. **Error Handling**:

   - Return empty arrays `[]` on service method errors
   - Use try-catch for all async operations
   - Comprehensive error handling on both server and client

10. **Configuration**:

    - Use `loadConfig()` helper for environment variables
    - Proper environment variable validation
    - Default values for development

11. **Documentation**:

    - Update `server/README.md` with setup instructions
    - Document all API endpoints
    - Document DataClient feature demonstrations
    - Include troubleshooting guide
    - Add inline code comments

12. **Testing**:

    - Test endpoints for all scenarios
    - Mock all external dependencies
    - Test both success and error paths
    - Test CORS and origin validation
    - Test client token endpoint

13. **All Tasks Completed**: All implementation steps completed
14. **Standalone Application**: Independent from builder (builder only for deployment)
15. **Production Ready**: Error handling, logging, security, performance optimizations

## Success Criteria

- ✅ All DataClient methods demonstrated and working
- ✅ Clean, modern UI with real-time feedback
- ✅ Standalone application (independent from builder)
- ✅ Production-ready error handling
- ✅ Comprehensive documentation
- ✅ Easy to run locally (`npm install && npm run dev`)
- ✅ Can be deployed via builder (`aifabrix build miso-test`)
- ✅ All DoD requirements met
- ✅ All rule requirements complied with

---

## Plan Validation Report

**Date**: 2024-12-19
**Plan**: `.cursor/plans/20-production_miso-test_application.plan.md`
**Status**: ✅ VALIDATED

### Plan Purpose

Build a comprehensive demonstration application in `server/` folder that showcases all DataClient capabilities. The application will be standalone and independent from the builder configuration. This is an **Application Development** plan that includes Express server setup, API endpoints, frontend UI (HTML/JS), DataClient bundling, configuration management, error handling, CORS, and documentation.

**Scope**: Express utilities, HTTP client integration, frontend integration, configuration, security, testing, documentation

**Type**: Application Development (demo/test application)

### Applicable Rules

- ✅ **[Architecture Patterns - HTTP Client Pattern](.cursor/rules/project-rules.mdc#http-client-pattern)** - Token management, client token handling, authenticated requests (applies because plan uses DataClient and HTTP client patterns)
- ✅ **[Architecture Patterns - Token Management](.cursor/rules/project-rules.mdc#token-management)** - Client token vs user token, header formats, security (applies because plan implements client token endpoint and browser-safe token handling)
- ✅ **[Architecture Patterns - API Endpoints](.cursor/rules/project-rules.mdc#api-endpoints)** - Controller endpoint patterns, `/api` prefix (applies because plan creates API endpoints)
- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-size-guidelines)** - File size limits (≤500 lines), method size limits (≤20-30 lines), JSDoc documentation (MANDATORY - applies to all plans)
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, coverage requirements (≥80%) (MANDATORY - applies to all plans)
- ✅ **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Never expose clientSecret in browser code, proper CORS, token handling (MANDATORY - critical for browser code)
- ✅ **[Code Style - Error Handling](.cursor/rules/project-rules.mdc#error-handling)** - Return empty arrays on errors, use try-catch for async operations (applies because plan implements error handling)
- ✅ **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - Strict mode, interfaces over types, naming conventions (applies because plan uses TypeScript)
- ✅ **[Code Style - Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions)** - camelCase for all public API outputs, no snake_case (applies because plan creates API endpoints)
- ✅ **[Configuration](.cursor/rules/project-rules.mdc#configuration)** - Environment variables, config types, `loadConfig()` helper (applies because plan uses environment variables and configuration)

### Rule Compliance

- ✅ **DoD Requirements**: Documented with BUILD → LINT → TEST validation order
- ✅ **Architecture Patterns**: HTTP Client Pattern, Token Management, API Endpoints referenced
- ✅ **Code Quality Standards**: File size limits, JSDoc documentation requirements included
- ✅ **Testing Conventions**: Jest patterns, test structure, coverage requirements (≥80%) included
- ✅ **Security Guidelines**: Browser-safe patterns, no clientSecret in browser code, proper CORS documented
- ✅ **Error Handling**: Try-catch patterns, return empty arrays on errors documented
- ✅ **TypeScript Conventions**: Strict mode, naming conventions referenced
- ✅ **Configuration**: `loadConfig()` helper, environment variables documented

### Plan Updates Made

- ✅ Added **Rules and Standards** section with 10 applicable rule sections and key requirements
- ✅ Added **Before Development** checklist with 10 preparation steps
- ✅ Updated **Definition of Done** section with 15 comprehensive requirements including:
  - Build, lint, test validation order (BUILD → LINT → TEST)
  - File size limits (≤500 lines, methods ≤20-30 lines)
  - JSDoc documentation requirements
  - Security requirements (no clientSecret in browser, proper CORS)
  - Error handling requirements
  - Configuration requirements
  - Documentation requirements
  - Testing requirements
- ✅ Updated **Implementation Steps** with rule-specific guidance
- ✅ Updated **server/src/server.ts** section with rule references
- ✅ Updated **server/src/middleware/cors.ts** section with Security Guidelines references
- ✅ Updated **server/public/assets/app.js** section with Security Guidelines and error handling references
- ✅ Added rule links using anchor format: `.cursor/rules/project-rules.mdc#section-name`
- ✅ Updated **Success Criteria** to include DoD and rule compliance

### Recommendations

1. **Security Review**: Ensure all browser code is reviewed for any accidental `clientSecret` exposure before deployment
2. **Testing Strategy**: Consider adding integration tests for the full DataClient flow (browser → server → controller)
3. **Error Handling**: Ensure all API endpoints follow the error handling pattern (return empty arrays on errors)
4. **Documentation**: Consider adding API documentation with examples for each endpoint
5. **Performance**: Review bundling approach (Option B recommended for production) to ensure optimal bundle size
6. **CORS Testing**: Ensure CORS and origin validation are thoroughly tested with various origins
7. **TypeScript Strict Mode**: Ensure `tsconfig.json` uses `strict: true` for type safety

### Validation Summary

The plan has been **VALIDATED** and is ready for production implementation. All mandatory DoD requirements are documented, all applicable rule sections are referenced, and the plan includes comprehensive guidance for following project standards. The plan addresses security concerns (browser-safe patterns), testing requirements (Jest, ≥80% coverage), code quality standards (file size limits, JSDoc), and proper error handling patterns.
