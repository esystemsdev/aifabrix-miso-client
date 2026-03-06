/**
 * Browser stub for Node.js async_hooks module.
 * AsyncLocalStorage is Node-only; in the browser we provide a no-op implementation
 * so the SDK logger context code path does not throw "AsyncLocalStorage is not a constructor".
 */

class AsyncLocalStorageStub {
  getStore() {
    return undefined;
  }

  enterWith() {}

  run(_store, fn) {
    return fn();
  }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = { AsyncLocalStorage: AsyncLocalStorageStub };
  module.exports.AsyncLocalStorage = AsyncLocalStorageStub;
}

export { AsyncLocalStorageStub as AsyncLocalStorage };
export default { AsyncLocalStorage: AsyncLocalStorageStub };
