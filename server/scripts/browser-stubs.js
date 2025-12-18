/**
 * Browser stubs for Node.js modules
 * These are injected by esbuild to replace Node.js-only imports
 */

// Stub for MisoClient (not needed in browser for HTTP requests)
export const MisoClient = class {
  constructor() {}
  async initialize() {
    return Promise.resolve();
  }
  async disconnect() {
    return Promise.resolve();
  }
};

