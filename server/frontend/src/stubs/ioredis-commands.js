// @ioredis/commands stub for browser compatibility
// Redis commands are server-side only
// CRITICAL: This must work with Vite's CommonJS transformation

const listStub = []; // Empty array - commands are server-side only

// Stub functions
const existsStub = function(command) { return false; };
const hasFlagStub = function(command, flag) { return false; };
const getKeyIndexesStub = function(command, args) { return []; };

// Add properties to the array BEFORE exporting
listStub.list = listStub;
listStub.exists = existsStub;
listStub.hasFlag = hasFlagStub;
listStub.getKeyIndexes = getKeyIndexesStub;

// CRITICAL: Vite's CommonJS plugin transforms require() to import
// When it does: const commands = require('@ioredis/commands')
// It becomes: import commands_default from '@ioredis/commands'; const commands = commands_default.default || commands_default
// So we need BOTH: default export as array AND module.exports as array

// CommonJS export - Export the array itself
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  // Set module.exports to the array directly
  module.exports = listStub;
  
  // CRITICAL: Also set .default so Vite's transformation works
  // When Vite transforms: const x = require('@ioredis/commands')
  // It does: import x_default from '@ioredis/commands'; const x = x_default.default || x_default
  // So x_default.default must be the array
  Object.defineProperty(module.exports, 'default', {
    value: listStub,
    enumerable: true,
    writable: false,
    configurable: false
  });
  
  // Ensure properties are available
  module.exports.list = listStub;
  module.exports.exists = existsStub;
  module.exports.hasFlag = hasFlagStub;
  module.exports.getKeyIndexes = getKeyIndexesStub;
  
  // CRITICAL: Ensure it's still an array after all property assignments
  if (!Array.isArray(module.exports)) {
    Object.setPrototypeOf(module.exports, Array.prototype);
  }
}

// ESM export - default MUST be the array
// Vite uses this when transforming CommonJS require() calls
export default listStub;
export const list = listStub;
export const exists = existsStub;
export const hasFlag = hasFlagStub;
export const getKeyIndexes = getKeyIndexesStub;

// CRITICAL: Also export as __esModule for CommonJS interop
// This helps Vite's CommonJS plugin understand the module structure
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  Object.defineProperty(module.exports, '__esModule', {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false
  });
}
