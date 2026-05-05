/**
 * Step 4: Activate RBAC (Role-Based Access Control)
 *
 * Check user roles and enforce access control.
 */

// For development: import from '../src/index'
import { MisoClient, loadConfig } from "@aifabrix/miso-client";

async function rbacExample() {
  // Create client - loads from .env automatically
  // Redis config goes in .env: REDIS_HOST=localhost, REDIS_PORT=6379
  const client = new MisoClient(loadConfig());

  try {
    await client.initialize();
    console.log("✅ Client initialized with Redis caching");

    const token = "your-jwt-token-here";

    // Validate token (from Step 3)
    const isValid = await client.validateToken(token);
    if (!isValid) {
      console.log("❌ Token is invalid");
      return;
    }

    // NEW: Get user roles
    const roles = await client.getRoles(token);
    console.log("🔑 User roles:", roles);

    // NEW: Check specific role
    const isAdmin = await client.hasRole(token, "admin");
    console.log("👑 Is admin:", isAdmin);

    // NEW: Check multiple roles (user needs any of these)
    const canManage = await client.hasAnyRole(token, ["admin", "manager"]);
    console.log("⚙️ Can manage:", canManage);

    // Example: Gate a feature based on role
    if (isAdmin) {
      console.log("🔐 Admin feature unlocked");
      // Show admin dashboard, etc.
    }
  } catch (error) {
    console.error("❌ RBAC error:", error);
  } finally {
    await client.disconnect();
  }
}

export { rbacExample };
