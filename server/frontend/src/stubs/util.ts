// Util stub for browser compatibility
// Define inherits function separately to ensure it's properly bound
function inherits(ctor: any, superCtor: any) {
  if (superCtor) {
    ctor.super_ = superCtor;
    // Set up prototype chain
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  }
}

const util = {
  inherits: inherits,
  inspect: (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  },
  promisify: (fn: any) => {
    return function(...args: any[]) {
      return new Promise((resolve, reject) => {
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
