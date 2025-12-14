---
name: Extract Express.js Utilities from Miso-Controller to Miso-Client
overview: ""
todos:
  - id: c3826fb9-8c1a-4350-aff0-0d1bb6c0bb2b
    content: Read all 9 source files from miso-controller
    status: pending
  - id: 3087d460-8d40-4c9e-8466-9ef1729f834e
    content: Create src/express/ directory structure
    status: pending
  - id: a75cc951-9a3e-45f7-9db4-951fb38e51c6
    content: Extract response-helper.ts, remove circular dependency
    status: pending
  - id: c52b43c5-5bf0-4629-956b-26087e1dcf26
    content: Extract response-middleware.ts, update imports
    status: pending
  - id: f1dbe71d-5124-48ba-95c9-b135f3537354
    content: Extract async-handler.ts, update imports
    status: pending
  - id: a7c5d01a-5442-4d1a-bd40-d4099845b9c4
    content: Extract validation-helper.ts, update imports
    status: pending
  - id: 3992a4da-421d-405b-a8a0-e942f0decbe5
    content: Extract error-types.ts from api.types.ts (AppError only)
    status: pending
  - id: 6a2b562a-4d59-4cfe-816d-81958aeadd4f
    content: Extract error-handler.ts, remove LoggerService, remove Prisma
    status: pending
  - id: ab22c1d2-8a3f-4f64-b494-d9e89ff8c504
    content: Extract error-response.ts, update imports
    status: pending
  - id: 96bc7df8-e1d2-4d84-b03c-3f86a28cccdb
    content: Extract encryption.ts, replace EncryptionService
    status: pending
  - id: b374e717-8b3e-4c23-a45d-27eea8d89eef
    content: Extract express.d.ts (Response only, no Request)
    status: pending
  - id: 9344e223-5a09-4e80-8eda-aa7ac8dcfae2
    content: Add applySorting() function to src/utils/sort.utils.ts
    status: pending
  - id: 48f837ae-82f6-491f-8862-9dd2d1f3f59d
    content: Verify parseSortParams() and applySorting() are exported in src/index.ts
    status: pending
  - id: ad1ee00c-37e9-4600-bf03-f7268004b30e
    content: Create src/express/index.ts barrel export
    status: pending
  - id: 163c1663-52e4-4c7b-a72c-0e4023b8a27c
    content: Update src/index.ts to export Express utilities
    status: pending
  - id: a2739e42-49ca-416a-ad18-2bcc1100ed62
    content: Update package.json (peerDeps, devDeps, description)
    status: pending
  - id: 410e4662-d1e8-4dcd-889a-6e6e4f2a9d2c
    content: Delete src/services/encryption.service.ts
    status: pending
  - id: ddbd4557-f79c-404a-a1c1-10fd05fdb682
    content: Delete .github/workflows/npm-publish.yml (existing automatic workflow)
    status: pending
  - id: 23f4504d-12ec-400b-9f21-d9adb2a12006
    content: Create 8 test files with 80%+ coverage (7 Express + 1 sort utilities)
    status: pending
  - id: ba94f13f-fe68-449a-b47f-df804415f4f4
    content: Create GitHub workflows (version-bump, publish)
    status: pending
  - id: 2a3563c4-6a5e-492c-82ef-a92396d369c0
    content: Create .npmignore and pre-publish check script
    status: pending
  - id: 9e4c143c-dcb3-4de6-bb6d-02b333cb7654
    content: Update README.md with Express utilities docs
    status: pending
  - id: 30c1f096-09db-4b63-b451-3746e8c86917
    content: Create CHANGELOG.md
    status: pending
  - id: 88d81e0f-f296-4f08-a82a-4dad92e77106
    content: Run full validation (build, lint, test, coverage)
    status: pending
---

# Extract Express.js Utilities from Miso-Controller to Miso-Client

## Overview

Extract generic Express.js utilities from `aifabrix-miso` (miso-controller) at `C:\git\esystemsdev\aifabrix-miso\packages\miso-controller\` and integrate them into `@aifabrix/miso-client`. This will REPLACE existing implementations and add new Express-specific utilities.

## Source Location

**Miso-Controller Path:** `C:\git\esystemsdev\aifabrix-miso\packages\miso-controller\`

All source files will be read from this location and adapted for miso-client.

## Files to Extract and Adapt

### 1. Response Helpers

**Source:** `C:\git\esystemsdev\aifabrix-miso\packages\miso-controller\src\utils\response.util.ts`

**Target:** `src/express/response-helper.ts`

**Changes needed:**

- Line 7: Remove `import { createPaginatedListResponse } from '@aifabrix/miso-client';` (circular dependency)
- Use relative import: `import { createPaginatedListResponse } from '../utils/pagination.utils';`
- Line 8: Change `import { AppError } from '@/types/api.types';` to `import { AppError } from './error-types';`
- Keep all functionality intact (ResponseHelper class with success, created, paginated, noContent, accepted, error methods)

---

### 2. Response Middleware

**Source:** `C:\git\esystemsdev\aifabrix-miso\packages\miso-controller\src\middleware\response-helpers.middleware.ts`

**Target:** `src/express/response-middleware.ts`

**Changes needed:**

- Line 7: Change `import { ResponseHelper, PaginationMeta } from '@/utils/response.util';` to `import { ResponseHelper, PaginationMeta } from './response-helper';`
- Keep all functionality intact (inject ResponseHelpers middleware)

---

### 3. Async Handler

**Source:** `C:\git\esystemsdev\aifabrix-miso\packages\miso-controller\src\utils\async-handler.util.ts`

**Target:** `src/express/async-handler.ts`

**Changes needed:**

- Line 20: Change `import { handleRouteError } from './error-handler.util';` to `import { handleRouteError } from './error-handler';`
- Keep all functionality intact (asyncHandler, asyncHandlerNamed)

---

### 4. Validation Helper

**Source:** `C:\git\esystemsdev\aifabrix-miso\packages\miso-controller\src\services\validation.helper.service.ts`

**Target:** `src/express/validation-helper.ts`

**Changes needed:**

- Line 7: Change `import { AppError } from '@/types/api.types';` to `import { AppError } from './error-types';`
- Keep all functionality intact (ValidationHelper class with findOrFail, ensureNotExists, ensureOwnershipOrAdmin, validateAll, validateRequiredFields, ensureAuthenticated, validateStringLength)

---

### 5. Error Types (Extract from api.types.ts)

**Source:** `C:\git\esystemsdev\aifabrix-miso\packages\miso-controller\src\types\api.types.ts` (lines 1-199)

**Target:** `src/express/error-types.ts`

**Extract only:**

- Lines 3-10: `ApiResponse<T>` interface
- Lines 35-39: `ValidationError` interface
- Lines 41-45: `ApiError` interface  
- Lines 47-130: `AppError` class (with toErrorResponse method)
- Lines 132-152: `createSuccessResponse` function
- Lines 154-166: `createErrorResponse` function

**Omit:**

- PaginationQuery, PaginatedResponse (deprecated, use SDK)

**Changes needed:**

- Remove all `@/` imports (no dependencies in this file)
- Keep all AppError functionality intact

---

### 6. Error Handler

**Source:** `C:\git\esystemsdev\aifabrix-miso\packages\miso-controller\src\utils\error-handler.util.ts` (181 lines)

**Target:** `src/express/error-handler.ts`

**CRITICAL CHANGES:**

**Remove LoggerService dependency (lines 7, 13-26):**

```typescript
// OLD (lines 7, 13-26) - REMOVE:
import { LoggerService } from '@/services/logging/logger.service';
let loggerInstance: LoggerService | null = null;
function getLogger(): LoggerService { ... }

// NEW - Replace with injection pattern:
export interface ErrorLogger {
  logError(message: string, options: unknown): Promise<void> | void;
}

let customErrorLogger: ErrorLogger | null = null;

export function setErrorLogger(logger: ErrorLogger | null): void {
  customErrorLogger = logger;
}
```

**Remove Prisma import (line 10), use duck typing (lines 38-53):**

```typescript
// OLD (line 10) - REMOVE:
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// OLD (lines 38-53) - REMOVE typed check:
if (error && typeof error === 'object' && 'code' in error) {
  const prismaError = error as PrismaClientKnownRequestError;
  if (prismaError.code === 'P2002') return 409;
  ...
}

// NEW - Duck typing (no import needed):
if (error && typeof error === 'object' && 'code' in error) {
  const code = (error as { code: string }).code;
  // Support Prisma error codes without importing Prisma
  if (code === 'P2002') return 409;  // Unique constraint
  if (code === 'P2025') return 404;  // Record not found
  if (code === 'P2003') return 400;  // Foreign key
}
```

**Update imports:**

- Line 8: Change `import { AppError } from '@/types/api.types';` to `import { AppError } from './error-types';`
- Line 9: Change `import { createErrorResponse, sendErrorResponse, ErrorResponse } from './error-response.util';` to `import { createErrorResponse, sendErrorResponse, ErrorResponse } from './error-response';`

**Replace logger calls (lines 142-164):**

```typescript
// OLD - LoggerService calls:
const logger = getLogger();
await logger.logError(logMessage, { ... });

// NEW - Optional injection:
if (customErrorLogger) {
  try {
    await customErrorLogger.logError(logMessage, { ... });
  } catch (logError) {
    process.stderr.write(`[ERROR] Failed to log error: ${logError}\n`);
  }
} else {
  process.stderr.write(`[ERROR] ${logMessage}\n`);
}
```

---

### 7. Error Response

**Source:** `C:\git\esystemsdev\aifabrix-miso\packages\miso-controller\src\utils\error-response.util.ts` (138 lines)

**Target:** `src/express/error-response.ts`

**Changes needed:**

- Line 7: Change `import { ValidationError } from '@/types/api.types';` to `import { ValidationError } from './error-types';`
- Keep all RFC 7807 formatting
- **Keep RBAC extensions** (lines 10-42) - generic pattern, safe for public npm

**Note:** RBAC extensions are RFC 7807-compliant custom extensions, not AI Fabrix-specific.

---

### 8. Encryption Utility - REPLACE EXISTING

**Source:** `C:\git\esystemsdev\aifabrix-miso\packages\miso-controller\src\utils\encryption.util.ts` (110 lines)

**Target:** `src/express/encryption.ts` (NEW location) OR `src/utils/encryption.ts`

**REPLACE EXISTING:** [`src/services/encryption.service.ts`](src/services/encryption.service.ts)

**Changes needed:**

- None - already generic
- Uses Node.js `crypto` module only
- Environment variable `ENCRYPTION_KEY` is standard practice

**Differences from existing:**

- Miso-controller: Static class (EncryptionUtil.encrypt/decrypt)
- Miso-client current: Instance-based (new EncryptionService())
- **Decision:** Use miso-controller version (static, simpler API)

---

### 9. TypeScript Type Augmentation

**Source:** `C:\git\esystemsdev\aifabrix-miso\packages\miso-controller\src\types\express.d.ts` (lines 74-107)

**Target:** `src/express/express.d.ts`

**Extract ONLY Response extensions (lines 74-107):**

- Response.success
- Response.created
- Response.paginated
- Response.noContent
- Response.accepted

**Omit (AI Fabrix-specific):**

- All Request interface extensions (lines 29-71: user, application, roles, permissions, audit)
- ApplicationContext interface
- UserInfo interface

**Changes needed:**

- Line 26: Change `import type { PaginationMeta } from '@/utils/response.util';` to `import type { PaginationMeta } from './response-helper';`
- Remove Request extensions completely

---

### 10. Sort Utilities - Add Missing Function

**File to Update:** `src/utils/sort.utils.ts`

**Current state:**

- ✅ `parseSortParams()` exists (line 14) - parses query parameters like `?sort=-field`
- ✅ Already exported in `src/index.ts` (line 417)
- ❌ `applySorting()` missing - needs to be added

**Add this function to `src/utils/sort.utils.ts`:**

```typescript
/**
 * Apply sorting to data array based on sort options.
 * Useful for client-side sorting of in-memory data.
 * @param data - Array of data to sort
 * @param sortOptions - Array of sort options (field and order)
 * @returns Sorted array (new array, does not mutate original)
 */
export function applySorting<T extends Record<string, unknown>>(
  data: T[],
  sortOptions: SortOption[]
): T[] {
  if (!sortOptions || sortOptions.length === 0) {
    return data;
  }

  return [...data].sort((a, b) => {
    for (const sort of sortOptions) {
      const aVal = a[sort.field];
      const bVal = b[sort.field];

      // Handle null/undefined
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Compare values
      if (aVal < bVal) return sort.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.order === 'asc' ? 1 : -1;
    }
    return 0;
  });
}
```

**Verification:**

- Confirm `export * from './utils/sort.utils';` exists in `src/index.ts` (line 417)
- This will automatically export both `parseSortParams()` and `applySorting()`

**Test file:** Create `tests/utils/sort.utils.test.ts`

**Test cases:**

1. Test `parseSortParams()` with single sort
2. Test `parseSortParams()` with multiple sorts
3. Test `parseSortParams()` with descending order (- prefix)
4. Test `parseSortParams()` with empty query
5. Test `applySorting()` ascending order
6. Test `applySorting()` descending order
7. Test `applySorting()` multiple sort fields
8. Test `applySorting()` with null/undefined values
9. Test `applySorting()` with empty sort options
10. Test `applySorting()` does not mutate original array

---

## File Replacements vs New Files

### Files to REPLACE:

1. **[`src/services/encryption.service.ts`](src/services/encryption.service.ts)** → Replace with `src/express/encryption.ts` (or `src/utils/encryption.ts`)

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Keep in utils for backward compatibility
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Export both from `src/express` and `src/utils`

### Files to DELETE:

1. **[`src/services/encryption.service.ts`](src/services/encryption.service.ts)** - Replaced by miso-controller version
2. **`.github/workflows/npm-publish.yml`** - Replaced by manual version-bump and publish workflows

### Files to KEEP (No conflict):

1. **[`src/utils/errors.ts`](src/utils/errors.ts)** - SDK-specific (MisoClientError, ApiErrorException)
2. **[`src/types/errors.types.ts`](src/types/errors.types.ts)** - SDK-specific (ErrorResponse, ErrorEnvelope)

**Naming strategy:**

- SDK errors: `MisoClientError`, `ErrorResponse` (in src/utils/errors.ts, src/types/errors.types.ts)
- Express errors: `AppError`, `ErrorResponse` from error-response.ts (in src/express/)
- Export Express `ErrorResponse` as `ExpressErrorResponse` to avoid conflicts

---

## Directory Structure

```
src/
├── express/                    # NEW: Express.js utilities
│   ├── response-helper.ts      # ResponseHelper class
│   ├── response-middleware.ts  # injectResponseHelpers middleware
│   ├── async-handler.ts        # asyncHandler, asyncHandlerNamed
│   ├── validation-helper.ts    # ValidationHelper class
│   ├── error-types.ts          # AppError, ValidationError, ApiError, ApiResponse
│   ├── error-handler.ts        # handleRouteError (no LoggerService, no Prisma)
│   ├── error-response.ts       # createErrorResponse, sendErrorResponse (RFC 7807)
│   ├── encryption.ts           # EncryptionUtil (static class)
│   ├── express.d.ts            # TypeScript type augmentation (Response only)
│   └── index.ts                # Re-export all Express utilities
├── services/                   # Existing SDK services
│   └── encryption.service.ts   # DELETE (replaced)
├── utils/                      # Existing SDK utilities
│   ├── errors.ts               # KEEP (SDK errors)
│   └── encryption.ts           # NEW: Re-export for backward compat
└── types/                      # Existing SDK types
    └── errors.types.ts         # KEEP (SDK error types)
```

---

## Package Configuration Updates

### Update [`package.json`](package.json)

**Add peerDependencies:**

```json
{
  "peerDependencies": {
    "express": "^4.18.0 || ^5.0.0"
  }
}
```

**Add devDependencies:**

```json
{
  "devDependencies": {
    "@types/express": "^4.17.21"
  }
}
```

**Update description:**

```json
{
  "description": "AI Fabrix Client SDK - Authentication, authorization, logging, and Express.js utilities"
}
```

**Note:** Version will be managed by GitHub workflow (manual bump)

---

### Update [`src/index.ts`](src/index.ts)

**Add exports (after line 419):**

```typescript
// Express utilities
export * from './express';

// Backward compatibility: re-export EncryptionUtil
export { EncryptionUtil } from './express/encryption';
```

**Handle naming conflicts:**

```typescript
// Export Express ErrorResponse with alias to avoid conflict with SDK ErrorResponse
export { ErrorResponse as ExpressErrorResponse } from './express/error-response';
```

---

## GitHub Workflows

**⚠️ Replace Existing Workflow:**

- Delete existing `.github/workflows/npm-publish.yml` (automatic publish on push to main)
- Replace with 2 new manual workflows for better control

**Existing workflow issues:**

- ❌ No version bumping - publishes same version repeatedly
- ❌ No git tagging - no version tracking
- ❌ No GitHub Releases - no changelog
- ❌ Automatic on every push - can publish unintentionally
- ❌ No duplicate version check
- ❌ No package validation

**New workflows provide:**

- ✅ Manual version control (patch/minor/major)
- ✅ Git tagging and GitHub Releases
- ✅ Full validation before publish
- ✅ Duplicate version protection
- ✅ Package structure validation

---

### Workflow 1: Manual Version Bump

**File:** `.github/workflows/version-bump.yml`

**Trigger:** Manual (workflow_dispatch)

**Inputs:** version_type (patch | minor | major)

**Steps:**

1. Bump version in package.json using Node.js script
2. Create git commit: `chore: bump version to X.Y.Z`
3. Create git tag: `vX.Y.Z`
4. Push commit and tag
5. Create GitHub Release with changelog

---

### Workflow 2: Manual Publish to NPM

**File:** `.github/workflows/publish.yml`

**Triggers:**

- Manual (workflow_dispatch)  
- Automatic on GitHub Release published

**Steps:**

1. Get version from package.json
2. Check if version already published (prevent duplicates)
3. Install dependencies
4. Run linter
5. Build package
6. Verify build output (dist/ directory)
7. Test package structure (`npm pack --dry-run`)
8. Publish to npm with `--access public`
9. Verify publication
10. Update GitHub Release with npm link

---

## NPM Package Files

### Create `.npmignore`

```
# Source files
src/
tests/
*.test.ts

# Config files
tsconfig.json
jest.config.js
.eslintrc.js

# CI/CD
.github/
codecov.yml

# Development
node_modules/
coverage/
.vscode/
.idea/

# Keep only distribution
!dist/
```

---

### Create `scripts/pre-publish-check.sh`

**Purpose:** Validate package before publishing

**Checks:**

- Version doesn't have existing git tag
- Build succeeds
- Linting passes
- Tests pass
- No uncommitted changes
- Package contents correct (`npm pack --dry-run`)

---

## Testing Strategy

### Test Files to Create

**Express test files in `tests/express/`:**

1. **`response-helper.test.ts`** - Test ResponseHelper methods
2. **`async-handler.test.ts`** - Test asyncHandler error catching
3. **`validation-helper.test.ts`** - Test ValidationHelper methods
4. **`error-handler.test.ts`** - Test handleRouteError, logger injection
5. **`error-types.test.ts`** - Test AppError, toErrorResponse
6. **`error-response.test.ts`** - Test RFC 7807 formatting
7. **`encryption.test.ts`** - Test EncryptionUtil encrypt/decrypt

**Utilities test files in `tests/utils/`:**

8. **`sort.utils.test.ts`** - Test parseSortParams and applySorting

**Target:** 80%+ branch coverage for new Express utilities and sort utilities

---

## Documentation Updates

### Update [`README.md`](README.md)

**Add new section after existing SDK documentation:**

```markdown
## Express.js Utilities (v2.1.0+)

### Installation

For Express.js applications:

\`\`\`bash
npm install @aifabrix/miso-client express
\`\`\`

### Quick Start

\`\`\`typescript
import express from 'express';
import { 
  injectResponseHelpers,
  asyncHandler,
  ValidationHelper,
  setErrorLogger 
} from '@aifabrix/miso-client';

const app = express();

// Inject response helpers
app.use(injectResponseHelpers);

// Configure error logger (optional)
setErrorLogger({
  async logError(message, options) {
    console.error(message, options);
  }
});

// Use asyncHandler for automatic error handling
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await ValidationHelper.findOrFail(
    () => db.user.findById(req.params.id),
    'User',
    req.params.id
  );
  res.success(user, 'User retrieved');
}));
\`\`\`

### Response Helpers

Standardized API response formatting:

\`\`\`typescript
import { ResponseHelper } from '@aifabrix/miso-client';

// Success response (200)
return ResponseHelper.success(res, data, 'Success message');

// Created response (201)
return ResponseHelper.created(res, newResource, 'Resource created');

// Paginated response
return ResponseHelper.paginated(res, items, {
  currentPage: 1,
  pageSize: 20,
  totalItems: 100,
  type: 'user'
});

// No content (204)
return ResponseHelper.noContent(res);

// Accepted (202)
return ResponseHelper.accepted(res, { jobId: '123' }, 'Job queued');
\`\`\`

### Async Handler

Eliminates try-catch blocks in route handlers:

\`\`\`typescript
import { asyncHandler } from '@aifabrix/miso-client';

// Automatic error handling
router.post('/users', asyncHandler(async (req, res) => {
  const user = await userService.create(req.body);
  res.created(user, 'User created');
}));

// Named variant for better error messages
router.get('/users/:id', asyncHandlerNamed('getUser', async (req, res) => {
  const user = await userService.findById(req.params.id);
  res.success(user);
}));
\`\`\`

### Validation Helper

Common validation patterns:

\`\`\`typescript
import { ValidationHelper } from '@aifabrix/miso-client';

// Find or throw 404
const user = await ValidationHelper.findOrFail(
  () => prisma.user.findUnique({ where: { id } }),
  'User',
  id
);

// Ensure doesn't exist or throw 409
await ValidationHelper.ensureNotExists(
  () => prisma.user.findUnique({ where: { email } }),
  'User',
  email
);

// Check ownership or admin role
ValidationHelper.ensureOwnershipOrAdmin(req, resourceUserId);

// Validate required fields
ValidationHelper.validateRequiredFields(data, ['name', 'email'], 'User');

// Validate string length
ValidationHelper.validateStringLength(password, 'password', 8, 128);
\`\`\`

### Error Handling

Configure custom error logger:

\`\`\`typescript
import { setErrorLogger } from '@aifabrix/miso-client';

// Configure during app initialization
setErrorLogger({
  async logError(message, options) {
    await yourLogger.error(message, options);
  }
});
\`\`\`

### Encryption

AES-256-GCM encryption for sensitive data:

\`\`\`typescript
import { EncryptionUtil } from '@aifabrix/miso-client';

// Initialize once at startup (uses ENCRYPTION_KEY env var)
EncryptionUtil.initialize();

// Encrypt sensitive data
const encrypted = EncryptionUtil.encrypt('sensitive-data');

// Decrypt
const decrypted = EncryptionUtil.decrypt(encrypted);

// Generate new key (for setup)
const key = EncryptionUtil.generateKey();
console.log('ENCRYPTION_KEY=' + key);
\`\`\`

### Sort Utilities

Parse and apply sorting for API queries:

\`\`\`typescript
import { parseSortParams, applySorting } from '@aifabrix/miso-client';

// Parse sort query parameters
const sortOptions = parseSortParams({ sort: ['-createdAt', 'name'] });
// Returns: [{ field: 'createdAt', order: 'desc' }, { field: 'name', order: 'asc' }]

// Apply sorting to in-memory data (client-side)
const sortedData = applySorting(users, sortOptions);

// Or parse from Express request query
app.get('/users', (req, res) => {
  const sortOptions = parseSortParams(req.query);
  // Use sortOptions to build database query with Prisma/SQL
  const users = await prisma.user.findMany({
    orderBy: sortOptions.map(s => ({ [s.field]: s.order }))
  });
  res.success(users);
});
\`\`\`

**Note:** For large datasets, always sort at the database level. Use \`applySorting()\` only for small in-memory datasets or client-side sorting.
```

---

### Create `CHANGELOG.md`

Document version history starting with next release.

---

## Key Decisions

### 1. Replace EncryptionService with EncryptionUtil

**Decision:** Use miso-controller's static class approach

**Rationale:**

- Simpler API (no instantiation needed)
- Consistent with miso-controller
- Static methods easier to use
- Keep backward compatibility via re-export

### 2. Keep SDK Error Types Separate

**Decision:** SDK errors (MisoClientError) separate from Express errors (AppError)

**Rationale:**

- Different purposes (SDK internal vs application errors)
- No conflicts
- Clear separation of concerns

### 3. Remove LoggerService Dependency

**Decision:** Use optional injection pattern in error-handler

**Rationale:**

- Public npm package can't depend on AI Fabrix LoggerService
- Injection pattern allows flexibility
- Fallback to stderr if no logger configured

### 4. Remove Prisma Dependency

**Decision:** Use duck typing for Prisma error codes

**Rationale:**

- Public npm package shouldn't require Prisma
- Duck typing still works for apps using Prisma
- No breaking changes for error handling

### 5. Keep RBAC Extensions in Error Response

**Decision:** Keep RBAC error extensions in error-response.ts

**Rationale:**

- RFC 7807 allows custom extensions
- Generic pattern, not AI Fabrix-specific
- Useful for any RBAC system
- Safe for public npm

---

## Success Criteria

- [x] All 9 source files extracted from miso-controller
- [x] All imports adapted (no `@/` aliases, no AI Fabrix dependencies)
- [x] LoggerService removed from error-handler (injection pattern)
- [x] Prisma import removed (duck typing)
- [x] All files compile with zero TypeScript errors
- [x] All files pass ESLint with zero warnings
- [x] Encryption Service replaced with EncryptionUtil
- [x] `applySorting()` added to sort utilities (completes missing functionality)
- [x] `parseSortParams()` and `applySorting()` both exported from SDK
- [x] 8 test files created with 80%+ coverage (7 Express + 1 sort utilities)
- [x] Existing automatic workflow deleted (npm-publish.yml)
- [x] New manual GitHub workflows created (version-bump, publish)
- [x] Package configuration updated
- [x] Documentation updated
- [x] No breaking changes to existing SDK functionality
- [x] `npm pack` shows correct contents

---

## Migration Guide for Miso-Controller

After this extraction, miso-controller should:

1. **Update dependency:**
   ```bash
   npm install @aifabrix/miso-client@latest
   ```

2. **Replace imports:**
   ```typescript
   // Before
   import { asyncHandler } from '@/utils/async-handler.util';
   import { ResponseHelper } from '@/utils/response.util';
   import { AppError } from '@/types/api.types';
   import { ValidationHelper } from '@/services/validation.helper.service';
   import { EncryptionUtil } from '@/utils/encryption.util';
   
   // After
   import {
     asyncHandler,
     ResponseHelper,
     AppError,
     ValidationHelper,
     EncryptionUtil
   } from '@aifabrix/miso-client';
   ```

3. **Configure error logger in server.ts:**
   ```typescript
   import { setErrorLogger } from '@aifabrix/miso-client';
   import { LoggerService } from '@/services/logging/logger.service';
   
   const logger = LoggerService.getInstance();
   setErrorLogger({
     async logError(message, options) {
       await logger.logError(message, options);
     }
   });
   ```

4. **Delete old utility files:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `src/utils/async-handler.util.ts`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `src/utils/response.util.ts`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `src/middleware/response-helpers.middleware.ts`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `src/services/validation.helper.service.ts`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `src/utils/error-handler.util.ts`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `src/utils/error-response.util.ts`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `src/utils/encryption.util.ts`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Parts of `src/types/api.types.ts` (extract AppError, keep rest)

---

## Estimated Effort

- **Read and analyze source files:** 1 hour
- **Extract and adapt files (9 files):** 5 hours
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Response helpers: 1 hour
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Async handler: 30 minutes
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Validation helper: 1 hour
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Error handling (3 files): 2 hours
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Encryption: 30 minutes
- **Replace EncryptionService:** 30 minutes
- **Add applySorting() utility:** 30 minutes
- **Tests (8 files):** 3.5 hours (7 Express + 1 sort utilities)
- **GitHub workflows (2 files):** 1 hour
- **Package configuration:** 30 minutes
- **Documentation:** 1 hour
- **Testing and validation:** 1 hour
- **Total:** ~14 hours

---

## Non-Goals (Out of Scope)

- ❌ Modifying existing SDK services (auth, roles, permissions, logging)
- ❌ Changing SDK configuration types
- ❌ Publishing to npm (done via GitHub workflows)
- ❌ Extracting AI Fabrix-specific middleware (unified-auth, RBAC, audit)
- ❌ Extracting Request type augmentation (AI Fabrix-specific)
- ❌ Modifying miso-controller files (they handle their side separately)