# Live application bootstrap validation

Build the SDK, then run the harness with an authorized application's credential file
and the HTTPS controller URL for that environment:

```bash
pnpm run build:silent
node tests/manual/bootstrap-live.mjs \
  --credentials-file /path/to/application/.env \
  --controller-url https://your-installation.example/miso
```

If the file belongs to another local developer account and existing sudo policy
permits access, add `--env-user <account>`. The harness reads the file into memory;
it does not source it as shell code, modify it or persist its contents.
`--controller-url` can select the public HTTPS address of the same deployment when
the file uses internal container HTTP. Do not assume matching database URLs or token
settings mean different developer containers share a database.

The harness uses the built SDK and real HTTP requests. A successful run checks the
initial grant, snapshot validation/accessors, normal SDK requests, scheduled refresh,
latest-token handoff, no repeated healthy-session grant, stable context, no remote
value writes to process environment, close and explicit reinitialization. It waits
125 seconds by default; `--wait-ms` accepts 0–180000, but a duration too short to
observe refresh cannot establish that check. Invalid-secret, missing-token and
invalid-token probes verify denial without changing stored credentials or disabling
a running application.

If bootstrap fails after a successful grant, a separate token-only SDK request
checks baseline controller compatibility. That check does not count as successful
bootstrap. The harness does not rotate real application credentials, stop shared
services or claim application connection-rebuild/revocation proof.

Only status, boolean/count checks, versions and correlation IDs are written to
`.temp/plan-validation/66.0/`. Use `--evidence-dir` to choose another safe location.
SDK diagnostics are inspected in memory for the supplied credentials, issued tokens
and configuration values whose names identify secrets, passwords, keys or connection
strings. This is a scoped check, not proof that every arbitrary configuration value
is confidential or absent from logs. Raw diagnostics are not copied to the report. A failed or unavailable required check produces a nonzero exit code.

## Cross-SDK schema comparison

After building, compare TypeScript and the local Python SDK against the same 28
synthetic cases (including envelope closure, reserved keys, size and timestamp
boundaries):

```bash
node tests/manual/bootstrap-schema-parity.mjs \
  --python-root /path/to/aifabrix-miso-client-python
```

The Python checkout must have its `.venv/bin/python` available. The script uses no
live credentials and writes only case names and acceptance results to
`.temp/plan-validation/66.0/schema-parity.json`. Both SDKs must match each case's
expected result; matching each other alone is insufficient.

## Automated HTTP E2E tests

```bash
pnpm run build:silent
pnpm run test:e2e
```

These tests start an isolated loopback HTTP controller with synthetic credentials
and exercise the built SDK, actual Axios HTTP transport, grant/bootstrap, fallback,
encryption, error conversion, console diagnostics and outgoing audit requests.
No controller account or Redis is needed. The fixture stores encryption values in
memory; it proves SDK transport and lifecycle behavior, not production cryptography.
The publish workflow runs this suite after building, before package checks.

## Live encryption

Use a dedicated disposable application whose credential file contains
`MISO_CLIENTID`, `MISO_CLIENTSECRET`, `MISO_CONTROLLER_URL` and `ENCRYPTION_KEY`.
The managed test uses the snapshot `ENCRYPTION_KEY` when present and otherwise the
same application's resolved Builder key.

```bash
pnpm run build:silent
pnpm run test:encryption:live --credentials-file /path/to/test-app/.env \
  --controller-url https://your-installation.example/miso
```

The command uses the SDK's HTTPS/internal-HTTP trust policy; it never disables TLS
verification. The local client uses the public encryption service with caching
disabled. The managed client obtains a real snapshot and sends encrypt/decrypt
requests through `runtime.client.requestWithAuthStrategy()` with the resolved key;
this direct path does not cache encryption results or copy secrets into environment
variables. The runtime's default encryption service does not automatically load
snapshot encryption configuration.

Both modes encrypt/decrypt a unique throwaway value, deliberately reject a wrong
key, and prove recovery with the valid key. Reports contain only check names,
booleans, request categories, statuses, run IDs and timestamps. Console diagnostics
are captured in memory and checked against known secrets. Raw errors, credentials,
plaintext and encrypted references are never written to reports. Failure, missing
configuration or unavailable bootstrap yields a nonzero exit code.

Safe reports are under `.temp/plan-validation/68.0/` (`--evidence-dir` overrides).
Local `enc://` references require no remote cleanup. For Key Vault storage, the
app owner must delete test parameters named `<runId>-local`, `<runId>-local-recovery`,
`<runId>-managed` and `<runId>-managed-recovery` after evidence review. The SDK has
no delete-parameter API, so this harness does not promise automatic remote cleanup.
It closes clients/runtime on success and failure. Running this harness against the
local fixture validates the harness but does not constitute deployed-controller evidence.

For this checkout's existing Builder test application:

```bash
aifabrix resolve miso-test --fresh --json
pnpm run test:encryption:live --credentials-file builder/miso-test/.env \
  --controller-url https://dev01.aifabrix.dev/miso
```

The explicit URL is the dev01 controller configured in Builder. The generated
container hostname and legacy localhost port in the app files may not be reachable
from the host. Do not reuse this environment's key against another controller.
