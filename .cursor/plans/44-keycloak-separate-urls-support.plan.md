# Keycloak Separate Private/Public URL Support

Add support for separate private and public Keycloak URLs in the SDK so that `validateTokenLocal()` can fetch JWKS from the private/internal URL while still validating tokens against the public issuer URL.

## Problem Statement

Currently, the SDK only supports a single `authServerUrl` for Keycloak configuration. When `validateTokenLocal()` runs on the server, it constructs the JWKS URI using this single URL. However, in production environments:

- **Public URL** (`KEYCLOAK_PUBLIC_SERVER_URL`): Used by browsers/users to authenticate and receive tokens (tokens contain this URL in the `iss` claim)
- **Private URL** (`KEYCLOAK_SERVER_URL`): Used internally by servers to fetch JWKS keys (faster, more secure, avoids public network)

The SDK needs to:

1. Fetch JWKS from the **private URL** (server-side)
2. Validate token issuer against the **public URL** (matches token's `iss` claim)

## Architecture

The solution will mirror the existing `controllerPublicUrl`/`controllerPrivateUrl` pattern:

1. Add `authServerPrivateUrl` and `authServerPublicUrl` to `KeycloakConfig`
2. Create `resolveKeycloakUrl()` utility function (similar to `resolveControllerUrl()`)
3. Update `TokenValidationService` to use resolved URL for JWKS fetching
4. Keep issuer validation using public URL (from token's `iss` claim)

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns - Service Layer](.cursor/rules/project-rules.mdc#service-layer)** - Service structure, dependency injection, configuration access
- **[Architecture Patterns - Token Management](.cursor/rules/project-rules.mdc#token-management)** - Token handling patterns
- **[Architecture Patterns - JWT Token Handling](.cursor/rules/project-rules.mdc#jwt-token-handling)** - JWT decoding patterns, issuer validation
- **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - Strict mode, interfaces over types, public readonly config
- **[Code Style - Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions)** - camelCase for public APIs, PascalCase for classes
- **[Error Handling - Service Layer](.cursor/rules/project-rules.mdc#service-layer-error-handling)** - Return appropriate defaults on errors, use try-catch
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, mock external dependencies, 80%+ coverage
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-size-guidelines)** - File size ≤500 lines, methods ≤20-30 lines, JSDoc documentation
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Proper URL validation, no hardcoded secrets
- **[Performance Guidelines](.cursor/rules/project-rules.mdc#performance-guidelines)** - JWKS caching already implemented

**Key Requirements**:

- Maintain backward compatibility with existing `authServerUrl` configuration
- Use environment detection (`isBrowser()`) to select appropriate URL
- Validate URLs using existing `validateUrl()` utility
- Handle localhost → 127.0.0.1 conversion (same as controller URL resolver)
- All public API outputs use camelCase (no snake_case)
- Add JSDoc comments for all public methods with parameter types and return types
- Keep files ≤500 lines and methods ≤20-30 lines
- Never expose sensitive URLs in error messages
- Mock all external dependencies in tests
- Test both success and error paths, edge cases (missing URLs, invalid formats)

## Before Development

- [ ] Read Architecture Patterns - Service Layer section from project-rules.mdc
- [ ] Review existing `resolveControllerUrl()` implementation for pattern reference
- [ ] Review `TokenValidationService.validateKeycloakToken()` implementation
- [ ] Review `isBrowser()` utility function usage
- [ ] Review `validateUrl()` utility function
- [ ] Understand JWKS fetching and caching patterns
- [ ] Review testing requirements and mock patterns
- [ ] Review JSDoc documentation patterns
- [ ] Review backward compatibility requirements

## Implementation Steps

### 1. Update KeycloakConfig Type

**File**: `src/types/token-validation.types.ts`

- Add `authServerPrivateUrl?: string` for server-side JWKS fetching
- Add `authServerPublicUrl?: string` for browser-side and issuer validation
- Keep `authServerUrl: string` for backward compatibility (fallback)
- Update JSDoc comments to explain URL usage
```typescript
export interface KeycloakConfig {
  /** Keycloak server URL (fallback for backward compatibility) */
  authServerUrl: string;
  /** Keycloak private URL for server-side JWKS fetching (internal network) */
  authServerPrivateUrl?: string;
  /** Keycloak public URL for browser-side and issuer validation (public network) */
  authServerPublicUrl?: string;
  /** Keycloak realm name */
  realm: string;
  // ... rest of fields
}
```


### 2. Update MisoClientConfig Type

**File**: `src/types/config.types.ts`

- Update `keycloak` config to include new URL fields
- Keep backward compatibility with single `authServerUrl`
```typescript
keycloak?: {
  authServerUrl: string; // Keep for backward compatibility (fallback)
  authServerPrivateUrl?: string; // For server-side JWKS fetching (internal)
  authServerPublicUrl?: string; // For browser-side and issuer validation (public)
  realm: string;
  clientId?: string;
  clientSecret?: string;
  verifyAudience?: boolean;
};
```


### 3. Create resolveKeycloakUrl Utility

**File**: `src/utils/controller-url-resolver.ts`

- Add `resolveKeycloakUrl()` function (similar to `resolveControllerUrl()`)
- Use `isBrowser()` to detect environment
- Priority: environment-specific URL → `authServerUrl` → error
- Use `validateUrl()` for URL validation
- Handle localhost → 127.0.0.1 conversion
- Add comprehensive JSDoc comments
```typescript
/**
 * Resolve Keycloak URL based on environment and configuration
 * 
 * Priority order:
 * 1. Environment-specific URL (authServerPublicUrl for browser, authServerPrivateUrl for server)
 * 2. Fallback to authServerUrl if environment-specific URL not provided
 * 3. Throw error if no URL available
 * 
 * @param config - KeycloakConfig object
 * @returns Resolved Keycloak URL string
 * @throws Error if no valid URL is available
 */
export function resolveKeycloakUrl(config: KeycloakConfig): string {
  // Implementation similar to resolveControllerUrl()
}
```


### 4. Update TokenValidationService

**File**: `src/services/token-validation.service.ts`

- Import `resolveKeycloakUrl` from controller-url-resolver
- Update `validateKeycloakToken()` method:
        - Use `resolveKeycloakUrl()` for JWKS URI construction (uses private URL on server)
        - Use `authServerPublicUrl || authServerUrl` for issuer validation (matches token's `iss` claim)
        - Keep existing error handling and caching logic
```typescript
private async validateKeycloakToken(
  token: string,
  options?: TokenValidationOptions,
): Promise<TokenValidationResult> {
  // Use resolved URL for JWKS fetching (private on server, public on browser)
  const resolvedKeycloakUrl = resolveKeycloakUrl(this.keycloakConfig);
  const jwksUri = `${resolvedKeycloakUrl}/realms/${this.keycloakConfig.realm}/protocol/openid-connect/certs`;
  
  // For issuer validation, use public URL (matches token's iss claim)
  const expectedIssuer = `${this.keycloakConfig.authServerPublicUrl || this.keycloakConfig.authServerUrl}/realms/${this.keycloakConfig.realm}`;
  
  // ... rest of validation logic
}
```


### 5. Update Config Loader (Optional)

**File**: `src/utils/config-loader.ts`

- Add environment variable support for Keycloak URLs:
        - `KEYCLOAK_SERVER_URL` → `authServerPrivateUrl`
        - `KEYCLOAK_PUBLIC_SERVER_URL` → `authServerPublicUrl`
        - `KEYCLOAK_REALM` → `realm`
        - `KEYCLOAK_CLIENT_ID` → `clientId`
        - `KEYCLOAK_VERIFY_AUDIENCE` → `verifyAudience`
```typescript
// Optional Keycloak configuration for local token validation
if (process.env.KEYCLOAK_SERVER_URL || process.env.KEYCLOAK_PUBLIC_SERVER_URL) {
  config.keycloak = {
    authServerUrl: process.env.KEYCLOAK_PUBLIC_SERVER_URL || process.env.KEYCLOAK_SERVER_URL || '',
    authServerPrivateUrl: process.env.KEYCLOAK_SERVER_URL,
    authServerPublicUrl: process.env.KEYCLOAK_PUBLIC_SERVER_URL,
    realm: process.env.KEYCLOAK_REALM || '',
    clientId: process.env.KEYCLOAK_CLIENT_ID,
    verifyAudience: process.env.KEYCLOAK_VERIFY_AUDIENCE === 'true',
  };
}
```


### 6. Export resolveKeycloakUrl

**File**: `src/index.ts`

- Export `resolveKeycloakUrl` utility function (if needed for external use)
- Update exports section

### 7. Update Documentation

**Files**: `docs/configuration.md`, `docs/reference-types.md`, `CHANGELOG.md`

- Document new Keycloak URL configuration options
- Add examples showing both URLs
- Explain when to use private vs public URLs
- Update CHANGELOG with new feature

## URL Resolution Logic

### Server Environment (Node.js)

1. Use `authServerPrivateUrl` if provided
2. Fallback to `authServerUrl` if private URL not provided
3. Throw error if neither provided

### Browser Environment

1. Use `authServerPublicUrl` if provided
2. Fallback to `authServerUrl` if public URL not provided
3. Throw error if neither provided

### JWKS URI Construction

- Always use resolved URL (private on server, public on browser)
- Format: `${resolvedUrl}/realms/${realm}/protocol/openid-connect/certs`

### Issuer Validation

- Always use public URL (matches token's `iss` claim)
- Format: `${publicUrl}/realms/${realm}`
- Fallback to `authServerUrl` if public URL not provided

## Testing

- Unit tests for `resolveKeycloakUrl()`:
        - Server environment with private URL
        - Server environment with fallback to `authServerUrl`
        - Browser environment with public URL
        - Browser environment with fallback to `authServerUrl`
        - Error cases (no URLs provided, invalid URL format)
        - Localhost → 127.0.0.1 conversion
- Update `TokenValidationService` tests:
        - Test JWKS URI uses private URL on server
        - Test issuer validation uses public URL
        - Test backward compatibility with single `authServerUrl`
        - Test error handling for missing URLs
- Integration tests:
        - Test actual JWKS fetching from private URL (server)
        - Test token validation with public issuer URL
- Mock external dependencies (jose library, URL validation)
- Aim for 80%+ branch coverage

## Backward Compatibility

- Existing code using single `authServerUrl` will continue to work
- `authServerUrl` serves as fallback when environment-specific URLs not provided
- No breaking changes to public API
- All existing tests should continue to pass

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs TypeScript compilation)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, methods ≤20-30 lines
6. **JSDoc Documentation**: All public functions have JSDoc comments with parameter types and return types
7. **Code Quality**: All rule requirements met
8. **Security**: Proper URL validation, no hardcoded URLs, never expose sensitive URLs in errors
9. **Error Handling**: Proper error messages, use try-catch for all async operations
10. **Backward Compatibility**: Existing `authServerUrl` configuration continues to work
11. **URL Resolution**: Correct URL selected based on environment (browser vs server)
12. **JWKS Fetching**: Uses private URL on server, public URL on browser
13. **Issuer Validation**: Always uses public URL (matches token's `iss` claim)
14. **Testing**: All tests pass, proper mocking, edge cases covered
15. **Documentation**: Update documentation (configuration.md, reference-types.md, CHANGELOG.md)
16. All tasks completed
17. `resolveKeycloakUrl()` follows same pattern as `resolveControllerUrl()`
18. TokenValidationService correctly uses resolved URLs for JWKS and issuer validation

## Files to Modify

1. `src/types/token-validation.types.ts` - Update KeycloakConfig interface
2. `src/types/config.types.ts` - Update MisoClientConfig keycloak config
3. `src/utils/controller-url-resolver.ts` - Add resolveKeycloakUrl() function
4. `src/services/token-validation.service.ts` - Update validateKeycloakToken() method
5. `src/utils/config-loader.ts` - Add environment variable support (optional)
6. `src/index.ts` - Export resolveKeycloakUrl (if needed)
7. `docs/configuration.md` - Document new Keycloak URL options
8. `docs/reference-types.md` - Update KeycloakConfig documentation
9. `CHANGELOG.md` - Add feature entry
10. `tests/unit/controller-url-resolver.test.ts` - Add tests for resolveKeycloakUrl()
11. `tests/unit/token-validation.service.test.ts` - Update tests for new URL logic

---

## Plan Validation Report

**Date**: 2025-01-27

**Plan**: `.cursor/plans/44-keycloak-separate-urls-support.plan.md`

**Status**: ✅ VALIDATED

### Plan Purpose

Add support for separate private and public Keycloak URLs in the SDK so that `validateTokenLocal()` can fetch JWKS from the private/internal URL (server-side) while still validating tokens against the public issuer URL (matches token's `iss` claim). This mirrors the existing `controllerPublicUrl`/`controllerPrivateUrl` pattern.

**Scope**: TokenValidationService, KeycloakConfig types, URL resolver utility, config loader, documentation

**Type**: Feature Enhancement + Backward Compatibility

### Applicable Rules

- ✅ **[Architecture Patterns - Service Layer](.cursor/rules/project-rules.mdc#service-layer)** - Service updates, configuration access
- ✅ **[Architecture Patterns - Token Management](.cursor/rules/project-rules.mdc#token-management)** - Token validation patterns
- ✅ **[Architecture Patterns - JWT Token Handling](.cursor/rules/project-rules.mdc#jwt-token-handling)** - Issuer validation, JWKS fetching
- ✅ **[Code Style - TypeScript Conventions](.cursor/rules/project-rules.mdc#typescript-conventions)** - Type updates, interfaces over types
- ✅ **[Code Style - Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions)** - camelCase for public APIs
- ✅ **[Error Handling - Service Layer](.cursor/rules/project-rules.mdc#service-layer-error-handling)** - Error handling patterns
- ✅ **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, mocking, 80%+ coverage
- ✅ **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-size-guidelines)** - File size limits, method size limits, JSDoc requirements
- ✅ **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - URL validation, no hardcoded URLs
- ✅ **[Performance Guidelines](.cursor/rules/project-rules.mdc#performance-guidelines)** - JWKS caching already implemented

### Rule Compliance

- ✅ DoD Requirements: Documented with BUILD → LINT → TEST sequence
- ✅ Service Layer: Plan follows service pattern updates
- ✅ Token Management: Plan addresses JWKS fetching and issuer validation correctly
- ✅ Error Handling: Plan mentions try-catch and error handling patterns
- ✅ Testing: Plan includes comprehensive test requirements
- ✅ Code Quality: Plan mentions file size limits and JSDoc requirements
- ✅ Security: Plan addresses URL validation and security concerns
- ✅ Performance: Plan acknowledges existing JWKS caching
- ✅ Backward Compatibility: Plan explicitly addresses backward compatibility

### Plan Updates Made

- ✅ Added Rules and Standards section with all applicable rule references
- ✅ Added Before Development checklist with rule compliance items
- ✅ Updated Definition of Done section with complete DoD requirements
- ✅ Added rule references: Architecture Patterns (Service Layer, Token Management, JWT Handling), Code Style, Error Handling, Testing Conventions, Code Quality Standards, Security Guidelines, Performance Guidelines
- ✅ Added validation order: BUILD → LINT → TEST
- ✅ Added file size limits and JSDoc requirements
- ✅ Added security requirements (URL validation, no hardcoded URLs)
- ✅ Added error handling requirements (try-catch, proper error messages)
- ✅ Added testing requirements (80%+ coverage, mocking patterns)
- ✅ Added backward compatibility section
- ✅ Added URL resolution logic documentation

### Recommendations

- ✅ Plan is production-ready and follows all applicable rules
- ✅ Ensure `resolveKeycloakUrl()` follows exact same pattern as `resolveControllerUrl()` for consistency
- ✅ Consider adding integration tests for actual JWKS fetching from private URL
- ✅ Ensure error messages don't expose sensitive URLs
- ✅ Review existing TokenValidationService tests to ensure proper coverage of new URL logic
- ✅ Consider adding examples in documentation showing both single URL (backward compat) and dual URL configurations