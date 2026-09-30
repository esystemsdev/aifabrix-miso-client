import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import { controllerFixture, credentials } from "./controller-fixture.mjs";
const require = createRequire(import.meta.url);
const { MisoClient } = require("../../dist/miso-client.js");
const { initSecrets } = require("../../dist/bootstrap/index.js");
const { extractErrorInfo } = require("../../dist/utils/error-extractor.js");

async function setup(t, managed = false) {
  const fixture = await controllerFixture();
  const saved = { ...process.env };
  let runtime;
  let client;
  t.after(async () => {
    await delay(30); // Drain SDK's asynchronous audit sinks before shutdown.
    await runtime?.close();
    await client?.disconnect();
    await fixture.close();
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  });
  if (managed) {
    Object.assign(process.env, {
      MISO_AUTH_MODE: "client-credentials",
      MISO_CONTROLLER_URL: fixture.url,
      MISO_CLIENTID: credentials.id,
      MISO_CLIENTSECRET: credentials.secret,
    });
    runtime = await initSecrets();
    client = runtime.client;
  } else {
    client = new MisoClient({
      controllerUrl: fixture.url,
      clientId: credentials.id,
      clientSecret: credentials.secret,
      encryptionKey: credentials.key,
      cache: { encryptionCacheTTL: 0 },
      validateResponses: false,
    });
    await client.initialize();
  }
  return { fixture, client, runtime };
}
for (const managed of [false, true]) {
  for (const method of ["GET", "POST"]) {
    for (const methods of [
      ["bearer", "client-token"],
      ["client-token", "bearer"],
    ]) {
      test(`wire fallback ${managed ? "managed" : "local"} ${method} ${methods.join(" -> ")}`, async (t) => {
        const { fixture, client } = await setup(t, managed);
        let attempts = 0;
        fixture.handle((request, send) => {
          if (request.path !== "/api/fallback") return false;
          send(
            ++attempts === 1 ? 401 : 200,
            attempts === 1
              ? { code: "ordinary_unauthorized" }
              : { success: true },
          );
          return true;
        });
        const result = await client.requestWithAuthStrategy(
          method,
          "/api/fallback",
          { methods, bearerToken: "user-token-sentinel" },
          { mutation: true },
        );
        assert.equal(result.success, true);
        const calls = fixture.requests.filter(
          (r) => r.path === "/api/fallback",
        );
        assert.equal(calls.length, 2);
        calls.forEach((r, i) => {
          assert.equal(
            r.headers.authorization,
            methods[i] === "bearer" ? "Bearer user-token-sentinel" : undefined,
          );
          assert.ok(r.headers["x-client-token"]);
          assert.equal(r.headers["x-client-id"], undefined);
          assert.equal(r.headers["x-client-secret"], undefined);
        });
        if (!managed)
          assert.notEqual(
            calls[0].headers["x-client-token"],
            calls[1].headers["x-client-token"],
          );
        else
          assert.equal(
            fixture.requests.filter((r) => r.path.endsWith("/auth/token"))
              .length,
            1,
          );
      });
    }
  }
  test(`credential confinement ${managed ? "managed" : "local"}`, async (t) => {
    const { fixture, client } = await setup(t, managed);
    await client.requestWithAuthStrategy("POST", "/api/credential-check", {
      methods: ["client-credentials"],
    });
    const request = fixture.requests.find(
      (r) => r.path === "/api/credential-check",
    );
    assert.ok(request.headers["x-client-token"]);
    assert.equal(request.headers["x-client-id"], undefined);
    assert.equal(request.headers["x-client-secret"], undefined);
    assert.equal(
      fixture.requests.filter((r) => r.path.endsWith("/auth/token")).length,
      1,
    );
  });
}
for (const status of [403, 422, 429, 500]) {
  test(`no fallback for transport ${status} with misleading body status`, async (t) => {
    const { fixture, client } = await setup(t);
    fixture.handle((r, send) => {
      send(status, { type: "/Errors/Denied", title: "Denied", status: 401 });
      return true;
    });
    await assert.rejects(
      client.requestWithAuthStrategy("POST", "/api/deny", {
        methods: ["bearer", "client-token"],
        bearerToken: "user",
      }),
      (e) => e.statusCode === status && e.errorResponse.statusCode === status,
    );
    assert.equal(
      fixture.requests.filter((r) => r.path === "/api/deny").length,
      1,
    );
  });
}
test("public encryption round trip, invalid-key diagnostics and recovery over HTTP", async (t) => {
  const { fixture, client } = await setup(t);
  const encrypted = await client.encryption.encrypt(
    "throwaway-plaintext",
    "e2e-parameter",
  );
  assert.equal(
    await client.encryption.decrypt(encrypted.value, "e2e-parameter"),
    "throwaway-plaintext",
  );
  const invalid = new MisoClient({
    ...client.getConfig(),
    encryptionKey: "bad-key-sentinel",
  });
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args);
  try {
    await assert.rejects(
      invalid.encryption.encrypt("throwaway-plaintext", "e2e-parameter"),
      (error) => {
        const info = extractErrorInfo(error);
        assert.equal(error.errorResponse.code, "INVALID_ENCRYPTION_KEY");
        assert.equal(info.correlationId, "encryption-correlation");
        assert.ok(
          !JSON.stringify({ error, info }).includes("bad-key-sentinel"),
        );
        return true;
      },
    );
    assert.ok(!JSON.stringify(logs).includes("bad-key-sentinel"));
  } finally {
    console.error = original;
    await invalid.disconnect();
  }
  await client.encryption.encrypt("recovered", "e2e-parameter");
  assert.equal(
    fixture.requests.filter((r) => r.path.endsWith("/encrypt")).length,
    3,
  );
  assert.equal(
    fixture.requests.filter((r) => r.path.endsWith("/decrypt")).length,
    1,
  );
});

for (const code of [
  "bootstrap_token_invalid",
  "bootstrap_token_expired",
  "bootstrap_identity_disabled",
  "bootstrap_binding_mismatch",
]) {
  test(`managed ${code} never replays over HTTP`, async (t) => {
    const { fixture, client, runtime } = await setup(t, true);
    fixture.handle((r, send) => {
      if (r.path !== "/api/terminal") return false;
      send(code.includes("identity") || code.includes("binding") ? 403 : 401, {
        code,
      });
      return true;
    });
    await assert.rejects(
      client.requestWithAuthStrategy(
        "POST",
        "/api/terminal",
        { methods: ["client-token", "bearer"], bearerToken: "user" },
        {},
      ),
    );
    assert.equal(
      fixture.requests.filter((r) => r.path === "/api/terminal").length,
      1,
    );
    if (code !== "bootstrap_token_expired") {
      assert.throws(
        () => runtime.secrets.get("ENCRYPTION_KEY"),
        /authorization-denied/,
      );
      await assert.rejects(
        client.requestWithAuthStrategy("GET", "/api/terminal", {
          methods: ["client-token"],
        }),
      );
      assert.equal(
        fixture.requests.filter((r) => r.path === "/api/terminal").length,
        1,
      );
    }
  });
}
test("managed bootstrap encryption round trip uses the runtime's current token", async (t) => {
  const { fixture, client, runtime } = await setup(t, true);
  const encryptionKey = runtime.secrets.require("ENCRYPTION_KEY");
  const encrypted = await client.requestWithAuthStrategy(
    "POST",
    "/api/security/parameters/encrypt",
    { methods: ["client-token"] },
    {
      plaintext: "managed-throwaway",
      parameterName: "managed-e2e",
      encryptionKey,
    },
  );
  const decrypted = await client.requestWithAuthStrategy(
    "POST",
    "/api/security/parameters/decrypt",
    { methods: ["client-token"] },
    { value: encrypted.value, parameterName: "managed-e2e", encryptionKey },
  );
  assert.equal(decrypted.plaintext, "managed-throwaway");
  const calls = fixture.requests.filter((r) =>
    r.path.startsWith("/api/security/parameters/"),
  );
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      (r) =>
        r.headers["x-client-token"] &&
        !r.headers["x-client-secret"] &&
        !r.headers["x-client-id"],
    ),
  );
});
for (const operation of ["encrypt", "decrypt"]) {
  for (const shape of ["rfc", "legacy", "json", "text", "invalid-json"]) {
    test(`HTTP ${operation} ${shape} preserves safe diagnostics through console and audit`, async (t) => {
      const { fixture, client } = await setup(t);
      const logs = [];
      const original = console.error;
      console.error = (...args) => logs.push(args);
      t.after(() => {
        console.error = original;
      });
      fixture.handle((r, send) => {
        if (!r.path.endsWith(`/${operation}`)) return false;
        const echo = [
          credentials.secret,
          credentials.id,
          credentials.key,
          r.headers["x-client-token"],
          r.body.plaintext || r.body.value,
        ].join(" ");
        const base = {
          code: "KEY_DENIED",
          detail: echo,
          instance: "/safe-instance",
          authMethod: "client-token",
          clientIdentity: { application: "disclosed-app" },
        };
        const body =
          shape === "rfc"
            ? { ...base, type: "/Errors/Key", title: echo, status: 422 }
            : shape === "legacy"
              ? {
                  ...base,
                  type: "/Errors/Key",
                  title: echo,
                  statusCode: 422,
                  errors: [echo],
                }
              : shape === "json"
                ? base
                : shape === "text"
                  ? echo
                  : `{broken: ${echo}`;
        send(422, body, { "x-correlation-id": "wire-correlation" });
        return true;
      });
      const work =
        operation === "encrypt"
          ? client.encryption.encrypt("wire-plaintext", "e2e")
          : client.encryption.decrypt("enc://wire-reference", "e2e");
      await assert.rejects(work, (error) => {
        const info = extractErrorInfo(error);
        assert.equal(error.statusCode, 422);
        assert.equal(info.correlationId, "wire-correlation");
        if (["rfc", "legacy", "json"].includes(shape))
          assert.equal(info.responseBody.code, "KEY_DENIED");
        if (["rfc", "legacy"].includes(shape)) {
          assert.equal(error.errorResponse.authMethod, "client-token");
          assert.deepEqual(error.errorResponse.clientIdentity, {
            application: "disclosed-app",
          });
        }
        const output = JSON.stringify({ error, info, stack: error.stack });
        for (const secret of [
          credentials.secret,
          credentials.id,
          credentials.key,
          "issued-token-1",
          "wire-plaintext",
          "enc://wire-reference",
        ])
          assert.ok(
            !output.includes(secret),
            `Synthetic sentinel leaked: ${secret}: ${output}`,
          );
        return true;
      });
      await delay(30);
      const output = JSON.stringify([
        logs,
        fixture.requests
          .filter((r) => r.path.includes("/logs"))
          .map((r) => r.body),
      ]);
      for (const secret of [
        credentials.secret,
        credentials.id,
        credentials.key,
        "issued-token-1",
        "wire-plaintext",
        "enc://wire-reference",
      ])
        assert.ok(
          !output.includes(secret),
          `Synthetic sentinel leaked: ${secret}: ${output}`,
        );
    });
  }
}

test("live encryption CLI executes both modes and produces secret-free evidence", async (t) => {
  const { mkdtemp, writeFile, readdir, readFile, rm } =
    await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawn } = await import("node:child_process");
  const fixture = await controllerFixture();
  const dir = await mkdtemp(join(tmpdir(), "sdk68-e2e-"));
  t.after(async () => {
    await fixture.close();
    await rm(dir, { recursive: true, force: true });
  });
  const settings = join(dir, ".env");
  await writeFile(
    settings,
    `MISO_CLIENTID=${credentials.id}\nMISO_CLIENTSECRET=${credentials.secret}\nENCRYPTION_KEY=${credentials.key}\nMISO_CONTROLLER_URL=${fixture.url}\n`,
    { mode: 0o600 },
  );
  const child = spawn(
    process.execPath,
    [
      "tests/manual/encryption-live.mjs",
      "--credentials-file",
      settings,
      "--evidence-dir",
      join(dir, "evidence"),
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  const exit = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  assert.equal(exit, 0, output);
  const reports = await readdir(join(dir, "evidence"));
  assert.equal(reports.length, 1);
  const evidence = await readFile(join(dir, "evidence", reports[0]), "utf8");
  const report = JSON.parse(evidence);
  assert.equal(report.passed, true);
  assert.equal(
    report.requests.filter((r) => r.endpoint === "encrypt").length,
    6,
  );
  assert.equal(
    report.requests.filter((r) => r.endpoint === "decrypt").length,
    4,
  );
  for (const secret of Object.values(credentials))
    assert.ok(!(output + evidence).includes(secret));
});
