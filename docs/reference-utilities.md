# Utilities API Reference

Complete API reference for utility functions in the MisoClient SDK: Express utilities, standalone utilities, pagination, filtering, and sorting.

## Table of Contents

- [Express Utilities](#express-utilities)
- [Standalone Utilities](#standalone-utilities)
  - [resolveControllerUrl](#resolvecontrollerurlconfig-misoclientconfig-string)
  - [isBrowser](#isbrowser-boolean)
  - [validateUrl](#validateurlurl-string-boolean)
  - [getCachedDataClientConfig](#getcacheddataclientconfig-dataclientconfigresponse--null)
- [Pagination Utilities](#pagination-utilities)
- [Filter Utilities](#filter-utilities)
- [Sort Utilities](#sort-utilities)
- [Examples](#examples)
- [See Also](#see-also)

## Express Utilities

Express.js utilities for building REST APIs with MisoClient integration.

### `createClientTokenEndpoint(misoClient, options?)`

Creates an Express route handler for client-token endpoint that automatically enriches the response with DataClient configuration.

**Parameters:**

- `misoClient` - MisoClient instance (must be initialized)
- `options` - Optional configuration:
  - `clientTokenUri?: string` - Client token endpoint URI (default: `/api/v1/auth/client-token`)
  - `expiresIn?: number` - Token expiration time in seconds (default: `1800`)
  - `includeConfig?: boolean` - Whether to include DataClient config in response (default: `true`)

**Returns:** Express route handler function `(req: Request, res: Response) => Promise<void>`

**Example:**

```typescript
import { MisoClient, createClientTokenEndpoint, loadConfig } from '@aifabrix/miso-client';

const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

// One line - automatically includes DataClient config in response
app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient));
```

**Response format:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 1800,
  "config": {
    "baseUrl": "http://localhost:3083",
    "controllerUrl": "https://controller.aifabrix.ai",
    "controllerPublicUrl": "https://controller.aifabrix.ai",
    "clientId": "ctrl-dev-my-app",
    "clientTokenUri": "/api/v1/auth/client-token"
  }
}
```

**Custom options:**

```typescript
app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient, {
  clientTokenUri: '/custom/token',
  expiresIn: 3600,
  includeConfig: true,
}));
```

**Error handling:**

- Returns `503` if MisoClient is not initialized
- Returns `403` if origin validation fails
- Returns `500` if controller URL is not configured or other errors occur

### `autoInitializeDataClient(options?)`

Automatically fetches configuration from server and initializes DataClient. Browser-only function.

**Parameters:**

- `options` - Optional configuration:
  - `clientTokenUri?: string` - Client token endpoint URI (default: `/api/v1/auth/client-token`)
  - `baseUrl?: string` - Override baseUrl detection (auto-detected from `window.location.origin` if not provided)
  - `onError?: (error: Error) => void` - Error callback
  - `cacheConfig?: boolean` - Cache config in localStorage (default: `true`)

**Returns:** Promise that resolves to initialized DataClient instance

**Throws:** Error if initialization fails (e.g., not in browser, network error, invalid response)

**Example:**

```typescript
import { autoInitializeDataClient } from '@aifabrix/miso-client';

// One line - automatically fetches config and initializes DataClient
const dataClient = await autoInitializeDataClient();
```

**Custom options:**

```typescript
const dataClient = await autoInitializeDataClient({
  clientTokenUri: '/api/v1/auth/client-token',
  baseUrl: 'https://api.example.com',
  onError: (error) => console.error('Init failed:', error),
  cacheConfig: true,
});
```

**What it does:**

1. Detects if running in browser
2. Checks localStorage cache first (if enabled)
3. Fetches config from server endpoint
4. Extracts `config` from response
5. Initializes DataClient with server-provided config
6. Caches config in localStorage for future page loads

**Error handling:**

```typescript
try {
  const dataClient = await autoInitializeDataClient();
} catch (error) {
  if (error.message.includes('config not found')) {
    console.error('Server endpoint must use createClientTokenEndpoint() helper');
  } else if (error.message.includes('Unable to detect baseUrl')) {
    console.error('Provide baseUrl option or ensure window.location.origin is available');
  } else {
    console.error('Initialization failed:', error);
  }
}
```

## Logging Utilities

Utilities for extracting structured logging context from objects and Express Request objects.

### `extractLoggingContext(options): IndexedLoggingContext`

Extracts indexed logging context fields from source, record, and external system objects. These fields are stored at the top level of `LogEntry` for efficient database queries.

**Parameters:**

- `options` - Options object containing:
  - `source?: HasExternalSystem` - Source object with key, displayName, and optional externalSystem
  - `record?: HasKey` - Record object with key and optional displayName
  - `externalSystem?: HasKey` - External system object with key and optional displayName

**Returns:** `IndexedLoggingContext` with extracted fields

**Interfaces:**

```typescript
interface HasKey {
  key: string;
  displayName?: string;
}

interface HasExternalSystem extends HasKey {
  externalSystem?: HasKey;
}

interface IndexedLoggingContext {
  sourceKey?: string;
  sourceDisplayName?: string;
  externalSystemKey?: string;
  externalSystemDisplayName?: string;
  recordKey?: string;
  recordDisplayName?: string;
}
```

**Example:**

```typescript
import { extractLoggingContext } from '@aifabrix/miso-client';

const logContext = extractLoggingContext({
  source: {
    key: 'datasource-1',
    displayName: 'PostgreSQL DB',
    externalSystem: { key: 'system-1', displayName: 'External API' }
  },
  record: { key: 'record-123', displayName: 'User Profile' }
});

await client.log
  .withIndexedContext(logContext)
  .error('Sync failed');
```

### `extractRequestContext(req: Request): RequestContext`

Extracts logging context from Express Request object. Automatically extracts IP, method, path, user-agent, correlation ID, referer, user from JWT, and request size.

**Parameters:**

- `req` - Express Request object

**Returns:** `RequestContext` with extracted fields

**Interface:**

```typescript
interface RequestContext {
  ipAddress?: string;
  method?: string;
  path?: string;
  userAgent?: string;
  correlationId?: string;
  referer?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  requestSize?: number;
}
```

**Example:**

```typescript
import { extractRequestContext } from '@aifabrix/miso-client';
import { Request } from 'express';

app.get('/api/users', async (req: Request, res) => {
  const ctx = extractRequestContext(req);
  // ctx contains: ipAddress, method, path, userAgent, correlationId, userId, etc.
  
  await client.log
    .withRequest(req)
    .info('Users list accessed');
});
```

**Auto-extracted Fields:**

- `ipAddress` - Client IP (handles `x-forwarded-for` proxy headers)
- `method` - HTTP method (GET, POST, etc.)
- `path` - Request path (`req.originalUrl` or `req.path`)
- `userAgent` - Browser/client user agent
- `correlationId` - From `x-correlation-id`, `x-request-id`, or `request-id` headers
- `referer` - Referer header
- `userId` - Extracted from JWT token in `Authorization` header (checks `sub`, `userId`, `user_id`, `id` claims)
- `sessionId` - Extracted from JWT token (`sessionId` or `sid` claim)
- `requestId` - From `x-request-id` header
- `requestSize` - From `content-length` header (parsed as integer)

## Standalone Utilities

The SDK exports standalone utility functions that can be used without creating a MisoClient instance. These utilities are useful for environment detection, URL resolution, and configuration validation.

### `resolveControllerUrl(config: MisoClientConfig): string`

Resolves the appropriate controller URL based on environment (browser vs server) and configuration (public vs private URLs). This is the same logic used internally by MisoClient.

**Priority Order:**

1. Environment-specific URL (`controllerPublicUrl` for browser, `controllerPrivateUrl` for server)
2. Fallback to `controllerUrl` if environment-specific URL not provided
3. Throws error if no URL available

**Parameters:**

- `config` - MisoClientConfig object

**Returns:** Resolved controller URL string

**Throws:** Error if no valid URL is available or URL format is invalid

**Example:**

```typescript
import { resolveControllerUrl, MisoClientConfig } from '@aifabrix/miso-client';

// Browser environment - uses controllerPublicUrl
const browserConfig: MisoClientConfig = {
  controllerPublicUrl: 'https://controller.aifabrix.ai',
  controllerPrivateUrl: 'http://miso-controller:3010',
  controllerUrl: 'http://localhost:3000', // Fallback
  clientId: 'my-app',
};

// In browser: resolves to controllerPublicUrl
const browserUrl = resolveControllerUrl(browserConfig);
console.log(browserUrl); // 'https://controller.aifabrix.ai'

// Server environment - uses controllerPrivateUrl
const serverConfig: MisoClientConfig = {
  controllerPublicUrl: 'https://controller.aifabrix.ai',
  controllerPrivateUrl: 'http://miso-controller:3010',
  controllerUrl: 'http://localhost:3000', // Fallback
  clientId: 'my-app',
};

// On server: resolves to controllerPrivateUrl
const serverUrl = resolveControllerUrl(serverConfig);
console.log(serverUrl); // 'http://miso-controller:3010'

// Fallback to controllerUrl when environment-specific URL not provided
const fallbackConfig: MisoClientConfig = {
  controllerUrl: 'http://localhost:3000', // Used as fallback
  clientId: 'my-app',
};

const fallbackUrl = resolveControllerUrl(fallbackConfig);
console.log(fallbackUrl); // 'http://localhost:3000'

// Error handling
try {
  const invalidConfig: MisoClientConfig = {
    clientId: 'my-app',
    // No URLs provided
  };
  resolveControllerUrl(invalidConfig);
} catch (error) {
  console.error(error.message);
  // "No controller URL configured. Please provide controllerPublicUrl or controllerUrl in your configuration."
}
```

**Use Cases:**

- Pre-validating configuration before creating MisoClient
- Conditional logic based on resolved URL
- Testing and debugging URL resolution
- Custom URL resolution logic

### `isBrowser(): boolean`

Detects if code is running in a browser environment by checking for browser globals (window, localStorage, fetch). This is the same detection logic used internally by the SDK.

**Returns:** `true` if running in browser, `false` if running in server environment

**Detection Method:**

Checks for presence of `window`, `localStorage`, and `fetch` globals on `globalThis`.

**Example:**

```typescript
import { isBrowser } from '@aifabrix/miso-client';

// Basic usage
if (isBrowser()) {
  console.log('Running in browser');
  // Use browser-specific APIs
  const token = localStorage.getItem('token');
} else {
  console.log('Running on server');
  // Use server-specific APIs
  const token = process.env.TOKEN;
}

// Conditional configuration
const config = {
  controllerUrl: isBrowser()
    ? 'https://controller.aifabrix.ai' // Public URL for browser
    : 'http://miso-controller:3010',   // Private URL for server
  clientId: 'my-app',
};

// Testing environment detection
console.log('Environment:', isBrowser() ? 'Browser' : 'Server');
```

**Use Cases:**

- Conditional logic based on environment
- Environment-specific configuration
- Testing and debugging environment detection
- Custom environment-aware logic

**See Also:**

- [Public and Private Controller URLs](./configuration.md#public-and-private-controller-urls) - Complete configuration guide
- [Advanced: Manual URL Resolution](./configuration.md#advanced-manual-url-resolution) - Advanced usage examples

### `validateUrl(url: string): boolean`

Validates that a URL string is a valid HTTP or HTTPS URL. Useful for validating URLs before use in application code.

**Parameters:**

- `url` - URL string to validate

**Returns:** `true` if URL is valid HTTP or HTTPS, `false` otherwise

**Example:**

```typescript
import { validateUrl } from '@aifabrix/miso-client';

// Valid URLs
validateUrl('https://example.com'); // true
validateUrl('http://localhost:3000'); // true

// Invalid URLs
validateUrl('ftp://example.com'); // false
validateUrl('javascript:alert(1)'); // false
validateUrl('invalid'); // false

// Usage in application code
const userInput = 'https://example.com';
if (validateUrl(userInput)) {
  window.location.href = userInput;
} else {
  console.error('Invalid URL');
}
```

**Use Cases:**

- Validating user-provided URLs
- Pre-validating configuration URLs
- Security checks before redirects
- Testing and debugging URL formats

### `getCachedDataClientConfig(): DataClientConfigResponse | null`

Gets the cached DataClient configuration from localStorage without re-initializing DataClient. Useful for accessing configuration values that were cached by `autoInitializeDataClient()`.

**Returns:** Cached configuration object or `null` if not found or expired

**Example:**

```typescript
import { getCachedDataClientConfig } from '@aifabrix/miso-client';

// Read cached configuration
const cachedConfig = getCachedDataClientConfig();
if (cachedConfig) {
  console.log('Base URL:', cachedConfig.baseUrl);
  console.log('Controller URL:', cachedConfig.controllerUrl);
  console.log('Client ID:', cachedConfig.clientId);
  console.log('Client Token URI:', cachedConfig.clientTokenUri);
} else {
  console.log('No cached configuration found');
}
```

**Use Cases:**

- Accessing configuration values without re-initializing DataClient
- Reading configuration in application code
- Debugging configuration issues
- Conditional logic based on cached configuration

**Note:** This function only works in browser environments and requires that `autoInitializeDataClient()` has been called previously with `cacheConfig: true` (default).

## Pagination Utilities

Utilities for parsing and constructing paginated responses. All functions use **snake_case** naming conventions following enterprise application best practices and industry standards (ISO 27001 compliant).

### Meta Interface

Pagination metadata returned in API responses.

```typescript
interface Meta {
  /** Total number of items available in full dataset. */
  totalItems: number;
  /** Current page index (1-based). Maps from `page` query parameter. */
  currentPage: number;
  /** Number of items per page. Maps from `page_size` query parameter. */
  pageSize: number;
  /** Logical resource type (e.g., "application", "environment"). */
  type: string;
}
```

### PaginatedListResponse Interface

Standard paginated list response envelope.

```typescript
interface PaginatedListResponse<T> {
  /** Pagination metadata. */
  meta: Meta;
  /** Array of items for the current page. */
  data: T[];
}
```

### `parsePaginationParams(query: Record<string, unknown>): { currentPage: number; pageSize: number }`

Parses query parameters into pagination values. The `page` query parameter (1-based) is mapped to `currentPage` in the result.

**Parameters:**

- `query` - Query parameters object (e.g., from URLSearchParams or request query)

**Returns:** Object with `currentPage` (1-based) and `pageSize`

**Example:**

```typescript
import { parsePaginationParams } from '@aifabrix/miso-client';

// From URL query: ?page=2&page_size=25
const { currentPage, pageSize } = parsePaginationParams({
  page: '2',
  page_size: '25'
});
// Returns: { currentPage: 2, pageSize: 25 }

// Defaults to page 1, pageSize 20 if not provided
const defaults = parsePaginationParams({});
// Returns: { currentPage: 1, pageSize: 20 }
```

### `createMetaObject(totalItems: number, currentPage: number, pageSize: number, type: string): Meta`

Constructs a Meta object for API responses.

**Parameters:**

- `totalItems` - Total number of items available in full dataset
- `currentPage` - Current page index (1-based)
- `pageSize` - Number of items per page
- `type` - Logical resource type (e.g., "application", "environment")

**Returns:** Meta object

**Example:**

```typescript
import { createMetaObject } from '@aifabrix/miso-client';

const meta = createMetaObject(120, 1, 25, 'application');
// Returns: {
//   totalItems: 120,
//   currentPage: 1,
//   pageSize: 25,
//   type: 'application'
// }
```

### `applyPaginationToArray<T>(items: T[], currentPage: number, pageSize: number): T[]`

Applies pagination to an array (useful for mocks/tests).

**Parameters:**

- `items` - Array of items to paginate
- `currentPage` - Current page index (1-based)
- `pageSize` - Number of items per page

**Returns:** Paginated slice of the array

**Example:**

```typescript
import { applyPaginationToArray } from '@aifabrix/miso-client';

const allItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const page1 = applyPaginationToArray(allItems, 1, 5);
// Returns: [1, 2, 3, 4, 5]

const page2 = applyPaginationToArray(allItems, 2, 5);
// Returns: [6, 7, 8, 9, 10]
```

### `createPaginatedListResponse<T>(items: T[], totalItems: number, currentPage: number, pageSize: number, type: string): PaginatedListResponse<T>`

Wraps an array and metadata into a standard paginated response.

**Parameters:**

- `items` - Array of items for the current page
- `totalItems` - Total number of items available in full dataset
- `currentPage` - Current page index (1-based)
- `pageSize` - Number of items per page
- `type` - Logical resource type (e.g., "application", "environment")

**Returns:** PaginatedListResponse object

**Example:**

```typescript
import { createPaginatedListResponse } from '@aifabrix/miso-client';

const items = [{ id: 1, name: 'App 1' }, { id: 2, name: 'App 2' }];
const response = createPaginatedListResponse(items, 50, 1, 25, 'application');
// Returns: {
//   meta: {
//     totalItems: 50,
//     currentPage: 1,
//     pageSize: 25,
//     type: 'application'
//   },
//   data: [{ id: 1, name: 'App 1' }, { id: 2, name: 'App 2' }]
// }
```

## Filter Utilities

Utilities for parsing and building filter queries. All functions use **camelCase** naming conventions following TypeScript best practices and industry standards (ISO 27001 compliant).

### FilterOperator Type

Filter operators supported by the API.

```typescript
type FilterOperator =
  | 'eq'        // Equals
  | 'neq'       // Not equals
  | 'in'        // In array
  | 'nin'       // Not in array
  | 'gt'        // Greater than
  | 'lt'        // Less than
  | 'gte'       // Greater than or equal
  | 'lte'       // Less than or equal
  | 'contains'  // String contains
  | 'like'      // Pattern match (case-insensitive)
  | 'ilike'     // Pattern match (PostgreSQL case-insensitive LIKE)
  | 'isNull'    // Field is null
  | 'isNotNull'; // Field is not null
```

### FilterOption Interface

Single filter option with field, operator, and value.

```typescript
interface FilterOption {
  /** Field name to filter on. */
  field: string;
  /** Filter operator. */
  op: FilterOperator;
  /** Filter value (supports arrays for `in` and `nin` operators, null for `isNull` and `isNotNull`). */
  value: string | number | boolean | Array<string | number> | null;
}
```

### FilterQuery Interface

Complete filter query including filters, sorting, pagination, and field selection.

```typescript
interface FilterQuery {
  /** Array of filter options. */
  filters?: FilterOption[];
  /** Array of sort fields (e.g., `['-updated_at', 'name']` where `-` prefix means descending). */
  sort?: string[];
  /** Page number (1-based). */
  page?: number;
  /** Number of items per page. */
  pageSize?: number;
  /** Array of field names to include in response (field projection). */
  fields?: string[];
}
```

### FilterBuilder Class

Builder class for dynamic filter construction. Supports fluent API for building complex filter queries.

```typescript
class FilterBuilder {
  /**
   * Add a single filter to the builder.
   * @param field - Field name to filter on
   * @param op - Filter operator
   * @param value - Filter value (supports arrays for `in` and `nin`)
   * @returns FilterBuilder instance for method chaining
   */
  add(field: string, op: FilterOperator, value: string | number | boolean | Array<string | number>): FilterBuilder;

  /**
   * Add multiple filters at once.
   * @param filters - Array of filter options to add
   * @returns FilterBuilder instance for method chaining
   */
  addMany(filters: FilterOption[]): FilterBuilder;

  /**
   * Build and return the filter array.
   * @returns Array of filter options
   */
  build(): FilterOption[];

  /**
   * Convert filters to query string format using JSON format.
   * @returns Query string with URL-encoded JSON filter format
   */
  toQueryString(): string;
}
```

**Example:**

```typescript
import { FilterBuilder } from '@aifabrix/miso-client';

// Build filters dynamically
const filterBuilder = new FilterBuilder()
  .add('status', 'eq', 'active')
  .add('region', 'in', ['eu', 'us'])
  .add('created_at', 'gte', '2024-01-01');

// Get filter array
const filters = filterBuilder.build();
// Returns: [
//   { field: 'status', op: 'eq', value: 'active' },
//   { field: 'region', op: 'in', value: ['eu', 'us'] },
//   { field: 'created_at', op: 'gte', value: '2024-01-01' }
// ]

// Convert to query string (JSON format, URL-encoded)
const queryString = filterBuilder.toQueryString();
// Returns: "filter=%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%2C%22region%22%3A%7B%22in%22%3A%5B%22eu%22%2C%22us%22%5D%7D%2C%22created_at%22%3A%7B%22gte%22%3A%222024-01-01%22%7D%7D"
// Decoded: {"status":{"eq":"active"},"region":{"in":["eu","us"]},"created_at":{"gte":"2024-01-01"}}
```

### `parseFilterParams(query: Record<string, unknown>): FilterOption[]`

Parses filter query parameters into structured FilterOption array. Supports both JSON format and colon format.

**Supported Formats:**

**JSON Format:**
- Direct object: `{"status": {"eq": "active"}}`
- JSON string: `'{"status": {"eq": "active"}}'`
- URL-encoded JSON: `'%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%7D'` (for query strings)
- Array of filters: `[{"status": {"eq": "active"}}, {"region": {"in": ["eu", "us"]}}]`

**Colon Format:**
- Simple: `field:operator:value` (e.g., `status:eq:active`)
- Array values: `field:operator:value1,value2` (e.g., `region:in:eu,us`)
- Null checks: `field:isNull:` or `field:isNotNull:`
- Timestamps with colons: `createdAt:gte:2024-01-01T12:00:00` (colons in value preserved)

**Parameters:**

- `query` - Query parameters object (e.g., from URLSearchParams or request query)

**Returns:** Array of parsed filter options

**Example:**

```typescript
import { parseFilterParams } from '@aifabrix/miso-client';

// JSON format
const jsonFilters = parseFilterParams({
  filter: '{"status": {"eq": "active"}, "region": {"in": ["eu", "us"]}}'
});
// Returns: [
//   { field: 'status', op: 'eq', value: 'active' },
//   { field: 'region', op: 'in', value: ['eu', 'us'] }
// ]

// Colon format (single filter)
const colonFilter = parseFilterParams({ filter: 'status:eq:active' });
// Returns: [{ field: 'status', op: 'eq', value: 'active' }]

// Colon format (multiple filters as array)
const multipleFilters = parseFilterParams({
  filter: ['status:eq:active', 'region:in:eu,us', 'deletedAt:isNull:']
});
// Returns: [
//   { field: 'status', op: 'eq', value: 'active' },
//   { field: 'region', op: 'in', value: ['eu', 'us'] },
//   { field: 'deletedAt', op: 'isNull', value: null }
// ]

// Colon format with timestamp (colons in value preserved)
const timestampFilter = parseFilterParams({
  filter: 'createdAt:gte:2024-01-01T12:00:00'
});
// Returns: [{ field: 'createdAt', op: 'gte', value: '2024-01-01T12:00:00' }]

// Direct object format
const filters2 = parseFilterParams({
  filter: { status: { eq: 'active' }, age: { gte: 18 } }
});
// Returns: [
//   { field: 'status', op: 'eq', value: 'active' },
//   { field: 'age', op: 'gte', value: 18 }
// ]

// Null checks
const filters3 = parseFilterParams({
  filter: { deletedAt: { isNull: null }, email: { isNotNull: null } }
});
// Returns: [
//   { field: 'deletedAt', op: 'isNull', value: null },
//   { field: 'email', op: 'isNotNull', value: null }
// ]
```

### `buildQueryString(options: FilterQuery): string`

Builds query string from FilterQuery object using JSON format for filters.

**Parameters:**

- `options` - FilterQuery object with filters, sort, pagination, and field selection

**Returns:** Query string with URL-encoded JSON filter format (e.g., `?filter=%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%7D&sort=-updated_at&page=1&page_size=25`)

**Example:**

```typescript
import { buildQueryString, FilterBuilder } from '@aifabrix/miso-client';

const filterBuilder = new FilterBuilder()
  .add('status', 'eq', 'active')
  .add('age', 'gte', 18);

const queryString = buildQueryString({
  filters: filterBuilder.build(),
  sort: ['-updated_at'],
  page: 1,
  pageSize: 25
});
// Returns: "filter=%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%2C%22age%22%3A%7B%22gte%22%3A18%7D%7D&sort=-updated_at&page=1&page_size=25"
// Decoded filter: {"status":{"eq":"active"},"age":{"gte":18}}
```

### `applyFilters<T extends Record<string, unknown>>(data: T[], filters: FilterOption[]): T[]`

Applies filters locally to an array (used for mocks/tests).

**Parameters:**

- `data` - Array of items to filter
- `filters` - Array of filter options to apply

**Returns:** Filtered array

**Example:**

```typescript
import { applyFilters } from '@aifabrix/miso-client';

const items = [
  { id: 1, status: 'active', region: 'eu' },
  { id: 2, status: 'inactive', region: 'us' },
  { id: 3, status: 'active', region: 'eu' }
];

const filters = [
  { field: 'status', op: 'eq', value: 'active' },
  { field: 'region', op: 'eq', value: 'eu' }
];

const filtered = applyFilters(items, filters);
// Returns: [
//   { id: 1, status: 'active', region: 'eu' },
//   { id: 3, status: 'active', region: 'eu' }
// ]
```

### `validateJsonFilter(filter: unknown): void`

Validates JSON filter structure. Throws error if filter format is invalid.

**Parameters:**

- `filter` - Filter object to validate

**Throws:** Error if filter structure is invalid

**Example:**

```typescript
import { validateJsonFilter } from '@aifabrix/miso-client';

// Valid filter
validateJsonFilter({ status: { eq: 'active' } }); // OK

// Invalid filter - throws error
try {
  validateJsonFilter({ status: 'active' }); // Error: Field 'status' must have operator dictionary
} catch (error) {
  console.error(error.message);
}
```

### `filterQueryToJson(filterQuery: FilterQuery): Record<string, Record<string, unknown>>`

Converts FilterQuery to JSON filter format. Useful for serialization and debugging.

**Parameters:**

- `filterQuery` - FilterQuery object to convert

**Returns:** JSON filter object (e.g., `{"status": {"eq": "active"}}`)

**Example:**

```typescript
import { filterQueryToJson, FilterBuilder } from '@aifabrix/miso-client';

const filterBuilder = new FilterBuilder()
  .add('status', 'eq', 'active')
  .add('age', 'gte', 18);

const jsonFilter = filterQueryToJson({
  filters: filterBuilder.build()
});
// Returns: { status: { eq: 'active' }, age: { gte: 18 } }
```

### `jsonToFilterQuery(jsonFilter: Record<string, Record<string, unknown>>): FilterQuery`

Converts JSON filter format to FilterQuery. Convenience wrapper around `parseFilterParams()`.

**Parameters:**

- `jsonFilter` - JSON filter object (e.g., `{"status": {"eq": "active"}}`)

**Returns:** FilterQuery object

**Example:**

```typescript
import { jsonToFilterQuery } from '@aifabrix/miso-client';

const filterQuery = jsonToFilterQuery({
  status: { eq: 'active' },
  age: { gte: 18 },
  region: { in: ['eu', 'us'] }
});
// Returns: {
//   filters: [
//     { field: 'status', op: 'eq', value: 'active' },
//     { field: 'age', op: 'gte', value: 18 },
//     { field: 'region', op: 'in', value: ['eu', 'us'] }
//   ]
// }
```

## Filter Schema Utilities

Utilities for schema-based filter validation and SQL compilation. These utilities enable type-safe filtering with validation against field schemas, automatic value coercion, and PostgreSQL-safe parameterized SQL generation.

### Filter Schema Types

```typescript
/** Field data types for filter schema validation. */
type FilterFieldType = 'string' | 'number' | 'boolean' | 'uuid' | 'timestamp' | 'enum';

/** Definition of a filterable field in a schema. */
interface FilterFieldDefinition {
  column: string;            // Actual database column name
  type: FilterFieldType;     // Field data type for validation
  operators: FilterOperator[]; // Allowed operators for this field
  enumValues?: string[];     // Allowed values for enum type fields
  nullable?: boolean;        // Enables isNull/isNotNull operators
  description?: string;      // Human-readable description
}

/** Schema defining filterable fields for a resource. */
interface FilterSchema {
  resource: string;          // Resource name (e.g., "applications")
  version?: string;          // Schema version for compatibility tracking
  fields: Record<string, FilterFieldDefinition>;
}

/** Filter validation error following RFC 7807 Problem Details structure. */
interface FilterValidationError {
  code: string;              // Error code (e.g., "INVALID_OPERATOR")
  message: string;           // Human-readable error message
  field?: string;            // Field that caused the error
  operator?: string;         // Operator that caused the error
  value?: unknown;           // Value that caused the error
  allowedOperators?: string[]; // List of allowed operators
  allowedValues?: string[];  // List of allowed values (for enum)
}

/** Compiled filter result with parameterized SQL. */
interface CompiledFilter {
  sql: string;               // SQL WHERE clause
  params: unknown[];         // Parameter values in order
}
```

### Default Operators by Field Type

| Type | Default Operators |
|------|-------------------|
| string | eq, neq, in, nin, contains, like, ilike |
| number | eq, neq, gt, gte, lt, lte, in, nin |
| boolean | eq |
| uuid | eq, in |
| timestamp | eq, gt, gte, lt, lte |
| enum | eq, in |

### `createFilterSchema(resource, fields, version?): FilterSchema`

Create a filter schema with default operators per field type.

```typescript
import { createFilterSchema } from '@aifabrix/miso-client';

const schema = createFilterSchema('applications', {
  name: { column: 'name', type: 'string' },
  status: { 
    column: 'status', 
    type: 'enum', 
    enumValues: ['active', 'disabled', 'deleted'],
    operators: ['eq', 'in']  // Override default operators
  },
  createdAt: { column: 'created_at', type: 'timestamp' },
  environmentId: { column: 'environment_id', type: 'uuid' },
  deletedAt: { column: 'deleted_at', type: 'timestamp', nullable: true }
});
```

### `validateFilter(filter, schema): FilterValidationError | null`

Validate a single filter against a schema. Returns error if invalid, null if valid.

```typescript
import { validateFilter, createFilterSchema, FilterErrorCode } from '@aifabrix/miso-client';

const schema = createFilterSchema('applications', {
  status: { column: 'status', type: 'enum', enumValues: ['active', 'disabled'], operators: ['eq', 'in'] }
});

// Valid filter
const error1 = validateFilter({ field: 'status', op: 'eq', value: 'active' }, schema);
// Returns: null (valid)

// Invalid operator
const error2 = validateFilter({ field: 'status', op: 'ilike', value: 'test' }, schema);
// Returns: { 
//   code: 'INVALID_OPERATOR', 
//   message: "Operator 'ilike' is not allowed for field 'status'",
//   field: 'status',
//   operator: 'ilike',
//   allowedOperators: ['eq', 'in']
// }

// Invalid enum value
const error3 = validateFilter({ field: 'status', op: 'eq', value: 'invalid' }, schema);
// Returns: {
//   code: 'INVALID_ENUM',
//   message: "Invalid value 'invalid' for field 'status'. Allowed: active, disabled",
//   allowedValues: ['active', 'disabled']
// }
```

### `validateFilters(filters, schema): FilterValidationResult`

Validate multiple filters against a schema.

```typescript
import { validateFilters, createFilterSchema } from '@aifabrix/miso-client';

const schema = createFilterSchema('applications', {
  name: { column: 'name', type: 'string' },
  status: { column: 'status', type: 'enum', enumValues: ['active', 'disabled'], operators: ['eq'] }
});

const result = validateFilters([
  { field: 'name', op: 'eq', value: 'test' },
  { field: 'unknown', op: 'eq', value: 'value' },  // Unknown field
  { field: 'status', op: 'ilike', value: 'test' }  // Invalid operator
], schema);

// Returns: {
//   valid: false,
//   errors: [
//     { code: 'UNKNOWN_FIELD', message: "Field 'unknown' is not allowed...", field: 'unknown' },
//     { code: 'INVALID_OPERATOR', message: "Operator 'ilike' is not allowed...", field: 'status' }
//   ]
// }
```

### `compileFilter(filters, schema, logic?): CompiledFilter`

Compile filters to PostgreSQL-safe parameterized SQL.

```typescript
import { compileFilter, createFilterSchema } from '@aifabrix/miso-client';

const schema = createFilterSchema('applications', {
  name: { column: 'name', type: 'string' },
  status: { column: 'status', type: 'string' },
  priority: { column: 'priority', type: 'number' },
  deletedAt: { column: 'deleted_at', type: 'timestamp', nullable: true }
});

// Single filter
const result1 = compileFilter([
  { field: 'status', op: 'eq', value: 'active' }
], schema);
// Returns: { sql: 'status = $1', params: ['active'] }

// Multiple filters with AND (default)
const result2 = compileFilter([
  { field: 'status', op: 'eq', value: 'active' },
  { field: 'priority', op: 'gte', value: 5 },
  { field: 'name', op: 'ilike', value: '%test%' }
], schema);
// Returns: { 
//   sql: 'status = $1 AND priority >= $2 AND name ILIKE $3', 
//   params: ['active', 5, '%test%'] 
// }

// Multiple filters with OR
const result3 = compileFilter([
  { field: 'status', op: 'eq', value: 'active' },
  { field: 'status', op: 'eq', value: 'pending' }
], schema, 'or');
// Returns: { sql: 'status = $1 OR status = $2', params: ['active', 'pending'] }

// Array operators (in/nin)
const result4 = compileFilter([
  { field: 'status', op: 'in', value: ['active', 'pending'] }
], schema);
// Returns: { sql: 'status = ANY($1)', params: [['active', 'pending']] }

// Null checks (no params)
const result5 = compileFilter([
  { field: 'deletedAt', op: 'isNull', value: null }
], schema);
// Returns: { sql: 'deleted_at IS NULL', params: [] }
```

### Filter Error Codes

| Code | Description |
|------|-------------|
| UNKNOWN_FIELD | Field is not defined in the schema |
| INVALID_OPERATOR | Operator is not allowed for the field type |
| INVALID_TYPE | Value type does not match field type |
| INVALID_UUID | Value is not a valid UUID |
| INVALID_DATE | Value is not a valid timestamp/date |
| INVALID_ENUM | Value is not in the allowed enum values |
| INVALID_IN | 'in' or 'nin' operator requires a non-empty array |
| INVALID_FORMAT | Filter format parsing failed |

### `coerceValue(value, fieldDef): unknown`

Coerce a value to the appropriate type based on field definition.

```typescript
import { coerceValue } from '@aifabrix/miso-client';

// String to number
const num = coerceValue('42', { column: 'priority', type: 'number', operators: ['eq'] });
// Returns: 42

// String to boolean
const bool = coerceValue('true', { column: 'is_public', type: 'boolean', operators: ['eq'] });
// Returns: true

// Timestamp validation
const timestamp = coerceValue('2024-01-01', { column: 'created_at', type: 'timestamp', operators: ['gte'] });
// Returns: '2024-01-01T00:00:00.000Z' (ISO format)
```

### `loadFilterSchema(json): FilterSchema`

Load a filter schema from a JSON object (e.g., from a JSON file).

```typescript
import { loadFilterSchema } from '@aifabrix/miso-client';

const schema = loadFilterSchema({
  resource: 'applications',
  version: '1.0',
  fields: {
    name: { column: 'name', type: 'string', operators: ['eq', 'ilike'] },
    status: { 
      column: 'status', 
      type: 'enum', 
      operators: ['eq', 'in'],
      enumValues: ['active', 'disabled']
    }
  }
});
```

## Sort Utilities

Utilities for parsing and building sort query parameters. All functions use **camelCase** naming conventions following TypeScript best practices and industry standards (ISO 27001 compliant).

### SortOption Interface

Sort option specifying field and order.

```typescript
interface SortOption {
  /** Field name to sort by. */
  field: string;
  /** Sort order: ascending or descending. */
  order: 'asc' | 'desc';
}
```

### `parseSortParams(query: Record<string, unknown>): SortOption[]`

Parses sort query parameters into structured SortOption array. Supports format: `?sort=-field` (descending) or `?sort=field` (ascending) or `?sort[]=-updated_at&sort[]=name` for multiple sorts.

**Parameters:**

- `query` - Query parameters object (e.g., from URLSearchParams or request query)

**Returns:** Array of parsed sort options

**Example:**

```typescript
import { parseSortParams } from '@aifabrix/miso-client';

// From URL query: ?sort=-updated_at&sort=name
const sortOptions = parseSortParams({
  sort: ['-updated_at', 'name']
});
// Returns: [
//   { field: 'updated_at', order: 'desc' },
//   { field: 'name', order: 'asc' }
// ]

// Single sort
const singleSort = parseSortParams({ sort: '-created_at' });
// Returns: [{ field: 'created_at', order: 'desc' }]
```

### `buildSortString(sortOptions: SortOption[]): string[]`

Converts SortOption array to query string format.

**Parameters:**

- `sortOptions` - Array of sort options

**Returns:** Array of sort strings (e.g., `['-updated_at', 'name']`)

**Example:**

```typescript
import { buildSortString } from '@aifabrix/miso-client';

const sortOptions = [
  { field: 'updated_at', order: 'desc' },
  { field: 'name', order: 'asc' }
];

const sortStrings = buildSortString(sortOptions);
// Returns: ['-updated_at', 'name']
```

## Examples

### Express Utility Usage

```typescript
import express from 'express';
import { MisoClient, createClientTokenEndpoint, loadConfig } from '@aifabrix/miso-client';

const app = express();
const misoClient = new MisoClient(loadConfig());
await misoClient.initialize();

// One line - automatically includes DataClient config in response
app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient));
```

### Pagination Examples

```typescript
import { parsePaginationParams, createPaginatedListResponse } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', async (req, res) => {
  // Parse pagination from query string: ?page=2&page_size=25
  const { currentPage, pageSize } = parsePaginationParams(req.query);
  
  // Fetch data
  const allItems = await fetchAllApplications();
  const totalItems = allItems.length;
  const pageItems = allItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  
  // Create paginated response
  const response = createPaginatedListResponse(
    pageItems,
    totalItems,
    currentPage,
    pageSize,
    'application'
  );
  
  res.json(response);
  // Returns: { meta: { totalItems, currentPage, pageSize, type }, data: [...] }
});
```

### Filtering Examples

```typescript
import { FilterBuilder, parseFilterParams, buildQueryString } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Parse filters from query string with URL-encoded JSON format
  // URL: ?filter=%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%2C%22region%22%3A%7B%22in%22%3A%5B%22eu%22%2C%22us%22%5D%7D%7D
  // Decoded: {"status":{"eq":"active"},"region":{"in":["eu","us"]}}
  const filters = parseFilterParams(req.query);
  // Returns: [
  //   { field: 'status', op: 'eq', value: 'active' },
  //   { field: 'region', op: 'in', value: ['eu', 'us'] }
  // ]
  
  // Build complete query with filters, sort, pagination
  const filterBuilder = new FilterBuilder();
  filters.forEach(filter => {
    filterBuilder.add(filter.field, filter.op, filter.value);
  });
  
  const queryString = buildQueryString({
    filters: filterBuilder.build(),
    sort: ['-updated_at', 'name'],
    page: 1,
    pageSize: 25
  });
  // Returns: "filter=%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%2C%22region%22%3A%7B%22in%22%3A%5B%22eu%22%2C%22us%22%5D%7D%7D&sort=-updated_at&page=1&page_size=25"
  
  // Use queryString in API call
  const url = `/api/applications?${queryString}`;
});
```

### Sorting Examples

```typescript
import { parseSortParams, buildSortString } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Parse sort from query string: ?sort=-updated_at&sort=name
  const sortOptions = parseSortParams(req.query);
  // Returns: [{ field: 'updated_at', order: 'desc' }, { field: 'name', order: 'asc' }]
  
  // Convert to query string format
  const sortStrings = buildSortString(sortOptions);
  // Returns: ['-updated_at', 'name']
  
  // Use in API call
  const url = `/api/applications?sort=${sortStrings.join('&sort=')}`;
});
```

## See Also

- [MisoClient Reference](./reference-misoclient.md) - Main client class
- [DataClient Reference](./reference-dataclient.md) - Browser client
- [Type Reference](./reference-types.md) - Complete type definitions
- [Configuration Guide](./configuration.md) - Configuration options
- [Utilities Examples](./examples/utilities.md) - Pagination, filtering, and sorting examples
