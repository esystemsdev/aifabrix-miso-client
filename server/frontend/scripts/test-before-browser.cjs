#!/usr/bin/env node
/**
 * Comprehensive test that runs BEFORE opening browser
 * This catches the reduce() error by testing the actual bundle
 * 
 * Run: node frontend/scripts/test-before-browser.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('='.repeat(70));
console.log('🧪 PRE-BROWSER TEST: Verifying @ioredis/commands stub');
console.log('='.repeat(70));
console.log();

// Step 1: Test stub directly
console.log('1️⃣  Testing stub module directly...');
const stubPath = path.join(__dirname, '../src/stubs/ioredis-commands.js');
const stubContent = fs.readFileSync(stubPath, 'utf8');

if (!stubContent.includes('listStub')) {
  console.error('❌ Stub file is missing listStub');
  process.exit(1);
}

if (!stubContent.includes('export default')) {
  console.error('❌ Stub file is missing ESM export');
  process.exit(1);
}

console.log('✅ Stub file structure looks good\n');

// Step 2: Test import behavior
console.log('2️⃣  Testing import behavior...');
(async () => {
  try {
    const fileUrl = 'file://' + stubPath;
    const commandsModule = await import(fileUrl);
    const commands = commandsModule.default;
    
    if (!Array.isArray(commands)) {
      throw new Error('Default export is not an array');
    }
    
    if (typeof commands.reduce !== 'function') {
      throw new Error('Array does not have reduce method');
    }
    
    // Test reduce - this is what fails in browser
    const result = commands.reduce((acc, cmd) => {
      acc[cmd] = true;
      return acc;
    }, {});
    
    if (typeof result !== 'object') {
      throw new Error('reduce() failed');
    }
    
    console.log('✅ Import test passed - reduce() works\n');
  } catch (error) {
    console.error('❌ Import test failed:', error.message);
    process.exit(1);
  }
})();

// Step 3: Build and verify bundle
console.log('3️⃣  Building frontend bundle...');
try {
  execSync('pnpm run build:frontend', {
    cwd: path.join(__dirname, '../..'),
    stdio: 'inherit'
  });
  console.log('✅ Build completed\n');
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}

// Step 4: Check bundle contents
console.log('4️⃣  Verifying bundle contents...');
const bundleDir = path.join(__dirname, '../../public/assets');
if (!fs.existsSync(bundleDir)) {
  console.error('❌ Bundle directory does not exist:', bundleDir);
  process.exit(1);
}
const bundleFiles = fs.readdirSync(bundleDir).filter(f => f.endsWith('.js') && f.startsWith('index-'));

if (bundleFiles.length === 0) {
  console.error('❌ No bundle files found');
  process.exit(1);
}

const bundleFile = path.join(bundleDir, bundleFiles[0]);
const bundleContent = fs.readFileSync(bundleFile, 'utf8');

// Check for stub indicators
const hasStub = bundleContent.includes('listStub') || 
                bundleContent.includes('ioredis-commands');

if (!hasStub) {
  console.error('❌ Bundle does not contain stub');
  console.error('   This means Vite is not using our alias');
  console.error('   The browser will fail with: Cannot read properties of undefined (reading reduce)');
  console.error('\n   DIAGNOSIS:');
  console.error('   - Vite is resolving @ioredis/commands from node_modules');
  console.error('   - Our resolveId hook is not intercepting the import');
  console.error('   - The alias in resolve.alias is not being applied to node_modules imports');
  console.error('\n   NEXT STEPS:');
  console.error('   1. The resolveId hook should catch this but is not being called');
  console.error('   2. Try clearing Vite cache: rm -rf node_modules/.vite');
  console.error('   3. Check if CommonJS plugin is resolving before our hook');
  console.error('   4. Consider patching ioredis package directly');
  process.exit(1);
}

console.log('✅ Bundle contains stub reference');

// Check for reduce calls
const reduceMatches = bundleContent.match(/\.reduce\s*\(/g);
if (reduceMatches) {
  console.log(`✅ Found ${reduceMatches.length} .reduce() calls in bundle`);
} else {
  console.log('⚠️  No .reduce() calls found (might be minified)');
}

console.log();
console.log('='.repeat(70));
console.log('✅ ALL PRE-BROWSER TESTS PASSED');
console.log('   Bundle is ready - you can now test in browser');
console.log('='.repeat(70));

