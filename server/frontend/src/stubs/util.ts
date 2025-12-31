// Util stub for browser compatibility
// Define inherits function separately to ensure it's properly bound
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inherits(ctor: any, superCtor: any) {
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

const util = {
  inherits: inherits,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inspect: (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promisify: (fn: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function(...args: any[]) {
      return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fn(...args, (err: any, result: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    };
  },
};

export default util;
export { util };

// CommonJS exports - ensure inherits is directly accessible
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  // Set module.exports to util object, but ensure inherits is a function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exportsObj: any = {
    ...util,
    inherits: inherits, // Explicitly set as function
    default: util,
    util: util,
    inspect: util.inspect,
    promisify: util.promisify,
  };
  module.exports = exportsObj;
}

// ESM exports (for import statements)
if (typeof exports !== 'undefined') {
  exports.default = util;
  exports.util = util;
  exports.inherits = inherits;
  exports.inspect = util.inspect;
  exports.promisify = util.promisify;
}

// Also export inherits as a named export
export { inherits };
