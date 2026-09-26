import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
const require = createRequire(import.meta.url);
const axios = require("axios");
const { values } = parseArgs({
  options: { "python-root": { type: "string" } },
});
if (!values["python-root"]) throw new Error("--python-root is required");
const seed = JSON.parse(
  readFileSync("tests/fixtures/bootstrap/controller-snapshot.json"),
).snapshot;
const epoch = Math.floor(Date.now() / 1000) * 1000;
for (const [key, delta] of Object.entries({
  issuedAt: 0,
  refreshAfter: 120000,
  clientTokenExpiresAt: 300000,
  expiresAt: 900000,
}))
  seed[key] = new Date(epoch + delta).toISOString();
const cases = [];
function add(name, expected, edit) {
  const body = { success: true, data: structuredClone(seed) };
  edit?.(body);
  cases.push({ name, expected, body: JSON.stringify(body) });
}
add("valid", true);
add("extra-envelope", false, (b) => (b.extra = "value"));
add("extra-data", false, (b) => (b.data.extra = "value"));
add("wrong-version", false, (b) => (b.data.protocolVersion = true));
add("extra-context", false, (b) => (b.data.context.extra = "value"));
add("empty-token", false, (b) => (b.data.clientToken = ""));
for (const key of [
  "MISO_AUTH_MODE",
  "MISO_CONTROLLER_URL",
  "MISO_CLIENTID",
  "MISO_CLIENT_ID",
  "MISO_CLIENTSECRET",
  "MISO_CLIENT_SECRET",
  "MISO_AUTH_STRATEGY",
  "MISO_CLIENT_TOKEN_URI",
])
  add("reserved-" + key, false, (b) => (b.data.configuration[key] = "value"));
for (const count of [256, 257])
  add(
    "key-count-" + count,
    count === 256,
    (b) =>
      (b.data.configuration = Object.fromEntries(
        Array.from({ length: count }, (_, i) => ["KEY_" + i, "value"]),
      )),
  );
for (const size of [65536, 65537])
  add(
    "utf8-bytes-" + size,
    size === 65536,
    (b) => (b.data.configuration = { KEY: "x".repeat(size) }),
  );
for (const size of [128, 129])
  add(
    "key-length-" + size,
    size === 128,
    (b) => (b.data.configuration = { ["A".repeat(size)]: "value" }),
  );
for (const key of ["refreshAfter", "clientTokenExpiresAt", "expiresAt"])
  add(
    "wrong-" + key,
    false,
    (b) =>
      (b.data[key] = new Date(Date.parse(b.data[key]) + 1000).toISOString()),
  );
for (const suffix of [".1Z", ".1234Z", "+00:00"])
  add(
    "timestamp-" + suffix,
    false,
    (b) => (b.data.issuedAt = b.data.issuedAt.replace(".000Z", suffix)),
  );
add("nonstring-value", false, (b) => (b.data.configuration = { KEY: 3 }));
add("unsuccessful-envelope", false, (b) => (b.success = false));
const code = `import sys,json,time
from miso_client.utils.bootstrap_snapshot import parse_snapshot
out=[]
for case in json.load(sys.stdin):
 try:
  parse_snapshot(case["body"].encode(),time.time()); out.append(True)
 except Exception: out.append(False)
print(json.dumps(out))`;
const python = spawnSync(
  resolve(values["python-root"], ".venv/bin/python"),
  ["-c", code],
  {
    input: JSON.stringify(cases),
    encoding: "utf8",
    timeout: 10000,
    env: { ...process.env, PYTHONPATH: resolve(values["python-root"]) },
  },
);
if (python.status !== 0) throw new Error("Python parity runner failed");
const pythonResults = JSON.parse(python.stdout);
let raw;
// Feed fixtures through the actual transport parser; no network or live secrets.
axios.defaults.adapter = async (config) => ({
  status: 200,
  statusText: "OK",
  config,
  headers: {},
  data: raw,
});
const { fetchSnapshot } = require("../../dist/bootstrap/transport.js");
const results = [];
for (let i = 0; i < cases.length; i++) {
  raw = cases[i].body;
  let accepted = true;
  try {
    await fetchSnapshot(
      "synthetic-token",
      { url: "https://synthetic.invalid/api/v1/auth/bootstrap" },
      new AbortController().signal,
    );
  } catch {
    accepted = false;
  }
  results.push({
    name: cases[i].name,
    expected: cases[i].expected,
    typescriptAccepted: accepted,
    pythonAccepted: pythonResults[i],
    passed:
      accepted === cases[i].expected && pythonResults[i] === cases[i].expected,
  });
}
const report = {
  date: new Date().toISOString(),
  caseCount: cases.length,
  passed: results.filter((x) => x.passed).length,
  results,
};
mkdirSync(".temp/plan-validation/66.0", { recursive: true });
writeFileSync(
  ".temp/plan-validation/66.0/schema-parity.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    caseCount: report.caseCount,
    passed: report.passed,
    failures: results.filter((x) => !x.passed),
  }),
);
process.exitCode = results.every((x) => x.passed) ? 0 : 1;
