import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);
const axios = require("axios");
const dotenv = require("dotenv");
const { values } = parseArgs({
  options: {
    "credentials-file": { type: "string" },
    "env-user": { type: "string" },
    "controller-url": { type: "string" },
    "wait-ms": { type: "string", default: "125000" },
    "evidence-dir": { type: "string", default: ".temp/plan-validation/66.0" },
  },
});
const report = {
  runId: `plan66-${randomUUID()}`,
  date: new Date().toISOString(),
  sdkVersion: require("../../package.json").version,
  checks: [],
  requests: [],
};
const emit = (item) => process.stdout.write(`${JSON.stringify(item)}\n`);
function check(name, passed, details = {}) {
  report.checks.push({ name, passed, ...details });
  emit(report.checks.at(-1));
}
const safeCode = (error) =>
  [
    "invalid-settings",
    "unknown-auth-mode",
    "authorization-denied",
    "protocol-error",
    "unavailable",
    "initialization-failed",
    "closed",
  ].includes(error?.code)
    ? error.code
    : "request-failed";
let runtime;
let secretValues = [];
let diagnosticLeak = false;
let confidentialConfigurationKeys = 0;
let diagnosticCalls = 0;
const diagnosticMatches = new Set();
const labels = new Map();
// SDK diagnostics are inspected in memory and never copied into evidence.
for (const method of ["log", "info", "warn", "error", "debug"]) {
  console[method] = (...args) => {
    diagnosticCalls++;
    let text;
    try {
      text = JSON.stringify(args);
    } catch {
      text = "";
    }
    for (const value of secretValues) {
      if (value.length > 3 && text.includes(value)) {
        diagnosticLeak = true;
        diagnosticMatches.add(labels.get(value) || "unclassified");
      }
    }
  };
}
function loadSettings() {
  if (!values["credentials-file"]) throw new Error("settings");
  const content = values["env-user"]
    ? execFileSync(
        "sudo",
        ["-n", "-u", values["env-user"], "cat", values["credentials-file"]],
        { stdio: ["ignore", "pipe", "pipe"] },
      )
    : readFileSync(values["credentials-file"]);
  const settings = dotenv.parse(content);
  const controller = new URL(
    values["controller-url"] || settings.MISO_CONTROLLER_URL,
  );
  if (
    controller.protocol !== "https:" ||
    controller.username ||
    controller.password ||
    controller.search ||
    controller.hash
  )
    throw new Error("settings");
  const id = settings.MISO_CLIENTID || settings.MISO_CLIENT_ID;
  const secret = settings.MISO_CLIENTSECRET || settings.MISO_CLIENT_SECRET;
  if (!id || !secret) throw new Error("settings");
  secretValues = [id, secret];
  labels.set(id, "client-id");
  labels.set(secret, "client-secret");
  Object.assign(process.env, {
    MISO_AUTH_MODE: "client-credentials",
    MISO_CONTROLLER_URL: controller.href,
    MISO_CLIENTID: id,
    MISO_CLIENTSECRET: secret,
  });
  report.controllerUrl = controller.href;
  return { id, secret, controller };
}
function observeTransport() {
  const adapter = axios.getAdapter(axios.defaults.adapter);
  const state = {
    grantToken: undefined,
    snapshotToken: undefined,
    snapshotCount: 0,
    grantCount: 0,
    payload: undefined,
    configuration: undefined,
  };
  axios.defaults.adapter = async (config) => {
    config.headers["x-correlation-id"] = report.runId;
    const endpoint = config.url.endsWith("/auth/token")
      ? "grant"
      : config.url.endsWith("/auth/bootstrap")
        ? "snapshot"
        : "normal-api";
    const request = { endpoint, status: null, time: new Date().toISOString() };
    if (endpoint === "snapshot")
      request.tokenHandoff =
        config.headers["x-client-token"] ===
        (state.snapshotToken || state.grantToken);
    if (endpoint !== "grant")
      request.credentialsAbsent =
        !config.headers["x-client-secret"] && !config.headers["x-client-id"];
    report.requests.push(request);
    let response;
    try {
      response = await adapter(config);
    } catch (error) {
      request.status = error.response?.status || null;
      throw error;
    }
    request.status = response.status;
    let body;
    try {
      body =
        typeof response.data === "string"
          ? JSON.parse(response.data)
          : response.data;
    } catch {
      return response;
    }
    if (endpoint === "grant" && response.status === 201) {
      state.grantCount++;
      state.grantToken = body.data?.token;
      state.snapshotToken = undefined;
      state.grantExpiresAt = body.data?.expiresAt;
      if (typeof state.grantToken === "string")
        secretValues.push(state.grantToken);
      labels.set(state.grantToken, "client-token");
    }
    if (
      endpoint === "snapshot" &&
      response.status === 200 &&
      body.success === true
    ) {
      state.snapshotCount++;
      state.snapshotToken = body.data?.clientToken;
      state.configuration = body.data?.configuration;
      if (typeof state.snapshotToken === "string") {
        secretValues.push(state.snapshotToken);
        labels.set(state.snapshotToken, "client-token");
        try {
          state.payload = JSON.parse(
            Buffer.from(state.snapshotToken.split(".")[1], "base64url"),
          );
        } catch {
          /* No token contents are reported. */
        }
      }
      for (const [key, value] of Object.entries(state.configuration || {}))
        if (
          typeof value === "string" &&
          /SECRET|PASSWORD|TOKEN|PRIVATE.?KEY|API.?KEY|ENCRYPTION.?KEY|SIGNING.?KEY|DATABASE.?URL|CONNECTION.?STRING/i.test(
            key,
          )
        ) {
          secretValues.push(value);
          labels.set(value, "configuration:" + key);
          confidentialConfigurationKeys++;
        }
    }
    return response;
  };
  return state;
}
async function negativeProbes(client, controller, id) {
  const base = controller.href.replace(/\/$/, "");
  for (const [name, path, headers, body] of [
    [
      "invalid-secret-denied",
      "/api/v1/auth/token",
      { "x-client-id": id, "x-client-secret": `invalid-${randomUUID()}` },
      undefined,
    ],
    [
      "missing-token-denied",
      "/api/v1/auth/bootstrap",
      {},
      { protocolVersion: 1 },
    ],
    [
      "invalid-token-denied",
      "/api/v1/auth/bootstrap",
      { "x-client-token": `invalid-${randomUUID()}` },
      { protocolVersion: 1 },
    ],
  ]) {
    try {
      const result = await client.post(base + path, body, {
        headers: { ...headers, "x-correlation-id": report.runId },
      });
      check(name, [401, 403].includes(result.status), {
        status: result.status,
      });
    } catch {
      check(name, false, { error: "request-failed" });
    }
  }
}
async function tokenOnlyBaseline(state, settings) {
  if (!state.grantToken) return;
  check("live-credential-grant", true, { status: 201 });
  let client;
  try {
    const payload = JSON.parse(
      Buffer.from(state.grantToken.split(".")[1], "base64url"),
    );
    if (
      typeof payload.environmentKey !== "string" ||
      typeof payload.applicationKey !== "string"
    )
      throw new Error("context");
    const { MisoClient } = require("../../dist/miso-client.js");
    client = new MisoClient({
      controllerUrl: settings.controller.href,
      clientId: settings.id,
      clientToken: state.grantToken,
      clientTokenExpiresAt: state.grantExpiresAt,
    });
    await client.initialize();
    await client.getApplicationStatus(
      payload.environmentKey,
      payload.applicationKey,
    );
    check("baseline-token-only-sdk-request", true);
  } catch {
    check("baseline-token-only-sdk-request", false, {
      error: "request-failed",
    });
  } finally {
    await client?.disconnect().catch(() => check("baseline-cleanup", false));
  }
}
async function main() {
  const settings = loadSettings();
  const { id, controller } = settings;
  const waitMs = Number(values["wait-ms"]);
  if (!Number.isFinite(waitMs) || waitMs < 0 || waitMs > 180000)
    throw new Error("settings");
  const probe = axios.create({
    timeout: 10000,
    maxRedirects: 0,
    validateStatus: () => true,
  });
  const state = observeTransport();
  const before = { ...process.env };
  const { initSecrets } = require("../../dist/bootstrap/index.js");
  try {
    runtime = await initSecrets();
    check("live-sdk-bootstrap", Boolean(runtime.context), {
      grants: state.grantCount,
      snapshots: state.snapshotCount,
    });
    const configuration = state.configuration || {};
    check(
      "secret-accessors",
      Object.keys(configuration).every(
        (key) => runtime.secrets.get(key) === configuration[key],
      ),
      { keyCount: Object.keys(configuration).length },
    );
    check(
      "remote-values-not-written-to-environment",
      JSON.stringify(before) === JSON.stringify(process.env),
    );
    check("token-only-client-config", !runtime.client.getConfig().clientSecret);
    if (state.payload?.environmentKey && state.payload?.applicationKey) {
      try {
        await runtime.client.getApplicationStatus(
          state.payload.environmentKey,
          state.payload.applicationKey,
        );
        check("normal-sdk-request", true);
      } catch (error) {
        check("normal-sdk-request", false, { error: safeCode(error) });
      }
    } else
      check("normal-sdk-request", false, { error: "missing-token-context" });
    const firstContext = JSON.stringify(runtime.context);
    for (let remaining = waitMs; remaining > 0; remaining -= 30000) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(30000, remaining)),
      );
      emit({
        phase: "waiting-for-live-refresh",
        snapshots: state.snapshotCount,
      });
    }
    check(
      "scheduled-live-refresh",
      state.snapshotCount >= 2 && state.grantCount === 1,
      { grants: state.grantCount, snapshots: state.snapshotCount },
    );
    check("stable-context", firstContext === JSON.stringify(runtime.context));
    check(
      "snapshot-token-handoff",
      report.requests
        .filter((r) => r.endpoint === "snapshot")
        .every((r) => r.tokenHandoff),
    );
    check(
      "credentials-only-on-grant",
      report.requests
        .filter((r) => r.endpoint !== "grant")
        .every((r) => r.credentialsAbsent),
    );
    await runtime.close();
    const count = report.requests.length;
    try {
      runtime.secrets.get("DATABASE_URL");
      check("close-blocks-secret-access", false);
    } catch {
      check("close-blocks-secret-access", true);
    }
    try {
      await runtime.client.getApplicationStatus(
        state.payload.environmentKey,
        state.payload.applicationKey,
      );
      check("close-blocks-outbound-request", false);
    } catch {
      check("close-blocks-outbound-request", report.requests.length === count);
    }
    await runtime.close();
    runtime = await initSecrets();
    check(
      "explicit-reinitialization",
      state.grantCount === 2 && Boolean(runtime.context),
    );
  } catch (error) {
    check("live-sdk-bootstrap-or-refresh", false, { error: safeCode(error) });
  } finally {
    await runtime?.close().catch(() => check("cleanup", false));
  }
  if (!state.snapshotCount) await tokenOnlyBaseline(state, settings);
  await negativeProbes(probe, controller, id);
  check("sdk-diagnostics-redacted", !diagnosticLeak, {
    diagnosticCalls,
    matchedCategories: [...diagnosticMatches],
    confidentialConfigurationKeys,
  });
}
try {
  await main();
} catch (error) {
  check("harness", false, { error: safeCode(error) });
}
const directory = resolve(values["evidence-dir"]);
mkdirSync(directory, { recursive: true });
writeFileSync(
  resolve(directory, `${report.runId}.json`),
  JSON.stringify(report, null, 2) + "\n",
);
emit({
  runId: report.runId,
  passed: report.checks.every((item) => item.passed),
  evidence: directory,
});
process.exitCode = report.checks.every((item) => item.passed) ? 0 : 1;
