# validate-server-tests

When the `/validate-server-tests` command is used, the agent must automatically fix all errors and ensure all validation steps pass for the server codebase. The agent must work autonomously without asking the user for input or showing intermediate progress.

**Execution Process:**

1. **Lint Fix Step**:
   - Change directory to `server/` directory
   - Run `npm run lint:fix` to automatically fix linting and formatting issues
   - If lint:fix fails or produces errors, automatically fix the issues in the server codebase
   - Re-run `npm run lint:fix` until it passes (exit code 0)
   - Do not proceed until lint:fix step is green

2. **Lint Check Step**:
   - Run `npm run lint` to check for remaining linting errors
   - If linting fails, automatically fix all linting errors in the server codebase
   - Re-run `npm run lint` until it passes (exit code 0)
   - Do not proceed until lint step is green

3. **Test Step**:
   - Run `npm test` to run all server tests
   - If tests fail, automatically fix all test failures
   - Re-run `npm test` until all tests pass (exit code 0)
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
   - Run `npm run lint:fix` again to ensure no formatting changes were introduced
   - Run `npm run lint` again to ensure no linting issues were introduced
   - If lint:fix or lint made any changes, run `npm test` again to verify tests still pass
   - Continue this loop until lint:fix and lint make no changes AND tests pass
   - This ensures the server codebase is in a stable, validated state

**Critical Requirements:**

- **Automatic Error Fixing**: The agent MUST automatically fix all errors found during validation
- **Iterative Process**: Keep running each step and fixing errors until it passes
- **No User Interaction**: Do NOT ask the user for input or show what's being done
- **Silent Operation**: Work autonomously and only report completion when all steps are green
- **Test Performance**: All tests must be mocked and each individual test must complete in less than 0.5 seconds
- **Final Verification**: Lint:fix and lint must be run again after tests pass, and if changes are made, tests must be re-run
- **Server Context**: All commands must be run from the `server/` directory
- **Complete Success**: The command is only complete when ALL steps pass AND final verification shows no changes:
  - ✅ `cd server && npm run lint:fix` passes (initial)
  - ✅ `cd server && npm run lint` passes (initial)
  - ✅ `cd server && npm test` passes (initial, each test < 0.5 seconds, all mocked)
  - ✅ `cd server && npm run lint:fix` passes (final, no changes)
  - ✅ `cd server && npm run lint` passes (final, no changes)
  - ✅ `cd server && npm test` passes (final, if lint:fix/lint made changes)

**Server-Specific Test Requirements:**

- Mock MisoClient and all its methods (log, auth, roles, permissions, etc.)
- Mock Express Request/Response/NextFunction objects
- Mock HTTP client calls (axios, fetch, etc.)
- Mock Redis connections and operations
- Mock file system operations (if any)
- Use Jest fake timers for timeouts and delays
- Ensure all async operations are properly awaited in tests
- Mock environment variables and configuration

**Work is only done when all validation checks are green and working, final verification shows no changes, and each individual test completes in under 0.5 seconds.**
