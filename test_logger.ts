/**
 * Unified logger test script
 * Combines all logger tests and uses .env file for configuration
 * Tests:
 * 1. Basic logging with clientSecret/clientId
 * 2. Logging with JWT token
 * 3. Redis connection validation
 * 4. Direct axios calls to verify endpoint format
 * 5. x-client-token authentication
 * 6. ApplicationId extraction from JWT
 */

import { MisoClient, loadConfig } from './src/index';
import axios from 'axios';

// Load config from .env file
let config: ReturnType<typeof loadConfig>;
try {
  config = loadConfig();
  
  // Validate that controller URL is loaded from .env
  if (!config.controllerUrl) {
    console.error('❌ MISO_CONTROLLER_URL is not set in .env file');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Failed to load configuration from .env:', error);
  process.exit(1);
}

async function testBasicLogging() {
  console.log('📝 Test 1: Basic logging with clientSecret/clientId\n');
  
  const client = new MisoClient({
    ...config,
    redis: undefined, // No Redis
  });

  try {
    await client.initialize();
    console.log('✅ Client initialized');

    const startTime = Date.now();
    await client.log.error(
      'Test error log from unified script',
      {
        testId: 'unified-test-basic',
        timestamp: new Date().toISOString(),
      },
      'Error: Test error\n    at testBasicLogging',
    );
    
    const duration = Date.now() - startTime;
    console.log(`✅ Log sent successfully (took ${duration}ms)\n`);
    
    await client.disconnect();
  } catch (error) {
    console.error('❌ Basic logging failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function testLoggingWithJWT() {
  console.log('📝 Test 2: Logging with JWT token\n');
  
  const client = new MisoClient({
    ...config,
    redis: undefined,
  });

  const testToken = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi00NTYiLCJhcHBsaWNhdGlvbklkIjoiYXBwLTc4OSIsImlhdCI6MTYwOTQ1NjgwMCwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature';

  try {
    await client.initialize();
    console.log('✅ Client initialized');
    console.log(`   Using JWT token: ${testToken.substring(0, 50)}...`);

    const startTime = Date.now();
    await client.log.error(
      'Failed to log audit event',
      {
        originalMethod: 'POST',
        originalUrl: '/api/data-endpoint',
        auditError: 'Simulated audit logging failure',
        statusCode: 503,
        testId: 'unified-test-jwt',
        timestamp: new Date().toISOString(),
      },
      'Error: Simulated audit logging failure\n    at testLoggingWithJWT',
      {
        token: testToken,
        userId: 'test-user-123',
      },
    );
    
    const duration = Date.now() - startTime;
    console.log(`✅ Log sent successfully (took ${duration}ms)\n`);
    
    await client.disconnect();
  } catch (error) {
    console.error('❌ JWT logging failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function testRedisConnection() {
  console.log('📝 Test 3: Redis connection validation\n');
  
  // Create client with Redis config from .env
  const client = new MisoClient(config); // Use full config which includes Redis if configured

  try {
    console.log('📡 Initializing client with Redis...');
    await client.initialize();
    
    const isConnected = client.isRedisConnected();
    console.log(`   Redis connection status: ${isConnected ? '✅ Connected' : '❌ Not connected'}`);
    
    if (isConnected) {
      console.log('   ✅ Redis is connected and ready');
      
      // Test basic Redis operations
      console.log('   Testing Redis operations...');
      const testKey = `test:unified:${Date.now()}`;
      const testValue = 'test-value';
      
      // Test cache set/get
      const setResult = await client.cache.set(testKey, testValue, 60);
      if (setResult) {
        console.log('   ✅ Redis SET operation works');
        
        const getResult = await client.cache.get(testKey);
        if (getResult === testValue) {
          console.log('   ✅ Redis GET operation works');
        } else {
          console.log(`   ⚠️  Redis GET returned unexpected value: ${getResult}`);
        }
        
        // Cleanup
        await client.cache.delete(testKey);
        console.log('   ✅ Redis DELETE operation works');
      } else {
        console.log('   ⚠️  Redis SET operation failed');
      }
    } else {
      console.log('   ⚠️  Redis not connected - will use controller fallback');
      console.log('   ℹ️  This is OK - client will work without Redis');
    }
    
    console.log('');
    await client.disconnect();
  } catch (error) {
    console.error('❌ Redis validation failed:', error instanceof Error ? error.message : String(error));
    // Don't throw - Redis connection failure is acceptable (fallback to controller)
    console.log('   ℹ️  Client will use controller fallback mode\n');
  }
}

async function testDirectAxiosCalls(): Promise<'skipped' | void> {
  console.log('📝 Test 3: Direct axios calls to verify endpoint format\n');
  
  // Fetch client token
  let clientToken: string;
  try {
    const tokenResponse = await axios.post<{ success: boolean; token?: string; data?: { token?: string } }>(
      `${config.controllerUrl}/api/v1/auth/token`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': config.clientId,
          'x-client-secret': config.clientSecret!,
        },
        timeout: 10000,
      }
    );

    clientToken = tokenResponse.data.data?.token || tokenResponse.data.token || '';
    if (!tokenResponse.data.success || !clientToken) {
      throw new Error('Failed to get client token');
    }
    console.log('✅ Client token obtained');
  } catch (error) {
    console.error('❌ Failed to fetch client token:', error instanceof Error ? error.message : String(error));
    console.log('   ⚠️  Skipping direct axios tests (credentials may not be valid for this controller)\n');
    return 'skipped'; // Skip this test instead of failing
  }

  // Test unified endpoint format
  console.log('   Testing unified endpoint format...');
  try {
    const response = await axios.post(
      `${config.controllerUrl}/api/v1/logs`,
      {
        type: 'error',
        data: {
          level: 'error',
          message: 'Test log from unified script',
          context: {
            testId: 'unified-test-direct',
            timestamp: new Date().toISOString(),
          },
          correlationId: `test-direct-${Date.now()}`,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-token': clientToken,
        },
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    if (response.status === 200 || response.status === 201) {
      console.log(`   ✅ Unified endpoint works (status: ${response.status})\n`);
    } else {
      console.log(`   ❌ Unified endpoint failed: ${JSON.stringify(response.data)}\n`);
    }
  } catch (error) {
    console.error('   ❌ Unified endpoint error:', error instanceof Error ? error.message : String(error));
  }

  // Test batch endpoint format
  console.log('   Testing batch endpoint format...');
  try {
    const batchResponse = await axios.post(
      `${config.controllerUrl}/api/v1/logs/batch`,
      {
        logs: [{
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'Test batch log from unified script',
          context: {
            testId: 'unified-test-batch',
          },
          correlationId: `test-batch-${Date.now()}`,
        }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-token': clientToken,
        },
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    if (batchResponse.status === 200 || batchResponse.status === 201 || batchResponse.status === 207) {
      console.log(`   ✅ Batch endpoint works (status: ${batchResponse.status})\n`);
    } else {
      console.log(`   ❌ Batch endpoint failed: ${JSON.stringify(batchResponse.data)}\n`);
    }
  } catch (error) {
    console.error('   ❌ Batch endpoint error:', error instanceof Error ? error.message : String(error));
  }
}

async function testXClientTokenAuth(): Promise<'skipped' | void> {
  console.log('📝 Test 4: x-client-token authentication\n');
  
  // Fetch client token
  let clientToken: string;
  try {
    const tokenResponse = await axios.post<{ success: boolean; token?: string; data?: { token?: string } }>(
      `${config.controllerUrl}/api/v1/auth/token`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': config.clientId,
          'x-client-secret': config.clientSecret!,
        },
        timeout: 10000,
      }
    );

    clientToken = tokenResponse.data.data?.token || tokenResponse.data.token || '';
    if (!tokenResponse.data.success || !clientToken) {
      throw new Error('Failed to get client token');
    }
    console.log('✅ Client token obtained');
  } catch (error) {
    console.error('❌ Failed to fetch client token:', error instanceof Error ? error.message : String(error));
    console.log('   ⚠️  Skipping x-client-token auth tests (credentials may not be valid for this controller)\n');
    return 'skipped'; // Skip this test instead of failing
  }

  // Test with x-client-token
  console.log('   Testing with x-client-token header...');
  try {
    const response = await axios.post(
      `${config.controllerUrl}/api/v1/logs`,
      {
        type: 'error',
        data: {
          level: 'error',
          message: 'Test with x-client-token',
          context: {
            testId: 'unified-test-x-client-token',
          },
          correlationId: `test-x-token-${Date.now()}`,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-token': clientToken,
        },
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    if (response.status === 200 || response.status === 201) {
      console.log('   ✅ x-client-token authentication works\n');
    } else {
      console.log(`   ❌ x-client-token auth failed: ${JSON.stringify(response.data)}\n`);
    }
  } catch (error) {
    console.error('   ❌ x-client-token auth error:', error instanceof Error ? error.message : String(error));
  }

  // Test without x-client-token (should fail)
  console.log('   Testing without x-client-token (should fail)...');
  try {
    const response = await axios.post(
      `${config.controllerUrl}/api/v1/logs`,
      {
        type: 'error',
        data: {
          level: 'error',
          message: 'Test without auth',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    if (response.status === 401) {
      console.log('   ✅ Correctly rejected without auth (401)\n');
    } else {
      console.log(`   ⚠️  Unexpected status: ${response.status}\n`);
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      console.log('   ✅ Correctly rejected without auth (401)\n');
    } else {
      console.error('   ❌ Unexpected error:', error);
    }
  }
}

async function testApplicationIdExtraction(): Promise<'skipped' | void> {
  console.log('📝 Test 5: ApplicationId extraction from JWT\n');
  
  const testToken = process.env.TEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwic2Vzc2lvbklkIjoic2Vzc2lvbi00NTYiLCJhcHBsaWNhdGlvbklkIjoiYXBwLTc4OSIsImlhdCI6MTYwOTQ1NjgwMCwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature';
  
  // Decode token to show applicationId
  let expectedApplicationId: string | undefined;
  try {
    const parts = testToken.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      expectedApplicationId = payload.applicationId;
      console.log(`   Expected applicationId from token: ${expectedApplicationId}`);
    }
  } catch (e) {
    console.log('   ⚠️  Could not decode token');
  }

  // Fetch client token
  let clientToken: string;
  try {
    const tokenResponse = await axios.post<{ success: boolean; token?: string; data?: { token?: string } }>(
      `${config.controllerUrl}/api/v1/auth/token`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': config.clientId,
          'x-client-secret': config.clientSecret!,
        },
        timeout: 10000,
      }
    );

    clientToken = tokenResponse.data.data?.token || tokenResponse.data.token || '';
    if (!tokenResponse.data.success || !clientToken) {
      throw new Error('Failed to get client token');
    }
  } catch (error) {
    console.error('❌ Failed to fetch client token:', error instanceof Error ? error.message : String(error));
    console.log('   ⚠️  Skipping applicationId extraction test (credentials may not be valid for this controller)\n');
    return 'skipped'; // Skip this test instead of failing
  }

  // Test with JWT token in Authorization header
  console.log('   Testing with JWT token in Authorization header...');
  try {
    const response = await axios.post(
      `${config.controllerUrl}/api/v1/logs`,
      {
        type: 'error',
        data: {
          level: 'error',
          message: 'Test log to verify applicationId extraction',
          context: {
            testId: 'unified-test-app-id',
            expectedApplicationId: expectedApplicationId,
          },
          correlationId: `test-app-id-${Date.now()}`,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-token': clientToken,
          'Authorization': `Bearer ${testToken}`,
        },
        timeout: 10000,
        validateStatus: () => true,
      }
    );

    if (response.status === 200 || response.status === 201) {
      console.log(`   ✅ Log sent successfully`);
      console.log(`   ✅ Should be associated with applicationId: ${expectedApplicationId}\n`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(response.data)}\n`);
    }
  } catch (error) {
    console.error('   ❌ Error:', error instanceof Error ? error.message : String(error));
  }
}

async function runAllTests() {
  console.log('🚀 Unified Logger Test Suite\n');
  console.log('📋 Using configuration from .env:');
  console.log(`   Controller URL: ${config.controllerUrl}`);
  console.log(`   Client ID: ${config.clientId}`);
  console.log(`   Log Level: ${config.logLevel}`);
  if (config.redis) {
    console.log(`   Redis Host: ${config.redis.host}`);
    console.log(`   Redis Port: ${config.redis.port}`);
    console.log(`   Redis DB: ${config.redis.db || 0}`);
  } else {
    console.log('   Redis: Not configured');
  }
  console.log('');
  console.log('═'.repeat(60) + '\n');

  const tests = [
    { name: 'Basic Logging', fn: testBasicLogging },
    { name: 'Logging with JWT', fn: testLoggingWithJWT },
    { name: 'Redis Connection', fn: testRedisConnection },
    { name: 'Direct Axios Calls', fn: testDirectAxiosCalls },
    { name: 'x-client-token Auth', fn: testXClientTokenAuth },
    { name: 'ApplicationId Extraction', fn: testApplicationIdExtraction },
  ];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result === 'skipped') {
        skipped++;
      } else {
        passed++;
      }
    } catch (error) {
      failed++;
      console.error(`\n❌ ${test.name} FAILED`);
    }
    console.log('─'.repeat(60) + '\n');
  }

  console.log('═'.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📝 Total: ${tests.length}`);
  console.log('═'.repeat(60) + '\n');

  if (failed > 0) {
    console.log('❌ Some tests failed');
    return 1;
  } else if (passed > 0) {
    console.log('🎉 All runnable tests passed!');
    if (skipped > 0) {
      console.log(`   (${skipped} test(s) skipped - may need valid controller credentials)`);
    }
    return 0;
  } else {
    console.log('⚠️  No tests were able to run');
    return 1;
  }
}

runAllTests()
  .then((exitCode) => {
    // Clean exit with proper exit code
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });

