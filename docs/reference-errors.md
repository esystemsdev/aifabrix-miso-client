# Error Handling Reference

Complete reference for error handling in the MisoClient SDK.

## Table of Contents

- [Common Error Scenarios](#common-error-scenarios)
- [Error Handling Best Practices](#error-handling-best-practices)
- [Structured Error Responses](#structured-error-responses)
- [Snake_case Error Handling](#snake_case-error-handling)
- [HTTP Status Codes](#http-status-codes)
- [Timeout Configuration](#timeout-configuration)
- [Examples](#examples)
- [See Also](#see-also)

## Common Error Scenarios

1. **Redis Connection Failure**: Automatically falls back to controller
2. **Token Validation Failure**: Returns `false` or `null` instead of throwing
3. **Network Issues**: Logs warnings and continues with cached data when possible

## Error Handling Best Practices

```typescript
try {
  const isValid = await client.validateToken(token);
  if (!isValid) {
    throw new Error('Invalid token');
  }

  const user = await client.getUser(token);
  // ... use user data
} catch (error) {
  // Log the error
  await client.log.error('Authentication failed', {
    error: error instanceof Error ? error.message : 'Unknown error'
  });

  // Handle appropriately
  console.error('Authentication error:', error);
}
```

## Structured Error Responses

The SDK supports RFC 7807-style structured error responses. When the controller returns a structured error response, it is automatically parsed and made available through the `MisoClientError` class.

### ErrorResponse Interface

```typescript
interface ErrorResponse {
  errors: string[];           // Array of error messages
  type: string;               // Error type URI (e.g., "/Errors/Bad Input")
  title: string;              // Human-readable title
  statusCode: number;         // HTTP status code (supports both camelCase and snake_case)
  instance?: string;          // Request instance URI (optional)
}
```

### MisoClientError Class

All HTTP errors from the SDK are thrown as `MisoClientError`, which extends the standard `Error` class:

```typescript
class MisoClientError extends Error {
  readonly errorResponse?: ErrorResponse;        // Structured error response (if available)
  readonly errorBody?: Record<string, unknown>;  // Raw error body (for backward compatibility)
  readonly statusCode?: number;                  // HTTP status code
}
```

### Accessing Structured Error Information

```typescript
try {
  await client.validateToken(token);
} catch (error) {
  if (error instanceof MisoClientError && error.errorResponse) {
    // Access structured error details
    console.error('Error type:', error.errorResponse.type);
    console.error('Error title:', error.errorResponse.title);
    console.error('Errors:', error.errorResponse.errors);
    console.error('Status code:', error.errorResponse.statusCode);
    console.error('Instance:', error.errorResponse.instance);
    
    // Error message is automatically set to title or first error
    console.error('Message:', error.message);
  } else if (error instanceof MisoClientError) {
    // Fallback to errorBody for non-structured errors (backward compatibility)
    console.error('Error body:', error.errorBody);
    console.error('Status code:', error.statusCode);
  }
}
```

### Backward Compatibility

The SDK maintains full backward compatibility. If a response doesn't match the structured error format, the error is still wrapped in `MisoClientError` with the `errorBody` property containing the raw response data:

```typescript
try {
  await client.get('/api/endpoint');
} catch (error) {
  if (error instanceof MisoClientError) {
    // Structured error (new format)
    if (error.errorResponse) {
      console.log('Structured errors:', error.errorResponse.errors);
    }
    // Non-structured error (old format)
    else if (error.errorBody) {
      console.log('Error body:', error.errorBody);
    }
    
    // Status code is always available
    console.log('Status:', error.statusCode);
  }
}
```

### Field Name Compatibility

The `statusCode` field supports both camelCase (`statusCode`) and snake_case (`status_code`) for compatibility with different response formats:

```typescript
// Both formats are supported:
{
  errors: ['Error message'],
  type: '/Errors/Test',
  title: 'Test Error',
  statusCode: 400  // camelCase
}

// OR

{
  errors: ['Error message'],
  type: '/Errors/Test',
  title: 'Test Error',
  status_code: 400  // snake_case
}
```

## Snake_case Error Handling

The SDK provides utilities for handling snake_case error responses following enterprise application best practices and industry standards (ISO 27001 compliant).

### ErrorResponseSnakeCase Interface

Canonical error response using snake_case format following enterprise application best practices. Follows RFC 7807-style structured error format and ISO 27001 compliance standards.

```typescript
interface ErrorResponseSnakeCase {
  /** Human-readable list of error messages. */
  errors: string[];
  /** RFC 7807 type URI. */
  type?: string;
  /** Short, human-readable title. */
  title?: string;
  /** HTTP status code. */
  status_code: number;
  /** URI/path identifying the error instance. */
  instance?: string;
  /** Request correlation key for debugging/audit. */
  request_key?: string;
}
```

### ErrorEnvelope Interface

Top-level error envelope used in API responses.

```typescript
interface ErrorEnvelope {
  /** Error response object. */
  error: ErrorResponseSnakeCase;
}
```

### ApiErrorException Class

Exception class for snake_case error responses. Used with snake_case ErrorResponse format.

```typescript
class ApiErrorException extends Error {
  /** HTTP status code (snake_case). */
  status_code: number;
  /** Request correlation key for debugging/audit. */
  request_key?: string;
  /** RFC 7807 type URI. */
  type?: string;
  /** URI/path identifying the error instance. */
  instance?: string;
  /** Array of error messages. */
  errors: string[];
}
```

**Example:**

```typescript
import { ApiErrorException, ErrorResponseSnakeCase } from '@aifabrix/miso-client';

try {
  // Some API call that throws ApiErrorException
} catch (error) {
  if (error instanceof ApiErrorException) {
    console.error('Status code:', error.status_code);
    console.error('Errors:', error.errors);
    console.error('Type:', error.type);
    console.error('Request key:', error.request_key);
  }
}
```

### `transform_error_to_snake_case(err: unknown): ErrorResponseSnakeCase`

Transforms arbitrary error into standardized snake_case ErrorResponse. Handles both camelCase and snake_case error formats.

**Parameters:**

- `err` - Error object (AxiosError, network error, etc.)

**Returns:** Standardized snake_case ErrorResponse

**Example:**

```typescript
import { transform_error_to_snake_case } from '@aifabrix/miso-client';

try {
  // Some operation that might fail
} catch (error) {
  const standardizedError = transform_error_to_snake_case(error);
  console.error('Error status:', standardizedError.status_code);
  console.error('Error messages:', standardizedError.errors);
  console.error('Error type:', standardizedError.type);
}
```

### `handle_api_error_snake_case(err: unknown): never`

Handles API error and throws snake_case ApiErrorException.

**Parameters:**

- `err` - Error object (AxiosError, network error, etc.)

**Throws:** ApiErrorException with snake_case error format

**Example:**

```typescript
import { handle_api_error_snake_case } from '@aifabrix/miso-client';

try {
  // Some API operation
} catch (error) {
  // Transform and throw as ApiErrorException
  handle_api_error_snake_case(error);
}
```

### Compatibility Note

The SDK supports both error formats for maximum compatibility:

- **camelCase** (`ErrorResponse`) - Used with `MisoClientError` class
- **snake_case** (`ErrorResponseSnakeCase`) - Used with `ApiErrorException` class

Both formats are automatically handled by `transform_error_to_snake_case()` which normalizes errors from various sources into the snake_case format.

## HTTP Status Codes

The SDK handles common HTTP status codes:

- **200**: Success
- **401**: Unauthorized (invalid token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not found
- **500**: Internal server error

## Timeout Configuration

Default timeout is 30 seconds for HTTP requests. This can be configured in the HttpClient if needed.

## Examples

### Basic Error Handling

```typescript
import { MisoClient, loadConfig, MisoClientError } from '@aifabrix/miso-client';

const client = new MisoClient(loadConfig());
await client.initialize();

try {
  const user = await client.getUser(token);
} catch (error) {
  if (error instanceof MisoClientError && error.errorResponse) {
    console.error('Error Type:', error.errorResponse.type);
    console.error('Error Title:', error.errorResponse.title);
    console.error('Error Messages:', error.errorResponse.errors);
    console.error('Status Code:', error.errorResponse.statusCode);
  } else if (error instanceof MisoClientError) {
    console.error('Error Body:', error.errorBody);
    console.error('Status Code:', error.statusCode);
  }
}
```

### Express Error Handler

```typescript
import express from 'express';
import { MisoClientError } from '@aifabrix/miso-client';

app.get('/api/user', async (req, res) => {
  try {
    const user = await client.getUser(token);
    res.json(user);
  } catch (error) {
    if (error instanceof MisoClientError) {
      if (error.errorResponse) {
        return res.status(error.errorResponse.statusCode).json({
          error: error.errorResponse.title,
          errors: error.errorResponse.errors,
          type: error.errorResponse.type,
          instance: error.errorResponse.instance
        });
      } else {
        return res.status(error.statusCode || 500).json({
          error: error.message,
          details: error.errorBody
        });
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Snake_case Error Handling

```typescript
import { ApiErrorException, transform_error_to_snake_case } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

// Error handler middleware
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof ApiErrorException) {
    return res.status(err.status_code).json({
      error: {
        errors: err.errors,
        type: err.type || 'about:blank',
        title: err.message,
        status_code: err.status_code,
        instance: err.instance,
        request_key: err.request_key
      }
    });
  }
  
  const standardizedError = transform_error_to_snake_case(err);
  res.status(standardizedError.status_code || 500).json({
    error: standardizedError
  });
});
```

### Testing with Mocked Errors

```typescript
import { MisoClientError } from '@aifabrix/miso-client';

// Mock error for testing
const mockError = new MisoClientError('Test error', {
  errorResponse: {
    errors: ['Test error message'],
    type: '/Errors/Test',
    title: 'Test Error',
    statusCode: 400
  }
});

try {
  throw mockError;
} catch (error) {
  if (error instanceof MisoClientError && error.errorResponse) {
    console.log('Structured errors:', error.errorResponse.errors);
    console.log('Status:', error.errorResponse.statusCode);
  }
}
```

## See Also

- [Type Reference](./reference-types.md) - Complete type definitions including error types
- [MisoClient Reference](./reference-misoclient.md) - Main client class
- [DataClient Reference](./reference-dataclient.md#error-types) - Browser client error types
- [Examples Guide](./examples.md) - Framework-specific error handling examples

