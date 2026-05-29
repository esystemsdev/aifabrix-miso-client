---
name: Plan192 miso-client
overview: "Execution-ready plan for the miso-client portion of plan 192: cookie-first browser session refresh, activity-driven refresh listener, strict browser/device separation, tests, and docs updates."
todos:
  - id: align-scope-and-prerequisites
    content: Confirm final in-scope/out-of-scope boundaries and review applicable project rules before implementation.
    status: completed
  - id: capture-auth-baseline-evidence
    content: Capture current browser/session/device auth behavior snapshots (request/response expectations and persistence behavior) before edits.
    status: completed
  - id: freeze-plan192-sdk-contract
    content: Lock final SDK contract from plan 192 (cookie-first browser refresh, activity-driven cadence, no browser refreshToken JSON, unchanged device refresh contract).
    status: completed
  - id: lock-cross-sdk-contract-parity
    content: Lock shared exposed contract parity with miso-client-python for common auth endpoints, payload fields, and boundary rules.
    status: completed
  - id: refactor-browser-refresh-surface
    content: Refactor browser auth refresh/session API and types to cookie-first /auth/session + /auth/refresh contract without browser refreshToken payload dependence.
    status: completed
  - id: implement-activity-driven-refresh
    content: Implement user-activity-based refresh listener with 60-second cadence and no polling loop.
    status: completed
  - id: enforce-runtime-memory-user-token
    content: Align browser user-token lifecycle to runtime-memory-first behavior and preserve deterministic stale-auth cleanup.
    status: completed
  - id: preserve-device-refresh-contract
    content: Preserve /api/v1/auth/login/device/refresh request-body refreshToken contract and add guardrails against browser-flow coupling.
    status: pending
  - id: add-update-tests
    content: Implement all automated tests listed in `## Expected Automated Tests` and verify they pass before final validation gates.
    status: pending
  - id: update-docs
    content: Update README/docs/changelog for final browser auth contract and migration impact.
    status: completed
  - id: run-validation-gates
    content: Run validation gates in required silent-first order with fallback rules and zero-warning expectations.
    status: completed
  - id: run-manual-sdk-smoke
    content: Run manual SDK smoke scenarios for browser session restore/refresh, auth-expired behavior, and device-refresh non-regression.
    status: pending
  - id: close-definition-of-done
    content: Confirm all DoD criteria are met and mark plan closure only after gates, tests, docs, and checklist completion.
    status: pending
isProject: false
---

# Plan192 Miso-Client Cookie Session Cutover

## Goal
Implement the `miso-client` scope from [192 unified token providers](/workspace/aifabrix-miso/.cursor/plans/192-unified-token-providers.plan.md) as a standalone SDK execution plan.

## Execution Status (2026-05-29)

### Completed in code
- Cookie-first browser refresh contract update for `/api/v1/auth/refresh` (no required frontend `refreshToken` JSON body).
- Activity-driven refresh listener implementation (`mousemove` / `click` / `keydown`) with 60-second cadence and no polling loop.
- Runtime-memory-first browser token lifecycle alignment and deterministic stale-auth cleanup behavior.
- Docs/changelog updates for browser contract and listener behavior.
- Silent validation gates passed in required order.

### Remaining to close plan
- Add explicit device-flow non-regression guard assertion for `/api/v1/auth/login/device/refresh` request-body `refreshToken` contract in the targeted test scope.
- Complete manual SDK smoke checklist.
- Close DoD after the two items above are complete.

## Source Scope (From Plan 192)
- Activity-driven silent refresh listener (mouse/click/keyboard), 60-second cadence, no polling loop.
- Browser `/auth/refresh` cookie-first contract (no frontend `refreshToken` JSON expectation).
- Strict separation between browser session flow and device refresh flow.
- Clear runtime separation between user auth context and M2M `x-client-token` context.

## Cross-SDK Contract Parity (TypeScript + Python)

The following exposed contracts must be aligned across `miso-client` and `miso-client-python` for the same controller APIs:

- **Browser session restore/refresh boundary**
  - Browser-oriented contract uses cookie-first `/api/v1/auth/session` + `/api/v1/auth/refresh`.
  - Browser refresh contract does not require frontend `refreshToken` JSON payload.
- **Device refresh boundary**
  - `/api/v1/auth/login/device/refresh` keeps request-body `refreshToken` contract.
  - Device refresh may return rotated `refreshToken`; browser refresh does not depend on it.
- **M2M vs user auth separation**
  - `x-client-token` flow remains separate from user bearer/session flow.
  - No contract blending between client-token APIs and browser session APIs.
- **Shared payload contract expectations**
  - Common auth response fields remain compatible (`accessToken`, `expiresIn`, optional metadata).
  - API-facing field naming remains camelCase for wire contracts.
- **Error/behavior semantics**
  - Expired/invalid browser session yields clean auth-required behavior.
  - Device refresh failure behavior is explicit and non-regressed.

## Scope
### In scope
- DataClient browser auth/session restore-refresh contract updates.
- Activity-driven refresh listener implementation.
- Browser user-token lifecycle alignment to runtime-memory-first behavior.
- Device refresh non-regression (`/api/v1/auth/login/device/refresh` remains unchanged).
- SDK tests and docs/changelog updates.

### Out of scope
- `miso-controller`, `miso-ui`, `dataplane` code changes.
- `miso-client-python` code changes.
- Infra/deployment/container operations.

## Rules and Standards
- [.cursor/rules/project-rules.mdc - Token Management](./../rules/project-rules.mdc): applies because this plan changes browser refresh/session behavior and must preserve strict user-session vs `x-client-token` boundaries.
- [.cursor/rules/project-rules.mdc - API Layer Pattern](./../rules/project-rules.mdc): applies because auth endpoint contracts and typed API surfaces are being updated.
- [.cursor/rules/project-rules.mdc - Testing Conventions](./../rules/project-rules.mdc): applies because unit and integration-like SDK tests are a core deliverable.
- [.cursor/rules/project-rules.mdc - Naming Conventions](./../rules/project-rules.mdc): applies because wire/public SDK fields must remain camelCase.
- [.cursor/rules/project-rules.mdc - Security Guidelines](./../rules/project-rules.mdc): applies because authentication/token flows and sensitive data handling are in scope.
- [.cursor/rules/project-rules.mdc - When Adding New Features](./../rules/project-rules.mdc): applies because this is a behavior and contract change requiring docs and tests.

Key requirements enforced by this plan:
- Keep controller auth calls on `x-client-token` policy and avoid introducing credential leakage patterns.
- Keep public/wire contract fields camelCase.
- Keep error and auth behavior deterministic for expired/invalid browser sessions.
- Update docs when contract/public behavior changes.
- Complete silent-first validation gates in required order before closure.

## Before Development
- [ ] Re-read plan 192 contract invariants and freeze browser/device boundary expectations.
- [ ] Verify baseline behavior in target auth files (session restore, refresh, cleanup, device refresh path).
- [ ] Confirm test targets and existing mocks for auth/session/activity behavior.
- [ ] Confirm doc update targets (`README.md`, `docs/*`, `CHANGELOG.md`) and required migration notes.
- [ ] Confirm validation command availability and `.temp/validation` log inspection path for silent failures.

## Baseline Evidence
- Browser auth/token persistence currently handled in:
  - [data-client-auth.ts](/workspace/aifabrix-miso-client/src/utils/data-client-auth.ts)
  - [data-client-oauth.ts](/workspace/aifabrix-miso-client/src/utils/data-client-oauth.ts)
- Refresh token request contract currently modeled in:
  - [auth-token.api.ts](/workspace/aifabrix-miso-client/src/api/auth-token.api.ts)
  - [auth.types.ts](/workspace/aifabrix-miso-client/src/api/types/auth.types.ts)
- Auth service refresh flow currently expects refresh token input:
  - [auth.service.ts](/workspace/aifabrix-miso-client/src/services/auth.service.ts)
- Device refresh flow entry points are in:
  - [auth.api.ts](/workspace/aifabrix-miso-client/src/api/auth.api.ts)

## Implementation Plan
1. **Freeze SDK contract from plan 192**
   - Document final browser contract and device-contract guardrails before edits.

2. **Refactor browser refresh/session API surface**
   - Update browser refresh/session API call sites to enforce cookie-first behavior (`/api/v1/auth/session`, `/api/v1/auth/refresh`).
   - Remove browser dependency on request-body `refreshToken` for `/auth/refresh`.
   - Keep typed responses aligned to `accessToken`/`expiresIn` contract and preserve camelCase wire fields.

3. **Implement activity-driven refresh listener**
   - Add listener triggered by user activity (`mousemove`, `click`, `keydown`).
   - Enforce 60-second refresh check cadence under activity.
   - No background polling loops.

4. **Align browser user-token lifecycle to runtime memory**
   - Remove normal browser-path reliance on persistent localStorage for user auth token lifecycle.
   - Keep stale-auth cleanup behavior deterministic and idempotent across repeated failures.

5. **Preserve strict browser vs device flow separation**
   - Browser session flow uses cookie-first `/auth/session` and `/auth/refresh`.
   - Device flow keeps `/api/v1/auth/login/device/refresh` with `refreshToken` request body.
   - Add explicit guard assertions/tests preventing browser-path changes from altering device refresh request schema.

6. **Update tests and docs**
   - Add/update unit tests for refresh contract, listener semantics, and boundary guarantees.
   - Update docs/changelog for final contract and breaking/behavioral changes.
   - Include cross-SDK parity notes for consumers using both SDK languages.

## File Touch Map (Planned)
- Browser auth/session orchestration:
  - [data-client-auth.ts](/workspace/aifabrix-miso-client/src/utils/data-client-auth.ts)
  - [data-client-oauth.ts](/workspace/aifabrix-miso-client/src/utils/data-client-oauth.ts)
- API contract/types:
  - [auth-token.api.ts](/workspace/aifabrix-miso-client/src/api/auth-token.api.ts)
  - [auth.types.ts](/workspace/aifabrix-miso-client/src/api/types/auth.types.ts)
- Service-layer refresh orchestration:
  - [auth.service.ts](/workspace/aifabrix-miso-client/src/services/auth.service.ts)
- Device flow boundary:
  - [auth.api.ts](/workspace/aifabrix-miso-client/src/api/auth.api.ts)
- Tests:
  - `tests/unit/data-client-auth.test.ts`
  - `tests/unit/auth.service.test.ts`
  - `tests/unit/api/auth.api.test.ts`
- Docs:
  - [README.md](/workspace/aifabrix-miso-client/README.md)
  - [docs/dataclient.md](/workspace/aifabrix-miso-client/docs/dataclient.md)
  - [docs/authentication.md](/workspace/aifabrix-miso-client/docs/authentication.md)
  - [CHANGELOG.md](/workspace/aifabrix-miso-client/CHANGELOG.md)

## File Touch Map (Actual Execution)
- Browser runtime/session flow:
  - `src/utils/data-client-core.ts`
  - `src/utils/data-client-activity-refresh.ts` (new)
- Refresh API contract/types:
  - `src/api/auth-token.api.ts`
  - `src/api/types/auth.types.ts`
  - `src/types/config.types.ts`
- Service/public SDK refresh surface:
  - `src/services/auth.service.ts`
  - `src/miso-client.ts`
- Tests:
  - `tests/unit/data-client.test.ts`
  - `tests/unit/auth.service.test.ts`
  - `tests/unit/api/auth-token.api.test.ts`
- Docs/changelog:
  - `README.md`
  - `docs/dataclient.md`
  - `docs/authentication.md`
  - `CHANGELOG.md`

## Expected Automated Tests
### Unit
- Browser refresh request path does not require/send frontend `refreshToken` JSON for `/auth/refresh`.
- Activity-driven listener:
  - registers/removes activity handlers correctly;
  - enforces 60-second cadence;
  - has no polling-loop implementation.
- Browser token lifecycle and cleanup continue to work after restore/refresh failures.
- Device refresh contract unchanged (`refreshToken` body required for `/auth/login/device/refresh`).

### Integration-like SDK tests
- Session restore-first then refresh fallback ordering.
- Expired session yields clean auth-required behavior.
- No cross-contamination between user auth flow and M2M `x-client-token` flow.
- Contract parity checks for shared endpoints against Python SDK expectations (documented assertions).

## Manual Verification (SDK Smoke)
- [ ] Browser flow: session restore attempts `/api/v1/auth/session` before refresh fallback, and succeeds without requiring a frontend `refreshToken` payload.
- [ ] Expired/invalid browser session transitions to clear auth-required state without stale token reuse.
- [ ] Activity-driven refresh triggers on user interaction events only, respects 60-second cadence, and does not run a background polling loop.
- [ ] Device flow call to `/api/v1/auth/login/device/refresh` still requires request-body `refreshToken` and remains behaviorally unchanged.
- [ ] M2M client-token behavior remains isolated from browser user-session behavior (no header/payload cross-use).

## Documentation Updates
- [README.md](/workspace/aifabrix-miso-client/README.md)
- [docs/dataclient.md](/workspace/aifabrix-miso-client/docs/dataclient.md)
- [docs/authentication.md](/workspace/aifabrix-miso-client/docs/authentication.md)
- [CHANGELOG.md](/workspace/aifabrix-miso-client/CHANGELOG.md)

## Definition of Done
- Browser auth behavior satisfies plan 192 invariants (cookie handling, silent refresh model, expired-session handling, logout-safe flow separation).
- Browser `/auth/refresh` no longer depends on frontend `refreshToken` request payload.
- Activity-driven listener implemented with 60-second cadence and no polling loops.
- Device refresh contract preserved and covered by non-regression tests.
- Cross-SDK parity checklist is satisfied for shared exposed auth contracts with `miso-client-python`.
- `pnpm run tests:typecheck:silent` passes (fallback `pnpm run tests:typecheck` only if silent runner/log is not usable).
- `pnpm run build:silent` passes (fallback `pnpm run build` only if silent runner/log is not usable).
- `pnpm run fmt:silent` passes (fallback `pnpm run fmt` only if silent runner/log is not usable).
- `pnpm run md:lint:silent` passes; if needed run `pnpm run md:fix:silent` (fallback non-silent variants only if silent runner/log is not usable).
- `pnpm run lint:silent` passes (fallback `pnpm run lint` only if silent runner/log is not usable).
- `pnpm run test:silent` passes (fallback `pnpm run test` only if silent runner/log is not usable).
- On any `*:silent` failure, inspect `.temp/validation/*` logs first and run non-silent fallback only when silent output/log is insufficient.
- Zero lint warnings/errors are confirmed.
- All automated tests pass and manual SDK smoke checklist is completed.
- All public API outputs remain camelCase.
- Security requirements from project rules are met.
- Docs/changelog are updated for API/contract/public behavior changes.

## Risks and Mitigations
- **Risk:** Hidden coupling between browser refresh flow and device refresh schema.
  - **Mitigation:** Add explicit non-regression tests on `/api/v1/auth/login/device/refresh` request body and response handling.
- **Risk:** Regressions in auth cleanup causing sticky stale-session behavior.
  - **Mitigation:** Add failure-path tests asserting deterministic cleanup and re-login path.
- **Risk:** Contract drift between TypeScript and Python SDKs over time.
  - **Mitigation:** Keep a documented cross-SDK parity checklist and assert shared endpoint field expectations in tests.

## Validation
Run in order from `aifabrix-miso-client` root:
```bash
pnpm run tests:typecheck:silent
pnpm run build:silent
pnpm run fmt:silent
pnpm run md:lint:silent
# optional if markdown fixes are needed
pnpm run md:fix:silent
pnpm run lint:silent
pnpm run test:silent

# targeted auth checks (after main gates)
pnpm run test -- tests/unit/data-client-auth.test.ts
pnpm run test -- tests/unit/auth.service.test.ts
pnpm run test -- tests/unit/api/auth.api.test.ts
```

Silent failure handling:
- On `*:silent` failure, inspect `.temp/validation/*` logs first.
- Use non-silent fallback only when silent output/logs are not actionable.

### Validation Execution Result (2026-05-29)
- ✅ `pnpm run tests:typecheck:silent`
- ✅ `pnpm run build:silent`
- ✅ `pnpm run fmt:silent`
- ✅ `pnpm run md:lint:silent`
- ✅ `pnpm run lint:silent`
- ✅ `pnpm run test:silent`

Targeted follow-up tests run for changed auth scope:
- ✅ `pnpm run test -- tests/unit/data-client.test.ts tests/unit/auth.service.test.ts tests/unit/api/auth-token.api.test.ts`

## Plan Validation Report

**Date**: 2026-05-29
**Plan**: `/workspace/aifabrix-miso-client/.cursor/plans/59-plan192_miso-client_b447c41b.plan.md`
**Status**: ✅ VALIDATED

### Plan Purpose

- Deliver plan 192 TypeScript SDK auth cutover with cookie-first browser refresh/session behavior.
- Preserve strict device refresh and M2M token boundary while updating tests and docs.

### Applicable Rules

- ✅ `.cursor/rules/project-rules.mdc` (Token Management) - required for browser/user token and `x-client-token` separation.
- ✅ `.cursor/rules/project-rules.mdc` (API Layer Pattern + Naming Conventions) - required for typed contract updates and camelCase outputs.
- ✅ `.cursor/rules/project-rules.mdc` (Testing Conventions) - required for unit/integration-like test coverage and pass criteria.
- ✅ `.cursor/rules/project-rules.mdc` (Security Guidelines) - required for auth/session flow hardening and sensitive-data-safe behavior.
- ✅ `.cursor/rules/project-rules.mdc` (When Adding New Features) - required for docs updates and implementation discipline.

### DoD Gate Readiness

- ✅ Ordered commands are explicit and match required silent-first order.
- ✅ Zero-warning lint requirement is explicit.
- ✅ Tests + docs requirements are explicit.

### Todo Synchronization

- ✅ Frontmatter `todos` are structurally valid (`id`, `content`, `status`).
- ✅ Todos map to scope/prereq, implementation, tests, docs, validation, and final closure phases.
- ✅ Missing phases were added (rules/prereq alignment and DoD closure).

### Updates Applied

- Added `Rules and Standards` and `Before Development` sections.
- Reworked `Definition of Done` and `Validation` to required silent-first gate sequence.
- Synchronized frontmatter todos with all major plan phases.
- Added/updated plan-level validation status block.

### Risks / Follow-ups

- Keep cross-SDK parity checks current as Python SDK evolves.
- Keep targeted auth tests maintained when auth internals move across files.