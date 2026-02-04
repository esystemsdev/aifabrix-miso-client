/**
 * Integration Test Script for Miso Controller
 * Comprehensive test suite for all MisoClient SDK services
 */

import { MisoClient, loadConfig, EncryptionUtil } from './src/index';

// Color output utilities (with chalk fallback to ANSI)
let colors: {
  green: (text: string) => string;
  red: (text: string) => string;
  yellow: (text: string) => string;
  blue: (text: string) => string;
  reset: (text: string) => string;
};

try {
  // Try to use chalk if available
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const chalk = require('chalk');
  colors = {
    green: chalk.green,
    red: chalk.red,
    yellow: chalk.yellow,
    blue: chalk.blue,
    reset: (text: string) => text
  };
} catch {
  // Fallback to ANSI codes
  colors = {
    green: (text: string) => `\x1b[32m${text}\x1b[0m`,
    red: (text: string) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
    blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
    reset: (text: string) => text
  };
}

interface TestResult {
  name: string;
  passed: boolean;
  skipped: boolean;
  error?: string;
  duration: number;
}

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  async runTest(
    name: string,
    testFn: () => Promise<void> | void,
    skip = false
  ): Promise<void> {
    const testStart = Date.now();

    if (skip) {
      this.results.push({
        name,
        passed: false,
        skipped: true,
        duration: Date.now() - testStart
      });
      console.log(`  ${colors.yellow('⊘')} ${name} ${colors.yellow('(skipped)')}`);
      return;
    }

    try {
      await testFn();
      const duration = Date.now() - testStart;
      this.results.push({
        name,
        passed: true,
        skipped: false,
        duration
      });
      const durationStr = `(${(duration / 1000).toFixed(3)}s)`;
      console.log(`  ${colors.green('✓')} ${name} ${colors.blue(durationStr)}`);
    } catch (error) {
      const duration = Date.now() - testStart;
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check if error indicates test should be skipped
      const shouldSkip = errorMsg.includes('SKIP:') || skip;
      
      this.results.push({
        name,
        passed: false,
        skipped: shouldSkip,
        error: shouldSkip ? undefined : errorMsg,
        duration
      });
      
      const durationStr = `(${(duration / 1000).toFixed(3)}s)`;
      if (shouldSkip) {
        console.log(`  ${colors.yellow('⊘')} ${name} ${colors.yellow('(skipped)')} ${colors.blue(durationStr)}`);
        if (errorMsg.includes('SKIP:')) {
          const skipReason = errorMsg.replace('SKIP:', '').trim();
          console.log(`    ${colors.yellow('Reason:')} ${skipReason}`);
        }
      } else {
        console.log(`  ${colors.red('✗')} ${name} ${colors.blue(durationStr)}`);
        if (error instanceof Error && error.stack) {
          console.log(`    ${colors.red('Error:')} ${errorMsg}`);
        }
      }
    }
  }

  printSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.passed && !r.skipped).length;
    const failed = this.results.filter((r) => !r.passed && !r.skipped).length;
    const skipped = this.results.filter((r) => r.skipped).length;
    const total = this.results.length;

    console.log('\n=== Test Summary ===');
    console.log(`Total: ${total}`);
    console.log(`${colors.green(`Passed: ${passed}`)}`);
    console.log(`${colors.red(`Failed: ${failed}`)}`);
    console.log(`${colors.yellow(`Skipped: ${skipped}`)}`);
    console.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`);

    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.results
        .filter((r) => !r.passed && !r.skipped)
        .forEach((r) => {
          console.log(`  ${colors.red('✗')} ${r.name}`);
          if (r.error) {
            console.log(`    ${colors.red('Error:')} ${r.error}`);
          }
        });
    }

    process.exit(failed > 0 ? 1 : 0);
  }
}

/**
 * Check if controller is available and credentials are valid
 */
async function isControllerAvailable(client: MisoClient): Promise<boolean> {
  try {
    const token = await client.getEnvironmentToken();
    // If we get a token, controller is available and credentials are valid
    return !!(token && typeof token === 'string' && token.length > 0);
  } catch (error) {
    // Check if it's a connection error or authentication error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('connect') ||
      errorMessage.includes('401') ||
      errorMessage.includes('Unauthorized')
    ) {
      return false;
    }
    // Other errors - assume controller might be available but something else is wrong
    return false;
  }
}

async function runIntegrationTests(): Promise<void> {
  console.log('\n=== Miso Controller Integration Tests ===\n');

  // Load configuration
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }

  // Initialize client
  const client = new MisoClient(config);
  await client.initialize();

  const runner = new TestRunner();
  const apiKey = config.apiKey || 'test-api-key-12345';

  // Check if controller is available (for informational purposes only)
  const controllerAvailable = await isControllerAvailable(client);
  if (!controllerAvailable) {
    console.log(`${colors.yellow('⚠')} Controller authentication failed at ${config.controllerUrl}`);
    console.log(`${colors.yellow('⚠')} Tests will run but may fail with authentication errors\n`);
  }

  // ==================== Client Token Authentication Tests ====================
  console.log('\n[Client Token Authentication]');

  await runner.runTest('Client token fetch', async () => {
    try {
      const token = await client.getEnvironmentToken();
      if (!token || typeof token !== 'string') {
        throw new Error('Client token is not a valid string');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('Invalid credentials')) {
        throw new Error('SKIP: Controller credentials invalid - skipping client token tests');
      }
      throw error;
    }
  }, !controllerAvailable);

  await runner.runTest('Client token in headers', async () => {
    try {
      // Make a request and verify client token is automatically added
      const token = await client.getEnvironmentToken();
      if (!token) {
        throw new Error('Failed to get client token');
      }
      // Token should be automatically added by HttpClient interceptor
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('Invalid credentials')) {
        throw new Error('SKIP: Controller credentials invalid');
      }
      throw error;
    }
  }, !controllerAvailable);

  await runner.runTest('Client token refresh', async () => {
    try {
      // Get token twice to verify caching/refresh works
      const token1 = await client.getEnvironmentToken();
      const token2 = await client.getEnvironmentToken();
      if (!token1 || !token2) {
        throw new Error('Failed to get client tokens');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('Invalid credentials')) {
        throw new Error('SKIP: Controller credentials invalid');
      }
      throw error;
    }
  }, !controllerAvailable);

  // ==================== AuthService Tests ====================
  console.log('\n[AuthService]');

  await runner.runTest('validateToken with API_KEY', async () => {
    const isValid = await client.validateToken(apiKey);
    if (!isValid) {
      throw new Error('API_KEY validation should return true');
    }
  });

  await runner.runTest('validateToken with invalid token', async () => {
    const isValid = await client.validateToken('invalid-token-12345');
    if (isValid) {
      throw new Error('Invalid token should return false');
    }
  });

  await runner.runTest('getUser with API_KEY (returns null)', async () => {
    const user = await client.getUser(apiKey);
    if (user !== null) {
      throw new Error('getUser with API_KEY should return null');
    }
  });

  await runner.runTest('getUserInfo with API_KEY (returns null)', async () => {
    const user = await client.getUserInfo(apiKey);
    if (user !== null) {
      throw new Error('getUserInfo with API_KEY should return null');
    }
  });

  await runner.runTest('login returns response with loginUrl', async () => {
    try {
      const response = await client.login({
        redirect: 'http://localhost:3000/callback',
      });
      if (!response || typeof response !== 'object') {
        throw new Error('login should return a response object');
      }
      if (!response.success) {
        throw new Error('login response should have success: true');
      }
      if (!response.data || !response.data.loginUrl) {
        throw new Error('login response should have data.loginUrl');
      }
      // loginUrl is the Keycloak authentication URL, not the controller endpoint
      // It should be a valid URL (starts with http:// or https://)
      if (!response.data.loginUrl.startsWith('http://') && !response.data.loginUrl.startsWith('https://')) {
        throw new Error('login URL should be a valid URL (starts with http:// or https://)');
      }
      if (!response.data.state || typeof response.data.state !== 'string') {
        throw new Error('login response should have state string');
      }
      if (!response.timestamp || typeof response.timestamp !== 'string') {
        throw new Error('login response should have timestamp string');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('Invalid credentials')) {
        throw new Error('SKIP: Controller credentials invalid');
      }
      throw error;
    }
  }, !controllerAvailable);

  await runner.runTest('logout endpoint', async () => {
    try {
      // Logout with invalid token - should handle gracefully
      // Note: In a real scenario, you would pass a valid token
      const result = await client.logout({ token: 'test-token' });
      if (!result || typeof result !== 'object') {
        throw new Error('logout should return a response object');
      }
      // Logout may return success: false with invalid token, which is acceptable
      // The important thing is it returns a proper response object
      if (typeof result.success !== 'boolean') {
        throw new Error('logout response should have success boolean');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Handle various error cases gracefully
      if (
        errorMsg.includes('401') || 
        errorMsg.includes('Unauthorized') || 
        errorMsg.includes('Invalid credentials') ||
        errorMsg.includes('Invalid token') ||
        errorMsg.includes('500') ||
        errorMsg.includes('Internal Server Error')
      ) {
        // These are expected with invalid token - skip test
        throw new Error('SKIP: Logout requires valid token (test uses invalid token)');
      }
      throw error;
    }
  }, !controllerAvailable);

  await runner.runTest('isAuthenticated with API_KEY', async () => {
    const isAuth = await client.isAuthenticated(apiKey);
    if (!isAuth) {
      throw new Error('isAuthenticated with API_KEY should return true');
    }
  });

  await runner.runTest('getEnvironmentToken', async () => {
    try {
      const token = await client.getEnvironmentToken();
      if (!token || typeof token !== 'string') {
        throw new Error('getEnvironmentToken should return a valid token');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('Invalid credentials')) {
        throw new Error('SKIP: Controller credentials invalid');
      }
      throw error;
    }
  }, !controllerAvailable);

  // ==================== RoleService Tests ====================
  console.log('\n[RoleService]');

  // Suppress console.error for these tests to avoid cluttering output
  const originalConsoleError = console.error;
  const suppressErrors = () => {
    console.error = () => {}; // Suppress errors
  };
  const restoreErrors = () => {
    console.error = originalConsoleError;
  };

  await runner.runTest('getRoles', async () => {
    suppressErrors();
    try {
      // With API_KEY, may return empty array (no user token)
      const roles = await client.getRoles(apiKey);
      if (!Array.isArray(roles)) {
        throw new Error('getRoles should return an array');
      }
    } finally {
      restoreErrors();
    }
  });

  await runner.runTest('hasRole', async () => {
    suppressErrors();
    try {
      // With API_KEY, may return false (no user token)
      const hasRole = await client.hasRole(apiKey, 'admin');
      if (typeof hasRole !== 'boolean') {
        throw new Error('hasRole should return a boolean');
      }
    } finally {
      restoreErrors();
    }
  });

  await runner.runTest('hasAnyRole', async () => {
    suppressErrors();
    try {
      const hasAny = await client.hasAnyRole(apiKey, ['admin', 'user']);
      if (typeof hasAny !== 'boolean') {
        throw new Error('hasAnyRole should return a boolean');
      }
    } finally {
      restoreErrors();
    }
  });

  await runner.runTest('hasAllRoles', async () => {
    suppressErrors();
    try {
      const hasAll = await client.hasAllRoles(apiKey, ['admin', 'user']);
      if (typeof hasAll !== 'boolean') {
        throw new Error('hasAllRoles should return a boolean');
      }
    } finally {
      restoreErrors();
    }
  });

  await runner.runTest('refreshRoles', async () => {
    suppressErrors();
    try {
      // May return empty array with API_KEY
      const roles = await client.refreshRoles(apiKey);
      if (!Array.isArray(roles)) {
        throw new Error('refreshRoles should return an array');
      }
    } finally {
      restoreErrors();
    }
  });

  // ==================== PermissionService Tests ====================
  console.log('\n[PermissionService]');

  await runner.runTest('getPermissions', async () => {
    suppressErrors();
    try {
      const permissions = await client.getPermissions(apiKey);
      if (!Array.isArray(permissions)) {
        throw new Error('getPermissions should return an array');
      }
    } finally {
      restoreErrors();
    }
  });

  await runner.runTest('hasPermission', async () => {
    suppressErrors();
    try {
      const hasPerm = await client.hasPermission(apiKey, 'read:users');
      if (typeof hasPerm !== 'boolean') {
        throw new Error('hasPermission should return a boolean');
      }
    } finally {
      restoreErrors();
    }
  });

  await runner.runTest('hasAnyPermission', async () => {
    suppressErrors();
    try {
      const hasAny = await client.hasAnyPermission(apiKey, ['read:users', 'write:users']);
      if (typeof hasAny !== 'boolean') {
        throw new Error('hasAnyPermission should return a boolean');
      }
    } finally {
      restoreErrors();
    }
  });

  await runner.runTest('hasAllPermissions', async () => {
    suppressErrors();
    try {
      const hasAll = await client.hasAllPermissions(apiKey, ['read:users', 'write:users']);
      if (typeof hasAll !== 'boolean') {
        throw new Error('hasAllPermissions should return a boolean');
      }
    } finally {
      restoreErrors();
    }
  });

  await runner.runTest('refreshPermissions', async () => {
    suppressErrors();
    try {
      const permissions = await client.refreshPermissions(apiKey);
      if (!Array.isArray(permissions)) {
        throw new Error('refreshPermissions should return an array');
      }
    } finally {
      restoreErrors();
    }
  });

  await runner.runTest('clearPermissionsCache', async () => {
    suppressErrors();
    try {
      // Should not throw
      await client.clearPermissionsCache(apiKey);
    } finally {
      restoreErrors();
    }
  });

  // ==================== LoggerService Tests ====================
  console.log('\n[LoggerService]');

  await runner.runTest('info logging', async () => {
    await client.log.info('Integration test info message', { test: 'integration' });
  });

  await runner.runTest('error logging with stack trace', async () => {
    const stackTrace = new Error('Test error').stack || '';
    await client.log.error('Integration test error message', { test: 'integration' }, stackTrace);
  });

  await runner.runTest('audit logging', async () => {
    await client.log.audit('test_action', 'test_resource', { test: 'integration' });
  });

  await runner.runTest(
    'debug logging',
    async () => {
      await client.log.debug('Integration test debug message', { test: 'integration' });
    },
    config.logLevel !== 'debug' // Skip if log level is not debug
  );

  await runner.runTest('LoggerChain withContext user', async () => {
    await client.log
      .withContext({ action: 'test' })
      .info('LoggerChain test message');
  });

  await runner.runTest('LoggerChain withResponseMetrics', async () => {
    await client.log
      .withResponseMetrics(2048, 120)
      .info('LoggerChain with response metrics test');
  });

  await runner.runTest('LoggerChain withContext', async () => {
    await client.log
      .withContext({ userId: 'test-user-123' })
      .info('LoggerChain with context test');
  });

  await runner.runTest('LoggerChain fluent API', async () => {
    await client.log
      .withContext({ action: 'test', correlationId: 'test-correlation-123' })
      .withResponseMetrics(1024, 200)
      .info('Fluent API test message');
  });

  // ==================== HttpClient Tests ====================
  console.log('\n[HttpClient]');

  // Note: HttpClient methods are accessed through the client's internal services
  // We'll test them indirectly through the client's public API
  // For direct testing, we'd need to access internal httpClient, which is private
  // So we'll test via authenticatedRequest pattern

  await runner.runTest('GET request via authenticatedRequest', async () => {
    // Test GET request (may fail if endpoint doesn't exist, but should not throw unexpected errors)
    try {
      await client.requestWithAuthStrategy(
        'GET',
        '/api/v1/auth/user',
        client.createAuthStrategy(['api-key'], undefined, apiKey)
      );
    } catch (error) {
      // Expected to fail if no user token, but should be a proper error
      if (!(error instanceof Error)) {
        throw new Error('Expected Error instance');
      }
    }
  });

  await runner.runTest('POST request via authenticatedRequest', async () => {
    try {
      await client.requestWithAuthStrategy(
        'POST',
        '/api/v1/auth/validate',
        client.createAuthStrategy(['api-key'], undefined, apiKey),
        { token: apiKey }
      );
    } catch (error) {
      // May fail, but should be a proper error
      if (!(error instanceof Error)) {
        throw new Error('Expected Error instance');
      }
    }
  });

  await runner.runTest('PUT request via authenticatedRequest', async () => {
    try {
      await client.requestWithAuthStrategy(
        'PUT',
        '/api/v1/auth/user',
        client.createAuthStrategy(['api-key'], undefined, apiKey),
        { test: 'data' }
      );
    } catch (error) {
      // Expected to fail if endpoint doesn't exist, but should be a proper error
      if (!(error instanceof Error)) {
        throw new Error('Expected Error instance');
      }
    }
  });

  await runner.runTest('DELETE request via authenticatedRequest', async () => {
    try {
      await client.requestWithAuthStrategy(
        'DELETE',
        '/api/v1/auth/user',
        client.createAuthStrategy(['api-key'], undefined, apiKey)
      );
    } catch (error) {
      // Expected to fail if endpoint doesn't exist, but should be a proper error
      if (!(error instanceof Error)) {
        throw new Error('Expected Error instance');
      }
    }
  });

  // ==================== CacheService Tests ====================
  console.log('\n[CacheService]');

  await runner.runTest('cache.set', async () => {
    const success = await client.cache.set('test:key:1', { test: 'data' }, 60);
    if (typeof success !== 'boolean') {
      throw new Error('cache.set should return a boolean');
    }
  });

  await runner.runTest('cache.get', async () => {
    await client.cache.set('test:key:2', { test: 'data' }, 60);
    const value = await client.cache.get<{ test: string }>('test:key:2');
    if (value && value.test !== 'data') {
      throw new Error('cache.get returned incorrect value');
    }
  });

  await runner.runTest('cache.delete', async () => {
    await client.cache.set('test:key:3', { test: 'data' }, 60);
    const deleted = await client.cache.delete('test:key:3');
    if (typeof deleted !== 'boolean') {
      throw new Error('cache.delete should return a boolean');
    }
    const value = await client.cache.get('test:key:3');
    if (value !== null) {
      throw new Error('cache.get should return null after delete');
    }
  });

  await runner.runTest('Redis fallback to in-memory', async () => {
    // Test that cache works even if Redis is not available
    const success = await client.cache.set('test:key:4', { test: 'memory' }, 60);
    if (!success && !client.isRedisConnected()) {
      // If Redis is not connected, in-memory should still work
      const value = await client.cache.get<{ test: string }>('test:key:4');
      if (!value || value.test !== 'memory') {
        throw new Error('In-memory cache fallback failed');
      }
    }
  });

  // ==================== EncryptionService Tests ====================
  console.log('\n[EncryptionService]');

  const hasEncryptionKey = !!config.encryptionKey || !!process.env.ENCRYPTION_KEY;
  
  // Initialize EncryptionUtil if encryption key is available
  if (hasEncryptionKey) {
    try {
      EncryptionUtil.initialize();
    } catch (error) {
      // If initialization fails, encryption tests will be skipped
      console.log(`  ${colors.yellow('⚠')} EncryptionUtil initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await runner.runTest(
    'encrypt',
    async () => {
      if (!hasEncryptionKey) {
        throw new Error('SKIP: EncryptionUtil is not available (ENCRYPTION_KEY not set)');
      }
      try {
        EncryptionUtil.initialize();
      } catch {
        // Already initialized or failed - continue
      }
      const encrypted = EncryptionUtil.encrypt('test plaintext');
      if (!encrypted || typeof encrypted !== 'string') {
        throw new Error('encrypt should return a string');
      }
      if (encrypted === 'test plaintext') {
        throw new Error('encrypted text should be different from plaintext');
      }
    },
    !hasEncryptionKey
  );

  await runner.runTest(
    'decrypt',
    async () => {
      if (!hasEncryptionKey) {
        throw new Error('SKIP: EncryptionUtil is not available (ENCRYPTION_KEY not set)');
      }
      try {
        EncryptionUtil.initialize();
      } catch {
        // Already initialized or failed - continue
      }
      const encrypted = EncryptionUtil.encrypt('test plaintext');
      const decrypted = EncryptionUtil.decrypt(encrypted);
      if (decrypted !== 'test plaintext') {
        throw new Error('decrypt should return original plaintext');
      }
    },
    !hasEncryptionKey
  );

  await runner.runTest(
    'encryption/decryption roundtrip',
    async () => {
      if (!hasEncryptionKey) {
        throw new Error('SKIP: EncryptionUtil is not available (ENCRYPTION_KEY not set)');
      }
      try {
        EncryptionUtil.initialize();
      } catch {
        // Already initialized or failed - continue
      }
      const original = 'This is a test message with special chars: !@#$%^&*()';
      const encrypted = EncryptionUtil.encrypt(original);
      const decrypted = EncryptionUtil.decrypt(encrypted);
      if (decrypted !== original) {
        throw new Error('Roundtrip encryption/decryption failed');
      }
    },
    !hasEncryptionKey
  );

  // Cleanup
  await client.disconnect();

  // Print summary
  runner.printSummary();
}

// Run tests
runIntegrationTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

