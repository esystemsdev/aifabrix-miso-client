/**
 * Step 5: Activate Logging
 * 
 * Send application logs to the AI Fabrix controller using the unified logging interface.
 * 
 * The unified logging interface provides a minimal API (1-3 parameters) with automatic
 * context extraction from AsyncLocalStorage. Context is automatically extracted when using
 * Express middleware or can be set manually with setLoggerContext().
 */

// For development: import from '../src/index'
import { MisoClient, loadConfig, getLogger, setLoggerContext } from '@aifabrix/miso-client';

async function loggingExample() {
  // Create client - loads from .env automatically
  const client = new MisoClient(loadConfig());

  try {
    await client.initialize();
    const token = 'your-jwt-token-here';

    // Validate token and get user (Steps 3-4)
    const isValid = await client.validateToken(token);
    if (!isValid) return;

    const user = await client.getUser(token);

    // Set logger context manually (for non-Express environments)
    // In Express apps, use loggerContextMiddleware instead
    setLoggerContext({
      userId: user?.id,
      correlationId: 'req-123',
      ipAddress: '192.168.1.1',
      token: token,
    });

    // Get logger instance - context is automatically extracted from AsyncLocalStorage
    const logger = getLogger();

    // NEW: Log informational messages (no context object needed - auto-extracted)
    await logger.info('User accessed dashboard');

    // NEW: Log errors (error object is optional - auto-extracts stack trace)
    try {
      // Some operation that might fail
      await performOperation();
    } catch (error) {
      // Error details (stack trace, error name, error message) are auto-extracted
      await logger.error('Operation failed', error);
    }

    // NEW: Use debug for detailed diagnostic information
    await logger.debug('Processing user request');

    console.log('📊 Logs sent to controller');

  } catch (error) {
    console.error('❌ Logging error:', error);
  } finally {
    await client.disconnect();
  }
}

async function performOperation() {
  // Your application logic
  // This is a placeholder for any operation that might fail
  throw new Error('Operation failed');
}

export { loggingExample };

