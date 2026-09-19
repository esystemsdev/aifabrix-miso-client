# Initialize application secrets

The Node-only `initSecrets()` helper provides one startup API for local credentials
and explicitly enabled Azure managed identity. Installing this SDK does not enable
Azure authentication or require a newer Miso Controller.

```typescript
import { initSecrets } from "@aifabrix/miso-client/bootstrap";

const runtime = await initSecrets();
const miso = runtime.client;
const databaseUrl = runtime.secrets.require("DATABASE_URL");
// Construct your database client here; do not log databaseUrl.
// On application shutdown:
await runtime.close();
```

Move import-time secret reads behind this async startup boundary. Normal business
calls continue through `runtime.client`. Existing `new MisoClient(config)` and
`loadConfig()` callers continue to work without using this helper.

## Local mode and older controllers

Leave `MISO_AUTH_MODE` unset, or set it to `local`. The helper uses the existing
config loader and controller authentication. It does not import Azure Identity,
probe managed identity, or call `/api/v1/auth/bootstrap`. No controller bootstrap
support or audience setting is required.

Provide `MISO_CLIENTID` and `MISO_CLIENTSECRET` (or `MISO_CLIENT_ID` and
`MISO_CLIENT_SECRET`) and the existing controller settings. Existing environment
values take precedence over `.env` defaults. Local configuration and secret values
are a startup snapshot; restart/reinitialize to pick up changes. The existing config
loader requires ID and secret; explicit token-only `MisoClient` configuration remains
available through its existing constructor.

Mode selection uses the process environment before dotenv loading. Put mode selection
in deployment settings, not `.env`; dotenv cannot switch an already selected provider.
Local context is `undefined`, never synthesized from editable environment claims.

## Azure mode

Azure mode requires a controller implementing the v1 bootstrap contract in plan
227.4 and a registered managed identity. It is not compatible with an older
controller lacking that endpoint. The SDK transport is tested with synthetic
responses; live controller/Azure interoperability and shared fixture certification
remain rollout requirements.

Install the optional `@azure/identity@4.11.1` peer for the built-in adapter. Use Node
22 or later for Azure installations: current resolved Azure transitive dependencies
require Node 22. Local installations do not need this optional peer and retain their
existing runtime requirements. The adapter uses the official
[ManagedIdentityCredential](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/managedidentitycredential),
with no developer credential chain.

Deployment supplies only non-secret settings:

```dotenv
MISO_AUTH_MODE=azure-managed-identity
MISO_CONTROLLER_URL=https://your-installation.example/miso
MISO_BOOTSTRAP_AUDIENCE=api://your-miso-api-application-id
```

The default is system-assigned identity. `AZURE_CLIENT_ID` optionally selects a
user-assigned Azure identity; it is not a Miso client ID. Azure mode ignores local
credentials and never loads dotenv. Missing settings, missing identity, denied
registration or an unsupported controller fail initialization without fallback.
There is no automatic Azure detection or silent downgrade to local secrets.

The SDK obtains an Entra token for the audience's `/.default` scope and posts only
`{ "protocolVersion": 1 }` to the configured HTTPS endpoint. Redirects are disabled.
The response supplies fixed server context, a short-lived Miso application token and
approved configuration. No Miso client secret or Key Vault access is used.
Normal managed-runtime calls are restricted to the startup controller’s HTTPS origin;
redirects and per-request Basic authentication overrides are disabled.

## Lifetime and cleanup

`secrets.get(name)` returns an optional value; `require(name)` rejects missing or
empty values. Both reject invalidated/closed state. Values are confidential: never
serialize returned secrets, clients or their configuration.

Azure refresh is coalesced and runs before expiry. Token and configuration deadlines
are independent, with a 30-second safety margin. Transient outages may use only
still-valid state. Broker denial, malformed response or context change invalidates
cached token use and secret access. Normal API responses also invalidate the runtime
when the controller returns `bootstrap_identity_disabled` or
`bootstrap_binding_mismatch` with HTTP 403, or `bootstrap_token_invalid` with HTTP 401. Ordinary user/RBAC denials and `bootstrap_registry_unavailable` (503) do not
invalidate still-valid state.

A `bootstrap_token_expired` response (401) blocks reuse of that request's token and
attempts a coalesced refresh subject to the 30-second cooldown. The failed operation
is returned to the caller and is never automatically replayed. Subsequent calls use
a replacement token or fail closed if refresh is unavailable. Secret reads retain
their independent deadline. Late expiry responses for a replaced token do not reject
the current token. These rules apply only to the Azure runtime.

Close disables subsequent outbound requests,
cancels refresh and disconnects SDK-owned connections. It cannot revoke already
issued database credentials, cancel requests already sent, or erase caller copies.

```typescript
const unsubscribe = runtime.onSecretsChanged((names) => {
  // Schedule rebuilding affected application-owned connections.
  // Read new values through runtime.secrets; names contain no secret values.
});
const stop = runtime.onInvalidated((reason) => {
  // Stop application-owned connections and readiness; do not log credentials.
});
unsubscribe();
stop();
```

Listeners are synchronous; listener errors are suppressed without logging their
potentially sensitive messages. Local mode has no background secret rotation events.
`close()` is awaitable and idempotent. Each init call owns an independent runtime.
For controlled hosts/tests, `tokenProvider.getToken(scope, abortSignal)` may be
injected; injected providers remain caller-owned.

Before enabling Azure in production, certify the controller's protected-request
identity-denial/error contract and revocation behavior alongside the SDK. This client
preserves ordinary auth transport; application Bearer migration is a separate change.
