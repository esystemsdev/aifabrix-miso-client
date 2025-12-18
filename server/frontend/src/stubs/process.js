// Process stub for browser compatibility
// Node.js process global object stub

const processStub = {
  env: {},
  version: 'v18.0.0',
  versions: {
    node: '18.0.0',
    v8: '10.0.0',
    uv: '1.0.0',
    zlib: '1.0.0',
    ares: '1.0.0',
    modules: '108',
    nghttp2: '1.0.0',
    napi: '8',
    llhttp: '6.0.0',
    openssl: '3.0.0',
    cldr: '41.0',
    icu: '71.1',
    tz: '2022a',
    unicode: '14.0',
    ngtcp2: '0.8.1',
    nghttp3: '0.7.0'
  },
  platform: 'browser',
  arch: 'x64',
  pid: 1,
  nextTick: function(callback) {
    setTimeout(callback, 0);
  },
  cwd: function() {
    return '/';
  },
  exit: function(code) {
    console.warn('process.exit called with code:', code);
  },
  on: function() {},
  off: function() {},
  emit: function() {},
  browser: true,
  type: 'browser'
};

// Make process available globally
if (typeof window !== 'undefined') {
  window.process = processStub;
}
if (typeof global !== 'undefined') {
  global.process = processStub;
}
if (typeof globalThis !== 'undefined') {
  globalThis.process = processStub;
}

// CommonJS export
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = processStub;
  module.exports.default = processStub;
}

// ESM export
export default processStub;

