<!-- 3a543a49-e429-4362-b649-54ef1fbc951c 762e730b-90c9-4e3c-afcd-b31826f09460 -->
# Create New Public HttpClient with ISO 27001 Compliant Audit and Debug Logging

## Overview

Create a new public `HttpClient` class that wraps the existing internal HTTP client (renamed to `InternalHttpClient`) and automatically adds ISO 27001 compliant audit and debug logging for all HTTP requests. All sensitive data MUST be masked using `DataMasker` before logging to comply with ISO 27001 standards. The new `HttpClient` becomes the public interface.

## Architecture

### New Structure:

1. **`InternalHttpClient`** (private/internal) - Rename existing `HttpClient` to this

   - Contains all existing HTTP client functionality
   - Handles client token management
   - Error handling
   - No logging - just pure HTTP functionality

2. **`HttpClient`** (public) - New public interface

   - Wraps `InternalHttpClient`
   - Adds automatic audit logging for all requests
   - Adds debug logging when `logLevel === 'debug'`
   - **ISO 27001 Compliance**: Masks ALL sensitive data using `DataMasker` before logging
   - Implements same public API as InternalHttpClient (get, post, put, delete, request, authenticatedRequest)
   - Uses `LoggerService` for logging

## Implementation Details

### 1. Enhance DataMasker with JSON Configuration Support

- Create `src/utils/sensitive-fields.config.json` with default ISO 27001 compliant sensitive fields
  - Structure similar to controller's config (categories: authentication, pii, financial, security)
  - Include `fieldPatterns` array for pattern matching
- Create `src/utils/sensitive-fields.loader.ts` to:
  - Load sensitive fields from JSON configuration file
  - Support custom JSON file path via environment variable or config option
  - Merge custom fields with default fields
  - Provide functions: `loadSensitiveFieldsConfig()`, `getSensitiveFieldsArray()`, `getFieldPatterns()`
- Update `DataMasker` class to:
  - Load sensitive fields from JSON configuration
  - Merge with hardcoded defaults (fallback if JSON can't be loaded)
  - Support custom JSON file path via constructor or config
  - Use loaded fields instead of hardcoded Set

### 2. Rename Existing HttpClient

- Rename `src/utils/http-client.ts` class from `HttpClient` to `InternalHttpClient`
- Keep all existing functionality unchanged
- Remove export (make it internal)
- Or create new file `internal-http-client.ts` and move existing code there

### 2. Create New Public HttpClient

- Create new `HttpClient` class that:
  - Takes `InternalHttpClient` and `LoggerService` as dependencies
  - Wraps all HTTP methods (get, post, put, delete, request, authenticatedRequest)
  - Adds request/response interceptors to `InternalHttpClient` for logging
  - Automatically logs audit events for all requests
  - Automatically logs debug info when `logLevel === 'debug'`
  - **ISO 27001 Compliance**: Uses `DataMasker` to mask ALL sensitive data before logging

### 3. ISO 27001 Compliance Requirements (REQUIRED for Debug Logs)

**Note**: The miso-controller already handles server-side audit logging with ISO 27001 compliance using `sensitive-fields.config.json`. SDK-side masking is REQUIRED for debug logs because they are displayed client-side. The SDK's `DataMasker` aligns with controller's sensitive fields configuration.

- **Import DataMasker**: `import { DataMasker } from '../utils/data-masker'`
- **Mask Request Headers**: Use `DataMasker.maskSensitiveData()` on headers object
  - Must mask: Authorization, x-client-token, Cookie, Set-Cookie, and any header containing sensitive keywords
- **Mask Request Bodies**: Use `DataMasker.maskSensitiveData()` on request body before logging
  - Recursively masks: password, token, secret, SSN, creditcard, CVV, PIN, OTP, API keys, etc.
- **Mask Response Bodies**: Use `DataMasker.maskSensitiveData()` on response body before logging
  - Especially important for error responses that might contain sensitive data
- **Mask Query Parameters**: Mask sensitive query parameters if present
- **Mask URL Paths**: Optionally mask sensitive IDs in URL paths (partial masking)
- **Never log raw sensitive data** - always mask first, then log

### 4. Audit Log Structure

- **Action**: `http.request.{METHOD}` (e.g., `http.request.GET`, `http.request.POST`)
- **Resource**: Request URL path
- **Context** (all sensitive data must be masked):
  - `method`: HTTP method
  - `url`: Full request URL (mask sensitive parts if needed)
  - `statusCode`: Response status code (or error status)
  - `duration`: Request duration in milliseconds
  - `userId`: Extracted from JWT token if present
  - `requestSize`: Size of request body (if applicable)
  - `responseSize`: Size of response body (if applicable)
  - `error`: Error message if request failed (masked if contains sensitive data)

### 5. Debug Log Structure (when logLevel === 'debug')

- **Level**: `debug`
- **Message**: Detailed HTTP request/response information
- **Context** (all sensitive data must be masked):
  - All audit context fields plus:
  - `requestHeaders`: Request headers (MUST be masked using DataMasker)
  - `responseHeaders`: Response headers (MUST be masked using DataMasker)
  - `requestBody`: Request body (MUST be masked using DataMasker - recursively)
  - `responseBody`: Response body snippet (first 1000 chars, MUST be masked using DataMasker)
  - `baseURL`: Controller base URL
  - `timeout`: Request timeout setting
  - `queryParams`: Query parameters (if present, MUST be masked)

### 6. Error Handling and Safety

- Audit/debug logging should NEVER break HTTP requests - all errors are caught and swallowed
- Don't audit the `/api/logs` endpoint itself to prevent infinite audit loops
- Don't audit the `/api/auth/token` endpoint (client token fetch) to prevent loops
- **ISO 27001 Compliance**: Mask sensitive data BEFORE logging - never log raw sensitive data
- Use async logging that doesn't block request/response flow
- If masking fails, log without sensitive data rather than logging raw data

### 7. Integration

- Update `MisoClient` constructor:
  - Create `InternalHttpClient` first
  - Create `LoggerService`
  - Create new public `HttpClient` wrapping InternalHttpClient with logger
  - Pass new `HttpClient` to all services

## Files to Modify/Create

1. **src/utils/http-client.ts** (existing file)

   - Rename class to `InternalHttpClient`
   - Remove `export` or mark as internal
   - Keep all existing functionality

2. **src/utils/http-client.ts** OR **src/utils/public-http-client.ts** (new)

   - Create new public `HttpClient` class
   - Wraps `InternalHttpClient`
   - Adds audit/debug logging interceptors
   - Implements same API surface
   - **ISO 27001 Compliance**: Imports and uses `DataMasker`:
     - Import: `import { DataMasker } from '../utils/data-masker'`
     - Mask headers before logging: `DataMasker.maskSensitiveData(headers)`
     - Mask request bodies before logging: `DataMasker.maskSensitiveData(requestBody)`
     - Mask response bodies before logging: `DataMasker.maskSensitiveData(responseBody)`

3. **src/index.ts**

   - Update imports (use new public `HttpClient`)
   - Update `MisoClient` constructor to use new structure
   - Export new public `HttpClient`

4. **src/services/*.service.ts**

   - Update all services to use new public `HttpClient` (should work transparently)

5. **tests/unit/http-client.test.ts**

   - Update tests for new public `HttpClient`
   - Add tests for audit logging with masked sensitive data
   - Add tests for debug logging with masked sensitive data
   - Test that DataMasker is called for headers, bodies, responses
   - Test that sensitive data is never logged in raw form
   - Test that InternalHttpClient is still functional

## Implementation Pattern

```typescript
// New public HttpClient
import { InternalHttpClient } from './internal-http-client'; // or renamed class
import { LoggerService } from '../services/logger.service';
import { DataMasker } from '../utils/data-masker'; // ISO 27001 compliance

export class HttpClient {
  private internalClient: InternalHttpClient;
  private logger: LoggerService;
  public readonly config: MisoClientConfig;

  constructor(config: MisoClientConfig, logger: LoggerService) {
    this.config = config;
    this.logger = logger;
    this.internalClient = new InternalHttpClient(config);
    this.setupAuditLogging();
  }

  private setupAuditLogging(): void {
    // Add interceptors to internal client's axios instance
    // Intercept requests and responses for logging
    // Mask ALL sensitive data before logging
  }

  private async logHttpRequestAudit(response, error): Promise<void> {
    try {
      // Extract request/response data
      const requestHeaders = response?.config?.headers || {};
      const requestBody = response?.config?.data || error?.config?.data;
      const responseBody = response?.data || error?.response?.data;
      
      // ISO 27001 Compliance: Mask ALL sensitive data
      const maskedHeaders = DataMasker.maskSensitiveData(requestHeaders) as Record<string, unknown>;
      const maskedRequestBody = DataMasker.maskSensitiveData(requestBody);
      const maskedResponseBody = DataMasker.maskSensitiveData(responseBody);
      
      // Log with masked data
      await this.logger.audit(/* ... */);
      
      // Debug log with masked data
      if (this.config.logLevel === 'debug') {
        await this.logger.debug(/* ... */, {
          requestHeaders: maskedHeaders,
          requestBody: maskedRequestBody,
          responseBody: maskedResponseBody,
          // ...
        });
      }
    } catch {
      // Silently swallow logging errors
    }
  }

  // Wrap all methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.internalClient.get<T>(url, config);
  }
  
  // ... wrap post, put, delete, request, authenticatedRequest
}
```

## ISO 27001 Compliance Checklist

- ✅ All request headers masked before logging
- ✅ All request bodies masked before logging
- ✅ All response headers masked before logging
- ✅ All response bodies masked before logging
- ✅ Query parameters masked before logging
- ✅ Error messages masked if containing sensitive data
- ✅ JWT tokens masked in Authorization headers
- ✅ Client tokens masked in x-client-token headers
- ✅ Cookies masked before logging
- ✅ Recursive masking for nested objects and arrays
- ✅ Never log raw sensitive data - always mask first
- ✅ Use DataMasker.maskSensitiveData() for objects
- ✅ Use DataMasker.maskValue() for individual strings if needed