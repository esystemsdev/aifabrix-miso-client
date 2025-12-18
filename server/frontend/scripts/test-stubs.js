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

function test(name, fn) {
  tests++;
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    errors++;
    console.error(`❌ ${name}: ${error.message}`);
    if (error.stack) {
      console.error(error.stack.split('\n').slice(0, 3).join('\n'));
    }
  }
}

console.log('🧪 Testing Node.js stubs...\n');

// Test ioredis-commands - CRITICAL: This catches the reduce() error
test('@ioredis/commands exports array as default', () => {
  // Clear require cache
  const stubPath = path.join(stubsDir, 'ioredis-commands.js');
  delete require.cache[require.resolve(stubPath)];
  
  const commands = require(stubPath);
  
  if (!Array.isArray(commands)) {
    throw new Error(`Expected array, got ${typeof commands}`);
  }
  
  // This is what cli-options.js does
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

// Test Buffer
test('Buffer.from() works', () => {
  const stubPath = path.join(stubsDir, 'buffer.ts');
  delete require.cache[require.resolve(stubPath)];
  
  const buffer = require(stubPath);
  
  if (!buffer.Buffer || typeof buffer.Buffer.from !== 'function') {
    throw new Error('Buffer.from should be a function');
  }
  
  const result = buffer.Buffer.from('test');
  if (typeof result.toString !== 'function') {
    throw new Error('Buffer instance should have toString method');
  }
});

// Test ioredis
test('ioredis exports Redis constructor', () => {
  const stubPath = path.join(stubsDir, 'ioredis.js');
  delete require.cache[require.resolve(stubPath)];
  
  const Redis = require(stubPath);
  
  if (typeof Redis !== 'function') {
    throw new Error('Redis should be a constructor');
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

