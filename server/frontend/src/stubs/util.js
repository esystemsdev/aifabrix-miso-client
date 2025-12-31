// Util stub for browser compatibility
// Define inherits function separately to ensure it's properly bound
function inherits(ctor, superCtor) {
  if (!superCtor) {
    // If superCtor is null/undefined, just return without error
    return;
  }
  
  // Get or create superCtor.prototype safely
  let superProto = superCtor.prototype;
  
  // If superCtor doesn't have a prototype, try to create one
  if (!superProto) {
    // Check if superCtor is extensible before trying to add prototype
    try {
      // Try to check if we can add properties
      if (Object.isExtensible && Object.isExtensible(superCtor)) {
        superCtor.prototype = {};
        superProto = superCtor.prototype;
      } else {
        // If not extensible, use Object.prototype as fallback
        superProto = Object.prototype;
      }
    } catch (e) {
      // If assignment fails (object not extensible), use Object.prototype
      superProto = Object.prototype;
    }
  }
  
  // Ensure superProto is an object (not null)
  if (typeof superProto !== 'object' || superProto === null) {
    superProto = Object.prototype;
  }
  
  ctor.super_ = superCtor;
  
  // Set up prototype chain
  // Use Object.create with proper fallback
  try {
    ctor.prototype = Object.create(superProto, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  } catch (e) {
    // Fallback: if Object.create fails, just copy the prototype
    try {
      ctor.prototype = Object.create(Object.prototype);
      ctor.prototype.constructor = ctor;
      // Copy properties from superProto if possible
      if (superProto && typeof superProto === 'object' && superProto !== Object.prototype) {
        for (const key in superProto) {
          if (superProto.hasOwnProperty(key)) {
            try {
              ctor.prototype[key] = superProto[key];
            } catch (copyError) {
              // Ignore errors when copying properties
            }
          }
        }
      }
    } catch (fallbackError) {
      // Last resort: create minimal prototype
      if (!ctor.prototype) {
        ctor.prototype = {};
      }
      if (!ctor.prototype.constructor) {
        ctor.prototype.constructor = ctor;
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

