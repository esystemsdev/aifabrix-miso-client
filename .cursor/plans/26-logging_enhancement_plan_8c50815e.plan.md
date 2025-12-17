# Logging Enhancement Plan

## Indexed Fields and Structured Context for Observability

## Overview

This plan introduces standardized, indexed logging fields for general, audit, and performance logs in the TypeScript MisoClient SDK. The changes align with ABAC/RBAC audit logging principles while improving query performance, root-cause analysis, and cross-system traceability. This mirrors the [Python SDK plan](C:\git\esystemsdev\aifabrix-miso-client-python\.cursor\plans\01-logging_enhancement_plan_cad61d5d.plan.md).

## Current State

The SDK currently provides:

- [`LoggerService`](src/services/logger.service.ts) with `info()`, `error()`, `audit()`, `debug()` methods
- [`LoggerChain`](src/services/logger.service.ts) for fluent API logging
- [`LogEntry`](src/types/config.types.ts) interface for log structure
- [`ClientLoggingOptions`](src/services/logger.service.ts) for logging configuration
- Data masking via [`DataMasker`](src/utils/data-masker.ts)

**Key Problem**: Logs lack indexed context fields (`sourceKey`, `sourceDisplayName`, `externalSystemKey`, etc.), making queries slow and inconsistent.

---

## Phase 1: Logging Context Helper

Create a new utility to extract indexed fields for logging.

### New File: `src/utils/logging-helpers.ts`

```typescript
export interface HasKey {
  key: string;
  displayName?: string;
}

export interface HasExternalSystem extends HasKey {
  externalSystem?: HasKey;
}

export interface IndexedLoggingContext {
  sourceKey?: string;
  sourceDisplayName?: string;
  externalSystemKey?: string;
  externalSystemDisplayName?: string;
  recordKey?: string;
  recordDisplayName?: string;
}

export function extractLoggingContext(options: {
  source?: HasExternalSystem;
  record?: HasKey;
  externalSystem?: HasKey;
}): IndexedLoggingContext;
```

**Design principles**:

- No database access
- Explicit context passing
- Interface-based typing for flexibility
- Safe to use in hot paths

---

## Phase 2: Enhanced Log Entry Model

Update [`src/types/config.types.ts`](src/types/config.types.ts) to add indexed fields to `LogEntry`:

```typescript
export interface LogEntry {
  // Existing fields...
  
  // NEW: Indexed context fields (top-level for fast queries)
  sourceKey?: string;
  sourceDisplayName?: string;
  externalSystemKey?: string;
  externalSystemDisplayName?: string;
  recordKey?: string;
  recordDisplayName?: string;
  
  // NEW: Credential context (optional)
  credentialId?: string;
  credentialType?: string;
  
  // NEW: Request/Response metrics
  requestSize?: number;
  responseSize?: number;
  durationMs?: number;
  
  // NEW: Error classification
  errorCategory?: string;
  httpStatusCategory?: string;
}
```

---

## Phase 3: LoggerService Enhancement

Update [`src/services/logger.service.ts`](src/services/logger.service.ts):

### 3.1 Update `ClientLoggingOptions`

```typescript
export interface ClientLoggingOptions {
  // Existing fields...
  
  // NEW: Indexed context
  sourceKey?: string;
  sourceDisplayName?: string;
  externalSystemKey?: string;
  externalSystemDisplayName?: string;
  recordKey?: string;
  recordDisplayName?: string;
  
  // NEW: Credential context
  credentialId?: string;
  credentialType?: string;
  
  // NEW: Request metrics
  requestSize?: number;
  responseSize?: number;
  durationMs?: number;
  
  // NEW: Error classification
  errorCategory?: string;
  httpStatusCategory?: string;
}
```

### 3.2 Add `withIndexedContext()` to LoggerChain

```typescript
withIndexedContext(context: IndexedLoggingContext): LoggerChain;
```

### 3.3 Add `withCredentialContext()` to LoggerChain

```typescript
withCredentialContext(credentialId?: string, credentialType?: string): LoggerChain;
```

### 3.4 Add `withRequestMetrics()` to LoggerChain

```typescript
withRequestMetrics(requestSize?: number, responseSize?: number, durationMs?: number): LoggerChain;
```

### 3.5 Update internal `log()` method

Merge indexed fields from options into the LogEntry before sending.

---

## Phase 4: Export Updates

Update [`src/index.ts`](src/index.ts) to export new utilities:

```typescript
export { extractLoggingContext, IndexedLoggingContext, HasKey, HasExternalSystem } from './utils/logging-helpers';
```

---

## Usage Patterns

### Enhanced Logging Pattern (Recommended)

```typescript
import { extractLoggingContext } from '@aifabrix/miso-client';

const logContext = extractLoggingContext({ source, record });

await logger
  .withIndexedContext(logContext)
  .addCorrelation(correlationId)
  .addUser(userId)
  .error("Sync failed");
```

### Audit Logging with Indexed Fields

```typescript
await logger.audit(
  "abac.authorization.grant",
  "external_record",
  {
    operation: actionCtx.operation,
    policyKeys: policyKeys,
  },
  {
    sourceKey: resourceCtx.datasourceKey,
    sourceDisplayName: source.displayName,
    externalSystemKey: resourceCtx.externalSystemKey,
    userId: misoCtx.userId,
    correlationId: correlationId,
  }
);
```

### Performance Logging with Metrics

```typescript
await logger
  .withIndexedContext({
    sourceKey: externalDataSource.key,
    externalSystemKey: externalSystem.key,
  })
  .withCredentialContext(credential.id, credential.type)
  .withRequestMetrics(
    JSON.stringify(requestBody).length,
    JSON.stringify(responseJson).length,
    duration
  )
  .info("Upstream API call completed");
```

---

## Files to Create/Modify

| File | Action | Description |

|------|--------|-------------|

| `src/utils/logging-helpers.ts` | Create | New context extraction utility |

| `src/types/config.types.ts` | Modify | Add indexed fields to LogEntry |

| `src/services/logger.service.ts` | Modify | Add indexed fields to ClientLoggingOptions, new LoggerChain methods |

| `src/index.ts` | Modify | Export new utilities |

| `tests/unit/logging-helpers.test.ts` | Create | Unit tests for logging helpers |

| `tests/unit/logger.service.test.ts` | Modify | Add tests for new chain methods |

---

## Summary of Indexed Fields

| Category | Field | Purpose | Indexed |

|----------|-------|---------|---------|

| Context | sourceKey | Filter by data source | Yes |

| Context | sourceDisplayName | Human-readable queries | Yes |

| Context | externalSystemKey | Filter by system | Yes |

| Context | externalSystemDisplayName | Human-readable system | Yes |

| Context | recordKey | Filter by record | Optional |

| Context | recordDisplayName | Human-readable record | Optional |

| User | userId | Link to audit and activity | Yes |

| Correlation | correlationId | Request tracing | Yes |

| Credential | credentialId | Credential performance | Optional |

| Credential | credentialType | Auth analysis | Optional |

| Metrics | durationMs | Performance analysis | Yes |

| Metrics | requestSize | Payload analysis | No |

| Metrics | responseSize | Payload analysis | No |

| Error | errorCategory | Error classification | Optional |

| Error | httpStatusCategory | Status grouping | Optional |