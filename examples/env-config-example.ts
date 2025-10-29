/**
 * Example: Configuration from .env
 * Shows how to use loadConfig() for automatic .env loading
 */
import { MisoClient, loadConfig } from '../src/index';

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
      
      await client.log.info('User accessed app', {
        userId: user?.id,
      });
    }
  } finally {
    await client.disconnect();
  }
}

envConfigExample().catch(console.error);

