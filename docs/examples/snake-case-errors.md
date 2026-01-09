# Snake_case Error Handling Examples

> **📖 For detailed snake_case error handling API reference, see [Error Handling Reference - Snake_case Error Handling](../reference-errors.md#snake_case-error-handling)**

Practical examples for handling errors in snake_case format for API compatibility.

**You need to:** Handle errors in snake_case format for API compatibility.

**Here's how:** Use snake_case error utilities.

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

**See Also:**

- [Error Handling Reference](../reference-errors.md) - Complete error handling guide
- [Error Handling Examples](./error-handling.md) - Basic error handling examples
