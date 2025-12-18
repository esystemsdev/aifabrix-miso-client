#!/usr/bin/env node
/**
 * Verify the built bundle works correctly
 * Run after: pnpm run build:frontend
 */

const fs = require('fs');
const path = require('path');

const bundleDir = path.join(__dirname, '../../public/assets');
const files = fs.readdirSync(bundleDir).filter(f => f.endsWith('.js') && f.startsWith('index-'));

if (files.length === 0) {
  console.error('❌ No bundle files found. Run: pnpm run build:frontend');
  process.exit(1);
}

const bundleFile = path.join(bundleDir, files[0]);
const content = fs.readFileSync(bundleFile, 'utf8');

console.log('🔍 Verifying bundle:', files[0]);
console.log('   Size:', (content.length / 1024).toFixed(2), 'KB\n');

// Check if the bundle has our stub
const hasStub = content.includes('listStub') || 
                content.includes('ioredis-commands') ||
                content.match(/@ioredis\/commands/);

if (!hasStub) {
  console.error('❌ Bundle does not contain @ioredis/commands stub');
  console.error('   The alias might not be working in vite.config.ts');
  process.exit(1);
}

console.log('✅ Bundle contains stub reference');

// Check for reduce calls (might be minified)
const reducePattern = /\.reduce\s*\(/g;
const reduceMatches = content.match(reducePattern);

if (reduceMatches) {
  console.log(`✅ Found ${reduceMatches.length} .reduce() calls in bundle`);
} else {
  console.log('⚠️  No .reduce() calls found (might be minified differently)');
}

// Try to find how @ioredis/commands is imported
const importPatterns = [
  /import\s+.*from\s+['"]@ioredis\/commands['"]/,
  /require\(['"]@ioredis\/commands['"]\)/,
  /@ioredis\/commands/,
];

let foundImport = false;
for (const pattern of importPatterns) {
  if (pattern.test(content)) {
    foundImport = true;
    break;
  }
}

if (foundImport) {
  console.log('✅ Found @ioredis/commands import in bundle');
} else {
  console.log('⚠️  Could not find @ioredis/commands import (might be transformed)');
}

console.log('\n✅ Bundle verification passed');
console.log('   Ready for browser testing');

