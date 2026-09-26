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
