---
name: ""
overview: "Plan 57 shipped in miso-client 4.13.1 — joinApiRoot URL strategy, optional split roots (controllerBasePath, DataClient basePath), browser path-only controller roots (coerceControllerUrlToAbsolute), tests, docs."
todos:
  - id: plan57-url-strategy
    content: "Plan 57 — URL strategy (joinApiRoot, merge, controllerBasePath, coerce path-only, tests, docs) — DONE"
    status: completed
isProject: false
---

# Plan 57 — miso-client: URL strategy (prerequisite)

**Repo:** `aifabrix-miso-client` (`@aifabrix/miso-client`) **— shipped `4.13.1`**  
**With:** `aifabrix-miso` plan 182 — controller returns **full** URLs + **`loginUrl` / `logoutUrl`**.

---

## Implementation snapshot (what we actually shipped)

| Area | What exists in the repo |
| --- | --- |
| **Single joiner** | `joinApiRoot(root, path)` in `src/utils/url-join.ts` for all backend API path joins. |
| **Root normalization** | `normalizeRootUrl` on axios `baseURL` in `internal-http-client.ts`, `client-token-manager.ts`. |
| **Split origin + path** | `mergeRootUrlWithBasePath` + `normalizeOptionalBasePath` in `url-join.ts`; optional **`controllerBasePath`** on `MisoClientConfig`; optional **`basePath`** on `DataClientConfig` merged once in `createDefaultConfig` (`data-client-init.ts`). |
| **Same-origin controller (browser)** | **`coerceControllerUrlToAbsolute(raw, isBrowser)`** in `controller-url-resolver.ts`: path-only values starting with `/` (not `//`) resolve with `window.location.origin`. **`resolveControllerUrl`** and **`getControllerUrl`** run **coerce → mergeRootUrlWithBasePath → localhost rewrite** (resolver only). Server-side controller URLs remain **full** `http(s)` only. |
| **Consumers** | `data-client-core.ts` (requests), `data-client-auth.ts`, `data-client-auto-init.ts`, `data-client-redirect.ts` (login/logout). `data-client-request.ts` does not call `joinApiRoot` directly; it receives the full URL built in core. |
| **Exports** | `sdk-exports.ts`: `joinApiRoot`, `normalizeRootUrl`, `mergeRootUrlWithBasePath`, `coerceControllerUrlToAbsolute`, `resolveControllerUrl`, `validateUrl`, `isBrowser`, … |
| **Tests** | `tests/unit/url-join.test.ts`, `tests/unit/url-join-integration.test.ts`, `tests/unit/controller-url-resolver.test.ts` (path-only + coerce cases). |
| **Docs / changelog** | `docs/configuration.md`, `dataclient.md`, `troubleshooting.md`, `README.md`; `CHANGELOG.md` **\[4.13.1\]**. |

---

## Decisions (normative)

### 1. Prefer **full** URLs always

**`basePath`** is optional compatibility configuration.

**Preferred setup:**

- Full public URL already contains the application path.
- Example: `https://domain.com/miso`

**Supported fallback:**

- Root URL without path.
- `basePath` adds the application virtual directory.

**Example:**

- **root:** `https://domain.com`
- **basePath:** `/miso`

**SDK normalization** must avoid double-prefixing when root and `basePath` are combined.

Default integrations should still prefer a **single** full public root (path in the URL string) when the host can supply it; use root + `basePath` only when that split is required for compatibility.

### 2. One URL join function only

All API URLs use the **same** helper:

```text
joinApiRoot(root, path)
```

- `root` — **full** base URL (may include path, e.g. `https://domain.com/miso`). If the host supplies split **origin + `basePath`**, miso-client must normalize to one full root per **§1** and **§7** before joining.
- `path` — must start with `/` (e.g. `/api/v1/health`).

**Forbidden:** separate “controller join”, “app join”, “auth join”, or “frontend join” code paths. Controller HTTP, app/dataplane HTTP, and resolving relative paths against a root all go through **`joinApiRoot`** only.

### 3. miso-client owns **all** backend HTTP URLs

Host **frontend** must **not**:

- `fetch(...)` / `axios(...)` to controller or dataplane API for work the SDK already covers  
- `window.location.origin + ...` for API bases  

Everything that hits configured backends goes **through miso-client** (or the single exported `joinApiRoot` where the host has no higher-level API yet). *Exception:* Vite dev-only noise is not product HTTP.

### 4. Vite = frontend only

**Vite:** `base` for **static assets**; **React Router:** `basename` for **in-app routes**.

Vite is **not** involved in backend URL generation and must not be referenced inside miso-client.

### 5. No reverse-proxy product logic

Front Door, nginx, etc. are **ordinary proxies**. The SDK has **no** Front Door–specific branches, feature flags, or documentation that implies special-casing a vendor.

### 6. No Keycloak inside the SDK

miso-client consumes **only** controller-provided:

- **`loginUrl`**
- **`logoutUrl`**

(absolute URLs preferred). **No** Keycloak URL construction, realm URLs, or `VITE_KEYCLOAK_*` in the SDK contract.

### 7. Normalize virtual directory paths safely

If the root already contains the virtual directory:

- **Do not** add `basePath` again (same segment must not be applied twice).

If the root does not contain the virtual directory:

- **`basePath` may append** the application virtual directory to the origin.

**Examples:**

| root | basePath | result |
| ---- | -------- | ------ |
| `https://domain.com/miso` | `/miso` | `https://domain.com/miso` (no double `/miso/miso`) |
| `https://domain.com` | `/miso` | `https://domain.com/miso` |

Prefer one full-root string when possible: **`controllerPublicUrl=https://domain.com/miso`**. Optional runtime or doc warning if `basePath` is set while `root` already ends with the same path segment as `basePath`.

### 8. Target architecture (one strategy)

| Layer | Tool / owner |
| ----- | ------------- |
| **Static assets + in-app routes** | Vite `base`, React Router `basename` (host app) |
| **Backend / API HTTP** | miso-client + **`joinApiRoot`** only |
| **Auth entry (browser)** | Controller-supplied **`loginUrl` / `logoutUrl`** |

### 9. Dataplane and custom apps — each app’s own virtual directory (generic)

Every product (miso-controller UI, dataplane, custom SPA) can be mounted at **any** public path: `/`, `/miso`, `/data`, `/myapp`, `/anything`. **miso-client stays generic:** no hardcoded path segments, no controller-only assumptions inside join helpers.

**Per application** the host configures three **independent** values:

| Concern | Host configures |
| ------- | ----------------- |
| **Static assets** | Vite `base` (e.g. `/miso/`, `/data/`, `/`) |
| **In-app routes** | React Router `basename` (aligned with that app’s deploy) |
| **Public API root** | **Full URL** passed into miso-client, **or** (browser controller only) a **path-only** root such as `"/miso"` resolved via **`coerceControllerUrlToAbsolute`** + `window.location.origin` |

**Examples (deploy-specific — not SDK constants):**

| App | Example public API `root` |
| --- | ------------------------- |
| Controller | `https://domain.com/miso` |
| Dataplane | `https://domain.com/data` |
| Custom | `https://domain.com/myapp` |

**Target API shape** (final names may map to `MisoClient` / `DataClient` or thin factories — behavior must match):

```ts
// Two clients, two full roots, same joinApiRoot inside each
createMisoClient({
  controllerPublicUrl: "https://domain.com/miso",
});

createApplicationClient({
  apiRoot: "https://domain.com/data",
});
```

A custom app uses `apiRoot: "https://domain.com/myapp"` the same way. Root `https://domain.com` (mount at `/`) uses the **same** mechanism with a different string.

**DO NOT** in miso-client: hardcode `/miso`, `/data`, `/myapp`, or any product path; special-case controller vs dataplane inside **`joinApiRoot`**; branch on application **name** for URL building.

**DO:** only **`joinApiRoot(root, path)`** with host-supplied **`root`** that is **absolute** after config resolution (full `http(s)` URL, or browser path-only controller root expanded by **`coerceControllerUrlToAbsolute`**). Same code for `/`, `/miso`, `/data`, `/anything`.

---

## Two roots, one joiner (no drift)

| Use | Example `root` | `path` |
| --- | ---------------- | ------ |
| **Controller API** | `https://domain.com/miso` (public) or `http://miso-controller:3000` (private) | `/api/v1/...`, `/api/ide/...` (SDK constants) |
| **Own backend** (dataplane, custom, …) | e.g. `https://domain.com/data`, `https://domain.com/myapp`, or `https://domain.com` | App-defined `/api/...` (joined only to **that** app’s `root`) |

Two backends ⇒ **two client instances** (or two roots), **`joinApiRoot` twice** — never a second string-concat style.

---

## Reference config (illustrative)

**Dataplane host (example)**

- Controller client: public `https://domain.com/miso`, private `http://miso-controller:3000`.
- Dataplane API client: `apiRoot` / `root` = `https://domain.com/data`.

**Custom app (example)**

- `apiRoot` = `https://domain.com/myapp`.

**miso-controller (miso-ui)** — same process for UI + API: that app’s public **`root`** is whatever deploy exposes (e.g. `https://domain.com/miso` or `https://domain.com/`); private URL is a **full** internal URL. No path literals in the SDK.

All apps use the **same** `joinApiRoot` implementation.

---

## Code changes (miso-client) — as implemented

1. **`src/utils/url-join.ts`** — `joinApiRoot`, `normalizeRootUrl`, `isDoublePrefix`, `mergeRootUrlWithBasePath`, `normalizeOptionalBasePath`; unit tests in `tests/unit/url-join.test.ts`; integration tests in `tests/unit/url-join-integration.test.ts`.
2. **Refactor to `joinApiRoot`:** `data-client-core.ts`, `data-client-auth.ts`, `data-client-auto-init.ts`, `data-client-redirect.ts`, `internal-http-client.ts`, `client-token-manager.ts`. (`data-client.ts` is the façade module; request execution stays in `data-client-request.ts` using URLs already joined in core.)
3. **`data-client-redirect.ts`** — absolute `loginUrl` / `logoutUrl` when full URLs; path-only legacy values joined with **`joinApiRoot`** against the resolved controller root (not `new URL('/…', base)` for API paths).
4. **SPA / non-API redirects** — no second API joiner in the SDK; host-owned or minimal helpers only.
5. **Types / JSDoc** — `MisoClientConfig` (`controllerBasePath`, path-only browser controller URL docs); `DataClientConfig.basePath`; `DataClientConfigResponse` / client-token endpoint: full URL fields; server JSON still has **no** `basePath` field.
6. **`src/utils/controller-url-resolver.ts`** — `coerceControllerUrlToAbsolute`; `resolveControllerUrl`: coerce → `mergeRootUrlWithBasePath` → localhost normalization.
7. **`sdk-exports.ts`** — exports `joinApiRoot`, `normalizeRootUrl`, `mergeRootUrlWithBasePath`, `coerceControllerUrlToAbsolute` (and existing resolver exports).
8. **Docs + `CHANGELOG.md`** — URL strategy, double-prefix, optional split + path-only browser controller; release **4.13.1**.
9. **Guardrail** — no hardcoded `/miso` / `/data` / `/myapp` defaults in URL-join logic; paths come from config / caller only.

**Controller (other repo):** client-token / IDE config should still emit **full** roots + absolute **`loginUrl` / `logoutUrl`** where possible; the SDK additionally tolerates **browser** path-only controller roots for same-origin apps.

---

## Acceptance

- Every SDK-built HTTP URL is `joinApiRoot(root, path)` with an **absolute** `root` after resolution: full `http(s)` URL, **or** (browser controller config) path-only + `coerceControllerUrlToAbsolute`. Optional **`controllerBasePath`** / DataClient **`basePath`** merge without double-prefix (§1, §7).
- No hardcoded virtual-directory segments in SDK; any mount (`/`, `/miso`, `/data`, `/anything`) uses the same `joinApiRoot`.
- No Keycloak URL logic in miso-client; login/logout from config only.
- No Front Door / proxy vendor logic.
- `pnpm lint`, `pnpm test`, `pnpm build` pass.

---

## Out of scope

Keycloak admin, Express mount details (plan 182), proxy rule authoring.

---

## Plan delivery checklist

Evidence-backed completion for **Code changes (miso-client)** and acceptance:

- [x] **1.** `src/utils/url-join.ts` — `joinApiRoot`, `normalizeRootUrl`, `isDoublePrefix`, `mergeRootUrlWithBasePath`, `normalizeOptionalBasePath`; `tests/unit/url-join.test.ts`, `tests/unit/url-join-integration.test.ts`.
- [x] **2.** `joinApiRoot` / `normalizeRootUrl` wired through `data-client-core.ts`, `data-client-auth.ts`, `data-client-auto-init.ts`, `internal-http-client.ts`, `client-token-manager.ts`; `data-client-request.ts` uses URLs produced in core (no duplicate joiner).
- [x] **3.** `data-client-redirect.ts` — login/logout URL construction via `joinApiRoot` where path-only legacy values are resolved against the controller root.
- [x] **4.** No second API joiner in SDK; SPA redirect guidance unchanged (host / minimal helper).
- [x] **5.** Types / JSDoc — `config.types.ts` (`controllerBasePath`, browser path-only controller docs); `data-client.types.ts` (`basePath`); `express/client-token-endpoint.ts` (`DataClientConfigResponse` full URLs; server payload still no `basePath` field).
- [x] **6.** `src/utils/controller-url-resolver.ts` — `coerceControllerUrlToAbsolute`, `resolveControllerUrl` (coerce → merge → localhost); `getControllerUrl` in `data-client-auth.ts` aligned.
- [x] **7.** `sdk-exports.ts` — exports `joinApiRoot`, `normalizeRootUrl`, `mergeRootUrlWithBasePath`, `coerceControllerUrlToAbsolute`, resolver utilities.
- [x] **8.** `docs/configuration.md`, `docs/dataclient.md`, `docs/troubleshooting.md`, `docs/README.md`, `CHANGELOG.md` (**4.13.1**).
- [x] **9.** No hardcoded `/miso`/`/data`/`/myapp` defaults in `url-join` (paths from config/constants only).

---

## Validation Report

**Date**: 2026-05-14  
**Status**: ✅ COMPLETE

### Executive Summary

All plan **Code changes** items are implemented in `aifabrix-miso-client` **4.13.1** with matching tests and documentation. Optional split roots (`controllerBasePath`, DataClient `basePath`), **`mergeRootUrlWithBasePath`**, and **browser path-only controller roots** via **`coerceControllerUrlToAbsolute`** are in production code and reflected below.

### Task Completion

- Total: 9 (numbered code changes as implemented)
- Completed: 9
- Incomplete: 0

### Task State Synchronization

- ✅ Markdown delivery checklist added and fully checked (plan had no prior `- [ ]` task list).
- ✅ Frontmatter `todos` set to one **completed** entry (`plan57-url-strategy`).
- ✅ No contradictions between checklist and acceptance criteria.

### File and Implementation Validation

- ✅ `src/utils/url-join.ts` exists with `joinApiRoot`, `normalizeRootUrl`, `mergeRootUrlWithBasePath`, `normalizeOptionalBasePath`, `isDoublePrefix`.
- ✅ Consumers: `data-client-core.ts`, `data-client-auth.ts`, `data-client-auto-init.ts`, `data-client-redirect.ts`, `internal-http-client.ts`, `client-token-manager.ts` use URL helpers as designed.
- ✅ `src/utils/controller-url-resolver.ts` — `coerceControllerUrlToAbsolute`, `resolveControllerUrl` (**coerce → mergeRootUrlWithBasePath → localhost**).
- ✅ `src/utils/data-client-init.ts` merges `basePath` into `baseUrl` in `createDefaultConfig`.
- ✅ `src/utils/data-client-auth.ts` — `getControllerUrl` uses coerce + merge (aligned with resolver).
- ✅ `src/sdk-exports.ts` exports URL helpers including **`coerceControllerUrlToAbsolute`**.
- ✅ Docs and `CHANGELOG.md` (release **4.13.1**) updated for URL strategy, split roots, and path-only browser controller.

### Automated Tests Validation

- ✅ `tests/unit/url-join.test.ts` and `tests/unit/url-join-integration.test.ts` cover join, normalize, merge, and integration flows.
- ✅ `tests/unit/controller-url-resolver.test.ts` covers `coerceControllerUrlToAbsolute`, path-only browser `resolveControllerUrl`, and server rejection of path-only roots.
- ✅ Full Jest suite passes (see Quality Gates).

### Quality Gates

- ✅ `pnpm run tests:typecheck:silent` — log `.temp/validation/00-tests-typecheck`
- ✅ `pnpm run build:silent` — log `.temp/validation/01-build`
- ✅ `pnpm run fmt:silent` — log `.temp/validation/02-fmt`
- ✅ `pnpm run md:lint:silent` — log `.temp/validation/03-md-lint` (no `md:fix` required)
- ✅ `pnpm run lint:silent` (0 errors, 0 warnings) — log `.temp/validation/05-lint` (no `lint:fix` required)
- ✅ `pnpm run test:silent` — log `.temp/validation/06-test`

### Rules Compliance

- ✅ **SDK token/header policy** — unchanged; URL work does not alter `x-client-token` / Bearer behavior.
- ✅ **Service / Redis / async patterns** — not regressed by URL changes (spot-check: resolver + DataClient init only).
- ✅ **RFC 7807 / security / camelCase** — URL utilities are internal/config-facing; no new snake_case public API fields on responses.

### Logs

- Full logs: `.temp/validation/*` (see `00-tests-typecheck` … `06-test`).

### Issues and Recommendations

- None blocking. Normative sections and checklist above match the **4.13.1** tree (`data-client-core.ts` as the primary DataClient implementation module alongside `data-client.ts` exports).

### Final Checklist

- [x] All tasks implemented and synchronized
- [x] Files and tests validated
- [x] Quality gates passed in strict order
- [x] Rules compliance verified

---

*Shipped in **4.13.1**: full URLs, optional split `controllerBasePath` / DataClient `basePath`, browser path-only controller roots via `coerceControllerUrlToAbsolute`, safe virtual-directory normalization (§7), one `joinApiRoot`, per-app Vite/Router/API root (§9), miso-client owns API URLs, controller owns auth entry URLs.*
