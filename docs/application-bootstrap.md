# Initialize application secrets

The Node-only `initSecrets()` helper initializes a Miso client and secret accessor.
Remote startup uses Miso client ID and secret to obtain a client token, then fetches
the application's configuration from Miso. The SDK is independent of cloud providers.

```typescript
import { initSecrets } from "@aifabrix/miso-client/bootstrap";

const runtime = await initSecrets();
const databaseUrl = runtime.secrets.require("DATABASE_URL");
// Construct your database client after initialization; never log databaseUrl.
await runtime.close();
```

Move import-time secret reads behind this startup boundary. Business calls use
`runtime.client`. Existing `new MisoClient(config)` and `loadConfig()` callers
continue to work.

## Local configuration

Leave `MISO_AUTH_MODE` unset or set it to `local`. The helper uses the existing config
loader and Miso authentication without calling the snapshot endpoint. Existing
controllers remain supported. Set `MISO_CLIENTID`, `MISO_CLIENTSECRET` and
`MISO_CONTROLLER_URL`; underscore aliases `MISO_CLIENT_ID` and `MISO_CLIENT_SECRET`
are supported. Existing process environment values win over dotenv defaults.
Local secrets are a startup snapshot; reinitialize to pick up edits.
Local context is `undefined`, never derived from editable environment claims.

## Remote configuration

Supply these settings through the deployment environment:

```dotenv
MISO_AUTH_MODE=client-credentials
MISO_CONTROLLER_URL=https://your-installation.example/miso
MISO_CLIENTID=your-application-client-id
MISO_CLIENTSECRET=<injected-by-your-secret-delivery-system>
```

Remote mode does not load `.env`. Non-underscore credential names take precedence
when both aliases are nonempty. Mode selection occurs before any local dotenv
loading. Unknown modes fail immediately; failures never downgrade to local mode.
Use `initSecrets()` without options; no external identity provider is accepted.

The first request exchanges credentials at `POST /api/v1/auth/token` using
`x-client-id` and `x-client-secret`. Miso responds with HTTP 201 and
`data.token`, `data.expiresIn`, `data.expiresAt`. Next, the SDK sends
`{ "protocolVersion": 1 }` to `POST /api/v1/auth/bootstrap` with `x-client-token`.
The HTTP 200 snapshot supplies trusted context, configuration and a new client token.
All subsequent snapshot refreshes and normal Miso calls use client tokens.
Credentials are never copied into the remote runtime's client configuration.

The controller URL must use HTTPS, with no userinfo, query or fragment. Paths such
as `/miso` are preserved. Both endpoints are pinned before startup; redirects and
normal-runtime foreign-origin/authentication overrides are refused. Each HTTP
operation has at most three attempts, five seconds per attempt and a 1 MiB response
cap. Initial grant plus snapshot share a 30-second deadline. Only network failures
and 429/502/503/504 responses are retried; Retry-After above ten seconds fails safely.

## Refresh, rotation and recovery

Snapshots fix refreshAfter at issuedAt +120 seconds, advertised token expiry at
+300 seconds and configuration expiry at +900 seconds. Refresh runs at 110–120
seconds and concurrent work is coalesced. Token and configuration use independent
30-second early deadlines with monotonic clock protection.

Healthy refresh uses the latest accepted snapshot token and never re-reads the
client secret. Rotating that secret does not interrupt a healthy session; updating
configuration takes effect after a successful snapshot refresh. Initial credential
delivery still belongs to deployment tooling.

A snapshot 401/403, malformed response or changed context permanently invalidates
the runtime. There is no automatic credential grant after denial. Close the runtime,
correct the underlying problem, and explicitly initialize a new runtime using
current deployment credentials. Reloading a stale process environment may require
a process restart.

Transient failures retain only still-valid state. Once the snapshot token reaches
its early deadline or is explicitly rejected as expired, the SDK stops sending it
and does not mint another token. Secret reads remain valid until their independent
deadline. Recovery then requires explicit reinitialization. This intentionally
avoids continuing an authenticated session with stale credentials after an outage.

Normal API failures invalidate state only for the controller's recognized typed
session-denial codes; ordinary user/permission failures are not session revocation.
An explicit token-expired response blocks reuse of that token. Failed operations
are never replayed. Actual server token lifetime, error codes and application
revocation enforcement must be verified with the deployed controller; an SDK's
advertised expiry does not revoke server tokens.

## Secret access and cleanup

`get(name)` returns `undefined` only for an absent optional value in a valid runtime.
`require(name)` rejects absent or empty values. Both reject invalid or closed state.
Never serialize or log returned credentials. The SDK does not persist remote values
to environment, disk or Redis. Credentials already supplied in the process
environment remain there; the helper does not erase deployment inputs.

```typescript
const unsubscribe = runtime.onSecretsChanged((names) => {
  // Rebuild affected application-owned connections using runtime.secrets.
  // Notifications contain names only, never values.
});
const stop = runtime.onInvalidated((reason) => {
  // Stop application-owned connections and mark readiness unavailable.
});
unsubscribe();
stop();
await runtime.close();
```

Listeners run synchronously; their errors are suppressed without logging sensitive
messages. Local mode has no background secret-change events. Close is awaitable,
idempotent, cancels refresh and disables subsequent SDK requests. It cannot revoke
copied database credentials or cancel requests already sent.

## Contract validation and migration

`validateSnapshot` and the `BootstrapSnapshot` type are exported from
`@aifabrix/miso-client/bootstrap` for controller contract tests. Validate the response's
`data` field at a matching test clock; the validator checks freshness. Browser imports
of this entrypoint are blocked; ordinary root imports remain separate.

Deployments migrating from an earlier bootstrap provider must update their mode and
credential settings together with the SDK and call `initSecrets()` without provider
options. Verify the controller implements both endpoints and the snapshot schema,
then test startup, rotation, outage and denied access in the owning application.
Roll back using a compatible SDK/configuration pair. Publishing the SDK alone does
not migrate application startup or connection-rebuild hooks.
