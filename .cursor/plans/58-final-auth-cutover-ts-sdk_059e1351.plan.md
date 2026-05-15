---
name: 58-final-auth-cutover-ts-sdk
overview: Finalize auth cutover in aifabrix-miso-client by removing migration-phase compatibility behavior and removing legacy/helper API surface as a hard cutover, while aligning runtime/docs/tests to the final cookie-first contract expected by the consumer plan.
todos:
  - id: pre-development-prerequisites
    content: Complete before-development prerequisites and confirm rule/contract baseline before implementation
    status: completed
  - id: freeze-final-contract
    content: Define final no-migration auth contract and map exact code/doc touchpoints
    status: completed
  - id: remove-migration-defaults
    content: Remove migration-oriented key compatibility from DataClient browser flow as hard cutover
    status: completed
  - id: remove-helper-api-surface
    content: Remove legacy/helper token compatibility API surface from SDK implementation and public exports as hard cutover
    status: completed
  - id: preserve-final-recovery
    content: Keep and verify final cookie-first restore/refresh/cleanup runtime behavior
    status: completed
  - id: update-tests-final-only
    content: Update/add tests for final-only semantics and negative legacy-key assertions
    status: completed
  - id: update-docs-changelog
    content: Revise docs/changelog to final cutover language and final SDK contract
    status: completed
  - id: refresh-miso-handoff
    content: Create handoff artifact in this project `.temp` for aifabrix-miso with final-only integration checklist and removed-compat details
    status: completed
  - id: create-consumer-migration-doc
    content: Create migration instruction document in this project `.temp` for SDK consumer integration cutover steps
    status: completed
  - id: run-validation-gates
    content: Run full validation gates in required order and confirm pass
    status: completed
  - id: close-dod
    content: Confirm Definition of Done is fully met and close plan execution
    status: completed
isProject: false
---

# 58 Final Auth Cutover for TypeScript SDK

## Goal
Implement the SDK part of final auth cutover from [`/workspace/aifabrix-miso/.cursor/plans/177.1-final-auth-cutover_5e7096c9.plan.md`](/workspace/aifabrix-miso/.cursor/plans/177.1-final-auth-cutover_5e7096c9.plan.md): remove migration-phase behavior and ship final-only auth contract in `aifabrix-miso-client`.

## Scope

### In scope
- Remove migration-only token-key compatibility behavior from browser DataClient path as hard cutover.
- Remove legacy/helper token compatibility API surface from implementation and `sdk-exports` as hard cutover.
- Keep final cookie-first auth recovery flow (restore -> refresh -> cleanup -> redirect/error).
- Update tests to verify final-only behavior and prevent migration-key regressions.
- Update SDK docs/changelog to final cutover language (no migration phase messaging).

### Out of scope
- No runtime code edits in `aifabrix-miso`, `aifabrix-dataplane`, `aifabrix-miso-client-python`.
- No infra/container/deployment changes.

## Rules and Standards

Apply project rules from [`/workspace/aifabrix-miso-client/.cursor/rules/project-rules.mdc`](/workspace/aifabrix-miso-client/.cursor/rules/project-rules.mdc):

- [Token Management](.cursor/rules/project-rules.mdc#token-management) - keep `x-client-token` policy and secure token handling.
- [HTTP Client Pattern](.cursor/rules/project-rules.mdc#http-client-pattern) - keep browser/client auth flow aligned with DataClient runtime design.
- [JWT Token Handling](.cursor/rules/project-rules.mdc#jwt-token-handling) - decode-only semantics and resilient claim parsing.
- [Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions) - public API outputs remain camelCase.
- [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) - explicit coverage for success/error/edge final-cutover flows.
- [Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines) - no client credential leakage; no migration logic that weakens final security posture.
- [When Adding New Features](.cursor/rules/project-rules.mdc#when-adding-new-features) - docs/changelog updates are mandatory for public contract changes.

## Before Development

- [x] Confirm exact migration-only keys/branches to remove from default path and list them explicitly before edits.
- [x] Confirm final default key strategy and callback order (`onSessionRestore` before `onTokenRefresh`) against consumer plan 177.1.
- [x] Confirm handoff doc target in `/workspace/aifabrix-miso-client/.temp` and next numeric filename prefix.
- [x] Confirm migration-instruction doc target in `/workspace/aifabrix-miso-client/.temp` and next numeric filename prefix.
- [x] Confirm tests to update first (`data-client-auth`, `data-client`, `user-token-refresh`) to avoid behavioral drift during refactor.

## Source Mapping From Consumer Plan
SDK-targeted files called out by consumer plan and used as implementation anchors:
- [`/workspace/aifabrix-miso-client/src/utils/user-token-refresh.ts`](/workspace/aifabrix-miso-client/src/utils/user-token-refresh.ts)
- [`/workspace/aifabrix-miso-client/src/utils/data-client-init.ts`](/workspace/aifabrix-miso-client/src/utils/data-client-init.ts)
- [`/workspace/aifabrix-miso-client/src/utils/data-client-oauth.ts`](/workspace/aifabrix-miso-client/src/utils/data-client-oauth.ts)
- [`/workspace/aifabrix-miso-client/src/utils/data-client-core.ts`](/workspace/aifabrix-miso-client/src/utils/data-client-core.ts)
- [`/workspace/aifabrix-miso-client/src/utils/data-client-request.ts`](/workspace/aifabrix-miso-client/src/utils/data-client-request.ts)
- [`/workspace/aifabrix-miso-client/src/types/data-client.types.ts`](/workspace/aifabrix-miso-client/src/types/data-client.types.ts)
- [`/workspace/aifabrix-miso-client/src/sdk-exports.ts`](/workspace/aifabrix-miso-client/src/sdk-exports.ts)
- [`/workspace/aifabrix-miso-client/docs/dataclient.md`](/workspace/aifabrix-miso-client/docs/dataclient.md)
- [`/workspace/aifabrix-miso-client/docs/authentication.md`](/workspace/aifabrix-miso-client/docs/authentication.md)
- [`/workspace/aifabrix-miso-client/CHANGELOG.md`](/workspace/aifabrix-miso-client/CHANGELOG.md)
- [`/workspace/aifabrix-miso-client/tests/unit/data-client-auth.test.ts`](/workspace/aifabrix-miso-client/tests/unit/data-client-auth.test.ts)

## Verified Current Baseline

- Default browser token flow currently supports multi-key access token handling (`miso_token`, `token`, `accessToken`, `authToken`) in `user-token-refresh`, `data-client-auth`, and `data-client-oauth`.
- Request recovery logic already implements restore-first `401` handling with refresh fallback and `403` no-refresh behavior in `data-client-request`.
- There is no dedicated `tests/unit/data-client-request.test.ts`; request-layer ordering and retry semantics are covered indirectly.
- Auth documentation surfaces to update for final cutover messaging are `docs/dataclient.md`, `docs/authentication.md`, `README.md`, and `CHANGELOG.md`.

## Final Contract Target

- Canonical browser access-token key after cutover: `miso_token`.
- Legacy compatibility keys become unsupported after cutover: `token`, `accessToken`, `authToken`.
- Legacy refresh/expiry compatibility aliases become unsupported after cutover:
  - refresh aliases: `refreshToken`, `refresh_token`
  - expiry aliases: `expiresAt`, `accessTokenExpiresAt`, `access_token_expires_at`
- Removed semantics in final contract:
  - alias lookup fallback,
  - alias fan-out writes,
  - compatibility cleanup paths.
- Legacy/helper token compatibility API surface is removed from public SDK exports and is not supported post-cutover.

## Implementation Plan

### 1) Freeze final auth contract (no migration phase)
- Define one canonical default browser contract:
  - cookie-first restore before token refresh,
  - no migration-key dependency for correctness,
  - stable cleanup semantics on failed recovery.
- Align DataClient config behavior to final contract and remove migration-specific wording/branches.

### 2) Remove migration-oriented key compatibility as hard cutover
- Enforce one final key strategy in DataClient browser flow (`init`, `oauth`, auth helpers, token lifecycle storage) with no migration aliases.
- Remove explicit/opt-in compatibility paths; legacy migration keys are unsupported after cutover.
- Ensure key lookup/write/clear behavior remains deterministic and security-safe.
- Remove duplicated compatibility writes (canonical storage map + secondary key fan-out) that exist only for migration behavior.

### 3) Remove legacy/helper API surface (hard breaking cutover)
- Remove legacy/helper token compatibility helpers that only support migration semantics from implementation and public exports.
- Remove compatibility-oriented exports from [`/workspace/aifabrix-miso-client/src/sdk-exports.ts`](/workspace/aifabrix-miso-client/src/sdk-exports.ts), keeping only final contract API surface.
- Ensure any removed helper surface is documented as an intentional breaking change for consumers.

### 4) Keep and harden final recovery flow
- Preserve final `401` orchestration in request path:
  - session restore callback,
  - fallback token refresh,
  - stale auth cleanup,
  - single retry, no 403 refresh.
- Ensure helper naming and public types remain camelCase and aligned with project rules.
- Validate callback ordering at request-layer level (`onSessionRestore` before `onTokenRefresh`) with direct unit coverage.

### 5) Update tests for final-only semantics
- Update/add tests in:
  - [`/workspace/aifabrix-miso-client/tests/unit/data-client-auth.test.ts`](/workspace/aifabrix-miso-client/tests/unit/data-client-auth.test.ts)
  - [`/workspace/aifabrix-miso-client/tests/unit/data-client.test.ts`](/workspace/aifabrix-miso-client/tests/unit/data-client.test.ts)
  - [`/workspace/aifabrix-miso-client/tests/unit/user-token-refresh.test.ts`](/workspace/aifabrix-miso-client/tests/unit/user-token-refresh.test.ts)
  - new focused request-flow tests (e.g., `tests/unit/data-client-request.test.ts`)
- Add explicit negative assertions that unsupported legacy keys do not influence behavior:
  - access keys: `token`, `accessToken`, `authToken`
  - refresh keys: `refreshToken`, `refresh_token`
  - expiry keys: `expiresAt`, `accessTokenExpiresAt`, `access_token_expires_at`
- Add export-surface assertions (or equivalent checks) that removed legacy/helper APIs are no longer available from SDK public exports.
- Add coverage for: restore-first ordering, refresh fallback, single retry only, no refresh on 403, and cleanup on failed recovery.

### 6) Update documentation and release notes
- Update:
  - [`/workspace/aifabrix-miso-client/docs/dataclient.md`](/workspace/aifabrix-miso-client/docs/dataclient.md)
  - [`/workspace/aifabrix-miso-client/docs/authentication.md`](/workspace/aifabrix-miso-client/docs/authentication.md)
  - [`/workspace/aifabrix-miso-client/README.md`](/workspace/aifabrix-miso-client/README.md)
  - [`/workspace/aifabrix-miso-client/CHANGELOG.md`](/workspace/aifabrix-miso-client/CHANGELOG.md)
- Replace migration-phase language with final cutover guidance and explicit consumer impact notes.
- Document hard-cutover impact as breaking contract guidance for consumers that still rely on legacy keys or removed helper APIs.
- Ensure final documentation consistently states:
  - canonical default token-key contract (`miso_token`),
  - lowercase `x-client-token` header guidance,
  - final callback semantics (`onSessionRestore` standard flow, `onTokenRefresh` role in final contract),
  - unsupported legacy key list after cutover.

### 7) Refresh handoff artifact for consumer agent
- Create handoff doc in `/workspace/aifabrix-miso-client/.temp` for `aifabrix-miso` with final-only contract (no migration phase), expected callbacks, and verification checklist.
- Use the next sequential numeric prefix in that folder (e.g., `NN-final-auth-cutover-sdk-handoff.md`) to match temp-document naming rules.

### 8) Create consumer migration instruction doc in current project temp
- Create a migration instruction document in `/workspace/aifabrix-miso-client/.temp` for the SDK consumer project (`aifabrix-miso`) that covers:
  - removed helper API surface and unsupported legacy key list,
  - required final callback flow (`onSessionRestore` before `onTokenRefresh`),
  - required consumer-side storage and cleanup behavior,
  - rollout and verification checklist.
- Use the next sequential numeric prefix in that folder (e.g., `NN-miso-consumer-migration-instruction.md`) to match temp-document naming rules.

## Expected Automated Tests
- DataClient auth flow tests for final `401` recovery chain and `403` no-refresh behavior.
- Token storage tests proving final key behavior and cleanup without migration-key reliance.
- Regression tests ensuring cookie-first path remains intact after migration-code removal.

## Definition of Done
- Migration-phase behavior and compatibility aliases are removed from SDK browser auth path.
- Legacy/helper token compatibility API surface is removed from SDK implementation/public exports.
- Final cookie-first auth contract is preserved and validated by tests.
- Docs/changelog communicate final-only cutover behavior and explicit breaking consumer impact.
- Handoff artifact is created in `/workspace/aifabrix-miso-client/.temp` for `aifabrix-miso` with final-only integration details.
- Migration instruction doc is created in `/workspace/aifabrix-miso-client/.temp` for consumer integration cutover.
- Validation gates pass in required order:
  1. `pnpm run tests:typecheck:silent` - fallback only if silent runner/log is not actionable: `pnpm run tests:typecheck`
  2. `pnpm run build:silent` - fallback only if silent runner/log is not actionable: `pnpm run build`
  3. `pnpm run fmt:silent` - fallback only if silent runner/log is not actionable: `pnpm run fmt`
  4. `pnpm run md:lint:silent`, then optional `pnpm run md:fix:silent` - fallback only if silent runner/log is not actionable: non-silent variants
  5. `pnpm run lint:silent` - fallback only if silent runner/log is not actionable: `pnpm run lint`
  6. `pnpm run test:silent` - fallback only if silent runner/log is not actionable: `pnpm run test`
- On each `*:silent` fail, inspect `.temp/validation/*` logs first; do not run non-silent fallback by default if log already provides clear diagnostics.

## Validation

```bash
pnpm run tests:typecheck:silent
pnpm run build:silent
pnpm run fmt:silent
pnpm run md:lint:silent
# optional, only if markdown lint requires fixes
pnpm run md:fix:silent
pnpm run lint:silent
pnpm run test:silent
```

Fallback policy:
- On any `*:silent` failure, inspect `.temp/validation/*` logs first.
- Run non-silent fallback only when silent output/log is not actionable.

Mandatory acceptance checks:
- zero lint warnings/errors
- all tests pass
- all public API outputs are camelCase
- security requirements from project rules are met
- docs are updated for API/contract/config/public behavior changes
- validation evidence is captured from `.temp/validation/*` for each silent gate run

## Validation Report

**Date**: 2026-05-19
**Status**: ✅ COMPLETE

### Executive Summary

- Core SDK hard-cutover implementation is present and validated.
- Required documentation artifacts in this project `.temp` are present for consumer migration and handoff.

### Task Completion

- Total: 11
- Completed: 11
- Incomplete: 0

### Task State Synchronization

- ✅ Markdown checkboxes synchronized
- ✅ Frontmatter `todos` synchronized
- ✅ No contradictions remain

### File and Implementation Validation

- ✅ Runtime hard-cutover changes validated in `src/utils/data-client-auth.ts`, `src/utils/data-client-oauth.ts`, `src/utils/data-client-init.ts`, `src/utils/user-token-refresh.ts`, and `src/sdk-exports.ts`.
- ✅ Consumer migration instruction doc exists: `/workspace/aifabrix-miso-client/.temp/01-miso-consumer-migration-instruction.md`.
- ✅ Consumer handoff doc exists: `/workspace/aifabrix-miso-client/.temp/02-final-auth-cutover-sdk-handoff.md`.

### Automated Tests Validation

- ✅ Unit tests exist for changed behavior, including `tests/unit/data-client-request.test.ts`.
- ✅ Expected automated tests for restore/refresh order, no-refresh-on-403, and final token-key semantics are implemented and passing.

### Quality Gates

- ✅ tests:typecheck
- ✅ build
- ✅ fmt
- ✅ md:lint (and md:fix if used)
- ✅ lint (0 warnings/errors)
- ✅ test

### Rules Compliance

- ✅ SDK token/header policy
- ✅ service/redis/error-handling patterns
- ✅ RFC 7807 / security / camelCase API

### Logs

- Full logs: `.temp/validation/*`

### Issues and Recommendations

- Non-blocking: `server/public/index.html` was reformatted by `fmt`; keep or drop this out-of-scope formatting diff explicitly.

### Final Checklist

- [x] All tasks implemented and synchronized
- [x] Files and tests validated
- [x] Quality gates passed in strict order
- [x] Rules compliance verified