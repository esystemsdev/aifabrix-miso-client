# Fix and Improve Code - Utils - Configuration

## Overview
This plan addresses code quality improvements for configuration utilities (`src/utils/config-loader.ts`). This utility loads configuration from environment variables.

## Modules Analyzed
- `src/utils/config-loader.ts` (106 lines)

## Key Issues Identified

### 1. Error Handling
- **Throws Errors**: `loadConfig()` throws errors for missing required fields (lines 31, 34). This is acceptable for configuration loading, but error messages could be more descriptive.

### 2. Code Organization
- **Good Structure**: Function is well-organized.
- **Environment Variable Parsing**: Properly handles optional and required fields.

### 3. Type Safety
- **Good**: Proper TypeScript types are used.
- **Type Assertions**: Uses type assertions for logLevel (line 25) - could use type guard.

### 4. Method Size
- **Acceptable**: Function is ~90 lines, slightly long but acceptable for configuration loading.

### 5. Validation
- **Basic Validation**: Validates required fields.
- **Type Validation**: Could add more validation for port numbers, URLs, etc.

## Implementation Tasks

### Task 1: Improve Error Messages
**Priority**: Low  
**File**: `src/utils/config-loader.ts`

Make error messages more descriptive:
```typescript
if (!config.clientId) {
  throw new Error(
    'MISO_CLIENTID environment variable is required. ' +
    'Please set MISO_CLIENTID or MISO_CLIENT_ID in your environment variables.'
  );
}
```

### Task 2: Add Type Guard for LogLevel
**Priority**: Low  
**File**: `src/utils/config-loader.ts`

Create type guard instead of type assertion:
```typescript
function isValidLogLevel(level: string): level is "debug" | "info" | "warn" | "error" {
  return ['debug', 'info', 'warn', 'error'].includes(level);
}

// Then use:
const logLevel = process.env.MISO_LOG_LEVEL;
config.logLevel = isValidLogLevel(logLevel) ? logLevel : 'debug';
```

### Task 3: Add Configuration Validation
**Priority**: Low  
**File**: `src/utils/config-loader.ts`

Add validation for:
- URL format (controllerUrl)
- Port number range (Redis port)
- Positive numbers (TTL values)

### Task 4: Extract Redis Config Builder
**Priority**: Low  
**File**: `src/utils/config-loader.ts`

Extract Redis configuration building to a helper function:
```typescript
function buildRedisConfig(): RedisConfig | undefined {
  const redisHost = process.env.REDIS_HOST;
  if (!redisHost) return undefined;

  const redisConfig: RedisConfig = {
    host: redisHost,
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  };

  // ... rest of Redis config building

  return redisConfig;
}
```

### Task 5: Add JSDoc Comments
**Priority**: Low  
**File**: `src/utils/config-loader.ts`

Enhance JSDoc comments:
- Add `@throws` tags
- Document environment variables
- Add examples
- Document defaults

### Task 6: Add Configuration Schema Validation
**Priority**: Low  
**File**: `src/utils/config-loader.ts`

Consider using a schema validation library (like Zod) for runtime validation:
```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  controllerUrl: z.string().url(),
  clientId: z.string().min(1),
  // ... etc
});
```

## Testing Requirements

1. **Unit Tests**:
   - Test with all environment variables set
   - Test with missing required variables
   - Test with invalid values
   - Test with optional variables

2. **Integration Tests**:
   - Test in different environments
   - Test with various configurations

3. **Edge Cases**:
   - Empty strings
   - Invalid URLs
   - Invalid port numbers
   - Missing optional fields

## Priority Recommendations

1. **Low Priority**: All tasks are low priority - config loader is well-implemented

## Notes

- Configuration loader is well-structured overall
- Error throwing is acceptable for configuration loading
- Consider adding runtime validation for production use
- Environment variable handling is comprehensive
- Default values are sensible

