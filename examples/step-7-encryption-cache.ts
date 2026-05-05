/**
 * Step 7: Encryption & Caching
 *
 * Examples of encrypting sensitive data and using generic caching.
 */

// For development: import from '../src/index'
import { MisoClient, loadConfig, EncryptionUtil } from "@aifabrix/miso-client";

async function encryptionCacheExample() {
  // Create client - loads from .env automatically
  // Make sure ENCRYPTION_KEY is set in .env for encryption to work
  const client = new MisoClient(loadConfig());

  try {
    await client.initialize();
    console.log("✅ Client initialized");

    const token = "your-jwt-token-here";

    // ==================== ENCRYPTION ====================

    // EncryptionUtil requires ENCRYPTION_KEY in .env (64 hex characters = 32 bytes)
    try {
      EncryptionUtil.initialize();
      console.log("🔒 Encryption service is available");

      // Encrypt sensitive data
      const sensitiveData = JSON.stringify({
        creditCard: "4532-1234-5678-9010",
        ssn: "123-45-6789",
        apiKey: "secret-api-key-123",
      });

      const encrypted = EncryptionUtil.encrypt(sensitiveData);
      console.log("🔐 Encrypted data:", encrypted);

      // Decrypt when needed
      const decrypted = EncryptionUtil.decrypt(encrypted);
      console.log("🔓 Decrypted data:", JSON.parse(decrypted));

      // Example: Storing encrypted user preferences
      const userPreferences = {
        theme: "dark",
        notifications: true,
        language: "en",
      };

      const encryptedPreferences = EncryptionUtil.encrypt(
        JSON.stringify(userPreferences),
      );
      console.log("💾 Encrypted preferences ready for storage");

      // Later, decrypt when retrieving
      const decryptedPreferences = JSON.parse(
        EncryptionUtil.decrypt(encryptedPreferences),
      );
      console.log("📖 Retrieved preferences:", decryptedPreferences);
    } catch (error) {
      console.log(
        "⚠️ Encryption not available:",
        error instanceof Error ? error.message : "Unknown error",
      );
      console.log(
        "   Set ENCRYPTION_KEY in .env (64 hex characters = 32 bytes)",
      );
    }

    // ==================== GENERIC CACHING ====================

    console.log("\n📦 Generic caching examples:");

    // Example 1: Cache expensive computation results
    const userId = "user-123";
    const cacheKey = `user:${userId}:computed-data`;

    // Check cache first
    const cachedData = await client.cache.get<{
      result: number;
      computedAt: string;
    }>(cacheKey);

    if (cachedData) {
      console.log("⚡ Got data from cache:", cachedData);
    } else {
      console.log("💭 Computing expensive data...");

      // Simulate expensive computation
      const computedData = {
        result: Math.random() * 1000,
        computedAt: new Date().toISOString(),
      };

      // Cache for 10 minutes (600 seconds)
      await client.cache.set(cacheKey, computedData, 600);
      console.log("💾 Cached computed data");
    }

    // Example 2: Cache API responses
    interface Product {
      id: string;
      name: string;
      price: number;
    }

    // Use arrow function to avoid function declaration in block scope
    const getProduct = async (id: string): Promise<Product> => {
      const productCacheKey = `product:${id}`;

      // Check cache
      const cachedProduct = await client.cache.get<Product>(productCacheKey);
      if (cachedProduct) {
        console.log("⚡ Product from cache:", cachedProduct);
        return cachedProduct;
      }

      // Simulate database fetch
      console.log("💭 Fetching product from database...");
      const product: Product = {
        id,
        name: `Product ${id}`,
        price: 99.99,
      };

      // Cache for 5 minutes (300 seconds)
      await client.cache.set(productCacheKey, product, 300);
      console.log("💾 Product cached");

      return product;
    };

    // Use the cached product function
    await getProduct("prod-123");
    await getProduct("prod-123"); // Second call uses cache

    // Example 3: Cache user session data
    if (await client.validateToken(token)) {
      const user = await client.getUser(token);
      if (user) {
        const sessionCacheKey = `session:${user.id}`;
        const sessionData = {
          userId: user.id,
          username: user.username,
          lastAccess: new Date().toISOString(),
          preferences: {
            theme: "dark",
            language: "en",
          },
        };

        // Cache session for 30 minutes (1800 seconds)
        await client.cache.set(sessionCacheKey, sessionData, 1800);
        console.log("💾 User session cached");

        // Retrieve later
        const cachedSession =
          await client.cache.get<typeof sessionData>(sessionCacheKey);
        if (cachedSession) {
          console.log("📖 Retrieved session:", cachedSession);
        }
      }
    }

    // Example 4: Delete from cache
    await client.cache.delete(cacheKey);
    console.log("🗑️ Deleted from cache");

    // Example 5: Clear all cache (use with caution)
    // await client.cache.clear();
    // console.log('🧹 All cache cleared');

    console.log("\n✅ Encryption & caching examples completed");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await client.disconnect();
  }
}

export { encryptionCacheExample };
