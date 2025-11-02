<!-- 9d494bb7-1661-4341-b7f4-3245374dcb49 c7aaad38-c504-4e76-9b13-25df69871454 -->
# Improve HTTP Client Audit Logging Performance

## Current Performance Issues

### Identified Bottlenecks

1. **Data Masking (4 recursive traversals)** - O(n) CPU cost for large objects
2. **JSON.stringify for Size Calculation** - Redundant serialization, done 2-3 times per request
3. **No Size Limits** - Processes entire response bodies regardless of size
4. **Per-Request Network I/O** - Each HTTP request triggers separate log send
5. **No Fast Path** - All requests get full treatment regardless of size

### Performance Impact by Request Size

- **Small (< 10KB)**: ~7-15ms CPU - Negligible impact
- **Medium (10KB-100KB)**: ~30-150ms CPU - Moderate impact  
- **Large (> 100KB)**: ~150-1500ms+ CPU - Significant impact

## Performance Optimization Strategies

### Strategy 1: Response Body Truncation (High Impact, Quick Win)

**Target**: `src/utils/http-client.ts:158-168`

**Implementation**:

- Add `truncateResponseBody()` helper that limits response body to configurable size (default: 10KB)
- Truncate response body BEFORE masking to reduce masking cost
- Add `truncated: true` flag in audit log context
- Only process full response body when `logLevel === 'debug'`

**Expected Impact**: 60-80% reduction in CPU time for large responses

**Code Changes**:

```typescript
// Add helper function
private truncateResponseBody(body: unknown, maxSize: number = 10000): { data: unknown; truncated: boolean } {
  // Implementation: truncate large bodies before processing
}

// Update logHttpRequestAudit to use truncation
const { data: truncatedResponseBody, truncated } = this.truncateResponseBody(responseBody, this.config.audit?.maxResponseSize);
```

### Strategy 2: Optimize JSON.stringify Calls (Medium Impact, Quick Win)

**Target**: `src/utils/http-client.ts:171-172, 198`

**Implementation**:

- Eliminate redundant `JSON.stringify()` calls
- Use `Buffer.byteLength(JSON.stringify(obj))` for size calculation (reuse stringified result)
- Only calculate sizes when needed (not for minimal audit level)
- Cache stringified result if used again for log payload

**Expected Impact**: 30-50% reduction in CPU time for size calculations

**Code Changes**:

```typescript
// Before: Separate stringify calls
const requestSize = requestBody ? JSON.stringify(requestBody).length : 0;
const responseSize = responseBody ? JSON.stringify(responseBody).length : 0;
// Later: JSON.stringify(maskedResponseBody) again

// After: Reuse stringified results
let requestStr: string | undefined;
let responseStr: string | undefined;
if (requestBody && shouldCalculateSizes) {
  requestStr = JSON.stringify(requestBody);
  requestSize = Buffer.byteLength(requestStr);
}
```

### Strategy 3: Fast Path for Small Requests (Low-Medium Impact, Quick Win)

**Target**: `src/utils/http-client.ts:133-230`

**Implementation**:

- Add quick size estimation before processing
- Fast path for small requests (< 1KB): minimal masking, skip size calculation
- Standard path for medium requests (1KB-50KB): standard masking
- Metadata-only path for large requests (> 50KB): skip masking, log metadata only

**Expected Impact**: 20-40% reduction in CPU time for small requests

**Code Changes**:

```typescript
// Add quick size estimation
private estimateObjectSize(obj: unknown): number {
  // Quick estimate without full JSON.stringify
}

// Route to appropriate processing path
const estimatedSize = this.estimateObjectSize(responseBody);
if (estimatedSize < 1024) {
  // Fast path: minimal processing
} else if (estimatedSize > 50000) {
  // Metadata only: skip masking
}
```

### Strategy 4: Defer and Optimize Masking (High Impact)

**Target**: `src/utils/http-client.ts:165-168`

**Implementation**:

- Move masking inside async phase (already deferred, but optimize execution)
- Skip masking for large objects (> configurable threshold, default: 50KB)
- Use shallow masking for response bodies (mask only top-level fields, skip deep nesting)
- Add LRU cache for masked object hashes (cache identical objects)

**Expected Impact**: 50-80% reduction in CPU time for large requests

**Code Changes**:

```typescript
// Add configurable size threshold
const MAX_MASKING_SIZE = this.config.audit?.maxMaskingSize || 50000;

// Skip masking for large objects
if (estimatedSize > MAX_MASKING_SIZE) {
  maskedResponseBody = { _message: 'Response body too large, masking skipped' };
} else {
  maskedResponseBody = DataMasker.maskSensitiveData(responseBody);
}
```

### Strategy 5: Batch Logging Queue (High Impact)

**Target**: `src/utils/http-client.ts`, `src/services/logger.service.ts`

**Implementation**:

- Create `AuditLogQueue` class with in-memory queue
- Batch multiple logs into single HTTP request
- Configurable batch size (default: 10 logs) and flush interval (default: 100ms)
- Use Redis LIST for queuing when available (faster than HTTP)
- Flush queue on: size threshold, time interval, or process exit

**Expected Impact**: 70-90% reduction in network requests, 50-70% reduction in network overhead

**Code Changes**:

- Create `src/utils/audit-log-queue.ts` with batching logic
- Modify `logger.service.ts` to support batch endpoint `/api/logs/batch`
- Update `http-client.ts` to queue audit logs instead of sending immediately

### Strategy 6: Configurable Audit Levels (Medium Impact)

**Target**: `src/types/config.types.ts`, `src/utils/http-client.ts`

**Implementation**:

- Add `auditLevel` config: `'minimal'`, `'standard'`, `'detailed'`, `'full'`
- Minimal: Only method, URL, status, duration (no masking, no sizes)
- Standard: Add request/response metadata (light masking)
- Detailed: Add sizes (current behavior)
- Full: Everything including debug-level details

**Expected Impact**: 40-60% reduction in CPU time for minimal/standard levels

**Code Changes**:

```typescript
// Add to MisoClientConfig
interface AuditConfig {
  level?: 'minimal' | 'standard' | 'detailed' | 'full';
  maxResponseSize?: number;
  maxMaskingSize?: number;
  batchSize?: number;
  batchInterval?: number;
  enabled?: boolean;
}

// Check audit level before expensive operations
if (this.config.audit?.level === 'minimal') {
  // Skip masking, sizes, etc.
}
```

### Strategy 7: Parallelize Independent Operations (Medium Impact)

**Target**: `src/utils/http-client.ts:165-168`

**Implementation**:

- Parallelize masking operations (headers, request body, response body can be masked simultaneously)
- Use `Promise.all()` for independent masking operations
- Consider worker threads for masking if available (Node.js only)

**Expected Impact**: 30-50% reduction in CPU time through parallelization

**Code Changes**:

```typescript
// Parallelize masking
const [maskedHeaders, maskedRequestBody, maskedResponseBody, maskedResponseHeaders] = await Promise.all([
  Promise.resolve(DataMasker.maskSensitiveData(requestHeaders)),
  Promise.resolve(DataMasker.maskSensitiveData(requestBody)),
  Promise.resolve(DataMasker.maskSensitiveData(responseBody)),
  Promise.resolve(DataMasker.maskSensitiveData(responseHeaders))
]);
```

## Implementation Priority

### Phase 1: Quick Wins (High ROI, Low Risk)

1. **Strategy 1**: Response Body Truncation
2. **Strategy 2**: Optimize JSON.stringify
3. **Strategy 3**: Fast Path for Small Requests

### Phase 2: High Impact (Medium Risk)

4. **Strategy 4**: Defer and Optimize Masking
5. **Strategy 5**: Batch Logging Queue

### Phase 3: Configuration and Advanced (Low Risk)

6. **Strategy 6**: Configurable Audit Levels
7. **Strategy 7**: Parallelize Operations

## Configuration Interface

Add to `src/types/config.types.ts`:

```typescript
interface AuditConfig {
  enabled?: boolean; // Enable/disable audit logging (default: true)
  level?: 'minimal' | 'standard' | 'detailed' | 'full'; // Audit detail level (default: 'detailed')
  maxResponseSize?: number; // Truncate responses larger than this (default: 10000)
  maxMaskingSize?: number; // Skip masking for objects larger than this (default: 50000)
  batchSize?: number; // Batch size for queued logs (default: 10)
  batchInterval?: number; // Flush interval in ms (default: 100)
  skipEndpoints?: string[]; // Endpoints to skip audit logging
}

interface MisoClientConfig {
  // ... existing config
  audit?: AuditConfig;
}
```

## Files to Modify

1. **`src/types/config.types.ts`** - Add `AuditConfig` interface
2. **`src/utils/http-client.ts`** - Implement optimizations 1-4, 6-7
3. **`src/utils/audit-log-queue.ts`** - Create new file for Strategy 5
4. **`src/services/logger.service.ts`** - Add batch logging support
5. **`src/utils/data-masker.ts`** - Add shallow masking option (optional)
6. **`README.md`** - Document performance optimizations
7. **`docs/configuration.md`** - Document audit configuration options

## Testing Requirements

1. **Performance Benchmarks**: Before/after metrics for different request sizes
2. **Memory Profiling**: Memory usage with and without optimizations
3. **CPU Profiling**: CPU time reduction measurements
4. **Network Overhead**: Measure reduction in network requests
5. **Functional Tests**: Ensure audit logs still capture required information
6. **Integration Tests**: Test batch logging with Redis and HTTP fallback

## Success Metrics

- **Small Requests**: < 5ms CPU overhead (currently ~7-15ms)
- **Medium Requests**: < 20ms CPU overhead (currently ~30-150ms)
- **Large Requests**: < 50ms CPU overhead (currently ~150-1500ms+)
- **Network Requests**: 70-90% reduction through batching
- **Memory Usage**: 50-70% reduction through truncation and optimized masking

### To-dos

- [ ] Document current performance characteristics: CPU time, memory usage, network overhead for different request sizes
- [ ] Identify specific bottlenecks in data masking, JSON.stringify, and log sending operations
- [ ] Create documentation section explaining performance impact and characteristics
- [ ] Propose optimization strategies with trade-offs (lazy masking, size limits, batch logging, configurable levels)