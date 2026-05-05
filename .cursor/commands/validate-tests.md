# validate-tests

When the `/validate-tests` command is used, the agent must automatically fix all errors and ensure all validation steps pass. The agent must work autonomously without asking the user for input or showing intermediate progress.

**Execution Process:**

**Silent failure handling policy (mandatory):**

- When a `*:silent` command fails, first inspect its log file in `.temp/validation/*`.
- Use non-silent fallback command only if the silent runner or log is unavailable, corrupted, truncated, or does not provide actionable diagnostics.
- Do not run non-silent fallback by default when a readable log already contains sufficient error details.

1. **Test Typecheck Step**:
   - Run `pnpm run tests:typecheck:silent` to validate TypeScript in tests (full logs: `.temp/validation/00-tests-typecheck`)
   - If it fails, fix test type errors and re-run until it passes
   - Do not proceed until test typecheck step is green

2. **Lint Fix Step**:
   - Run `pnpm run lint:fix:silent` to automatically fix linting and formatting issues (full logs: `.temp/validation/05-lint-fix`)
   - If lint:fix fails or produces errors, automatically fix the issues in the codebase
   - Re-run `pnpm run lint:fix:silent` until it passes (exit code 0)
   - Do not proceed until lint:fix step is green

3. **Lint Check Step**:
   - Run `pnpm run lint:silent` to check for remaining linting errors (full logs: `.temp/validation/05-lint`)
   - If linting fails, automatically fix all linting errors in the codebase
   - Re-run `pnpm run lint:silent` until it passes (exit code 0)
   - Do not proceed until lint step is green

4. **Test Step**:
   - Run `pnpm run test:silent` to run all tests (full logs: `.temp/validation/06-test`)
   - If tests fail, automatically fix all test failures
   - Re-run `pnpm run test:silent` until all tests pass (exit code 0)
   - Do not proceed until test step is green
   - **All tests MUST be mocked** - no real database connections, external API calls, or I/O operations

- **Each individual unit test SHOULD complete in less than 0.5 seconds** - if a unit test takes longer, optimize by ensuring external dependencies are mocked and using fake timers where appropriate. This does not apply to full-suite runtime.

5. **Final Verification Step**:
   - Run `pnpm run tests:typecheck:silent` again to ensure no new test type errors
   - If it fails, fix issues and re-run until it passes
   - Run `pnpm run lint:fix:silent` again to ensure no formatting changes were introduced
   - Run `pnpm run lint:silent` again to ensure no linting issues were introduced
   - If lint:fix or lint made any changes, run `pnpm run test:silent` again to verify tests still pass
   - Continue this loop until lint:fix and lint make no changes AND tests pass
   - This ensures the codebase is in a stable, validated state

**Critical Requirements:**

- **Automatic Error Fixing**: The agent MUST automatically fix all errors found during validation
- **Iterative Process**: Keep running each step and fixing errors until it passes
- **No User Interaction**: Do NOT ask the user for input or show what's being done
- **Silent Operation**: Work autonomously and only report completion when all steps are green
- **No ESLint Rule Weakening**: Do NOT change ESLint configuration/rules to reduce or hide errors/warnings (including thresholds like max warnings)
- **No Lint Bypass by Suppression**: Do NOT add ESLint suppressions (`eslint-disable`, `eslint-disable-next-line`, `eslint-disable-line`) unless strictly necessary
- **Allowed Suppression for Architecture-Approved Console Logging**: If project architecture/rules explicitly allow console logging for a specific layer/module, targeted suppression for `no-console` is allowed in code for that exact scope
- **No globalThis Console Workaround**: Do NOT bypass `no-console` by calling `globalThis.console` (or equivalent aliases/wrappers) because it is still console logging behavior
- **No process.stderr Workaround**: Do NOT replace `console` logging with `process.stderr.write` (or similar stream writes) solely to bypass `no-console`
- **Preferred Handling for Allowed Console Cases**: For architecture-approved console usage, prefer narrow `no-console` suppression comments in code over indirect console invocation patterns
- **Suppression Justification Required**: Any suppression must be as narrow as possible and include a brief inline justification comment explaining why code changes are not the preferred option
- **Test Performance**: All tests must be mocked and individual unit tests should complete in less than 0.5 seconds (full-suite runtime can be higher)
- **Final Verification**: Lint:fix and lint must be run again after tests pass, and if changes are made, tests must be re-run
- **Complete Success**: The command is only complete when ALL steps pass AND final verification shows no changes:
- ✅ `pnpm run tests:typecheck:silent` passes (initial)
- ✅ `pnpm run lint:fix:silent` passes (initial)
- ✅ `pnpm run lint:silent` passes (initial)
- ✅ `pnpm run test:silent` passes (initial; mocked tests, per-unit-test runtime guideline < 0.5 seconds)
- ✅ `pnpm run tests:typecheck:silent` passes (final)
- ✅ `pnpm run lint:fix:silent` passes (final, no changes)
- ✅ `pnpm run lint:silent` passes (final, no changes)
- ✅ `pnpm run test:silent` passes (final, if lint:fix/lint made changes)

**Work is only done when all validation checks are green and working, final verification shows no changes, and unit tests meet the per-test runtime guideline (target < 0.5s per unit test).**
