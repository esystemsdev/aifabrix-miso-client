// Buffer stub for browser compatibility
class BufferStub {
  static from(data?: any, encoding?: string) {
    const stub = new BufferStub();
    stub._data = data;
    stub._encoding = encoding;
    return stub;
  }
  
  static alloc(size: number, fill?: any, encoding?: string) {
    const stub = new BufferStub();
    stub._size = size;
    stub._fill = fill;
    stub._encoding = encoding;
    return stub;
  }
  
  static allocUnsafe(size: number) {
    return BufferStub.alloc(size);
  }
  
  static isBuffer(obj: any): boolean {
    return obj instanceof BufferStub;
  }
  
  _data?: any;
  _encoding?: string;
  _size?: number;
  _fill?: any;
  
  toString(encoding?: string): string {
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

// Export Buffer as both named export and default
export const Buffer = BufferStub;

const buffer = {
  Buffer: BufferStub,
};

export default buffer;

// CommonJS exports (primary) - match Node.js buffer module structure
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = buffer;
  module.exports.Buffer = BufferStub;
  module.exports.default = buffer;
  module.exports.buffer = buffer;
}

// ESM exports (for import statements)
if (typeof exports !== 'undefined') {
  exports.default = buffer;
  exports.buffer = buffer;
  exports.Buffer = BufferStub;
}

// Make Buffer available globally for browser compatibility
// Set on both window and globalThis for maximum compatibility
if (typeof window !== 'undefined') {
  (window as any).Buffer = BufferStub;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = BufferStub;
}
// Also set on global for Node.js-like environments
if (typeof global !== 'undefined') {
  (global as any).Buffer = BufferStub;
}
