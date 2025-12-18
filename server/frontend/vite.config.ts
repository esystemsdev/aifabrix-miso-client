
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

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
  
  return {
    name: 'node-polyfills',
    enforce: 'pre',
    resolveId(id) {
      // Remove 'node:' prefix if present
      const cleanId = id.startsWith('node:') ? id.slice(5) : id;
      
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
      
      // Auto-stub all @ioredis/* packages (including subpaths)
      if (id.startsWith('@ioredis/')) {
        // Handle subpaths like @ioredis/commands/built/index or @ioredis/commands/built/commands
        // All @ioredis/* packages should use the commands stub
        if (id.includes('/commands')) {
          return path.resolve(__dirname, './src/stubs/ioredis-commands.js');
        }
        // Default stub for other @ioredis/* packages
        return path.resolve(__dirname, './src/stubs/ioredis-commands.js');
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
    exclude: ['@aifabrix/miso-client'], // Exclude workspace dependency from pre-bundling
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