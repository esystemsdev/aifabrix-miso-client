/**
 * Example usage of MisoClient SDK
 */

import { MisoClient } from './src/index';

async function example() {
  // Initialize the client
  const client = new MisoClient({
    controllerUrl: 'https://controller.aifabrix.ai',
    environment: 'dev',
    applicationKey: 'example-app',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: 6379,
      password: process.env.REDIS_PASSWORD
    },
    logLevel: 'debug'
  });

  try {
    // Initialize connection
    await client.initialize();
    console.log('Client initialized successfully');

    // Example token (in real usage, this would come from request headers)
    const token = 'your-jwt-token-here';

    // Validate token
    const isValid = await client.validateToken(token);
    console.log('Token valid:', isValid);

    if (isValid) {
      // Get user info
      const user = await client.getUser(token);
      console.log('User:', user);

      // Get user roles
      const roles = await client.getRoles(token);
      console.log('User roles:', roles);

      // Check specific role
      const isAdmin = await client.hasRole(token, 'admin');
      console.log('Is admin:', isAdmin);

      // Log some events
      client.log.info('User accessed application', {
        userId: user?.id,
        username: user?.username
      });

      client.log.audit('user.login', 'authentication', {
        userId: user?.id,
        ip: '192.168.1.1'
      });
    }

    // Example error logging
    try {
      throw new Error('Something went wrong');
    } catch (error) {
      client.log.error('Application error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  } catch (error) {
    console.error('Example failed:', error);
  } finally {
    // Cleanup
    await client.disconnect();
    console.log('Client disconnected');
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
}

export { example };
