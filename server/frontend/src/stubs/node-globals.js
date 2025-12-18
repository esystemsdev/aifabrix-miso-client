// Comprehensive Node.js globals polyfill for browser
// This file sets up all common Node.js globals that might be referenced

// Process stub
if (typeof process === 'undefined') {
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

  if (typeof window !== 'undefined') {
    window.process = processStub;
  }
  if (typeof global !== 'undefined') {
    global.process = processStub;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.process = processStub;
  }
}

// Buffer stub (if not already set)
if (typeof Buffer === 'undefined') {
  class BufferStub {
    static from(data, encoding) {
      const stub = new BufferStub();
      stub._data = data;
      stub._encoding = encoding;
      return stub;
    }
    
    static alloc(size, fill, encoding) {
      const stub = new BufferStub();
      stub._size = size;
      stub._fill = fill;
      stub._encoding = encoding;
      return stub;
    }
    
    static allocUnsafe(size) {
      return BufferStub.alloc(size);
    }
    
    static isBuffer(obj) {
      return obj instanceof BufferStub;
    }
    
    toString(encoding) {
      if (this._data !== undefined) {
        if (typeof this._data === 'string') {
          return this._data;
        }
        if (this._data && typeof this._data.toString === 'function') {
          return this._data.toString();
        }
      }
      return '';
    }
    
    toJSON() {
      return { type: 'Buffer', data: [] };
    }
    
    length = 0;
  }

  if (typeof window !== 'undefined') {
    window.Buffer = BufferStub;
  }
  if (typeof global !== 'undefined') {
    global.Buffer = BufferStub;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.Buffer = BufferStub;
  }
}

// Global object setup
if (typeof global === 'undefined') {
  if (typeof window !== 'undefined') {
    window.global = window;
  } else if (typeof globalThis !== 'undefined') {
    globalThis.global = globalThis;
  }
}

console.log('✅ Node.js globals polyfill loaded');

