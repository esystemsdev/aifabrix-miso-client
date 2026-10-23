import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = join(root, "tests/package/fixtures/consumer");
const evidence = join(root, ".temp/plan-validation/70.0/artifacts");
const npmCli = resolve(
  dirname(process.execPath),
  "../lib/node_modules/npm/bin/npm-cli.js",
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
    timeout: options.timeout ?? 120000,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout ?? ""}${result.stderr ?? ""}`,
    );
  }
  return result;
}

function npm(args, cwd) {
  return run(process.execPath, [npmCli, ...args], { cwd, timeout: 180000 });
}

function installConsumer(tarball, expressMajor) {
  const consumer = mkdtempSync(
    join(tmpdir(), `miso-packed-${expressMajor ?? "none"}-`),
  );
  npm(["init", "--yes"], consumer);
  const packages = [tarball, "typescript@5.4.5", "@types/node@22.0.0"];
  if (expressMajor) {
    packages.push(`express@${expressMajor}`, `@types/express@${expressMajor}`);
  }
  npm(
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...packages],
    consumer,
  );
  return consumer;
}

function verifyRuntime(consumer) {
  const commonJs = `
const assert = require("node:assert/strict");
const root = require("@aifabrix/miso-client");
const filters = require("@aifabrix/miso-client/filter-store");
const bootstrap = require("@aifabrix/miso-client/bootstrap");
assert.equal(typeof root.MisoClient, "function");
assert.equal(typeof filters.createRememberedFilterStore, "function");
assert.equal(typeof bootstrap.initSecrets, "function");
`;
  run(process.execPath, ["-e", commonJs], { cwd: consumer });

  const esm = `
import assert from "node:assert/strict";
const root = await import("@aifabrix/miso-client");
const filters = await import("@aifabrix/miso-client/filter-store");
const bootstrap = await import("@aifabrix/miso-client/bootstrap");
assert.equal(typeof root.MisoClient, "function");
assert.equal(typeof filters.createRememberedFilterStore, "function");
assert.equal(typeof bootstrap.initSecrets, "function");
`;
  run(process.execPath, ["--input-type=module", "-e", esm], { cwd: consumer });

  const browser = spawnSync(
    process.execPath,
    [
      "--conditions=browser",
      "-e",
      'require("@aifabrix/miso-client/bootstrap")',
    ],
    { cwd: consumer, encoding: "utf8" },
  );
  assert.notEqual(browser.status, 0, "browser condition must reject bootstrap");
  assert.match(browser.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/);
}

function verifyExpressTypes(consumer) {
  cpSync(fixture, consumer, { recursive: true });
  run(
    process.execPath,
    [join(consumer, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
    { cwd: consumer },
  );
}

assert.ok(
  existsSync(join(root, "dist/index.js")),
  "build dist before packed proof",
);
mkdirSync(evidence, { recursive: true });
const packed = npm(
  ["pack", "--ignore-scripts", "--json", "--pack-destination", evidence],
  root,
);
const packResult = JSON.parse(packed.stdout);
const tarball = join(evidence, packResult[0].filename);
const consumers = [];

try {
  const withoutExpress = installConsumer(tarball);
  consumers.push(withoutExpress);
  verifyRuntime(withoutExpress);

  for (const major of ["4", "5"]) {
    const consumer = installConsumer(tarball, major);
    consumers.push(consumer);
    verifyExpressTypes(consumer);
  }

  console.log(`PASS: packed consumers on ${process.version}: ${tarball}`);
} finally {
  for (const consumer of consumers) {
    rmSync(consumer, { recursive: true, force: true });
  }
}
