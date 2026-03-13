---
name: Logs audit id rename sdk copy
overview: Copy of the TypeScript SDK-only breaking-change plan for logs/audit Key-to-Id migration, filter contract updates, and validation gates.
todos:
  - id: inventory-sdk-log-surfaces
    content: Build exhaustive inventory of all SDK functions/types that read filtered logs/audit data
    status: pending
  - id: update-sdk-contract-types
    content: Rename sourceKey/externalSystemKey/recordKey to sourceId/externalSystemId/recordId and add clientId in SDK log/audit contracts
    status: pending
  - id: update-sdk-filter-contracts
    content: Add applicationId/sourceId/externalSystemId/recordId filters and remove application-name filter from logs/audit list contracts
    status: pending
  - id: sync-api-param-passthrough
    content: Ensure all logs/audit API wrapper methods pass new filter params through to controller endpoints
    status: pending
  - id: sync-logger-context-keys
    content: Update logger builder/chain/service so emitted context keys match renamed backend fields
    status: pending
  - id: comments-and-jsdoc-alignment
    content: Add or normalize field-purpose comments/JSDoc for renamed and new fields in public SDK contracts
    status: pending
  - id: tests-and-regression-coverage
    content: Update/add unit tests for renamed fields and filters, including pass-through and compatibility regressions
    status: pending
  - id: consumer-migration-notes
    content: Prepare concise migration notes for SDK consumers with before/after examples for renamed fields and filters
    status: pending
  - id: quality-gates
    content: Validate build, lint, and tests pass with zero TypeScript/ESLint issues
    status: pending
isProject: false
---

# Logs and Audit Key-to-Id Migration Plan (TypeScript SDK)

## Source

- Consumer plan: [/workspace/aifabrix-miso/.cursor/plans/144.6_logs_audit_id_rename_plan_a7e5d556.plan.md](/workspace/aifabrix-miso/.cursor/plans/144.6_logs_audit_id_rename_plan_a7e5d556.plan.md)
- Parallel Python plan for alignment: [/workspace/aifabrix-miso-client-python/.cursor/plans/144.6_logs_audit_python_copy_7a797490.plan.md](/workspace/aifabrix-miso-client-python/.cursor/plans/144.6_logs_audit_python_copy_7a797490.plan.md)

## Scope

This plan keeps only the `miso-client` (TypeScript SDK) scope from the source cross-repo plan and aligns structure/quality gates with the parallel Python SDK plan.

## Source and Adaptation Notes

- Keep only TypeScript SDK scope from the source cross-repo plan.
- Convert cross-repo requirements into repository-local, file-level tasks.
- Keep the same breaking-change decision with no compatibility window for `*Key` fields.

## Locked Decisions

- This plan covers only `/workspace/aifabrix-miso-client` (TypeScript SDK).
- Migration is a breaking change with no temporary compatibility window in SDK contracts.
- Contract naming alignment:
  - `sourceKey` -> `sourceId`
  - `externalSystemKey` -> `externalSystemId`
  - `recordKey` -> `recordId`
- Logs/audit filtering must use id-based fields (`applicationId`) and not expose application-name filtering at SDK contract level for list methods.
- Public outputs remain camelCase with clear purpose comments/JSDoc.

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc). Applicable sections:

- **[Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns)** - API layer consistency, service/logger patterns, token/header behavior, and Redis fallback patterns apply to logs and logger changes.
- **[Code Style](.cursor/rules/project-rules.mdc#code-style)** - TypeScript strictness, interface-first public contracts, camelCase outputs, and async error-handling conventions are required.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest structure, mocking strategy, and branch-coverage expectations apply to all updated APIs/logger surfaces.
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Protect credentials/tokens, avoid sensitive logging leakage, and preserve controller auth header rules.
- **[Performance Guidelines](.cursor/rules/project-rules.mdc#performance-guidelines)** - Preserve cache-safe/fallback-safe behavior where logger and API flows touch Redis/HTTP paths.
- **[Code Size Guidelines](.cursor/rules/project-rules.mdc#code-size-guidelines)** - Keep files and methods within limits or split logic.
- **[Documentation](.cursor/rules/project-rules.mdc#documentation)** - Public method/field changes require JSDoc and migration documentation updates.
- **[When Adding New Features](.cursor/rules/project-rules.mdc#when-adding-new-features)** - Update types first, then API/service wiring, tests, and docs.

**Key Requirements**

- Keep all public API outputs camelCase; do not leave public snake_case names.
- Use interfaces for public request/response contracts and keep endpoint constants centralized in API classes.
- Use try/catch for async service-style flows and avoid uncaught errors from service methods.
- Always check `redis.isConnected()` before Redis usage and preserve fallback behavior.
- Ensure no token/secret exposure (`clientId`/`clientSecret`) in logs or client-exposed contracts.
- Maintain test coverage expectations (>=80% branch coverage target for changed/new code paths).

## Current SDK Evidence (Already Identified)

- Legacy key fields and filter contracts are present in:
  - `src/api/types/logs.types.ts`
  - `src/api/logs-list.api.ts`
- Logger pipeline still uses legacy key naming in:
  - `src/services/logger/log-entry-builder.ts`
  - `src/services/logger/logger.service.ts`
  - `src/services/logger/logger-chain.ts`
- Top-level API wrapper alignment is required in:
  - `src/api/logs.api.ts`

## Files in Scope

- [src/api/types/logs.types.ts](/workspace/aifabrix-miso-client/src/api/types/logs.types.ts)
- [src/api/logs-list.api.ts](/workspace/aifabrix-miso-client/src/api/logs-list.api.ts)
- [src/api/logs.api.ts](/workspace/aifabrix-miso-client/src/api/logs.api.ts)
- [src/api/logs-stats.api.ts](/workspace/aifabrix-miso-client/src/api/logs-stats.api.ts)
- [src/types/config.types.ts](/workspace/aifabrix-miso-client/src/types/config.types.ts)
- [src/utils/logging-helpers.ts](/workspace/aifabrix-miso-client/src/utils/logging-helpers.ts)
- [src/services/logger/log-entry-builder.ts](/workspace/aifabrix-miso-client/src/services/logger/log-entry-builder.ts)
- [src/services/logger/logger.service.ts](/workspace/aifabrix-miso-client/src/services/logger/logger.service.ts)
- [src/services/logger/logger-chain.ts](/workspace/aifabrix-miso-client/src/services/logger/logger-chain.ts)
- [tests/unit/api/logs-list.api.test.ts](/workspace/aifabrix-miso-client/tests/unit/api/logs-list.api.test.ts)
- [tests/unit/api/logs.api.test.ts](/workspace/aifabrix-miso-client/tests/unit/api/logs.api.test.ts)
- [tests/unit/api/logs-stats.api.test.ts](/workspace/aifabrix-miso-client/tests/unit/api/logs-stats.api.test.ts)
- [tests/unit/logger.service.test.ts](/workspace/aifabrix-miso-client/tests/unit/logger.service.test.ts)
- [tests/unit/audit-log-queue.test.ts](/workspace/aifabrix-miso-client/tests/unit/audit-log-queue.test.ts)
- [tests/unit/logging-helpers.test.ts](/workspace/aifabrix-miso-client/tests/unit/logging-helpers.test.ts)

## Before Development

- [ ] Re-read applicable sections in `.cursor/rules/project-rules.mdc` (Architecture Patterns, Code Style, Testing Conventions, Security Guidelines, Code Size Guidelines).
- [ ] Complete the full logs/audit surface inventory and mark each item `updated` / `not-applicable` / `pending`.
- [ ] Confirm filter-contract strategy for shared query types (split vs compatibility path) before implementation.
- [ ] Review existing logger + API tests to pre-map required assertions for renamed fields and pass-through behavior.
- [ ] Identify documentation targets for migration notes (README/docs API usage examples) and include them in execution scope.

## Workstreams

### 1) Contract and Type Migration

- Build a complete inventory of TypeScript SDK log/audit contracts, filtered methods, wrappers, and logger-emitted keys.
  - Mark each inventoried item as `updated`, `not-applicable` (with reason), or `pending`.
  - Do not start sign-off until every inventory item is resolved.
- Rename log/audit request and response fields to `sourceId`, `externalSystemId`, `recordId`.
- Add `clientId` where needed for parity with backend/controller semantics.
- Remove remaining public `*Key` field names in in-scope logs/audit contracts.

### 2) Filter Contract Migration

- Add/standardize list filters: `applicationId`, `sourceId`, `externalSystemId`, `recordId`.
- Remove public `application` (name) filter from logs/audit list contracts.
- Keep non-logs/non-audit areas out of scope unless separately requested.
- Resolve shared query type ambiguity explicitly:
  - either split logs/audit query params from jobs/stats/export contracts,
  - or keep a compatibility path for non-logs surfaces while enforcing id-based filters on logs/audit list methods.

### 3) API Pass-through and Wrapper Consistency

- Update `logs-list.api.ts` query construction to pass new filters.
- Keep `logs.api.ts` wrapper signatures/delegation fully synchronized.
- Validate `logs-stats.api.ts` for wrapper/secondary-surface consistency with updated filter/type contracts.
- Ensure no wrapper drops new filter parameters.

### 4) Logger Pipeline Alignment

- Update logger builder/service/chain to emit renamed id-based keys.
- Ensure emitted payload keys align with backend column naming expectations.

### 5) Comments, Migration Notes, and Tests

- Normalize field-purpose comments/JSDoc for renamed/new public fields.
- Prepare consumer migration notes (before/after usage):
  - `*Key` -> `*Id`
  - `application` filter -> `applicationId`
  - `clientId` availability
- Update/add unit tests for:
  - filter pass-through
  - renamed request/response fields
  - wrapper regression (no parameter loss)
- Prefer exhaustive coverage across all logs/audit SDK surfaces, not representative-only checks.

## Definition of Done

1. All inventoried TypeScript SDK surfaces are marked updated or not-applicable with reason.
2. In-scope logs/audit SDK contracts no longer expose `sourceKey/externalSystemKey/recordKey`.
3. `clientId` is present where required by updated contracts.
4. Logs/audit list filters support `applicationId/sourceId/externalSystemId/recordId` and do not rely on public application-name filtering.
5. `logs-list.api.ts`, `logs.api.ts`, and `logs-stats.api.ts` are consistent with updated contracts and do not drop filter parameters.
6. Logger builder/service/chain emit renamed fields consistently.
7. JSDoc/comments updated for changed public fields.
8. Tests pass for updated logs/audit API and logger flows.
9. Build passes first: `pnpm run build` (mandatory first gate).
10. Lint passes second with zero warnings/errors: `pnpm run lint` (mandatory second gate).
11. Tests pass third: `pnpm test` (mandatory third gate; maintain >=80% branch coverage target for changed/new code).
12. Validation order is enforced: BUILD -> LINT -> TEST (no skipped gates).
13. File size limits respected: source files <=500 lines and methods <=20-30 lines (or split refactor applied).
14. Security requirements satisfied: no hardcoded secrets, no credential exposure, correct token/header handling.
15. Redis/error handling requirements are preserved where applicable (`redis.isConnected()` checks + fallback-safe behavior).
16. Documentation/migration guidance is updated for public usage changes.
17. Changes comply with `.cursor/rules/project-rules.mdc`.

## Validation Sequence

1. `pnpm run build`
2. `pnpm run lint`
3. `pnpm test`
4. Optional focused lint detail during implementation: `pnpm exec eslint src/api/types/logs.types.ts src/api/logs-list.api.ts src/api/logs.api.ts src/api/logs-stats.api.ts src/types/config.types.ts src/utils/logging-helpers.ts src/services/logger/log-entry-builder.ts src/services/logger/logger.service.ts src/services/logger/logger-chain.ts tests/unit/api/logs-list.api.test.ts tests/unit/api/logs.api.test.ts tests/unit/api/logs-stats.api.test.ts tests/unit/logger.service.test.ts tests/unit/audit-log-queue.test.ts tests/unit/logging-helpers.test.ts`

Completion requires all three validation steps to pass.

## Out of Scope

- Controller and backend repository changes.
- Python SDK changes.
- DB migrations in other repositories.

## Plan Validation Report

**Date**: 2026-03-13  
**Plan**: `.cursor/plans/56_logs_audit_id_rename_sdk_copy_6276802f.plan.md`  
**Status**: ✅ VALIDATED

### Plan Purpose

This plan defines a breaking migration for the TypeScript SDK logs/audit surfaces from `*Key` fields to `*Id` fields, aligns filter contracts and logger payload emission, and enforces wrapper/test/documentation consistency before implementation.

### Applicable Rules

- ✅ [Architecture Patterns](.cursor/rules/project-rules.mdc#architecture-patterns) - Required for API/service/logger structure and token/cache behavior.
- ✅ [Code Style](.cursor/rules/project-rules.mdc#code-style) - Required for TypeScript interface/camelCase/JSDoc/error-handling consistency.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) - Required for Jest layout, mocks, and coverage strategy.
- ✅ [Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines) - Required for safe token/credential handling and secure logging.
- ✅ [Code Size Guidelines](.cursor/rules/project-rules.mdc#code-size-guidelines) - Required for maintainable file/method boundaries.
- ✅ [Documentation](.cursor/rules/project-rules.mdc#documentation) - Required for public contract and migration updates.

### Rule Compliance

- ✅ DoD requirements documented with mandatory gate order.
- ✅ Rules and Standards section added with linked applicable rule sections.
- ✅ Before Development checklist added.
- ✅ Security/testing/code-size requirements explicitly captured in DoD.
- ✅ Documentation update requirement included.

### Plan Updates Made

- ✅ Added `Rules and Standards` section with rule links and key requirements.
- ✅ Added `Before Development` checklist.
- ✅ Upgraded `Definition of Done` with mandatory BUILD -> LINT -> TEST gate sequence and zero-warning lint requirement.
- ✅ Updated `Validation Sequence` to use required `pnpm run lint` gate and retained focused `pnpm exec eslint ...` as optional detailed check.
- ✅ Appended this validation report to the plan.

### Recommendations

- Keep the inventory table/state (updated/not-applicable/pending) visible during execution to prevent partial sign-off.
- Validate filter-contract split/compatibility decision early, because it affects API typings and tests across multiple files.