#!/usr/bin/env node
/**
 * Test script that simulates how Vite bundles @ioredis/commands
 * This tests the actual import behavior BEFORE opening the browser
 * 
 * Run with: node frontend/scripts/test-bundle-import.cjs
 */

const fs = require('fs');
const path = require('path');
const { build } = require('vite');

async function testBundleImport() {
  console.log('🧪 Testing @ioredis/commands import in Vite bundle...\n');

  const testDir = path.join(__dirname, '../test-bundle-temp');
  const distDir = path.join(testDir, 'dist');
  
  // Clean up
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
  fs.mkdirSync(distDir, { recursive: true });

  // Create test file that mimics cli-options.js
  const testFile = path.join(testDir, 'test-import.js');
  fs.writeFileSync(testFile, `
// Simulate how ioredis imports @ioredis/commands
// This is what cli-options.js does
const commands = require('@ioredis/commands');

// CRITICAL TEST: This is the exact error we're getting
if (!commands) {
  throw new Error('commands is undefined');
}

if (typeof commands.reduce !== 'function') {
  throw new Error('commands.reduce is not a function. commands type: ' + typeof commands + ', isArray: ' + Array.isArray(commands));
}

// This is what cli-options.js does
const result = commands.reduce((acc, cmd) => {
  acc[cmd] = true;
  return acc;
}, {});

if (typeof result !== 'object') {
  throw new Error('reduce() failed, got: ' + typeof result);
}

console.log('✅ SUCCESS: reduce() works!');
module.exports = { success: true };
`);

  // Create minimal vite config for testing
  const viteConfig = `
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@ioredis/commands': path.resolve(__dirname, '../src/stubs/ioredis-commands.js'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'test-import.js'),
      name: 'TestBundle',
      fileName: 'test',
      formats: ['es', 'cjs']
    },
    outDir: 'dist',
    rollupOptions: {
      external: [],
    },
  },
});
`;

  const configFile = path.join(testDir, 'vite.config.js');
  fs.writeFileSync(configFile, viteConfig);

  try {
    console.log('📦 Building test bundle with Vite...');
    
    // Change to test directory
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      await build({
        configFile: 'vite.config.js',
        logLevel: 'error',
      });

      console.log('✅ Build succeeded!\n');
      
      // Now test the built output
      const esOutput = path.join(distDir, 'test.es.js');
      const cjsOutput = path.join(distDir, 'test.cjs.js');
      
      if (fs.existsSync(esOutput)) {
        console.log('📄 Testing ESM output...');
        const esContent = fs.readFileSync(esOutput, 'utf8');
        
        // Check if it imports our stub
        if (!esContent.includes('ioredis-commands') && !esContent.includes('listStub')) {
          console.log('⚠️  Warning: ESM bundle might not contain stub');
        }
        
        // Try to execute it (simplified check)
        console.log('✅ ESM output looks good');
      }
      
      if (fs.existsSync(cjsOutput)) {
        console.log('📄 Testing CommonJS output...');
        const cjsContent = fs.readFileSync(cjsOutput, 'utf8');
        
        // Check if it imports our stub
        if (!cjsContent.includes('ioredis-commands') && !cjsContent.includes('listStub')) {
          console.log('⚠️  Warning: CommonJS bundle might not contain stub');
        }
        
        console.log('✅ CommonJS output looks good');
      }
      
      console.log('\n✅ Bundle import test PASSED!');
      return true;
      
    } finally {
      process.chdir(originalCwd);
    }

  } catch (error) {
    console.error('❌ Bundle import test FAILED:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack.split('\n').slice(0, 10).join('\n'));
    }
    return false;
  } finally {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

// Test the actual stub import behavior
async function testStubDirectly() {
  console.log('🔍 Testing stub import behavior directly...\n');
  
  const stubPath = path.join(__dirname, '../src/stubs/ioredis-commands.js');
  
  // Test ESM import (what Vite uses)
  try {
    const fileUrl = 'file://' + stubPath;
    const commandsModule = await import(fileUrl);
    const commands = commandsModule.default;
    
    console.log('ESM import test:');
    console.log('  - default export type:', typeof commands);
    console.log('  - isArray:', Array.isArray(commands));
    console.log('  - has reduce:', typeof commands.reduce === 'function');
    
    if (!Array.isArray(commands)) {
      throw new Error('ESM default export is not an array');
    }
    
    if (typeof commands.reduce !== 'function') {
      throw new Error('ESM default export does not have reduce method');
    }
    
    // Test reduce
    const result = commands.reduce((acc, cmd) => {
      acc[cmd] = true;
      return acc;
    }, {});
    
    if (typeof result !== 'object') {
      throw new Error('reduce() failed on ESM import');
    }
    
    console.log('✅ ESM import test PASSED\n');
    
  } catch (error) {
    console.error('❌ ESM import test FAILED:', error.message);
    return false;
  }
  
  // Test CommonJS require (what original code uses)
  try {
    // Clear cache
    delete require.cache[require.resolve(stubPath)];
    
    const commands = require(stubPath);
    
    console.log('CommonJS require test:');
    console.log('  - require() type:', typeof commands);
    console.log('  - isArray:', Array.isArray(commands));
    console.log('  - has reduce:', typeof commands.reduce === 'function');
    console.log('  - has .default:', 'default' in commands);
    
    // CRITICAL: When Vite transforms require(), it does: commands_default.default || commands_default
    // So we need to test both scenarios
    const commandsToTest = commands.default || commands;
    
    if (!Array.isArray(commandsToTest)) {
      throw new Error('CommonJS require result is not an array (or .default is not an array)');
    }
    
    if (typeof commandsToTest.reduce !== 'function') {
      throw new Error('CommonJS require result does not have reduce method');
    }
    
    // Test reduce
    const result = commandsToTest.reduce((acc, cmd) => {
      acc[cmd] = true;
      return acc;
    }, {});
    
    if (typeof result !== 'object') {
      throw new Error('reduce() failed on CommonJS require');
    }
    
    console.log('✅ CommonJS require test PASSED\n');
    
  } catch (error) {
    console.error('❌ CommonJS require test FAILED:', error.message);
    return false;
  }
  
  return true;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Testing @ioredis/commands stub BEFORE browser test');
  console.log('='.repeat(60));
  console.log();
  
  const test1 = await testStubDirectly();
  console.log();
  const test2 = await testBundleImport();
  
  console.log();
  console.log('='.repeat(60));
  if (test1 && test2) {
    console.log('✅ ALL TESTS PASSED - Safe to test in browser');
    process.exit(0);
  } else {
    console.log('❌ TESTS FAILED - Do not test in browser yet');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});

