# validate-server-tests

When the `/validate-server-tests` command is used, the agent must automatically fix all errors and ensure all validation steps pass for the server codebase. The agent must work autonomously without asking the user for input or showing intermediate progress.

**Execution Process:**

1. **Lint Fix Step**:
   - Run `pnpm run server:lint:fix:silent` to automatically fix linting and formatting issues (full logs: `.temp/validation/server-01-lint-fix`)
   - If lint:fix fails or produces errors, automatically fix the issues in the server codebase
   - Re-run `pnpm run server:lint:fix:silent` until it passes (exit code 0)
   - Do not proceed until lint:fix step is green

2. **Lint Check Step**:
   - Run `pnpm run server:lint:silent` to check for remaining linting errors (full logs: `.temp/validation/server-02-lint`)
   - If linting fails, automatically fix all linting errors in the server codebase
   - Re-run `pnpm run server:lint:silent` until it passes (exit code 0)
   - Do not proceed until lint step is green

3. **Test Step**:
   - Run `pnpm run server:test:silent` to run all server tests (full logs: `.temp/validation/server-03-test`)
   - If tests fail, automatically fix all test failures
   - Re-run `pnpm run server:test:silent` until all tests pass (exit code 0)
   - Do not proceed until test step is green
   - **All tests MUST be mocked** - no real database connections, external API calls, or I/O operations
   - **Each individual unit test SHOULD complete in less than 0.5 seconds** - if a unit test takes longer, optimize by ensuring external dependencies are mocked and using fake timers where appropriate. This does not apply to full-suite runtime.
   - **Server-specific considerations**:
     - Mock MisoClient initialization and methods
     - Mock Express Request/Response objects
     - Mock HTTP client calls
     - Mock Redis connections
     - Use fake timers for async operations

4. **Final Verification Step**:
   - Run `pnpm run server:lint:fix:silent` again to ensure no formatting changes were introduced
   - Run `pnpm run server:lint:silent` again to ensure no linting issues were introduced
   - If lint:fix or lint made any changes, run `pnpm run server:test:silent` again to verify tests still pass
   - Continue this loop until lint:fix and lint make no changes AND tests pass
   - This ensures the server codebase is in a stable, validated state

5. **Build Step**:
   - Run `pnpm run server:build:silent` to build the server application (full logs: `.temp/validation/server-04-build`)
   - If build fails, automatically fix all build errors in the server codebase
   - Re-run `pnpm run server:build:silent` until it passes (exit code 0)
   - Do not proceed until build step is green

6. **Start Dev Step**:
   - Run `pnpm run server:start:dev:silent` to start the development server in detached mode (full logs: `.temp/validation/server-05-start-dev`)
   - Verify the server starts successfully (check for startup errors)
   - The server should be running and ready to accept requests
   - If startup fails, automatically fix all startup errors
   - Re-run `pnpm run server:start:dev:silent` until it starts successfully

**Critical Requirements:**

- **Automatic Error Fixing**: The agent MUST automatically fix all errors found during validation
- **Iterative Process**: Keep running each step and fixing errors until it passes
- **No User Interaction**: Do NOT ask the user for input or show what's being done
- **Silent Operation**: Work autonomously and only report completion when all steps are green
- **Test Performance**: All tests must be mocked and individual unit tests should complete in less than 0.5 seconds (full-suite runtime can be higher)
- **Final Verification**: Lint:fix and lint must be run again after tests pass, and if changes are made, tests must be re-run
- **Server Context**: Use root-level server `:silent` wrappers (`server:*:silent`) to keep logs in `.temp/validation`
- **Complete Success**: The command is only complete when ALL steps pass AND final verification shows no changes:
  - ✅ `pnpm run server:lint:fix:silent` passes (initial)
  - ✅ `pnpm run server:lint:silent` passes (initial)
  - ✅ `pnpm run server:test:silent` passes (initial; mocked tests, per-unit-test runtime guideline < 0.5 seconds)
  - ✅ `pnpm run server:lint:fix:silent` passes (final, no changes)
  - ✅ `pnpm run server:lint:silent` passes (final, no changes)
  - ✅ `pnpm run server:test:silent` passes (final, if lint:fix/lint made changes)
  - ✅ `pnpm run server:build:silent` passes
  - ✅ `pnpm run server:start:dev:silent` starts successfully

**Server-Specific Test Requirements:**

- Mock MisoClient and all its methods (log, auth, roles, permissions, etc.)
- Mock Express Request/Response/NextFunction objects
- Mock HTTP client calls (axios, fetch, etc.)
- Mock Redis connections and operations
- Mock file system operations (if any)
- Use Jest fake timers for timeouts and delays
- Ensure all async operations are properly awaited in tests
- Mock environment variables and configuration

**Work is only done when all validation checks are green and working, final verification shows no changes, unit tests meet the per-test runtime guideline (target < 0.5s per unit test), build completes successfully, and the development server starts without errors.**
