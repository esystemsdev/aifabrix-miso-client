/**
 * Step 6: Activate Audit
 * 
 * Complete example with authentication, RBAC, logging, and audit trails using
 * the unified logging interface.
 * 
 * The unified logging interface provides automatic context extraction and a
 * minimal API for audit logging with ISO 27001 compliance (oldValues/newValues).
 */

// For development: import from '../src/index'
import { MisoClient, loadConfig, getLogger } from '@aifabrix/miso-client';

async function completeExample() {
  // Create client - loads from .env automatically
  // All config (Redis, logLevel, cache) goes in .env file
  const client = new MisoClient(loadConfig());

  try {
    await client.initialize();
    console.log('✅ Client fully configured');

    const token = 'your-jwt-token-here';

    // Get logger instance - context is automatically extracted from AsyncLocalStorage
    const logger = getLogger();

    // Step 3: Authentication
    const isValid = await client.validateToken(token);
    if (!isValid) {
      // Audit: Access denied (no entityId needed for authentication failures)
      await logger.audit('access.denied', 'authentication', 'unknown');
      return;
    }

    const user = await client.getUser(token);

    // Attach context for non-Express usage
    await client.log
      .withContext({ userId: user?.id })
      .info('User context attached');

    // Step 4: RBAC
    const canEdit = await client.hasPermission(token, 'edit:content');
    if (!canEdit) {
      // Audit: Authorization denied
      await logger.audit('access.denied', 'authorization', user?.id || 'unknown');
      console.log('❌ Insufficient permissions');
      return;
    }

    // Step 5: Logging (no context object needed - auto-extracted)
    await logger.info('User logged in successfully');

    // Step 6: Audit Trail - Log important user actions
    // Audit: User login (no oldValues/newValues needed for login)
    await logger.audit('user.login', 'authentication', user?.id || 'unknown');

    // Audit example: Content creation (ISO 27001 compliant with newValues)
    await logger.audit(
      'post.created',
      'content',
      'post-123',
      undefined, // oldValues (not applicable for CREATE)
      { // newValues (ISO 27001 requirement)
        postTitle: 'My New Post',
        category: 'technology',
      }
    );

    // Audit example: Content update (ISO 27001 compliant with oldValues and newValues)
    const oldPost = { title: 'Old Title', category: 'general' };
    const newPost = { title: 'Updated Title', category: 'technology' };
    await logger.audit(
      'post.updated',
      'content',
      'post-123',
      oldPost, // oldValues (ISO 27001 requirement)
      newPost  // newValues (ISO 27001 requirement)
    );

    // Audit example: Permission checks
    await logger.audit('role.checked', 'authorization', user?.id || 'unknown');

    // Audit example: Sensitive operations (user deletion)
    await logger.audit(
      'user.deleted',
      'administration',
      'user-456',
      { userId: 'user-456', status: 'active' }, // oldValues
      { userId: 'user-456', status: 'deleted', reason: 'Policy violation' } // newValues
    );

    console.log('✅ Complete flow: Auth + RBAC + Logging + Audit');

  } catch (error) {
    // Error details are auto-extracted (stack trace, error name, error message)
    await logger.error('Application error', error);
  } finally {
    await client.disconnect();
  }
}

export { completeExample };

