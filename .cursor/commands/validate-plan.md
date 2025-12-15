# validate-plan

Validate a plan file before execution by identifying its purpose, reading relevant rules, validating rule scope, updating the plan with rule references, and ensuring Definition of Done (DoD) requirements are documented.

## Purpose

This command ensures that:

1. Plans are validated against relevant rules before execution
2. Plan authors understand which rules apply to their plan
3. Plans include proper DoD requirements (build → lint → test)
4. Plans reference relevant rule files for guidance
5. Plans are production-ready before implementation begins

## Usage

```bash
/validate-plan [plan-file-path]
```

**Parameters**:

- `plan-file-path` (optional): Path to the plan file to validate. If not specified:
  - First checks if there's a current chat plan (from `mcp_create_plan` tool or recent conversation)
  - If no current plan, lists recent plans from `.cursor/plans/` and asks user to select
  - If still unclear, prompts user for clarification

**Examples**:

- `/validate-plan` - Validates current chat plan or prompts for plan selection
- `/validate-plan .cursor/plans/18-public_and_private_controller_url_support.plan.md` - Validates a specific plan

## Execution Steps

### Step 1: Plan File Resolution

**Logic**:

1. If `plan-file-path` provided: Use that file directly
2. If empty: Check for current chat plan context
   - Look for plan file references in recent conversation messages
   - Check if `mcp_create_plan` was recently called (check conversation history)
   - If found, use that plan file path
3. If still empty: List recent plans from `.cursor/plans/` directory
   - Sort by modification time (most recent first)
   - Show last 5-10 plans with their titles
   - Ask user to select one or provide a path
4. If unclear: Ask user to specify the plan file path explicitly

**Implementation**:

- Read plan file from resolved path
- Validate file exists and is readable
- Parse markdown structure
- If file doesn't exist, report error and ask for correct path

### Step 2: Identify Plan Purpose

**Analysis**:

1. Read plan file content completely
2. Extract from plan:
   - **Title**: Main title from `# Title` (first H1)
   - **Overview**: Content from `## Overview` section
   - **Scope**: What areas are affected (services, HTTP client, Redis, Express middleware, types, utilities, authentication, authorization, logging, etc.)
   - **Key Components**: Files, modules, services, utilities mentioned in plan
   - **Type**: Classify as one of:
     - Architecture (structure, design, patterns)
     - Service Development (auth service, roles service, permissions service, logger service)
     - HTTP Client (HTTP client, interceptors, token management)
     - Express Utilities (middleware, Express.js utilities)
     - Infrastructure (Redis service, configuration, data processing)
     - Refactoring (code improvements, restructuring)
     - Testing (test additions, test improvements)
     - Documentation (docs, guides)
     - Security (ISO 27001 compliance, token handling, data masking)
     - Type Definitions (TypeScript types, interfaces)

**Keywords to Detect**:

- **Services**: "service", "AuthService", "RolesService", "PermissionsService", "LoggerService", "src/services/"
- **HTTP Client**: "HttpClient", "http-client", "axios", "interceptor", "client token", "x-client-token"
- **Express**: "express", "middleware", "ExpressMiddleware", "src/express/"
- **Redis**: "redis", "RedisService", "cache", "caching", "ioredis"
- **Authentication**: "auth", "login", "logout", "token", "JWT", "Bearer token"
- **Authorization**: "roles", "permissions", "authorization"
- **Logging**: "logger", "logging", "audit log", "ISO 27001"
- **Types**: "types", "interface", "TypeScript", "src/types/"
- **Security**: "ISO 27001", "security", "compliance", "data masking", "secret"
- **Infrastructure**: "config", "configuration", "Redis", "environment variables"

**Output**:

- Plan purpose summary (1-2 sentences)
- Affected areas list (services, HTTP client, Express, Redis, types, etc.)
- Plan type classification
- Key components mentioned

### Step 3: Read Rules and Identify Scope

**Rule File** (from `.cursor/rules/`):

- **`project-rules.mdc`** - Single comprehensive rule file containing:
  - Project Overview - Technologies and architecture
  - Architecture Patterns - Service layer, HTTP client pattern, token management, API endpoints, JWT handling, Redis caching
  - Code Style - TypeScript conventions, naming conventions, error handling, async/await
  - Testing Conventions - Jest patterns, test structure, coverage, mock patterns
  - Security & Compliance (ISO 27001) - Data protection, secret management, audit logging
  - Code Quality Standards - File size limits, documentation, JSDoc
  - File Organization - Source structure, import order, export strategy
  - Configuration - Config types, environment variables
  - Common Patterns - Service method pattern, logger chain pattern, client token fetch pattern
  - Security Guidelines - Token handling, data masking, credential protection
  - Performance Guidelines - Redis caching, connection pooling, fallback patterns
  - Code Size Guidelines - File size limits, method size limits
  - Dependencies - Axios, jsonwebtoken, ioredis, dotenv

**Rule Mapping Logic**:

- **Service changes** → Architecture Patterns (Service Layer), Code Style, Testing Conventions, Common Patterns (Service Method Pattern)
- **HTTP Client changes** → Architecture Patterns (HTTP Client Pattern, Token Management), Security Guidelines
- **Express changes** → Architecture Patterns, Code Style, Testing Conventions
- **Redis changes** → Architecture Patterns (Redis Caching Pattern), Performance Guidelines
- **Authentication/Authorization changes** → Architecture Patterns (API Endpoints, JWT Handling), Security Guidelines
- **Logging changes** → Architecture Patterns (Logger Chain Pattern), Security & Compliance (ISO 27001)
- **Type changes** → Code Style (TypeScript Conventions), File Organization
- **Security changes** → Security & Compliance (ISO 27001), Security Guidelines
- **All plans** → Code Quality Standards (MANDATORY), Testing Conventions (MANDATORY), Security Guidelines (MANDATORY)

**Implementation**:

1. Read the rule file `.cursor/rules/project-rules.mdc` completely
2. Based on plan scope, identify relevant sections:
   - Keywords matching (e.g., plan mentions "service" → Service Layer section)
   - Component matching (e.g., plan mentions "HttpClient" → HTTP Client Pattern section)
   - Type matching (e.g., plan type is "Security" → Security Guidelines section)
   - Always include Code Quality Standards, Testing Conventions, and Security Guidelines (mandatory)
3. For each applicable section, extract:
   - Section name
   - Why it applies (brief reason based on plan content)
   - Key requirements from section (read section and extract main points)

**Key Requirements Extraction**:

- Read each applicable section from the rule file
- Extract main requirements, checklists, critical policies
- Summarize in 2-3 bullet points per section
- Focus on actionable requirements

### Step 4: Validate Rule Compliance

**Validation Checks**:

1. **DoD Requirements** (from Code Quality Standards and Testing Conventions):
   - ✅ Build step documented (`npm run build` - runs TypeScript compilation)
   - ✅ Lint step documented (`npm run lint` - must run and pass with zero errors)
   - ✅ Test step documented (`npm test` - all tests must pass)
   - ✅ Validation order specified (BUILD → LINT → TEST)
   - ✅ Zero warnings/errors requirement mentioned
   - ✅ Mandatory sequence documented (never skip steps, build must succeed first)
   - ✅ Test coverage ≥80% requirement mentioned (for new code)
   - ✅ File size limits mentioned (files ≤500 lines, methods ≤20-30 lines)
   - ✅ JSDoc documentation requirement mentioned

2. **Plan-Specific Rules**:
   - Check if plan addresses key requirements from applicable rule sections
   - Identify missing rule references in plan
   - Identify potential violations based on rule requirements
   - Check if plan mentions rule-specific patterns (e.g., JSDoc for functions, try-catch for async, Redis connection checks)
   - Check for security requirements (no hardcoded secrets, ISO 27001 compliance, data masking)

**Output**:

- List of applicable rule sections with compliance status
- Missing requirements checklist
- Recommendations for plan improvement

### Step 5: Update Plan with Rule References

**Plan Updates**:

1. **Add or update `## Rules and Standards` section**:
   - Reference the main rule file: `.cursor/rules/project-rules.mdc`
   - List all applicable sections with brief descriptions
   - Format: `- **[Section Name](.cursor/rules/project-rules.mdc#section-name)** - [Brief description]`
   - Explain why each section applies (1 sentence)
   - Add "Key Requirements" subsection with bullet points from each section

2. **Add or update `## Definition of Done` section**:
   - Build requirement: `npm run build` (must run FIRST, must succeed - runs TypeScript compilation)
   - Lint requirement: `npm run lint` (must run and pass with zero errors/warnings)
   - Test requirement: `npm test` (must run AFTER lint, all tests must pass, ≥80% coverage for new code)
   - Validation order: BUILD → LINT → TEST (mandatory sequence, never skip steps)
   - File size limits: Files ≤500 lines, methods ≤20-30 lines
   - JSDoc documentation: All public functions must have JSDoc comments
   - Code quality: All rule requirements met
   - Security: No hardcoded secrets, ISO 27001 compliance, proper token handling
   - Redis: Check `redis.isConnected()` before Redis operations, fallback to controller
   - Error handling: Return empty arrays `[]` on service method errors, use try-catch for async
   - All tasks completed

3. **Add or update `## Before Development` section**:
   - Checklist of rule compliance items
   - Prerequisites from rules (e.g., "Read project-rules.mdc")
   - Validation requirements
   - Rule-specific preparation steps
   - Review existing similar implementations for patterns

**Update Strategy**:

- If section exists: Update/merge with new information (preserve existing content, add missing items)
- If section missing: Add new section at appropriate location (after Overview, before Tasks)
- Preserve existing content where possible
- Use consistent markdown formatting
- Add rule links using anchor links: `.cursor/rules/project-rules.mdc#section-name`

**Section Order** (if creating new sections):

1. Overview
2. Rules and Standards (add here)
3. Before Development (add here)
4. Definition of Done (add here)
5. Tasks/Implementation (existing)

### Step 6: Generate Validation Report

**Report Structure**:

```markdown
## Plan Validation Report

**Date**: [YYYY-MM-DD]
**Plan**: [plan-file-path]
**Status**: ✅ VALIDATED / ⚠️ NEEDS UPDATES / ❌ INCOMPLETE

### Plan Purpose

[Summary of plan purpose, scope, and type]

### Applicable Rules

- ✅ [Section Name](.cursor/rules/project-rules.mdc#section-name) - [Why it applies]
- ✅ [Section Name](.cursor/rules/project-rules.mdc#section-name) - [Why it applies]
- ⚠️ [Section Name](.cursor/rules/project-rules.mdc#section-name) - [Why it applies] (missing from plan)

### Rule Compliance

- ✅ DoD Requirements: Documented
- ✅ [Section Name]: Compliant
- ⚠️ [Section Name]: Missing [requirement]

### Plan Updates Made

- ✅ Added Rules and Standards section
- ✅ Updated Definition of Done section
- ✅ Added Before Development checklist
- ✅ Added rule references: [list of sections added]

### Recommendations

- [List of recommendations for plan improvement]
- [Any missing requirements]
- [Any potential issues]
```

**Status Determination**:

- ✅ **VALIDATED**: All DoD requirements present, all applicable rules referenced, plan is production-ready
- ⚠️ **NEEDS UPDATES**: DoD requirements present but some rules missing or incomplete
- ❌ **INCOMPLETE**: Missing critical DoD requirements or major rule violations

**Output Modes**:

1. **Attach to Plan** (default): Append validation report to plan file at the end
2. **Separate Report**: Create `.cursor/plans/<plan-name>-VALIDATION.md` (if user requests)

## Integration with Existing Commands

**Relationship to Other Commands**:

- **`/validate-code`**: Validates code after implementation (code quality, rule compliance)
- **`/validate-implementation`**: Validates plan execution (tasks completed, files exist, tests pass)
- **`/validate-plan`**: Validates plan before execution (rule compliance, DoD requirements) - **NEW**

**Workflow**:

1. Create plan → `/validate-plan` (validate plan structure and rule compliance)
2. Implement plan → Code changes
3. `/validate-code` (validate code quality and rule compliance)
4. `/validate-implementation` (validate plan completion and test coverage)

## DoD Requirements (Mandatory)

Every plan must include these requirements in the Definition of Done section:

1. **Build Step**: `npm run build` (must run FIRST, must complete successfully - runs TypeScript compilation)
2. **Lint Step**: `npm run lint` (must run and pass with zero errors/warnings)
3. **Test Step**: `npm test` (must run AFTER lint, all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, methods ≤20-30 lines
6. **JSDoc Documentation**: All public functions must have JSDoc comments
7. **Code Quality**: Code quality validation passes
8. **Security**: No hardcoded secrets, ISO 27001 compliance, proper token handling
9. **Redis**: Check `redis.isConnected()` before Redis operations, fallback to controller
10. **Error Handling**: Return empty arrays `[]` on service method errors, use try-catch for async
11. **Rule References**: Links to applicable sections from `.cursor/rules/project-rules.mdc`
12. **All Tasks Completed**: All plan tasks marked as complete

## Example Plan Updates

### Before Validation

```markdown
# Example Plan

## Overview

Create a new service for user management.

## Tasks

- [ ] Create service
- [ ] Add tests
```

### After Validation

```markdown
# Example Plan

## Overview

Create a new service for user management.

## Rules and Standards

This plan must comply with the following rules from [Project Rules](.cursor/rules/project-rules.mdc):

- **[Architecture Patterns - Service Layer](.cursor/rules/project-rules.mdc#architecture-patterns)** - Service structure, dependency injection, configuration access
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** - File size limits, documentation, JSDoc requirements
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** - Jest patterns, test structure, coverage requirements
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** - Token handling, data masking, credential protection
- **[Error Handling](.cursor/rules/project-rules.mdc#error-handling)** - Return empty arrays on errors, use try-catch for async

**Key Requirements**:

- Services receive `HttpClient` and `RedisService` as dependencies
- Services use `httpClient.config` (public readonly property) for configuration access
- Always check `redis.isConnected()` before Redis operations
- Return empty arrays `[]` on service method errors
- Use try-catch for all async operations
- Write tests with Jest, mock all external dependencies
- Add JSDoc comments for all public functions
- Keep files ≤500 lines and methods ≤20-30 lines
- Never expose `clientId` or `clientSecret` in client code
- Use camelCase for all public API outputs

## Before Development

- [ ] Read Architecture Patterns - Service Layer section from project-rules.mdc
- [ ] Review existing services for patterns (AuthService, RolesService, etc.)
- [ ] Review error handling patterns
- [ ] Understand testing requirements and mock patterns
- [ ] Review JSDoc documentation patterns
- [ ] Review Redis caching patterns

## Definition of Done

Before marking this plan as complete, ensure:

1. **Build**: Run `npm run build` FIRST (must complete successfully - runs TypeScript compilation)
2. **Lint**: Run `npm run lint` (must pass with zero errors/warnings)
3. **Test**: Run `npm test` AFTER lint (all tests must pass, ≥80% coverage for new code)
4. **Validation Order**: BUILD → LINT → TEST (mandatory sequence, never skip steps)
5. **File Size Limits**: Files ≤500 lines, methods ≤20-30 lines
6. **JSDoc Documentation**: All public functions have JSDoc comments
7. **Code Quality**: All rule requirements met
8. **Security**: No hardcoded secrets, ISO 27001 compliance, proper token handling
9. **Redis**: Check `redis.isConnected()` before Redis operations, fallback to controller
10. **Error Handling**: Return empty arrays `[]` on service method errors, use try-catch for async
11. All tasks completed
12. Service follows all standards from Architecture Patterns section
13. Tests have proper coverage (≥80%) and mock all dependencies
14. All public API outputs use camelCase (no snake_case)

## Tasks

- [ ] Create service
- [ ] Add tests
- [ ] Run build → lint → test validation
```

## Success Criteria

- ✅ Plan purpose identified correctly
- ✅ Applicable rule sections identified and referenced
- ✅ DoD requirements documented
- ✅ Plan updated with rule references
- ✅ Validation report generated
- ✅ Plan ready for production implementation

## Notes

- **Rule Reading**: Always read the rule file completely to extract accurate requirements
- **Plan Preservation**: Preserve existing plan content when updating sections
- **Mandatory Sections**: Code Quality Standards, Testing Conventions, and Security Guidelines are mandatory for ALL plans
- **Rule Links**: Use anchor links for rule file sections (`.cursor/rules/project-rules.mdc#section-name`)
- **DoD Order**: Always document validation order as BUILD → LINT → TEST
- **Status**: Report status accurately based on compliance level
- **Project-Specific**: This is a TypeScript SDK project, adapt scope detection accordingly
- **SDK Patterns**: Focus on service layer, HTTP client, Redis caching, Express utilities, and TypeScript conventions
