# Encryption SDK Integration (Breaking Change)

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns - API Layer Pattern](.cursor/rules/project-rules.mdc#api-layer-pattern)** - EncryptionApi must follow centralized API pattern with endpoint constants
- **[Architecture Patterns - Service Layer](.cursor/rules/project-rules.mdc#service-layer)** - EncryptionService must receive ApiClient as dependency
- **[Architecture Patterns - HTTP Client Pattern](.cursor/rules/project-rules.mdc#http-client-pattern)** - Use `httpClient.request()` for client-token authenticated requests
- **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - Use interfaces for public APIs, strict mode
- **[Code Style - Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions)** - camelCase for all public API outputs
- **[Error Handling](.cursor/rules/project-rules.mdc#error-handling)** - Extend MisoClientError, use try-catch, log errors
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest tests with mocked dependencies, 80%+ coverage
- **[Code Size Guidelines](.cursor/rules/project-rules.mdc#code-size-guidelines)** - Files ≤500 lines, methods ≤20-30 lines
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Never expose secrets, proper token handling

**Key Requirements:**

- Endpoint URLs as static readonly constants
- API request/response types use interfaces with camelCase
- API methods use `extractErrorInfo` and `logErrorWithContext`
- EncryptionError extends `MisoClientError` with stack trace capture
- Unit tests mock `HttpClient` and `ApiClient`
- All public functions have JSDoc comments

## Before Development

- [ ] Review existing API: `src/api/logs-create.api.ts`, `src/api/roles.api.ts`
- [ ] Review error class: `src/utils/errors.ts`
- [ ] Review test pattern: `tests/unit/api/logs-create.api.test.ts`

## Definition of Done

1. **Build**: Run `pnpm run build` FIRST (must succeed)
2. **Lint**: Run `pnpm run lint` (zero errors)
3. **Test**: Run `pnpm test` (all pass)
4. **Order**: BUILD → LINT → TEST (mandatory)

---

## Breaking Changes

- **Removed**: `EncryptionUtil` class from `src/express/encryption.ts`
- **Removed**: `encryptionKey` config from `MisoClientConfig`
- **Added**: `client.encryption.encrypt()`/`decrypt()` methods

## Target Interface

```typescript
const result = await client.encryption.encrypt('sensitive-data', 'my-parameter');
// { value: 'kv://my-parameter', storage: 'keyvault' }

const plaintext = await client.encryption.decrypt(result.value, 'my-parameter');
```

## Controller Endpoints

- **POST `/api/security/parameters/encrypt`** - `{ plaintext, parameterName }` → `{ value, storage }`
- **POST `/api/security/parameters/decrypt`** - `{ value, parameterName }` → `{ plaintext }`

## Files to Create

- `src/api/types/encryption.types.ts` - Interfaces: EncryptRequest, EncryptResponse, DecryptRequest, DecryptResponse
- `src/api/encryption.api.ts` - EncryptionApi with error logging pattern
- `src/services/encryption.service.ts` - EncryptionService with validation
- `src/utils/encryption-error.ts` - EncryptionError extending MisoClientError
- `tests/unit/api/encryption.api.test.ts`
- `tests/unit/services/encryption.service.test.ts`

## Files to Delete

- `src/express/encryption.ts` - Old EncryptionUtil
- `tests/unit/encryption.service.test.ts` - Old tests

## Files to Modify

- `src/api/index.ts` - Add `encryption: EncryptionApi`
- `src/index.ts` - Add encryption property, exports
- `src/express/index.ts` - Remove EncryptionUtil export
- `src/types/config.types.ts` - Remove `encryptionKey`
- `CHANGELOG.md` - Breaking changes + migration guide
- `docs/reference-services.md` - Encryption methods docs

## Key Implementation

### EncryptionApi Pattern

```typescript
export class EncryptionApi {
  private static readonly ENCRYPT_ENDPOINT = '/api/security/parameters/encrypt';

  async encrypt(params: EncryptRequest): Promise<EncryptResponse> {
    try {
      return await this.httpClient.request<EncryptResponse>('POST', EncryptionApi.ENCRYPT_ENDPOINT, params);
    } catch (error) {
      const errorInfo = extractErrorInfo(error, { endpoint: EncryptionApi.ENCRYPT_ENDPOINT, method: 'POST' });
      logErrorWithContext(errorInfo, '[EncryptionApi]');
      throw error;
    }
  }
}
```

### Parameter Validation

```typescript
private static readonly PARAMETER_NAME_REGEX = /^[a-zA-Z0-9._-]{1,128}$/;
```

### CHANGELOG Migration Guide

```markdown
## [4.0.0]

### Breaking Changes
- Removed `EncryptionUtil` class
- Removed `encryptionKey` config

### Migration
Before: `EncryptionUtil.encrypt('secret')`
After: `await client.encryption.encrypt('secret', 'param-name')`
```

## Version

**3.9.0 → 4.0.0** (major breaking change)