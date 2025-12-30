
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import fs from 'fs';

// Plugin to intercept Node.js built-in module imports
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
                                   cleanId.includes('logging-helpers');
        
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

export default defineConfig({
  plugins: [react(), nodePolyfillsPlugin()],
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
        if (cleanId.includes('data-client-') || cleanId.includes('token-utils') || cleanId.includes('data-masker') || cleanId.includes('request-context') || cleanId.includes('logging-helpers')) {
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
            // Handle relative imports from @aifabrix/miso-client package
            // These are internal module imports that need to be resolved properly
            if (cleanId.startsWith('./') || cleanId.startsWith('../')) {
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
                                         cleanId.includes('logging-helpers');
              
              if (isFromSDK || looksLikeSDKImport || !importer) {
                let importerDir: string;
                
                if (cleanImporter && cleanImporter !== cleanId && isFromSDK) {
                  // Use the importer's directory if it's from SDK
                  importerDir = path.dirname(cleanImporter);
                } else {
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
                    // If cleanId starts with ./utils/ or ../utils/, resolve relative to package root
                    // This will correctly resolve ./utils/logging-helpers to packageRoot/utils/logging-helpers
                    // Note: path.resolve(packageRoot, './utils/logging-helpers') = packageRoot/utils/logging-helpers
                    importerDir = packageRoot;
                    console.log(`[rollup-plugin] Found packageRoot: ${packageRoot}, cleanId: ${cleanId}, will resolve to: ${path.resolve(packageRoot, cleanId)}`);
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
                
                let resolvedPath = path.resolve(importerDir, cleanId);
                
                // Try to find the file with common extensions
                const extensions = ['.ts', '.js', '.tsx', '.jsx'];
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
                      // Otherwise resolve normally
                      let fallbackPath: string;
                      if (cleanId.startsWith('../utils/')) {
                        // ../utils/request-context -> dist/utils/request-context
                        const utilsPath = path.join(rootWorkspaceDist, 'utils', cleanId.replace('../utils/', ''));
                        fallbackPath = utilsPath;
                      } else if (cleanId.startsWith('./utils/')) {
                        // ./utils/logging-helpers -> dist/utils/logging-helpers
                        fallbackPath = path.resolve(rootWorkspaceDist, cleanId);
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
                  console.log(`[rollup-plugin] WARNING: Could not resolve ${id} from importer ${importer || 'none'}, tried ${resolvedPath}`);
                }
              }
            }
            return null;
          },
        },
      ],
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy API requests to backend server
      // Backend runs on port 3183 in dev mode (see server/scripts/start-dev.sh)
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3183',
        changeOrigin: true,
        secure: false,
        // Also proxy WebSocket connections if needed
        ws: true,
      },
    },
    watch: {
      // Watch for changes in stubs directory
      ignored: ['!**/src/stubs/**'],
    },
  },
});