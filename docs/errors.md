# Errors

Express error handling: the "must do" pattern only. Use `asyncHandler`, `handleRouteError`, and `AppError`; handle `MisoClientError` from the SDK.

## Must do: asyncHandler for route handlers

Wrap every async route handler with `asyncHandler` so errors are caught and handled consistently:

```typescript
import {
  asyncHandler,
  handleRouteError,
  AppError,
} from "@aifabrix/miso-client";
import { Request, Response } from "express";

router.get(
  "/api/user",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const user = await client.getUser(token);
    if (!user) throw new AppError("User not found", 404);
    res.json({ user });
  }, "getUser"),
);

// Error middleware (register last)
router.use(
  async (error: Error, req: Request, res: Response, _next: Function) => {
    await handleRouteError(error, req, res);
  },
);
```

Benefits: no try-catch in handlers, RFC 7807 responses, consistent logging, `Content-Type: application/problem+json` set automatically.

## Must do: AppError for business logic

Throw `AppError` for known failures (not found, validation, etc.):

```typescript
import { AppError } from "@aifabrix/miso-client";

if (!resource) throw new AppError("Resource not found", 404);

const errors = validateInput(data);
if (errors.length > 0) {
  throw new AppError("Validation failed", 422, true, errors);
}
```

`handleRouteError` converts these to RFC 7807 responses.

## Must do: handleRouteError as error middleware

Register one error middleware that calls `handleRouteError`. It formats errors as RFC 7807, logs them with context, and sends the response. Do not expose stack traces or internal details to clients.

## MisoClientError (SDK / external API errors)

When the SDK or an external API throws, you get `MisoClientError` with optional structured body:

```typescript
import { MisoClientError, AppError } from "@aifabrix/miso-client";

try {
  const user = await client.getUser(token);
  res.json({ user });
} catch (error) {
  if (error instanceof MisoClientError) {
    if (error.errorResponse) {
      throw new AppError(
        error.errorResponse.title,
        error.errorResponse.statusCode,
        true,
        undefined,
        error.errorResponse.type,
        error.errorResponse.instance,
        error.errorResponse.correlationId,
      );
    }
    throw new AppError(error.message, error.statusCode || 500);
  }
  throw error;
}
```

Prefer rethrowing as `AppError` so `handleRouteError` can format and log.

## Do not

- Use try-catch in route handlers for normal error handling; use `asyncHandler` and throw `AppError`.
- Expose stack traces or internal error details to clients.
- Use old formats (e.g. `{ success: false, error: '...' }`); use RFC 7807 only.
- Skip the error middleware; always register `handleRouteError`.

## Summary

| Task               | Use                                                                       |
| ------------------ | ------------------------------------------------------------------------- |
| Wrap route handler | `asyncHandler(async (req, res) => { ... }, 'operationName')`              |
| Business error     | `throw new AppError(message, statusCode, ...)`                            |
| Error middleware   | `router.use((err, req, res, next) => handleRouteError(err, req, res))`    |
| SDK/external error | Check `MisoClientError`, use `error.errorResponse`, rethrow as `AppError` |

See [audit-and-logging.md](audit-and-logging.md) for error logging context.

## Safe controller diagnostics

HTTP failures remain `MisoClientError`. `statusCode` always reflects the HTTP
transport status, including when the controller body disagrees. Structured
`errorResponse` and extracted `responseBody` preserve safe `code`, `detail`,
`authMethod`, `clientIdentity`, `instance` and `correlationId` when supplied.
Identity is never inferred from local credentials. Correlation uses the body first,
then the `x-correlation-id` response header; explicit extraction options retain
precedence after sanitization.

`errorBody` is now sanitized rather than raw. Known request credentials, tokens,
encryption keys, plaintext and encrypted references are redacted even when echoed
inside ordinary text. Sensitive fields are masked, parsing/traversal is bounded,
and exceptions do not retain raw Axios configs or causes. Oversized or unreadable
content is replaced with `***MASKED***`. These protections also cover automatic
HTTP audit/debug and encryption console diagnostics. Automatic HTTP diagnostics
mask the application-label fallback to prevent logging the configured client ID;
application ID and other safe tracing fields remain available.

Redaction covers sensitive field names and values known to the current request;
it cannot identify every arbitrary secret in controller-generated free text.
