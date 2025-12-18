// @ioredis/commands stub for browser compatibility
// Redis commands are server-side only
// The actual package exports: list, exists, hasFlag, getKeyIndexes

// Return an actual array - this is what cli-options.js expects
// It's trying to call .reduce() on the default export
const listStub = [];

// Stub functions
const existsStub = function(command) { return false; };
const hasFlagStub = function(command, flag) { return false; };
const getKeyIndexesStub = function(command, args) { return []; };

// CommonJS export - export list as default (array), plus named exports
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  // Default export is the array (for: const commands = require('@ioredis/commands'))
  module.exports = listStub;
  // Also add named exports
  module.exports.list = listStub;
  module.exports.exists = existsStub;
  module.exports.hasFlag = hasFlagStub;
  module.exports.getKeyIndexes = getKeyIndexesStub;
  module.exports.default = listStub;
}

// ESM export - default is the array
export default listStub;
export const list = listStub;
export const exists = existsStub;
export const hasFlag = hasFlagStub;
export const getKeyIndexes = getKeyIndexesStub;

