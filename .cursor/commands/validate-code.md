# validate-code

This command analyzes all core code (src/services, src/utils, src/types, src/express) against development rules and creates or updates detailed improvement plans for each module category.

## Purpose

The command:
1. Reads all development rules from the repository-specific cursor rules
2. Analyzes all core code in:
   - `src/services/` (primary focus - AuthService, RolesService, PermissionsService, LoggerService, RedisService, DataClient)
   - `src/utils/` (HTTP client, config loader, data masker, internal HTTP client)
   - `src/types/` (TypeScript type definitions)
   - `src/express/` (Express.js utilities and middleware)
   - `src/index.ts` (Main MisoClient class exports)
3. Groups code by module category (e.g., "Services - Authentication", "Services - Authorization", "Utils - HTTP", "Express - Middleware")
4. For each category, checks if a plan file already exists with pattern `*-fix-and-improve-code.<category>.plan.md`
5. If a plan exists, updates the existing plan file
6. If no plan exists, creates a new plan file with format: `<next-number>-fix-and-improve-code.<category>.plan.md`
7. Documents all violations and required improvements based on cursor rules

## Usage

Run this command in chat with `/validate-code`

## What It Does

For each module category, the command:

1. **Analyzes Code Reuse**:
   - Checks for code duplication across modules
   - Verifies use of reusable utilities from `src/utils/`
   - Validates proper abstraction of common patterns
   - Checks for forbidden manual implementations (error handling, HTTP operations, token management)
   - Identifies opportunities for shared utility functions
   - Verifies use of existing utility modules where applicable

2. **Analyzes Error Handling**:
   - Verifies proper Error usage with descriptive messages
   - Checks for proper exception propagation
   - Validates error messages are descriptive and user-friendly
   - Checks for proper error context in exceptions
   - Verifies try-catch blocks wrap all async operations
   - Validates error handling follows project patterns (services return empty arrays `[]` on error)
   - Checks that service methods never throw uncaught errors

3. **Analyzes Logging**:
   - Verifies proper use of console.log/console.error/console.warn
   - Checks for proper logging context (user IDs, operation names)
   - Validates logging includes appropriate context
   - Checks that secrets are never logged (use DataMasker)
   - Verifies appropriate log levels (info, error, warning)
   - Validates audit logging for critical operations

4. **Analyzes Type Safety**:
   - Verifies all functions have proper TypeScript type annotations
   - Checks for proper return type annotations
   - Validates async function signatures
   - Checks for proper use of TypeScript types (interfaces, types, generics)
   - Verifies JSDoc comments include `@param`, `@returns`, `@throws` where applicable
   - Validates proper use of interfaces over types for public APIs

5. **Analyzes Async Patterns**:
   - Verifies all async operations use async/await
   - Checks for proper use of async/await (not raw promises)
   - Validates proper async context management
   - Verifies API calls use async patterns
   - Validates proper error handling in async functions

6. **Analyzes HTTP Client Patterns**:
   - Verifies use of `HttpClient` or `InternalHttpClient` for HTTP operations
   - Checks for proper use of `authenticatedRequest()` for user-authenticated requests
   - Validates use of `request()` for unauthenticated requests
   - Checks for proper client token management (automatic via interceptors)
   - Verifies proper header usage (`x-client-token` lowercase, `Authorization: Bearer`)
   - Validates proper API endpoint format (`/api` prefix)

7. **Analyzes Token Management**:
   - Verifies proper JWT token decoding (not verification)
   - Checks for proper userId extraction from tokens (`sub`, `userId`, `user_id`, `id`)
   - Validates client token is fetched automatically via interceptors
   - Checks that client token uses `x-client-token` header (lowercase)
   - Verifies user tokens use `Authorization: Bearer <token>` header
   - Validates token refresh logic

8. **Analyzes Redis Caching**:
   - Verifies proper Redis connection checks (`redis.isConnected()`)
   - Checks for proper cache key format (`roles:{userId}`, `permissions:{userId}`)
   - Validates cache format (JSON.stringify with timestamp)
   - Checks for proper TTL usage (default 900 seconds)
   - Verifies fallback to controller when Redis fails
   - Validates proper error handling for Redis operations

9. **Analyzes Service Layer Patterns**:
   - Verifies services receive `HttpClient` and `RedisService` as dependencies
   - Checks for proper use of `httpClient.config` (public readonly property)
   - Validates services follow constructor pattern
   - Checks for proper separation of concerns
   - Verifies services don't contain HTTP client logic (should use HttpClient)
   - Validates single responsibility principle

10. **Analyzes Testing**:
    - Checks for test coverage of core modules
    - Validates test structure mirrors code structure (`tests/unit/`)
    - Verifies all error cases are tested
    - Checks for proper use of Jest mocks (axios, ioredis, jsonwebtoken)
    - Validates async test patterns
    - Verifies tests follow Jest patterns from project rules
    - Checks for proper mocking of HttpClient and RedisService

11. **Analyzes Code Quality**:
    - Checks for proper function documentation (JSDoc)
    - Validates code follows TypeScript best practices
    - Checks for proper variable naming conventions (camelCase)
    - Verifies no hardcoded values (use configuration)
    - Validates proper use of constants (UPPER_SNAKE_CASE)
    - Checks file size limits (≤500 lines per file, ≤20-30 lines per method)
    - Verifies proper code organization and structure

12. **Analyzes Security & Compliance**:
    - Verifies no hardcoded secrets, passwords, or tokens
    - Checks that `clientId` and `clientSecret` are never exposed to client code
    - Validates proper secret management
    - Checks that secrets are never logged or exposed
    - Verifies proper input sanitization
    - Validates audit logging for critical operations
    - Checks for ISO 27001 compliance patterns

13. **Analyzes Express Utilities**:
    - Verifies Express utilities follow project patterns
    - Checks for proper middleware patterns
    - Validates proper error handling in Express middleware
    - Verifies proper TypeScript type augmentation
    - Checks for proper async handler patterns

14. **Analyzes API Patterns**:
    - Verifies all endpoints use `/api` prefix
    - Checks for proper HTTP method usage
    - Validates proper request/response handling
    - Verifies proper error response formatting
    - Checks for proper pagination handling

## Output

Creates or updates plan files in `.cursor/plans/` with:
- Overview of the module category
- List of all files/modules in the category
- Detailed violation analysis
- Specific improvement tasks
- Code examples for fixes
- Testing requirements
- Priority recommendations

**Important**: If a plan file with pattern `*-fix-and-improve-code.<category>.plan.md` already exists (e.g., `70-fix-and-improve-code.services-authentication.plan.md`), the command will **update** the existing plan instead of creating a new one. This ensures that progress on existing plans is preserved and updated with the latest analysis.

**Execution Behavior**: When generating a new plan, it should be clearly identified as a "code improvement plan and execution". The command should execute improvements automatically without asking for user input or showing progress details, unless there are breaking changes or other critical reasons that require user confirmation. The focus is on silent, automated execution of code improvements based on the analysis.

## Example Plan Structure

```markdown
# Fix and Improve Code - Services - Authentication

## Overview
[Description of the module category and its purpose]

## Modules Analyzed
[List of all files in this category]

## Key Issues Identified
[Summary of main violations]

## Implementation Tasks

### Task 1: Fix Code Duplication
[Detailed task description with code examples showing duplication and how to refactor using src/utils/]

### Task 2: Add Proper Error Handling
[Detailed task description with code examples showing proper Error usage and try-catch patterns]

### Task 3: Improve Logging
[Detailed task description with code examples showing proper logging patterns]

### Task 4: Add Type Annotations
[Detailed task description with code examples showing proper TypeScript annotations]

### Task 5: Fix Async Patterns
[Detailed task description with code examples showing proper async/await usage]

### Task 6: Add Input Validation
[Detailed task description with code examples showing proper parameter validation]

### Task 7: Improve Security
[Detailed task description with code examples showing secret management and security best practices]

...
```

## Module Categories

The command groups code into the following categories:

### Services - Authentication
- **Services - Authentication**: `src/services/auth.service.ts`, authentication-related services

### Services - Authorization
- **Services - Authorization**: `src/services/roles.service.ts`, `src/services/permissions.service.ts`

### Services - Logging
- **Services - Logging**: `src/services/logger.service.ts`

### Services - Data
- **Services - Data**: `src/services/data-client.ts`, data client services

### Services - Infrastructure
- **Services - Infrastructure**: `src/services/redis.service.ts`

### Utils - HTTP Client
- **Utils - HTTP Client**: `src/utils/http-client.ts`, `src/utils/internal-http-client.ts`

### Utils - Configuration
- **Utils - Configuration**: `src/utils/config-loader.ts`

### Utils - Data Processing
- **Utils - Data Processing**: `src/utils/data-masker.ts`

### Express - Middleware
- **Express - Middleware**: `src/express/` middleware utilities

### Express - Utilities
- **Express - Utilities**: `src/express/` helper utilities

### Types
- **Types**: `src/types/` TypeScript type definitions

### Core
- **Core**: `src/index.ts`, main MisoClient class

## Notes

- **Existing Plans**: If a plan file matching pattern `*-fix-and-improve-code.<category>.plan.md` already exists, it will be updated rather than creating a new one
- **New Plans**: If no existing plan is found, a new plan is created with sequential numbering (starting from biggest number in plan folder plus 1). New plans are **code improvement plans and execution** - they should be executed automatically without user input or progress updates, unless breaking changes or other critical reasons require user confirmation
- **Execution**: Do NOT ask the user for input or show what's being done unless necessary for breaking changes or other critical reasons. The command should execute improvements silently and automatically
- Each category gets its own plan file
- Plans include actionable tasks with specific file locations and line numbers where applicable
- Plans reference specific cursor rules that are violated
- Focus is on `src/services/` and `src/utils/` as the primary targets, but all core code is analyzed
- The command prioritizes code reuse violations as they are critical for maintainability
- When updating existing plans, the command preserves the plan number and updates the content with the latest analysis
- All analysis should follow the patterns defined in the repository-specific cursor rules
- Security and ISO 27001 compliance are critical - all plans must address security concerns
- File size limits (≤500 lines per file, ≤20-30 lines per method) must be checked and enforced
- All public API outputs (types, interfaces, return values, function names) must use camelCase

