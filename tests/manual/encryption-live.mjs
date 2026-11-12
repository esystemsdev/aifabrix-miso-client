/** Real local/managed SDK encryption checks. Never print raw diagnostics or credentials. */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { inspect as inspectValue, parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const axios = require("axios");
const { MisoClient } = require("../../dist/miso-client.js");
const { initSecrets } = require("../../dist/bootstrap/index.js");
const { credentialSettings } = require("../../dist/bootstrap/credentials.js");
const { extractErrorInfo } = require("../../dist/utils/error-extractor.js");
const { values } = parseArgs({
  options: {
    "credentials-file": { type: "string" },
    "controller-url": { type: "string" },
    "evidence-dir": { type: "string", default: ".temp/plan-validation/68.0" },
  },
});
const report = {
  runId: `sdk68-${randomUUID()}`,
  date: new Date().toISOString(),
  checks: [],
  requests: [],
  remoteCleanupRequired: false,
  events: {},
};
const secrets = new Set();
let leaked = false;
let lastFailure;
const diagnosticText = [];
const remember = (value) => {
  if (typeof value === "string" && value) secrets.add(value);
};
const inspect = (value) => {
  let text;
  try {
    text = inspectValue(value, {
      depth: 20,
      maxArrayLength: null,
      maxStringLength: null,
    });
  } catch {
    text = "";
  }
  diagnosticText.push(text);
};
const attachEventCapture = (client, mode) => {
  const counts = { total: 0, audit: 0, debug: 0 };
  report.events[mode] = counts;
  const listener = (entry) => {
    counts.total++;
    if (entry?.level === "audit") counts.audit++;
    if (entry?.level === "debug") counts.debug++;
    inspect(entry);
  };
  client.log.on("log", listener);
  const effective = client.getConfig();
  check(`${mode}-debug-enabled`, effective.logLevel === "debug");
  check(`${mode}-event-capture-enabled`, effective.emitEvents === true);
  return async (minimumEvents) => {
    let previous = -1;
    let stableTurns = 0;
    const deadline = Date.now() + 1000;
    while (
      Date.now() < deadline &&
      (counts.total < minimumEvents || stableTurns < 2)
    ) {
      await delay(10);
      if (counts.total >= minimumEvents && counts.total === previous) {
        stableTurns++;
      } else {
        stableTurns = 0;
      }
      previous = counts.total;
    }
    client.log.off("log", listener);
    check(`${mode}-event-count-drained`, counts.total >= minimumEvents);
    check(`${mode}-safe-audit-event-exists`, counts.audit > 0);
    check(`${mode}-safe-debug-event-exists`, counts.debug > 0);
  };
};
for (const method of ["log", "info", "warn", "error", "debug"])
  console[method] = (...args) => {
    for (const item of args) inspect(item);
  };
const check = (name, passed) => {
  report.checks.push({ name, passed: Boolean(passed) });
};
const parse = (data) => {
  try {
    return typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    return undefined;
  }
};
const originalAdapter = axios.defaults.adapter;
const adapter = axios.getAdapter(originalAdapter);
axios.defaults.adapter = async (config) => {
  const endpoint = config.url.endsWith("/encrypt")
    ? "encrypt"
    : config.url.endsWith("/decrypt")
      ? "decrypt"
      : config.url.endsWith("/auth/token")
        ? "grant"
        : config.url.endsWith("/auth/bootstrap")
          ? "bootstrap"
          : config.url.includes("/logs")
            ? "log"
            : "other";
  const request = { endpoint, status: null };
  const body = parse(config.data);
  if (endpoint !== "grant")
    check(
      "credentials-absent-on-" + endpoint,
      !config.headers["x-client-secret"] && !config.headers["x-client-id"],
    );
  if (["encrypt", "decrypt"].includes(endpoint)) {
    check("POST-" + endpoint, config.method === "post");
    check(
      "client-token-on-" + endpoint,
      Boolean(config.headers["x-client-token"]),
    );
    [
      body?.plaintext,
      body?.value,
      body?.encryptionKey,
      config.headers["x-client-token"],
    ].forEach(remember);
  }
  report.requests.push(request);
  try {
    const response = await adapter(config);
    request.status = response.status;
    const data = parse(response.data);
    [
      data?.data?.token,
      data?.data?.clientToken,
      data?.plaintext,
      data?.value,
    ].forEach(remember);
    return response;
  } catch (error) {
    request.status = error.response?.status ?? null;
    lastFailure = parse(error.response?.data);
    throw error;
  }
};

function count(endpoint) {
  return report.requests.filter((r) => r.endpoint === endpoint).length;
}
async function roundTrip(mode, encrypt, decrypt) {
  const parameterName = `${report.runId}-${mode}`;
  const plaintext = `throwaway-${randomUUID()}`;
  remember(plaintext);
  const before = { encrypt: count("encrypt"), decrypt: count("decrypt") };
  const result = await encrypt(plaintext, parameterName);
  remember(result.value);
  report.remoteCleanupRequired ||= result.storage === "keyvault";
  check(
    `${mode}-round-trip`,
    (await decrypt(result.value, parameterName)) === plaintext,
  );
  check(
    `${mode}-actual-encrypt-decrypt`,
    count("encrypt") === before.encrypt + 1 &&
      count("decrypt") === before.decrypt + 1,
  );
  check(
    `${mode}-known-storage`,
    ["local", "keyvault"].includes(result.storage),
  );
}
async function invalidKey(mode, run) {
  const badKey = `invalid-${randomUUID()}`;
  remember(badKey);
  lastFailure = undefined;
  try {
    await run(badKey);
    check(`${mode}-invalid-key-denied`, false);
  } catch (error) {
    const info = extractErrorInfo(error);
    inspect(error);
    inspect(info);
    check(
      `${mode}-invalid-key-denied`,
      [400, 401, 403, 422].includes(error.statusCode),
    );
    const source = lastFailure;
    check(
      `${mode}-diagnostics-preserved`,
      Boolean(source) &&
        (!source.code || info.responseBody?.code === source.code) &&
        (!source.correlationId ||
          info.correlationId === source.correlationId) &&
        Boolean(
          info.responseBody?.detail ||
          info.responseBody?.code ||
          info.correlationId,
        ),
    );
  }
}
async function local(settings) {
  const client = new MisoClient({
    controllerUrl: settings.url,
    clientId: settings.id,
    clientSecret: settings.secret,
    encryptionKey: settings.key,
    cache: { encryptionCacheTTL: 0 },
    logLevel: "debug",
    emitEvents: true,
    validateResponses: false,
  });
  await client.initialize();
  const finishEvents = attachEventCapture(client, "local");
  try {
    await roundTrip(
      "local",
      (p, n) => client.encryption.encrypt(p, n),
      (v, n) => client.encryption.decrypt(v, n),
    );
    await invalidKey("local", async (badKey) => {
      const invalid = new MisoClient({
        ...client.getConfig(),
        encryptionKey: badKey,
      });
      const finishInvalidEvents = attachEventCapture(invalid, "local-invalid");
      try {
        await invalid.encryption.encrypt(
          "invalid-key-probe",
          `${report.runId}-local`,
        );
      } finally {
        await finishInvalidEvents(2);
        await invalid.disconnect();
      }
    });
    await roundTrip(
      "local-recovery",
      (p, n) => client.encryption.encrypt(p, n),
      (v, n) => client.encryption.decrypt(v, n),
    );
  } finally {
    await finishEvents(8);
    await client.disconnect();
  }
}
async function managed(settings) {
  const runtime = await initSecrets();
  const client = new MisoClient({
    ...runtime.client.getConfig(),
    logLevel: "debug",
    emitEvents: true,
    validateResponses: false,
  });
  await client.initialize();
  const finishEvents = attachEventCapture(client, "managed");
  try {
    const key = runtime.secrets.get("ENCRYPTION_KEY") || settings.key;
    remember(key);
    const call = (operation, body) =>
      client.requestWithAuthStrategy(
        "POST",
        `/api/security/parameters/${operation}`,
        { methods: ["client-token"] },
        body,
      );
    const encrypt = (plaintext, parameterName) =>
      call("encrypt", { plaintext, parameterName, encryptionKey: key });
    const decrypt = async (value, parameterName) =>
      (await call("decrypt", { value, parameterName, encryptionKey: key }))
        .plaintext;
    await roundTrip("managed", encrypt, decrypt);
    await invalidKey("managed", (badKey) =>
      call("encrypt", {
        plaintext: "invalid-key-probe",
        parameterName: `${report.runId}-managed`,
        encryptionKey: badKey,
      }),
    );
    await roundTrip("managed-recovery", encrypt, decrypt);
  } finally {
    await finishEvents(10);
    await client.disconnect();
    await runtime.close();
  }
}
async function main() {
  if (!values["credentials-file"]) throw new Error("missing-settings");
  const env = require("dotenv").parse(readFileSync(values["credentials-file"]));
  const settings = {
    id: env.MISO_CLIENTID || env.MISO_CLIENT_ID,
    secret: env.MISO_CLIENTSECRET || env.MISO_CLIENT_SECRET,
    key: env.ENCRYPTION_KEY,
    url: values["controller-url"] || env.MISO_CONTROLLER_URL,
  };
  if (!settings.id || !settings.secret || !settings.key || !settings.url)
    throw new Error("missing-settings");
  [settings.id, settings.secret, settings.key, "invalid-key-probe"].forEach(
    remember,
  );
  Object.assign(process.env, {
    MISO_AUTH_MODE: "client-credentials",
    MISO_CONTROLLER_URL: settings.url,
    MISO_CLIENTID: settings.id,
    MISO_CLIENTSECRET: settings.secret,
    MISO_LOG_LEVEL: "debug",
    MISO_EMIT_EVENTS: "true",
  });
  credentialSettings(); // Same trusted HTTPS/internal-HTTP policy as managed SDK initialization.
  for (const [name, run] of [
    ["local", () => local(settings)],
    ["managed", () => managed(settings)],
  ]) {
    try {
      await run();
    } catch {
      check(`${name}-completed`, false);
    }
  }
}
try {
  await main();
} catch {
  check("harness-settings-or-setup", false);
} finally {
  axios.defaults.adapter = originalAdapter;
}
for (const text of diagnosticText)
  for (const secret of secrets) if (text.includes(secret)) leaked = true;
check("diagnostics-redacted", !leaked);
check("shared-log-delivery-disabled", count("log") === 0);
const passed =
  report.checks.every((c) => c.passed) &&
  count("encrypt") >= 6 &&
  count("decrypt") >= 4;
report.passed = passed;
const directory = resolve(values["evidence-dir"]);
mkdirSync(directory, { recursive: true });
writeFileSync(
  resolve(directory, `${report.runId}.json`),
  JSON.stringify(report, null, 2) + "\n",
);
process.stdout.write(
  JSON.stringify({
    runId: report.runId,
    passed,
    checks: report.checks,
    evidence: directory,
  }) + "\n",
);
process.exitCode = passed ? 0 : 1;
