/**
 * Step 6: Activate Audit
 * 
 * Complete example with authentication, RBAC, logging, and audit trails.
 */

import { MisoClient } from '../src/index';

async function completeExample() {
  const client = new MisoClient({
    controllerUrl: 'https://controller.aifabrix.ai',
    environment: 'dev',
    applicationKey: 'my-app',
    applicationId: 'my-app-id-123',
    apiKey: 'dev-my-app-my-app-id-123-a1b2c3d4e5f6',
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'your-redis-password',
    },
    logLevel: 'info',
    cache: {
      roleTTL: 900,      // 15 minutes
      permissionTTL: 900, // 15 minutes
    },
  });

  try {
    await client.initialize();
    console.log('✅ Client fully configured');

    const token = 'your-jwt-token-here';

    // Step 3: Authentication
    const isValid = await client.validateToken(token);
    if (!isValid) {
      await client.log.audit('access.denied', 'authentication', {
        reason: 'Invalid token',
        ip: '192.168.1.1',
      });
      return;
    }

    const user = await client.getUser(token);

    // Step 4: RBAC
    const canEdit = await client.hasPermission(token, 'edit:content');
    if (!canEdit) {
      await client.log.audit('access.denied', 'authorization', {
        userId: user?.id,
        action: 'edit_content',
        resource: 'posts',
      });
      console.log('❌ Insufficient permissions');
      return;
    }

    // Step 5: Logging
    await client.log.info('User logged in successfully', {
      userId: user?.id,
      username: user?.username,
      email: user?.email,
    });

    // Step 6: Audit Trail - Log important user actions
    await client.log.audit('user.login', 'authentication', {
      userId: user?.id,
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
      timestamp: new Date().toISOString(),
    });

    // Audit example: Content changes
    await client.log.audit('post.created', 'content', {
      userId: user?.id,
      postId: 'post-123',
      postTitle: 'My New Post',
      category: 'technology',
    });

    // Audit example: Permission checks
    await client.log.audit('role.checked', 'authorization', {
      userId: user?.id,
      checkedRole: 'admin',
      result: 'granted',
    });

    // Audit example: Sensitive operations
    await client.log.audit('user.deleted', 'administration', {
      userId: user?.id,
      deletedUserId: 'user-456',
      reason: 'Policy violation',
    });

    console.log('✅ Complete flow: Auth + RBAC + Logging + Audit');

  } catch (error) {
    await client.log.error('Application error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    await client.disconnect();
  }
}

export { completeExample };

