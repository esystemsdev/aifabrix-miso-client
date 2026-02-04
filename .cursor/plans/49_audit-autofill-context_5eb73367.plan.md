---
name: audit-autofill-context
overview: Identify what request/audit context can be auto-filled beyond IP, then update SDK middleware + context plumbing to populate those fields consistently and document the behavior in existing references/examples.
todos:
  - id: inventory-context
    content: Review logger context types + current auto-fill list
    status: pending
  - id: extend-autofill
    content: Pass referer/requestSize into logger context
    status: pending
  - id: docs-example
    content: Align docs and step-6 audit example with auto-fill list
    status: pending
  - id: tests
    content: Add/adjust middleware/context tests
    status: pending
isProject: false
---

# Audit Context Auto-Fill Plan

## Findings (current behavior)

- `loggerContextMiddleware` already builds context from request + JWT and sets it in AsyncLocalStorage via `setLoggerContext`. It currently auto-fills: `ipAddress`, `method`, `path`, `userId`, `sessionId`, `applicationId`, `userAgent`, `correlationId` (server-generated if missing), `requestId`, and `token` (from Authorization header). See `[/workspace/aifabrix-miso-client/src/express/logger-context.middleware.ts](/workspace/aifabrix-miso-client/src/express/logger-context.middleware.ts)`.
- `extractRequestContext` can also derive `referer` and `requestSize`, but those fields are not currently passed into the logger context. See `[/workspace/aifabrix-miso-client/src/utils/request-context.ts](/workspace/aifabrix-miso-client/src/utils/request-context.ts)`.
- Docs already list auto-extracted fields (IP, method, path, userAgent, correlationId, userId, sessionId, applicationId) in `[/workspace/aifabrix-miso-client/docs/reference-errors.md](/workspace/aifabrix-miso-client/docs/reference-errors.md)`, while the audit example uses `setLoggerContext` manually in non-Express contexts in `[/workspace/aifabrix-miso-client/examples/step-6-audit.ts](/workspace/aifabrix-miso-client/examples/step-6-audit.ts)`.

## Approach

- Standardize auto-fill expectations around the existing `loggerContextMiddleware` (your selected direction), and close the gaps so audit logs always have the fullest trustworthy context possible without per-call manual setup.

## Rules and Standards

This plan must comply with the following rules from `[/workspace/aifabrix-miso-client/.cursor/rules/project-rules.mdc](/workspace/aifabrix-miso-client/.cursor/rules/project-rules.mdc)`:

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - Middleware/context changes must align with SDK patterns.
- **[Error Handling](.cursor/rules/project-rules.mdc#error-handling)** - Ensure RFC 7807 compliance and logging context expectations.
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Avoid sensitive data leakage in logs/context.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest tests and coverage expectations.
- **[Code Size Guidelines](.cursor/rules/project-rules.mdc#code-size-guidelines)** - Keep files/methods within limits.
- **[Documentation](.cursor/rules/project-rules.mdc#documentation)** - JSDoc and documentation updates.

**Key Requirements**:

- Never expose secrets; token context is for logging only and must not be logged as plain text.
- Express error handling must remain RFC 7807 compliant and use `asyncHandler`/`handleRouteError`.
- Add/adjust tests with Jest and cover edge cases for context extraction.
- Keep files under 500 lines and methods under 20–30 lines.

## Before Development

- Review `loggerContextMiddleware` and `extractRequestContext` current behavior.
- Identify any logger context interface/type definitions to update (if needed).
- Confirm audit/logging usage in docs/examples to keep guidance consistent.
- Check existing tests around request context/middleware for patterns.

## Definition of Done

1. **Build**: Run `pnpm run build` (must run first, must succeed).
2. **Lint**: Run `pnpm exec eslint <touched_paths>` (must pass with zero errors/warnings; lint only edited files/dirs).
3. **Test**: Run `pnpm test` after lint (all tests pass; add/adjust tests as needed).
4. **Order**: BUILD → LINT → TEST (mandatory sequence).
5. **Quality**: Files ≤500 lines; methods ≤20–30 lines.
6. **Documentation**: Public-facing updates reflected in docs/examples as needed.
7. **Security**: No secrets logged; token context not logged as plain text.
8. **Rules**: All applicable sections from `project-rules.mdc` satisfied.
9. **Tasks**: All implementation steps complete.

## Implementation Steps

1. **Inventory & align logger context shape**
  - Confirm the logger context interface/type (in unified logger factory/services) includes the current fields and decide whether to formally include `referer` and `requestSize` as optional fields for audit/logging.
  - Decide trust classification in comments/docs (server-derived vs client-provided) for each field.
2. **Extend middleware auto-fill coverage**
  - Update `buildLoggerContext` to pass through `referer` and `requestSize` from `extractRequestContext` so they’re auto-filled when available.
  - Keep `correlationId` server-generated fallback and existing JWT-derived fields (`userId`, `sessionId`, `applicationId`) intact.
3. **Update audit logging documentation & example**
  - In `reference-errors.md`, update the auto-extracted list to reflect full auto-fill coverage (add `requestId`, `referer`, `requestSize`, and clarify `token` handling if it’s used as context only).
  - In `examples/step-6-audit.ts`, adjust the manual `setLoggerContext` example to show minimal required fields (or remove manual fields that are auto-filled in Express) and clarify which are auto-filled vs manually set in non-Express environments.
4. **Validate with tests (if applicable)**
  - Add/adjust unit tests around `extractRequestContext` and `loggerContextMiddleware` to ensure the new fields are captured and passed through.

## Proposed Auto-Fill Fields (beyond IP)

- **Explicit**: `ipAddress` is auto-filled by `loggerContextMiddleware` (server-derived, proxy-aware)
- **Request metadata**: `method`, `path`, `userAgent`, `correlationId` (server-generated fallback), `requestId`, `referer`, `requestSize`
- **User/session**: `userId`, `sessionId`, `applicationId` (JWT-derived)
- **Token**: `token` (for context only; not logged as plain text)

## Notes / Decisions

- Keep the auto-fill list consistent between middleware behavior and docs to avoid confusion.
- Do not add new middleware; extend the existing `loggerContextMiddleware`.

## Plan Validation Report

**Date**: 2026-02-04  
**Plan**: `.cursor/plans/49_audit-autofill-context_5eb73367.plan.md`  
**Status**: ✅ VALIDATED

### Plan Purpose

Clarify and extend auto-filled audit/logging context (beyond IP) using existing `loggerContextMiddleware`, update docs/examples, and ensure tests cover the new fields.

### Applicable Rules

- ✅ [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) - Middleware/context changes must align with SDK patterns.
- ✅ [Error Handling](.cursor/rules/project-rules.mdc#error-handling) - RFC 7807 compliance and logging context expectations.
- ✅ [Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines) - Logging must not expose sensitive data.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) - Jest testing and coverage expectations.
- ✅ [Code Size Guidelines](.cursor/rules/project-rules.mdc#code-size-guidelines) - File/method size limits.
- ✅ [Documentation](.cursor/rules/project-rules.mdc#documentation) - Update docs/examples and keep JSDoc current.

### Rule Compliance

- ✅ DoD Requirements: Documented (build → lint → test, zero warnings/errors).
- ✅ Security/logging requirements: Explicitly called out.
- ✅ Testing expectations: Included.

### Plan Updates Made

- ✅ Added Rules and Standards section with rule links and key requirements.
- ✅ Added Before Development checklist.
- ✅ Added Definition of Done with required validation order.
- ✅ Appended validation report.

### Recommendations

- Keep audit context fields consistent between middleware behavior and docs.
- Ensure token context is never logged as plain text.

