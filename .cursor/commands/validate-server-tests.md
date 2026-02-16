# validate-server-tests

When the `/validate-server-tests` command is used, the agent must automatically fix all errors and ensure all validation steps pass for the server codebase. The agent must work autonomously without asking the user for input or showing intermediate progress.

**Execution Process:**

1. **Lint Fix Step**:
   - Change directory to `server/` directory
   - Run `pnpm run lint:fix` to automatically fix linting and formatting issues
   - If lint:fix fails or produces errors, automatically fix the issues in the server codebase
   - Re-run `pnpm run lint:fix` until it passes (exit code 0)
   - Do not proceed until lint:fix step is green

2. **Lint Check Step**:
   - Run `pnpm run lint` to check for remaining linting errors
   - If linting fails, automatically fix all linting errors in the server codebase
   - Re-run `pnpm run lint` until it passes (exit code 0)
   - Do not proceed until lint step is green

3. **Test Step**:
   - Run `pnpm test` to run all server tests
   - If tests fail, automatically fix all test failures
   - Re-run `pnpm test` until all tests pass (exit code 0)
   - Do not proceed until test step is green
   - **All tests MUST be mocked** - no real database connections, external API calls, or I/O operations
   - **Each individual test MUST complete in less than 0.5 seconds** - if any individual test takes longer than 0.5 seconds, optimize by ensuring all external dependencies are properly mocked and using fake timers where appropriate
   - **Server-specific considerations**:
     - Mock MisoClient initialization and methods
     - Mock Express Request/Response objects
     - Mock HTTP client calls
     - Mock Redis connections
     - Use fake timers for async operations

4. **Final Verification Step**:
   - Run `pnpm run lint:fix` again to ensure no formatting changes were introduced
   - Run `pnpm run lint` again to ensure no linting issues were introduced
   - If lint:fix or lint made any changes, run `pnpm test` again to verify tests still pass
   - Continue this loop until lint:fix and lint make no changes AND tests pass
   - This ensures the server codebase is in a stable, validated state

5. **Build Step**:
   - Run `pnpm build` to build the server application
   - If build fails, automatically fix all build errors in the server codebase
   - Re-run `pnpm build` until it passes (exit code 0)
   - Do not proceed until build step is green

6. **Start Dev Step**:
   - Run `pnpm start:dev` to start the development server
   - Verify the server starts successfully (check for startup errors)
   - The server should be running and ready to accept requests
   - If startup fails, automatically fix all startup errors
   - Re-run `pnpm start:dev` until it starts successfully

**Critical Requirements:**

- **Automatic Error Fixing**: The agent MUST automatically fix all errors found during validation
- **Iterative Process**: Keep running each step and fixing errors until it passes
- **No User Interaction**: Do NOT ask the user for input or show what's being done
- **Silent Operation**: Work autonomously and only report completion when all steps are green
- **Test Performance**: All tests must be mocked and each individual test must complete in less than 0.5 seconds
- **Final Verification**: Lint:fix and lint must be run again after tests pass, and if changes are made, tests must be re-run
- **Server Context**: All commands must be run from the `server/` directory
- **Complete Success**: The command is only complete when ALL steps pass AND final verification shows no changes:
  - ✅ `cd server && pnpm run lint:fix` passes (initial)
  - ✅ `cd server && pnpm run lint` passes (initial)
  - ✅ `cd server && pnpm test` passes (initial, each test < 0.5 seconds, all mocked)
  - ✅ `cd server && pnpm run lint:fix` passes (final, no changes)
  - ✅ `cd server && pnpm run lint` passes (final, no changes)
  - ✅ `cd server && pnpm test` passes (final, if lint:fix/lint made changes)
  - ✅ `cd server && pnpm build` passes
  - ✅ `cd server && pnpm start:dev` starts successfully

**Server-Specific Test Requirements:**

- Mock MisoClient and all its methods (log, auth, roles, permissions, etc.)
- Mock Express Request/Response/NextFunction objects
- Mock HTTP client calls (axios, fetch, etc.)
- Mock Redis connections and operations
- Mock file system operations (if any)
- Use Jest fake timers for timeouts and delays
- Ensure all async operations are properly awaited in tests
- Mock environment variables and configuration

**Work is only done when all validation checks are green and working, final verification shows no changes, each individual test completes in under 0.5 seconds, build completes successfully, and the development server starts without errors.**
