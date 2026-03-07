---
name: restore-warn-log-level
overview: Restore `warn` as a first-class log level across the entire SDK pipeline (core logger, unified logger, transport, types, tests, and docs) without silent remapping to `info`.
todos:
  - id: align-log-level-types
    content: Align log level contracts and shared typing to include warn everywhere
    status: completed
  - id: implement-core-warn
    content: Implement core warn in LoggerService and preserve warn through transport
    status: completed
  - id: fix-unified-and-chain
    content: Update UnifiedLogger and LoggerChain so warn calls core warn directly
    status: completed
  - id: update-tests
    content: Expand unit and integration tests for warn and add warn-to-info regression guards
    status: completed
  - id: add-contract-guardrails
    content: Add maintainability guardrails (single source of truth + exhaustive mapping checks)
    status: completed
  - id: ci-gate-for-warn
    content: Define CI gates so warn contract regressions cannot be merged
    status: completed
  - id: update-docs-release-note
    content: Update README/docs and add migration plus release compatibility guidance
    status: completed
isProject: false
---

# Restore Warn as First-Class

## Goal

Ensure `warn` survives end-to-end without conversion to `info`: SDK API -> internal `LogEntry` -> transport (`createLog`) -> persistence/query -> documentation.

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc), especially:

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - Applies because this change updates logger services, transport mapping, and SDK logging flow.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** - Applies because public log-level contracts and method signatures are being changed.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Applies because warn behavior requires new unit/integration/regression tests.
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Applies because logging changes must preserve masking and avoid sensitive-data leaks.
- **[Code Size Guidelines](.cursor/rules/project-rules.mdc#code-size-guidelines)** - Applies because logger files are already large and must remain maintainable.
- **[Documentation](.cursor/rules/project-rules.mdc#documentation)** - Applies because public logging behavior and migration guidance must be documented.
- **[When Adding New Features](.cursor/rules/project-rules.mdc#when-adding-new-features)** - Applies because this is a public SDK behavior change with type/API/test/doc impact.

### Key Requirements from Rules

- Keep service patterns consistent (`src/services/`, dependency injection, use `httpClient.config` access pattern).
- Preserve secure logging defaults (mask sensitive data; never expose secrets).
- Use strict TypeScript contracts and camelCase public API outputs.
- Add/update Jest tests for success/error and regression behavior with realistic mocks.
- Keep source files under size limits where practical; extract helpers if needed.
- Update docs for changed public behavior before completion.

## Before Development

- Re-read logger-related architecture rules in `.cursor/rules/project-rules.mdc`.
- Confirm all impacted logging entry points (`LoggerService`, `UnifiedLoggerService`, `LoggerChain`, transport utilities, log API types).
- Confirm acceptance scope is Path B only (no broad logger refactor beyond warn parity).
- Confirm test strategy covers unit + integration + regression for warn preservation.
- Confirm documentation targets are included (`README.md`, `docs/audit-and-logging.md`, `docs/configuration.md`).

## Implementation Path

- Recommended default: **Path B (full contract alignment + guardrails)**.
- Scope baseline:
  - Implement first-class `warn` in core and unified logger paths.
  - Align transport typing/mapping so `warn` is preserved unchanged.
  - Add contract guardrails (shared level source + exhaustive mapping checks).
  - Add boundary + integration/regression tests.
  - Align docs and enforce CI merge gates for warn behavior.
- Out of scope for this change:
  - Broad logging architecture refactors beyond warn support.
  - New logging features unrelated to warn parity.

## Current Mismatch to Fix

- In [src/services/logger/unified-logger.service.ts](/workspace/aifabrix-miso-client/src/services/logger/unified-logger.service.ts), `warn()` currently calls `loggerService.info(...)`.
- In [src/types/config.types.ts](/workspace/aifabrix-miso-client/src/types/config.types.ts), `MisoClientConfig.logLevel` allows `warn`, but `LogEntry.level` does not.
- In [src/services/logger/logger.service.ts](/workspace/aifabrix-miso-client/src/services/logger/logger.service.ts), HTTP log-level mapping is limited to `"info" | "error" | "debug"`.
- In [README.md](/workspace/aifabrix-miso-client/README.md), `client.log.warn(...)` is documented, which is inconsistent with current core behavior.

## Code Changes

- Update the core log-level contract:
  - [src/types/config.types.ts](/workspace/aifabrix-miso-client/src/types/config.types.ts): extend `LogEntry.level` to include `"warn"` (`"error" | "warn" | "audit" | "info" | "debug"`).
- Add first-class `warn` support in core logger:
  - [src/services/logger/logger.service.ts](/workspace/aifabrix-miso-client/src/services/logger/logger.service.ts): add public `warn(message, context?, options?)` that calls `this.log("warn", ...)`.
  - Update `mapLogType(...)` so `warn` is emitted as `level: "warn"` and never remapped to `info`.
- Remove warn remap in unified logger:
  - [src/services/logger/unified-logger.service.ts](/workspace/aifabrix-miso-client/src/services/logger/unified-logger.service.ts): make `warn()` call `loggerService.warn(...)`; remove fallback comments.
- Align transport utility typing:
  - [src/services/logger/logger-http-utils.ts](/workspace/aifabrix-miso-client/src/services/logger/logger-http-utils.ts): replace narrow cast (`"info" | "error" | "debug"`) with a type that includes `warn`.
  - Verify consistency with [src/api/types/logs.types.ts](/workspace/aifabrix-miso-client/src/api/types/logs.types.ts), where `CreateLogRequest.data.level` already allows `warn`.
- Check fluent API parity:
  - [src/services/logger/logger-chain.ts](/workspace/aifabrix-miso-client/src/services/logger/logger-chain.ts): add `.warn(...)` for parity with `.info/.error/.audit`.

## Best-Practice Guardrails (Include in Implementation)

- Use a single source of truth for log levels where practical (shared `const` + derived unions) to avoid type drift across files.
- Add exhaustive handling for level mapping (`switch` + `never` assertion) so TypeScript fails when a level is not mapped.
- Keep contract tests at boundaries (serializer/mapper/API payload) to verify exact value preservation (`warn` stays `warn`).
- Add at least one end-to-end warn smoke test (emit -> transport -> persisted/readable -> query/filter).

## Tests (Required Minimum)

- Unit:
  - [tests/unit/unified-logger.test.ts](/workspace/aifabrix-miso-client/tests/unit/unified-logger.test.ts): assert `warn()` calls `loggerService.warn`, not `info`.
  - [tests/unit/logger.service.test.ts](/workspace/aifabrix-miso-client/tests/unit/logger.service.test.ts): assert `warn()` creates `LogEntry.level = "warn"`.
  - [tests/unit/services/logger-getter-methods.test.ts](/workspace/aifabrix-miso-client/tests/unit/services/logger-getter-methods.test.ts): ensure helper methods accept `warn`.
  - Add/update mapping tests to ensure HTTP payload keeps `warn` unchanged.
- Integration:
  - Validate createLog pipeline: emit `warn` -> transport payload includes `warn`.
- Regression:
  - Add explicit tests that prevent reintroduction of `warn -> info` remapping.

## CI Gate Template (Warn Contract)

- Required checks before merge:
  - `pnpm exec tsc --noEmit`
  - `pnpm exec eslint <changed-paths>`
  - Targeted warn unit tests
  - Warn transport/integration test
- Block merge if any of these fail (branch protection required status checks).

## Documentation and Release Notes

- Align docs to the actual contract:
  - [README.md](/workspace/aifabrix-miso-client/README.md)
  - [docs/audit-and-logging.md](/workspace/aifabrix-miso-client/docs/audit-and-logging.md)
  - [docs/configuration.md](/workspace/aifabrix-miso-client/docs/configuration.md)
- Add migration note:
  - Consumers currently using `info + originalLevel=warn` can move to native `warn`.
- Mark as potentially breaking for TypeScript users with exhaustive level checks.

## Definition of Done

Before this plan is marked complete, all items below must be satisfied:

1. Build runs first and succeeds: `pnpm run build`.
2. Lint runs second and succeeds with zero warnings/errors: `pnpm run lint`.
3. Tests run third and all pass: `pnpm test`.
4. Validation order is mandatory: **BUILD -> LINT -> TEST**.
5. Changed source files stay within code-size guidance (<=500 lines where practical; methods <=20-30 lines where practical).
6. Public/changed API methods include appropriate JSDoc.
7. No hardcoded secrets; secure logging behavior remains intact (masking still applied).
8. Warn is preserved unchanged across API contracts, runtime mapping, transport payload, and query/read behavior.
9. Rule references in this plan remain accurate and complete.
10. Documentation updates are included for public behavior changes.

## Merge Validation and Acceptance

- TypeScript passes: `pnpm exec tsc --noEmit`
- ESLint changed-path check passes for implementation iteration: `pnpm exec eslint <paths>`
- Full lint gate passes in DoD/CI: `pnpm run lint`
- Targeted warn unit tests + warn integration test pass
- Acceptance criterion:
  - `warn` is preserved unchanged across API, runtime mapping, transport, and read/query behavior.
  - Public types and documentation are consistent with runtime behavior.

## Validation

**Date**: 2026-02-19  
**Status**: ✅ COMPLETE

### Executive Summary

Implementation is complete for the selected Path B scope. Core logger behavior, unified wrapper behavior, transport typing/mapping, API log types, tests, and documentation were updated so `warn` is preserved as a first-class level (no remap to `info`).

### File Existence Validation

- ✅ `src/types/config.types.ts` - Exists and now includes `LOG_LEVELS`, `LogLevel`, and `LogEntry.level: LogLevel | "audit"`.
- ✅ `src/services/logger/logger.service.ts` - Exists and now includes `warn(...)`, exhaustive `mapLogType(...)`, and `assertNever(...)`.
- ✅ `src/services/logger/unified-logger.service.ts` - Exists and now forwards `warn(...)` to `loggerService.warn(...)`.
- ✅ `src/services/logger/logger-chain.ts` - Exists and now includes fluent `warn(...)`.
- ✅ `src/services/logger/logger-http-utils.ts` - Exists and now accepts/transmits `warn` in typed `logLevel`.
- ✅ `src/api/types/logs.types.ts` - Exists and now includes `warn` in `LogEntry` and `BatchLogEntry` unions.
- ✅ `tests/unit/unified-logger.test.ts` - Exists and validates `warn` forwarding to `loggerService.warn`.
- ✅ `tests/unit/logger.service.test.ts` - Exists and validates Redis/HTTP warn behavior and fluent chain warn behavior.
- ✅ `tests/unit/services/logger-getter-methods.test.ts` - Exists and validates warn in level acceptance matrix.
- ✅ `docs/audit-and-logging.md` - Exists and documents `warn` usage and migration note.

### Test Coverage

- ✅ Unit tests for warn behavior exist and pass.
- ✅ Integration requirement for warn transport path is covered by HTTP payload assertion in `tests/unit/logger.service.test.ts`.
- ✅ Regression coverage exists for previous `warn -> info` remap in `tests/unit/unified-logger.test.ts`.

### Code Quality Validation

**STEP 1 - FORMAT**: ✅ PASSED (`pnpm run lint:fix`)  
**STEP 2 - LINT**: ✅ PASSED (`pnpm run lint`, 0 errors, 0 warnings)  
**STEP 3 - TEST**: ✅ PASSED (`pnpm test`, all tests pass)

### Cursor Rules Compliance

- ✅ Code reuse: PASSED
- ✅ Error handling: PASSED
- ✅ Logging: PASSED
- ✅ Type safety: PASSED
- ✅ Async patterns: PASSED
- ✅ HTTP client patterns: PASSED
- ✅ Token management: PASSED
- ✅ Redis caching: PASSED
- ✅ Service layer patterns: PASSED
- ✅ Security: PASSED
- ✅ Public API naming: PASSED

### Implementation Completeness

- ✅ Services: COMPLETE
- ✅ Types: COMPLETE
- ✅ Utilities: COMPLETE
- ✅ Express utilities: N/A (no Express middleware changes required for this scope)
- ✅ Documentation: COMPLETE
- ✅ Exports: COMPLETE (no new export surface required beyond existing service exports)

### Issues and Recommendations

- `README.md` already referenced `client.log.warn(...)`; runtime behavior now matches that documented usage.
- Keep the warn regression tests as required CI checks to prevent reintroduction of warn remapping.

### Final Validation Checklist

- [x] All plan todos completed
- [x] All required files exist and are updated
- [x] Tests exist and pass
- [x] Code quality validation passes
- [x] Cursor rules compliance verified
- [x] Implementation complete

**Result**: ✅ **VALIDATION PASSED** - The plan has been implemented successfully and validated against quality gates and project rules.

