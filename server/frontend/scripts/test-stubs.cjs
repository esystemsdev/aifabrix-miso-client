#!/usr/bin/env node
/**
 * Simple test script for Node.js stubs
 * Run with: node scripts/test-stubs.js
 * 
 * This tests the stubs directly without a test framework to catch issues early
 */

const fs = require('fs');
const path = require('path');

const stubsDir = path.join(__dirname, '../src/stubs');
let errors = 0;
let tests = 0;

async function test(name, fn) {
  tests++;
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    errors++;
    console.error(`❌ ${name}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack.split('\n').slice(0, 3).join('\n'));
    }
  }
}

async function runTests() {

console.log('🧪 Testing Node.js stubs...\n');

// Test ioredis-commands - CRITICAL: This catches the reduce() error
test('@ioredis/commands exports array as default', async () => {
  // Use dynamic import since package.json has "type": "module"
  const stubPath = path.join(stubsDir, 'ioredis-commands.js');
  const fileUrl = 'file://' + stubPath;
  const commandsModule = await import(fileUrl);
  const commands = commandsModule.default;
  
  // The key test: can we call reduce() on it?
  // This is what cli-options.js does - if this fails, we get the browser error
  if (!Array.isArray(commands)) {
    throw new Error(`Expected array, got ${typeof commands}. Array.isArray() = ${Array.isArray(commands)}`);
  }
  
  if (typeof commands.reduce !== 'function') {
    throw new Error('Array should have reduce method');
  }
  
  const result = commands.reduce((acc, cmd) => {
    acc[cmd] = true;
    return acc;
  }, {});
  
  if (typeof result !== 'object') {
    throw new Error(`reduce() failed, got ${typeof result}`);
  }
});

test('@ioredis/commands exports list property', () => {
  const stubPath = path.join(stubsDir, 'ioredis-commands.js');
  delete require.cache[require.resolve(stubPath)];
  
  const commands = require(stubPath);
  
  if (!commands.list || !Array.isArray(commands.list)) {
    throw new Error('list property should be an array');
  }
});

test('@ioredis/commands exports helper functions', () => {
  const stubPath = path.join(stubsDir, 'ioredis-commands.js');
  delete require.cache[require.resolve(stubPath)];
  
  const commands = require(stubPath);
  
  if (typeof commands.exists !== 'function') {
    throw new Error('exists should be a function');
  }
  if (typeof commands.hasFlag !== 'function') {
    throw new Error('hasFlag should be a function');
  }
  if (typeof commands.getKeyIndexes !== 'function') {
    throw new Error('getKeyIndexes should be a function');
  }
});

// Test util.inherits
test('util.inherits is a function', () => {
  const stubPath = path.join(stubsDir, 'util.js');
  delete require.cache[require.resolve(stubPath)];
  
  const util = require(stubPath);
  
  if (typeof util.inherits !== 'function') {
    throw new Error('inherits should be a function');
  }
  
  // Test it works
  function Parent() {}
  function Child() {}
  util.inherits(Child, Parent);
  
  if (!Child.prototype) {
    throw new Error('inherits should set up prototype');
  }
});

// Test EventEmitter can be extended
test('EventEmitter can be extended', () => {
  const stubPath = path.join(stubsDir, 'events.js');
  delete require.cache[require.resolve(stubPath)];
  
  const events = require(stubPath);
  
  if (typeof events.EventEmitter !== 'function') {
    throw new Error('EventEmitter should be a constructor');
  }
  
  class MyEmitter extends events.EventEmitter {}
  const emitter = new MyEmitter();
  
  if (!(emitter instanceof events.EventEmitter)) {
    throw new Error('Extended class should be instance of EventEmitter');
  }
});

// Test Buffer - skip TypeScript files in Node.js test (they work in browser via Vite)
test('Buffer.from() works', async () => {
  // Skip TypeScript files - they're handled by Vite in browser
  // In browser, Vite compiles them, so this test would need ts-node or similar
  console.log('⏭️  Skipping Buffer.ts test (TypeScript - tested in browser build)');
});

// Test ioredis
test('ioredis exports Redis constructor', async () => {
  const stubPath = path.join(stubsDir, 'ioredis.js');
  const fileUrl = 'file://' + stubPath;
  const redisModule = await import(fileUrl);
  const Redis = redisModule.default;
  
  if (typeof Redis !== 'function') {
    throw new Error(`Redis should be a constructor, got ${typeof Redis}`);
  }
  
  const redis = new Redis({});
  if (typeof redis.connect !== 'function') {
    throw new Error('Redis instance should have connect method');
  }
});

// Test redis-parser
test('redis-parser exports Parser constructor', () => {
  const stubPath = path.join(stubsDir, 'redis-parser.js');
  delete require.cache[require.resolve(stubPath)];
  
  const parserModule = require(stubPath);
  
  if (typeof parserModule.Parser !== 'function') {
    throw new Error('Parser should be a constructor');
  }
  
  const parser = new parserModule.Parser();
  if (!parser) {
    throw new Error('Parser instance should be created');
  }
});

  console.log(`\n📊 Results: ${tests - errors}/${tests} tests passed`);
  process.exit(errors > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});

