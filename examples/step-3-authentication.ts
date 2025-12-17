/**
 * Step 3: Activate Authentication
 * 
 * Basic token validation to verify user identity.
 */

// Note: When copying this example to your project, use: import { MisoClient, loadConfig } from '@aifabrix/miso-client';
import { MisoClient, loadConfig } from '../src/index';

async function authenticationExample() {
  // Create client - loads from .env automatically
  // Or manually: new MisoClient({ controllerUrl, clientId, clientSecret })
  const client = new MisoClient(loadConfig());

  try {
    // Initialize the client
    await client.initialize();
    console.log('✅ Client initialized successfully');

    // Get token from your application (e.g., from HTTP request header)
    // In real usage: const token = client.getToken(req);
    const token = 'your-jwt-token-here';

    // Validate the token
    const isValid = await client.validateToken(token);
    
    if (isValid) {
      console.log('✅ Token is valid');
      
      // Get user information
      const user = await client.getUser(token);
      console.log('👤 User:', user);
    } else {
      console.log('❌ Token is invalid');
    }
  } catch (error) {
    console.error('❌ Authentication error:', error);
  } finally {
    // Clean up connections
    await client.disconnect();
  }
}

export { authenticationExample };

