# Server-Provided DataClient Configuration (Zero-Config Approach)

## Overview

Move ALL configuration logic into `@aifabrix/miso-client` package. Developers write minimal code:

- **Server**: One line - use helper function
- **Client**: One line - call auto-initialization function

All environment variable handling, config generation, and initialization logic lives in the npm package.

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns - Express Utilities](.cursor/rules/project-rules.mdc#architecture-patterns)** - Express middleware pattern, route handler structure
- **[Architecture Patterns - HTTP Client Pattern](.cursor/rules/project-rules.mdc#architecture-patterns)** - Token management, client token handling
- **[Architecture Patterns - Token Management](.cursor/rules/project-rules.mdc#architecture-patterns)** - Client token handling, never expose clientSecret
- **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#code-style)** - Strict TypeScript, interfaces for public APIs, camelCase naming
- **[Code Style - Naming Conventions](.cursor/rules/project-rules.mdc#code-style)** - camelCase for all public API outputs, no snake_case
- **[Error Handling](.cursor/rules/project-rules.mdc#code-style)** - Use try-catch for async operations, return appropriate defaults
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, mock external dependencies, ≥80% coverage
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Never expose clientSecret, origin validation, proper token handling
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-size-guidelines)** - File size ≤500 lines, methods ≤20-30 lines, JSDoc documentation
- **[File Organization](.cursor/rules/project-rules.mdc#file-organization)** - Express utilities in `src/express/`, utils in `src/utils/`, proper export strategy
- **[Documentation](.cursor/rules/project-rules.mdc#documentation)** - JSDoc comments for public methods, update docs/ directory

**Key Requirements**:

- Express route handlers return `Promise<void>` and handle errors with proper status codes
- Use existing `getEnvironmentToken()` helper for origin validation and token fetching
- Never expose `clientId` or `clientSecret` in client-side code or responses
- All public API outputs use camelCase (no snake_case)
- Use try-catch for all async operations in both server and client helpers
- Add JSDoc comments for all public functions and interfaces
- Keep files ≤500 lines and methods ≤20-30 lines
- Write comprehensive tests with ≥80% coverage
- Mock all external dependencies (fetch, localStorage, Express Request/Response)
- Update documentation in `docs/data-client.md` and `docs/api-reference.md`

## Before Development

- [ ] Read Architecture Patterns - Express Utilities section from project-rules.mdc
- [ ] Read Architecture Patterns - Token Management section from project-rules.mdc
- [ ] Review existing Express utilities (`src/express/`) for patterns
- [ ] Review existing `getEnvironmentToken()` implementation (`src/utils/environment-token.ts`)
- [ ] Review existing DataClient initialization (`src/utils/data-client.ts`)
- [ ] Review error handling patterns in Express utilities
- [ ] Understand testing requirements and mock patterns for Express and browser APIs
- [ ] Review JSDoc documentation patterns
- [ ] Review security requirements (origin validation, no secrets in responses)
- [ ] Review localStorage caching patterns in DataClient

## Architecture

### Server-Side Helper (in miso-client)

**Location**: `src/express/client-token-endpoint.ts`

**Function**: `createClientTokenEndpoint(misoClient, options?)`

Returns Express route handler that:

1. Validates origin (using existing `getEnvironmentToken` logic)
2. Fetches client token
3. **Automatically enriches response with DataClient config**:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `baseUrl` - Derived from request (`req.protocol + '://' + req.get('host')`)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `controllerUrl` - From `misoClient.getConfig().controllerUrl`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `controllerPublicUrl` - From `misoClient.getConfig().controllerPublicUrl` (if set)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `clientId` - From `misoClient.getConfig().clientId`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `clientTokenUri` - From options or defaults to `/api/v1/auth/client-token`

**Developer usage**:

```typescript
import { MisoClient, createClientTokenEndpoint } from '@aifabrix/miso-client';

const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient));
```

### Client-Side Helper (in miso-client)

**Location**: `src/utils/data-client-auto-init.ts`

**Function**: `autoInitializeDataClient(options?)`

Automatically:

1. Detects if running in browser
2. Fetches config from `/api/v1/auth/client-token` endpoint (or custom URI)
3. Extracts `config` from response
4. Initializes DataClient with server-provided config
5. Returns initialized DataClient instance
6. Caches config in memory for future use

**Developer usage**:

```typescript
import { autoInitializeDataClient } from '@aifabrix/miso-client';

// One line - everything is automatic
const dataClient = await autoInitializeDataClient();
```

**Optional options**:

```typescript
const dataClient = await autoInitializeDataClient({
  clientTokenUri: '/api/v1/auth/client-token', // Custom endpoint
  baseUrl: 'https://api.example.com', // Override baseUrl detection
  onError: (error) => console.error('Init failed:', error), // Error handler
});
```

## Implementation Details

### Server-Side: `createClientTokenEndpoint`

**File**: `src/express/client-token-endpoint.ts`

```typescript
export interface ClientTokenEndpointOptions {
  clientTokenUri?: string; // Default: '/api/v1/auth/client-token'
  expiresIn?: number; // Default: 1800 (30 minutes)
  includeConfig?: boolean; // Default: true
}

export function createClientTokenEndpoint(
  misoClient: MisoClient,
  options?: ClientTokenEndpointOptions
): (req: Request, res: Response) => Promise<void>
```

**Response format**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 1800,
  "config": {
    "baseUrl": "http://localhost:3083",
    "controllerUrl": "https://controller.aifabrix.ai",
    "controllerPublicUrl": "https://controller.aifabrix.ai", // if set
    "clientId": "ctrl-dev-my-app",
    "clientTokenUri": "/api/v1/auth/client-token"
  }
}
```

**Type Definitions** (exported for developer use):

```typescript
/**
 * DataClient configuration returned by client-token endpoint
 * Contains all necessary configuration for browser-side DataClient initialization
 */
export interface DataClientConfigResponse {
  /** API base URL (derived from request) */
  baseUrl: string;
  
  /** MISO Controller URL (from misoClient config) */
  controllerUrl: string;
  
  /** Public controller URL for browser environments (if set) */
  controllerPublicUrl?: string;
  
  /** Client ID (from misoClient config) */
  clientId: string;
  
  /** Client token endpoint URI */
  clientTokenUri: string;
}

/**
 * Client token endpoint response
 * Includes token, expiration, and DataClient configuration
 */
export interface ClientTokenResponse {
  /** Client token string */
  token: string;
  
  /** Token expiration time in seconds */
  expiresIn: number;
  
  /** DataClient configuration (included when includeConfig is true) */
  config?: DataClientConfigResponse;
}

/**
 * Type guard to check if response includes config
 */
export function hasConfig(response: ClientTokenResponse): response is ClientTokenResponse & { config: DataClientConfigResponse } {
  return response.config !== undefined;
}
```

**Benefits of Ready-Made Types**:

- **Type Safety**: Developers can type their responses and get compile-time checks
- **Autocomplete**: IDEs provide autocomplete for response properties
- **Self-Documenting**: Types document the expected structure
- **Error Prevention**: TypeScript catches missing or incorrect properties
- **Type Guards**: `hasConfig()` helps safely check for config presence

**Developer usage with types**:

```typescript
import { 
  createClientTokenEndpoint, 
  ClientTokenResponse,
  DataClientConfigResponse,
  hasConfig
} from '@aifabrix/miso-client';

// Type-safe custom endpoint (if not using createClientTokenEndpoint)
app.post('/api/v1/auth/client-token', async (req, res) => {
  const response: ClientTokenResponse = {
    token: await getEnvironmentToken(misoClient, req),
    expiresIn: 1800,
    config: {
      baseUrl: `${req.protocol}://${req.get('host')}`,
      controllerUrl: misoClient.getConfig().controllerUrl,
      controllerPublicUrl: misoClient.getConfig().controllerPublicUrl,
      clientId: misoClient.getConfig().clientId,
      clientTokenUri: '/api/v1/auth/client-token'
    }
  };
  
  // Type guard usage
  if (hasConfig(response)) {
    console.log('Config available:', response.config.baseUrl);
  }
  
  res.json(response);
});
```

**Implementation notes**:

- Uses existing `getEnvironmentToken(misoClient, req)` for token + validation
- Derives `baseUrl` from request: `req.protocol + '://' + req.get('host')`
- Gets config from `misoClient.getConfig()`
- Handles errors with proper status codes (403 for origin validation, 503 for misoClient not initialized)

### Client-Side: `autoInitializeDataClient`

**File**: `src/utils/data-client-auto-init.ts`

```typescript
export interface AutoInitOptions {
  clientTokenUri?: string; // Default: '/api/v1/auth/client-token'
  baseUrl?: string; // Override baseUrl detection (auto-detected from window.location if not provided)
  onError?: (error: Error) => void; // Error callback
  cacheConfig?: boolean; // Default: true - cache config in localStorage
}

export async function autoInitializeDataClient(
  options?: AutoInitOptions
): Promise<DataClient>
```

**Implementation notes**:

- Auto-detects `baseUrl` from `window.location.origin` if not provided
- Fetches config from endpoint (GET or POST, handles both)
- Extracts `config` from response
- Creates DataClient with server-provided config
- Caches config in localStorage (key: `miso:dataclient-config`) for future page loads
- Throws descriptive errors if initialization fails

**Error handling**:

- Network errors → throws with helpful message
- Invalid response format → throws with response details
- Missing config → throws descriptive error

### Config Caching Strategy

**Server response caching**:

- Config is cached in localStorage: `miso:dataclient-config`
- Cache includes timestamp
- Config is refreshed when token expires (same TTL as token)

**Benefits**:

- Faster page loads (no need to fetch config every time)
- Reduced server load
- Config updates automatically when token refreshes

## Files to Create/Modify

### New Files in miso-client:

1. **`src/express/client-token-endpoint.ts`**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `createClientTokenEndpoint()` function
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Exports types and function

2. **`src/utils/data-client-auto-init.ts`**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `autoInitializeDataClient()` function
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Config caching logic
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Auto-detection helpers

### Modified Files:

3. **`src/express/index.ts`**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Export `createClientTokenEndpoint` and all types:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `ClientTokenEndpointOptions`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `ClientTokenResponse`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `DataClientConfigResponse`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `hasConfig` type guard function

4. **`src/index.ts`**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Export `autoInitializeDataClient` and types

5. **`src/utils/data-client-auth.ts`**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Update `getEnvironmentToken()` to handle config in response (backward compatible)

### Documentation Updates:

6. **`docs/data-client.md`**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Add "Zero-Config Setup" section
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Update examples to show one-line initialization

7. **`docs/api-reference.md`**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Document `createClientTokenEndpoint()`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Document `autoInitializeDataClient()`

## Developer Experience

### Before (Current):

```typescript
// Server
app.post('/api/v1/auth/client-token', async (req, res) => {
  const token = await getEnvironmentToken(misoClient, req);
  res.json({ token, expiresIn: 1800 });
});

// Client
const dataClient = new DataClient({
  baseUrl: process.env.API_BASE_URL,
  misoConfig: {
    controllerUrl: process.env.MISO_CONTROLLER_URL,
    clientId: process.env.MISO_CLIENTID,
    clientTokenUri: '/api/v1/auth/client-token',
  },
});
```

### After (Zero-Config):

```typescript
// Server - ONE LINE
app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient));

// Client - ONE LINE
const dataClient = await autoInitializeDataClient();
```

## Benefits

1. **Zero configuration** - No environment variables in frontend build
2. **Single source of truth** - All config from server .env
3. **Type-safe** - Full TypeScript support
4. **Backward compatible** - Existing code still works
5. **Developer-friendly** - One line of code for each side
6. **Secure** - No secrets in frontend code
7. **Flexible** - Options available for customization

## Migration Path

1. Add new helpers to miso-client (non-breaking)
2. Update documentation with zero-config examples
3. Keep existing patterns working (backward compatible)
4. Developers can migrate at their own pace

## Testing Strategy

1. Unit tests for `createClientTokenEndpoint`:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Origin validation
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Config generation
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Error handling

2. Unit tests for `autoInitializeDataClient`:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Config fetching
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - DataClient initialization
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Error handling
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Caching behavior

3. Integration tests:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - End-to-end server + client flow
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Config caching
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Error scenarios

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs TypeScript compilation)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, methods ≤20-30 lines
6. **JSDoc Documentation**: All public functions and interfaces have JSDoc comments
7. **Code Quality**: All rule requirements met
8. **Security**: 

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - No `clientSecret` exposed in responses or client code
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Origin validation implemented using existing `getEnvironmentToken()` helper
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Proper error handling with appropriate status codes (403 for origin validation, 503 for misoClient not initialized)

9. **Type Safety**: 

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - All interfaces use TypeScript strict mode
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Public APIs use camelCase (no snake_case)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Proper error types for different failure scenarios

10. **Error Handling**: 

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Use try-catch for all async operations
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Server helper returns proper HTTP status codes
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Client helper throws descriptive errors with helpful messages

11. **Testing**: 

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Unit tests for `createClientTokenEndpoint` (origin validation, config generation, error handling)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Unit tests for `autoInitializeDataClient` (config fetching, initialization, caching, error handling)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Integration tests for end-to-end flow
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Mock all external dependencies (fetch, localStorage, Express Request/Response)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Test coverage ≥80% for new code

12. **Documentation**: 

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Update `docs/data-client.md` with "Zero-Config Setup" section
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Update `docs/api-reference.md` with function documentation
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Add usage examples showing one-line initialization
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Document all options and error scenarios
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Document exported types (`ClientTokenResponse`, `DataClientConfigResponse`, `hasConfig`)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Include type usage examples for developers who want to create custom endpoints

13. **Exports**: 

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Export `createClientTokenEndpoint` and all related types from `src/express/index.ts`:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `ClientTokenEndpointOptions`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `ClientTokenResponse`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `DataClientConfigResponse`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `hasConfig` type guard function
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Export `autoInitializeDataClient` and `AutoInitOptions` from `src/index.ts`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Update main exports appropriately
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Ensure all types are properly exported for developer use

14. **Backward Compatibility**: 

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Existing `getEnvironmentToken()` usage continues to work
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Existing DataClient initialization patterns still work
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - New helpers are opt-in additions

15. All tasks completed
16. Code follows all standards from Architecture Patterns, Code Style, Security Guidelines, and Testing Conventions sections

---

## Plan Validation Report

**Date**: 2025-01-27

**Plan**: `.cursor/plans/21-server-provided_dataclient_configuration.plan.md`

**Status**: ✅ VALIDATED

### Plan Purpose

Create zero-config server-provided DataClient configuration system. Move all configuration logic into `@aifabrix/miso-client` package:

- **Server-side**: Express route handler helper `createClientTokenEndpoint()` that automatically enriches client-token response with DataClient config
- **Client-side**: Browser helper `autoInitializeDataClient()` that fetches config and initializes DataClient automatically

**Scope**: Express utilities, Data Client, HTTP client integration, configuration management, security (origin validation), documentation

**Type**: Express Utilities + Data Client + Infrastructure

**Key Components**:

- `src/express/client-token-endpoint.ts` (new)
- `src/utils/data-client-auto-init.ts` (new)
- Express route handler pattern
- Browser initialization pattern
- Config caching strategy

### Applicable Rules

- ✅ **[Architecture Patterns - Express Utilities](.cursor/rules/project-rules.mdc#architecture-patterns)** - Express middleware pattern, route handler structure
- ✅ **[Architecture Patterns - HTTP Client Pattern](.cursor/rules/project-rules.mdc#architecture-patterns)** - Token management, client token handling
- ✅ **[Architecture Patterns - Token Management](.cursor/rules/project-rules.mdc#architecture-patterns)** - Client token handling, never expose clientSecret
- ✅ **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#code-style)** - Strict TypeScript, interfaces for public APIs
- ✅ **[Code Style - Naming Conventions](.cursor/rules/project-rules.mdc#code-style)** - camelCase for all public API outputs
- ✅ **[Error Handling](.cursor/rules/project-rules.mdc#code-style)** - Try-catch for async operations
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, ≥80% coverage
- ✅ **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Never expose clientSecret, origin validation
- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-size-guidelines)** - File size limits, JSDoc requirements
- ✅ **[File Organization](.cursor/rules/project-rules.mdc#file-organization)** - Express utilities structure, export strategy
- ✅ **[Documentation](.cursor/rules/project-rules.mdc#documentation)** - JSDoc comments, update docs/

### Rule Compliance

- ✅ **DoD Requirements**: Documented with BUILD → LINT → TEST sequence
- ✅ **Architecture Patterns**: Plan follows Express utilities pattern and uses existing `getEnvironmentToken()` helper
- ✅ **Security Guidelines**: Plan explicitly avoids exposing clientSecret, uses origin validation
- ✅ **Code Style**: Plan specifies camelCase for all public APIs, TypeScript interfaces
- ✅ **Error Handling**: Plan includes error handling with proper status codes
- ✅ **Testing Conventions**: Plan includes comprehensive testing strategy with ≥80% coverage requirement
- ✅ **Code Quality Standards**: Plan includes file size limits and JSDoc requirements
- ✅ **File Organization**: Plan follows proper structure (Express utilities in `src/express/`, utils in `src/utils/`)
- ✅ **Documentation**: Plan includes documentation updates for `docs/data-client.md` and `docs/api-reference.md`

### Plan Updates Made

- ✅ Added **Rules and Standards** section with all applicable rule references
- ✅ Added **Before Development** checklist with prerequisites and review items
- ✅ Added **Definition of Done** section with complete DoD requirements:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Build step (npm run build)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Lint step (npm run lint with zero errors)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Test step (npm test with ≥80% coverage)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Validation order (BUILD → LINT → TEST)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - File size limits (≤500 lines, methods ≤20-30 lines)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - JSDoc documentation requirements
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Security requirements (no clientSecret exposure, origin validation)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Type safety requirements (camelCase, strict TypeScript)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Error handling requirements
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Testing requirements (unit tests, integration tests, mocking)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Documentation requirements
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Export requirements
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Backward compatibility requirements
- ✅ Added rule links using anchor format (`.cursor/rules/project-rules.mdc#section-name`)
- ✅ Preserved all existing plan content

### Recommendations

1. **Implementation Priority**: 

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Start with server-side helper (`createClientTokenEndpoint`) as it's simpler and builds on existing `getEnvironmentToken()` helper
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Then implement client-side helper (`autoInitializeDataClient`) which depends on server response format

2. **Testing Strategy**:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Mock Express Request/Response objects for server-side tests
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Mock `fetch` and `localStorage` for client-side tests
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Test error scenarios thoroughly (network errors, invalid responses, missing config)

3. **Security Considerations**:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Ensure `clientSecret` is never included in config response
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Verify origin validation is working correctly in `getEnvironmentToken()` helper
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Test with various origin scenarios (valid, invalid, wildcard ports)

4. **Backward Compatibility**:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Ensure existing `getEnvironmentToken()` usage continues to work unchanged
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - New config in response should be optional (backward compatible)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Existing DataClient initialization should continue to work

5. **Documentation**:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Add clear examples showing before/after comparison
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Document all options and error scenarios
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Include troubleshooting section for common issues

### Validation Status

✅ **VALIDATED** - Plan is production-ready with:

- All DoD requirements documented
- All applicable rules referenced
- Complete implementation details
- Comprehensive testing strategy
- Security considerations addressed
- Documentation updates planned
- Backward compatibility maintained

The plan is ready for implementation.