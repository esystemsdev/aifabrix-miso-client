# Unified Logging Interface - SDK Enhancement

## Overview

Enhance the miso-client SDK with a unified logging interface that provides a minimal API (1-3 parameters maximum) with automatic context extraction. This enables simple, consistent logging across all applications using the SDK without requiring manual context passing.

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns - Service Layer](.cursor/rules/project-rules.mdc#service-layer)** - Service structure, dependency injection, configuration access. UnifiedLogger service follows service layer patterns.
- **[Architecture Patterns - Logger Chain Pattern](.cursor/rules/project-rules.mdc#logger-chain-pattern)** - Fluent API patterns, context chaining, error handling in logger.
- **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - Use interfaces over types for public APIs, strict TypeScript, public readonly for config access.
- **[Code Style - Error Handling](.cursor/rules/project-rules.mdc#error-handling)** - Error logging with comprehensive context, RFC 7807 compliance, proper error extraction.
- **[Code Style - Async/Await](.cursor/rules/project-rules.mdc#asyncawait)** - Always use async/await, try-catch for async operations, proper error handling.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, 80%+ coverage, mock all external dependencies.
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - ISO 27001 compliance, PII masking, never expose secrets, proper token handling.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-size-guidelines)** - File size limits (≤500 lines), method size limits (≤20-30 lines), JSDoc documentation.
- **[File Organization](.cursor/rules/project-rules.mdc#file-organization)** - Source structure, import order, export strategy, barrel exports for public APIs.
- **[Documentation](.cursor/rules/project-rules.mdc#documentation)** - JSDoc comments for public methods, parameter types, return types, error conditions.

**Key Requirements**:

- Services receive `HttpClient` and `RedisService` (or `CacheService`) as dependencies
- Services use `httpClient.config` (public readonly property) for configuration access
- Use interfaces (not types) for public API definitions (UnifiedLogger interface)
- All public API outputs use camelCase (no snake_case)
- Add JSDoc comments for all public functions with parameter types and return types
- Keep files ≤500 lines and methods ≤20-30 lines
- Error handling in logger should be silent (catch and swallow)
- Always log errors with comprehensive context (IP, endpoint, user, status code, stack trace)
- Use try-catch for all async operations
- Write tests with Jest, mock all external dependencies (AsyncLocalStorage, LoggerService)
- Aim for 80%+ branch coverage
- Never expose `clientId` or `clientSecret` in client code
- Mask sensitive data in logs (use DataMasker)
- Export only what's needed in `src/index.ts`
- Update documentation in `docs/` directory

## Before Development

- [ ] Read Architecture Patterns - Service Layer section from project-rules.mdc
- [ ] Review existing LoggerService implementation for patterns
- [ ] Review existing context extraction utilities (`extractJwtContext`, `extractRequestContext`, `extractEnvironmentMetadata`)
- [ ] Review existing DataMasker for PII masking patterns
- [ ] Understand AsyncLocalStorage API (Node.js 16+)
- [ ] Review Express middleware patterns in `src/express/`
- [ ] Review error handling patterns and RFC 7807 compliance
- [ ] Understand testing requirements and mock patterns (AsyncLocalStorage mocking)
- [ ] Review JSDoc documentation patterns in existing services
- [ ] Review file organization and export patterns
- [ ] Review documentation structure in `docs/` directory

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs TypeScript compilation)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, methods ≤20-30 lines
6. **JSDoc Documentation**: All public functions have JSDoc comments with parameter types and return types
7. **Code Quality**: All rule requirements met
8. **Security**: No hardcoded secrets, ISO 27001 compliance, proper token handling, PII masking
9. **Error Handling**: Use try-catch for all async operations, error handling in logger should be silent
10. **TypeScript**: Use interfaces (not types) for public APIs, strict TypeScript mode
11. **Naming Conventions**: All public API outputs use camelCase (no snake_case)
12. **Testing**: Unit tests with 80%+ coverage, integration tests for Express middleware, mock all dependencies
13. **Documentation**: Update documentation as needed (README, API docs, guides, usage examples)
14. **Exports**: Export only what's needed in `src/index.ts`, use barrel exports for public APIs
15. **Context Extraction**: Automatic context extraction from AsyncLocalStorage works correctly
16. **Express Middleware**: Middleware sets context correctly and works seamlessly with Express
17. **Context Propagation**: Context propagation works across async boundaries
18. **All Tasks Completed**: All implementation tasks marked as complete

## Design Goals

1. **Minimal Interface**: Maximum 1-3 parameters per logging call
2. **Automatic Context Extraction**: Context extracted automatically via AsyncLocalStorage
3. **Simple API**: `logger.info(message)`, `logger.error(message, error?)`, `logger.audit(action, resource, entityId?, oldValues?, newValues?)`
4. **Framework Agnostic**: Works in Express routes, service layers, background jobs
5. **Zero Configuration**: Context automatically available when middleware is used
6. **Leverage Existing Code**: Reuse existing context extraction, JWT handling, PII masking

## Current State

### What Already Exists in SDK ✅

- **Context Extraction**: `extractJwtContext()`, `extractRequestContext()`, `extractEnvironmentMetadata()`
- **PII Masking**: `DataMasker` for automatic sensitive data masking
- **JWT Handling**: Token extraction and decoding utilities
- **LoggerService**: Core logging service with Redis/HTTP/Event emission support

### What's Missing ❌

- **AsyncLocalStorage Context Storage**: No mechanism to store context without Request objects
- **UnifiedLogger Interface**: No simplified interface with minimal parameters
- **getLogger() Factory**: No factory function that auto-detects available context
- **Context Propagation**: No way to propagate context across async boundaries without Request objects

## Service Interface

### Core Interface

```typescript
export interface UnifiedLogger {
  /**
   * Log info message
   * @param message - Info message
   */
  info(message: string): Promise<void>;

  /**
   * Log warning message
   * @param message - Warning message
   */
  warn(message: string): Promise<void>;

  /**
   * Log debug message
   * @param message - Debug message
   */
  debug(message: string): Promise<void>;

  /**
   * Log error message
   * @param message - Error message
   * @param error - Optional error object (auto-extracts stack trace)
   */
  error(message: string, error?: unknown): Promise<void>;

  /**
   * Log audit event
   * @param action - Action performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
   * @param resource - Resource type (e.g., 'User', 'Tenant')
   * @param entityId - Optional entity ID (defaults to 'unknown')
   * @param oldValues - Optional old values for UPDATE operations (ISO 27001 requirement)
   * @param newValues - Optional new values for CREATE/UPDATE operations (ISO 27001 requirement)
   */
  audit(
    action: string,
    resource: string,
    entityId?: string,
    oldValues?: object,
    newValues?: object,
  ): Promise<void>;
}
```

### Usage Examples

#### Express Route Handler

```typescript
import { getLogger } from '@aifabrix/miso-client';

app.get('/api/users', async (req, res) => {
  const logger = getLogger(); // Auto-detects context from AsyncLocalStorage
  
  await logger.info('Users list accessed'); // Auto-extracts request context
  
  const users = await fetchUsers();
  res.json(users);
});
```

#### Service Layer

```typescript
import { getLogger } from '@aifabrix/miso-client';

export class UserService {
  async getUser(userId: string) {
    const logger = getLogger(); // Uses AsyncLocalStorage context if available
    
    await logger.info('Fetching user'); // Auto-extracts context if available
    
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      await logger.audit('ACCESS', 'User', userId); // Read access audit
      return user;
    } catch (error) {
      await logger.error('Failed to fetch user', error); // Auto-extracts error details
      throw error;
    }
  }
}
```

#### Background Job

```typescript
import { getLogger, setLoggerContext } from '@aifabrix/miso-client';

async function backgroundJob() {
  // Set context for this async execution context
  setLoggerContext({
    userId: 'system',
    correlationId: 'job-123',
    ipAddress: '127.0.0.1',
  });
  
  const logger = getLogger();
  await logger.info('Background job started');
  
  // All logs in this async context will use the set context
  await processData();
}
```

## Implementation Architecture

### Context Management Strategy

1. **AsyncLocalStorage**: Use AsyncLocalStorage to store request context per async execution context

                                                                                                                                                                                                - Context set by Express middleware or manually via `setLoggerContext()`
                                                                                                                                                                                                - Automatically available to all code in the same async context
                                                                                                                                                                                                - No need to pass Request objects around

2. **Manual Context**: Allow manual context setting for cases without request context

                                                                                                                                                                                                - `setLoggerContext()` function for manual context setting
                                                                                                                                                                                                - Useful for background jobs, scheduled tasks, etc.

### Context Extraction Priority

1. **AsyncLocalStorage**: When context is set via middleware or `setLoggerContext()`
2. **Default Context**: Minimal context with application name only (when no context available)

### Context Fields Automatically Extracted

- `ipAddress` - Client IP address (from request.ip or connection.remoteAddress)
- `userAgent` - User agent string (from User-Agent header)
- `correlationId` - Request correlation ID (from x-correlation-id header or auto-generated)
- `userId` - Authenticated user ID (from JWT token or x-user-id header)
- `sessionId` - Session ID (from JWT token or x-session-id header)
- `method` - HTTP method (GET, POST, etc.)
- `path` - Request path
- `hostname` - Request hostname (from Host header)
- `applicationId` - Application identifier (from JWT token or x-application-id header)

### Leveraging Existing SDK Features

**Reuse Existing Functionality**:

1. **JWT Token Handling** ✅ Already exists:

                                                                                                                                                                                                - Use `extractJwtContext()` - Extracts userId, sessionId, applicationId from JWT
                                                                                                                                                                                                - Use existing token extraction from Request headers
                                                                                                                                                                                                - No need to reimplement JWT parsing

2. **Context Extraction** ✅ Already exists:

                                                                                                                                                                                                - Use `extractRequestContext()` - Extracts IP, method, path, userAgent, correlationId
                                                                                                                                                                                                - Use `extractEnvironmentMetadata()` - Extracts hostname, userAgent from environment
                                                                                                                                                                                                - No need to reimplement request parsing

3. **PII Masking** ✅ Already exists:

                                                                                                                                                                                                - Use `DataMasker.maskSensitiveData()` - Automatic PII masking
                                                                                                                                                                                                - No need to reimplement data masking

4. **LoggerService** ✅ Already exists:

                                                                                                                                                                                                - Use existing `LoggerService` for actual log emission
                                                                                                                                                                                                - UnifiedLogger wraps LoggerService with simplified interface
                                                                                                                                                                                                - No need to reimplement logging logic

## Implementation Plan

### Phase 1: Create AsyncLocalStorage Context Storage

**File**: `src/services/logger/logger-context-storage.ts`

Create AsyncLocalStorage-based context storage:

- Store request context per async execution context
- Provide methods to get/set/clear context
- Support context merging with additional fields
- Thread-safe context access

**Key Functions**:

- `getLoggerContext(): LoggerContext | null` - Get current context
- `setLoggerContext(context: Partial<LoggerContext>): void` - Set context for current async context
- `clearLoggerContext(): void` - Clear context
- `mergeLoggerContext(additional: Partial<LoggerContext>): void` - Merge additional fields

**Type Definition**:

```typescript
export interface LoggerContext {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  method?: string;
  path?: string;
  hostname?: string;
  applicationId?: string;
  requestId?: string;
  token?: string; // JWT token for extraction
}
```

### Phase 2: Create UnifiedLogger Service

**File**: `src/services/logger/unified-logger.service.ts`

Create `UnifiedLogger` service that:

- Implements the minimal interface (1-3 parameters max)
- Automatically extracts context from AsyncLocalStorage
- Uses existing `LoggerService` for actual log emission
- Auto-extracts error details (stack trace, error name, error message)

**Implementation Pattern**:

```typescript
export class UnifiedLogger implements UnifiedLoggerInterface {
  constructor(
    private loggerService: LoggerService,
    private contextStorage: LoggerContextStorage
  ) {}

  async info(message: string): Promise<void> {
    const context = this.getContext();
    await this.loggerService.info(message, this.buildContext(context));
  }

  async error(message: string, error?: unknown): Promise<void> {
    const context = this.getContext();
    const errorContext = this.extractErrorContext(error);
    await this.loggerService.error(message, { ...context, ...errorContext });
  }

  async audit(
    action: string,
    resource: string,
    entityId?: string,
    oldValues?: object,
    newValues?: object
  ): Promise<void> {
    const context = this.getContext();
    await this.loggerService.audit(action, resource, {
      ...context,
      entityId: entityId || 'unknown',
      oldValues,
      newValues,
    });
  }

  private getContext(): LoggerContext {
    // Priority: AsyncLocalStorage → Default
    return this.contextStorage.getContext() || {};
  }
}
```

### Phase 3: Create Factory Function

**File**: `src/services/logger/unified-logger.factory.ts`

Create `getLogger()` factory function that:

- Returns `UnifiedLogger` instance
- Automatically detects available context from AsyncLocalStorage
- Works in both Express routes and service layers

**Factory Functions**:

```typescript
/**
 * Get logger instance with automatic context detection from AsyncLocalStorage
 * @returns UnifiedLogger instance
 */
export function getLogger(): UnifiedLogger {
  const contextStorage = LoggerContextStorage.getInstance();
  const loggerService = getLoggerService(); // Get from MisoClient instance
  
  return new UnifiedLogger(loggerService, contextStorage);
}

/**
 * Set logger context for current async execution context
 * @param context - Context to set
 */
export function setLoggerContext(context: Partial<LoggerContext>): void {
  const contextStorage = LoggerContextStorage.getInstance();
  contextStorage.setContext(context);
}

/**
 * Clear logger context for current async execution context
 */
export function clearLoggerContext(): void {
  const contextStorage = LoggerContextStorage.getInstance();
  contextStorage.clearContext();
}
```

### Phase 4: Create Express Middleware Helper (Optional)

**File**: `src/express/logger-context.middleware.ts`

Create Express middleware helper that:

- Extracts context from Request object
- Sets context in AsyncLocalStorage
- Uses existing `extractRequestContext()` and `extractJwtContext()`
- Works seamlessly with Express middleware chain

**Middleware Pattern**:

```typescript
import { Request, Response, NextFunction } from 'express';
import { setLoggerContext } from '../services/logger/unified-logger.factory';
import { extractRequestContext } from '../utils/request-context';
import { extractJwtContext } from '../services/logger/logger-context';

/**
 * Express middleware to set logger context from request
 * Call this early in middleware chain (after auth middleware)
 */
export function loggerContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestContext = extractRequestContext(req);
  const jwtContext = extractJwtContext(
    req.headers.authorization?.replace('Bearer ', '')
  );

  setLoggerContext({
    ...requestContext,
    ...jwtContext,
    token: req.headers.authorization?.replace('Bearer ', ''),
  });

  next();
}
```

### Phase 5: Export Public API

**File**: `src/services/logger/index.ts` (update)

Export:

- `getLogger()` - Factory function to get logger instance
- `setLoggerContext()` - Set context manually
- `clearLoggerContext()` - Clear context
- `UnifiedLogger` - Interface type
- `LoggerContext` - Context type

**File**: `src/index.ts` (update)

Export unified logging API:

- `getLogger()` - Main entry point for logging
- `setLoggerContext()` - Set context manually
- `clearLoggerContext()` - Clear context
- `loggerContextMiddleware` - Express middleware (if Express is available)

### Phase 6: Update Documentation

**Files to Update**:

#### 6.1: `docs/reference-services.md` - Add UnifiedLogger Section

**Location**: Add new section after "Logging Methods" section (around line 163)

**Content to Add**:

1. **New Section: "Unified Logging Interface"**

                                                                                                                                                                                                - Overview of unified logging with minimal parameters
                                                                                                                                                                                                - Benefits of automatic context extraction

2. **UnifiedLogger Interface Documentation**:

                                                                                                                                                                                                - `getLogger(): UnifiedLogger` - Factory function
                                                                                                                                                                                                - `setLoggerContext(context: Partial<LoggerContext>): void` - Set context manually
                                                                                                                                                                                                - `clearLoggerContext(): void` - Clear context
                                                                                                                                                                                                - `loggerContextMiddleware` - Express middleware helper

3. **UnifiedLogger Methods**:

                                                                                                                                                                                                - `info(message: string): Promise<void>`
                                                                                                                                                                                                - `warn(message: string): Promise<void>`
                                                                                                                                                                                                - `debug(message: string): Promise<void>`
                                                                                                                                                                                                - `error(message: string, error?: unknown): Promise<void>`
                                                                                                                                                                                                - `audit(action: string, resource: string, entityId?: string, oldValues?: object, newValues?: object): Promise<void>`

4. **Usage Examples**:

                                                                                                                                                                                                - Express route handler with middleware
                                                                                                                                                                                                - Service layer without Request object
                                                                                                                                                                                                - Background job with manual context

5. **Context Extraction Details**:

                                                                                                                                                                                                - Automatic context extraction priority (AsyncLocalStorage → Default)
                                                                                                                                                                                                - Context fields automatically extracted
                                                                                                                                                                                                - Manual context setting for background jobs

#### 6.2: `docs/getting-started.md` - Add Unified Logging Quick Start

**Location**: Add after existing logging examples (around line 300-400)

**Content to Add**:

1. **New Section: "Unified Logging"**

                                                                                                                                                                                                - Quick start example with Express middleware
                                                                                                                                                                                                - Simple 3-step setup:
     ```typescript
     // 1. Add middleware
     app.use(loggerContextMiddleware);
     
     // 2. Get logger anywhere
     const logger = getLogger();
     
     // 3. Use simple API
     await logger.info('Message');
     ```


#### 6.3: `docs/examples.md` - Add Unified Logging Examples Reference

**Location**: Add new entry in "Common Patterns" section (around line 28)

**Content to Add**:

- [Unified Logging](./examples/unified-logging.md) - Minimal API with automatic context extraction

#### 6.4: `docs/examples/unified-logging.md` - New File

**Create New File** with comprehensive examples:

1. **Overview**:

                                                                                                                                                                                                - What is unified logging
                                                                                                                                                                                                - Benefits of minimal API
                                                                                                                                                                                                - When to use it

2. **Express Route Handler**:

                                                                                                                                                                                                - Middleware setup
                                                                                                                                                                                                - Simple logging examples
                                                                                                                                                                                                - Error logging with automatic context
                                                                                                                                                                                                - Audit logging with oldValues/newValues

3. **Service Layer**:

                                                                                                                                                                                                - Logging without Request objects
                                                                                                                                                                                                - Context propagation across async boundaries
                                                                                                                                                                                                - Service method examples

4. **Background Jobs**:

                                                                                                                                                                                                - Manual context setting
                                                                                                                                                                                                - Background job logging patterns
                                                                                                                                                                                                - Scheduled task examples

5. **Advanced Usage**:

                                                                                                                                                                                                - Custom context merging
                                                                                                                                                                                                - Error handling patterns

#### 6.5: `docs/examples/express-middleware.md` - Update with Unified Logging

**Location**: Update existing examples to show unified logging pattern

**Content to Update**:

1. **Add Unified Logging Section**:

                                                                                                                                                                                                - Show unified logging as the standard pattern
                                                                                                                                                                                                - Express middleware setup examples
                                                                                                                                                                                                - Demonstrate automatic context extraction

2. **Update Examples**:

                                                                                                                                                                                                - Replace existing examples with unified logging pattern
                                                                                                                                                                                                - Show middleware setup
                                                                                                                                                                                                - Demonstrate automatic context extraction

3. **Update Best Practices**:

                                                                                                                                                                                                - Use unified logging for all new code

#### 6.6: `docs/examples/background-jobs.md` - Update with Unified Logging

**Location**: Add unified logging examples for background jobs

**Content to Add**:

1. **New Section: "Unified Logging for Background Jobs"**

                                                                                                                                                                                                - Manual context setting with `setLoggerContext()`
                                                                                                                                                                                                - Background job logging without Request objects
                                                                                                                                                                                                - Context propagation examples

2. **Update Examples**:

                                                                                                                                                                                                - Replace existing examples with unified logging pattern
                                                                                                                                                                                                - Demonstrate simpler API for background jobs

#### 6.7: `docs/configuration.md` - Add Unified Logging Configuration

**Location**: Add after "Logging Configuration" section (around line 200-300)

**Content to Add**:

1. **New Section: "Unified Logging Configuration"**

                                                                                                                                                                                                - Express middleware setup
                                                                                                                                                                                                - Context storage configuration (if needed)
                                                                                                                                                                                                - Environment-specific setup

2. **Middleware Configuration**:

                                                                                                                                                                                                - How to add `loggerContextMiddleware`
                                                                                                                                                                                                - Middleware order recommendations
                                                                                                                                                                                                - Integration with auth middleware

#### 6.8: `README.md` - Add Unified Logging Feature

**Location**: Add to "Developer Experience" section (around line 90-100)

**Content to Add**:

1. **Add to Feature List**:

                                                                                                                                                                                                - "Unified Logging Interface - Minimal API with automatic context extraction"

2. **Add Quick Example**:
   ```typescript
   // Simple unified logging
   app.use(loggerContextMiddleware);
   const logger = getLogger();
   await logger.info('Message'); // Auto-extracts context
   ```

3. **Update Logging Section**:

                                                                                                                                                                                                - Mention unified logging as recommended approach
                                                                                                                                                                                                - Link to documentation

#### 6.9: `CHANGELOG.md` - Document New Features

**Location**: Add new entry at top of file

**Content to Add**:

```markdown
## [Unreleased] - Unified Logging Interface

### Added
- **Unified Logging Interface**: New minimal API with automatic context extraction
  - `getLogger()` factory function for automatic context detection
  - `setLoggerContext()` and `clearLoggerContext()` for manual context management
  - `loggerContextMiddleware` Express middleware helper
  - AsyncLocalStorage-based context propagation across async boundaries
  - Simplified API: `logger.info(message)`, `logger.error(message, error?)`, `logger.audit(action, resource, entityId?, oldValues?, newValues?)`
  - Automatic context extraction from AsyncLocalStorage

### Documentation
- Added unified logging examples and guides
- Updated Express middleware examples with unified logging pattern
- Added background job logging examples with unified interface
- Comprehensive API reference for UnifiedLogger interface
```

#### 6.10: `docs/api-reference.md` - Add Unified Logging Entry

**Location**: Add entry in API reference index

**Content to Add**:

- Link to unified logging section in reference-services.md

#### 6.11: `docs/examples/README.md` - Update Examples Index

**Location**: Add unified logging to examples list

**Content to Add**:

- [Unified Logging](./unified-logging.md) - Minimal API with automatic context extraction

**Documentation Update Summary**:

| File | Type | Priority | Description |

|------|------|----------|-------------|

| `docs/reference-services.md` | Update | High | Add UnifiedLogger interface documentation |

| `docs/examples/unified-logging.md` | Create | High | Comprehensive unified logging examples |

| `docs/getting-started.md` | Update | High | Add unified logging quick start |

| `docs/examples/express-middleware.md` | Update | Medium | Add unified logging examples |

| `docs/examples/background-jobs.md` | Update | Medium | Add unified logging for background jobs |

| `docs/configuration.md` | Update | Medium | Add unified logging configuration |

| `README.md` | Update | Medium | Add unified logging feature mention |

| `CHANGELOG.md` | Update | High | Document new features |

| `docs/examples.md` | Update | Low | Add unified logging reference |

| `docs/api-reference.md` | Update | Low | Add unified logging entry |

| `docs/examples/README.md` | Update | Low | Add unified logging to index |

## Key Design Decisions

1. **Minimal Parameters**: Maximum 1-3 parameters per call to keep interface simple
2. **Automatic Context**: Context extracted automatically via AsyncLocalStorage, no manual passing required
3. **Leverage Existing Code**: Reuse existing context extraction, JWT handling, PII masking
4. **AsyncLocalStorage**: Use Node.js AsyncLocalStorage for context propagation (Node 16+)
5. **Public API**: Single `getLogger()` factory function for all use cases
6. **Framework Agnostic**: Works in Express routes, service layers, background jobs
7. **Zero Configuration**: Works out of the box when middleware is used
8. **No Duplicate Code**: Reuse existing SDK functionality instead of reimplementing

## Files to Create

- `src/services/logger/logger-context-storage.ts` - AsyncLocalStorage context management
- `src/services/logger/unified-logger.service.ts` - UnifiedLogger implementation
- `src/services/logger/unified-logger.factory.ts` - Factory function
- `src/express/logger-context.middleware.ts` - Express middleware helper (optional)

## Files to Modify

- `src/services/logger/index.ts` - Export unified logging API
- `src/index.ts` - Export unified logging API
- `docs/reference-services.md` - Add UnifiedLogger documentation
- `README.md` - Add unified logging examples
- `CHANGELOG.md` - Document new features

## Testing Strategy

### Unit Tests

- Test AsyncLocalStorage context storage (get/set/clear/merge)
- Test UnifiedLogger with AsyncLocalStorage context
- Test UnifiedLogger with no context (default behavior)
- Test error extraction (stack trace, error name, error message)
- Test audit logging with oldValues/newValues

### Integration Tests

- Test Express middleware sets context correctly
- Test context propagation across async boundaries
- Test multiple concurrent requests (context isolation)

## Success Criteria

**Functional Requirements**:

- ✅ UnifiedLogger provides minimal interface (1-3 parameters max)
- ✅ Request context automatically extracted via AsyncLocalStorage
- ✅ User identification from JWT tokens works automatically
- ✅ PII masking handled automatically (existing DataMasker)
- ✅ Public API (`getLogger()`) works in Express routes and service layers
- ✅ Express middleware automatically sets context from request
- ✅ Works seamlessly in Express routes, service layers, background jobs
- ✅ Context propagation works across async boundaries

**Code Quality**:

- ✅ All code passes build → lint → test validation sequence
- ✅ Input validation on all public methods
- ✅ Type safety with strict TypeScript
- ✅ Unit tests with 80%+ coverage
- ✅ Integration tests for Express middleware
- ✅ Documentation updated

## Dependencies

- **Node.js**: Requires Node.js 16+ for AsyncLocalStorage support
- **No New Dependencies**: Uses existing SDK dependencies only
- **Express**: Optional peer dependency (for middleware helper)

## Documentation Update Summary

### Priority Levels

**High Priority** (Must update before release):

1. `docs/reference-services.md` - Core API documentation
2. `docs/examples/unified-logging.md` - New comprehensive examples file
3. `docs/getting-started.md` - Quick start guide
4. `CHANGELOG.md` - Feature announcement

**Medium Priority** (Should update for completeness):

5. `docs/examples/express-middleware.md` - Express integration examples
6. `docs/examples/background-jobs.md` - Background job patterns
7. `docs/configuration.md` - Configuration guide
8. `README.md` - Main readme feature mention

**Low Priority** (Nice to have):

9. `docs/examples.md` - Examples index
10. `docs/api-reference.md` - API reference index
11. `docs/examples/README.md` - Examples directory index

### Documentation Structure

**New Documentation Files**:

- `docs/examples/unified-logging.md` - Comprehensive unified logging guide with examples

**Updated Documentation Sections**:

- `docs/reference-services.md` - Add "Unified Logging Interface" section after "Logging Methods"
- `docs/getting-started.md` - Add "Unified Logging (Recommended)" quick start section
- `docs/examples/express-middleware.md` - Add unified logging examples alongside existing patterns
- `docs/examples/background-jobs.md` - Add unified logging for background jobs section
- `docs/configuration.md` - Add "Unified Logging Configuration" section

**Documentation Themes**:

- **Simplicity**: Emphasize minimal API (1-3 parameters)
- **Automatic Context**: Highlight automatic context extraction
- **Examples**: Show real-world usage patterns

### Documentation Checklist

Before release, ensure:

- [ ] UnifiedLogger interface fully documented with all methods
- [ ] Factory function (`getLogger`) documented with examples
- [ ] Express middleware setup documented
- [ ] Context management (`setLoggerContext`, `clearLoggerContext`) documented
- [ ] Examples for Express routes, service layers, background jobs
- [ ] Error handling examples with unified logging
- [ ] Audit logging examples with oldValues/newValues
- [ ] Configuration guide for middleware setup
- [ ] CHANGELOG entry with feature description
- [ ] README updated with feature mention
- [ ] All cross-references updated

## Notes

- AsyncLocalStorage is available in Node.js 16+ (current SDK supports Node 16+)
- Context is automatically isolated per async execution context
- No performance impact - AsyncLocalStorage is very fast
- Thread-safe - each async context has its own storage
- Works with async/await, promises, callbacks

---

## Plan Validation Report

**Date**: 2026-01-10

**Plan**: `.cursor/plans/42-unified-logging-interface.plan.md`

**Status**: ✅ VALIDATED

### Plan Purpose

This plan enhances the miso-client SDK with a unified logging interface that provides a minimal API (1-3 parameters maximum) with automatic context extraction using AsyncLocalStorage. The implementation includes:

- **New Services**: UnifiedLogger service, LoggerContextStorage service
- **Express Utilities**: Logger context middleware helper
- **Infrastructure**: AsyncLocalStorage-based context management
- **Type Definitions**: LoggerContext interface, UnifiedLogger interface
- **Documentation**: Comprehensive examples and API reference updates

**Plan Type**: Service Development (Logger Service Enhancement) + Infrastructure (AsyncLocalStorage Context Management) + Express Utilities (Middleware Helper)

**Affected Areas**:

- Services (`src/services/logger/`)
- Express utilities (`src/express/`)
- Types and interfaces
- Documentation (`docs/`)
- Public API exports (`src/index.ts`)

### Applicable Rules

- ✅ **[Architecture Patterns - Service Layer](.cursor/rules/project-rules.mdc#service-layer)** - UnifiedLogger service follows service layer patterns with dependency injection
- ✅ **[Architecture Patterns - Logger Chain Pattern](.cursor/rules/project-rules.mdc#logger-chain-pattern)** - Logging patterns, fluent API, error handling
- ✅ **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - Interfaces over types, strict TypeScript, public readonly config access
- ✅ **[Code Style - Error Handling](.cursor/rules/project-rules.mdc#error-handling)** - Comprehensive error logging with context, RFC 7807 compliance
- ✅ **[Code Style - Async/Await](.cursor/rules/project-rules.mdc#asyncawait)** - Async/await patterns, try-catch for async operations
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, 80%+ coverage, mock all dependencies
- ✅ **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - ISO 27001 compliance, PII masking, token handling
- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-size-guidelines)** - File size limits (≤500 lines), method size limits (≤20-30 lines), JSDoc documentation
- ✅ **[File Organization](.cursor/rules/project-rules.mdc#file-organization)** - Source structure, import order, export strategy
- ✅ **[Documentation](.cursor/rules/project-rules.mdc#documentation)** - JSDoc comments, parameter types, return types, error conditions

### Rule Compliance

- ✅ **DoD Requirements**: Fully documented with BUILD → LINT → TEST sequence
- ✅ **Service Layer**: Plan follows service layer patterns with dependency injection
- ✅ **TypeScript Conventions**: Plan specifies interfaces (not types) for public APIs
- ✅ **Error Handling**: Plan addresses comprehensive error logging with context
- ✅ **Testing Conventions**: Plan includes unit tests (80%+ coverage) and integration tests
- ✅ **Security Guidelines**: Plan addresses ISO 27001 compliance, PII masking, token handling
- ✅ **Code Quality Standards**: Plan addresses file size limits, method size limits, JSDoc documentation
- ✅ **File Organization**: Plan follows source structure and export patterns
- ✅ **Documentation**: Plan includes comprehensive documentation updates

### Plan Updates Made

- ✅ Added **Rules and Standards** section with all applicable rule references
- ✅ Added **Before Development** checklist with prerequisites and preparation steps
- ✅ Added **Definition of Done** section with complete validation requirements
- ✅ Added rule references: Architecture Patterns (Service Layer, Logger Chain Pattern), Code Style (TypeScript Conventions, Error Handling, Async/Await), Testing Conventions, Security Guidelines, Code Quality Standards, File Organization, Documentation
- ✅ Updated DoD with mandatory BUILD → LINT → TEST validation sequence
- ✅ Added file size limits (≤500 lines) and method size limits (≤20-30 lines) to DoD
- ✅ Added JSDoc documentation requirement to DoD
- ✅ Added security requirements (ISO 27001 compliance, PII masking) to DoD
- ✅ Added testing requirements (80%+ coverage, unit tests, integration tests) to DoD
- ✅ Added documentation update requirements to DoD

### Recommendations

1. **AsyncLocalStorage Mocking**: Ensure test mocks properly simulate AsyncLocalStorage behavior for context isolation testing
2. **Error Handling**: Verify that UnifiedLogger error handling is silent (catch and swallow) as per Logger Chain Pattern
3. **Context Extraction**: Ensure context extraction priority (AsyncLocalStorage → Default) is properly tested
4. **Express Middleware**: Verify middleware works seamlessly with existing Express middleware chain
5. **Documentation**: Ensure all documentation updates are completed before release (high priority items)
6. **Type Safety**: Verify all public API types use interfaces (not types) and camelCase naming
7. **Export Strategy**: Ensure only necessary exports are added to `src/index.ts` (barrel exports for public APIs)

### Validation Summary

The plan is **VALIDATED** and ready for production implementation. All required sections have been added:

- ✅ Rules and Standards section with applicable rule references
- ✅ Before Development checklist
- ✅ Definition of Done with complete validation requirements
- ✅ All mandatory DoD requirements documented (BUILD → LINT → TEST sequence)
- ✅ File size limits and method size limits documented
- ✅ JSDoc documentation requirements documented
- ✅ Security requirements documented
- ✅ Testing requirements documented (80%+ coverage)
- ✅ Documentation update requirements documented

The plan comprehensively addresses:

- Service layer architecture patterns
- TypeScript conventions and type safety
- Error handling and logging patterns
- Security and ISO 27001 compliance
- Testing requirements and coverage
- Code quality standards
- File organization and exports
- Documentation updates

**Next Steps**: Proceed with implementation following the plan tasks and ensuring all DoD requirements are met before marking as complete.