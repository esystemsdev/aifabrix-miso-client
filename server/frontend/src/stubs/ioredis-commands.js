// @ioredis/commands stub for browser compatibility
// Redis commands are server-side only
// CRITICAL: This must work with Vite's CommonJS transformation

const listStub = []; // Empty array - commands are server-side only

// Stub functions
const existsStub = function (command) {
  return false;
};
const hasFlagStub = function (command, flag) {
  return false;
};
const getKeyIndexesStub = function (command, args) {
  return [];
};

// Add properties to the array BEFORE exporting
listStub.list = listStub;
listStub.exists = existsStub;
listStub.hasFlag = hasFlagStub;
listStub.getKeyIndexes = getKeyIndexesStub;

// ESM export - default MUST be the array
// Vite uses this when transforming CommonJS require() calls
export default listStub;
export const list = listStub;
export const exists = existsStub;
export const hasFlag = hasFlagStub;
export const getKeyIndexes = getKeyIndexesStub;
