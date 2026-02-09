#!/usr/bin/env node
/**
 * Patch ioredis package to use our stub for @ioredis/commands
 * This runs after pnpm install to replace the import in ioredis files
 */

const fs = require('fs');
const path = require('path');

const ioredisDir = path.join(__dirname, '../../../node_modules/ioredis');
const stubPath = path.resolve(__dirname, '../src/stubs/ioredis-commands.js');

// Use @ioredis/commands package path instead of relative path
// This ensures Vite can resolve it correctly
const relativePath = '@ioredis/commands';

console.log('🔧 Patching ioredis package...');
console.log(`   Stub path: ${stubPath}`);
console.log(`   Relative path: ${relativePath}`);

// Files that import @ioredis/commands
const filesToPatch = [
  'built/Redis.js',
  'built/utils/Commander.js',
  'built/Pipeline.js',
  'built/cluster/index.js',
  'built/Command.js',
];

let patched = 0;
for (const file of filesToPatch) {
  const filePath = path.join(ioredisDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  File not found: ${file}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Replace require('@ioredis/commands') or the old patched path with our stub
  content = content.replace(
    /require\(['"]@ioredis\/commands['"]\)/g,
    `require('${relativePath}')`
  );
  // Also replace the old patched path if it exists
  content = content.replace(
    /require\(['"].*server\/frontend\/src\/stubs\/ioredis-commands\.js['"]\)/g,
    `require('${relativePath}')`
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`   ✅ Patched: ${file}`);
    patched++;
  }
}

if (patched > 0) {
  console.log(`\n✅ Successfully patched ${patched} files`);
} else {
  console.log('\n⚠️  No files were patched (they may have been patched already)');
}

// Also ensure @ioredis/commands package.json points to our stub
const commandsPkgPath = path.join(__dirname, '../../../node_modules/@ioredis/commands/package.json');
const commandsBuiltDir = path.join(__dirname, '../../../node_modules/@ioredis/commands/built');
if (fs.existsSync(commandsPkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(commandsPkgPath, 'utf8'));
  if (pkg.main !== 'index.js') {
    pkg.main = 'index.js';
    fs.writeFileSync(commandsPkgPath, JSON.stringify(pkg, null, 2));
    console.log('✅ Updated @ioredis/commands package.json main to index.js');
  }
  
  // Move built/ directory so Vite can't use it
  if (fs.existsSync(commandsBuiltDir) && !fs.existsSync(commandsBuiltDir + '.backup')) {
    fs.renameSync(commandsBuiltDir, commandsBuiltDir + '.backup');
    console.log('✅ Moved @ioredis/commands/built/ directory');
  }
}

// Ensure our stub is in place - use pure CommonJS version for node_modules
const stubDest = path.join(__dirname, '../../../node_modules/@ioredis/commands/index.js');
const pureCommonJSStub = `// @ioredis/commands stub for browser compatibility
// Redis commands are server-side only
// Pure CommonJS export for node_modules compatibility

const listStub = []; // Empty array - commands are server-side only

// Stub functions
const existsStub = function(command) { return false; };
const hasFlagStub = function(command, flag) { return false; };
const getKeyIndexesStub = function(command, args) { return []; };

// Add properties to the array BEFORE exporting
listStub.list = listStub;
listStub.exists = existsStub;
listStub.hasFlag = hasFlagStub;
listStub.getKeyIndexes = getKeyIndexesStub;

// CommonJS export - Export the array itself
// When code does: const commands = require('@ioredis/commands')
// commands MUST be the array so commands.reduce() works
module.exports = listStub;

// Ensure properties are available
module.exports.default = listStub;
module.exports.list = listStub;
module.exports.exists = existsStub;
module.exports.hasFlag = hasFlagStub;
module.exports.getKeyIndexes = getKeyIndexesStub;

// Ensure it's still an array after property assignments
if (!Array.isArray(module.exports)) {
  Object.setPrototypeOf(module.exports, Array.prototype);
}
`;

fs.writeFileSync(stubDest, pureCommonJSStub, 'utf8');
console.log('✅ Created pure CommonJS stub at node_modules/@ioredis/commands/index.js');

