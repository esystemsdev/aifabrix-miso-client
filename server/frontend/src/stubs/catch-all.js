// Catch-all stub for any Node.js module that isn't explicitly stubbed
// This prevents "module not found" errors and provides basic functionality

// Create a constructor function that can be used with 'new'
function CatchAllStub() {
  // Return an object when called as constructor
  return {};
}

// Make it callable as a function too
CatchAllStub.prototype = {};
CatchAllStub.prototype.constructor = CatchAllStub;

// Add common properties that modules might expect
const catchAllStub = CatchAllStub;
catchAllStub.default = CatchAllStub;
catchAllStub.CatchAllStub = CatchAllStub;

// Make it work as both object and constructor
Object.setPrototypeOf(catchAllStub, Function.prototype);

// CommonJS export
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = catchAllStub;
  module.exports.default = catchAllStub;
}

// ESM export
export default catchAllStub;


