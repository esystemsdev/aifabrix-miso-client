#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "src");

const FORBIDDEN_MARKERS = [
  "TEMP TRACE",
  "DEBUG TRACE",
  "TRACE SNAPSHOT",
  "DP-OUTBOUND-144.5",
  "Redis raw payload snapshot",
];

const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
]);

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (ALLOWED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
}

function locateForbiddenMarkers() {
  const files = [];
  walk(SOURCE_DIR, files);
  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const marker of FORBIDDEN_MARKERS) {
      let index = content.indexOf(marker);
      while (index !== -1) {
        const lineNumber = content.slice(0, index).split("\n").length;
        violations.push({
          file: path.relative(ROOT, file),
          marker,
          lineNumber,
        });
        index = content.indexOf(marker, index + marker.length);
      }
    }
  }

  return violations;
}

if (!fs.existsSync(SOURCE_DIR)) {
  console.error("Source directory not found:", SOURCE_DIR);
  process.exit(1);
}

const violations = locateForbiddenMarkers();
if (violations.length > 0) {
  console.error(
    "Forbidden temporary trace/debug markers found in production SDK code:",
  );
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.lineNumber} -> ${violation.marker}`,
    );
  }
  process.exit(1);
}

console.log("Forbidden marker check passed (no temporary trace/debug markers).");
