// Browser stubs for Node.js built-in modules
// These modules are not available in the browser and are stubbed out

// Stream stub - minimal implementation for jws package
// jws uses stream.Readable.from() method
class ReadableStub {
  static from(iterable: any) {
    const instance = new ReadableStub();
    return instance;
  }
  constructor() {
    // Empty constructor
  }
  pipe() { return {}; }
  on() { return this; }
  once() { return Promise.resolve({}); }
  read() { return null; }
  push() { return true; }
  destroy() {}
  emit() { return false; }
  removeListener() { return this; }
  removeAllListeners() { return this; }
}

class WritableStub {
  write() { return true; }
  end() { return this; }
  on() { return this; }
  once() { return Promise.resolve({}); }
  destroy() {}
}

class TransformStub extends ReadableStub {
  _transform() {}
}

class DuplexStub extends ReadableStub {
  write() { return true; }
  end() { return this; }
}

class PassThroughStub extends TransformStub {}

export const stream = {
  Readable: ReadableStub,
  Writable: WritableStub,
  Transform: TransformStub,
  Duplex: DuplexStub,
  PassThrough: PassThroughStub,
};

// Util stub
export const util = {
  inherits: () => {},
  inspect: () => '',
  promisify: (fn: any) => fn,
};

// Crypto stub - browser uses Web Crypto API instead
export const crypto = {
  createHash: () => ({
    update: () => ({ digest: () => '' }),
  }),
  randomBytes: () => Buffer.from([]),
};

// Path stub
export const path = {
  join: (...args: string[]) => args.join('/'),
  resolve: (...args: string[]) => args.join('/'),
  dirname: () => '',
  basename: () => '',
  extname: () => '',
};

// Other stubs
export const fs = {};
export const net = {};
export const tls = {};
export const events = {
  EventEmitter: class {},
};
export const buffer = {
  Buffer: class {},
};
export const os = {
  platform: () => 'browser',
  arch: () => 'x64',
};
export const dns = {};
export const assert = {
  ok: () => {},
  equal: () => {},
  strictEqual: () => {},
};
export const string_decoder = {
  StringDecoder: class {},
};
export const url = {
  parse: () => ({}),
  format: () => '',
  resolve: () => '',
};

// Default exports for CommonJS compatibility
export default {
  stream,
  util,
  crypto,
  path,
  fs,
  net,
  tls,
  events,
  buffer,
  os,
  dns,
  assert,
  string_decoder,
  url,
};

