/**
 * Vite configuration for frontend React application
 * 
 * This configuration handles:
 * - React/TypeScript compilation with SWC
 * - Node.js polyfills for browser compatibility
 * - SDK internal module resolution (@aifabrix/miso-client)
 * - CommonJS to ESM transformation
 * - Development server with API proxy
 * 
 * Key features:
 * - Intercepts Node.js built-in modules and provides browser-compatible stubs
 * - Resolves SDK internal relative imports (error-extractor, console-logger, etc.)
 * - Handles @ioredis/commands package stubbing (Redis is server-side only)
 * - Transforms CommonJS modules from SDK to ESM for browser
 */

import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import fs from 'fs';

/**
 * Plugin to intercept Node.js built-in module imports and SDK internal imports
 * 
 * This plugin runs BEFORE other Vite plugins (enforce: 'pre') to intercept:
 * 1. Node.js built-in modules (stream, fs, crypto, etc.) -> browser stubs
 * 2. @ioredis/* packages -> ioredis-commands stub (Redis is server-side only)
 * 3. dotenv -> dotenv stub (uses process.argv, not available in browser)
 * 4. SDK internal relative imports (./error-extractor, ./console-logger, etc.)
 * 
 * The plugin resolves these imports to appropriate stub files in src/stubs/
 * to prevent build errors when bundling for the browser.
 * 
 * @returns Vite plugin configuration
 */
function nodePolyfillsPlugin(): Plugin {
  // Comprehensive list of Node.js built-in modules
  const nodeModules = [
    'stream', 'util', 'crypto', 'path', 'fs', 'net', 'tls',
    'events', 'buffer', 'os', 'dns', 'assert', 'string_decoder', 'url', 'process',
    'http', 'https', 'http2', 'zlib', 'querystring', 'punycode', 'readline',
    'repl', 'vm', 'child_process', 'cluster', 'worker_threads', 'perf_hooks',
    'timers', 'console', 'module', 'constants'
  ];
  
  const catchAllPath = path.resolve(__dirname, './src/stubs/catch-all.js');
  
  const ioredisCommandsStub = path.resolve(__dirname, './src/stubs/ioredis-commands.js');
  
  return {
    name: 'node-polyfills',
    enforce: 'pre',
    resolveId(id, importer) {
      // Remove query parameters (like ?commonjs-external) from id
      const cleanId = id.split('?')[0];
      
      // CRITICAL: Intercept @ioredis/* packages FIRST
      // This must happen before other checks to catch all @ioredis imports
      if (cleanId.startsWith('@ioredis/')) {
        // Log to verify it's being called
        console.log(`[node-polyfills] Resolving ${id} -> ${ioredisCommandsStub}`);
        return ioredisCommandsStub;
      }
      
      // Intercept dotenv - it's Node.js only and uses process.argv
      const dotenvStub = path.resolve(__dirname, './src/stubs/dotenv.js');
      if (cleanId === 'dotenv' || cleanId === 'dotenv/config' || cleanId.startsWith('dotenv/')) {
        console.log(`[node-polyfills] Resolving ${id} -> ${dotenvStub}`);
        return dotenvStub;
      }
      
      // Handle relative imports from services/logger directory (e.g., ./unified-logger.service)
      if (cleanId.startsWith('./') || cleanId.startsWith('../')) {
        const cleanImporter = importer ? importer.split('?')[0] : null;
        if (cleanImporter && cleanImporter.includes('services/logger')) {
          // Try to resolve from root workspace dist first
          const rootDist = path.resolve(__dirname, '../../dist');
          const loggerDir = path.join(rootDist, 'services', 'logger');
          const resolvedPath = path.resolve(loggerDir, cleanId);
          const extensions = ['.ts', '.js', '.tsx', '.jsx'];
          for (const ext of extensions) {
            const fullPath = resolvedPath + ext;
            try {
              if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                if (stats.isFile()) {
                  console.log(`[node-polyfills] Resolving ${id} (from services/logger) -> ${fullPath}`);
                  return fullPath;
                }
              }
            } catch {
              // Continue to next extension
            }
          }
        }
        // Handle relative imports from services directory (e.g., ./application-context.service)
        if (cleanImporter && cleanImporter.includes('services/')) {
          const rootDist = path.resolve(__dirname, '../../dist');
          const servicesDir = path.join(rootDist, 'services');
          const resolvedPath = path.resolve(servicesDir, cleanId);
          const extensions = ['.ts', '.js', '.tsx', '.jsx'];
          for (const ext of extensions) {
            const fullPath = resolvedPath + ext;
            try {
              if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                if (stats.isFile()) {
                  console.log(`[node-polyfills] Resolving ${id} (from services) -> ${fullPath}`);
                  return fullPath;
                }
              }
            } catch {
              // Continue to next extension
            }
          }
        }
        // Handle relative imports from express directory (e.g., ./logger-context.middleware)
        if (cleanImporter && cleanImporter.includes('express')) {
          const rootDist = path.resolve(__dirname, '../../dist');
          const expressDir = path.join(rootDist, 'express');
          const resolvedPath = path.resolve(expressDir, cleanId);
          const extensions = ['.ts', '.js', '.tsx', '.jsx'];
          for (const ext of extensions) {
            const fullPath = resolvedPath + ext;
            try {
              if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                if (stats.isFile()) {
                  console.log(`[node-polyfills] Resolving ${id} (from express) -> ${fullPath}`);
                  return fullPath;
                }
              }
            } catch {
              // Continue to next extension
            }
          }
        }
      }
      
      // Handle relative imports from @aifabrix/miso-client package
      // These are internal module imports that need to be resolved properly
      if (cleanId.startsWith('./') || cleanId.startsWith('../')) {
        // Check if importer is from SDK, or if this looks like an SDK internal import
        const isFromSDK = importer && (
          importer.includes('@aifabrix/miso-client') || 
          importer.includes('node_modules/@aifabrix/miso-client') ||
          importer.includes('/aifabrix-miso-client/')
        );
        
        // Also check if the id itself suggests it's an SDK internal import
        const looksLikeSDKImport = cleanId.includes('data-client-') || 
                                   cleanId.includes('token-utils') ||
                                   cleanId.includes('data-masker') ||
                                   cleanId.includes('request-context') ||
                                   cleanId.includes('logging-helpers') ||
                                   cleanId.includes('response-validator') ||
                                   cleanId.includes('error-extractor') ||
                                   cleanId.includes('console-logger') ||
                                   cleanId.includes('services/logger') ||
                                   cleanId.includes('services/') ||
                                   cleanId.includes('application-context') ||
                                   cleanId.includes('unified-logger') ||
                                   cleanId.includes('logger-') ||
                                   cleanId.includes('logger.service') ||
                                   cleanId.includes('logger-context') ||
                                   cleanId.includes('logger-chain') ||
                                   cleanId.includes('express') ||
                                   cleanId.includes('logger-context.middleware');
        
        if (isFromSDK || looksLikeSDKImport) {
          let importerDir: string;
          if (importer) {
            importerDir = path.dirname(importer);
          } else {
            // If no importer, try to find the SDK package root
            // Check common locations for workspace-linked packages
            const possiblePaths = [
              path.resolve(__dirname, '../../src/utils'),
              path.resolve(__dirname, '../../../src/utils'),
              path.resolve(__dirname, '../../node_modules/@aifabrix/miso-client/src/utils'),
            ];
            importerDir = possiblePaths[0]; // Default to first
            for (const possiblePath of possiblePaths) {
              try {
                if (fs.existsSync(possiblePath)) {
                  importerDir = possiblePath;
                  break;
                }
              } catch {
                // Continue
              }
            }
          }
          
          const resolvedPath = path.resolve(importerDir, cleanId);
          
          // Try to find the file with common extensions
          const extensions = ['.ts', '.js', '.tsx', '.jsx'];
          for (const ext of extensions) {
            const fullPath = resolvedPath + ext;
            try {
              if (fs.existsSync(fullPath)) {
                const stats = fs.statSync(fullPath);
                if (stats.isFile()) {
                  console.log(`[node-polyfills] Resolving ${id} (importer: ${importer || 'none'}) -> ${fullPath}`);
                  return fullPath;
                }
              }
            } catch {
              // Continue to next extension
            }
          }
          
          // If no file found, check if resolvedPath is a directory and look for index files
          try {
            if (fs.existsSync(resolvedPath)) {
              const stats = fs.statSync(resolvedPath);
              if (stats.isDirectory()) {
                const indexPath = path.join(resolvedPath, 'index.ts');
                if (fs.existsSync(indexPath)) {
                  console.log(`[node-polyfills] Resolving ${id} -> ${indexPath}`);
                  return indexPath;
                }
                const indexJsPath = path.join(resolvedPath, 'index.js');
                if (fs.existsSync(indexJsPath)) {
                  console.log(`[node-polyfills] Resolving ${id} -> ${indexJsPath}`);
                  return indexJsPath;
                }
              }
            }
          } catch {
            // Continue
          }
        }
      }
      
      // Intercept Node.js built-in module imports
      if (nodeModules.includes(cleanId)) {
        // Try .js first, then .ts
        const jsPath = path.resolve(__dirname, `./src/stubs/${cleanId}.js`);
        const tsPath = path.resolve(__dirname, `./src/stubs/${cleanId}.ts`);
        try {
          if (fs.existsSync(jsPath)) {
            return jsPath;
          }
          if (fs.existsSync(tsPath)) {
            return tsPath;
          }
        } catch {
          // Fallback to .ts if fs check fails
          return tsPath;
        }
      }
      
      // Catch-all for Node.js built-in modules only (with 'node:' prefix or known built-ins)
      // Only handle modules that are definitely Node.js built-ins
      if (id.startsWith('node:')) {
        const jsPath = path.resolve(__dirname, `./src/stubs/${cleanId}.js`);
        const tsPath = path.resolve(__dirname, `./src/stubs/${cleanId}.ts`);
        try {
          if (fs.existsSync(jsPath)) {
            return jsPath;
          }
          if (fs.existsSync(tsPath)) {
            return tsPath;
          }
          // If no specific stub exists, use catch-all for Node.js modules only
          return catchAllPath;
        } catch {
          return catchAllPath;
        }
      }
      
      return null;
    },
    // Also intercept during load phase to catch any missed imports
    load(id) {
      if (id.includes('@ioredis/commands') && !id.includes('ioredis-commands.js')) {
        // This shouldn't happen if resolveId works, but as a fallback
        if (fs.existsSync(ioredisCommandsStub)) {
          return fs.readFileSync(ioredisCommandsStub, 'utf8');
        }
      }
      return null;
    },
    // Transform hook to replace @ioredis/commands imports in source code
    // This runs AFTER resolveId, so we can catch imports that weren't intercepted
    transform(code, id) {
      // Only transform files from node_modules/ioredis that import @ioredis/commands
      if (id.includes('node_modules/ioredis') && code.includes('@ioredis/commands')) {
        const originalCode = code;
        console.log(`[node-polyfills] transform called for ${id.split('/').slice(-3).join('/')}`);
        
        // Use absolute path resolution - Vite will resolve it correctly
        // Calculate relative path from the file to our stub
        const fileDir = path.dirname(id);
        const relativePath = path.relative(fileDir, ioredisCommandsStub).replace(/\\/g, '/');
        // Ensure it starts with ./
        const stubRelativePath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
        
        console.log(`[node-polyfills]   Replacing @ioredis/commands with ${stubRelativePath}`);
        
        // Replace require('@ioredis/commands') with our stub path
        code = code.replace(
          /require\(['"]@ioredis\/commands['"]\)/g,
          `require('${stubRelativePath}')`
        );
        code = code.replace(
          /from\s+['"]@ioredis\/commands['"]/g,
          `from '${stubRelativePath}'`
        );
        code = code.replace(
          /import\s+.*\s+from\s+['"]@ioredis\/commands['"]/g,
          (match) => match.replace('@ioredis/commands', stubRelativePath)
        );
        
        if (code !== originalCode) {
          console.log(`[node-polyfills] ✅ Transformed @ioredis/commands imports in ${id.split('/').slice(-3).join('/')}`);
          return { code, map: null };
        } else {
          console.log(`[node-polyfills] ⚠️  No replacements made in ${id.split('/').slice(-3).join('/')}`);
        }
      }
      return null;
    },
  };
}

/**
 * Main Vite configuration
 * 
 * Configures:
 * - React plugin with SWC for fast compilation
 * - Node polyfills plugin for browser compatibility
 * - Path aliases (@/ -> src/)
 * - Module resolution for SDK and Node.js stubs
 * - Build optimization settings
 * - Development server with API proxy
 */
export default defineConfig({
  plugins: [react(), nodePolyfillsPlugin()],
  /**
   * Module resolution configuration
   * 
   * Handles:
   * - File extensions (.js, .jsx, .ts, .tsx, .json)
   * - Path aliases (@/ -> src/)
   * - Node.js built-in module stubs
   * - React/React-DOM deduplication
   */
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub Node.js built-in modules for browser compatibility
      'stream': path.resolve(__dirname, './src/stubs/stream.js'),
      'util': path.resolve(__dirname, './src/stubs/util.js'),
      'crypto': path.resolve(__dirname, './src/stubs/crypto.ts'),
      'path': path.resolve(__dirname, './src/stubs/path.ts'),
      'fs': path.resolve(__dirname, './src/stubs/fs.ts'),
      'net': path.resolve(__dirname, './src/stubs/net.ts'),
      'tls': path.resolve(__dirname, './src/stubs/tls.ts'),
      'events': path.resolve(__dirname, './src/stubs/events.js'),
      'buffer': path.resolve(__dirname, './src/stubs/buffer.ts'),
      'os': path.resolve(__dirname, './src/stubs/os.ts'),
      'dns': path.resolve(__dirname, './src/stubs/dns.ts'),
      'assert': path.resolve(__dirname, './src/stubs/assert.ts'),
      'string_decoder': path.resolve(__dirname, './src/stubs/string_decoder.ts'),
      'url': path.resolve(__dirname, './src/stubs/url.ts'),
      'process': path.resolve(__dirname, './src/stubs/process.js'),
      // Stub ioredis and redis-parser - Redis is server-side only
      'ioredis': path.resolve(__dirname, './src/stubs/ioredis.js'),
      'redis-parser': path.resolve(__dirname, './src/stubs/redis-parser.js'),
      '@ioredis/commands': path.resolve(__dirname, './src/stubs/ioredis-commands.js'),
      // dotenv is handled via resolveId plugin hook (see nodePolyfillsPlugin)
    },
    dedupe: ['react', 'react-dom'], // Prevent duplicate React instances
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['@aifabrix/miso-client', '@ioredis/commands'], // Exclude from pre-bundling - we'll handle it
    // Force Vite to resolve @ioredis/commands through our alias during dev
    esbuildOptions: {
      alias: {
        '@ioredis/commands': path.resolve(__dirname, './src/stubs/ioredis-commands.js'),
      },
    },
  },
  build: {
    target: 'esnext',
    outDir: '../public',
    emptyOutDir: true, // Clear public directory on build - DataClient is served via route handler
    sourcemap: true, // Enable source maps for debugging
    commonjsOptions: {
      include: [/node_modules/, /aifabrix-miso-client/, /\.\.\/\.\.\/dist/],
      transformMixedEsModules: true,
      // Don't externalize relative imports - these are internal to packages
      // This prevents commonjs plugin from marking ./ imports as external
      defaultIsModuleExports: true,
      // Note: CommonJS plugin automatically transforms CommonJS modules by default
      // Require returns default export for better compatibility
      requireReturnsDefault: 'auto',
      // Don't treat relative imports as external
      ignore(id: string) {
        // Don't ignore anything - we want to transform all CommonJS modules
        return false;
      },
    },
    rollupOptions: {
      // Prevent externalization of relative imports from SDK package
      external(id) {
        // Remove query parameters (like ?commonjs-external) from id for checking
        const cleanId = id.split('?')[0];
        
        // Don't externalize relative imports (these are internal to packages)
        if (cleanId.startsWith('./') || cleanId.startsWith('../')) {
          return false;
        }
        // Don't externalize SDK internal imports even if they have query params
        if (cleanId.includes('data-client-') || cleanId.includes('token-utils') || cleanId.includes('data-masker') || cleanId.includes('request-context') || cleanId.includes('logging-helpers') || cleanId.includes('response-validator') || cleanId.includes('error-extractor') || cleanId.includes('console-logger') || cleanId.includes('services/logger') || cleanId.includes('unified-logger') || cleanId.includes('logger-') || cleanId.includes('logger.service') || cleanId.includes('logger-context') || cleanId.includes('logger-chain') || cleanId.includes('express') || cleanId.includes('logger-context.middleware')) {
          return false;
        }
        return null; // Let Rollup decide for other imports
      },
      plugins: [
        // Rollup plugin to intercept @ioredis/commands during build
        // This runs during the build phase and should catch imports from node_modules
        {
          name: 'replace-node-modules',
          buildStart() {
            console.log('[rollup-plugin] replace-node-modules plugin started');
          },
            resolveId(id, importer) {
            // Remove query parameters (like ?commonjs-external) from id
            const cleanId = id.split('?')[0];
            
            // Handle @ioredis packages
            if (cleanId.startsWith('@ioredis/')) {
              const stubPath = path.resolve(__dirname, './src/stubs/ioredis-commands.js');
              console.log(`[rollup-plugin] resolveId: ${id} -> ioredis stub`);
              return stubPath;
            }
            // Handle dotenv (Node.js only, uses process.argv)
            if (cleanId === 'dotenv' || cleanId === 'dotenv/config' || cleanId.startsWith('dotenv/')) {
              const stubPath = path.resolve(__dirname, './src/stubs/dotenv.js');
              console.log(`[rollup-plugin] resolveId: ${id} -> dotenv stub`);
              return stubPath;
            }
            // Handle services/logger directory imports - check root workspace dist first
            if (cleanId.includes('services/logger')) {
              const rootDist = path.resolve(__dirname, '../../dist');
              if (cleanId.startsWith('./services/logger') || cleanId === './services/logger') {
                const loggerPath = path.join(rootDist, 'services', 'logger', 'index.js');
                if (fs.existsSync(loggerPath)) {
                  console.log(`[rollup-plugin] resolveId: ${id} -> ${loggerPath}`);
                  return loggerPath;
                }
              } else if (cleanId.startsWith('../services/logger') || cleanId === '../services/logger') {
                const loggerPath = path.join(rootDist, 'services', 'logger', 'index.js');
                if (fs.existsSync(loggerPath)) {
                  console.log(`[rollup-plugin] resolveId: ${id} -> ${loggerPath}`);
                  return loggerPath;
                }
              }
            }
            // Handle relative imports from services/logger directory (e.g., ./unified-logger.service)
            const cleanImporter = importer ? importer.split('?')[0] : null;
            if (cleanImporter && cleanImporter.includes('services/logger') && (cleanId.startsWith('./') || cleanId.startsWith('../'))) {
              const rootDist = path.resolve(__dirname, '../../dist');
              // If importer is in services/logger, resolve relative imports from services/logger directory
              if (cleanImporter.includes('services/logger')) {
                const loggerDir = path.join(rootDist, 'services', 'logger');
                const resolvedPath = path.resolve(loggerDir, cleanId);
                const extensions = ['.ts', '.js', '.tsx', '.jsx'];
                for (const ext of extensions) {
                  const fullPath = resolvedPath + ext;
                  if (fs.existsSync(fullPath)) {
                    console.log(`[rollup-plugin] resolveId: ${id} (from services/logger) -> ${fullPath}`);
                    return fullPath;
                  }
                }
              }
            }
            // Handle relative imports from express directory (e.g., ./logger-context.middleware)
            if (cleanImporter && cleanImporter.includes('express') && (cleanId.startsWith('./') || cleanId.startsWith('../'))) {
              const rootDist = path.resolve(__dirname, '../../dist');
              // If importer is in express, resolve relative imports from express directory
              if (cleanImporter.includes('express')) {
                const expressDir = path.join(rootDist, 'express');
                const resolvedPath = path.resolve(expressDir, cleanId);
                const extensions = ['.ts', '.js', '.tsx', '.jsx'];
                for (const ext of extensions) {
                  const fullPath = resolvedPath + ext;
                  if (fs.existsSync(fullPath)) {
                    console.log(`[rollup-plugin] resolveId: ${id} (from express) -> ${fullPath}`);
                    return fullPath;
                  }
                }
              }
            }
            // Handle relative imports from @aifabrix/miso-client package
            // These are internal module imports that need to be resolved properly
            // Special handling for SDK internal imports like response-validator
            if (cleanId.startsWith('./') || cleanId.startsWith('../')) {
              // Check if this is an SDK internal import
              const isSDKImport = cleanId.includes('response-validator') || 
                                  cleanId.includes('data-client-') || 
                                  cleanId.includes('token-utils') ||
                                  cleanId.includes('data-masker') ||
                                  cleanId.includes('request-context') ||
                                  cleanId.includes('logging-helpers') ||
                                  cleanId.includes('error-extractor') ||
                                  cleanId.includes('console-logger') ||
                                  cleanId.includes('unified-logger') ||
                                  cleanId.includes('logger-') ||
                                  cleanId.includes('logger.service') ||
                                  cleanId.includes('logger-context') ||
                                  cleanId.includes('logger-chain') ||
                                  cleanId.includes('express') ||
                                  cleanId.includes('logger-context.middleware');
              
              // Always resolve SDK imports from root workspace dist first (before checking importer directory)
              // This ensures we find the file even if it doesn't exist in pnpm directory
              if (isSDKImport) {
                const rootWorkspaceDist = path.resolve(__dirname, '../../dist'); // server/frontend -> aifabrix-miso-client/dist
                if (fs.existsSync(rootWorkspaceDist)) {
                  let resolvePath: string;
                  if (cleanId.startsWith('./') && !cleanId.startsWith('./utils/') && !cleanId.startsWith('../')) {
                    // ./response-validator -> dist/utils/response-validator
                    resolvePath = path.join(rootWorkspaceDist, 'utils', cleanId.substring(2));
                  } else if (cleanId.startsWith('../utils/')) {
                    resolvePath = path.join(rootWorkspaceDist, 'utils', cleanId.replace('../utils/', ''));
                  } else {
                    resolvePath = path.resolve(rootWorkspaceDist, cleanId);
                  }
                  const extensions = ['.ts', '.js', '.tsx', '.jsx'];
                  for (const ext of extensions) {
                    const fullPath = resolvePath + ext;
                    if (fs.existsSync(fullPath)) {
                      return fullPath;
                    }
                  }
                }
              }
              // Check if importer is from @aifabrix/miso-client or if id looks like an SDK internal import
              const cleanImporter = importer ? importer.split('?')[0] : null;
              const isFromSDK = cleanImporter && (
                cleanImporter.includes('@aifabrix/miso-client') || 
                cleanImporter.includes('node_modules/@aifabrix/miso-client') ||
                cleanImporter.includes('/aifabrix-miso-client/')
              );
              
              // Also check if the id itself suggests it's an SDK internal import
              const looksLikeSDKImport = cleanId.includes('data-client-') || 
                                         cleanId.includes('token-utils') ||
                                         cleanId.includes('data-masker') ||
                                         cleanId.includes('request-context') ||
                                         cleanId.includes('logging-helpers') ||
                                         cleanId.includes('response-validator') ||
                                         cleanId.includes('error-extractor') ||
                                         cleanId.includes('console-logger') ||
                                         cleanId.includes('services/logger') ||
                                         cleanId.includes('unified-logger') ||
                                         cleanId.includes('logger-') ||
                                         cleanId.includes('logger.service') ||
                                         cleanId.includes('logger-context') ||
                                         cleanId.includes('logger-chain') ||
                                         cleanId.includes('express') ||
                                         cleanId.includes('logger-context.middleware');
              
              if (isFromSDK || looksLikeSDKImport || !importer || cleanImporter === cleanId || (cleanImporter && cleanImporter.includes('?commonjs-external'))) {
                let importerDir: string;
                
                // If importer is the same as id or has ?commonjs-external, resolve directly from root workspace dist
                if ((cleanImporter === cleanId || (cleanImporter && cleanImporter.includes('?commonjs-external'))) && looksLikeSDKImport) {
                  // Try to find root workspace dist folder directly
                  const possibleRootDists = [
                    path.resolve(__dirname, '../../../../dist'), // server/frontend -> aifabrix-miso-client/dist
                    path.resolve(__dirname, '../../../dist'),    // server/frontend -> server/dist (fallback)
                    path.resolve(__dirname, '../../dist'),       // Alternative
                  ];
                  for (const rootWorkspaceDist of possibleRootDists) {
                    if (fs.existsSync(rootWorkspaceDist)) {
                      // For ./response-validator, resolve to dist/utils/response-validator
                      // For ./services/logger, resolve to dist/services/logger
                      if (cleanId.startsWith('./services/')) {
                        // ./services/logger -> dist/services/logger/index.js
                        const servicePath = path.join(rootWorkspaceDist, cleanId.substring(2));
                        const indexPath = path.join(servicePath, 'index.js');
                        if (fs.existsSync(indexPath)) {
                          console.log(`[rollup-plugin] Direct resolution: ${id} -> ${indexPath}`);
                          return indexPath;
                        }
                        // Fallback: try as directory
                        importerDir = rootWorkspaceDist;
                      } else if (cleanId.startsWith('./') && !cleanId.startsWith('./utils/') && !cleanId.startsWith('../')) {
                        importerDir = path.join(rootWorkspaceDist, 'utils');
                      } else {
                        importerDir = rootWorkspaceDist;
                      }
                      console.log(`[rollup-plugin] Direct resolution from root dist: ${rootWorkspaceDist}, cleanId: ${cleanId}, importerDir: ${importerDir}`);
                      break;
                    }
                  }
                }
                
                if (!importerDir && cleanImporter && cleanImporter !== cleanId && isFromSDK && !cleanImporter.includes('?commonjs-external')) {
                  // Use the importer's directory if it's from SDK and it's a real file path
                  importerDir = path.dirname(cleanImporter);
                } else if (!importerDir) {
                  // No valid importer or importer is same as id - try to find SDK package directory
                  // First try to find the SDK package root (dist or src)
                  // Check pnpm structure first (.pnpm/@aifabrix+miso-client*/node_modules/@aifabrix/miso-client)
                  const pnpmPath = path.resolve(__dirname, '../../node_modules/.pnpm');
                  let packageRoot: string | null = null;
                  
                  if (fs.existsSync(pnpmPath)) {
                    try {
                      const pnpmDirs = fs.readdirSync(pnpmPath);
                      const misoClientDir = pnpmDirs.find((dir: string) => dir.startsWith('@aifabrix+miso-client'));
                      if (misoClientDir) {
                        const distPath = path.join(pnpmPath, misoClientDir, 'node_modules/@aifabrix/miso-client/dist');
                        const srcPath = path.join(pnpmPath, misoClientDir, 'node_modules/@aifabrix/miso-client/src');
                        if (fs.existsSync(distPath)) {
                          packageRoot = distPath;
                        } else if (fs.existsSync(srcPath)) {
                          packageRoot = srcPath;
                        }
                      }
                    } catch {
                      // Continue to fallback options
                    }
                  }
                  
                  // Fallback to standard node_modules or workspace paths
                  if (!packageRoot) {
                    const possiblePackageRoots = [
                      path.resolve(__dirname, '../../node_modules/@aifabrix/miso-client/dist'),
                      path.resolve(__dirname, '../../node_modules/@aifabrix/miso-client/src'),
                      path.resolve(__dirname, '../../../dist'),  // Root workspace dist
                      path.resolve(__dirname, '../../../src'),  // Root workspace src
                      path.resolve(__dirname, '../../../../dist'), // Alternative root path
                      path.resolve(__dirname, '../../../../src'), // Alternative root path
                    ];
                    for (const root of possiblePackageRoots) {
                      if (fs.existsSync(root)) {
                        packageRoot = root;
                        break;
                      }
                    }
                  }
                  
                  if (packageRoot) {
                    // For relative imports like ./response-validator, resolve relative to utils directory
                    // since these imports come from files in the utils directory
                    if (cleanId.startsWith('./') && !cleanId.startsWith('./utils/') && !cleanId.startsWith('../')) {
                      // ./response-validator -> utils/response-validator
                      importerDir = path.join(packageRoot, 'utils');
                    } else {
                      // For other relative imports, resolve relative to package root
                      importerDir = packageRoot;
                    }
                    console.log(`[rollup-plugin] Found packageRoot: ${packageRoot}, cleanId: ${cleanId}, importerDir: ${importerDir}, will resolve to: ${path.resolve(importerDir, cleanId)}`);
                  } else {
                    // Fallback to utils directory
                    const possibleDirs = [
                      path.resolve(__dirname, '../../node_modules/@aifabrix/miso-client/dist/utils'),
                      path.resolve(__dirname, '../../node_modules/@aifabrix/miso-client/src/utils'),
                      path.resolve(__dirname, '../../../dist/utils'),
                      path.resolve(__dirname, '../../../src/utils'),
                    ];
                    importerDir = possibleDirs[0];
                    for (const dir of possibleDirs) {
                      if (fs.existsSync(dir)) {
                        importerDir = dir;
                        break;
                      }
                    }
                  }
                }
                
                let resolvedPath = importerDir ? path.resolve(importerDir, cleanId) : null;
                
                // Try to find the file with common extensions
                const extensions = ['.ts', '.js', '.tsx', '.jsx'];
                
                // For SDK imports, always check root workspace dist folder first
                if (looksLikeSDKImport) {
                  const rootWorkspaceDist = path.resolve(__dirname, '../../dist'); // server/frontend -> aifabrix-miso-client/dist
                  if (fs.existsSync(rootWorkspaceDist)) {
                    let rootResolvePath: string;
                    if (cleanId.startsWith('./') && !cleanId.startsWith('./utils/') && !cleanId.startsWith('../')) {
                      // ./response-validator -> dist/utils/response-validator
                      rootResolvePath = path.join(rootWorkspaceDist, 'utils', cleanId.substring(2));
                    } else if (cleanId.startsWith('../utils/')) {
                      rootResolvePath = path.join(rootWorkspaceDist, 'utils', cleanId.replace('../utils/', ''));
                    } else {
                      rootResolvePath = path.resolve(rootWorkspaceDist, cleanId);
                    }
                    for (const ext of extensions) {
                      const fullPath = rootResolvePath + ext;
                      if (fs.existsSync(fullPath)) {
                        console.log(`[rollup-plugin] resolveId: ${id} (root workspace dist first) -> ${fullPath}`);
                        return fullPath;
                      }
                    }
                  }
                }
                
                // First, try resolving from importerDir if we have one
                if (resolvedPath) {
                  for (const ext of extensions) {
                    const fullPath = resolvedPath + ext;
                    if (fs.existsSync(fullPath)) {
                      console.log(`[rollup-plugin] resolveId: ${id} (importer: ${importer || 'none'}) -> ${fullPath}`);
                      return fullPath;
                    }
                  }
                  
                  // Try without extension (might be a directory with index)
                  if (fs.existsSync(resolvedPath)) {
                    const stats = fs.statSync(resolvedPath);
                    if (stats.isDirectory()) {
                      const indexPath = path.join(resolvedPath, 'index.ts');
                      if (fs.existsSync(indexPath)) {
                        console.log(`[rollup-plugin] resolveId: ${id} -> ${indexPath}`);
                        return indexPath;
                      }
                      const indexJsPath = path.join(resolvedPath, 'index.js');
                      if (fs.existsSync(indexJsPath)) {
                        console.log(`[rollup-plugin] resolveId: ${id} -> ${indexJsPath}`);
                        return indexJsPath;
                      }
                    } else {
                      console.log(`[rollup-plugin] resolveId: ${id} -> ${resolvedPath}`);
                      return resolvedPath;
                    }
                  }
                }
                
                // If not found and this is an SDK import, try root workspace dist folder immediately
                if (looksLikeSDKImport && (!resolvedPath || !fs.existsSync(resolvedPath + '.js'))) {
                  const rootWorkspaceDist = path.resolve(__dirname, '../../dist'); // server/frontend -> aifabrix-miso-client/dist
                  if (fs.existsSync(rootWorkspaceDist)) {
                    let rootResolvePath: string;
                    if (cleanId.startsWith('./') && !cleanId.startsWith('./utils/') && !cleanId.startsWith('../')) {
                      // ./response-validator -> dist/utils/response-validator
                      rootResolvePath = path.join(rootWorkspaceDist, 'utils', cleanId.substring(2));
                    } else if (cleanId.startsWith('../utils/')) {
                      rootResolvePath = path.join(rootWorkspaceDist, 'utils', cleanId.replace('../utils/', ''));
                    } else {
                      rootResolvePath = path.resolve(rootWorkspaceDist, cleanId);
                    }
                    for (const ext of extensions) {
                      const fullPath = rootResolvePath + ext;
                      if (fs.existsSync(fullPath)) {
                        console.log(`[rollup-plugin] resolveId: ${id} (root workspace dist fallback) -> ${fullPath}`);
                        return fullPath;
                      }
                    }
                  }
                }
                
                // If still not found and this is an SDK import, try root workspace dist folder as fallback
                if (looksLikeSDKImport || isFromSDK) {
                  // Try multiple possible root workspace paths
                  const possibleRootDists = [
                    path.resolve(__dirname, '../../../../dist'), // server/frontend -> aifabrix-miso-client/dist
                    path.resolve(__dirname, '../../../dist'),    // server/frontend -> server/dist (fallback)
                    path.resolve(__dirname, '../../dist'),       // Alternative
                  ];
                  for (const rootWorkspaceDist of possibleRootDists) {
                    if (fs.existsSync(rootWorkspaceDist)) {
                      // Handle relative paths: if cleanId starts with ../utils/, resolve it relative to dist/utils
                      // For ./response-validator, resolve to dist/utils/response-validator
                      // Otherwise resolve normally
                      let fallbackPath: string;
                      if (cleanId.startsWith('../utils/')) {
                        // ../utils/request-context -> dist/utils/request-context
                        const utilsPath = path.join(rootWorkspaceDist, 'utils', cleanId.replace('../utils/', ''));
                        fallbackPath = utilsPath;
                      } else if (cleanId.startsWith('./utils/')) {
                        // ./utils/logging-helpers -> dist/utils/logging-helpers
                        fallbackPath = path.resolve(rootWorkspaceDist, cleanId);
                      } else if (cleanId.startsWith('./') && !cleanId.includes('/')) {
                        // ./response-validator -> dist/utils/response-validator (same directory as importer)
                        fallbackPath = path.join(rootWorkspaceDist, 'utils', cleanId.substring(2));
                      } else {
                        // Other relative paths - resolve normally
                        fallbackPath = path.resolve(rootWorkspaceDist, cleanId);
                      }
                      for (const ext of extensions) {
                        const fullPath = fallbackPath + ext;
                        if (fs.existsSync(fullPath)) {
                          console.log(`[rollup-plugin] resolveId: ${id} (fallback to root dist: ${rootWorkspaceDist}) -> ${fullPath}`);
                          return fullPath;
                        }
                      }
                    }
                  }
                  console.log(`[rollup-plugin] WARNING: Could not resolve ${id} from importer ${importer || 'none'}, tried ${resolvedPath || 'no path'}`);
                  // Last resort: try to resolve from root workspace dist/utils directly
                  if (looksLikeSDKImport && cleanId.startsWith('./') && !cleanId.startsWith('./utils/') && !cleanId.startsWith('../')) {
                    const lastResortPath = path.resolve(__dirname, '../../../../dist/utils', cleanId.substring(2) + '.js');
                    if (fs.existsSync(lastResortPath)) {
                      console.log(`[rollup-plugin] Last resort resolution: ${id} -> ${lastResortPath}`);
                      return lastResortPath;
                    }
                  }
                  // If still not found, try one more time with absolute path resolution
                  if (looksLikeSDKImport) {
                    const absolutePath = path.resolve(__dirname, '../../../../dist/utils/response-validator.js');
                    if (fs.existsSync(absolutePath)) {
                      console.log(`[rollup-plugin] Absolute path resolution: ${id} -> ${absolutePath}`);
                      return absolutePath;
                    }
                  }
                }
              }
            }
            return null;
          },
        },
      ],
    },
  },
  /**
   * Development server configuration
   * 
   * Configures:
   * - Server port (3000)
   * - Auto-open browser on start
   * - API proxy to backend server (port 3183)
   * - File watching (including stubs directory)
   */
  server: {
    port: 3000,
    open: true,
    /**
     * Proxy configuration for API requests
     * 
     * Proxies all /api/* requests to the backend server.
     * Backend runs on port 3183 in dev mode (see server/scripts/start-dev.sh).
     * 
     * Can be overridden via VITE_API_PROXY_TARGET environment variable.
     */
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3183',
        changeOrigin: true,
        secure: false,
        // Also proxy WebSocket connections if needed
        ws: true,
      },
    },
    /**
     * File watching configuration
     * 
     * Watches for changes in stubs directory to support hot reloading
     * of stub files during development.
     */
    watch: {
      // Watch for changes in stubs directory
      ignored: ['!**/src/stubs/**'],
    },
  },
});