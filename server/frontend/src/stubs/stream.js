// Stream stub for browser compatibility
// jws package uses stream.Readable.from()

class ReadableStub {
  static from(iterable) {
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

// CommonJS export (primary) - this is what require() looks for
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = stream;
  module.exports.default = stream;
  module.exports.stream = stream;
  module.exports.Readable = ReadableStub;
  module.exports.Writable = WritableStub;
  module.exports.Transform = TransformStub;
  module.exports.Duplex = DuplexStub;
  module.exports.PassThrough = PassThroughStub;
}

// ESM exports (for import statements)
if (typeof exports !== 'undefined') {
  exports.default = stream;
  exports.stream = stream;
  exports.Readable = ReadableStub;
  exports.Writable = WritableStub;
  exports.Transform = TransformStub;
  exports.Duplex = DuplexStub;
  exports.PassThrough = PassThroughStub;
}

// Also export for ESM
export default stream;
export { stream, ReadableStub as Readable, WritableStub as Writable };
