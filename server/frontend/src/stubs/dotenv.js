/**
 * Browser stub for dotenv
 * dotenv is Node.js-only and should not run in the browser
 */

// Stub for dotenv/config - does nothing in browser
export function config() {
  // No-op in browser
  return { parsed: {} };
}

// Stub for dotenv.parse
export function parse() {
  return {};
}

// Stub for dotenv.populate
export function populate() {
  // No-op
}

// Stub for dotenv.decrypt
export function decrypt() {
  return '';
}

// Stub for dotenv.configDotenv
export function configDotenv() {
  return { parsed: {} };
}

// Default export
export default {
  config,
  parse,
  populate,
  decrypt,
  configDotenv,
};

