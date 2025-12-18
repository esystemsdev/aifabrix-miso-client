/**
 * Step 5: Activate Logging
 * 
 * Send application logs to the AI Fabrix controller.
 */

// Note: When copying this example to your project, use: import { MisoClient, loadConfig } from '@aifabrix/miso-client';
import { MisoClient, loadConfig } from '../src/index';

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

    // NEW: Log informational messages
    await client.log.info('User accessed dashboard', {
      userId: user?.id,
      username: user?.username,
      timestamp: new Date().toISOString(),
    });

    // NEW: Log errors
    try {
      // Some operation that might fail
      await performOperation();
    } catch (error) {
      await client.log.error('Operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: user?.id,
      });
    }

    // NEW: Use debug for detailed diagnostic information
    await client.log.debug('Processing user request', {
      userId: user?.id,
      requestDetails: '...',
    });

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

