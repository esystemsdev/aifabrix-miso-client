// Util stub for browser compatibility

type GenericObject = Record<string, unknown>;
type ConstructorLike = {
  prototype?: GenericObject;
  super_?: unknown;
  [key: string]: unknown;
};
type NodeStyleCallback<T> = (err: unknown, result: T) => void;
type CallbackFn<T> = (...args: [...unknown[], NodeStyleCallback<T>]) => void;

function inherits(ctor: ConstructorLike, superCtor: ConstructorLike): void {
  if (!superCtor) return;

  let superProto = superCtor.prototype;
  if (!superProto || typeof superProto !== "object") {
    superProto = Object.prototype;
  }

  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superProto, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true,
    },
  }) as GenericObject;
}

function inspect(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function promisify<T>(fn: CallbackFn<T>) {
  return (...args: unknown[]): Promise<T> =>
    new Promise((resolve, reject) => {
      fn(...args, (err: unknown, result: T) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
}

const util = { inherits, inspect, promisify };

export default util;
export { util, inherits };

// CommonJS exports for compatibility
if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = {
    ...util,
    default: util,
    util,
  };
}

// ESM-friendly named exports on CommonJS exports object
if (typeof exports !== "undefined") {
  exports.default = util;
  exports.util = util;
  exports.inherits = inherits;
  exports.inspect = inspect;
  exports.promisify = promisify;
}
