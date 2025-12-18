// Util stub for browser compatibility
// Define inherits function separately to ensure it's properly bound
function inherits(ctor, superCtor) {
  if (!superCtor) {
    // If superCtor is null/undefined, just return without error
    return;
  }
  
  // Ensure superCtor has a prototype (it should be a constructor function)
  if (!superCtor.prototype) {
    // If superCtor doesn't have a prototype, create one
    superCtor.prototype = {};
  }
  
  // Ensure superCtor.prototype is an object (not null)
  if (typeof superCtor.prototype !== 'object' || superCtor.prototype === null) {
    superCtor.prototype = {};
  }
  
  ctor.super_ = superCtor;
  
  // Set up prototype chain
  // Use Object.create with proper fallback
  try {
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  } catch (e) {
    // Fallback: if Object.create fails, just copy the prototype
    ctor.prototype = Object.create(Object.prototype);
    ctor.prototype.constructor = ctor;
    // Copy properties from superCtor.prototype if possible
    if (superCtor.prototype && typeof superCtor.prototype === 'object') {
      for (const key in superCtor.prototype) {
        if (superCtor.prototype.hasOwnProperty(key)) {
          ctor.prototype[key] = superCtor.prototype[key];
        }
      }
    }
  }
}

function inspect(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function promisify(fn) {
  return function(...args) {
    return new Promise((resolve, reject) => {
      fn(...args, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };
}

function deprecate(fn, message) {
  let warned = false;
  return function(...args) {
    if (!warned) {
      console.warn('DeprecationWarning:', message);
      warned = true;
    }
    return fn.apply(this, args);
  };
}

const util = {
  inherits: inherits,
  inspect: inspect,
  promisify: promisify,
  deprecate: deprecate,
};

// CommonJS export (primary) - this is what require() looks for
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = util;
  module.exports.default = util;
  module.exports.util = util;
  module.exports.inherits = inherits;
  module.exports.inspect = inspect;
  module.exports.promisify = promisify;
  module.exports.deprecate = deprecate;
}

// ESM exports (for import statements)
if (typeof exports !== 'undefined') {
  exports.default = util;
  exports.util = util;
  exports.inherits = inherits;
  exports.inspect = inspect;
  exports.promisify = promisify;
  exports.deprecate = deprecate;
}

// Also export for ESM
export default util;
export { util, inherits, inspect, promisify, deprecate };

