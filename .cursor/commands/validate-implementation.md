# validate-implementation

This command validates that a plan has been implemented correctly according to its requirements, verifies tests exist, and ensures no code violations of cursor rules.

## Purpose

The command:

1. Analyzes a plan file (from `.cursor/plans/`) to extract implementation requirements
2. Validates that all tasks are completed
3. Verifies that all mentioned files exist and are implemented
4. Checks that tests exist for new/modified code
5. Runs code quality validation (format → lint → test)
6. Validates against cursor rules
7. Appends validation results to the original plan file

## Usage

Run this command in chat with `/validate-implementation [plan-file-path]`

**Examples**:

- `/validate-implementation` - Validates the most recently modified plan file
- `/validate-implementation .cursor/plans/68-data-client-browser-wrapper.plan.md` - Validates a specific plan

## What It Does

### 1. Plan Analysis

**Extracts from Plan File**:

- All tasks with checkboxes (`- [ ]` or `- [x]`)
- All files mentioned (paths, new files, modified files)
- All services, types, utilities mentioned
- Test requirements (unit tests, integration tests)
- Documentation requirements

**Validates Task Completion**:

- Checks if all tasks are marked as complete (`- [x]`)
- Identifies incomplete tasks (`- [ ]`)
- Reports completion percentage

### 2. File Existence Validation

**Checks for**:

- All mentioned files exist at specified paths
- New files are created (if marked as "New" in plan)
- Modified files exist and contain expected changes
- Type definition files exist (if mentioned)
- Test files exist for new/modified code

**Validates File Content**:

- Checks if mentioned classes/functions exist in files
- Verifies expected imports are present
- Validates that key changes are implemented
- Checks TypeScript type definitions

### 3. Test Coverage Validation

**Checks for**:

- Unit test files exist for new services/modules
- Integration test files exist (if required by plan)
- Test structure mirrors code structure
- Test files are in correct locations (`tests/unit/` mirrors `src/`)

**Validates Test Quality**:

- Tests use proper fixtures and mocks
- Tests cover error cases
- Tests use async patterns where needed
- Tests follow cursor rules for testing
- Tests properly mock HttpClient, RedisService, axios, ioredis, jsonwebtoken
- Tests complete in less than 0.5 seconds

### 4. Code Quality Validation

**Runs Validation Steps (MANDATORY ORDER)**:

1. **STEP 1 - FORMAT**:
   - Run `ppnpm run lint:fix` FIRST
   - Verify exit code 0
   - Report any formatting issues

2. **STEP 2 - LINT**:
   - Run `pnpm run lint` AFTER format
   - Verify exit code 0
   - Report all linting errors/warnings
   - **CRITICAL**: Zero warnings/errors required

3. **STEP 3 - TEST**:
   - Run `pnpm test` AFTER lint
   - Verify all tests pass
   - Report test failures
   - Check test execution time (< 0.5 seconds for unit tests)

**Validates Code Against Cursor Rules**:

- Reads relevant rules from repository-specific cursor rules
- Checks for violations in:
  - Code reuse (no duplication, use utilities)
  - Error handling (proper Error usage, try-catch, return empty arrays on error)
  - Logging (proper logging, no secrets logged)
  - Type safety (TypeScript annotations, interfaces over types for public APIs)
  - Async patterns (async/await, no raw promises)
  - HTTP client patterns (use HttpClient, authenticatedRequest, proper headers)
  - Token management (JWT decode, proper header usage)
  - Redis caching (check isConnected, proper fallback)
  - Service layer patterns (proper dependency injection, config access)
  - Security (no hardcoded secrets, proper secret management)
  - Public API naming (camelCase for all outputs)

### 5. Implementation Completeness Check

**Validates**:

- All service methods are implemented
- All type definitions are updated
- All utilities are implemented
- All Express middleware/utilities are implemented
- All documentation is updated
- All exports are properly configured in `src/index.ts`

### 6. Report Generation

**Appends Validation Results to Original Plan File**:

- Appends validation results directly to the original plan file
- Adds a new `## Validation` section at the end of the plan file
- If a validation section already exists, it replaces it with updated results
- Contains:
  - **Date**: Current date in yyyy-mm-dd format (dynamically generated, e.g., `2025-01-27`)
  - Executive summary (overall status)
  - File existence validation results
  - Test coverage analysis
  - Code quality validation results
  - Cursor rules compliance check
  - Implementation completeness assessment
  - Issues and recommendations
  - Final validation checklist
- **Note**: The plan file is modified to include validation results - previous validation sections are replaced
- **Date Format**: The date is automatically generated using the current date in ISO format (yyyy-mm-dd), not hardcoded

## Output

### Validation Section Structure

## Validation

**Date**: yyyy-mm-dd (current date, dynamically generated, e.g., `2025-01-27`)
**Status**: ✅ COMPLETE / ⚠️ INCOMPLETE / ❌ FAILED

### Executive Summary

[Overall status and completion percentage]

### File Existence Validation

- ✅/❌ [File path] - [Status]
- ✅/❌ [File path] - [Status]

### Test Coverage

- ✅/❌ Unit tests exist
- ✅/❌ Integration tests exist
- Test coverage: [percentage]%

### Code Quality Validation

**STEP 1 - FORMAT**: ✅/❌ PASSED
**STEP 2 - LINT**: ✅/❌ PASSED (0 errors, 0 warnings)
**STEP 3 - TEST**: ✅/❌ PASSED (all tests pass, < 0.5 seconds)

### Cursor Rules Compliance

- ✅/❌ Code reuse: PASSED
- ✅/❌ Error handling: PASSED
- ✅/❌ Error handling: PASSED
- ✅/❌ Logging: PASSED
- ✅/❌ Type safety: PASSED
- ✅/❌ Async patterns: PASSED
- ✅/❌ HTTP client patterns: PASSED
- ✅/❌ Token management: PASSED
- ✅/❌ Redis caching: PASSED
- ✅/❌ Service layer patterns: PASSED
- ✅/❌ Security: PASSED
- ✅/❌ Public API naming: PASSED

### Implementation Completeness

- ✅/❌ Services: COMPLETE
- ✅/❌ Types: COMPLETE
- ✅/❌ Utilities: COMPLETE
- ✅/❌ Express utilities: COMPLETE
- ✅/❌ Documentation: COMPLETE
- ✅/❌ Exports: COMPLETE

### Issues and Recommendations

[List of issues found and recommendations]

### Final Validation Checklist

- [x] All tasks completed
- [x] All files exist
- [x] Tests exist and pass
- [x] Code quality validation passes
- [x] Cursor rules compliance verified
- [x] Implementation complete

**Result**: ✅/❌ **VALIDATION PASSED/FAILED** - [Summary message]

```yaml

## Execution Behavior

**Automatic Execution**:
- The command executes automatically without asking for user input
- Shows progress during validation
- Appends validation results to the original plan file (modifies the plan file)
- Only asks for user input if critical issues require confirmation

**Error Handling**:
- If format fails: Reports error, does not proceed to lint
- If lint fails: Reports all errors, does not proceed to tests
- If tests fail: Reports all failures
- If files are missing: Reports missing files
- If tasks are incomplete: Reports incomplete tasks

**Critical Requirements**:
- **Format must pass** before linting
- **Lint must pass** (zero errors/warnings) before testing
- **Tests must pass** before marking as complete
- **All tasks must be completed** for full validation
- **All files must exist** for full validation
- **Tests must exist** for new/modified code
- **Tests must complete in < 0.5 seconds** (all mocked)

## Notes

- **Plan File Detection**: If no plan file is specified, the command finds the most recently modified plan file in `.cursor/plans/`
- **Task Parsing**: Extracts tasks from markdown checkboxes (`- [ ]` or `- [x]`)
- **File Detection**: Identifies file paths mentioned in plan (code blocks, file references, paths in text)
- **Validation Section**: Validation results are appended to the original plan file in a `## Validation` section
- **Section Replacement**: If a validation section already exists in the plan file, it is replaced with updated results
- **Plan File Modification**: The plan file is modified to include validation results - ensure the plan file is committed to version control

## Integration with Plans

This command is designed to be added to every code plan as a final validation step:

```markdown
## Validation

After implementation, run:
/validate-implementation .cursor/plans/<plan-name>.plan.md

This will validate:
- All tasks are completed
- All files exist and are implemented
- Tests exist and pass
- Code quality validation passes
- Cursor rules compliance verified

The validation results will be appended to this plan file in a `## Validation` section.
If a validation section already exists, it will be replaced with updated results.
```

## Example Usage in Plan

```markdown
# Example Plan

## Tasks
- [ ] Task 1: Create service
- [ ] Task 2: Add tests
- [ ] Task 3: Update documentation

## Validation
After completing all tasks, run:
/validate-implementation .cursor/plans/example-plan.plan.md

The validation results will be appended to this plan file in a `## Validation` section.
If a validation section already exists, it will be replaced with updated results.

