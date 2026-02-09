/**
 * Unit tests for Node.js module stubs
 * Run with: pnpm test
 * 
 * These tests verify that all stubs export correctly and can be used
 * as expected by the bundled code. This catches issues before browser testing.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

describe('Node.js Module Stubs', () => {
  describe('buffer', () => {
    it('should export Buffer as a constructor', async () => {
      const buffer = await import('../buffer.ts');
      expect(buffer.Buffer).toBeDefined();
      expect(typeof buffer.Buffer.from).toBe('function');
      expect(buffer.Buffer.isBuffer).toBeDefined();
    });

    it('should allow Buffer.from() to be called', async () => {
      const buffer = await import('../buffer.ts');
      const result = buffer.Buffer.from('test');
      expect(result).toBeDefined();
      expect(typeof result.toString).toBe('function');
    });
  });

  describe('util', () => {
    it('should export inherits function', async () => {
      const util = await import('../util.js');
      expect(util.inherits).toBeDefined();
      expect(typeof util.inherits).toBe('function');
    });

    it('should export deprecate function', async () => {
      const util = await import('../util.js');
      expect(util.deprecate).toBeDefined();
      expect(typeof util.deprecate).toBe('function');
    });

    it('should allow inherits to be called', async () => {
      const util = await import('../util.js');
      function Parent() {}
      function Child() {}
      
      // Should not throw
      expect(() => util.inherits(Child, Parent)).not.toThrow();
      expect(Child.prototype).toBeDefined();
    });
  });

  describe('events', () => {
    it('should export EventEmitter as a class', async () => {
      const events = await import('../events.js');
      expect(events.EventEmitter).toBeDefined();
    });

    it('should allow EventEmitter to be extended', async () => {
      const events = await import('../events.js');
      class MyEmitter extends events.EventEmitter {}
      const emitter = new MyEmitter();
      expect(emitter).toBeInstanceOf(events.EventEmitter);
      expect(typeof emitter.on).toBe('function');
      expect(typeof emitter.emit).toBe('function');
    });
  });

  describe('process', () => {
    it('should export process object', async () => {
      const processStub = await import('../process.js');
      expect(processStub.default).toBeDefined();
      expect(processStub.default.env).toBeDefined();
      expect(processStub.default.version).toBeDefined();
    });

    it('should have process.env as an object', async () => {
      const processStub = await import('../process.js');
      expect(typeof processStub.default.env).toBe('object');
    });
  });

  describe('ioredis', () => {
    it('should export Redis as a constructor', async () => {
      const ioredis = await import('../ioredis.js');
      expect(ioredis.default).toBeDefined();
      expect(typeof ioredis.default).toBe('function');
    });

    it('should allow new Redis() to be called', async () => {
      const RedisModule = await import('../ioredis.js');
      const Redis = RedisModule.default;
      const redis = new Redis({});
      expect(redis).toBeDefined();
      expect(typeof redis.connect).toBe('function');
      expect(typeof redis.get).toBe('function');
    });
  });

  describe('redis-parser', () => {
    it('should export Parser as a constructor', async () => {
      const parser = await import('../redis-parser.js');
      expect(parser.Parser).toBeDefined();
      expect(typeof parser.Parser).toBe('function');
    });

    it('should allow new Parser() to be called', async () => {
      const parserModule = await import('../redis-parser.js');
      const Parser = parserModule.Parser;
      const parser = new Parser();
      expect(parser).toBeDefined();
    });
  });

  describe('@ioredis/commands', () => {
    it('should export an array as default', async () => {
      const commands = await import('../ioredis-commands.js');
      expect(Array.isArray(commands.default)).toBe(true);
    });

    it('should allow .reduce() to be called on default export', async () => {
      const commandsModule = await import('../ioredis-commands.js');
      const commands = commandsModule.default;
      expect(Array.isArray(commands)).toBe(true);
      
      // This is what cli-options.js does - CRITICAL TEST
      const result = commands.reduce((acc, cmd) => {
        acc[cmd] = true;
        return acc;
      }, {});
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should export list as an array', async () => {
      const commandsModule = await import('../ioredis-commands.js');
      expect(Array.isArray(commandsModule.list)).toBe(true);
    });

    it('should export exists, hasFlag, getKeyIndexes functions', async () => {
      const commandsModule = await import('../ioredis-commands.js');
      expect(typeof commandsModule.exists).toBe('function');
      expect(typeof commandsModule.hasFlag).toBe('function');
      expect(typeof commandsModule.getKeyIndexes).toBe('function');
    });
  });

  describe('querystring', () => {
    it('should export parse and stringify functions', async () => {
      const qs = await import('../querystring.js');
      expect(typeof qs.default.parse).toBe('function');
      expect(typeof qs.default.stringify).toBe('function');
    });
  });

  describe('zlib', () => {
    it('should export compression functions', async () => {
      const zlib = await import('../zlib.js');
      expect(typeof zlib.default.deflate).toBe('function');
      expect(typeof zlib.default.inflate).toBe('function');
    });
  });
});

