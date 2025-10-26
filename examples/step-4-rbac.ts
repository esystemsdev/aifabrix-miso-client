/**
 * Step 4: Activate RBAC (Role-Based Access Control)
 * 
 * Check user roles and enforce access control.
 */

import { MisoClient } from '../src/index';

async function rbacExample() {
  // Create client (same as Step 3)
  const client = new MisoClient({
    controllerUrl: 'https://controller.aifabrix.ai',
    environment: 'dev',
    applicationKey: 'my-app',
    applicationId: 'my-app-id-123',
    redis: {
      host: 'localhost',
      port: 6379,
    },
  });

  try {
    await client.initialize();
    console.log('✅ Client initialized with Redis caching');

    const token = 'your-jwt-token-here';

    // Validate token (from Step 3)
    const isValid = await client.validateToken(token);
    if (!isValid) {
      console.log('❌ Token is invalid');
      return;
    }

    // NEW: Get user roles
    const roles = await client.getRoles(token);
    console.log('🔑 User roles:', roles);

    // NEW: Check specific role
    const isAdmin = await client.hasRole(token, 'admin');
    console.log('👑 Is admin:', isAdmin);

    // NEW: Check multiple roles (user needs any of these)
    const canManage = await client.hasAnyRole(token, ['admin', 'manager']);
    console.log('⚙️ Can manage:', canManage);

    // Example: Gate a feature based on role
    if (isAdmin) {
      console.log('🔐 Admin feature unlocked');
      // Show admin dashboard, etc.
    }

  } catch (error) {
    console.error('❌ RBAC error:', error);
  } finally {
    await client.disconnect();
  }
}

export { rbacExample };

