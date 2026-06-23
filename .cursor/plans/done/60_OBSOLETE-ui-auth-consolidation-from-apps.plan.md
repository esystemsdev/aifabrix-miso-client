---
name: 60-OBSOLETE-ui-auth-consolidation-from-apps
overview: Extract shared browser auth patterns from miso-ui and dataplane app-ui into @aifabrix/miso-client, then thin both consumers to SDK helpers. Includes post-192.2 hard-cut realignment so browser-session helpers follow HttpOnly miso_access_token + server-only refresh-token semantics.
todos:
  - id: scope-and-baseline
    content: Inventory duplicated auth code in miso-ui and dataplane app-ui; record baseline file paths and behavior (split-port proxy, cookie session, silent recovery).
    status: pending
  - id: phase0-browser-session-shipped
    content: "Confirm 4.15.5+ exports shipped: createBrowserSessionClient, createCookieSessionCallbacks, ensureBrowserAccessToken, AUTH_BROWSER_SESSION_PATHS, SessionRestoreResult."
    status: completed
  - id: sdk-auth-path-constants
    content: Add AUTH_CONTROLLER_PATHS (session, refresh, login, callback, logout, clientToken) and re-export from sdk-exports; migrate dataplane AUTH_CONTROLLER_ENDPOINTS.
    status: completed
  - id: sdk-browser-api-base-url
    content: Add resolveBrowserApiBaseUrl (split-port / Vite proxy when configured host !== page host); unit tests with pageOrigin hook.
    status: completed
  - id: sdk-loopback-host-alignment
    content: Add alignLoopbackHostnameWithPage (localhost ↔ 127.0.0.1); adopt in miso-ui + dataplane misoConfig/browserControllerUrl.
    status: completed
  - id: sdk-silent-recovery-orchestrator
    content: Add recoverBrowserSessionWithStaleCleanup (refresh → restore → clear stale → retry); use in dataplane runSilentAuthRecovery and optional DataClient default.
    status: completed
  - id: sdk-activity-driven-session-refresh-reuse
    content: Standardize reusable activity-driven session refresh in SDK (mousemove/click/keydown with 60s throttle) and document integration contract for browser consumers.
    status: pending
  - id: sdk-browser-session-hardcut-realignment
    content: Realign createBrowserSessionClient/createCookieSessionCallbacks to 192.2 hard-cut contract where browser session endpoints may return authenticated session metadata without accessToken payload while auth continuity is represented by HttpOnly miso_access_token cookie.
    status: pending
  - id: sdk-browser-session-hardcut-tests
    content: Update browser-session and browser-session-recovery unit tests to validate cookie-session success without requiring response data.accessToken and to enforce no browser-readable refresh token assumptions.
    status: pending
  - id: sdk-unauthorized-helpers
    content: Export isUnauthorizedApiError and isInactiveTokenMessage; replace dataplane auth.ts and miso-ui inline checks.
    status: completed
  - id: sdk-client-token-url-utils
    content: Extract extractClientTokenFromUrl / removeClientTokenFromUrl from miso-ui into SDK; adopt in miso-ui.
    status: in_progress
  - id: sdk-oauth-browser-flow-optional
    content: "Optional: createOAuthBrowserFlow (login + callback fetch with credentials + x-client-token); thin miso-ui auth-client.auth-flow.ts."
    status: cancelled
  - id: sdk-create-browser-auth-dataclient
    content: "Optional: createBrowserAuthDataClient factory (preferCookieSessionRestore, cookie callbacks, default audit skipEndpoints)."
    status: cancelled
  - id: consumer-miso-ui-adopt
    content: "miso-ui: replace local controller-api-base-url, browser-session wrappers, and duplicate helpers with SDK; align to hard-cut compatible SDK version (>=4.17.3 lineage)."
    status: in_progress
  - id: consumer-miso-ui-activity-refresh-adopt
    content: Adopt SDK activity-driven session refresh in miso-ui with the same throttle semantics as dataplane (no more than once per 60 seconds) and remove ad-hoc app-level duplication.
    status: pending
  - id: consumer-dataplane-adopt
    content: "dataplane app-ui: wire createCookieSessionCallbacks + preferCookieSessionRestore; use SDK URL/recovery helpers; remove duplicated session HTTP from auth.ts."
    status: in_progress
  - id: consumer-remove-hardcut-shims
    content: Remove or thin local hardcut workaround shims in miso-ui/dataplane that compensate for old SDK token-payload assumptions (miso-ui miso-client-browser-sdk.ts, dataplane auth-browser-session fallback snapshot path) after SDK realignment.
    status: pending
  - id: consumer-shim-zero-tolerance-audit
    content: Verify consumer codebases contain no local auth shim modules duplicating SDK browser-session/auth helpers; capture evidence in handoff checklist before closure.
    status: pending
  - id: python-parity-notes
    content: Document which browser helpers are TS-only vs shared contract with miso-client-python (session/refresh paths only).
    status: pending
  - id: implement-expected-automated-tests
    content: Implement all automated tests listed in `## Expected Automated Tests` and verify they pass before final validation gates.
    status: completed
  - id: sdk-tests-and-docs
    content: Unit tests per new module; update docs/authentication.md, docs/dataclient.md, CHANGELOG; migration section for app teams.
    status: completed
  - id: validation-gates
    content: Run miso-client silent validation gates in required order; smoke miso-ui tsc and dataplane app-ui vitest auth slices after consumer bumps.
    status: in_progress
  - id: handoff-temp-doc
    content: Add .temp/ui-auth-consolidation-handoff.md with file-by-file adoption checklist for miso-ui and dataplane agents.
    status: pending
  - id: consumer-migration-instruction-temp-doc
    content: Create a temporary migration instruction document in .temp for consumer projects adopting the updated SDK browser auth contract and shim-removal workflow.
    status: pending
  - id: publish-and-close
    content: Publish @aifabrix/miso-client minor/patch; verify npm consumers resolve the hard-cut compatible version line (>=4.17.3 lineage); close DoD.
    status: pending
  - id: final-dod-closure
    content: Confirm all DoD criteria met (phases, consumers, gates, docs, security, camelCase exports); mark plan complete or defer optional phases with rationale.
    status: pending
isProject: false
---

# 60 OBSOLETE UI Auth Consolidation (miso-ui + dataplane → miso-client)

## Obsolete and need rework

This plan is marked as obsolete and requires rework for the following reasons:

- It predates final Plan 62 orchestration decisions and therefore does not represent the latest source-of-truth rollout model.
- Several assumptions in this plan were superseded by hard-cut and goal-alignment outcomes already completed in related plans.
- Task statuses and migration phases in this document no longer reflect the current implementation state in `miso-client` and downstream consumers.
- The plan structure mixes legacy migration scaffolding with now-finalized behavior, which creates ambiguity for execution and validation.
- A new reworked plan should be used for active execution so rollout gates, callback contracts, and parity evidence remain consistent with current standards.

## Goal

Move **reusable browser authentication logic** out of:

- [`/workspace/aifabrix-miso/packages/miso-ui/src/auth/`](/workspace/aifabrix-miso/packages/miso-ui/src/auth/)
- [`/workspace/aifabrix-dataplane/app-ui/services/api/`](/workspace/aifabrix-dataplane/app-ui/services/api/) and [`app-ui/contexts/`](/workspace/aifabrix-dataplane/app-ui/contexts/)

into **`@aifabrix/miso-client`**, so both UIs keep only **env wiring**, **React/product UX**, and **app-specific BFF routes** (e.g. dataplane `/api/ide/auth/client-token`).

**Not in scope:** `miso-controller` route implementations (server owns cookies, Keycloak, OpenAPI). Consumers call controller via SDK helpers.

## Related Plans

| Plan | Role |
|------|------|
| [57-enterprise-auth-unification-ts-sdk (done)](/workspace/aifabrix-miso-client/.cursor/plans/done/57-enterprise-auth-unification-ts-sdk_07fa02a3.plan.md) | Token lifecycle, DataClient hooks, user-token-refresh |
| [59-plan192 miso-client (active)](/workspace/aifabrix-miso-client/.cursor/plans/59-plan192_miso-client_b447c41b.plan.md) | Cookie-first refresh, activity listener |
| [384 dataplane enterprise auth](/workspace/aifabrix-dataplane/.cursor/plans/384-enterprise-auth-unification_d5c96fa8.plan.md) | Dataplane reference behavior |
| [192 unified token providers](/workspace/aifabrix-miso/.cursor/plans/192-unified-token-providers.plan.md) | Original cross-product contract baseline |
| [192.1 token cookie hardcut (done)](/workspace/aifabrix-miso/.cursor/plans/done/192.1-token-cookie-hardcut.plan.md) | Hard-cut contract (cookie-centric browser auth boundary) |
| [192.2 goal alignment (done)](/workspace/aifabrix-miso/.cursor/plans/done/192.2_goal_alignment_85d5f32e.plan.md) | Corrective alignment of contract, tests, docs, and closure evidence |
| [419.1 dataplane hardcut (done)](/workspace/aifabrix-dataplane/.cursor/plans/-1.done/419.1_dataplane_hardcut_f9ac0e05.plan.md) | Dataplane-side 192.1 alignment and closure evidence |
| [419.2 dataplane goal alignment (done)](/workspace/aifabrix-dataplane/.cursor/plans/-1.done/419.2_dataplane_goal_alignment_4071b324.plan.md) | Dataplane residual closure for 192.2 invariants |

## Scope

### In scope

- New SDK modules under `src/utils/` and `src/types/` (≤500 lines/file, ≤50 lines/function per project rules).
- Public exports via [`src/sdk-exports.ts`](/workspace/aifabrix-miso-client/src/sdk-exports.ts).
- Unit tests in `tests/unit/`.
- Docs + CHANGELOG migration notes for app teams.
- **Consumer adoption** tracks for `miso-ui`, `dataplane app-ui`, and `miso-client-python` (execution is handoff-only in consumer repos via their own plans).
- Publish `@aifabrix/miso-client` after each deliverable phase.

### Out of scope

- **miso-controller** Express route/handler changes (unless a bug fix is required for contract tests).
- **React** `AuthContext`, bootstrap phases, RBAC UI, routing (`LoginPage` structure stays in apps).
- **miso-client-python** implementation (document parity only where paths/fields align).
- Direct implementation in consumer repositories (`aifabrix-miso`, `aifabrix-dataplane`, `aifabrix-miso-client-python`) from this plan execution; those repos execute via their own local plans.
- Dataplane-only backend routes (`/api/ide/*`) — apps keep BFF; SDK documents how to pass `clientTokenUri`.
- Infra, Docker, deployment.

## Current State (re-baselined 2026-06-16)

### Cross-plan delta from 192.1 / 192.2 / 419.1 / 419.2

- Browser auth contract has moved beyond early 4.16.0 assumptions; hard-cut + goal-alignment plans establish strict cookie/session boundaries and remove contradictory token-persistence assumptions.
- `aifabrix-miso` goal-alignment execution references `@aifabrix/miso-client@^4.17.3` for consumer alignment.
- `aifabrix-dataplane` goal-alignment execution is marked complete and documents residual host-topology behavior explicitly (`dataplane` host vs `miso` host auth routes) instead of masking it in UI logic.
- This plan remains valid for SDK-auth-consolidation intent, but consumer-adoption checkpoints must be treated as **re-validation checkpoints** against the already-completed 192.2/419.2 outcomes.

### Verified contract reality (codebase)

- Controller browser session cookie is `miso_access_token` (HttpOnly, `Path=/`); refresh token is server-side only in browser-session store mapping.
- Browser endpoints `GET /api/v1/auth/session` and `POST /api/v1/auth/refresh` are cookie-session driven and must not expose browser-readable refresh token material; session payloads can be valid without `data.accessToken`.
- Current SDK `src/utils/browser-session.ts` still hard-requires `payload.accessToken` and classifies missing token as invalid response, which is now a contract mismatch against hard-cut behavior.
- Current SDK unit tests in `tests/unit/browser-session.test.ts` still enforce token-in-payload behavior and must be updated to hard-cut semantics.
- Consumers currently keep local compensating logic because of this mismatch:
  - `miso-ui` local shim `packages/miso-ui/src/auth/services/miso-client-browser-sdk.ts`
  - dataplane fallback snapshot handling in `app-ui/services/api/auth-browser-session.ts`
- SDK already contains reusable activity-driven refresh primitives (`src/utils/data-client-activity-refresh.ts`) used by browser DataClient runtime; this plan must ensure consistent consumer adoption, including `miso-ui`.

### Already in SDK (Phase 0 — shipped 4.15.5)

| Export | Source |
|--------|--------|
| `createBrowserSessionClient` | [`src/utils/browser-session.ts`](/workspace/aifabrix-miso-client/src/utils/browser-session.ts) |
| `createCookieSessionCallbacks` | same |
| `ensureBrowserAccessToken` | same |
| `AUTH_BROWSER_SESSION_PATHS` | [`src/types/browser-session.types.ts`](/workspace/aifabrix-miso-client/src/types/browser-session.types.ts) |
| `SessionRestoreResult` / failure reasons | types module |

**miso-ui:** thin [`browser-session.ts`](/workspace/aifabrix-miso/packages/miso-ui/src/auth/services/browser-session.ts) + [`data-client.factory.ts`](/workspace/aifabrix-miso/packages/miso-ui/src/auth/services/data-client.factory.ts) uses `cookieSessionCallbacks`.

**dataplane:** baseline notes above are superseded by 419.1/419.2 closure evidence; use this plan to verify remaining duplication against current dataplane implementation rather than relying on early 2026-06-03 assumptions.

### Still duplicated in UIs (target for this plan)

| Concern | miso-ui | dataplane app-ui | SDK target |
|---------|---------|------------------|------------|
| Split-port API base (Vite proxy) | [`controller-api-base-url.ts`](/workspace/aifabrix-miso/packages/miso-ui/src/auth/config/controller-api-base-url.ts) | partial via [`misoConfig.ts`](/workspace/aifabrix-dataplane/app-ui/services/api/dataplane/misoConfig.ts) + same-origin checks | `resolveBrowserApiBaseUrl` |
| localhost ↔ 127.0.0.1 alignment | implicit via page origin in places | [`browserControllerUrl.ts`](/workspace/aifabrix-dataplane/app-ui/services/api/dataplane/browserControllerUrl.ts) | `alignLoopbackHostnameWithPage` |
| Silent recovery (refresh→restore→clear→retry) | DataClient callbacks + auth flow | [`dataplaneClient.ts`](/workspace/aifabrix-dataplane/app-ui/services/api/dataplaneClient.ts) `runSilentAuthRecovery` | `recoverBrowserSessionWithStaleCleanup` |
| 401 / inactive token detection | inline in auth-flow | [`auth.ts`](/workspace/aifabrix-dataplane/app-ui/services/api/auth.ts) `isUnauthorizedError`, `isInactiveTokenErrorMessage` | `isUnauthorizedApiError`, `isInactiveTokenMessage` |
| Auth path constants | string literals in factory / auth-flow | [`constants/auth.ts`](/workspace/aifabrix-dataplane/app-ui/constants/auth.ts) | `AUTH_CONTROLLER_PATHS` |
| OAuth login/callback HTTP | [`auth-client.auth-flow.ts`](/workspace/aifabrix-miso/packages/miso-ui/src/auth/services/auth-client.auth-flow.ts) | OAuth via DataClient redirect (different path) | optional `createOAuthBrowserFlow` |
| Client token in URL | [`miso-client-browser-sdk.ts`](/workspace/aifabrix-miso/packages/miso-ui/src/auth/services/miso-client-browser-sdk.ts) local wrappers | — | URL utils in SDK |
| DataClient cookie-first factory | [`data-client.factory.ts`](/workspace/aifabrix-miso/packages/miso-ui/src/auth/services/data-client.factory.ts) | manual `DataClient` config in [`dataplaneClient.ts`](/workspace/aifabrix-dataplane/app-ui/services/api/dataplaneClient.ts) | optional `createBrowserAuthDataClient` |
| Bootstrap / activity refresh | React contexts | [`authBootstrapLifecycle.ts`](/workspace/aifabrix-dataplane/app-ui/contexts/authBootstrapLifecycle.ts), [`authUserSessionRefresh.ts`](/workspace/aifabrix-dataplane/app-ui/contexts/authUserSessionRefresh.ts) | **stay in apps** (use SDK session client inside) |

## Implementation Phases

### Phase 0 — Browser session module (DONE)

- [x] `browser-session.ts` + types + tests (`tests/unit/browser-session.test.ts`).
- [x] miso-ui wrapper + dataplane `auth.ts` slim-down.
- [x] Version `4.15.5` + CHANGELOG entry.

### Phase 1 — Constants + error helpers (DONE — SDK 4.16.0)

- [x] `auth-browser.types.ts` — `AUTH_CONTROLLER_PATHS` + session paths.
- [x] `auth-browser-errors.ts` — `isUnauthorizedApiError`, `isInactiveTokenMessage`.
- [x] Unit tests + `sdk-exports.ts` exports.
- [ ] Consumer migration of `AUTH_CONTROLLER_ENDPOINTS` (dataplane) — pending.

### Phase 2 — Browser URL resolution (DONE — SDK 4.16.0)

- [x] `browser-api-base-url.ts` + `loopback-host-alignment.ts` + unit tests.
- [ ] miso-ui / dataplane adopt SDK helpers (local modules remain).

### Phase 3 — Silent recovery orchestrator (DONE — SDK 4.16.0)

- [x] `browser-session-recovery.ts` + unit tests.
- [ ] dataplane `runSilentAuthRecovery` still inline (not SDK wrapper).

### Phase 3b — Hard-cut browser-session realignment (NEW)

- [ ] Update SDK browser-session success criteria to accept cookie-session authenticated responses without `data.accessToken`.
- [ ] Keep response parsing strict for forbidden legacy aliases (`token`, `authToken`, `refreshToken`) while not requiring bearer token material in browser payload.
- [ ] Preserve DataClient/browser callback contracts without reintroducing localStorage token persistence.
- [ ] Replace consumer workaround code paths where SDK behavior becomes sufficient (miso-ui/dataplane).

### Phase 3c — Activity-driven refresh reuse (NEW)

- [ ] Ensure SDK activity-driven refresh remains reusable and configurable for browser consumers (event-based trigger with throttle, default 60s).
- [ ] Add/refresh SDK tests proving activity-triggered refresh does not execute more than once within the configured interval.
- [ ] Document the browser integration pattern so consumers can enable identical behavior without local implementation forks.
- [ ] Adopt this SDK mechanism in `miso-ui` to match dataplane behavior.

### Phase 4 — Client token URL utilities (DONE — SDK 4.16.0)

- [x] `client-token-url.ts` + unit tests.
- [ ] miso-ui still uses local wrapper module `miso-client-browser-sdk.ts` for URL helpers and browser-session compatibility.

### Phase 5 — OAuth browser flow (DEFERRED)

- [ ] Optional — cancelled for this release; miso-ui keeps `auth-client.auth-flow.ts`.

### Phase 6 — createBrowserAuthDataClient (DEFERRED)

- [ ] Optional — cancelled for this release; apps keep factory/config wiring.

## Implementation reference (design notes)

### Phase 1 — Constants + error helpers

1. **`src/types/auth-browser.types.ts`** (or extend `browser-session.types.ts`):
   - `AUTH_CONTROLLER_PATHS` = session, refresh, login, callback, logout, clientToken (defaults under `/api/v1/auth/*`).
2. **`src/utils/auth-browser-errors.ts`**:
   - `isUnauthorizedApiError(error: unknown): boolean`
   - `isInactiveTokenMessage(message?: string | null): boolean`
3. Export from `sdk-exports.ts`.
4. **Consumers:** replace dataplane `AUTH_CONTROLLER_ENDPOINTS` + auth error helpers; replace miso-ui inline 401 checks where applicable.

### Phase 2 — Browser URL resolution (high value for dev06 split-port)

1. **`src/utils/browser-api-base-url.ts`**
   - `resolveBrowserApiBaseUrl(options: { configuredUrl?, pageOrigin?, explicitMisoApiBaseUrl?, basePath? })`
   - Behavior (from miso-ui): if configured API host ≠ page host → return page origin (proxy). Else configured → page fallback chain.
2. **`src/utils/loopback-host-alignment.ts`**
   - `alignLoopbackHostnameWithPage(url: string): string` — port dataplane `alignControllerUrlWithBrowserHost`.
3. Unit tests: mirror [`controller-api-base-url.test.ts`](/workspace/aifabrix-miso/packages/miso-ui/src/auth/config/__tests__/controller-api-base-url.test.ts) cases.
4. **Consumers:**
   - miso-ui: `controller-api-base-url.ts` → re-export/wrap SDK (keep `getOriginWithBasePath` local if app-specific).
   - dataplane: `browserControllerUrl.ts` + `misoConfig.ts` call SDK helpers.

### Phase 3 — Silent recovery orchestrator

1. **`recoverBrowserSessionWithStaleCleanup`** in `browser-session.ts` or `browser-session-recovery.ts`:
   - Input: `BrowserSessionClient`, `clearStaleState?: () => void`, optional retry policy.
   - Policy (dataplane today): `refresh()` → `restore()` → on `invalid`/`unauthorized` call `clearStaleState` → `refresh()` → `restore()`.
   - Output: `SessionRestoreResult` or `UserSessionTokenResult`.
2. **dataplane:** `runSilentAuthRecovery` becomes thin wrapper storing tokens via app `storeAccessToken`.
3. **Optional:** default `onTokenRefresh` builder for DataClient config.

### Phase 4 — Client token URL utilities

1. Move from miso-ui: `extractClientTokenFromUrl`, `removeClientTokenFromUrl` → `src/utils/client-token-url.ts`.
2. miso-ui re-exports or imports from `@aifabrix/miso-client`.

### Phase 5 — OAuth browser flow (optional / larger)

Only if miso-ui duplication remains painful after Phases 1–3.

1. **`createOAuthBrowserFlow({ getBaseUrl, getClientToken, fetchImpl? })`**
   - `getLoginUrl(redirect, state)` → `GET /api/v1/auth/login` with `credentials: 'include'`, `x-client-token`.
   - `handleCallback(query)` → `GET /api/v1/auth/callback` + post-success `ensureBrowserAccessToken` hook.
2. miso-ui `auth-client.auth-flow.ts` delegates to SDK; keeps state token storage in app (`token.utils.ts`).

### Phase 6 — `createBrowserAuthDataClient` (optional)

Factory wrapping common config:

```typescript
createBrowserAuthDataClient({
  getBaseUrl,
  misoConfig,
  tokenKeys: ['miso_token'],
  onAccessToken: (result) => void,
  clientTokenUri,
  auditSkipEndpoints?: string[],
  timeout?,
});
```

- Sets `preferCookieSessionRestore: true`, `createCookieSessionCallbacks`, default audit skips for auth routes.
- miso-ui `createAuthDataClient` shrinks to env + `fetchServerClientConfig`.

### Phase 7 — Consumer adoption & publish

| Repo | Actions |
|------|---------|
| **miso-client** | Phases 1–6, tests, docs, npm publish |
| **miso-ui** | Handoff-only from this plan: execute in a dedicated `aifabrix-miso` plan created by miso agent |
| **dataplane** | Handoff-only from this plan: execute in a dedicated `aifabrix-dataplane` plan created by dataplane agent |
| **miso-client-python** | Handoff-only from this plan: execute in a dedicated `aifabrix-miso-client-python` plan created by python SDK agent |

Handoff: [`.temp/ui-auth-consolidation-handoff.md`](/workspace/aifabrix-miso-client/.temp/ui-auth-consolidation-handoff.md) (create during Phase 7).

## Consumer Project Instructions (informational only)

This section is **instructional only** for agents of consumer repositories.
Execution must happen in consumer repos under their own local plans, not in this `miso-client` plan.

### Instructions for `aifabrix-miso` agent (miso-ui consumer)

- Create a dedicated plan in `/workspace/aifabrix-miso/.cursor/plans/` for SDK hard-cut adoption (do not execute directly from this plan).
- Upgrade to hard-cut compatible `@aifabrix/miso-client` line (`>=4.17.3` lineage).
- Remove local shim module `packages/miso-ui/src/auth/services/miso-client-browser-sdk.ts` after replacing imports with SDK exports.
- Remove duplicated local exports/constants/helpers that overlap SDK browser auth surface (`createBrowserSessionClient`, `createCookieSessionCallbacks`, URL token helpers, auth path constants).
- Ensure no auth flow path depends on browser-readable refresh token or mandatory `data.accessToken` from session/refresh payload.
- Wire SDK activity-driven refresh (mousemove/click/keydown) with 60-second throttle semantics.
- Run consumer validation (`packages/miso-ui` TypeScript + auth tests) and attach pass evidence in the miso plan.

### Instructions for `aifabrix-dataplane` agent (dataplane consumer)

- Create a dedicated plan in `/workspace/aifabrix-dataplane/.cursor/plans/` for SDK hard-cut adoption (do not execute directly from this plan).
- Remove fallback snapshot shim path in `app-ui/services/api/auth-browser-session.ts` once SDK browser-session semantics are aligned.
- Keep only app-specific wiring in dataplane auth modules; route common browser-session/recovery logic through SDK exports.
- Ensure no local shim remains for SDK cache/token cleanup behavior once canonical SDK behavior is available.
- Keep activity-driven refresh behavior aligned with SDK 60-second throttle semantics.
- Run consumer validation (`app-ui` targeted auth tests + required frontend gates) and attach pass evidence in the dataplane plan.

### Instructions for `aifabrix-miso-client-python` agent (python SDK companion)

Create a dedicated plan in `/workspace/aifabrix-miso-client-python/.cursor/plans/` for Python SDK alignment.
This section is instructional only and must be executed by the python SDK agent in its repository.

First verify these potential mismatches (do not assume; confirm from code/tests/OpenAPI in python repo):

- Verify whether `AuthApi.refresh_session_token()` response model still expects token payload fields (`data.accessToken`, `data.refreshToken`) instead of cookie-session metadata.
- Verify whether `RefreshTokenResponse` in `miso_client/api/types/auth_types.py` is incorrectly coupled to device-refresh payload shape.
- Verify whether tests for session refresh still assert token payload fields instead of cookie-session contract fields.
- Verify whether README/changelog text for Python session refresh matches current hard-cut controller contract.

If verification confirms mismatch, apply in python repo plan:

- Separate browser session refresh response model from device refresh response model (keep explicit API boundary).
- Keep `refresh_device_code_token(refresh_token)` contract unchanged for `/api/v1/auth/login/device/refresh`.
- Update `refresh_session_token()` typing/parsing/tests to align with cookie-session endpoint semantics.
- Update migration/docs/changelog in python repo to reflect canonical browser-session contract and no browser-readable refresh-token assumptions.
- Run python repo validation gates and attach evidence in the python plan.

### Shim audit rule for both consumer agents

- Search for local modules/functions re-implementing SDK browser auth helpers and remove or reduce to thin app wiring only.
- Treat any remaining auth shim as an explicit DoD gap unless documented as temporary with owner + removal plan.

## Keep in Applications (explicit non-moves)

| Area | Reason |
|------|--------|
| `AuthContext`, `authBootstrapLifecycle`, `authUserSessionRefresh` | React state machine + product copy |
| `LoginPage` / route components | Product routing |
| Dev auth bypass (`AUTH_DISABLED`, dev tokens) | Per-app config |
| RBAC roles/permissions fetch after login | Controller APIs + UI-specific |
| dataplane `fetchClientToken` / IDE client-token BFF | Not controller-public contract |
| miso-ui `fetchServerClientConfig` POST to `/api/ide/auth/client-token` | App server endpoint |

## miso-controller Note

Controller already implements `GET /api/v1/auth/session` and `POST /api/v1/auth/refresh` (see `packages/miso-controller/tests/integration/routes/auth-core.routes.test.ts`). This plan **does not** change handlers; SDK and UIs align to existing OpenAPI contract.

Post-192.2 note: treat cookie/session hard-cut semantics and no-browser-token-persistence behavior as the current normative baseline when evaluating consumer adoption in this plan.

Hard-cut clarification for this plan:

- Browser auth continuity token is represented by HttpOnly cookie `miso_access_token` (server-managed).
- Refresh token is server-only and must never be exposed to browser JS (payload, storage, readable cookie).
- SDK browser helpers must not require `data.accessToken` from `/auth/session` or `/auth/refresh` to classify cookie-session success.

## Rules and Standards

Applicable sections from [`.cursor/rules/project-rules.mdc`](/workspace/aifabrix-miso-client/.cursor/rules/project-rules.mdc):

- [Token Management](.cursor/rules/project-rules.mdc#token-management) — cookie-first browser `/auth/session` + `/auth/refresh`; no browser `refreshToken` JSON on `/auth/refresh`; strict separation from M2M `x-client-token` and device refresh.
- [HTTP Client Pattern](.cursor/rules/project-rules.mdc#http-client-pattern) — applies when wiring DataClient/browser fetch helpers against controller APIs.
- [API Layer Pattern](.cursor/rules/project-rules.mdc#api-layer-pattern) + [Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions) — public SDK exports and wire-facing fields remain camelCase.
- [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) — unit tests for success, 401, network/timeout, retry, dedupe, and consumer smoke paths listed below.
- [Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines) — never log tokens; `credentials: 'include'` only where cookies are required; no `clientSecret` in browser bundles.
- [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) — ≤500 lines/file, ≤50 lines/function; split modules (see `browser-session.ts` refactor).
- [When Adding New Features](.cursor/rules/project-rules.mdc#when-adding-new-features) — tests + docs/changelog for every public API/behavior change.

Key requirements enforced by this plan:

- Keep controller auth calls on `x-client-token` policy for M2M paths; browser user session continuity is cookie-session based with HttpOnly `miso_access_token`.
- Do not require browser-readable `accessToken` or `refreshToken` in `/auth/session` and `/auth/refresh` response payloads.
- Preserve device refresh contract (`/api/v1/auth/login/device/refresh` with body `refreshToken`) — no browser coupling.
- Export only typed, camelCase public surfaces from `sdk-exports.ts`.
- Complete silent-first validation gates before closure; zero ESLint warnings/errors on touched `src/**/*.ts`.

## Before Development

- [ ] Diff miso-ui `src/auth/**` vs dataplane `app-ui/services/api/auth.ts` + `contexts/auth*.ts` and attach file list to `.temp/ui-auth-baseline.md`.
- [ ] Confirm published npm version strategy (patch vs minor per phase).
- [ ] Confirm miso monorepo `pnpm-workspace.yaml` includes `../aifabrix-miso-client` for local `workspace:*` dev.
- [ ] Re-read plan 192 / 57 browser-device boundary before OAuth phase.
- [ ] Confirm handoff-only boundaries for consumer repos and prepare instruction sections before requesting consumer-agent execution.

## Expected Automated Tests

### miso-client (new/updated)

| Module | Tests |
|--------|-------|
| `browser-api-base-url` | split-port, same host, missing env, invalid URL |
| `loopback-host-alignment` | localhost↔127.0.0.1, non-loopback unchanged |
| `auth-browser-errors` | 401 shapes, inactive token message, nested `response.status` |
| `browser-session-recovery` | refresh-first, stale clear, dedupe with client |
| `data-client-activity-refresh` | activity events trigger refresh with throttle (default 60s), no more than one refresh inside throttle window |
| `client-token-url` | query + hash extract/remove |
| `browser-session` (existing) | hard-cut semantics: cookie-session success without `data.accessToken`; no refresh-token payload assumptions |

### Consumer smoke (after bump)

- miso-ui: `packages/miso-ui` — `tsc --noEmit`, auth config tests if present.
- dataplane: `app-ui` — `vitest` `auth.test.ts`, `dataplaneClient.auth.test.ts`, `authUserSessionRefresh.test.ts`, `AuthContext.test.tsx`.

## Manual Verification

- [ ] **dev06 split-port:** UI `3610`, controller `3600` — login via UI origin; HttpOnly cookie `miso_access_token` is present with expected attributes and session/refresh requests go via proxy with `credentials: include`.
- [ ] Full page reload after OAuth — cookie-session continuity is restored without requiring browser-readable `accessToken` JSON payload.
- [ ] Expired access token — activity or 401 triggers POST refresh, not only GET session.
- [ ] Activity-driven refresh: repeated user activity (mousemove/click/keydown) does not trigger refresh more often than once per 60 seconds.
- [ ] Dataplane dataplane UI — same cookie session behavior after `preferCookieSessionRestore` wiring.
- [ ] Verify `GET /api/v1/auth/session` and `POST /api/v1/auth/refresh` responses do not contain browser-readable `refreshToken`; browser auth state remains valid via cookie-session contract.
- [ ] Device refresh (`/api/v1/auth/login/device/refresh`) unchanged (non-browser).

## Documentation Updates

- [`CHANGELOG.md`](/workspace/aifabrix-miso-client/CHANGELOG.md) — per phase.
- [`docs/authentication.md`](/workspace/aifabrix-miso-client/docs/authentication.md) — browser URL resolution, recovery orchestration, OAuth optional API.
- [`docs/dataclient.md`](/workspace/aifabrix-miso-client/docs/dataclient.md) — `createBrowserAuthDataClient`, cookie callbacks, migration from inline `fetch`.
- README — short “Browser apps (miso-ui, dataplane)” integration section.

## Definition of Done

- All phases in **Implementation Phases** marked complete or explicitly deferred with rationale in this file (Phases 5–6 optional).
- No duplicated session HTTP (`performBrowserSessionRequest`-style) in either UI.
- miso-ui and dataplane use SDK for URL resolution + session recovery policy (or documented exception in handoff doc).
- All items in **Expected Automated Tests** implemented and passing before final validation gates.
- **Validation gates** (miso-client root, required order — do not reorder):
  1. `pnpm run tests:typecheck:silent` (fallback `pnpm run tests:typecheck` only if silent runner/log is not usable)
  2. `pnpm run build:silent` (fallback `pnpm run build` only if silent runner/log is not usable)
  3. `pnpm run fmt:silent` (fallback `pnpm run fmt` only if silent runner/log is not usable)
  4. `pnpm run md:lint:silent`; if needed `pnpm run md:fix:silent` (fallback non-silent variants only if silent runner/log is not usable)
  5. `pnpm run lint:silent` (fallback `pnpm run lint` only if silent runner/log is not usable)
  6. `pnpm run test:silent` (fallback `pnpm run test` only if silent runner/log is not usable)
- On any `*:silent` failure, inspect `.temp/validation/*` logs first; run non-silent fallback only when silent output is not actionable.
- Zero ESLint warnings/errors confirmed on touched SDK sources.
- All automated tests pass; manual verification checklist completed for split-port dev (UI proxy + cookie session).
- All new public API outputs remain camelCase.
- Security requirements from project rules met (no token logging, no browser refreshToken JSON on `/auth/refresh`).
- SDK/browser helpers are aligned to hard-cut response reality (cookie-session success without requiring `data.accessToken` from browser endpoints).
- SDK activity-driven refresh is reusable and adopted in both consumers with equivalent 60-second throttle behavior.
- Docs/changelog updated for every public API/contract/behavior change (`CHANGELOG.md`, `docs/authentication.md`, `docs/dataclient.md`, README integration note).
- Consumer repos green on auth-related tests after version bump.
- `.temp/ui-auth-consolidation-handoff.md` lists completed file migrations.
- npm package published and version referenced by consumers.

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

# targeted (expand per phase)
pnpm run test -- tests/unit/browser-session.test.ts
# pnpm run test -- tests/unit/browser-api-base-url.test.ts
# pnpm run test -- tests/unit/loopback-host-alignment.test.ts
# pnpm run test -- tests/unit/auth-browser-errors.test.ts
# pnpm run test -- tests/unit/browser-session-recovery.test.ts
# pnpm run test -- tests/unit/client-token-url.test.ts
```

Silent failure handling:

- On `*:silent` failure, inspect `.temp/validation/*` logs first.
- Use non-silent fallback only when silent output/logs are not actionable.

Consumer checks (after SDK publish or `workspace:*`):

```bash
# miso-ui
cd /workspace/aifabrix-miso/packages/miso-ui && pnpm exec tsc --noEmit

# dataplane app-ui
cd /workspace/aifabrix-dataplane/app-ui && npm test -- tests/services/api/auth.test.ts tests/services/api/dataplaneClient.auth.test.ts tests/contexts/authUserSessionRefresh.test.ts
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking apps that relied on private copy-paste behavior | Semver minor + migration section; keep old exports one release as aliases |
| `import.meta.env` only in Vite apps | `resolveBrowserApiBaseUrl` takes explicit options; apps pass env strings |
| OAuth flow too opinionated for dataplane | Phase 5 optional; dataplane keeps DataClient redirect path |
| ESLint max-lines on new modules | Split files early (see browser-session refactor pattern) |
| npm not published before consumer bump | Use pnpm `workspace:*` in miso monorepo; file install for dataplane CI |

## Plan Validation Report

**Date**: 2026-06-16 15:00 UTC  
**Plan**: `/workspace/aifabrix-miso-client/.cursor/plans/60-ui-auth-consolidation-from-apps.plan.md`  
**Status**: ✅ VALIDATED

### Plan Purpose

- Consolidate reusable browser-auth behavior into `@aifabrix/miso-client` while preserving hard-cut cookie-session semantics from 192.2.
- Provide consumer-repo handoff instructions (`miso-ui`, `dataplane`, `miso-client-python`) without executing those repo changes directly in this plan.

### Applicable Rules

- ✅ [Token Management](.cursor/rules/project-rules.mdc#token-management) - browser/session and M2M boundary rules directly drive hard-cut alignment work.
- ✅ [HTTP Client Pattern](.cursor/rules/project-rules.mdc#http-client-pattern) - required for DataClient/browser session helper extraction.
- ✅ [API Layer Pattern](.cursor/rules/project-rules.mdc#api-layer-pattern) + [Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions) - required for stable, camelCase SDK exports.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) - required for unit coverage and consumer smoke expectations.
- ✅ [Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines) - required for no-token-leakage and browser-safe auth handling.
- ✅ [When Adding New Features](.cursor/rules/project-rules.mdc#when-adding-new-features) - requires docs/changelog updates for contract-facing changes.

### DoD Gate Readiness

- ✅ Ordered silent-first command gates are explicit and in required order.
- ✅ Silent-failure handling (`.temp/validation/*` log-first) is explicit.
- ✅ Zero-warning lint requirement is explicit.
- ✅ Tests and documentation update requirements are explicit.

### Todo Synchronization

- ✅ Frontmatter `todos` are valid (`id`, `content`, `status`) with unique ids.
- ✅ Todos cover prerequisites, implementation phases, tests, docs, validation, handoff artifacts, and closure.
- ✅ Added missing hard-cut follow-up todos (browser-session realignment, shim audit, activity-refresh reuse, consumer migration instruction temp doc).

### Updates Applied

- Marked consumer-repo execution as handoff-only in `Scope` and `Before Development` to avoid ownership ambiguity.
- Added/maintained explicit informational instruction sections for `miso-ui`, `dataplane`, and `miso-client-python` agents.
- Hardened plan against stale interpretation by keeping 2026-06-03 blocks under historical non-normative headers.

### Risks / Follow-ups

- SDK hard-cut realignment (Phase 3b) is still pending and blocks full shim removal in consumers.
- Consumer-repo instruction sections must be converted into local plans by each repo agent before execution.
- Historical 2026-06-03 snapshots are traceability only; final closure must rely on current re-baselined checks.

## Historical Validation Snapshots (archival, non-normative)

The sections below capture execution state from `2026-06-03` and are kept for traceability only.
They are **not** the current source of truth for active execution decisions in this plan.

## Historical Plan Validation Report (2026-06-03)

**Date**: 2026-06-03  
**Plan**: `/workspace/aifabrix-miso-client/.cursor/plans/60-ui-auth-consolidation-from-apps.plan.md`  
**Status**: ✅ VALIDATED

### Plan Purpose

- Extract reusable browser auth from miso-ui and dataplane app-ui into `@aifabrix/miso-client`, then thin consumers to SDK helpers (building on Phase 0 `browser-session` 4.15.5+).
- Coordinate consumer adoption and npm publish without changing miso-controller route implementations.

### Applicable Rules

- ✅ [Token Management](.cursor/rules/project-rules.mdc#token-management) — cookie-first session/refresh and M2M boundary.
- ✅ [HTTP Client Pattern](.cursor/rules/project-rules.mdc#http-client-pattern) — DataClient and controller fetch integration.
- ✅ [API Layer Pattern](.cursor/rules/project-rules.mdc#api-layer-pattern) + [Naming Conventions](.cursor/rules/project-rules.mdc#naming-conventions) — typed camelCase public exports.
- ✅ [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) — unit + consumer smoke tests enumerated.
- ✅ [Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines) — token-safe browser flows.
- ✅ [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) — file/function size limits explicit in scope.
- ✅ [When Adding New Features](.cursor/rules/project-rules.mdc#when-adding-new-features) — docs/changelog requirements in DoD.

### DoD Gate Readiness

- ✅ Ordered silent-first commands explicit and match project gate sequence.
- ✅ Silent failure handling (`.temp/validation/*`, fallback rules) documented.
- ✅ Zero-warning lint requirement explicit.
- ✅ Expected Automated Tests section present with module-level bullets.
- ✅ Documentation updates section lists all required files.
- ✅ camelCase, security, and test-pass criteria stated in DoD.

### Todo Synchronization

- ✅ Frontmatter `todos` valid (`id`, `content`, `status`; unique ids).
- ✅ Covers scope/baseline, Phase 0 (completed), SDK phases 1–4 + optional 5–6, both consumers, python parity notes, tests, docs, validation gates, handoff, publish, final closure.
- ✅ Added mandatory `implement-expected-automated-tests` todo per code-plan policy.
- ✅ Each implementation phase maps to at least one todo (`sdk-*` or `consumer-*`).

### Updates Applied (validate-plan 2026-06-03)

- Expanded **Rules and Standards** with linked project-rule sections and key requirement bullets.
- Hardened **Definition of Done** with full gate order, silent-failure rules, lint/test/security/docs criteria.
- Expanded **Validation** block with `md:fix:silent` optional step and targeted test paths per phase.
- Added frontmatter todos: `implement-expected-automated-tests`, `final-dod-closure`.
- Replaced validation report with full checklist status.

### Risks / Follow-ups

- Phases 5–6 remain optional; mark todos `cancelled` with rationale if deferred at implementation time.
- Consumer adoption depends on npm publish or pnpm `workspace:*` — track in handoff doc.
- Re-run gate commands after each phase and append **Validation Execution Result** subsection under **Validation** when closing the plan.
- Keep cross-SDK parity notes aligned if `miso-client-python` gains browser helpers later.

## Historical Validation Report (2026-06-03)

**Date**: 2026-06-03  
**Status**: ⚠️ INCOMPLETE

### Executive Summary

SDK work for **Phases 0–4** is implemented in `@aifabrix/miso-client@4.16.0` with unit tests and docs updates. All **miso-client** silent quality gates pass after fixing test typecheck in `browser-session-recovery.test.ts`. **Phases 5–6** are deferred (cancelled todos). **Phase 7** consumer adoption, npm publish, handoff doc, manual split-port verification, and consumer smoke tests remain open.

### Task Completion

- Total: 18
- Completed: 9
- In progress: 4
- Pending: 3
- Cancelled: 2

### Task State Synchronization

- ✅ Markdown checkboxes synchronized (Phases 0–6 status + consumer gaps)
- ✅ Frontmatter `todos` synchronized
- ✅ No contradictions between phase headers and todo statuses

### File and Implementation Validation

- ✅ `src/types/auth-browser.types.ts` — `AUTH_CONTROLLER_PATHS`, `AUTH_BROWSER_SESSION_PATHS`
- ✅ `src/utils/auth-browser-errors.ts`, `browser-api-base-url.ts`, `loopback-host-alignment.ts`, `browser-session-recovery.ts`, `client-token-url.ts`, `browser-session.ts`
- ✅ Exports in `src/sdk-exports.ts` (camelCase public API)
- ✅ `CHANGELOG.md` — `[4.16.0]` entry
- ✅ `docs/authentication.md`, `docs/dataclient.md`, `docs/troubleshooting.md`, `docs/README.md` — browser UI sections
- ❌ `README.md` — no dedicated “Browser apps” integration blurb (DoD gap)
- ❌ `.temp/ui-auth-consolidation-handoff.md` — not created
- ❌ `.temp/ui-auth-baseline.md` — not created (Before Development checklist)

### Automated Tests Validation

- ✅ Unit tests present: `browser-api-base-url`, `loopback-host-alignment`, `auth-browser-errors`, `auth-browser.types`, `browser-session-recovery`, `client-token-url`, `browser-session` (regression)
- ✅ Expected automated tests (miso-client) — all listed modules covered; full suite green
- ❌ Consumer smoke — miso-ui `tsc --noEmit` and dataplane auth vitest slices **not run** in this validation

### Quality Gates

- ✅ `tests:typecheck` (after fixing `SessionRestoreSuccess` / `SessionRestoreFailureReason` in recovery tests)
- ✅ `build`
- ✅ `fmt`
- ✅ `md:lint`
- ✅ `lint` (0 warnings/errors)
- ✅ `test`

Logs: `.temp/validation/*`

### Rules Compliance

- ✅ SDK token/header policy — cookie-first session/refresh; M2M `x-client-token` unchanged
- ✅ camelCase public exports
- ✅ File/function size limits on new modules
- ✅ No token logging in new helpers
- ✅ RFC 7807 / Redis — N/A for new browser-only utils

### Consumer adoption snapshot

| App | Status |
|-----|--------|
| **miso-ui** | Partial — `createCookieSessionCallbacks`, `preferCookieSessionRestore`; still local `controller-api-base-url.ts`, `client-token.utils.ts` |
| **dataplane app-ui** | Partial — `createBrowserSessionClient`, `isUnauthorizedApiError`; no `preferCookieSessionRestore`; inline `runSilentAuthRecovery` |

### Issues and Recommendations

1. **Publish** `@aifabrix/miso-client@4.16.0` to npm and bump consumers.
2. **Complete Phase 7** — thin miso-ui/dataplane wrappers; run consumer smoke commands from plan **Validation** section.
3. **Manual verification** — dev06 split-port checklist (not executed).
4. **Optional phases** — Phases 5–6 cancelled; revisit if OAuth/factory duplication becomes painful.
5. **Docs** — Add README browser-apps note; add python parity subsection in `docs/authentication.md`.
6. **Handoff** — Create `.temp/ui-auth-consolidation-handoff.md` before closing.

### Final Checklist

- [ ] All tasks implemented and synchronized
- [x] SDK files and miso-client tests validated
- [x] miso-client quality gates passed in strict order
- [x] Rules compliance verified for SDK surface
- [ ] Consumer repos green; manual verification; publish; plan complete

### Validation Execution Result (2026-06-03)

```
pnpm run tests:typecheck:silent  → PASS (after test fix)
pnpm run build:silent            → PASS
pnpm run fmt:silent              → PASS
pnpm run md:lint:silent          → PASS
pnpm run lint:silent             → PASS
pnpm run test:silent             → PASS
```

### Re-baseline Note (2026-06-16)

- The validation snapshot above is historical (`2026-06-03`) and reflects the state before cross-repo completion of plans 192.1/192.2/419.1/419.2.
- Before final closure of this plan, re-run consumer verification against the post-hardcut baseline (including currently pinned SDK versions and documented host-topology behavior).
- Re-baseline includes a new required SDK rework track (`Phase 3b`) to remove outdated browser-session token-payload assumptions and eliminate downstream consumer workaround shims.
