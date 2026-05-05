import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function usageAndExit() {
  console.error(
    "Usage: node scripts/run-silent.mjs [--detach] <label> <logPath> <command>",
  );
  process.exit(2);
}

const args = process.argv.slice(2);
if (args[0] === "--") {
  args.shift();
}

const detachIndex = args.indexOf("--detach");
const detached = detachIndex !== -1;
if (detached) {
  args.splice(detachIndex, 1);
}

if (args.length < 3) {
  usageAndExit();
}

const [label, logPath, ...commandParts] = args;
const command = commandParts.join(" ").trim();

if (!command) {
  usageAndExit();
}

const logDir = path.dirname(logPath);
fs.mkdirSync(logDir, { recursive: true });
const outFd = fs.openSync(logPath, "w");

const child = spawn(command, {
  cwd: process.cwd(),
  env: process.env,
  shell: true,
  detached,
  stdio: ["ignore", outFd, outFd],
});

if (detached) {
  child.unref();
  fs.closeSync(outFd);
  console.log(`[${label}] STARTED (pid ${child.pid}) | log: ${logPath}`);
  process.exit(0);
}

child.on("close", (code) => {
  fs.closeSync(outFd);
  if (code === 0) {
    console.log(`[${label}] PASS | log: ${logPath}`);
    process.exit(0);
    return;
  }

  const exitCode = typeof code === "number" ? code : 1;
  console.log(`[${label}] FAIL (exit ${exitCode}) | log: ${logPath}`);
  process.exit(exitCode);
});
