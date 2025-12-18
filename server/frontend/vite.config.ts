
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import type { Plugin as RollupPlugin } from 'rollup';

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
      // Remove 'node:' prefix if present
      const cleanId = id.startsWith('node:') ? id.slice(5) : id;
      
      // CRITICAL: Intercept @ioredis/* packages FIRST
      // This must happen before other checks to catch all @ioredis imports
      if (id.startsWith('@ioredis/')) {
        // Log to verify it's being called
        console.log(`[node-polyfills] Resolving ${id} -> ${ioredisCommandsStub}`);
        return ioredisCommandsStub;
      }
      
      // Intercept Node.js built-in module imports
      if (nodeModules.includes(cleanId)) {
        // Try .js first, then .ts
        const jsPath = path.resolve(__dirname, `./src/stubs/${cleanId}.js`);
        const tsPath = path.resolve(__dirname, `./src/stubs/${cleanId}.ts`);
        try {
          const fs = require('fs');
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
          const fs = require('fs');
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
        const fs = require('fs');
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
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      plugins: [
        // Rollup plugin to intercept @ioredis/commands during build
        // This runs during the build phase and should catch imports from node_modules
        {
          name: 'replace-ioredis-commands',
          buildStart() {
            console.log('[rollup-plugin] replace-ioredis-commands plugin started');
          },
          resolveId(id, importer) {
            if (id.startsWith('@ioredis/')) {
              const stubPath = path.resolve(__dirname, './src/stubs/ioredis-commands.js');
              console.log(`[rollup-plugin] resolveId called for ${id}`);
              console.log(`[rollup-plugin]   importer: ${importer ? importer.split('/').slice(-3).join('/') : 'unknown'}`);
              console.log(`[rollup-plugin]   resolving to: ${stubPath}`);
              return stubPath;
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
    watch: {
      // Watch for changes in stubs directory
      ignored: ['!**/src/stubs/**'],
    },
  },
});