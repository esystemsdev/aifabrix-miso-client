// Buffer stub for browser compatibility
class BufferStub {
  static from(data?: unknown, _encoding?: string) {
    const stub = new BufferStub();
    stub._data = data;
    return stub;
  }

  static alloc(size: number, fill?: unknown, _encoding?: string) {
    const stub = new BufferStub();
    stub._size = size;
    stub._fill = fill;
    return stub;
  }

  static allocUnsafe(size: number) {
    return BufferStub.alloc(size);
  }

  static isBuffer(obj: unknown): boolean {
    return obj instanceof BufferStub;
  }

  _data?: unknown;
  _encoding?: string;
  _size?: number;
  _fill?: unknown;

  toString(_encoding?: string): string {
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

// Make Buffer available globally for browser compatibility
// Set on both window and globalThis for maximum compatibility
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).Buffer = BufferStub;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as unknown as Record<string, unknown>).Buffer = BufferStub;
}
// Also set on global for Node.js-like environments
if (typeof global !== 'undefined') {
  (global as unknown as Record<string, unknown>).Buffer = BufferStub;
}
