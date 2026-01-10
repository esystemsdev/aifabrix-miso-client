/**
 * Example usage of MisoClient SDK with unified logging interface
 * 
 * The unified logging interface provides a minimal API (1-3 parameters) with
 * automatic context extraction from AsyncLocalStorage.
 */

// For development: import from '../src/index'
import { MisoClient, loadConfig, getLogger, setLoggerContext } from '@aifabrix/miso-client';

async function example() {
  // Initialize the client with auto-loaded configuration
  // Environment variables are automatically loaded with sensible defaults
  const client = new MisoClient(loadConfig());

  try {
    // Initialize connection
    await client.initialize();
    console.log('Client initialized successfully');

    // Example token (in real usage, this would come from request headers)
    const token = 'your-jwt-token-here';

    // Set logger context manually (for non-Express environments)
    // In Express apps, use loggerContextMiddleware instead
    setLoggerContext({
      correlationId: 'req-123',
      ipAddress: '192.168.1.1',
      token: token,
    });

    // Get logger instance - context is automatically extracted from AsyncLocalStorage
    const logger = getLogger();

    // Validate token
    const isValid = await client.validateToken(token);
    console.log('Token valid:', isValid);

    if (isValid) {
      // Get user info
      const user = await client.getUser(token);
      console.log('User:', user);

      // Update context with user ID
      setLoggerContext({ userId: user?.id });

      // Get user roles
      const roles = await client.getRoles(token);
      console.log('User roles:', roles);

      // Check specific role
      const isAdmin = await client.hasRole(token, 'admin');
      console.log('Is admin:', isAdmin);

      // Log some events (no context object needed - auto-extracted)
      await logger.info('User accessed application');

      // Audit: User login (no oldValues/newValues needed for login)
      await logger.audit('user.login', 'authentication', user?.id || 'unknown');
    }

    // Example error logging (error details are auto-extracted)
    try {
      throw new Error('Something went wrong');
    } catch (error) {
      // Error details (stack trace, error name, error message) are auto-extracted
      await logger.error('Application error', error);
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
