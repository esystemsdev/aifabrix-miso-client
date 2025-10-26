/**
 * Step 3: Activate Authentication
 * 
 * Basic token validation to verify user identity.
 */

import { MisoClient } from '../src/index';

async function authenticationExample() {
  // Create client with controller configuration
  const client = new MisoClient({
    controllerUrl: 'https://controller.aifabrix.ai',
    environment: 'dev',
    applicationKey: 'my-app',
    applicationId: 'my-app-id-123',
  });

  try {
    // Initialize the client
    await client.initialize();
    console.log('✅ Client initialized successfully');

    // Get token from your application (e.g., from HTTP request header)
    // In real usage: const token = req.headers.authorization?.replace('Bearer ', '');
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

