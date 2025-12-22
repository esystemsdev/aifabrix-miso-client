/**
 * Step 6: Activate Audit
 * 
 * Complete example with authentication, RBAC, logging, and audit trails.
 */

// For development: import from '../src/index'
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

async function completeExample() {
  // Create client - loads from .env automatically
  // All config (Redis, logLevel, cache) goes in .env file
  const client = new MisoClient(loadConfig());

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

