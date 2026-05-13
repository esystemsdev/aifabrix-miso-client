---
name: ""
overview: ""
todos: []
isProject: false
---

# Plan 57 — miso-client: URL strategy (prerequisite)

**Repo:** `aifabrix-miso-client` (`@aifabrix/miso-client`)  
**With:** `aifabrix-miso` plan 182 — controller returns **full** URLs + **`loginUrl` / `logoutUrl`**.

---

## Decisions (normative)

### 1. Prefer **full** URLs always

**Good:** `controllerPublicUrl = https://domain.com/miso` (path already in the string).

**Bad:** `origin = https://domain.com` + `basePath = /miso` as the default pattern.

**`basePath`:** only for **rare browser edge cases** where a full public URL truly cannot be supplied. Default integrations must **not** use it.

### 2. One URL join function only

All API URLs use the **same** helper:

```text
joinApiRoot(root, path)
```

- `root` — **full** base URL (may include path, e.g. `https://domain.com/miso`).
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

### 7. Avoid double-prefix

If `controllerPublicUrl` is already `https://domain.com/miso`, **do not** add `basePath` again.

Prefer one config line: **`controllerPublicUrl=https://domain.com/miso`**.

Optional runtime or doc warning if `basePath` is set while `root` already ends with the same path segment.

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
| **Public API root** | **Full URL** passed into miso-client |

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

**DO:** only **`joinApiRoot(root, path)`** with host-supplied **`root`** (full URL, any path). Same code for `/`, `/miso`, `/data`, `/anything`.

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

## Code changes (miso-client)

1. Add **`joinApiRoot`** (+ **`normalizeRootUrl`** if needed) in one module; **unit tests** (slashes, full roots with path, double-prefix guard).
2. Refactor to **`joinApiRoot` only:** `data-client.ts`, `data-client-auth.ts`, `data-client-auto-init.ts`, `internal-http-client.ts`, `client-token-manager.ts`, `data-client-request.ts`.
3. **`data-client-redirect.ts`:** use absolute **`loginUrl` / `logoutUrl`**; resolve legacy path-only values with **`joinApiRoot(controllerPublicUrl, path)`** — never **`new URL('/…', base)`** for API-shaped URLs (see **§2** anti-pattern).
4. **In-app SPA redirects** (non-API): smallest possible helper (e.g. `joinSpaPath`) **or** host-only — must **not** become a second API joiner; prefer full URLs from server where possible.
5. **Types / `DataClientConfigResponse`:** document full **`controllerPublicUrl` / `controllerPrivateUrl`**; optional **`basePath`** deprecated / rare-only in JSDoc.
6. **`sdk-exports`:** export **`joinApiRoot`** (and **`normalizeRootUrl`** if public). No Keycloak helpers.
7. **README + CHANGELOG:** decisions §1–§9, tables, reference config, **generic multi-app** (`/` … `/anything`), semver.
8. **Audit / CI guard:** no string literals such as `/miso`, `/data`, `/myapp` as SDK defaults in URL-join or routing logic (product paths come **only** from configuration).

**Controller (other repo):** client-token / IDE config emits **full** roots + absolute **`loginUrl` / `logoutUrl`**.

---

## Acceptance

- Every SDK-built HTTP URL is `joinApiRoot(root, path)` with a **full** `root` in default setups.
- No hardcoded virtual-directory segments in SDK; any mount (`/`, `/miso`, `/data`, `/anything`) uses the same `joinApiRoot`.
- No Keycloak URL logic in miso-client; login/logout from config only.
- No Front Door / proxy vendor logic.
- `pnpm lint`, `pnpm test`, `pnpm build` pass.

---

## Out of scope

Keycloak admin, Express mount details (plan 182), proxy rule authoring.

---

*Simplified plan: full URLs, one `joinApiRoot`, per-app Vite/Router/API root (§9), miso-client owns API URLs, controller owns auth entry URLs.*
