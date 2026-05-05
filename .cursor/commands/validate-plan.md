# validate-plan

Validate a plan file before implementation by mapping it to project rules, hardening execution gates, synchronizing frontmatter `todos`, and attaching a validation report to the same plan file.

## Purpose

This command ensures that the plan is execution-ready:

1. Purpose and scope are explicit (`In scope` / `Out of scope`)
2. Applicable sections of `.cursor/rules/project-rules.mdc` are linked
3. DoD includes explicit, ordered validation commands
4. Frontmatter `todos` matches real plan phases
5. Code plans include expected automated tests and documentation updates
6. Validation report is appended/replaced in the same plan file

## Usage

```bash
/validate-plan [plan-file-path]
```

Examples:

- `/validate-plan`
- `/validate-plan .cursor/plans/57-enterprise-auth-unification-ts-sdk_07fa02a3.plan.md`

## Execution Steps

### 1) Resolve Plan File

1. Use provided path if present.
2. Otherwise use the most recent plan in `.cursor/plans/`.
3. If still ambiguous, ask user to choose.
4. Read full file and validate markdown/frontmatter.

### 2) Identify Plan Type and Scope

Extract:

- title, goal/overview, affected files/modules, tasks
- plan type (`code`, `api`, `docs-only`, `refactor`, `infra`)

API plan detection keywords:

- `endpoint`, `route`, `OpenAPI`, `REST`, `router`, `/api/`

Code plan detection:

- any changes in `src/`, `tests/`, public API types, runtime behavior

### 3) Read and Map Rules (Mandatory)

Always read `.cursor/rules/project-rules.mdc` and map the plan to relevant rule blocks.

Mandatory for all plans:

- Code quality gates and ordering
- Testing conventions
- Security/token handling

Additionally map by scope:

- services, HTTP client, Redis, Express, auth/authorization, logging, types, docs

### 4) Normalize Plan Structure

Ensure these sections exist (create if missing, update if present):

1. `## Scope`
   - `### In scope`
   - `### Out of scope`
2. `## Rules and Standards`
   - links to applicable sections in `.cursor/rules/project-rules.mdc`
   - short “why applies” notes
   - key requirements bullets
3. `## Before Development`
   - concise checklist for prerequisites and pattern review
4. `## Definition of Done`
   - explicit command gates and mandatory order
5. `## Validation`
   - copy-paste ready command block

For code plans, also ensure:

- `## Expected Automated Tests` with actionable bullets
- clear documentation update tasks if API/contract/config/public behavior changes

### 5) Synchronize Frontmatter `todos` (Mandatory)

Validate and synchronize `todos` with plan body.

Rules:

- required fields: `id`, `content`, `status`
- allowed statuses: `pending|in_progress|completed|cancelled`
- unique ids
- one major todo per phase, no duplicates

Minimum coverage:

1. scope and prerequisites
2. implementation
3. tests implementation
4. documentation updates (mandatory for API/contract changes)
5. validation gates
6. final DoD closure

For code plans, ensure a test todo equivalent to:

- `Implement all automated tests listed in \`## Expected Automated Tests\` and verify they pass before final validation gates.`

### 6) Validate DoD Command Gates

DoD must include this exact order (never reordered):

1. `pnpm run tests:typecheck:silent` (fallback: `pnpm run tests:typecheck`)
2. `pnpm run build:silent` (fallback: `pnpm run build`)
3. `pnpm run fmt:silent` (fallback: `pnpm run fmt`)
4. `pnpm run md:lint:silent` then optional `pnpm run md:fix:silent` (fallback: non-silent variants)
5. `pnpm run lint:silent` (fallback: `pnpm run lint`)
6. `pnpm run test:silent` (fallback: `pnpm run test`)

Mandatory statements:

- zero lint warnings/errors
- all tests pass
- all public API outputs are camelCase
- security requirements from project rules are met
- docs updated when API/contract/config/public usage changes

### 7) Attach Validation Report to Plan

Add or replace `## Plan Validation Report` in the same file.

Use current date dynamically in ISO format.

Template:

```markdown
## Plan Validation Report

**Date**: YYYY-MM-DD
**Plan**: <path>
**Status**: ✅ VALIDATED / ⚠️ NEEDS UPDATES / ❌ INCOMPLETE

### Plan Purpose

- <1-2 bullets>

### Applicable Rules

- ✅/⚠️ <rule section link> - <why>

### DoD Gate Readiness

- ✅/⚠️ Ordered commands are explicit
- ✅/⚠️ Zero-warning lint requirement present
- ✅/⚠️ Tests + docs requirements present

### Todo Synchronization

- ✅/⚠️ Frontmatter `todos` valid
- ✅/⚠️ Todos aligned with plan sections
- ✅/⚠️ Missing phases added

### Updates Applied

- <sections added/updated>

### Risks / Follow-ups

- <short bullets>
```

Status rules:

- `✅ VALIDATED`: all mandatory sections and gates present, todos synced
- `⚠️ NEEDS UPDATES`: minor missing items, non-critical gaps
- `❌ INCOMPLETE`: missing gates/todos/rule references or invalid structure

## Notes

- Preserve existing plan intent; only harden structure and execution clarity.
- Do not create separate report files unless user explicitly asks.
- Keep updates concise; avoid large narrative blocks.
