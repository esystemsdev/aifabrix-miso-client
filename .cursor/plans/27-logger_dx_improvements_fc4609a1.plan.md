# Logger Developer Experience Improvements

## Auto-Extraction from Request for Less Code

## Overview

This plan improves the LoggerService developer experience by adding methods that automatically extract logging context from Express Request objects. This addresses Mika's feedback: "Now we need to set a lot of parameters that we can take directly from the request (IP, method etc.) - less code, better system."

**Prerequisite**: [Logging Enhancement Plan (Indexed Fields)](.cursor/plans/26-logging_enhancement_plan_8c50815e.plan.md) should be implemented first.

---

## Problem Statement

Currently, developers must manually pass many parameters:

```typescript
// Current: Verbose and error-prone
await logger
  .addUser(userId)
  .addCorrelation(req.headers['x-correlation-id'] as string)
  .info("API call", { 
    ipAddress: req.ip,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'],
  });
```

---

## Solution: Auto-Extraction Methods

### New Method: `withRequest(req: Request)`

```typescript
// New: Simple and automatic
await logger
  .withRequest(req)
  .info("API call");
```

**Auto-extracted fields**:

| Field | Source | Notes |

|-------|--------|-------|

| `ipAddress` | `req.ip` or `x-forwarded-for` header | Handles proxies |

| `method` | `req.method` | GET, POST, etc. |

| `path` | `req.path` or `req.originalUrl` | Request path |

| `userAgent` | `req.headers['user-agent']` | Browser/client info |

| `correlationId` | `req.headers['x-correlation-id'] `or `x-request-id` | Request tracing |

| `referer` | `req.headers['referer']` | Origin page |

| `userId` | From JWT token in `Authorization` header | If present |

| `sessionId` | From JWT token | If present |

| `requestId` | `req.headers['x-request-id']` | Alternative correlation |

---

## Implementation

### Phase 1: Request Context Extractor

Create new file: `src/utils/request-context.ts`

```typescript
import { Request } from 'express';

export interface RequestContext {
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

export function extractRequestContext(req: Request): RequestContext {
  // Extract IP (handle proxies)
  const ipAddress = req.ip || 
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress;

  // Extract correlation ID from common headers
  const correlationId = 
    req.headers['x-correlation-id'] as string ||
    req.headers['x-request-id'] as string ||
    req.headers['request-id'] as string;

  // Extract user from JWT if available
  const { userId, sessionId } = extractUserFromAuthHeader(req);

  return {
    ipAddress,
    method: req.method,
    path: req.originalUrl || req.path,
    userAgent: req.headers['user-agent'] as string,
    correlationId,
    referer: req.headers['referer'] as string,
    userId,
    sessionId,
    requestId: req.headers['x-request-id'] as string,
    requestSize: req.headers['content-length'] 
      ? parseInt(req.headers['content-length'] as string, 10) 
      : undefined,
  };
}

function extractUserFromAuthHeader(req: Request): { userId?: string; sessionId?: string } {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return {};
  
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    if (!decoded) return {};
    
    return {
      userId: (decoded.sub || decoded.userId || decoded.user_id) as string | undefined,
      sessionId: (decoded.sessionId || decoded.sid) as string | undefined,
    };
  } catch {
    return {};
  }
}
```

### Phase 2: Update ClientLoggingOptions

Add `ipAddress` and `userAgent` to `ClientLoggingOptions` since they are top-level `LogEntry` fields:

```typescript
export interface ClientLoggingOptions {
  // Existing fields...
  applicationId?: string;
  userId?: string;
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  token?: string;
  maskSensitiveData?: boolean;
  performanceMetrics?: boolean;

  // NEW: Request metadata (top-level LogEntry fields)
  ipAddress?: string;
  userAgent?: string;
}
```

### Phase 3: LoggerChain Enhancement

Update [`src/services/logger.service.ts`](src/services/logger.service.ts):

```typescript
import { Request } from 'express';
import { extractRequestContext, RequestContext } from '../utils/request-context';

export class LoggerChain {
  // ... existing methods ...

  /**
   * Auto-extract logging context from Express Request
   * Extracts: IP, method, path, user-agent, correlation ID, user from JWT
   */
  withRequest(req: Request): LoggerChain {
    const ctx = extractRequestContext(req);
    
    // Merge into options (these become top-level LogEntry fields)
    if (ctx.userId) this.options.userId = ctx.userId;
    if (ctx.sessionId) this.options.sessionId = ctx.sessionId;
    if (ctx.correlationId) this.options.correlationId = ctx.correlationId;
    if (ctx.requestId) this.options.requestId = ctx.requestId;
    if (ctx.ipAddress) this.options.ipAddress = ctx.ipAddress;
    if (ctx.userAgent) this.options.userAgent = ctx.userAgent;
    
    // Merge into context (additional request info, not top-level LogEntry fields)
    if (ctx.method) this.context.method = ctx.method;
    if (ctx.path) this.context.path = ctx.path;
    if (ctx.referer) this.context.referer = ctx.referer;
    if (ctx.requestSize) this.context.requestSize = ctx.requestSize;
    
    return this;
  }
}
```

### Phase 4: Update log() Method

Update the internal `log()` method to use the new options:

```typescript
const logEntry: LogEntry = {
  // ... existing fields ...
  ipAddress: options?.ipAddress,  // NEW: from options
  userAgent: options?.userAgent,  // NEW: from options
  ...metadata,  // Still spread metadata as fallback
};
```

### Phase 5: LoggerService Shortcut

Add direct method to `LoggerService`:

```typescript
export class LoggerService {
  // ... existing methods ...

  /**
   * Create logger chain with request context pre-populated
   */
  forRequest(req: Request): LoggerChain {
    return new LoggerChain(this, {}, {}).withRequest(req);
  }
}
```

### Phase 6: Export Updates

Update [`src/index.ts`](src/index.ts):

```typescript
export { extractRequestContext, RequestContext } from './utils/request-context';
```

---

## Usage Comparison

### Before (Current)

```typescript
// Verbose: 10+ lines for proper logging
const correlationId = req.headers['x-correlation-id'] as string || generateId();
const authHeader = req.headers['authorization'];
let userId: string | undefined;
if (authHeader?.startsWith('Bearer ')) {
  const decoded = jwt.decode(authHeader.substring(7));
  userId = decoded?.sub;
}

await miso.log
  .withContext({ 
    ipAddress: req.ip,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
  })
  .addUser(userId)
  .addCorrelation(correlationId)
  .info("Processing request");
```

### After (New)

```typescript
// Simple: 3 lines
await miso.log
  .withRequest(req)
  .info("Processing request");
```

---

## Files to Create/Modify

| File | Action | Description |

|------|--------|-------------|

| `src/utils/request-context.ts` | Create | Request context extraction utility |

| `src/services/logger.service.ts` | Modify | Add `ipAddress`/`userAgent` to ClientLoggingOptions, `withRequest()` to LoggerChain, `forRequest()` to LoggerService, update `log()` method |

| `src/index.ts` | Modify | Export new utilities |

| `tests/unit/request-context.test.ts` | Create | Unit tests for request extraction |

| `tests/unit/logger.service.test.ts` | Modify | Add tests for new methods |

---

## Benefits

| Metric | Before | After |

|--------|--------|-------|

| Lines of code per log call | 10-15 | 2-3 |

| Manual field extraction | 6-8 fields | 0 fields |

| Error-prone header access | Yes | No (handled internally) |

| Proxy IP handling | Manual | Automatic |

| JWT user extraction | Manual | Automatic |

---

## Dependencies

- Requires Express types (`@types/express`) - already a peer dependency
- Uses existing `jsonwebtoken` for JWT decoding
- Builds on indexed fields from [Plan 26](.cursor/plans/26-logging_enhancement_plan_8c50815e.plan.md)