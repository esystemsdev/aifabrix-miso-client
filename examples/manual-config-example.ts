/**
 * Example: Manual Configuration
 * Shows how to configure client with explicit parameters
 */
// For development: import from '../src/index'
import { MisoClient } from '@aifabrix/miso-client';

async function manualConfigExample() {
  const client = new MisoClient({
    controllerUrl: 'http://localhost:3000',
    clientId: 'ctrl-dev-my-app',
    clientSecret: 'your-secret-here',
    redis: {
      host: 'localhost',
      port: 6379,
    },
    logLevel: 'info',
    // Optional: Encryption key (or set ENCRYPTION_KEY env var)
    encryptionKey: 'your-encryption-key-here', // 32-byte key in hex/base64/raw string
  });

  try {
    await client.initialize();
    console.log('✅ Client initialized');

    const token = 'your-jwt-token';
    const isValid = await client.validateToken(token);
    
    if (isValid) {
      const user = await client.getUser(token);
      console.log('👤 User:', user);
    }
  } finally {
    await client.disconnect();
  }
}

manualConfigExample().catch(console.error);

