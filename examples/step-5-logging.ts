/**
 * Step 5: Activate Logging
 * 
 * Send application logs to the AI Fabrix controller.
 */

import { MisoClient } from '../src/index';

async function loggingExample() {
  const client = new MisoClient({
    controllerUrl: 'https://controller.aifabrix.ai',
    environment: 'dev',
    applicationKey: 'my-app',
    applicationId: 'my-app-id-123',
    apiKey: 'dev-my-app-my-app-id-123-a1b2c3d4e5f6', // Required for logging
    redis: {
      host: 'localhost',
      port: 6379,
    },
  });

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
}

let someCondition = false;

export { loggingExample };

