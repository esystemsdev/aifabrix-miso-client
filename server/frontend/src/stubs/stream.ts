// Stream stub for browser compatibility
// jws package uses stream.Readable.from()

class ReadableStub {
  static from(iterable: any) {
    const instance = new ReadableStub();
    return instance;
  }
  constructor() {}
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

const stream = {
  Readable: ReadableStub,
  Writable: WritableStub,
  Transform: TransformStub,
  Duplex: DuplexStub,
  PassThrough: PassThroughStub,
};

// ESM exports
export default stream;
export { stream };

// CommonJS exports for compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = stream;
  module.exports.default = stream;
  module.exports.stream = stream;
}
