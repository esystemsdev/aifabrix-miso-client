// ioredis stub for browser compatibility
// Redis is a server-side service and shouldn't run in the browser

class RedisStub {
  constructor(options) {
    this.options = options || {};
    this.connected = false;
  }

  async connect() {
    console.warn('[Redis Stub] Redis.connect() called in browser - Redis is server-side only');
    this.connected = true;
    return Promise.resolve();
  }

  async disconnect() {
    this.connected = false;
    return Promise.resolve();
  }

  async get(key) {
    return null;
  }

  async set(key, value) {
    return 'OK';
  }

  async del(key) {
    return 0;
  }

  async rpush(key, value) {
    return 0;
  }

  async lpop(key) {
    return null;
  }

  async exists(key) {
    return 0;
  }

  async expire(key, seconds) {
    return 0;
  }

  async keys(pattern) {
    return [];
  }

  isConnected() {
    return false;
  }

  on() {
    return this;
  }

  off() {
    return this;
  }

  once() {
    return Promise.resolve({});
  }

  emit() {
    return false;
  }
}

// Default export
const Redis = RedisStub;

// CommonJS export
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = Redis;
  module.exports.default = Redis;
  module.exports.Redis = RedisStub;
}

// ESM export
export default Redis;
export { Redis, RedisStub };

