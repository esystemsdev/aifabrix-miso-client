---
name: Application status and URLs SDK
overview: Add server-side SDK interfaces in miso-client for (1) updating the current application's status and URLs via POST self/status, and (2) fetching any application's status/URLs via GET application status, aligned with the miso-controller plan 138 (URLs, Keycloak config, and API).
todos: []
isProject: false
---

# Application Status and URLs – Miso Client SDK Plan

## Context

The [miso-controller plan 138](file:///workspace/aifabrix-miso/.cursor/plans/138-urls_keycloak_config_and_api.plan.md) defines two server-side APIs:

1. **POST self/status** – Update *own* application: status and optional `url`, `internalUrl`, `port`. Path: `POST /api/environments/:envKey/applications/self/status` (or `/api/v1/...` per controller implementation). Auth: pipeline/client credentials (x-client-id, x-client-secret).
2. **GET application status** – Return any application’s metadata (id, key, displayName, url, internalUrl, port, status, runtimeStatus, etc.) **without** `configuration`. Path: `GET /api/v1/environments/{envKey}/applications/{appKey}/status`. Same auth (client credentials or bearer).

This plan adds the corresponding **server-side** interfaces in the **miso-client** SDK: API layer, types, optional service, and public API on `MisoClient`. All usage is from Node/Express (server); no browser/Data Client exposure required.

## Prerequisites

- Controller endpoints from plan 138 must be implemented and path/version confirmed (`/api/v1/` vs `/api/`). SDK paths will match the controller’s final routes.

## Rules and Standards

This plan must comply with [Project Rules](.cursor/rules/project-rules.mdc). Applicable sections:

- **[API Layer Pattern](.cursor/rules/project-rules.mdc#architecture-patterns)** – New `ApplicationsApi` with endpoint constants, `HttpClient` injection, `request()` / `requestWithAuthStrategy()`; centralized endpoints; interfaces for request/response.
- **[Architecture Patterns – Service Layer](.cursor/rules/project-rules.mdc#architecture-patterns)** – Optional `ApplicationStatusService` or thin MisoClient wrappers; use `httpClient.config` if needed; dependency injection.
- **[Code Style – TypeScript & Naming](.cursor/rules/project-rules.mdc#code-style)** – Use interfaces (not types) for API types; camelCase for all public API outputs; JSDoc for public methods.
- **[Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions)** – Jest; mock `HttpClient` / `ApiClient`; test file layout mirrors `src/`; ≥80% coverage for new code.
- **[Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards)** – Files ≤500 lines; methods ≤20–30 lines; JSDoc on public APIs.
- **[Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines)** – Auth via client token or provided authStrategy; never expose `clientId`/`clientSecret`.
- **[Error Handling](.cursor/rules/project-rules.mdc#error-handling)** – Use try/catch for async; document when to throw (e.g. missing context) vs return defaults.

**Key requirements**

- Endpoint URLs as `private static readonly` constants in `ApplicationsApi`.
- All request/response interfaces in `applications.types.ts`; camelCase only.
- JSDoc on `updateSelfStatus`, `getApplicationStatus`, `updateMyApplicationStatus`, `getApplicationStatus` (MisoClient).
- Unit tests: mock `HttpClient` for API layer; mock `ApiClient` and `ApplicationContextService` for MisoClient.
- Validation order: BUILD → LINT → TEST before marking done.

## Before Development

- Read API Layer Pattern and Architecture Patterns in project-rules.mdc.
- Review [auth-cache.api.ts](src/api/auth-cache.api.ts) and [logs-create.api.ts](src/api/logs-create.api.ts) for `request()` / `requestWithAuthStrategy()` and endpoint constant patterns.
- Review [ApplicationContextService](src/services/application-context.service.ts) usage in RoleService/PermissionService/LoggerService for default `envKey`/`appKey`.
- Review existing API unit tests in [tests/unit/api/](tests/unit/api/) for mock and assertion patterns.
- Confirm controller path/version from plan 138 before finalizing endpoint constants.

## 1. Types

**New file:** [src/api/types/applications.types.ts](src/api/types/applications.types.ts)

- **UpdateSelfStatusRequest** (interface): optional `status`, `url` (string, URL), `internalUrl` (string, URL), `port` (number 1–65535). All fields optional; at least one typically sent.
- **UpdateSelfStatusResponse** (interface): shape matching controller response (e.g. updated application or success payload); camelCase.
- **ApplicationStatusResponse** (interface): application without `configuration`. Include: `id`, `key`, `displayName`, `url`, `internalUrl`, `port`, `status`, `runtimeStatus`, `environmentId` (or env reference), `createdAt`, `updatedAt` as needed; no `configuration` (or explicitly omitted). CamelCase.

## 2. API layer

**New file:** [src/api/applications.api.ts](src/api/applications.api.ts)

- **ApplicationsApi** class (constructor: `HttpClient`).
- Endpoint constants (align with controller when known):
  - `SELF_STATUS_ENDPOINT = '/api/v1/environments/:envKey/applications/self/status'` (or without `v1` if controller uses `/api/...`).
  - `APPLICATION_STATUS_ENDPOINT = '/api/v1/environments/:envKey/applications/:appKey/status'`.
- **updateSelfStatus(envKey, body, authStrategy?)**  
  - `POST` to `.../environments/{envKey}/applications/self/status` with body `UpdateSelfStatusRequest`.  
  - Use `httpClient.request()` when no authStrategy (client token only, server-side). Support `requestWithAuthStrategy` when `authStrategy` is provided (e.g. bearer or override). Same pattern as [auth-cache.api.ts](src/api/auth-cache.api.ts) / [logs-create.api.ts](src/api/logs-create.api.ts).
- **getApplicationStatus(envKey, appKey, authStrategy?)**  
  - `GET` to `.../environments/{envKey}/applications/{appKey}/status`.  
  - Same auth pattern: `request()` for client credentials only, or `requestWithAuthStrategy` when provided.
- Build URL by replacing `:envKey` / `:appKey` in the constant (no query params for path segments).
- JSDoc for both methods; camelCase in request/response; interfaces from `applications.types.ts`.

**Wire into ApiClient:** [src/api/index.ts](src/api/index.ts)

- Import `ApplicationsApi` and `applications.api`.
- Add `readonly applications: ApplicationsApi` and construct in constructor.

## 3. Application context for “own” app

- **updateMyApplicationStatus** should resolve `envKey` when the caller does not pass it: use [ApplicationContextService](src/services/application-context.service.ts) (e.g. `getApplicationContext().environment`). Same pattern as roles/permissions using context for `environment`/`application`.
- ApplicationContextService is already used by RoleService, PermissionService, LoggerService; it is constructed in [MisoClient](src/index.ts) (or a shared factory). New code will get `envKey` (and optionally `appKey` for “current” app) from context when not provided.

## 4. Public API on MisoClient (server-side)

**In [src/index.ts](src/index.ts):**

- **updateMyApplicationStatus(body, options?)**  
  - Body: `UpdateSelfStatusRequest`. Options: optional `envKey`; if omitted, use `ApplicationContextService.getApplicationContext().environment` (throw or return a clear error if context is missing).  
  - Delegates to `apiClient.applications.updateSelfStatus(envKey, body)`.
- **getApplicationStatus(envKey, appKey, authStrategy?)**  
  - Gets status/URLs for any application by `envKey` and `appKey`.  
  - Delegates to `apiClient.applications.getApplicationStatus(envKey, appKey, authStrategy)`.  
  - Optional overload or optional params: if `envKey`/`appKey` omitted, use context (e.g. “current” app status).

Implementation can be a thin wrapper that reads context and calls `this.apiClient.applications.*`, or a small **ApplicationStatusService** that takes `ApiClient` and `ApplicationContextService` and is used from `MisoClient`. Prefer minimal surface: if only two methods, wiring directly in `MisoClient` is acceptable; otherwise a dedicated service keeps index.ts smaller.

## 5. Exports and docs

- Export new public types from [src/index.ts](src/index.ts) (e.g. `UpdateSelfStatusRequest`, `ApplicationStatusResponse`) if they are part of the public API.
- Add brief JSDoc on `MisoClient.updateMyApplicationStatus` and `MisoClient.getApplicationStatus` (server-side only; auth via client credentials or provided authStrategy).
- Optional: short note in [docs/](docs/) (e.g. configuration or getting-started) that these methods exist for server-side URL/status self-service and for fetching any application’s URLs.

## 6. Tests

- **Unit tests** for `ApplicationsApi`: mock `HttpClient`; assert correct method, path (with `:envKey`/`:appKey` replaced), and body for `updateSelfStatus`; assert GET path for `getApplicationStatus`; test with and without `authStrategy`.
- **Unit tests** for `MisoClient` (or ApplicationStatusService): mock `ApiClient` and ApplicationContextService; assert `updateMyApplicationStatus` uses context when `envKey` not provided and calls `apiClient.applications.updateSelfStatus` with correct args; assert `getApplicationStatus(envKey, appKey)` forwards to API.
- Follow existing patterns in [tests/](tests/) and project rules (mock HttpClient/ApiClient, no snake_case in public API).

## 7. Path alignment with controller

- Plan 138 uses `POST /api/environments/:envKey/applications/self/status` (section 6) and `GET /api/v1/environments/{envKey}/applications/{appKey}/status` (section 6b). If the controller standardizes on `/api/v1/` for both, SDK will use `/api/v1/...` for both; otherwise keep GET as `/api/v1/...` and POST as documented in the controller. Update SDK endpoint constants once controller routes are final.

## Files to add or touch


| Area                                                                       | Action                                                                                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [src/api/types/applications.types.ts](src/api/types/applications.types.ts) | Add interfaces (UpdateSelfStatusRequest, UpdateSelfStatusResponse, ApplicationStatusResponse).                             |
| [src/api/applications.api.ts](src/api/applications.api.ts)                 | New ApplicationsApi with updateSelfStatus, getApplicationStatus.                                                           |
| [src/api/index.ts](src/api/index.ts)                                       | Register ApplicationsApi.                                                                                                  |
| [src/index.ts](src/index.ts)                                               | Add updateMyApplicationStatus, getApplicationStatus; use ApplicationContextService for default envKey/appKey when omitted. |
| [tests/](tests/)                                                           | Unit tests for ApplicationsApi and MisoClient (or ApplicationStatusService).                                               |
| [docs/](docs/)                                                             | Optional short documentation.                                                                                              |


## Definition of done

- **Build**: Run `npm run build` FIRST (must complete successfully – TypeScript compilation).
- **Lint**: Run `npm run lint` (must pass with zero errors/warnings).
- **Test**: Run `npm test` AFTER lint (all tests must pass; ≥80% coverage for new code).
- **Validation order**: BUILD → LINT → TEST (mandatory sequence; do not skip steps).
- **File size**: Files ≤500 lines; methods ≤20–30 lines.
- **JSDoc**: All public methods have JSDoc (parameters and return types).
- Types and API layer implemented; ApplicationsApi registered in ApiClient.
- MisoClient exposes updateMyApplicationStatus and getApplicationStatus; envKey from context when omitted.
- All public request/response use camelCase; JSDoc present.
- Unit tests added; existing tests and lint pass.
- Controller path constants updated if controller uses different base or version.
- Documentation updated as needed (e.g. docs/ or README if exposing new public API).

## Out of scope (this plan)

- Controller implementation (plan 138).
- Browser/Data Client support for these endpoints.
- Caching of application status in the SDK.

---

## Plan Validation Report

**Date**: 2025-02-04  
**Plan**: .cursor/plans/49-application_status_and_urls_sdk.plan.md  
**Status**: VALIDATED

### Plan Purpose

Add server-side SDK support in miso-client for (1) updating the current application's status and URLs via POST self/status, and (2) fetching any application's status/URLs via GET application status, aligned with miso-controller plan 138. Scope: API types, API layer (ApplicationsApi), ApiClient wiring, ApplicationContextService for default envKey/appKey, MisoClient public API (updateMyApplicationStatus, getApplicationStatus), exports, optional docs, and unit tests. **Plan type**: API layer / service development / type definitions.

### Applicable Rules

- [API Layer Pattern](.cursor/rules/project-rules.mdc#architecture-patterns) – New ApplicationsApi, endpoint constants, HttpClient, request/requestWithAuthStrategy.
- [Architecture Patterns – Service Layer](.cursor/rules/project-rules.mdc#architecture-patterns) – Optional service or MisoClient wrappers; ApplicationContextService.
- [Code Style – TypeScript & Naming](.cursor/rules/project-rules.mdc#code-style) – Interfaces, camelCase, JSDoc.
- [Testing Conventions](.cursor/rules/project-rules.mdc#testing-conventions) – Jest, mocks, coverage.
- [Code Quality Standards](.cursor/rules/project-rules.mdc#code-quality-standards) – File/method size, JSDoc.
- [Security Guidelines](.cursor/rules/project-rules.mdc#security-guidelines) – Client token / authStrategy; no exposure of clientId/clientSecret.
- [Error Handling](.cursor/rules/project-rules.mdc#error-handling) – try/catch; document throw vs default behavior.

### Rule Compliance

- DoD requirements: Documented (build, lint, test, order, file size, JSDoc, docs).
- API Layer: Plan aligns with endpoint constants, interfaces, and auth pattern.
- Testing: Plan requires unit tests with mocked HttpClient/ApiClient and context.
- Security: Auth via client credentials or authStrategy only.
- Naming: camelCase and interfaces explicitly required.

### Plan Updates Made

- Added **Rules and Standards** section with links to project-rules.mdc and key requirements.
- Added **Before Development** checklist (read rules, review auth-cache/logs-create API, ApplicationContextService, tests, controller paths).
- Updated **Definition of done** with BUILD → LINT → TEST, npm commands, file size, JSDoc, and documentation.
- Appended this validation report.

### Recommendations

- When implementing, confirm final controller paths from plan 138 and set SELF_STATUS_ENDPOINT / APPLICATION_STATUS_ENDPOINT accordingly.
- Consider adding a short subsection under docs (e.g. configuration or getting-started) describing server-side application status/URL usage.
- Keep MisoClient methods as thin wrappers (context resolution + API call) to avoid bloating index.ts; introduce ApplicationStatusService only if the surface grows.

