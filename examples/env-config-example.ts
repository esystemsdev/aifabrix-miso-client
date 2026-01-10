/**
 * Example: Configuration from .env
 * Shows how to use loadConfig() for automatic .env loading
 */
// For development: import from '../src/index'
import { MisoClient, loadConfig, getLogger, setLoggerContext } from '@aifabrix/miso-client';

async function envConfigExample() {
  // Auto-load from .env file - that's it!
  const client = new MisoClient(loadConfig());

  try {
    await client.initialize();
    console.log('✅ Client initialized from .env');

    const token = 'your-jwt-token';
    const isValid = await client.validateToken(token);
    
    if (isValid) {
      const user = await client.getUser(token);
      const roles = await client.getRoles(token);
      console.log('👤 User:', user);
      console.log('🔑 Roles:', roles);
      
      // Set logger context (for non-Express environments)
      // In Express apps, use loggerContextMiddleware instead
      setLoggerContext({
        userId: user?.id,
        token: token,
      });
      
      // Get logger instance - context is automatically extracted
      const logger = getLogger();
      
      // Log with unified interface (no context object needed - auto-extracted)
      await logger.info('User accessed app');
    }
  } finally {
    await client.disconnect();
  }
}

envConfigExample().catch(console.error);

