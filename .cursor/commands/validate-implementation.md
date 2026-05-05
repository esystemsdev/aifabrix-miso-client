# validate-implementation

Validate that a plan has been fully implemented, run strict quality gates in fixed order, synchronize task states with evidence, and attach a validation report to the same plan file.

## Purpose

This command verifies:

1. all plan tasks are implemented (not only checked)
2. referenced files and symbols exist
3. expected automated tests are present and passing
4. quality gates pass in strict order
5. implementation follows `.cursor/rules/project-rules.mdc`
6. markdown task checkboxes and frontmatter `todos` reflect real status

## Usage

```bash
/validate-implementation [plan-file-path]
```

Examples:

- `/validate-implementation`
- `/validate-implementation .cursor/plans/57-enterprise-auth-unification-ts-sdk_07fa02a3.plan.md`

## Execution Steps

### 1) Resolve and Parse Plan

1. Use provided path or latest file from `.cursor/plans/`.
2. Parse:
   - markdown checkboxes
   - frontmatter `todos`
   - mentioned files/modules
   - validation requirements
   - `Expected Automated Tests` (if present)

### 2) Preflight for Quiet Validation Output

1. Ensure `.temp/` is ignored by git (`.gitignore` contains `.temp/`).
2. Create logs directory:
   - `mkdir -p .temp/validation`
3. Run noisy commands in silent mode and write full logs to `.temp/validation/*`.
4. Show only concise summaries unless a step fails.

### 3) Validate Files and Task Evidence

Check:

- all planned files exist
- planned symbols/classes/functions exist
- tests exist for changed behavior
- docs changed when API/contract/config/public usage changed

### 4) Run Quality Gates (Mandatory Order)

Stop on first failure; do not continue to next gate.

1. **TEST TYPECHECK**  
   `pnpm run tests:typecheck:silent`  
   Fallback: `pnpm run tests:typecheck`  
   Log: `.temp/validation/00-tests-typecheck`

2. **BUILD**  
   `pnpm run build:silent`  
   Fallback: `pnpm run build`  
   Log: `.temp/validation/01-build`

3. **FORMAT**  
   `pnpm run fmt:silent`  
   Fallback: `pnpm run fmt`  
   Log: `.temp/validation/02-fmt`

4. **MARKDOWN LINT**  
   `pnpm run md:lint:silent`  
   Log: `.temp/validation/03-md-lint`  
   If failed, run:  
   `pnpm run md:fix:silent`  
   Log: `.temp/validation/04-md-fix`  
   Then re-run md lint once.

5. **LINT**  
   `pnpm run lint:silent`  
   Log: `.temp/validation/05-lint`  
   If failed, run:  
   `pnpm run lint:fix:silent`  
   Log: `.temp/validation/05-lint-fix`  
   Then re-run lint once.  
   Requirement: 0 errors, 0 warnings.

6. **TEST**  
   `pnpm run test:silent`  
   Fallback: `pnpm run test`  
   Log: `.temp/validation/06-test`

### 5) Validate Rule Compliance (SDK-Specific)

Validate against `.cursor/rules/project-rules.mdc`:

- HTTP client + token policy (`x-client-token` behavior)
- service-layer patterns and dependency structure
- Redis guard/fallback (`redis.isConnected()` checks before use)
- async/error handling expectations
- RFC 7807 behavior for Express utilities
- public API camelCase outputs
- no sensitive-data leakage in logs/docs/examples

### 6) Synchronize Task States (Mandatory)

Update in the plan file:

1. markdown checkboxes (`- [ ]`/`- [x]`)
2. frontmatter `todos` statuses (`pending|in_progress|completed|cancelled`)

Rules:

- mark complete only with objective evidence from files/tests/gates
- if any gate fails, keep related tasks incomplete
- eliminate checkbox/todo contradictions

### 7) Write Validation Report to Plan File

Add or replace `## Validation Report` in the same plan file.

Use dynamic date in `YYYY-MM-DD`.

Template:

```markdown
## Validation Report

**Date**: YYYY-MM-DD
**Status**: ✅ COMPLETE / ⚠️ INCOMPLETE / ❌ FAILED

### Executive Summary

- <completion summary>

### Task Completion

- Total: <n>
- Completed: <n>
- Incomplete: <n>

### Task State Synchronization

- ✅/❌ Markdown checkboxes synchronized
- ✅/❌ Frontmatter `todos` synchronized
- ✅/❌ No contradictions remain

### File and Implementation Validation

- ✅/❌ <file or feature check>

### Automated Tests Validation

- ✅/❌ Unit/integration tests exist where required
- ✅/❌ Expected automated tests implemented (if section exists)

### Quality Gates

- ✅/❌ tests:typecheck
- ✅/❌ build
- ✅/❌ fmt
- ✅/❌ md:lint (and md:fix if used)
- ✅/❌ lint (0 warnings/errors)
- ✅/❌ test

### Rules Compliance

- ✅/❌ SDK token/header policy
- ✅/❌ service/redis/error-handling patterns
- ✅/❌ RFC 7807 / security / camelCase API

### Logs

- Full logs: `.temp/validation/*`

### Issues and Recommendations

- <blocking and non-blocking items>

### Final Checklist

- [x] All tasks implemented and synchronized
- [x] Files and tests validated
- [x] Quality gates passed in strict order
- [x] Rules compliance verified
```

Status mapping:

- `✅ COMPLETE`: all gates pass, tasks synchronized, no critical rule violations
- `⚠️ INCOMPLETE`: partial implementation or non-critical gaps
- `❌ FAILED`: missing implementation, failed gates, or critical rule violations

## Critical Requirements

- Never reorder validation gates.
- Never skip a failed gate.
- Never mark tasks complete without evidence.
- Keep report in the same plan file; do not create extra report files unless user asks.
