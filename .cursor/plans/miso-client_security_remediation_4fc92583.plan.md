---
name: miso-client security remediation
overview: Implement remediation changes in aifabrix-miso-client for Dependabot, Security Quality, and Code Scanning baselines, with phased execution and explicit approval gate for secret-related fixes.
planType: code
status: draft
todos:
  - id: scope-and-prerequisites
    content: Confirm fixed baseline, execution scope boundaries, and prerequisite remediation approach before editing code.
    status: pending
  - id: dependabot-remediation-phase
    content: Implement fixes for all baseline Dependabot advisory groups first, with lockfile alignment and compatibility updates.
    status: pending
  - id: code-scanning-remediation-phase
    content: Implement fixes for all baseline Code Scanning rule families with runtime-risk priority.
    status: pending
  - id: quality-remediation-phase
    content: Implement fixes for all baseline Security Quality rule families, keeping cleanup behavior-neutral unless a real defect is detected.
    status: pending
  - id: secret-scanning-approval-gate
    content: If any secret-scanning alerts appear during execution, provide details and request explicit user confirmation before applying fixes.
    status: pending
  - id: docs-update-gate
    content: Update README/docs/security notes when remediation affects API/SDK behavior, setup, or contracts.
    status: pending
  - id: expected-automated-tests-implementation
    content: Implement all automated tests listed in `## Expected Automated Tests` and verify they pass before final validation gates.
    status: pending
  - id: sdk-manual-validation
    content: Run SDK-focused manual validation after automated gates (without mandatory container rebuild), and record checklist outcomes in the plan.
    status: pending
  - id: final-validation
    content: Run build→lint→test after all remediations and ensure all checks pass.
    status: pending
  - id: final-dod-closure
    content: Confirm Definition of Done checklist is fully satisfied and mark remaining todos accordingly.
    status: pending
isProject: false
---

# 63.0 - Miso Client Security and Quality Master Remediation Plan

## Goal
Remediate open violations in `esystemsdev/aifabrix-miso-client` across Dependabot, Security Quality, and Code Scanning baselines, while enforcing explicit approval gating for any Secret Scanning findings that appear during execution.

## Baseline Snapshot (fixed for this plan run)
- Snapshot date: 2026-07-24.
- Dependabot open alerts: 164.
  - Severity split: critical 6, high 62, medium 77, low 19.
  - Distinct advisories: 63.
  - Most impacted package: `axios` (71 alerts), then `vite` (28), `handlebars` (14), `undici` (7).
  - Manifest concentration: `server/pnpm-lock.yaml` (57), `server/frontend/pnpm-lock.yaml` (48), `pnpm-lock.yaml` (42), `server/package.json` (9), `server/frontend/package.json` (8).
- Code Scanning open alerts: 14.
  - Severity split: high 12, medium 2.
  - Rule families: `js/cors-misconfiguration-for-credentials` (4), `js/tainted-format-string` (4), `js/prototype-polluting-assignment` (2), plus `js/insufficient-password-hash`, `js/resource-exhaustion`, `js/missing-rate-limiting`, `js/polynomial-redos`.
- Security Quality open findings: 43.
  - Severity split: note 34, warning 9.
  - Rule families: `js/unused-local-variable` (34), `js/trivial-conditional` (4), `js/comparison-between-incompatible-types` (3), `js/useless-assignment-to-local` (1), `js/duplicate-property` (1).
- Secret Scanning open alerts: 0.
- Large catalogs file: `/home/dev02/aifabrix-miso-client/.cursor/plans/miso-client_security_remediation_4fc92583.locations.csv`

## Scope
### In scope
- Remediate all 164 open Dependabot alerts from this fixed baseline.
- Remediate all 14 Code Scanning alerts from this fixed baseline.
- Remediate all 43 Security Quality findings from this fixed baseline.
- Handle Secret Scanning via explicit approval gate policy (see dedicated section).
- Update docs when remediation changes API behavior, SDK contracts, auth semantics, or developer setup.
- Validate all fixes with project-required build/lint/test sequence and targeted manual checks.

### Out of scope
- Unrelated feature development.
- Git push/PR merge/release operations.
- Re-baselining in the middle of implementation.
- Collecting closure evidence artifacts for each alert/finding.
- Re-running GitHub quality/security scans as part of this plan run.

## Rules and Standards
- `/home/dev02/aifabrix-miso-client/.cursor/rules/project-rules.mdc` - source of truth for SDK architecture, token/auth behavior, API conventions, and quality/security requirements.
- Apply critical requirements from the rules file during implementation:
  - keep controller authentication on `x-client-token` for normal controller API calls;
  - preserve RFC 7807 error handling behavior and security constraints;
  - keep all public API outputs camelCase;
  - do not expose secrets in logs or code;
  - keep existing reuse patterns (`src/api`, `src/services`, `src/utils`) and avoid ad-hoc duplication.

## Pre-Execution Completed
- Baseline was captured and fixed on 2026-07-24 for all four sources (Dependabot, Security Quality, Code Scanning, Secret Scanning).
- Current volumes were grouped for execution priority:
  - Dependabot: 164 alerts, prioritized by severity and dependency concentration.
  - Code Scanning: 14 alerts, grouped by 7 rule families.
  - Security Quality: 43 findings, grouped by 5 rule families.
  - Secret Scanning: 0 open alerts at baseline.
- Primary change surfaces and hotspots were identified in dependency manifests/lockfiles and security-related source paths.
- Execution order was fixed as: Dependabot -> Code Scanning -> Security Quality -> Final validation.

## Before Development
- Re-read baseline sections in this plan and confirm no re-baselining is performed during execution.
- Confirm dependency update strategy for high-volume advisory families (`axios`, `vite`, `handlebars`, `undici`) to minimize lockfile churn.
- Confirm all target files are inside this repository and avoid generated-artifact quick fixes.
- Prepare fix-by-family sequencing: runtime/security-sensitive findings first, behavior-neutral quality cleanups second.
- Confirm Secret Scanning gate behavior: no secret-related fix without explicit user confirmation.

## Violation Type Catalog

### Code Scanning (inline: all locations)

1) `js/cors-misconfiguration-for-credentials` (high, 4)  
Theory: credential leaks happen when CORS allows credentials and origin is computed from user-controlled input.  
Fix approach: use strict allowlist for origins, never accept `null` origin, and keep `Access-Control-Allow-Credentials=true` only with trusted explicit origins.
- `server/src/server.ts:176` (alert `#14`)
- `server/src/middleware/cors.ts:50` (alert `#13`)
- `server/src/middleware/cors.ts:30` (alert `#12`)
- `server/src/middleware/cors.ts:26` (alert `#11`)

2) `js/tainted-format-string` (high, 4)  
Theory: externally-controlled format strings can corrupt logging/output behavior.  
Fix approach: keep format string static, pass untrusted values as `%s` arguments or sanitize first.
- `src/utils/console-logger.ts:72` (alert `#8`)
- `src/utils/console-logger.ts:65` (alert `#7`)
- `src/utils/console-logger.ts:57` (alert `#6`)
- `src/utils/console-logger.ts:51` (alert `#5`)

3) `js/insufficient-password-hash` (high, 1)  
Theory: low-cost password hashing is crackable.  
Fix approach: migrate to adaptive KDF (`bcrypt`/`scrypt`/`PBKDF2`/`Argon2`) with secure parameters.
- `src/services/auth-cache-helpers.ts:26` (alert `#4`)

4) `js/resource-exhaustion` (high, 1)  
Theory: user-controlled object size/lifetime can exhaust memory/CPU.  
Fix approach: enforce hard limits for allocation size, request size, and object lifetime.
- `server/src/routes/api.ts:358` (alert `#3`)

5) `js/missing-rate-limiting` (high, 1)  
Theory: expensive endpoints without throttling are DoS-prone.  
Fix approach: add route-level rate limiting and bounded retries/work.
- `server/src/server.ts:662` (alert `#2`)

6) `js/polynomial-redos` (high, 1)  
Theory: ambiguous regex on untrusted input can cause polynomial backtracking.  
Fix approach: simplify regex to deterministic form or hard-limit input length before matching.
- `src/utils/browser-api-base-url.ts:17` (alert `#1`)

7) `js/prototype-polluting-assignment` (medium, 2)  
Theory: user-controlled dynamic keys can mutate prototypes and lead to gadget exploitation.  
Fix approach: use `Map`/prototype-less objects and block prototype keys (`__proto__`, `constructor`, `prototype`).
- `src/utils/filter.utils.ts:351` (alert `#10`)
- `src/utils/filter.utils.ts:225` (alert `#9`)

### Security Quality

1) `js/unused-local-variable` (note, 34)  
Theory: unused symbols often indicate dead code, stale assumptions, or hidden logic defects.  
Fix approach: remove unused imports/variables/functions, or consume value meaningfully where intended.  
Locations are large and moved to CSV catalog:
- `/home/dev02/aifabrix-miso-client/.cursor/plans/miso-client_security_remediation_4fc92583.locations.csv`

2) `js/trivial-conditional` (warning, 4)  
Theory: always-true/always-false branches usually indicate logic errors or incomplete refactor.  
Fix approach: remove tautological checks and keep only conditionals that change behavior.
- `server/frontend/src/components/demo/MonitoringPage.tsx:345` (finding `#5`)
- `src/express/client-token-endpoint.ts:130` (finding `#6`)
- `src/express/client-token-endpoint.ts:140` (finding `#7`)
- `src/utils/http-client-audit.ts:47` (finding `#8`)

3) `js/comparison-between-incompatible-types` (warning, 3)  
Theory: impossible equality/inequality checks make branches unreachable and hide bugs.  
Fix approach: normalize types before comparison and use explicit guards for `null`/`undefined`.
- `src/services/logger/unified-logger.service.ts:143` (finding `#1`)
- `src/utils/filter.utils.ts:121` (finding `#2`)
- `src/utils/filter.utils.ts:205` (finding `#3`)

4) `js/useless-assignment-to-local` (warning, 1)  
Theory: overwritten assignments without reads are no-op noise.  
Fix approach: remove dead store or assert side effect intentionally.
- `server/frontend/src/contexts/__tests__/DataClientContext.test.tsx:266` (finding `#9`)

5) `js/duplicate-property` (warning, 1)  
Theory: duplicate object keys usually come from copy/paste mistakes and shadow earlier values.  
Fix approach: keep a single authoritative key per object literal.
- `jest.config.js:42` (finding `#4`)

### Dependabot

Dependabot currently has 63 advisory types and 164 alerts. The full advisory-to-manifest location map is large and moved to CSV catalog:
- `/home/dev02/aifabrix-miso-client/.cursor/plans/miso-client_security_remediation_4fc92583.locations.csv`

Execution focus for Dependabot during implementation:
- First: critical advisories (`handlebars` RCE/injection class, `vitest` arbitrary file read/exec class).
- Second: high advisories (mainly `axios` prototype-pollution, credential-leak, and resource-exhaustion classes; also `vite`, `form-data`, `lodash`, `rollup`, `minimatch`).
- Third: medium/low advisories (including `undici`, `qs`, `js-yaml`, `postcss`, `picomatch`, residual `vite`/`axios` items).
- For each type, fix by upgrading to patched versions and performing minimal compatibility refactors in affected paths.

## Expected Automated Tests
- Add or update focused tests for each touched security rule family in `Code Scanning` (CORS, format-string handling, hashing, rate limiting, regex safety, prototype-pollution guards, resource bounds).
- Add or update regression tests for dependency-driven behavior changes in touched SDK/service/utils modules.
- Keep quality-fix tests behavior-neutral unless the finding reveals a real defect.
- Ensure existing unit/integration suites remain green for touched paths.
- Validate lint output has zero warnings/errors after remediation updates.

## Primary change surfaces
- Dependency manifests and lockfiles:
  - [`/home/dev02/aifabrix-miso-client/package.json`](/home/dev02/aifabrix-miso-client/package.json)
  - [`/home/dev02/aifabrix-miso-client/pnpm-lock.yaml`](/home/dev02/aifabrix-miso-client/pnpm-lock.yaml)
  - [`/home/dev02/aifabrix-miso-client/server/package.json`](/home/dev02/aifabrix-miso-client/server/package.json)
  - [`/home/dev02/aifabrix-miso-client/server/pnpm-lock.yaml`](/home/dev02/aifabrix-miso-client/server/pnpm-lock.yaml)
  - [`/home/dev02/aifabrix-miso-client/server/frontend/package.json`](/home/dev02/aifabrix-miso-client/server/frontend/package.json)
  - [`/home/dev02/aifabrix-miso-client/server/frontend/pnpm-lock.yaml`](/home/dev02/aifabrix-miso-client/server/frontend/pnpm-lock.yaml)
- Code scanning hotspots:
  - [`/home/dev02/aifabrix-miso-client/server/src/middleware/cors.ts`](/home/dev02/aifabrix-miso-client/server/src/middleware/cors.ts)
  - [`/home/dev02/aifabrix-miso-client/server/src/server.ts`](/home/dev02/aifabrix-miso-client/server/src/server.ts)
  - [`/home/dev02/aifabrix-miso-client/src/utils/console-logger.ts`](/home/dev02/aifabrix-miso-client/src/utils/console-logger.ts)
  - [`/home/dev02/aifabrix-miso-client/src/utils/filter.utils.ts`](/home/dev02/aifabrix-miso-client/src/utils/filter.utils.ts)
- Quality hotspots (mostly tests/config):
  - [`/home/dev02/aifabrix-miso-client/tests/unit/data-client.test.ts`](/home/dev02/aifabrix-miso-client/tests/unit/data-client.test.ts)
  - [`/home/dev02/aifabrix-miso-client/jest.config.js`](/home/dev02/aifabrix-miso-client/jest.config.js)
  - [`/home/dev02/aifabrix-miso-client/server/frontend/src/contexts/__tests__/DataClientContext.test.tsx`](/home/dev02/aifabrix-miso-client/server/frontend/src/contexts/__tests__/DataClientContext.test.tsx)

## Execution strategy (single master plan, strict order)
1. Dependabot first:
   - Consolidate updates by dependency family to reduce lockfile churn and repeated breakage.
   - Prioritize critical/high advisories first (`vitest`/`vite`/`axios` families), then medium/low.
   - Run compatibility fixes where dependency updates require source changes.
2. Code Scanning second:
   - Implement fixes for all 14 baseline alerts grouped by rule family.
   - Prioritize production runtime paths before test-only paths.
3. Security Quality third:
   - Implement fixes for all 43 baseline findings grouped by rule family.
   - Keep cleanup behavior-neutral unless a bug is uncovered.
4. Secret scanning gate:
   - Since baseline is zero, no immediate code fix is planned.
   - During implementation, if any secret alert appears (new scan/reopen), stop and provide full details (alert URL, secret type, location, validity where available) and request explicit user confirmation before any fix, rotation, or history rewrite action.
5. Final validation:
   - Run full validation once the remediation stack is complete.

## Validation gates
- Required order:
  1. `pnpm run tests:typecheck:silent` (fallback: `pnpm run tests:typecheck` only if silent runner/log is not usable)
  2. `pnpm run build:silent` (fallback: `pnpm run build` only if silent runner/log is not usable)
  3. `pnpm run fmt:silent` (fallback: `pnpm run fmt` only if silent runner/log is not usable)
  4. `pnpm run md:lint:silent` then optional `pnpm run md:fix:silent` (fallback non-silent variants only if silent runner/log is not usable)
  5. `pnpm run lint:silent` (fallback: `pnpm run lint` only if silent runner/log is not usable)
  6. `pnpm run test:silent` (fallback: `pnpm run test` only if silent runner/log is not usable)
- Add targeted package/test runs where needed before final full gate.
- Do not mark completion until all baseline groups are either fixed or explicitly approved as exceptions.
- On any `*:silent` failure, inspect `.temp/validation/*` logs first; run non-silent fallback only when silent output/log is not actionable.

## Validation

```bash
pnpm run tests:typecheck:silent
pnpm run build:silent
pnpm run fmt:silent
pnpm run md:lint:silent
# Optional if markdown fixes are needed:
pnpm run md:fix:silent
pnpm run lint:silent
pnpm run test:silent
```

## Documentation updates (mandatory when behavior changes)
If remediation changes API or SDK behavior, also update:
- [`/home/dev02/aifabrix-miso-client/README.md`](/home/dev02/aifabrix-miso-client/README.md)
- [`/home/dev02/aifabrix-miso-client/docs/`](/home/dev02/aifabrix-miso-client/docs/)
- Relevant security/changelog notes for consumers.

## Manual Testing
Manual testing is executed as SDK-focused validation after automated gates. For this SDK repository, container update/build is not mandatory unless a specific runtime container scenario is explicitly requested.

- [ ] Happy path / baseline behavior: run an end-to-end SDK auth + data-client flow in local test/runtime setup; expected outcome: login/token workflow and baseline request flow succeed without new runtime errors.
- [ ] Negative/error path: execute invalid input and denied-access scenarios on touched security paths (for example CORS/headers, rate-limit-protected routes, malformed filter/query payloads); expected outcome: controlled failure with expected status/error contract and no crash.
- [ ] Boundary/edge conditions: test empty values, min/max limits, and unusual-but-valid combinations for touched APIs/utilities; expected outcome: deterministic handling, with valid inputs accepted and invalid inputs rejected.
- [ ] Configuration/environment variants: verify relevant runtime variants (for example server-only path, frontend stub path, local auth-disabled mode if used); expected outcome: behavior is consistent with documented expectations in each variant.
- [ ] Integration/contract checks: validate request/response shape, required headers/params, and compatibility expectations between SDK, server, and frontend test harnesses; expected outcome: contract compatibility preserved or explicitly documented.
- [ ] Regression checks: rerun adjacent previously stable unit/integration/manual scenarios near modified files; expected outcome: no collateral regressions.

Secret-scanning validation gate during execution:
- [ ] If any secret-scanning alert appears during implementation, present full details (alert URL, secret type, location, validity status if available) and ask the user for explicit confirmation before applying any fix, rotation, or history rewrite; expected outcome: no secret-related fix is applied without user confirmation.

## Definition of Done
- Fixes are implemented for all 164 Dependabot baseline alerts (or explicitly approved exceptions are documented).
- Fixes are implemented for all 14 Code Scanning baseline alerts (or explicitly approved exceptions are documented).
- Fixes are implemented for all 43 Security Quality baseline findings (or explicitly approved exceptions are documented).
- Secret Scanning remains zero open alerts, or any non-zero finding was handled only after explicit user confirmation.
- Validation commands are executed in the required order and all pass.
- Lint result has zero warnings and zero errors.
- All automated tests pass.
- All public API outputs remain camelCase.
- Security requirements from project rules are met (token handling, secret handling, RFC 7807 behavior).
- Documentation is updated for any contract/behavior changes.
- SDK manual validation was completed and all checklist items are marked complete.
- Closure evidence collection and security/quality scan reruns are intentionally out of scope for this plan run.

## Plan Validation Report

**Date**: 2026-07-24  
**Plan**: `/home/dev02/aifabrix-miso-client/.cursor/plans/miso-client_security_remediation_4fc92583.plan.md`  
**Status**: ✅ VALIDATED

### Plan Purpose

- Plan purpose is focused on remediation execution for fixed baseline findings (Dependabot, Code Scanning, Security Quality).
- Secret scanning handling is constrained by explicit approval gating.

### Applicable Rules

- ✅ `/home/dev02/aifabrix-miso-client/.cursor/rules/project-rules.mdc` - mapped to token policy, RFC 7807, camelCase public outputs, logging/security constraints, and test quality expectations.

### DoD Gate Readiness

- ✅ Ordered validation commands are explicit in `## Validation gates`.
- ✅ Zero-warning lint requirement is explicit in `## Definition of Done`.
- ✅ Test and documentation requirements are explicit in `## Expected Automated Tests` and `## Documentation updates`.

### Todo Synchronization

- ✅ Frontmatter `todos` contain required fields (`id`, `content`, `status`) with valid statuses.
- ✅ Todos are aligned with major phases (scope/prereq, implementation streams, tests, docs, validation, DoD closure).
- ✅ Missing coverage phases were added (`scope-and-prerequisites`, `expected-automated-tests-implementation`, `final-dod-closure`).

### Updates Applied

- Added/updated: `## Rules and Standards`, `## Before Development`, `## Expected Automated Tests`, `## Validation`.
- Hardened `## Validation gates` with required silent-command order and fallback policy.
- Updated `## Definition of Done` with explicit rule-mandated completion criteria.
- Added this `## Plan Validation Report`.

### Risks / Follow-ups

- Baseline closure in GitHub scanners remains intentionally out of scope for this run.
- Large advisory/location catalogs remain externalized in the adjacent CSV by design.